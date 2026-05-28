(function () {
  const STORAGE_KEY = "school-timetable-v1";
  const ADMIN_PASSWORD_KEY = "timetable-admin-password";

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
        eventFontScale: 100,
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
          eventFontScale: Number(parsed.slideshow && parsed.slideshow.eventFontScale) || 100,
        },
      };
    } catch {
      const defaults = createDefaultState();
      write(defaults);
      return defaults;
    }
  }

  function write(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (isSupabaseEnabled()) {
      return writeRemote(state);
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
        eventFontScale: Number(parsed.slideshow && parsed.slideshow.eventFontScale) || 100,
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

  async function invokeFunction(name, body) {
    const config = window.SUPABASE_CONFIG;
    const response = await fetch(`${config.url}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { error: text };
    }

    if (!response.ok) {
      const detail = payload && payload.error ? payload.error : response.statusText;
      return { ok: false, error: `${response.status} ${detail}` };
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

  async function writeRemote(state) {
    const password = sessionStorage.getItem(ADMIN_PASSWORD_KEY);
    if (!password) {
      return { ok: false, error: "관리자 비밀번호 세션이 없습니다." };
    }

    const publicState = { ...state };
    delete publicState.adminPassword;

    const result = await invokeFunction("save-state", { password, state: publicState });
    if (result.ok === false) {
      console.warn("Supabase write failed:", result.error);
      return result;
    }

    return result;
  }

  async function verifyAdminPassword(password) {
    if (!isSupabaseEnabled()) {
      const ok = password === read().adminPassword;
      if (ok) {
        sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
      }
      return { ok };
    }

    const result = await invokeFunction("admin-login", { password });
    if (result.ok !== true) {
      return { ok: false, error: result.error || "" };
    }

    sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
    return { ok: true };
  }

  function clearAdminPassword() {
    sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
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
    subscribeRemoteChanges,
    verifyAdminPassword,
    clearAdminPassword,
    isSupabaseEnabled,
    changeKey,
  };
})();
