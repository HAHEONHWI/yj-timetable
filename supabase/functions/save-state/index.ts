import { createClient } from "npm:@supabase/supabase-js@2";
import { parseExpectedStateVersion } from "../_shared/state-version.ts";

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

const rolePermissions: Record<string, string[]> = {
  save_state: ["dev", "manager", "teacher"],
  update_base: ["dev", "manager"],
  update_base_merge: ["dev", "manager"],
  update_special: ["dev", "manager", "teacher"],
  update_change: ["dev", "manager", "teacher"],
  update_event: ["dev", "manager", "teacher"],
  update_notice: ["dev", "manager", "teacher"],
  update_slide_runtime: ["dev", "manager", "teacher"],
  update_slide_typography: ["dev", "manager"],
  force_reload: ["dev"],
};

function canPerform(role: string, action: string) {
  const allowedRoles = rolePermissions[action] || rolePermissions.save_state;
  return allowedRoles.includes(role);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isDifferent(before: unknown, after: unknown) {
  return stableStringify(before) !== stableStringify(after);
}

function addChangedAction(actions: Set<string>, before: Record<string, unknown>, after: Record<string, unknown>, key: string, action: string) {
  if (isDifferent(before[key], after[key])) {
    actions.add(action);
  }
}

function eventRecordMap(value: unknown) {
  const events = Array.isArray(value) ? value : [];
  return new Map(
    events
      .filter((event): event is Record<string, unknown> => Boolean(event && typeof event === "object" && !Array.isArray(event)))
      .map((event) => [String(event.id || ""), event]),
  );
}

function eventTypographyChanged(beforeEvents: unknown, afterEvents: unknown) {
  const beforeById = eventRecordMap(beforeEvents);
  const afterById = eventRecordMap(afterEvents);

  for (const [id, afterEvent] of afterById) {
    const beforeEvent = beforeById.get(id);
    const afterEnabled = afterEvent.useCustomSlideFontScale === true;
    if (!beforeEvent) {
      if (afterEnabled) return true;
      continue;
    }

    const beforeEnabled = beforeEvent.useCustomSlideFontScale === true;
    if (beforeEnabled !== afterEnabled) return true;
    if (afterEnabled && isDifferent(beforeEvent.slideFontScale, afterEvent.slideFontScale)) return true;
  }

  return false;
}

function changedActions(beforeState: unknown, afterState: Record<string, unknown>, fallbackAction: string) {
  if (!beforeState || typeof beforeState !== "object" || Array.isArray(beforeState)) {
    return [fallbackAction];
  }

  const before = beforeState as Record<string, unknown>;
  const actions = new Set<string>();
  addChangedAction(actions, before, afterState, "base", "update_base");
  addChangedAction(actions, before, afterState, "teachers", "update_base");
  addChangedAction(actions, before, afterState, "baseMerges", "update_base_merge");
  addChangedAction(actions, before, afterState, "specialSchedules", "update_special");
  addChangedAction(actions, before, afterState, "changes", "update_change");
  addChangedAction(actions, before, afterState, "events", "update_event");
  addChangedAction(actions, before, afterState, "notices", "update_notice");
  if (eventTypographyChanged(before.events, afterState.events)) {
    actions.add("update_slide_typography");
  }

  const beforeSlide = before.slideshow && typeof before.slideshow === "object" ? before.slideshow as Record<string, unknown> : {};
  const afterSlide = afterState.slideshow && typeof afterState.slideshow === "object" ? afterState.slideshow as Record<string, unknown> : {};
  const slideTypographyKeys = ["lessonFontScale", "classHeaderFontScale", "periodHeaderFontScale", "eventFontScale"];
  const slideRuntimeKeys = ["intervalSeconds", "refreshSeconds", "scheduleDate", "scheduleDateExpiresOn"];

  slideTypographyKeys.forEach((key) => {
    if (isDifferent(beforeSlide[key], afterSlide[key])) actions.add("update_slide_typography");
  });
  slideRuntimeKeys.forEach((key) => {
    if (isDifferent(beforeSlide[key], afterSlide[key])) actions.add("update_slide_runtime");
  });
  if (isDifferent(beforeSlide.reloadToken, afterSlide.reloadToken)) {
    actions.add("force_reload");
  }

  const knownSlideKeys = new Set([...slideTypographyKeys, ...slideRuntimeKeys, "reloadToken"]);
  const allSlideKeys = new Set([...Object.keys(beforeSlide), ...Object.keys(afterSlide)]);
  allSlideKeys.forEach((key) => {
    if (!knownSlideKeys.has(key) && isDifferent(beforeSlide[key], afterSlide[key])) {
      actions.add("update_slide_runtime");
    }
  });

  return actions.size ? Array.from(actions) : [fallbackAction];
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
  const { action, state, version } = await req.json().catch(() => ({ action: "save_state", state: null, version: null }));
  const normalizedAction = typeof action === "string" && action ? action : "save_state";
  const expectedVersion = parseExpectedStateVersion(version);
  if (!rolePermissions[normalizedAction]) {
    return json({ ok: false, error: "Unknown action" }, 400);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return json({ ok: false, error: "Invalid state" }, 400);
  }
  if (expectedVersion === null) {
    return json({ ok: false, error: "Invalid state version" }, 400);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (!token) {
    return json({ ok: false, error: "Missing admin auth token" }, 401);
  }

  const { data: userResult, error: userError } = await supabaseAdmin.auth.getUser(token);
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

  const actorId = userResult.user.id;
  const actorUsername = profile.username;
  const actorName = profile.display_name || profile.username;
  const actorRole = profile.role || "teacher";

  const { data: beforeRows } = await supabaseAdmin
    .from("app_state")
    .select("data, version")
    .eq("id", "main")
    .limit(1);
  const beforeState = beforeRows && beforeRows[0] ? beforeRows[0].data : null;
  const currentVersion = parseExpectedStateVersion(beforeRows && beforeRows[0] ? beforeRows[0].version : null) || 1;

  const returnConflict = async (latestState: unknown, latestVersion: number) => {
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: actorId,
      actor_username: actorUsername,
      actor_name: actorName,
      actor_role: actorRole,
      action: normalizedAction,
      target_type: "app_state",
      target_id: "main",
      before_data: latestState,
      after_data: state,
      success: false,
      error_message: "State version conflict",
      user_agent: req.headers.get("user-agent"),
    });
    return json({ ok: false, code: "STATE_CONFLICT", error: "State changed on another device", state: latestState, version: latestVersion }, 409);
  };

  if (expectedVersion !== currentVersion) {
    return returnConflict(beforeState, currentVersion);
  }

  const requiredActions = changedActions(beforeState, state as Record<string, unknown>, normalizedAction);
  const deniedAction = requiredActions.find((requiredAction) => !canPerform(actorRole, requiredAction));

  if (!canPerform(actorRole, normalizedAction) || deniedAction) {
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: actorId,
      actor_username: actorUsername,
      actor_name: actorName,
      actor_role: actorRole,
      action: normalizedAction,
      target_type: "app_state",
      target_id: "main",
      before_data: beforeState,
      after_data: state,
      success: false,
      error_message: deniedAction ? `Permission denied: ${deniedAction}` : "Permission denied",
      user_agent: req.headers.get("user-agent"),
    });
    return json({ ok: false, error: deniedAction ? `Permission denied: ${deniedAction}` : "Permission denied" }, 403);
  }

  const { data: updatedRows, error } = await supabaseAdmin
    .from("app_state")
    .update({ data: state, updated_at: new Date().toISOString(), version: currentVersion + 1 })
    .eq("id", "main")
    .eq("version", expectedVersion)
    .select("version");

  if (error) {
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: actorId,
      actor_username: actorUsername,
      actor_name: actorName,
      actor_role: actorRole,
      action: normalizedAction,
      target_type: "app_state",
      target_id: "main",
      before_data: beforeState,
      after_data: state,
      success: false,
      error_message: error.message,
      user_agent: req.headers.get("user-agent"),
    });
    return json({ ok: false, error: error.message }, 500);
  }

  if (!updatedRows || !updatedRows[0]) {
    const { data: latestRows } = await supabaseAdmin
      .from("app_state")
      .select("data, version")
      .eq("id", "main")
      .limit(1);
    const latestState = latestRows && latestRows[0] ? latestRows[0].data : beforeState;
    const latestVersion = parseExpectedStateVersion(latestRows && latestRows[0] ? latestRows[0].version : null) || currentVersion;
    return returnConflict(latestState, latestVersion);
  }

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: actorId,
    actor_username: actorUsername,
    actor_name: actorName,
    actor_role: actorRole,
    action: normalizedAction,
    target_type: "app_state",
    target_id: "main",
    before_data: beforeState,
    after_data: state,
    success: true,
    user_agent: req.headers.get("user-agent"),
  });

  return json({
    ok: true,
    version: updatedRows[0].version,
    actor: {
      username: actorUsername,
      displayName: actorName,
      role: actorRole,
    },
  });
});
