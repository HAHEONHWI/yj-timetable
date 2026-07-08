import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
  const { state, password } = await req.json().catch(() => ({ state: null, password: "" }));
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return json({ ok: false, error: "Invalid state" }, 400);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let actorId: string | null = null;
  let actorUsername = "legacy-admin";
  let actorName = "Legacy Admin";
  let actorRole = "manager";

  function verifyLegacyPassword() {
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    return Boolean(adminPassword && password === adminPassword);
  }

  if (token) {
    const { data: userResult, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userResult.user) {
      if (!verifyLegacyPassword()) {
        return json({ ok: false, error: "Invalid admin auth token" }, 401);
      }
    } else {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("admin_profiles")
        .select("username, display_name, role, is_active")
        .eq("user_id", userResult.user.id)
        .single();

      if (profileError || !profile || profile.is_active !== true) {
        return json({ ok: false, error: "Admin account is not active" }, 403);
      }

      actorId = userResult.user.id;
      actorUsername = profile.username;
      actorName = profile.display_name || profile.username;
      actorRole = profile.role || "manager";
    }
  } else if (!verifyLegacyPassword()) {
    return json({ ok: false, error: "Missing or invalid admin auth token" }, 401);
  }

  const { data: beforeRows } = await supabaseAdmin
    .from("app_state")
    .select("data")
    .eq("id", "main")
    .limit(1);
  const beforeState = beforeRows && beforeRows[0] ? beforeRows[0].data : null;

  const { error } = await supabaseAdmin
    .from("app_state")
    .upsert({ id: "main", data: state, updated_at: new Date().toISOString() });

  if (error) {
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: actorId,
      actor_username: actorUsername,
      actor_name: actorName,
      action: "save_state",
      target_type: "app_state",
      target_id: "main",
      before_data: beforeState,
      after_data: state,
      success: false,
      error_message: error.message,
    });
    return json({ ok: false, error: error.message }, 500);
  }

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: actorId,
    actor_username: actorUsername,
    actor_name: actorName,
    action: "save_state",
    target_type: "app_state",
    target_id: "main",
    before_data: beforeState,
    after_data: state,
    success: true,
  });

  return json({
    ok: true,
    actor: {
      username: actorUsername,
      displayName: actorName,
      role: actorRole,
    },
  });
});
