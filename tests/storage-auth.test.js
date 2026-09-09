const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = readFileSync(path.join(__dirname, "../src/storage.js"), "utf8");
const PROFILE_KEY = "timetable-admin-profile";
const savedProfile = JSON.stringify({ username: "teacher", displayName: "Teacher", role: "teacher" });

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function response(status, payload) {
  return { ok: status >= 200 && status < 300, status, statusText: "Gateway error", text: async () => JSON.stringify(payload) };
}

function harness({ profileResult, sessionError = null, responses = [response(200, { ok: true })] } = {}) {
  const calls = { fetch: [], refresh: 0, signOut: 0 };
  const localStorage = memoryStorage({ [PROFILE_KEY]: savedProfile, "timetable-admin-keep-session": "true" });
  const sessionStorage = memoryStorage({ [PROFILE_KEY]: savedProfile });
  let session = { access_token: "old-token", user: { id: "test-user" } };
  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: sessionError }),
      signInWithPassword: async () => ({ data: { user: session.user, session }, error: null }),
      refreshSession: async () => {
        calls.refresh += 1;
        session = { ...session, access_token: "refreshed-token" };
        return { data: { session }, error: null };
      },
      signOut: async () => { calls.signOut += 1; return { error: null }; },
    },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => profileResult ?? {
      data: { username: "teacher", display_name: "Teacher", role: "teacher", is_active: true }, error: null,
    } }) }) }),
  };
  const window = { SUPABASE_CONFIG: { url: "https://example.test", anonKey: "public-test-key" }, supabase: { createClient: () => client } };
  vm.runInNewContext(source, {
    window, localStorage, sessionStorage, TextEncoder,
    console: { warn() {} },
    fetch: async (url, options) => {
      calls.fetch.push({ url, ...options });
      const next = responses[calls.fetch.length - 1];
      assert.ok(next, "Unexpected extra request");
      return next;
    },
  });
  return { store: window.TimetableStore, calls, localStorage, sessionStorage };
}

const state = { base: { "1-1": { mon: ["수학"] } }, notices: [], adminPassword: "never-send" };

test("transient profile lookup failure preserves cached identity and Supabase session", async () => {
  const h = harness({ profileResult: { data: null, error: { message: "Failed to fetch" } } });
  const result = await h.store.restoreAdminSession();
  assert.equal(result.ok, false);
  assert.match(result.error, /Failed to fetch/);
  assert.equal(h.calls.signOut, 0);
  assert.equal(h.sessionStorage.getItem(PROFILE_KEY), savedProfile);
  assert.equal(h.localStorage.getItem(PROFILE_KEY), savedProfile);
});

test("explicitly inactive profile revokes cached administrator identity and signs out", async () => {
  const h = harness({ profileResult: { data: { username: "teacher", role: "teacher", is_active: false }, error: null } });
  assert.equal((await h.store.restoreAdminSession()).ok, false);
  assert.ok(h.calls.signOut >= 1);
  assert.equal(h.sessionStorage.getItem(PROFILE_KEY), null);
  assert.equal(h.localStorage.getItem(PROFILE_KEY), null);
});

test("save-state 401 refreshes once and retries identical action and state with fresh token", async () => {
  const h = harness({ responses: [response(401, { message: "Invalid JWT" }), response(200, { ok: true })] });
  assert.equal((await h.store.write(state, "update_notice")).ok, true);
  assert.equal(h.calls.refresh, 1);
  assert.equal(h.calls.fetch.length, 2);
  assert.equal(h.calls.fetch[0].headers.Authorization, "Bearer old-token");
  assert.equal(h.calls.fetch[1].headers.Authorization, "Bearer refreshed-token");
  assert.equal(h.calls.fetch[0].body, h.calls.fetch[1].body);
  assert.deepEqual(JSON.parse(h.calls.fetch[1].body), { action: "update_notice", state: { base: state.base, notices: [] } });
  assert.match(h.calls.fetch[1].url, /\/functions\/v1\/save-state$/);
});

for (const status of [403, 400]) {
  test(`save-state ${status} never refreshes or retries`, async () => {
    const h = harness({ responses: [response(status, { error: "Permission or validation rejected" })] });
    const result = await h.store.write(state, "update_notice");
    assert.equal(result.ok, false);
    assert.match(result.error, /Permission or validation rejected/);
    assert.equal(h.calls.refresh, 0);
    assert.equal(h.calls.fetch.length, 1);
  });
}

test("response body read failure resolves as useful save error", async () => {
  const h = harness({ responses: [{ ...response(200, {}), text: async () => { throw new Error("body stream failed"); } }] });
  const result = await h.store.write(state, "update_notice");
  assert.equal(result.ok, false);
  assert.match(result.error, /body stream failed/);
  assert.equal(h.calls.refresh, 0);
});

test("repeated 401 stops after one retry and preserves gateway message", async () => {
  const h = harness({ responses: [response(401, { message: "Invalid JWT" }), response(401, { message: "Invalid JWT" })] });
  const result = await h.store.write(state, "update_notice");
  assert.equal(result.ok, false);
  assert.match(result.error, /Invalid JWT/);
  assert.equal(h.calls.refresh, 1);
  assert.equal(h.calls.fetch.length, 2);
});

for (const invalidState of [null, undefined, "invalid", 42, []]) {
  test(`invalid state ${JSON.stringify(invalidState)} refuses remote save`, async () => {
    const h = harness();
    const result = await h.store.write(invalidState, "update_notice");
    assert.equal(result.ok, false);
    assert.ok(result.error);
    assert.equal(h.calls.fetch.length, 0);
    assert.equal(h.localStorage.getItem("school-timetable-v1"), null);
  });
}

test("login profile lookup failure preserves session without legacy fallback", async () => {
  const h = harness({ profileResult: { data: null, error: { message: "Profile temporarily unavailable" } } });
  const result = await h.store.verifyAdminPassword("teacher", "test-password");
  assert.equal(result.ok, false);
  assert.match(result.error, /Profile temporarily unavailable/);
  assert.equal(h.calls.signOut, 0);
  assert.equal(h.calls.fetch.length, 0);
});

test("temporary session lookup error does not sign out when remember me is off", async () => {
  const h = harness({ sessionError: { message: "Failed to fetch" } });
  h.localStorage.removeItem("timetable-admin-keep-session");
  const result = await h.store.restoreAdminSession();
  assert.equal(result.ok, false);
  assert.match(result.error, /Failed to fetch/);
  assert.equal(h.calls.signOut, 0);
  assert.equal(h.sessionStorage.getItem(PROFILE_KEY), savedProfile);
});
