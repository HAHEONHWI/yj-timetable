import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import { z } from "npm:zod@4.1.5";
import {
  generateEmailCode,
  hmacHex,
  parseApiApplication,
} from "../_shared/api-application.ts";
import { generateApiKey, hashApiKey } from "../_shared/api-key.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const requestCodeSchema = z.object({
  action: z.literal("requestCode"),
  application: z.unknown(),
});
const verifyCodeSchema = z.object({
  action: z.literal("verifyCode"),
  requestId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(254),
  code: z.string().trim().regex(/^\d{6}$/),
});
const bodySchema = z.discriminatedUnion("action", [
  requestCodeSchema,
  verifyCodeSchema,
]);

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

function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
}

function emailHtml(code: string): string {
  return `<!doctype html><html lang="ko"><body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6"><h2>용정 시간표 API 이메일 인증</h2><p>아래 인증번호를 신청 화면에 입력하세요.</p><p style="font-size:32px;font-weight:800;letter-spacing:8px">${code}</p><p>인증번호는 10분 동안 유효합니다. 요청하지 않았다면 이 메일을 무시하세요.</p></body></html>`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "POST만 허용합니다." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const emailFrom = Deno.env.get("API_EMAIL_FROM") ?? Deno.env.get("EMAIL_FROM");
  const verificationSecret = Deno.env.get("EMAIL_VERIFICATION_SECRET");
  if (
    !supabaseUrl || !serviceRoleKey || !resendApiKey || !emailFrom ||
    !verificationSecret
  ) {
    return json({ error: "이메일 인증 서버 설정이 올바르지 않습니다." }, 500);
  }

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return json({ error: "요청 형식이 올바르지 않습니다." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  if (parsedBody.data.action === "requestCode") {
    const application = parseApiApplication(parsedBody.data.application);
    if (!application) {
      return json({ error: "사용처, 이메일, 전화번호를 올바르게 입력하세요." }, 400);
    }

    const ipHash = await hmacHex(verificationSecret, clientIp(request));
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const [emailCount, ipCount, recent] = await Promise.all([
      supabase.from("api_key_requests").select("id", { count: "exact", head: true })
        .eq("email", application.email).gte("created_at", oneHourAgo),
      supabase.from("api_key_requests").select("id", { count: "exact", head: true })
        .eq("request_ip_hash", ipHash).gte("created_at", oneHourAgo),
      supabase.from("api_key_requests").select("id", { count: "exact", head: true })
        .eq("email", application.email).gte("last_sent_at", oneMinuteAgo),
    ]);
    if (emailCount.error || ipCount.error || recent.error) {
      return json({ error: "신청 제한을 확인하지 못했습니다." }, 500);
    }
    if ((recent.count ?? 0) > 0) {
      return json({ error: "인증번호는 1분 뒤 다시 요청할 수 있습니다." }, 429);
    }
    if ((emailCount.count ?? 0) >= 3 || (ipCount.count ?? 0) >= 10) {
      return json({ error: "시간당 신청 횟수를 초과했습니다. 잠시 뒤 다시 시도하세요." }, 429);
    }

    const requestId = crypto.randomUUID();
    const code = generateEmailCode();
    const otpHash = await hmacHex(
      verificationSecret,
      `${requestId}:${application.email}:${code}`,
    );
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase.from("api_key_requests").insert({
      id: requestId,
      ...application,
      otp_hash: otpHash,
      otp_expires_at: expiresAt,
      request_ip_hash: ipHash,
    });
    if (insertError) {
      return json({ error: "API 신청을 저장하지 못했습니다." }, 500);
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": requestId,
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [application.email],
        subject: "[용정 시간표] API 인증번호",
        html: emailHtml(code),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!emailResponse.ok) {
      await supabase.from("api_key_requests").delete().eq("id", requestId);
      return json({ error: "인증 메일을 보내지 못했습니다." }, 502);
    }

    return json({ ok: true, requestId, expiresInSeconds: 600 }, 201);
  }

  const generated = generateApiKey();
  const otpHash = await hmacHex(
    verificationSecret,
    `${parsedBody.data.requestId}:${parsedBody.data.email}:${parsedBody.data.code}`,
  );
  const keyHash = await hashApiKey(generated.value);
  const { data: keyId, error } = await supabase.rpc(
    "complete_api_key_email_request",
    {
      p_request_id: parsedBody.data.requestId,
      p_email: parsedBody.data.email,
      p_otp_hash: otpHash,
      p_key_prefix: generated.prefix,
      p_key_hash: keyHash,
    },
  );
  if (error) {
    return json({ error: "API key를 발급하지 못했습니다." }, 500);
  }
  if (!keyId) {
    return json({ error: "인증번호가 틀렸거나 만료되었습니다." }, 400);
  }

  return json({
    ok: true,
    apiKey: generated.value,
    keyPrefix: generated.prefix,
    rateLimitPerMinute: 60,
    docsUrl: "https://schedule.yjms.kr/api",
  }, 201);
});
