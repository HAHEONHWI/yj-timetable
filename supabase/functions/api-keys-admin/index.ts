import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import { z } from "npm:zod@4.1.5";
import { generateApiKey, hashApiKey } from "../_shared/api-key.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }),
  z.object({
    action: z.literal("create"),
    name: z.string().trim().min(2).max(80),
    // 0 means unlimited — reserved for dev's own internal/testing keys.
    // Everything else (external consumers) is capped at 60/min.
    rateLimitPerMinute: z.number().int().min(0).max(60),
    expiresOn: dateSchema.optional(),
  }),
  z.object({ action: z.literal("revoke"), id: z.string().uuid() }),
]);

type AuditEntry = {
  actorId: string;
  actorUsername: string;
  actorName: string;
  action: "api_key_create" | "api_key_revoke";
  targetId: string | null;
  afterData: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function publicKeyRow(
  row: Record<string, unknown>,
  application?: Record<string, unknown>,
) {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    rateLimitPerMinute: row.rate_limit_per_minute,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
    requestCount: row.request_count,
    createdAt: row.created_at,
    application: application
      ? {
        email: application.email,
        phone: application.phone,
        verifiedAt: application.verified_at,
      }
      : null,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "POST만 허용합니다." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "API 서버 설정이 올바르지 않습니다." }, 500);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "로그인이 필요합니다." }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(
    authorization.slice(7),
  );
  if (authError || !authData.user) {
    return json({ error: "로그인이 만료되었습니다." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: profile } = await admin
    .from("admin_profiles")
    .select("username, display_name, role, is_active")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (!profile?.is_active || profile.role !== "dev") {
    return json({ error: "dev 관리자만 API key를 관리할 수 있습니다." }, 403);
  }

  const body = actionSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return json({ error: "요청 형식이 올바르지 않습니다." }, 400);
  }

  const audit = async (entry: AuditEntry) => {
    await admin.from("audit_logs").insert({
      actor_id: entry.actorId,
      actor_username: entry.actorUsername,
      actor_name: entry.actorName,
      actor_role: "dev",
      action: entry.action,
      target_type: "api_key",
      target_id: entry.targetId,
      before_data: null,
      after_data: entry.afterData,
      success: entry.success,
      error_message: entry.errorMessage ?? null,
    });
  };

  if (body.data.action === "list") {
    const { data, error } = await admin
      .from("api_keys")
      .select(
        "id, name, key_prefix, rate_limit_per_minute, expires_at, revoked_at, last_used_at, request_count, created_at, request_id",
      )
      .order("created_at", { ascending: false });
    if (error) {
      return json({ error: "API key 목록을 불러오지 못했습니다." }, 500);
    }
    const requestIds = (data ?? [])
      .map((row) => row.request_id)
      .filter((id): id is string => typeof id === "string");
    const { data: applications, error: applicationsError } = requestIds.length
      ? await admin.from("api_key_requests")
        .select("id, email, phone, verified_at")
        .in("id", requestIds)
      : { data: [], error: null };
    if (applicationsError) {
      return json({ error: "API 신청 정보를 불러오지 못했습니다." }, 500);
    }
    const applicationById = new Map(
      (applications ?? []).map((application) => [application.id, application]),
    );
    return json({
      ok: true,
      keys: (data ?? []).map((row) =>
        publicKeyRow(
          row,
          typeof row.request_id === "string"
            ? applicationById.get(row.request_id)
            : undefined,
        )
      ),
    });
  }

  if (body.data.action === "create") {
    const generated = generateApiKey();
    const keyHash = await hashApiKey(generated.value);
    const expiresAt = body.data.expiresOn
      ? `${body.data.expiresOn}T23:59:59+09:00`
      : null;
    const { data, error } = await admin.from("api_keys").insert({
      name: body.data.name,
      key_prefix: generated.prefix,
      key_hash: keyHash,
      rate_limit_per_minute: body.data.rateLimitPerMinute,
      expires_at: expiresAt,
      created_by: authData.user.id,
    }).select(
      "id, name, key_prefix, rate_limit_per_minute, expires_at, revoked_at, last_used_at, request_count, created_at",
    ).single();

    if (error || !data) {
      await audit({
        actorId: authData.user.id,
        actorUsername: profile.username,
        actorName: profile.display_name,
        action: "api_key_create",
        targetId: null,
        afterData: { name: body.data.name },
        success: false,
        errorMessage: error?.message ?? "생성 실패",
      });
      return json({ error: "API key를 발급하지 못했습니다." }, 500);
    }

    await audit({
      actorId: authData.user.id,
      actorUsername: profile.username,
      actorName: profile.display_name,
      action: "api_key_create",
      targetId: data.id,
      afterData: {
        name: data.name,
        keyPrefix: data.key_prefix,
        rateLimitPerMinute: data.rate_limit_per_minute,
        expiresAt: data.expires_at,
      },
      success: true,
    });
    return json(
      { ok: true, key: publicKeyRow(data), apiKey: generated.value },
      201,
    );
  }

  const { data, error } = await admin.from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", body.data.id)
    .is("revoked_at", null)
    .select(
      "id, name, key_prefix, rate_limit_per_minute, expires_at, revoked_at, last_used_at, request_count, created_at",
    )
    .maybeSingle();
  if (error || !data) {
    return json({ error: "API key를 찾지 못했거나 이미 폐기되었습니다." }, 404);
  }

  await audit({
    actorId: authData.user.id,
    actorUsername: profile.username,
    actorName: profile.display_name,
    action: "api_key_revoke",
    targetId: data.id,
    afterData: {
      name: data.name,
      keyPrefix: data.key_prefix,
      revokedAt: data.revoked_at,
    },
    success: true,
  });
  return json({ ok: true, key: publicKeyRow(data) });
});
