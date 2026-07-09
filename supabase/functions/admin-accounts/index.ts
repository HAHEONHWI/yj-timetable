import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const usernamePattern = /^[a-z0-9_-]{3,32}$/;
const roles = new Set(["dev", "manager", "teacher"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function usernameToEmail(username: string) {
  return `${username}@yjms.local`;
}

function normalizeAccount(value: unknown) {
  const account = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    userId: typeof account.userId === "string" ? account.userId : "",
    username: typeof account.username === "string" ? account.username.trim() : "",
    displayName: typeof account.displayName === "string" ? account.displayName.trim() : "",
    role: typeof account.role === "string" ? account.role : "teacher",
    password: typeof account.password === "string" ? account.password : "",
    isActive: account.isActive !== false,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json({ ok: false, error: "Missing admin auth token" }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: userResult, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userResult.user) {
    return json({ ok: false, error: "Invalid admin auth token" }, 401);
  }

  const { data: actorProfile, error: actorProfileError } = await supabaseAdmin
    .from("admin_profiles")
    .select("user_id, username, display_name, role, is_active")
    .eq("user_id", userResult.user.id)
    .single();

  if (actorProfileError || !actorProfile || actorProfile.is_active !== true) {
    return json({ ok: false, error: "Admin account is not active" }, 403);
  }

  const actorRole = actorProfile.role || "teacher";
  const actorCanManage = actorRole === "dev" || actorRole === "manager";
  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "list";

  async function audit(actionName: string, targetId: string | null, afterData: unknown, success: boolean, errorMessage = "") {
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: actorProfile.user_id,
      actor_username: actorProfile.username,
      actor_name: actorProfile.display_name || actorProfile.username,
      actor_role: actorRole,
      action: actionName,
      target_type: "admin_profile",
      target_id: targetId,
      after_data: afterData,
      success,
      error_message: errorMessage || null,
      user_agent: req.headers.get("user-agent"),
    });
  }

  async function listPayload() {
    const { data: accounts, error: accountsError } = actorCanManage
      ? await supabaseAdmin
          .from("admin_profiles")
          .select("user_id, username, display_name, role, is_active, created_at, updated_at")
          .order("role", { ascending: true })
          .order("username", { ascending: true })
      : { data: [], error: null };

    if (accountsError) {
      return json({ ok: false, error: accountsError.message }, 500);
    }

    const { data: auditLogs, error: auditError } = await supabaseAdmin
      .from("audit_logs")
      .select("id, created_at, actor_username, actor_name, actor_role, action, target_type, target_id, success, error_message")
      .order("created_at", { ascending: false })
      .limit(80);

    if (auditError) {
      return json({ ok: false, error: auditError.message }, 500);
    }

    return json({ ok: true, accounts: accounts || [], auditLogs: auditLogs || [] });
  }

  if (action === "list") {
    return listPayload();
  }

  if (!actorCanManage) {
    await audit(`admin_account_${action}`, null, body.account || null, false, "Permission denied");
    return json({ ok: false, error: "Permission denied" }, 403);
  }

  const account = normalizeAccount(body.account);
  if (account.role === "dev" && actorRole !== "dev") {
    await audit(`admin_account_${action}`, account.userId || account.username, account, false, "Only dev can assign dev role");
    return json({ ok: false, error: "Only dev can assign dev role" }, 403);
  }

  if (action === "create") {
    if (!usernamePattern.test(account.username)) {
      return json({ ok: false, error: "Invalid username" }, 400);
    }
    if (!account.displayName) {
      return json({ ok: false, error: "Display name is required" }, 400);
    }
    if (!roles.has(account.role)) {
      return json({ ok: false, error: "Invalid role" }, 400);
    }
    if (!account.password || account.password.length < 6) {
      return json({ ok: false, error: "Password must be at least 6 characters" }, 400);
    }

    const { data: existingProfile } = await supabaseAdmin
      .from("admin_profiles")
      .select("user_id")
      .eq("username", account.username)
      .maybeSingle();
    if (existingProfile) {
      return json({ ok: false, error: "Username already exists" }, 409);
    }

    const email = usernameToEmail(account.username);
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: account.password,
      email_confirm: true,
      user_metadata: {},
      app_metadata: { provider: "email", providers: ["email"] },
    });

    if (createError || !createdUser.user) {
      await audit("admin_account_create", account.username, account, false, createError?.message || "Create user failed");
      return json({ ok: false, error: createError?.message || "Create user failed" }, 400);
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("admin_profiles")
      .insert({
        user_id: createdUser.user.id,
        username: account.username,
        display_name: account.displayName,
        role: account.role,
        is_active: account.isActive,
      })
      .select("user_id, username, display_name, role, is_active, created_at, updated_at")
      .single();

    if (profileError) {
      await audit("admin_account_create", createdUser.user.id, account, false, profileError.message);
      return json({ ok: false, error: profileError.message }, 400);
    }

    await audit("admin_account_create", profile.user_id, profile, true);
    return json({ ok: true, account: profile });
  }

  if (!account.userId) {
    return json({ ok: false, error: "Missing account id" }, 400);
  }

  const { data: targetProfile, error: targetError } = await supabaseAdmin
    .from("admin_profiles")
    .select("user_id, username, display_name, role, is_active")
    .eq("user_id", account.userId)
    .single();

  if (targetError || !targetProfile) {
    return json({ ok: false, error: "Account not found" }, 404);
  }

  if (targetProfile.role === "dev" && actorRole !== "dev") {
    await audit(`admin_account_${action}`, account.userId, account, false, "Manager cannot modify dev account");
    return json({ ok: false, error: "Manager cannot modify dev account" }, 403);
  }

  if (targetProfile.user_id === actorProfile.user_id && (action === "deactivate" || account.isActive === false || account.role !== targetProfile.role)) {
    return json({ ok: false, error: "Cannot deactivate or change role of current account" }, 400);
  }

  if (action === "deactivate") {
    const { data: profile, error: updateError } = await supabaseAdmin
      .from("admin_profiles")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", account.userId)
      .select("user_id, username, display_name, role, is_active, created_at, updated_at")
      .single();

    if (updateError) {
      await audit("admin_account_deactivate", account.userId, account, false, updateError.message);
      return json({ ok: false, error: updateError.message }, 400);
    }

    await audit("admin_account_deactivate", account.userId, profile, true);
    return json({ ok: true, account: profile });
  }

  if (action === "update") {
    if (!account.displayName) {
      return json({ ok: false, error: "Display name is required" }, 400);
    }
    if (!roles.has(account.role)) {
      return json({ ok: false, error: "Invalid role" }, 400);
    }
    if (account.password && account.password.length < 6) {
      return json({ ok: false, error: "Password must be at least 6 characters" }, 400);
    }

    if (account.password) {
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(account.userId, {
        password: account.password,
      });
      if (passwordError) {
        await audit("admin_account_update", account.userId, account, false, passwordError.message);
        return json({ ok: false, error: passwordError.message }, 400);
      }
    }

    const { data: profile, error: updateError } = await supabaseAdmin
      .from("admin_profiles")
      .update({
        display_name: account.displayName,
        role: account.role,
        is_active: account.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", account.userId)
      .select("user_id, username, display_name, role, is_active, created_at, updated_at")
      .single();

    if (updateError) {
      await audit("admin_account_update", account.userId, account, false, updateError.message);
      return json({ ok: false, error: updateError.message }, 400);
    }

    await audit("admin_account_update", account.userId, profile, true);
    return json({ ok: true, account: profile });
  }

  return json({ ok: false, error: "Unknown action" }, 400);
});
