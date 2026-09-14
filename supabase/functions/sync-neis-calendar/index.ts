import { createClient } from "npm:@supabase/supabase-js@2";
import ky from "npm:ky@1.10.0";
import { z } from "npm:zod@4.1.5";

import {
  academicYearRange,
  NeisResponseError,
  parseNeisSchedulePage,
  type NeisAcademicEvent,
} from "../_shared/neis-academic-calendar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const requestSchema = z.object({
  from: z.string().regex(/^\d{8}$/).optional(),
  to: z.string().regex(/^\d{8}$/).optional(),
}).strict().refine((value) => Boolean(value.from) === Boolean(value.to), {
  message: "from과 to는 함께 입력해야 합니다.",
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: "from은 to보다 늦을 수 없습니다.",
});

class ConfigurationError extends Error {
  constructor(name: string) {
    super(`Missing environment variable: ${name}`);
    this.name = "ConfigurationError";
  }
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new ConfigurationError(name);
  return value;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchPage(
  apiKey: string,
  schoolCode: string,
  educationOfficeCode: string,
  range: { readonly from: string; readonly to: string },
  pageIndex: number,
) {
  const value: unknown = await ky.get("https://open.neis.go.kr/hub/SchoolSchedule", {
    // ky defaults to `accept: application/json` for .json(), and NEIS answers a
    // single-type Accept with 500. Any list containing */* negotiates fine.
    headers: { accept: "application/json, text/plain, */*" },
    searchParams: {
      KEY: apiKey,
      Type: "json",
      pIndex: String(pageIndex),
      pSize: "100",
      ATPT_OFCDC_SC_CODE: educationOfficeCode,
      SD_SCHUL_CODE: schoolCode,
      AA_FROM_YMD: range.from,
      AA_TO_YMD: range.to,
    },
    retry: { limit: 2, methods: ["get"] },
    timeout: 15_000,
  }).json();
  return parseNeisSchedulePage(value);
}

async function fetchAcademicEvents(
  apiKey: string,
  schoolCode: string,
  educationOfficeCode: string,
  range: { readonly from: string; readonly to: string },
): Promise<readonly NeisAcademicEvent[]> {
  const events: NeisAcademicEvent[] = [];
  let cursor = new Date(`${range.from.slice(0, 4)}-${range.from.slice(4, 6)}-${range.from.slice(6, 8)}T00:00:00Z`);
  const end = new Date(`${range.to.slice(0, 4)}-${range.to.slice(4, 6)}-${range.to.slice(6, 8)}T00:00:00Z`);
  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + 30);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    const chunk = {
      from: cursor.toISOString().slice(0, 10).replaceAll("-", ""),
      to: chunkEnd.toISOString().slice(0, 10).replaceAll("-", ""),
    };
    const firstPage = await fetchPage(apiKey, schoolCode, educationOfficeCode, chunk, 1);
    events.push(...firstPage.events);
    const pageCount = Math.ceil(firstPage.totalCount / 100);
    for (let pageIndex = 2; pageIndex <= pageCount; pageIndex += 1) {
      const page = await fetchPage(apiKey, schoolCode, educationOfficeCode, chunk, pageIndex);
      events.push(...page.events);
    }
    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return events;
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const supabaseUrl = requiredEnvironment("SUPABASE_URL");
  const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const authToken = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!authToken) return json({ ok: false, error: "Missing admin auth token" }, 401);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  let actorUsername = "system-neis-sync";
  let actorName = "NEIS 자동 동기화";
  let actorRole = "system";
  let actorId: string | null = null;

  if (authToken !== serviceRoleKey) {
    const { data: userResult, error: userError } = await supabaseAdmin.auth.getUser(authToken);
    if (userError || !userResult.user) {
      return json({ ok: false, error: "Invalid admin auth token" }, 401);
    }
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("admin_profiles")
      .select("username, display_name, role, is_active")
      .eq("user_id", userResult.user.id)
      .single();
    if (profileError || !profile || profile.is_active !== true) {
      return json({ ok: false, error: "Admin account is not active" }, 403);
    }
    if (!["dev", "manager"].includes(profile.role)) {
      return json({ ok: false, error: "Permission denied" }, 403);
    }
    actorId = userResult.user.id;
    actorUsername = profile.username;
    actorName = profile.display_name || profile.username;
    actorRole = profile.role;
  }

  const parsedBody = requestSchema.safeParse(await req.json().catch((error: unknown) => ({
    parseError: error instanceof Error ? error.message : String(error),
  })));
  if (!parsedBody.success) return json({ ok: false, error: parsedBody.error.message }, 400);

  const defaultRange = academicYearRange(new Date());
  const range = {
    from: parsedBody.data.from ?? defaultRange.from,
    to: parsedBody.data.to ?? defaultRange.to,
  };
  const fromDate = `${range.from.slice(0, 4)}-${range.from.slice(4, 6)}-${range.from.slice(6, 8)}`;
  const toDate = `${range.to.slice(0, 4)}-${range.to.slice(4, 6)}-${range.to.slice(6, 8)}`;
  const events = await fetchAcademicEvents(
    requiredEnvironment("NEIS_API_KEY"),
    Deno.env.get("NEIS_SCHOOL_CODE") ?? "8602013",
    Deno.env.get("NEIS_ATPT_CODE") ?? "Q10",
    range,
  );
  const eventRows = events.map((event) => ({
    id: event.id,
    school_code: event.schoolCode,
    event_date: event.date,
    title: event.title,
    content: event.content,
    grades: event.grades,
    is_school_day: event.isSchoolDay,
    source_updated_at: event.sourceUpdatedAt,
  }));
  const { data: insertedCount, error: replaceError } = await supabaseAdmin.rpc(
    "replace_neis_academic_events",
    { from_date: fromDate, to_date: toDate, event_rows: eventRows },
  );
  if (replaceError) throw replaceError;

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: actorId,
    actor_username: actorUsername,
    actor_name: actorName,
    actor_role: actorRole,
    action: "sync_neis_calendar",
    target_type: "academic_events",
    target_id: `${fromDate}:${toDate}`,
    before_data: null,
    after_data: { count: insertedCount, from: fromDate, to: toDate },
    success: true,
    error_message: null,
    user_agent: req.headers.get("user-agent"),
  });

  return json({ ok: true, count: insertedCount, from: fromDate, to: toDate });
}

Deno.serve(async (req) => {
  try {
    return await handleRequest(req);
  } catch (error) {
    if (error instanceof NeisResponseError || error instanceof ConfigurationError) {
      return json({ ok: false, error: error.message }, 502);
    }
    console.error("[sync-neis-calendar] Unhandled error", error);
    return json({
      ok: false,
      error: error instanceof Error ? `NEIS 동기화 처리 오류: ${error.message}` : "NEIS 학사일정을 동기화하지 못했습니다.",
    }, 502);
  }
});
