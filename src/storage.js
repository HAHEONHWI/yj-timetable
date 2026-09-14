(function () {
  const STORAGE_KEY = "school-timetable-v1";
  const ADMIN_PROFILE_KEY = "timetable-admin-profile";
  const LEGACY_ADMIN_PASSWORD_KEY = "timetable-admin-password";
  const AUTH_USERNAME_DOMAIN = "yjms.local";
  const USERNAME_PATTERN = /^[a-z0-9_-]{3,32}$/;

  const classes = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"];
  const weekdays = [
    { key: "mon", label: "월" },
    { key: "tue", label: "화" },
    { key: "wed", label: "수" },
    { key: "thu", label: "목" },
    { key: "fri", label: "금" },
  ];
  const periods = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const sampleSubjects = ["국어", "수학", "영어", "사회", "과학", "체육", "미술", "음악", "창체"];
  let supabaseClient = null;
  let remoteChannel = null;

  function makeDefaultBase() {
    const base = {};
    classes.forEach((className, classIndex) => {
      base[className] = {};
      weekdays.forEach((day, dayIndex) => {
        base[className][day.key] = periods.map((period, periodIndex) => {
          const subjectIndex = (classIndex + dayIndex + periodIndex) % sampleSubjects.length;
          return sampleSubjects[subjectIndex];
        });
      });
    });
    return base;
  }

  function createDefaultState() {
    return {
      adminPassword: "1234",
      base: makeDefaultBase(),
      teachers: { "1-1": {}, "1-2": {}, "2-1": {}, "2-2": {}, "3-1": {}, "3-2": {} },
      teacherMode: "subject",
      teachersByPeriod: { "1-1": {}, "1-2": {}, "2-1": {}, "2-2": {}, "3-1": {}, "3-2": {} },
      subjectAbbreviations: {},
      maskTeacherNames: false,
      baseMerges: [],
      specialSchedules: {},
      changes: {},
      events: [],
      notices: [
        {
          id: "sample-notice",
          title: "오늘의 안내",
          body: "관리자 페이지에서 안내사항을 수정하거나 새로 등록할 수 있습니다.",
          titleFontSize: 72,
          detailFontSize: 42,
        },
      ],
      slideshow: {
        intervalSeconds: 8,
        refreshSeconds: 60,
        lessonFontScale: 100,
        classHeaderFontScale: 100,
        periodHeaderFontScale: 100,
        eventFontScale: 100,
        teacherFontScale: 100,
        reloadToken: "",
        scheduleDate: "",
        scheduleDateExpiresOn: "",
        showMeal: true,
        showTeacher: false,
      },
    };
  }

  function read() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaults = createDefaultState();
      write(defaults);
      return defaults;
    }

    try {
      const parsed = JSON.parse(raw);
      return {
        ...createDefaultState(),
        ...parsed,
        base: parsed.base || makeDefaultBase(),
        teachers: parsed.teachers || { "1-1": {}, "1-2": {}, "2-1": {}, "2-2": {}, "3-1": {}, "3-2": {} },
        teacherMode: parsed.teacherMode === "period" ? "period" : "subject",
        teachersByPeriod: parsed.teachersByPeriod || { "1-1": {}, "1-2": {}, "2-1": {}, "2-2": {}, "3-1": {}, "3-2": {} },
        subjectAbbreviations: parsed.subjectAbbreviations || {},
        maskTeacherNames: Boolean(parsed.maskTeacherNames),
        baseMerges: Array.isArray(parsed.baseMerges) ? parsed.baseMerges : [],
        specialSchedules: parsed.specialSchedules || {},
        changes: parsed.changes || {},
        events: Array.isArray(parsed.events) ? parsed.events : [],
        notices: Array.isArray(parsed.notices)
          ? parsed.notices.map((notice) => ({
              ...notice,
              titleFontSize: Number(notice.titleFontSize) || 72,
              detailFontSize: Number(notice.detailFontSize) || 42,
            }))
          : [],
        slideshow: {
          intervalSeconds: Number(parsed.slideshow && parsed.slideshow.intervalSeconds) || 8,
          refreshSeconds: Number(parsed.slideshow && parsed.slideshow.refreshSeconds) || 60,
          lessonFontScale: Number(parsed.slideshow && parsed.slideshow.lessonFontScale) || 100,
          classHeaderFontScale: Number(parsed.slideshow && parsed.slideshow.classHeaderFontScale) || 100,
          periodHeaderFontScale: Number(parsed.slideshow && parsed.slideshow.periodHeaderFontScale) || 100,
          eventFontScale: Number(parsed.slideshow && parsed.slideshow.eventFontScale) || 100,
          teacherFontScale: Number(parsed.slideshow && parsed.slideshow.teacherFontScale) || 100,
          reloadToken: parsed.slideshow && parsed.slideshow.reloadToken ? String(parsed.slideshow.reloadToken) : "",
          scheduleDate: parsed.slideshow && parsed.slideshow.scheduleDate ? String(parsed.slideshow.scheduleDate) : "",
          scheduleDateExpiresOn:
            parsed.slideshow && parsed.slideshow.scheduleDateExpiresOn ? String(parsed.slideshow.scheduleDateExpiresOn) : "",
          showMeal: parsed.slideshow && parsed.slideshow.showMeal !== undefined ? Boolean(parsed.slideshow.showMeal) : true,
          showTeacher: Boolean(parsed.slideshow && parsed.slideshow.showTeacher),
        },
      };
    } catch {
      const defaults = createDefaultState();
      write(defaults);
      return defaults;
    }
  }

  function write(state, action = "save_state") {
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      return Promise.resolve({ ok: false, error: "Invalid state" });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (isSupabaseEnabled()) {
      return writeRemote(state, action);
    }
    return Promise.resolve({ ok: true });
  }

  function normalizeState(value) {
    const defaults = createDefaultState();
    const parsed = value && typeof value === "object" ? value : {};
    return {
      ...defaults,
      ...parsed,
      base: parsed.base || makeDefaultBase(),
      teachers: parsed.teachers || { "1-1": {}, "1-2": {}, "2-1": {}, "2-2": {}, "3-1": {}, "3-2": {} },
      teacherMode: parsed.teacherMode === "period" ? "period" : "subject",
      teachersByPeriod: parsed.teachersByPeriod || { "1-1": {}, "1-2": {}, "2-1": {}, "2-2": {}, "3-1": {}, "3-2": {} },
      subjectAbbreviations: parsed.subjectAbbreviations || {},
      maskTeacherNames: Boolean(parsed.maskTeacherNames),
      baseMerges: Array.isArray(parsed.baseMerges) ? parsed.baseMerges : [],
      specialSchedules: parsed.specialSchedules || {},
      changes: parsed.changes || {},
      events: Array.isArray(parsed.events) ? parsed.events : [],
      notices: Array.isArray(parsed.notices)
        ? parsed.notices.map((notice) => ({
            ...notice,
            titleFontSize: Number(notice.titleFontSize) || 72,
            detailFontSize: Number(notice.detailFontSize) || 42,
          }))
        : defaults.notices,
      slideshow: {
        intervalSeconds: Number(parsed.slideshow && parsed.slideshow.intervalSeconds) || 8,
        refreshSeconds: Number(parsed.slideshow && parsed.slideshow.refreshSeconds) || 60,
        lessonFontScale: Number(parsed.slideshow && parsed.slideshow.lessonFontScale) || 100,
        classHeaderFontScale: Number(parsed.slideshow && parsed.slideshow.classHeaderFontScale) || 100,
        periodHeaderFontScale: Number(parsed.slideshow && parsed.slideshow.periodHeaderFontScale) || 100,
        eventFontScale: Number(parsed.slideshow && parsed.slideshow.eventFontScale) || 100,
        teacherFontScale: Number(parsed.slideshow && parsed.slideshow.teacherFontScale) || 100,
        reloadToken: parsed.slideshow && parsed.slideshow.reloadToken ? String(parsed.slideshow.reloadToken) : "",
        scheduleDate: parsed.slideshow && parsed.slideshow.scheduleDate ? String(parsed.slideshow.scheduleDate) : "",
        scheduleDateExpiresOn:
          parsed.slideshow && parsed.slideshow.scheduleDateExpiresOn ? String(parsed.slideshow.scheduleDateExpiresOn) : "",
        showMeal: parsed.slideshow && parsed.slideshow.showMeal !== undefined ? Boolean(parsed.slideshow.showMeal) : true,
        showTeacher: Boolean(parsed.slideshow && parsed.slideshow.showTeacher),
      },
    };
  }

  function isSupabaseEnabled() {
    const config = window.SUPABASE_CONFIG || {};
    return Boolean(window.supabase && config.url && config.anonKey);
  }

  function client() {
    const config = window.SUPABASE_CONFIG;
    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(config.url, config.anonKey);
    }
    return supabaseClient;
  }

  function normalizeUsername(value) {
    const username = String(value || "").trim().toLowerCase();
    if (!USERNAME_PATTERN.test(username)) {
      throw new Error("아이디는 영문 소문자, 숫자, _, - 조합 3~32자만 사용할 수 있습니다.");
    }
    return username;
  }

  function usernameToEmail(username) {
    return `${normalizeUsername(username)}@${AUTH_USERNAME_DOMAIN}`;
  }

  async function authAccessToken() {
    if (!isSupabaseEnabled()) return "";
    const { data, error } = await client().auth.getSession();
    if (error) return "";
    return data && data.session && data.session.access_token ? data.session.access_token : "";
  }

  async function invokeFunction(name, body, options = {}) {
    const config = window.SUPABASE_CONFIG;
    const accessToken = options.accessToken || "";
    const serialized = JSON.stringify(body);
    const byteSize = new TextEncoder().encode(serialized).length;
    if (byteSize > 900_000) {
      console.warn(`[invokeFunction] ${name} body is ${(byteSize / 1024).toFixed(1)} KB — near or over limit`);
    }
    let response;
    let text;
    try {
      response = await fetch(`${config.url}/functions/v1/${name}`, {
        method: "POST",
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${accessToken || config.anonKey}`,
          "Content-Type": "application/json",
        },
        body: serialized,
      });
      text = await response.text();
    } catch (err) {
      return { ok: false, error: `Failed to fetch: ${err && err.message ? err.message : err}` };
    }

    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { error: text };
    }

    if (!response.ok) {
      if (response.status === 401 && accessToken && !options.authRetried) {
        try {
          const { data, error } = await client().auth.refreshSession();
          if (!error && data && data.session && data.session.access_token) {
            return invokeFunction(name, JSON.parse(serialized), {
              accessToken: data.session.access_token,
              authRetried: true,
            });
          }
          if (error) return { ok: false, error: error.message || "관리자 로그인 세션을 갱신하지 못했습니다." };
        } catch (error) {
          return { ok: false, error: error.message || "관리자 로그인 세션을 갱신하지 못했습니다." };
        }
      }
      const detail = payload && (payload.error || payload.message) ? payload.error || payload.message : response.statusText;
      return { ok: false, status: response.status, error: `${response.status} ${detail}` };
    }

    return payload || { ok: true };
  }

  async function readRemote() {
    if (!isSupabaseEnabled()) {
      return read();
    }

    const { data, error } = await client().from("app_state").select("data").eq("id", "main").single();
    if (error) {
      throw new Error(`Supabase DB 연결 실패: ${error.message}`);
    }

    const remoteState = normalizeState(data && data.data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteState));
    return remoteState;
  }

  async function readAcademicEvents() {
    if (!isSupabaseEnabled()) return [];
    const { data, error } = await client()
      .from("academic_events")
      .select("id, source, school_code, event_date, title, content, grades, is_school_day, source_updated_at, synced_at")
      .order("event_date", { ascending: true })
      .order("title", { ascending: true });
    if (error) throw new Error(`학사일정 조회 실패: ${error.message}`);
    return (data || []).map((event) => ({
      id: event.id,
      source: event.source,
      schoolCode: event.school_code,
      date: event.event_date,
      title: event.title,
      content: event.content || "",
      grades: Array.isArray(event.grades) ? event.grades : [],
      isSchoolDay: event.is_school_day !== false,
      sourceUpdatedAt: event.source_updated_at,
      syncedAt: event.synced_at,
    }));
  }

  async function syncNeisCalendarRequest(body = {}) {
    const accessToken = await authAccessToken();
    if (!accessToken) return { ok: false, error: "관리자 로그인 세션이 없습니다." };
    return invokeFunction("sync-neis-calendar", body, { accessToken });
  }

  function subscribeRemoteChanges(onChange) {
    if (!isSupabaseEnabled() || typeof onChange !== "function") {
      return () => {};
    }

    if (remoteChannel) {
      client().removeChannel(remoteChannel);
    }

    remoteChannel = client()
      .channel("app-state-main")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_state", filter: "id=eq.main" },
        (payload) => {
          if (!payload.new || payload.eventType === "DELETE") return;
          const remoteState = normalizeState(payload.new.data);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteState));
          onChange(remoteState);
        }
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("Supabase realtime failed:", error || status);
        }
      });

    return () => {
      if (!remoteChannel) return;
      const channel = remoteChannel;
      remoteChannel = null;
      client().removeChannel(channel);
    };
  }

  async function writeRemote(state, action = "save_state") {
    let accessToken;
    try {
      accessToken = await authAccessToken();
    } catch (error) {
      return { ok: false, error: error.message || "관리자 로그인 세션을 확인하지 못했습니다." };
    }
    const legacyPassword = sessionStorage.getItem(LEGACY_ADMIN_PASSWORD_KEY);
    if (!accessToken && !legacyPassword) {
      return { ok: false, error: "관리자 로그인 세션이 없습니다." };
    }

    const publicState = { ...state };
    delete publicState.adminPassword;

    const result = await invokeFunction(
      "save-state",
      legacyPassword ? { action, password: legacyPassword, state: publicState } : { action, state: publicState },
      { accessToken }
    );
    if (result.ok === false) {
      console.warn("Supabase write failed:", result.error);
      return result;
    }

    return result;
  }

  async function adminAccountsRequest(body) {
    const accessToken = await authAccessToken();
    if (!accessToken) {
      return { ok: false, error: "관리자 로그인 세션이 없습니다." };
    }
    return invokeFunction("admin-accounts", body, { accessToken });
  }

  async function apiKeysRequest(body) {
    const accessToken = await authAccessToken();
    if (!accessToken) {
      return { ok: false, error: "관리자 로그인 세션이 없습니다." };
    }
    return invokeFunction("api-keys-admin", body, { accessToken });
  }

  async function apiApplicationRequest(body) {
    return invokeFunction("api-key-apply", body);
  }

  const KEEP_SESSION_KEY = "timetable-admin-keep-session";

  async function verifyAdminPassword(username, password, rememberMe = true, options = {}) {
    // Re-confirmation prompts (e.g. force-reload) pass a *known* dev
    // username in to re-check the same account's password — never the
    // legacy shared-password login, which has no username of its own.
    // Falling back to it here would silently swap an active dev session
    // for the demoted Legacy Admin/manager profile on any wrong password.
    const { allowLegacyFallback = true } = options;
    if (rememberMe) {
      localStorage.setItem(KEEP_SESSION_KEY, "true");
    } else {
      localStorage.removeItem(KEEP_SESSION_KEY);
      localStorage.removeItem(ADMIN_PROFILE_KEY);
    }

    if (!isSupabaseEnabled()) {
      const safeUsername = String(username || "").trim() || "admin";
      const ok = safeUsername === "admin" && password === read().adminPassword;
      if (ok) {
        const localProfile = { username: "admin", displayName: "로컬 관리자", role: "dev" };
        sessionStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(localProfile));
        if (rememberMe) {
          localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(localProfile));
        }
        return { ok: true, profile: localProfile };
      }
      return { ok: false };
    }

    let email = "";
    try {
      email = usernameToEmail(username);
    } catch (error) {
      return { ok: false, error: error.message };
    }

    const { data, error } = await client().auth.signInWithPassword({ email, password });
    if (!error && data && data.user) {
      const { data: profile, error: profileError } = await client()
        .from("admin_profiles")
        .select("username, display_name, role, is_active")
        .eq("user_id", data.user.id)
        .single();

      if (profileError) {
        return { ok: false, error: `관리자 정보 조회 실패: ${profileError.message}` };
      }

      if (!profileError && profile && profile.is_active === true) {
        const adminProfile = {
          username: profile.username,
          displayName: profile.display_name || profile.username,
          role: profile.role || "teacher",
        };
        sessionStorage.removeItem(LEGACY_ADMIN_PASSWORD_KEY);
        sessionStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(adminProfile));
        if (rememberMe) {
          localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(adminProfile));
        } else {
          localStorage.removeItem(ADMIN_PROFILE_KEY);
        }
        return { ok: true, profile: adminProfile };
      }

      await client().auth.signOut();
    }

    if (!allowLegacyFallback) {
      return { ok: false, error: error ? error.message : "비밀번호가 맞지 않습니다." };
    }

    const legacyResult = await invokeFunction("admin-login", { password });
    if (legacyResult.ok === true) {
      const legacyProfile = { username: "legacy-admin", displayName: "Legacy Admin", role: "manager" };
      sessionStorage.setItem(LEGACY_ADMIN_PASSWORD_KEY, password);
      sessionStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(legacyProfile));
      if (rememberMe) {
        localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(legacyProfile));
      }
      return { ok: true, profile: legacyProfile };
    }

    return { ok: false, error: error ? error.message : legacyResult.error || "로그인 실패" };
  }

  function clearAdminPassword() {
    sessionStorage.removeItem(ADMIN_PROFILE_KEY);
    sessionStorage.removeItem(LEGACY_ADMIN_PASSWORD_KEY);
    localStorage.removeItem(ADMIN_PROFILE_KEY);
    localStorage.removeItem(KEEP_SESSION_KEY);
    if (isSupabaseEnabled()) {
      client().auth.signOut();
    }
  }

  function getAdminProfile() {
    try {
      const sessionData = sessionStorage.getItem(ADMIN_PROFILE_KEY);
      if (sessionData) return JSON.parse(sessionData);
      if (localStorage.getItem(KEEP_SESSION_KEY) === "true") {
        const localData = localStorage.getItem(ADMIN_PROFILE_KEY);
        if (localData) {
          const profile = JSON.parse(localData);
          sessionStorage.setItem(ADMIN_PROFILE_KEY, localData);
          return profile;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async function restoreAdminSession() {
    if (!isSupabaseEnabled()) {
      const profile = getAdminProfile();
      return { ok: Boolean(profile), profile };
    }

    try {
      const { data, error } = await client().auth.getSession();
      if (error) return { ok: false, error: error.message };
      if (!data || !data.session || !data.session.user) {
        const legacyPassword = sessionStorage.getItem(LEGACY_ADMIN_PASSWORD_KEY);
        if (legacyPassword) {
          return { ok: true, profile: getAdminProfile() };
        }
        if (localStorage.getItem(KEEP_SESSION_KEY) !== "true") {
          clearAdminPassword();
        }
        return { ok: false };
      }

      // Supabase 유효 세션 존재 -> admin_profiles 조회
      const { data: profile, error: profileError } = await client()
        .from("admin_profiles")
        .select("username, display_name, role, is_active")
        .eq("user_id", data.session.user.id)
        .single();

      if (profileError) {
        return { ok: false, error: `관리자 정보 조회 실패: ${profileError.message}` };
      }

      if (!profileError && profile && profile.is_active === true) {
        const adminProfile = {
          username: profile.username,
          displayName: profile.display_name || profile.username,
          role: profile.role || "teacher",
        };
        sessionStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(adminProfile));
        if (localStorage.getItem(KEEP_SESSION_KEY) === "true") {
          localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(adminProfile));
        }
        return { ok: true, profile: adminProfile };
      }

      clearAdminPassword();
      return { ok: false, error: "비활성화된 계정입니다." };
    } catch (e) {
      console.warn("restoreAdminSession failed:", e);
      return { ok: false, error: e.message };
    }
  }

  async function hasAdminSession() {
    if (!isSupabaseEnabled()) {
      return Boolean(getAdminProfile());
    }
    return Boolean((await authAccessToken()) || sessionStorage.getItem(LEGACY_ADMIN_PASSWORD_KEY));
  }

  function changeKey(date, className, period) {
    return `${date}__${className}__${period}`;
  }

  window.TimetableStore = {
    classes,
    weekdays,
    periods,
    read,
    write,
    readRemote,
    readAcademicEvents,
    subscribeRemoteChanges,
    verifyAdminPassword,
    adminAccountsRequest,
    apiKeysRequest,
    apiApplicationRequest,
    syncNeisCalendarRequest,
    clearAdminPassword,
    getAdminProfile,
    restoreAdminSession,
    hasAdminSession,
    isSupabaseEnabled,
    changeKey,
  };
})();
