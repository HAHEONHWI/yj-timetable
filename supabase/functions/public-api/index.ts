import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import { z } from "npm:zod@4.1.5";
import { hashApiKey, parseApiKey } from "../_shared/api-key.ts";
import {
  PublicStateSchema,
  resolveAllTimetables,
  resolveChanges,
  resolveTimetable,
} from "../_shared/timetable-api.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const classes = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"];
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}, "유효한 날짜가 아닙니다.");
const classSchema = z.enum(["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"]);
const dateParameter = {
  name: "date",
  in: "query",
  required: true,
  schema: { type: "string", format: "date" },
} as const;
const requiredClassParameter = {
  name: "class",
  in: "query",
  required: true,
  schema: { type: "string", enum: classes },
} as const;
const optionalClassParameter = {
  ...requiredClassParameter,
  required: false,
  description: "생략하면 전체 학급을 반환합니다.",
} as const;

function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function routeOf(url: URL) {
  const marker = "/public-api";
  const start = url.pathname.indexOf(marker);
  const route = start >= 0
    ? url.pathname.slice(start + marker.length)
    : url.pathname;
  return route.replace(/\/$/, "") || "/";
}

function docs(origin: string) {
  const baseUrl = `${origin}/functions/v1/public-api/v1`;
  return {
    name: "용정 시간표 읽기 전용 API",
    version: "1.1.0",
    authentication: "X-API-Key 헤더",
    endpoints: {
      allTimetables: `${baseUrl}/timetable?date=YYYY-MM-DD`,
      classTimetable: `${baseUrl}/timetable?date=YYYY-MM-DD&class=1-1`,
      events: `${baseUrl}/events?date=YYYY-MM-DD&class=1-1`,
      changes: `${baseUrl}/changes?date=YYYY-MM-DD&class=1-1`,
      notices: `${baseUrl}/notices`,
      classes: `${baseUrl}/classes`,
      openapi: `${origin}/functions/v1/public-api/v1/openapi.json`,
    },
  };
}

function openApi(origin: string) {
  const server = `${origin}/functions/v1/public-api`;
  return {
    openapi: "3.1.0",
    info: { title: "용정 시간표 읽기 전용 API", version: "1.1.0" },
    servers: [{ url: server }],
    components: {
      securitySchemes: {
        ApiKey: { type: "apiKey", in: "header", name: "X-API-Key" },
      },
    },
    security: [{ ApiKey: [] }],
    paths: {
      "/v1/timetable": {
        get: {
          summary: "날짜 시간표 조회, class 생략 시 전체 학급",
          parameters: [dateParameter, optionalClassParameter],
        },
      },
      "/v1/events": {
        get: {
          summary: "날짜·학급 행사 조회",
          parameters: [dateParameter, requiredClassParameter],
        },
      },
      "/v1/changes": {
        get: {
          summary: "날짜·학급 교과 변경 조회",
          parameters: [dateParameter, requiredClassParameter],
        },
      },
      "/v1/notices": { get: { summary: "공지 조회" } },
      "/v1/classes": { get: { summary: "학급 목록 조회" } },
    },
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "GET") {
    return json({ error: "읽기 전용 API는 GET만 허용합니다." }, 405, {
      Allow: "GET, OPTIONS",
    });
  }

  const url = new URL(request.url);
  const route = routeOf(url);
  if (route === "/" || route === "/v1") return json(docs(url.origin));
  if (route === "/v1/openapi.json") return json(openApi(url.origin));
  if (
    ![
      "/v1/timetable",
      "/v1/events",
      "/v1/changes",
      "/v1/notices",
      "/v1/classes",
    ].includes(route)
  ) {
    return json({ error: "존재하지 않는 API 경로입니다." }, 404);
  }

  const parsedKey = parseApiKey(request.headers.get("X-API-Key") ?? "");
  if (!parsedKey) return json({ error: "유효한 X-API-Key가 필요합니다." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "API 서버 설정이 올바르지 않습니다." }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const keyHash = await hashApiKey(request.headers.get("X-API-Key") ?? "");
  const { data: apiKey } = await supabase
    .from("api_keys")
    .select("id, rate_limit_per_minute, expires_at, revoked_at")
    .eq("key_prefix", parsedKey.prefix)
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (
    !apiKey || apiKey.revoked_at ||
    (apiKey.expires_at && new Date(apiKey.expires_at) <= new Date())
  ) {
    return json({ error: "만료되었거나 폐기된 API key입니다." }, 401);
  }

  const { data: allowed, error: rateError } = await supabase.rpc(
    "consume_api_key_rate_limit",
    {
      p_key_id: apiKey.id,
      p_limit: apiKey.rate_limit_per_minute,
    },
  );
  if (rateError) {
    return json({ error: "요청 제한을 확인하지 못했습니다." }, 500);
  }
  if (!allowed) {
    return json({ error: "분당 요청 한도를 초과했습니다." }, 429, {
      "Retry-After": "60",
    });
  }

  const rateHeaders = {
    "X-RateLimit-Limit": String(apiKey.rate_limit_per_minute),
  };
  if (route === "/v1/classes") return json({ data: classes }, 200, rateHeaders);

  const { data: row, error } = await supabase.from("app_state").select(
    "data, updated_at",
  ).eq("id", "main").single();
  if (error || !row) {
    return json({ error: "시간표 데이터를 불러오지 못했습니다." }, 500);
  }

  const stateResult = PublicStateSchema.safeParse(row.data);
  if (!stateResult.success) {
    return json(
      { error: "저장된 시간표 데이터 형식이 올바르지 않습니다." },
      500,
    );
  }
  const state = stateResult.data;

  if (route === "/v1/notices") {
    return json(
      { data: state.notices, updatedAt: row.updated_at },
      200,
      rateHeaders,
    );
  }

  const dateResult = dateSchema.safeParse(url.searchParams.get("date"));
  if (!dateResult.success) {
    return json(
      { error: "date=YYYY-MM-DD 형식이 필요합니다." },
      400,
      rateHeaders,
    );
  }

  const classValue = url.searchParams.get("class");
  if (route === "/v1/timetable" && classValue === null) {
    const data = resolveAllTimetables(state, dateResult.data, classes);
    return json({ data, updatedAt: row.updated_at }, 200, rateHeaders);
  }

  const classResult = classSchema.safeParse(classValue);
  if (!classResult.success) {
    return json(
      { error: "class=1-1 형식이 필요합니다." },
      400,
      rateHeaders,
    );
  }

  if (route === "/v1/events") {
    const data = state.events.filter((event) =>
      event.date === dateResult.data && event.classes.includes(classResult.data)
    );
    return json({ data, updatedAt: row.updated_at }, 200, rateHeaders);
  }

  if (route === "/v1/changes") {
    const data = resolveChanges(state, dateResult.data, classResult.data);
    return json({ data, updatedAt: row.updated_at }, 200, rateHeaders);
  }

  const data = resolveTimetable(state, dateResult.data, classResult.data);
  return json({ data, updatedAt: row.updated_at }, 200, rateHeaders);
});
