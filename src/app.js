(function () {
  const {
    classes,
    weekdays,
    periods,
    read,
    write,
    readRemote,
    subscribeRemoteChanges,
    verifyAdminPassword,
    adminAccountsRequest,
    apiKeysRequest,
    apiApplicationRequest,
    clearAdminPassword,
    getAdminProfile,
    isSupabaseEnabled,
    changeKey,
  } = window.TimetableStore;
  let state = read();
  let selectedDate = "";
  let currentRoute = "view";
  let selectedNoticeId = state.notices[0] ? state.notices[0].id : "";
  let selectedEventId = "";
  let changeFilterWeekday = "all";
  let slideshowIndex = 0;
  let slideshowTimer = null;
  let slideshowRefreshTimer = null;
  let slideshowToastTimer = null;
  let globalStatusTimer = null;
  let mainEggToastTimer = null;
  let mainEggResetTimer = null;
  let mainEggLogoClicks = 0;
  let mainEggTodayClicks = 0;
  let mainEggSequence = "";
  let mealDataCache = null;
  let mealDataFetchedAt = 0;
  let isMealLoading = false;
  let boardRefreshTimer = null;
  let remoteUnsubscribe = null;
  let pendingRetryMessage = "";
  let pendingRetryAction = "save_state";
  let selectedAdminAccountId = "";
  let adminAccounts = [];
  let auditLogs = [];
  let adminAccountsLoading = false;
  let apiKeys = [];
  let apiKeysLoading = false;
  let apiApplicationRequestId = "";
  let apiApplicationEmail = "";
  let analyticsRouteTrackingReady = false;
  const gaMeasurementId = "G-TTWC1RKWGL";
  const LAST_SAVE_KEY = "timetable-last-save-at";
  const WALLPAPER_NAME_KEY = "wallpaper-name";
  const WALLPAPER_SUBJECTS_KEY = "wallpaper-subjects";
  const WALLPAPER_DAYS_KEY = "wallpaper-days";
  const WALLPAPER_GRADES_KEY = "wallpaper-grades";
  const DEV_MODE_KEY = "timetable-dev-mode";
  const isBoardMode = location.pathname.replace(/\/+$/, "") === "/board";
  const ROLE_PERMISSIONS = {
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
    manage_accounts: ["dev", "manager"],
    manage_api_keys: ["dev"],
    read_audit_logs: ["dev", "manager", "teacher"],
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const els = {
    viewPage: $("#viewPage"),
    slideshowPage: $("#slideshowPage"),
    wallpaperPage: $("#wallpaperPage"),
    downloadPage: $("#downloadPage"),
    apiPage: $("#apiPage"),
    privacyPage: $("#privacyPage"),
    adminPage: $("#adminPage"),
    homeButton: $("#homeButton"),
    todayLabel: $("#todayLabel"),
    rangeLabel: $("#rangeLabel"),
    viewClass: $("#viewClass"),
    boardThemeButton: $("#boardThemeButton"),
    dayTabs: $("#dayTabs"),
    viewSchedule: $("#viewSchedule"),
    slideshowTitle: $("#slideshowTitle"),
    slideshowMeta: $("#slideshowMeta"),
    slideshowStage: $("#slideshowStage"),
    exitSlideshowButton: $("#exitSlideshowButton"),
    wallpaperName: $("#wallpaperName"),
    wallpaperSubjects: $("#wallpaperSubjects"),
    wallpaperDays: $("#wallpaperDays"),
    wallpaperGrades: $("#wallpaperGrades"),
    wallpaperPreview: $("#wallpaperPreview"),
    wallpaperAutomation: $("#wallpaperAutomation"),
    loginPanel: $("#loginPanel"),
    adminWorkspace: $("#adminWorkspace"),
    adminUsername: $("#adminUsername"),
    adminPassword: $("#adminPassword"),
    loginButton: $("#loginButton"),
    logoutButton: $("#logoutButton"),
    loginMessage: $("#loginMessage"),
    adminMessage: $("#adminMessage"),
    lastSaveStatus: $("#lastSaveStatus"),
    baseWeekday: $("#baseWeekday"),
    baseEditor: $("#baseEditor"),
    saveBaseButton: $("#saveBaseButton"),
    specialDate: $("#specialDate"),
    specialDateHint: $("#specialDateHint"),
    specialEditor: $("#specialEditor"),
    saveSpecialButton: $("#saveSpecialButton"),
    deleteSpecialButton: $("#deleteSpecialButton"),
    specialList: $("#specialList"),
    baseMergeStart: $("#baseMergeStart"),
    baseMergeEnd: $("#baseMergeEnd"),
    baseMergeTitle: $("#baseMergeTitle"),
    baseMergeMemo: $("#baseMergeMemo"),
    baseMergeClassChecks: $("#baseMergeClassChecks"),
    saveBaseMergeButton: $("#saveBaseMergeButton"),
    baseMergeList: $("#baseMergeList"),
    changeDate: $("#changeDate"),
    changeWeekdayHint: $("#changeWeekdayHint"),
    changeWeekdayFilter: $("#changeWeekdayFilter"),
    changeClass: $("#changeClass"),
    changePeriod: $("#changePeriod"),
    changeSubject: $("#changeSubject"),
    changeType: $("#changeType"),
    changeMemo: $("#changeMemo"),
    saveChangeButton: $("#saveChangeButton"),
    deleteChangeButton: $("#deleteChangeButton"),
    changeList: $("#changeList"),
    eventDate: $("#eventDate"),
    eventStart: $("#eventStart"),
    eventEnd: $("#eventEnd"),
    eventTitle: $("#eventTitle"),
    eventMemo: $("#eventMemo"),
    eventClassChecks: $("#eventClassChecks"),
    eventCustomFontEnabled: $("#eventCustomFontEnabled"),
    eventCustomFontControls: $("#eventCustomFontControls"),
    eventCustomFontScale: $("#eventCustomFontScale"),
    eventCustomFontScaleLabel: $("#eventCustomFontScaleLabel"),
    slideEventFontScale: $("#slideEventFontScale"),
    slideEventFontScaleLabel: $("#slideEventFontScaleLabel"),
    saveEventButton: $("#saveEventButton"),
    cancelEventEditButton: $("#cancelEventEditButton"),
    eventList: $("#eventList"),
    noticeTitle: $("#noticeTitle"),
    noticeBody: $("#noticeBody"),
    noticeTitleFontSize: $("#noticeTitleFontSize"),
    noticeTitleFontSizeLabel: $("#noticeTitleFontSizeLabel"),
    noticeFontSize: $("#noticeFontSize"),
    noticeFontSizeLabel: $("#noticeFontSizeLabel"),
    noticePreview: $("#noticePreview"),
    addNoticeButton: $("#addNoticeButton"),
    saveNoticeButton: $("#saveNoticeButton"),
    noticeList: $("#noticeList"),
    slideLessonFontScale: $("#slideLessonFontScale"),
    slideLessonFontScaleLabel: $("#slideLessonFontScaleLabel"),
    slideClassHeaderFontScale: $("#slideClassHeaderFontScale"),
    slideClassHeaderFontScaleLabel: $("#slideClassHeaderFontScaleLabel"),
    slidePeriodHeaderFontScale: $("#slidePeriodHeaderFontScale"),
    slidePeriodHeaderFontScaleLabel: $("#slidePeriodHeaderFontScaleLabel"),
    slideInterval: $("#slideInterval"),
    slideRefreshInterval: $("#slideRefreshInterval"),
    slideScheduleDate: $("#slideScheduleDate"),
    slideShowMeal: $("#slideShowMeal"),
    saveSlideSettingsButton: $("#saveSlideSettingsButton"),
    slideReloadPassword: $("#slideReloadPassword"),
    forceSlideReloadPermission: $("#forceSlideReloadPermission"),
    forceSlideReloadButton: $("#forceSlideReloadButton"),
    refreshAuditLogsButton: $("#refreshAuditLogsButton"),
    accountUsername: $("#accountUsername"),
    accountDisplayName: $("#accountDisplayName"),
    accountRole: $("#accountRole"),
    accountPassword: $("#accountPassword"),
    accountActive: $("#accountActive"),
    saveAccountButton: $("#saveAccountButton"),
    newAccountButton: $("#newAccountButton"),
    deactivateAccountButton: $("#deactivateAccountButton"),
    accountList: $("#accountList"),
    apiKeysTab: $("#apiKeysTab"),
    apiKeyName: $("#apiKeyName"),
    apiKeyRateLimit: $("#apiKeyRateLimit"),
    apiKeyExpiresOn: $("#apiKeyExpiresOn"),
    createApiKeyButton: $("#createApiKeyButton"),
    apiKeyResult: $("#apiKeyResult"),
    newApiKeyValue: $("#newApiKeyValue"),
    copyApiKeyButton: $("#copyApiKeyButton"),
    refreshApiKeysButton: $("#refreshApiKeysButton"),
    apiKeyList: $("#apiKeyList"),
    apiApplyForm: $("#apiApplyForm"),
    apiApplyName: $("#apiApplyName"),
    apiApplyEmail: $("#apiApplyEmail"),
    apiApplyPhone: $("#apiApplyPhone"),
    sendApiCodeButton: $("#sendApiCodeButton"),
    apiApplyMessage: $("#apiApplyMessage"),
    apiVerifyForm: $("#apiVerifyForm"),
    apiVerifyEmail: $("#apiVerifyEmail"),
    apiVerificationCode: $("#apiVerificationCode"),
    verifyApiCodeButton: $("#verifyApiCodeButton"),
    apiVerifyMessage: $("#apiVerifyMessage"),
    publicApiKeyResult: $("#publicApiKeyResult"),
    publicApiKeyValue: $("#publicApiKeyValue"),
    copyPublicApiKeyButton: $("#copyPublicApiKeyButton"),
    auditLogList: $("#auditLogList"),
  };

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function toISO(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function fromISO(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatDate(value) {
    const date = fromISO(value);
    return `${date.getMonth() + 1}.${date.getDate()}`;
  }

  function mondayOf(date) {
    const copy = new Date(date);
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function schoolDaysForTwoWeeks() {
    const start = mondayOf(new Date());
    const regularDays = Array.from({ length: 10 }, (_, index) => {
      const date = new Date(start);
      const offset = index < 5 ? index : index + 2;
      date.setDate(start.getDate() + offset);
      return {
        iso: toISO(date),
        weekday: weekdays[index % 5],
        weekLabel: index < 5 ? "이번주" : "다음주",
      };
    });
    const regularDateSet = new Set(regularDays.map((day) => day.iso));
    const specialDays = Object.keys(state.specialSchedules || {})
      .filter((date) => !regularDateSet.has(date))
      .sort()
      .map((date) => ({
        iso: date,
        weekday: { key: "special", label: weekdayLabelForDate(date) },
        weekLabel: "특별",
      }));
    return [...regularDays, ...specialDays].sort((a, b) => a.iso.localeCompare(b.iso));
  }

  function schoolDaysForCurrentWeek() {
    const start = mondayOf(new Date());
    return weekdays.map((weekday, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        iso: toISO(date),
        weekday,
        weekLabel: "이번주",
      };
    });
  }

  function currentSchoolDay() {
    const now = new Date();
    const today = toISO(now);
    const days = schoolDaysForTwoWeeks();
    const selectedDate = state.slideshow && state.slideshow.scheduleDate ? String(state.slideshow.scheduleDate) : "";
    const expiresOn =
      state.slideshow && state.slideshow.scheduleDateExpiresOn ? String(state.slideshow.scheduleDateExpiresOn) : "";
    if (selectedDate && (!expiresOn || today < expiresOn)) {
      return (
        days.find((day) => day.iso === selectedDate) || {
          iso: selectedDate,
          weekday: { key: "special", label: weekdayLabelForDate(selectedDate) },
          weekLabel: "선택",
        }
      );
    }
    if (now.getHours() >= 18) {
      const target = new Date(now);
      target.setDate(target.getDate() + 1);
      const targetIso = toISO(target);
      return days.find((day) => day.iso >= targetIso) || null;
    }
    const regularDay = days.find((day) => day.iso === today);
    if (regularDay) return regularDay;
    if (state.specialSchedules[today]) {
      return { iso: today, weekday: { key: "special", label: weekdayLabelForDate(today) }, weekLabel: "특별" };
    }
    return null;
  }

  function nextDateIso(value) {
    const date = fromISO(value);
    date.setDate(date.getDate() + 1);
    return toISO(date);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fillSelect(select, values, labeler = (value) => value) {
    select.innerHTML = values
      .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labeler(value))}</option>`)
      .join("");
  }

  function weekdayForDate(value) {
    const dayIndex = fromISO(value).getDay();
    return weekdays[dayIndex - 1] || weekdays[0];
  }

  function isSchoolWeekday(value) {
    const day = fromISO(value).getDay();
    return day >= 1 && day <= 5;
  }

  function isWeekend(value) {
    const day = fromISO(value).getDay();
    return day === 0 || day === 6;
  }

  function weekdayLabelForDate(value) {
    const labels = ["일", "월", "화", "수", "목", "금", "토"];
    const date = fromISO(value);
    return labels[date.getDay()] || "";
  }

  function getSubjectsForDate(date, className) {
    const special = state.specialSchedules[date] && state.specialSchedules[date][className];
    if (Array.isArray(special)) return special;
    if (!isSchoolWeekday(date)) return periods.map(() => "");
    return state.base[className][weekdayForDate(date).key] || periods.map(() => "");
  }

  function showMessage(target, text) {
    target.textContent = text;
    window.clearTimeout(target._timer);
    target._timer = window.setTimeout(() => {
      target.textContent = "";
    }, 2600);
  }

  function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function friendlyRemoteError(error) {
    const text = String(error && (error.message || error.error || error) ? error.message || error.error || error : "");
    if (/관리자 비밀번호 세션|session/i.test(text)) {
      return "관리자 로그인 세션이 없습니다. 다시 로그인한 뒤 저장하세요.";
    }
    if (/Incorrect password|401|403|권한|unauthorized|forbidden/i.test(text)) {
      return "관리자 권한이 확인되지 않았습니다. 아이디와 비밀번호로 다시 로그인하세요.";
    }
    if (/Failed to fetch|NetworkError|Load failed|연결|network|fetch/i.test(text)) {
      return "Supabase에 연결하지 못했습니다. 인터넷 연결이나 Supabase 상태를 확인한 뒤 다시 저장하세요.";
    }
    if (/Invalid state|400/i.test(text)) {
      return "저장할 시간표 데이터 형식이 올바르지 않습니다. 방금 입력한 항목을 확인하세요.";
    }
    if (/ADMIN_PASSWORD/i.test(text)) {
      return "서버 관리자 인증 설정을 확인하세요.";
    }
    return text ? `원격 저장 중 오류가 발생했습니다. ${text}` : "원격 저장 중 알 수 없는 오류가 발생했습니다.";
  }

  function updateLastSaveStatus(status = "idle") {
    if (!els.lastSaveStatus) return;
    const savedAt = localStorage.getItem(LAST_SAVE_KEY);
    const formatted = formatDateTime(savedAt);
    els.lastSaveStatus.classList.toggle("is-error", status === "error");
    els.lastSaveStatus.classList.toggle("is-stale", status === "saving" || status === "stale");
    if (status === "saving") {
      els.lastSaveStatus.textContent = formatted ? `저장 중 · 마지막 저장: ${formatted}` : "저장 중 · 마지막 저장: 아직 없음";
      return;
    }
    if (status === "error") {
      els.lastSaveStatus.textContent = formatted ? `저장 실패 · 마지막 성공: ${formatted}` : "저장 실패 · 마지막 성공 없음";
      return;
    }
    els.lastSaveStatus.textContent = formatted ? `마지막 저장: ${formatted}` : "마지막 저장: 아직 없음";
  }

  function markLastSaveSuccess() {
    localStorage.setItem(LAST_SAVE_KEY, new Date().toISOString());
    updateLastSaveStatus();
  }

  function showMainEggToast(message) {
    let toast = document.querySelector("#mainEggToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "mainEggToast";
      toast.className = "main-egg-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(mainEggToastTimer);
    mainEggToastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2200);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function isLoggedIn() {
    return sessionStorage.getItem("timetable-admin") === "true";
  }

  function currentAdminRole() {
    const profile = getAdminProfile();
    return profile && profile.role ? profile.role : "teacher";
  }

  function canRole(action) {
    const allowedRoles = ROLE_PERMISSIONS[action] || ROLE_PERMISSIONS.save_state;
    return allowedRoles.includes(currentAdminRole());
  }

  function ensurePermission(action, label) {
    if (canRole(action)) return true;
    showMessage(els.adminMessage, `${label} 권한이 없습니다.`);
    showGlobalError(`${label} 권한이 없습니다.`, { autoHide: true });
    return false;
  }

  function routeFromPath() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/admin") return "admin";
    if (path === "/slide" || path === "/slideshow") return "slideshow";
    if (path === "/wallpaper") return "wallpaper";
    if (path === "/download" || path === "/downloads") return "download";
    if (path === "/api" || path === "/api-docs") return "api";
    if (path === "/privacy") return "privacy";
    return "view";
  }

  function pathForRoute(route) {
    if (route === "admin") return "/admin";
    if (route === "slideshow") return "/slide";
    if (route === "wallpaper") return "/wallpaper";
    if (route === "download") return "/download";
    if (route === "api") return "/api";
    if (route === "privacy") return "/privacy";
    return "/";
  }

  function titleForRoute(route) {
    const labels = {
      view: "조회",
      slideshow: "슬라이드쇼",
      wallpaper: "배경화면",
      download: "다운로드",
      api: "API",
      admin: "관리자",
      privacy: "개인정보처리방침",
    };
    return `용정시간표 - ${labels[route] || "조회"}`;
  }

  function isDeveloperMode() {
    const params = new URLSearchParams(location.search);
    if (params.get("dev") === "1") {
      localStorage.setItem(DEV_MODE_KEY, "true");
      return true;
    }
    if (params.get("dev") === "0") {
      localStorage.setItem(DEV_MODE_KEY, "false");
      return false;
    }
    const storedMode = localStorage.getItem(DEV_MODE_KEY);
    if (storedMode === "true") return true;
    if (storedMode === "false") return false;
    return (
      location.protocol === "file:" ||
      ["localhost", "127.0.0.1", "::1"].includes(location.hostname)
    );
  }

  function applyDeveloperMode() {
    const enabled = isDeveloperMode();
    document.body.classList.toggle("is-dev-mode", enabled);
    $$("[data-dev-only]").forEach((element) => {
      element.hidden = !enabled;
    });

    // iOS 자동화 가이드 모달 이벤트 바인딩
    const iosModal = $("#iosGuideModal");
    const btnOpenModal = $("#btnOpenIosModal");
    const btnCloseModal = $("#btnCloseIosModal");

    if (btnOpenModal && iosModal) {
      btnOpenModal.onclick = () => {
        iosModal.classList.remove("is-hidden");
      };
    }
    if (btnCloseModal && iosModal) {
      btnCloseModal.onclick = () => {
        iosModal.classList.add("is-hidden");
      };
    }
    if (iosModal) {
      iosModal.onclick = (e) => {
        if (e.target === iosModal) {
          iosModal.classList.add("is-hidden");
        }
      };
    }
  }

  async function enterFullscreen() {
    if (document.fullscreenElement || isBoardMode) return;
    const target = document.documentElement;
    if (!target.requestFullscreen) return;
    try {
      await target.requestFullscreen();
    } catch {
      showSlideshowToast("전체화면이 차단되면 F11을 눌러주세요.");
    }
  }

  async function exitFullscreen() {
    if (!document.fullscreenElement || !document.exitFullscreen) return;
    try {
      await document.exitFullscreen();
    } catch {
      // Browser may reject if fullscreen was already dismissed.
    }
  }

  function selectAdminTab(tabName) {
    $$(".admin-tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.adminTab === tabName));
    $$(".admin-panel").forEach((panel) => panel.classList.add("is-hidden"));
    const panel = $(`#${tabName}Panel`);
    if (panel) panel.classList.remove("is-hidden");
  }

  function refreshAdminAuth() {
    const loggedIn = isLoggedIn();
    els.loginPanel.classList.toggle("is-hidden", loggedIn);
    els.adminWorkspace.classList.toggle("is-hidden", !loggedIn);
    if (loggedIn) {
      selectAdminTab("change");
      refreshAdminAccounts();
    } else {
      selectedAdminAccountId = "";
      adminAccounts = [];
      apiKeys = [];
      auditLogs = [];
      els.newApiKeyValue.textContent = "";
      els.apiKeyResult.classList.add("is-hidden");
      renderAdminAccounts();
      renderApiKeys();
      renderAuditLogs();
    }
    applyAdminPermissions();
  }

  function setControlDisabled(control, disabled) {
    if (!control) return;
    control.disabled = disabled;
    control.setAttribute("aria-disabled", disabled ? "true" : "false");
  }

  function setContainerDisabled(selector, disabled) {
    const container = $(selector);
    if (!container) return;
    container.querySelectorAll("input, select, textarea, button").forEach((control) => {
      setControlDisabled(control, disabled);
    });
  }

  function applyAdminPermissions() {
    if (!els.adminWorkspace || els.adminWorkspace.classList.contains("is-hidden")) return;
    const canBase = canRole("update_base");
    const canBaseMerge = canRole("update_base_merge");
    const canSlideRuntime = canRole("update_slide_runtime");
    const canSlideTypography = canRole("update_slide_typography");
    const canForceReload = canRole("force_reload");
    const canManageApiKeys = canRole("manage_api_keys");

    setContainerDisabled("#baseEditor", !canBase);
    setControlDisabled(els.saveBaseButton, !canBase);
    [els.baseMergeStart, els.baseMergeEnd, els.baseMergeTitle, els.baseMergeMemo, els.saveBaseMergeButton].forEach((control) =>
      setControlDisabled(control, !canBaseMerge)
    );
    setContainerDisabled("#baseMergeClassChecks", !canBaseMerge);
    if (els.baseMergeList) {
      els.baseMergeList.querySelectorAll("[data-delete-base-merge]").forEach((button) => setControlDisabled(button, !canBaseMerge));
    }

    [els.slideInterval, els.slideRefreshInterval, els.slideScheduleDate, els.saveSlideSettingsButton].forEach((control) =>
      setControlDisabled(control, !canSlideRuntime)
    );
    [
      els.slideLessonFontScale,
      els.slideClassHeaderFontScale,
      els.slidePeriodHeaderFontScale,
      els.slideEventFontScale,
      els.eventCustomFontEnabled,
      els.eventCustomFontScale,
    ].forEach((control) => setControlDisabled(control, !canSlideTypography));
    [els.slideReloadPassword, els.forceSlideReloadButton].forEach((control) => setControlDisabled(control, false));
    if (els.forceSlideReloadPermission) {
      els.forceSlideReloadPermission.textContent = canForceReload
        ? "현재 dev 계정에서 사용할 수 있습니다."
        : "강제 새로고침 실행은 dev 계정만 가능합니다.";
    }

    const canManageAccounts = canRole("manage_accounts");
    [els.accountDisplayName, els.accountRole, els.accountPassword, els.accountActive, els.saveAccountButton, els.newAccountButton].forEach((control) =>
      setControlDisabled(control, !canManageAccounts)
    );
    const selectedAccount = adminAccounts.find((account) => account.user_id === selectedAdminAccountId);
    const selectedIsDev = selectedAccount && selectedAccount.role === "dev";
    const selectedIsSelf = selectedAccount && getAdminProfile() && selectedAccount.username === getAdminProfile().username;
    const canDeactivateSelected = canManageAccounts && selectedAccount && !selectedIsSelf && (currentAdminRole() === "dev" || !selectedIsDev);
    setControlDisabled(els.accountUsername, !canManageAccounts || Boolean(selectedAdminAccountId));
    setControlDisabled(els.deactivateAccountButton, !canDeactivateSelected);
    if (els.accountRole) {
      Array.from(els.accountRole.options).forEach((option) => {
        option.disabled = option.value === "dev" && currentAdminRole() !== "dev";
      });
    }
    if (els.accountList) {
      els.accountList.querySelectorAll("[data-select-account]").forEach((button) => {
        const account = adminAccounts.find((item) => item.user_id === button.dataset.selectAccount);
        const locked = account && account.role === "dev" && currentAdminRole() !== "dev";
        setControlDisabled(button, !canManageAccounts || locked);
      });
    }
    if (els.apiKeysTab) els.apiKeysTab.hidden = !canManageApiKeys;
    [els.apiKeyName, els.apiKeyRateLimit, els.apiKeyExpiresOn, els.createApiKeyButton, els.refreshApiKeysButton].forEach(
      (control) => setControlDisabled(control, !canManageApiKeys)
    );
    if (els.apiKeyList) {
      els.apiKeyList.querySelectorAll("[data-revoke-api-key]").forEach((button) => setControlDisabled(button, !canManageApiKeys));
    }
  }

  function trackRoutePageView(route) {
    if (!analyticsRouteTrackingReady || typeof window.gtag !== "function") return;
    window.gtag("config", gaMeasurementId, {
      page_path: pathForRoute(route),
      page_title: document.title,
    });
  }

  function routeTo(route, options = {}) {
    currentRoute = route;
    document.title = titleForRoute(route);
    els.viewPage.classList.toggle("is-hidden", route !== "view");
    els.slideshowPage.classList.toggle("is-hidden", route !== "slideshow");
    els.wallpaperPage.classList.toggle("is-hidden", route !== "wallpaper");
    els.downloadPage.classList.toggle("is-hidden", route !== "download");
    els.apiPage.classList.toggle("is-hidden", route !== "api");
    els.privacyPage.classList.toggle("is-hidden", route !== "privacy");
    els.adminPage.classList.toggle("is-hidden", route !== "admin");
    document.body.classList.toggle("slideshow-mode", route === "slideshow");
    $$(".nav-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.route === route);
    });

    if (route === "slideshow") {
      startSlideshow();
      if (options.fullscreen) enterFullscreen();
    } else {
      stopSlideshow();
      exitFullscreen();
    }

    if (route === "wallpaper") {
      renderWallpaper();
    }

    const nextPath = pathForRoute(route);
    if (!isBoardMode && location.pathname !== nextPath) {
      const method = options.replace ? "replaceState" : "pushState";
      history[method]({ route }, "", nextPath);
    }
    syncRemoteForRoute();
    trackRoutePageView(route);
  }

  function goHome() {
    const days = schoolDaysForTwoWeeks();
    const today = toISO(new Date());
    selectedDate = days.some((day) => day.iso === today) ? today : days[0].iso;
    routeTo("view");
    renderView();
  }

  function getChange(date, className, period) {
    return state.changes[changeKey(date, className, period)] || null;
  }

  function isNewChange(change) {
    return Boolean(change && change.type === "new");
  }

  function eventSlideFontScale(event) {
    const globalScale = clamp(Number(state.slideshow && state.slideshow.eventFontScale) || 100, 70, 150);
    if (!event || event.useCustomSlideFontScale !== true) return globalScale;
    return clamp(Number(event.slideFontScale) || globalScale, 70, 150);
  }

  function getEventsForDate(date) {
    return state.events.filter((event) => event.date === date);
  }

  function getBaseMergesForDate(date) {
    if (!isSchoolWeekday(date)) return [];
    const weekdayKey = weekdayForDate(date).key;
    return state.baseMerges.filter((merge) => merge.weekday === weekdayKey);
  }

  function hasEventCovering(date, className, period) {
    return getEventsForDate(date).some((event) => {
      return event.classes.includes(className) && period >= event.start && period <= event.end;
    });
  }

  function hasBaseMergeCovering(date, className, period) {
    return getBaseMergesForDate(date).some((merge) => {
      return merge.classes.includes(className) && period >= merge.start && period <= merge.end;
    });
  }

  function shouldExcludeFromBaseMerge(date, className, period) {
    return hasEventCovering(date, className, period) || Boolean(getChange(date, className, period));
  }

  function formatPeriodRange(start, end) {
    return Number(start) === Number(end) ? `${start}교시` : `${start}-${end}교시`;
  }

  function renderDayTabs(days) {
    els.dayTabs.innerHTML = days
      .map((day) => {
        const active = day.iso === selectedDate ? " is-active" : "";
        return `<button class="day-tab${active}" data-date="${day.iso}" type="button">
          <span>${day.weekLabel}</span>
          <strong>${formatDate(day.iso)} ${day.weekday.label}</strong>
        </button>`;
      })
      .join("");
  }

  function eventPlacements(event, visibleClasses) {
    const indexes = event.classes
      .map((className) => visibleClasses.indexOf(className))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b);
    const groups = [];

    indexes.forEach((index) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup[lastGroup.length - 1] + 1 === index) {
        lastGroup.push(index);
      } else {
        groups.push([index]);
      }
    });

    return groups.map((group) => ({
      columnStart: group[0] + 2,
      columnEnd: group[group.length - 1] + 3,
      rowStart: event.start + 1,
      rowEnd: event.end + 2,
    }));
  }

  function baseMergePlacements(date, merge, visibleClasses) {
    const visibleClassIndexes = visibleClasses
      .map((className, index) => ({ className, index }))
      .filter((item) => merge.classes.includes(item.className));
    const mergePeriods = periods.filter((period) => period >= merge.start && period <= merge.end);
    const available = mergePeriods.map((period) => {
      return visibleClassIndexes.map((item) => {
        return !shouldExcludeFromBaseMerge(date, item.className, period);
      });
    });
    const placements = [];

    for (let row = 0; row < available.length; row += 1) {
      for (let column = 0; column < available[row].length; column += 1) {
        if (!available[row][column]) continue;

        let width = 1;
        while (column + width < available[row].length && available[row][column + width]) {
          width += 1;
        }

        let height = 1;
        while (
          row + height < available.length &&
          available[row + height].slice(column, column + width).every(Boolean)
        ) {
          height += 1;
        }

        for (let markRow = row; markRow < row + height; markRow += 1) {
          for (let markColumn = column; markColumn < column + width; markColumn += 1) {
            available[markRow][markColumn] = false;
          }
        }

        placements.push({
          columnStart: visibleClassIndexes[column].index + 2,
          columnEnd: visibleClassIndexes[column + width - 1].index + 3,
          rowStart: mergePeriods[row] + 1,
          rowEnd: mergePeriods[row + height - 1] + 2,
          periodStart: mergePeriods[row],
          periodEnd: mergePeriods[row + height - 1],
        });
      }
    }

    return placements;
  }

  function renderMergedCells(items, visibleClasses, className, compact = false, placementResolver) {
    return items
      .flatMap((item) => {
        const placements = placementResolver ? placementResolver(item) : eventPlacements(item, visibleClasses);
        return placements.map((placement) => {
          const rowSpan = placement.rowEnd - placement.rowStart;
          const colSpan = placement.columnEnd - placement.columnStart;
          const hasMemo = Boolean(item.memo);
          const isEventCell = className.includes("event-cell");
          const isBaseMergeCell = className.includes("base-merge-cell");
          const showMeta = compact ? (isEventCell ? hasMemo : !isBaseMergeCell) : true;
          const hasVisibleMeta = hasMemo && showMeta;
          const lengthPenalty = Math.max(0, String(item.title).length - 6) * (compact ? 1 : 1.2);
          const titleMax =
            rowSpan === 1
              ? compact
                ? hasVisibleMeta
                  ? 28
                  : 46
                : 22
              : rowSpan === 2
                ? compact
                  ? hasVisibleMeta
                    ? 44
                    : 54
                  : 30
                : compact
                  ? hasVisibleMeta
                    ? 52
                    : 64
                  : 36;
          const titleMin = compact ? (rowSpan === 1 ? 18 : 22) : rowSpan === 1 ? 14 : 16;
          const titleSize = clamp(
            (compact ? (hasMemo ? 20 : 25) : 14) +
              rowSpan * (compact ? 5 : 4) +
              Math.min(colSpan, 3) * (compact ? 2 : 1.5) +
              (isEventCell && compact ? 4 : 0) -
              lengthPenalty,
            titleMin,
            titleMax
          );
          const metaSize = clamp(
            hasVisibleMeta ? (rowSpan === 1 ? 11 : titleSize * 0.4) : rowSpan === 1 ? 10 : titleSize * 0.32,
            10,
            hasVisibleMeta ? (rowSpan === 1 ? 12 : compact ? 18 : 15) : rowSpan === 1 ? 12 : 14
          );
          const titleLines = hasVisibleMeta ? (rowSpan === 1 ? 1 : 2) : rowSpan === 1 ? 2 : 3;
          const metaLines = rowSpan === 1 ? 1 : 2;
          const periodStart = placement.periodStart || item.start;
          const periodEnd = placement.periodEnd || item.end;
          const eventScale = isEventCell && compact ? eventSlideFontScale(item) / 100 : 1;
          return `<div class="${className}${hasVisibleMeta ? " has-memo" : " is-no-memo"}${rowSpan === 1 ? " is-single-row" : ""}" style="grid-column:${placement.columnStart}/${placement.columnEnd};grid-row:${placement.rowStart}/${placement.rowEnd};--merge-title-size:${titleSize * eventScale}px;--merge-meta-size:${metaSize}px;--merge-title-lines:${titleLines};--merge-meta-lines:${metaLines};--merge-gap:${rowSpan === 1 ? (hasVisibleMeta ? 3 : 1) : 4}px;--merge-padding:${rowSpan === 1 ? 5 : 8}px">
            <strong>${escapeHtml(item.title)}</strong>
            ${showMeta ? `<small>${formatPeriodRange(periodStart, periodEnd)}${item.memo ? ` · ${escapeHtml(item.memo)}` : ""}</small>` : ""}
          </div>`;
        });
      })
      .join("");
  }

  function renderScheduleGrid(date, visibleClasses = classes, variant = "") {
    const weekdayKey = weekdayForDate(date).key;
    const events = getEventsForDate(date).filter((event) => {
      return event.classes.some((className) => visibleClasses.includes(className));
    });
    const baseMerges = getBaseMergesForDate(date).filter((merge) => {
      return merge.classes.some((className) => visibleClasses.includes(className));
    });
    const classColumns = visibleClasses
      .map((className, classIndex) => {
        return `<div class="class-head" style="grid-column:${classIndex + 2};grid-row:1">${escapeHtml(className)}</div>`;
      })
      .join("");
    const periodRows = periods
      .map((period, index) => {
        const cells = visibleClasses
          .map((className, classIndex) => {
            const placement = `grid-column:${classIndex + 2};grid-row:${index + 2}`;
            const change = getChange(date, className, period);
            if (hasEventCovering(date, className, period)) {
              return `<div class="lesson-cell is-covered" style="${placement}"></div>`;
            }
            if (!change && hasBaseMergeCovering(date, className, period)) {
              return `<div class="lesson-cell is-covered" style="${placement}"></div>`;
            }
            const subject = change ? change.subject : getSubjectsForDate(date, className)[index];
            const memo = change && change.memo ? `<small>${escapeHtml(change.memo)}</small>` : "";
            const changeClass = change ? ` is-change${isNewChange(change) ? " is-new-change" : ""}` : "";
            return `<div class="lesson-cell${changeClass}" style="${placement}">
              <strong>${escapeHtml(subject || "-")}</strong>${memo}
            </div>`;
          })
          .join("");
        return `<div class="period-head row-head" style="grid-column:1;grid-row:${index + 2}">${period}교시</div>${cells}`;
      })
      .join("");

    const lessonScale = variant === "slideshow-grid" ? clamp(Number(state.slideshow && state.slideshow.lessonFontScale) || 100, 70, 150) / 100 : 1;
    const classHeaderScale =
      variant === "slideshow-grid" ? clamp(Number(state.slideshow && state.slideshow.classHeaderFontScale) || 100, 70, 170) / 100 : 1;
    const periodHeaderScale =
      variant === "slideshow-grid" ? clamp(Number(state.slideshow && state.slideshow.periodHeaderFontScale) || 100, 70, 170) / 100 : 1;
    return `<div class="schedule-grid class-columns ${variant}" style="--class-count:${visibleClasses.length};--lesson-font-scale:${lessonScale};--class-head-font-scale:${classHeaderScale};--period-head-font-scale:${periodHeaderScale}">
      <div class="corner-cell" style="grid-column:1;grid-row:1">교시</div>
      ${classColumns}
      ${periodRows}
      ${renderMergedCells(baseMerges, visibleClasses, "base-merge-cell", variant === "slideshow-grid", (merge) =>
        baseMergePlacements(date, merge, visibleClasses)
      )}
      ${renderMergedCells(events, visibleClasses, "event-cell", variant === "slideshow-grid")}
    </div>`;
  }

  function getBoardCell(date, className, period, periodIndex, isToday) {
    const event = getEventsForDate(date).find((item) => {
      return item.classes.includes(className) && period >= item.start && period <= item.end;
    });
    if (event) {
      return `<div class="board-lesson is-event${isToday ? " is-today" : ""}">
        <strong>${escapeHtml(event.title)}</strong>
        <small>행사 · ${formatPeriodRange(event.start, event.end)}${event.memo ? ` · ${escapeHtml(event.memo)}` : ""}</small>
      </div>`;
    }

    const change = getChange(date, className, period);
    if (change) {
      const original = getSubjectsForDate(date, className)[periodIndex] || "-";
      const changeTypeClass = isNewChange(change) ? " is-new-change" : "";
      const changeMeta = isNewChange(change) ? "신설 수업" : `${escapeHtml(original)} 변경`;
      return `<div class="board-lesson is-change${changeTypeClass}${isToday ? " is-today" : ""}">
        <strong>${escapeHtml(change.subject)}</strong>
        <small>${changeMeta}${change.memo ? ` · ${escapeHtml(change.memo)}` : ""}</small>
      </div>`;
    }

    const baseMerge = getBaseMergesForDate(date).find((merge) => {
      return merge.classes.includes(className) && period >= merge.start && period <= merge.end;
    });
    if (baseMerge) {
      return `<div class="board-lesson is-merge${isToday ? " is-today" : ""}">
        <strong>${escapeHtml(baseMerge.title)}</strong>
        <small>${formatPeriodRange(baseMerge.start, baseMerge.end)}${baseMerge.memo ? ` · ${escapeHtml(baseMerge.memo)}` : ""}</small>
      </div>`;
    }

    const subject = getSubjectsForDate(date, className)[periodIndex] || "-";
    return `<div class="board-lesson${isToday ? " is-today" : ""}">
      <strong>${escapeHtml(subject)}</strong>
    </div>`;
  }

  function renderBoardWeekGrid(className) {
    const days = schoolDaysForCurrentWeek();
    const today = toISO(new Date());
    const headerCells = days
      .map((day, index) => {
        const todayClass = day.iso === today ? " is-today" : "";
        return `<div class="board-day-head${todayClass}" style="grid-column:${index + 2};grid-row:1">
          <strong>${day.weekday.label}요일${day.iso === today ? " · 오늘" : ""}</strong>
          <small>${formatDate(day.iso)}</small>
        </div>`;
      })
      .join("");

    const rows = periods
      .map((period, periodIndex) => {
        const cells = days
          .map((day, dayIndex) => {
            const isToday = day.iso === today;
            return `<div style="grid-column:${dayIndex + 2};grid-row:${periodIndex + 2}">
              ${getBoardCell(day.iso, className, period, periodIndex, isToday)}
            </div>`;
          })
          .join("");
        return `<div class="board-period-head" style="grid-column:1;grid-row:${periodIndex + 2}">${period}교시</div>${cells}`;
      })
      .join("");

    return `<div class="board-week-grid">
      <div class="board-corner" style="grid-column:1;grid-row:1">교시</div>
      ${headerCells}
      ${rows}
    </div>`;
  }

  function renderBoardView() {
    const title = els.viewPage.querySelector("h2");
    if (title) {
      title.textContent = "전자칠판 시간표";
    }
    const savedClass = localStorage.getItem("board-class");
    if (savedClass && classes.includes(savedClass) && els.viewClass.value !== savedClass) {
      els.viewClass.value = savedClass;
    }
    const className = classes.includes(els.viewClass.value) ? els.viewClass.value : classes[0];
    localStorage.setItem("board-class", className);
    const days = schoolDaysForCurrentWeek();
    const today = toISO(new Date());
    els.todayLabel.textContent = `오늘: ${formatDate(today)} ${weekdayLabelForDate(today)}요일 · ${className}`;
    els.rangeLabel.textContent = `${formatDate(days[0].iso)} ${days[0].weekday.label} - ${formatDate(
      days[days.length - 1].iso
    )} ${days[days.length - 1].weekday.label} · 자동 동기화`;
    els.dayTabs.innerHTML = "";
    els.viewSchedule.innerHTML = renderBoardWeekGrid(className);
  }

  function boardTheme() {
    return localStorage.getItem("board-theme") === "light" ? "light" : "dark";
  }

  function applyBoardTheme(theme = boardTheme()) {
    if (!isBoardMode) return;
    const light = theme === "light";
    document.body.classList.toggle("board-light", light);
    localStorage.setItem("board-theme", light ? "light" : "dark");
    if (els.boardThemeButton) {
      els.boardThemeButton.textContent = light ? "☀" : "☾";
      els.boardThemeButton.setAttribute("aria-label", light ? "라이트 모드 사용 중, 다크 모드로 전환" : "다크 모드 사용 중, 라이트 모드로 전환");
      els.boardThemeButton.title = light ? "라이트 모드" : "다크 모드";
    }
  }

  function normalizedSubject(value) {
    return String(value || "").trim();
  }

  function collectWallpaperSubjects() {
    const subjects = [];
    classes.forEach((className) => {
      weekdays.forEach((weekday) => {
        const classSubjects = state.base[className] && state.base[className][weekday.key];
        if (Array.isArray(classSubjects)) subjects.push(...classSubjects);
      });
    });
    state.baseMerges.forEach((merge) => {
      if (merge && merge.title) subjects.push(merge.title);
    });
    return [...new Set(subjects.map(normalizedSubject).filter((subject) => subject && subject !== "-"))].sort((a, b) =>
      a.localeCompare(b, "ko")
    );
  }

  function parseStoredArray(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return Array.isArray(value) ? value.map(String) : fallback;
    } catch {
      return fallback;
    }
  }

  function parseStoredObject(key, fallback = {}) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function normalizedGrades(value) {
    const grades = Array.isArray(value) ? value.map(String) : [];
    const filtered = grades.filter((grade) => ["1", "2", "3"].includes(grade));
    return filtered.length ? [...new Set(filtered)] : ["1", "2", "3"];
  }

  function wallpaperSettings() {
    const name = localStorage.getItem(WALLPAPER_NAME_KEY) || "";
    const validSubjects = new Set(collectWallpaperSubjects());
    const subjects = parseStoredArray(WALLPAPER_SUBJECTS_KEY, []).filter((subject) => validSubjects.has(subject));
    const validDays = new Set(weekdays.map((weekday) => weekday.key));
    const days = parseStoredArray(WALLPAPER_DAYS_KEY, weekdays.map((weekday) => weekday.key)).filter((day) =>
      validDays.has(day)
    );
    const storedGrades = parseStoredObject(WALLPAPER_GRADES_KEY);
    const grades = Object.fromEntries(subjects.map((subject) => [subject, normalizedGrades(storedGrades[subject])]));
    return {
      name,
      subjects,
      days: days.length ? days : weekdays.map((weekday) => weekday.key),
      grades,
    };
  }

  function saveWallpaperSettings(subjects, days, grades = {}, name = "") {
    localStorage.setItem(WALLPAPER_SUBJECTS_KEY, JSON.stringify(subjects));
    localStorage.setItem(WALLPAPER_DAYS_KEY, JSON.stringify(days));
    localStorage.setItem(
      WALLPAPER_GRADES_KEY,
      JSON.stringify(Object.fromEntries(subjects.map((subject) => [subject, normalizedGrades(grades[subject])])))
    );
    localStorage.setItem(WALLPAPER_NAME_KEY, name);

    // 안드로이드 하이브리드 앱에 실시간 설정값 동기화 보고
    if (window.AndroidApp) {
      try {
        const gradesStr = subjects.map((subject) => `${subject}:${normalizedGrades(grades[subject]).join("|")}`).join(";");
        const subjectsStr = subjects.join(",");
        const daysStr = days.join(",");
        window.AndroidApp.saveFilters(subjectsStr, gradesStr, daysStr);
      } catch (e) {
        console.error("AndroidApp saveFilters failed:", e);
      }
    }
  }

  function wallpaperImageUrl(settings) {
    const url = new URL("/wallpaper.png", location.origin);
    url.searchParams.set("subjects", settings.subjects.join(","));
    url.searchParams.set("days", settings.days.join(","));
    url.searchParams.set(
      "grades",
      settings.subjects.map((subject) => `${subject}:${normalizedGrades(settings.grades[subject]).join("|")}`).join(";")
    );
    if (settings.name) {
      url.searchParams.set("name", settings.name);
    }
    return url.toString();
  }

  function wallpaperAutomationText(settings) {
    const dayLabels = weekdays.filter((weekday) => settings.days.includes(weekday.key)).map((weekday) => weekday.label).join(", ");
    const gradeLines = settings.subjects.map((subject) => `${subject}: ${normalizedGrades(settings.grades[subject]).join(", ")}학년`);
    return [
      "용정시간표 iPhone 배경화면 자동화 설정",
      "",
      `선생님 이름: ${settings.name || "설정 안 됨"}`,
      `과목: ${settings.subjects.join(", ") || "선택 안 됨"}`,
      `요일: ${dayLabels || "월, 화, 수, 목, 금"}`,
      `학년: ${gradeLines.join(" / ") || "전체"}`,
      "",
      "이미지 URL:",
      wallpaperImageUrl(settings),
      "",
      "단축어 액션 순서:",
      "1. URL (위 이미지 URL 입력)",
      "2. URL 콘텐츠 가져오기 (Get contents of URL)",
      "3. 가져온 콘텐츠의 이름을 'today-wallpaper.png' 로 이름 변경 (Set name to today-wallpaper.png)",
      "4. 변경된 이름의 항목을 배경화면으로 설정 (Set wallpaper to Renamed Item)",
      "",
      "자동화 설정:",
      "1. 단축어 앱 ➔ 자동화 ➔ 우측 상단 [+] ➔ 개인용 자동화 생성",
      "2. [하루 중 특정 시간] ➔ 일출 시각, 08:40, 14:00 등의 골든타임 기입",
      "3. 실행 옵션을 [확인 없이 실행]으로 스위칭",
      "4. 동작으로 위의 단축어 실행 연동",
      "5. (알림 끄기 팁) 자동화 내부에서 [실행 시 알림]을 끄면 화면 방해 없이 조용히 갱신됩니다.",
      "",
      "참고: iOS 정책상 웹사이트가 아이폰의 자동화를 직접 원격 강제 설치할 수는 없으므로, 위 가이드를 따라 1회만 단축어를 등록해 주시면 평생 자동으로 동기화됩니다.",
    ].join("\n");
  }

  function downloadWallpaperAutomation(settings) {
    const blob = new Blob([wallpaperAutomationText(settings)], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `yj-wallpaper-shortcut-${settings.subjects.join("-") || "setup"}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function gradeForClass(className) {
    return String(className || "").split("-")[0];
  }

  function isWallpaperSubjectAllowed(settings, subject, className) {
    return normalizedGrades(settings.grades[subject]).includes(gradeForClass(className));
  }

  function wallpaperMatchesForCell(date, className, period, periodIndex, settings) {
    const selected = new Set(settings.subjects);
    const matches = [];
    const original = getSubjectsForDate(date, className)[periodIndex] || "-";
    const change = getChange(date, className, period);

    if (change) {
      if (selected.has(normalizedSubject(change.subject)) && isWallpaperSubjectAllowed(settings, change.subject, className)) {
        matches.push({
          className,
          title: change.subject,
          note: isNewChange(change) ? "신설 수업" : `${original}에서 변경`,
          type: isNewChange(change) ? "new" : "change",
        });
      }
      if (selected.has(normalizedSubject(original)) && isWallpaperSubjectAllowed(settings, original, className)) {
        matches.push({
          className,
          title: original,
          note: `${change.subject}로 변경됨`,
          type: "original",
        });
      }
      return matches;
    }

    const lesson = wallpaperLesson(date, className, period, periodIndex);
    if (selected.has(normalizedSubject(lesson.title)) && isWallpaperSubjectAllowed(settings, lesson.title, className)) {
      matches.push({ className, title: lesson.title, note: "", type: lesson.type });
    }
    return matches;
  }

  function wallpaperLesson(date, className, period, periodIndex) {
    const event = getEventsForDate(date).find((item) => {
      return item.classes.includes(className) && period >= item.start && period <= item.end;
    });
    if (event) return { title: event.title, type: "event" };

    const change = getChange(date, className, period);
    if (change) return { title: change.subject, type: isNewChange(change) ? "new" : "change" };

    const baseMerge = getBaseMergesForDate(date).find((merge) => {
      return merge.classes.includes(className) && period >= merge.start && period <= merge.end;
    });
    if (baseMerge) return { title: baseMerge.title, type: "merge" };

    return { title: getSubjectsForDate(date, className)[periodIndex] || "-", type: "base" };
  }

  function renderWallpaperControls(settings) {
    const subjects = collectWallpaperSubjects();
    const selectedSubjects = new Set(settings.subjects);
    els.wallpaperSubjects.innerHTML = subjects.length
      ? subjects
          .map((subject) => {
            const checked = selectedSubjects.has(subject) ? " checked" : "";
            return `<label class="wallpaper-option">
              <input type="checkbox" value="${escapeHtml(subject)}" data-wallpaper-subject${checked} />
              <span>${escapeHtml(subject)}</span>
            </label>`;
          })
          .join("")
      : `<p class="empty">기본 시간표 과목이 없습니다.</p>`;

    const selectedDays = new Set(settings.days);
    els.wallpaperDays.innerHTML = weekdays
      .map((weekday) => {
        const checked = selectedDays.has(weekday.key) ? " checked" : "";
        return `<label class="wallpaper-option">
          <input type="checkbox" value="${weekday.key}" data-wallpaper-day${checked} />
          <span>${weekday.label}</span>
        </label>`;
      })
      .join("");

    els.wallpaperGrades.innerHTML = settings.subjects.length
      ? settings.subjects
          .map((subject) => {
            const grades = new Set(normalizedGrades(settings.grades[subject]));
            return `<div class="wallpaper-grade-row">
              <strong>${escapeHtml(subject)}</strong>
              <div>
                ${["1", "2", "3"]
                  .map((grade) => {
                    const checked = grades.has(grade) ? " checked" : "";
                    return `<label class="wallpaper-grade-option">
                      <input type="checkbox" value="${grade}" data-wallpaper-grade="${escapeHtml(subject)}"${checked} />
                      <span>${grade}학년</span>
                    </label>`;
                  })
                  .join("")}
              </div>
            </div>`;
          })
          .join("")
      : `<p class="empty">과목을 선택하면 학년 설정이 표시됩니다.</p>`;
  }

  function renderWallpaperAutomation(settings) {
    if (!settings.subjects.length) {
      els.wallpaperAutomation.innerHTML = `<article class="wallpaper-automation-card">
        <strong>단축어 자동화</strong>
        <p>과목을 선택하면 iPhone 단축어에 넣을 이미지 URL과 자동화 순서가 생성됩니다.</p>
      </article>`;
      return;
    }

    const url = wallpaperImageUrl(settings);
    const dayLabels = weekdays.filter((weekday) => settings.days.includes(weekday.key)).map((weekday) => weekday.label).join(", ");
    els.wallpaperAutomation.innerHTML = `<article class="wallpaper-automation-card is-ready">
      <div>
        <strong>단축어 자동화 생성됨</strong>
        <p>${escapeHtml(settings.subjects.join(", "))} · ${escapeHtml(dayLabels || "월, 화, 수, 목, 금")}</p>
      </div>
      <label class="wallpaper-url-field">
        <span>이미지 URL</span>
        <input value="${escapeHtml(url)}" readonly />
      </label>
      <div class="button-row" style="display: flex; flex-wrap: wrap; gap: 8px;">
        <button class="primary-button" data-setup-ios-shortcut type="button" style="background: linear-gradient(135deg, #a855f7, #7c3aed); border: none; color: white; font-weight: 800;">
          📱 iPhone 단축어 등록
        </button>
        <button class="ghost-button" data-copy-wallpaper-url type="button">URL 복사</button>
        <button class="ghost-button" data-download-wallpaper-automation type="button">설정 가이드 다운로드</button>
        <a class="ghost-button" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">이미지 열기</a>
      </div>
      <figure class="wallpaper-image-preview">
        <img src="${escapeHtml(url)}" alt="선택한 과목 배경화면 이미지 미리보기" loading="lazy" />
        <figcaption>단축어에서 가져갈 실제 이미지입니다.</figcaption>
      </figure>
      <ol style="margin-top: 14px;">
        <li>위의 <strong>[iPhone 단축어 등록]</strong> 버튼을 누르면 이미지 URL이 클립보드에 자동 복사되며 단축어 추가 화면이 열립니다.</li>
        <li style="color: #f59e0b; font-weight: 800; margin-top: 4px; margin-bottom: 4px;">⚠️ 매우 중요: 단축어를 추가한 후, 단축어 앱 내 편집 화면으로 진입하여 1번째 줄의 <code>\${YourLink}</code> 라고 써진 부분에 복사된 실제 URL을 꼭 [붙여넣기] 해주세요!</li>
        <li>등록을 마친 후, 아래 <strong>[iOS 자동화 설정 가이드]</strong> 버튼을 눌러 일출, 08:40, 14:00 시간에 자동 갱신되도록 예약하면 세팅이 끝납니다!</li>
        <li style="color: #94a3b8; font-size: 13px; margin-top: 4px;">(최초 1회 실행 시 배경화면 접근 권한을 '항상 허용'해 주시면 됩니다.)</li>
      </ol>
    </article>`;
  }

  function renderWallpaper() {
    const settings = wallpaperSettings();
    if (els.wallpaperName && document.activeElement !== els.wallpaperName) {
      els.wallpaperName.value = settings.name || "";
    }
    renderWallpaperControls(settings);
    renderWallpaperAutomation(settings);
    const selected = new Set(settings.subjects);
    const days = schoolDaysForCurrentWeek().filter((day) => settings.days.includes(day.weekday.key));
    const today = toISO(new Date());

    if (!selected.size) {
      els.wallpaperPreview.innerHTML = `<article class="wallpaper-empty">
        <p class="eyebrow">과목 선택 필요</p>
        <h3>강조할 과목을 선택하세요.</h3>
        <span>선택한 과목이 들어있는 수업만 요일별로 표시됩니다.</span>
      </article>`;
      return;
    }

    const subjectLabel = settings.subjects.join(", ");
    const headerCells = days
      .map((day) => `<div class="wallpaper-table-head${day.iso === today ? " is-today" : ""}">
        <strong>${day.weekday.label}</strong>
        <span>${formatDate(day.iso)}</span>
      </div>`)
      .join("");
    const tableRows = periods
      .map((period, periodIndex) => {
        const cells = days
          .map((day) => {
            const matches = classes.flatMap((className) => wallpaperMatchesForCell(day.iso, className, period, periodIndex, settings));
            const chips = matches
              .map((match) => `<span class="wallpaper-class-chip is-${match.type}">
                <strong>${escapeHtml(match.className)}</strong>
                <em>${escapeHtml(match.title)}</em>
                ${match.note ? `<small>${escapeHtml(match.note)}</small>` : ""}
              </span>`)
              .join("");
            return `<div class="wallpaper-table-cell">${chips}</div>`;
          })
          .join("");
        return `<div class="wallpaper-table-period">
          <strong>${period}교시</strong>
        </div>${cells}`;
      })
      .join("");

    els.wallpaperPreview.innerHTML = `<div class="wallpaper-phone-content">
      <header class="wallpaper-phone-head">
        <p>용정 시간표</p>
        <h3>내 과목 주간표</h3>
        <span>${escapeHtml(subjectLabel)}</span>
      </header>
      <div class="wallpaper-table" style="--wallpaper-day-count:${days.length}">
        <div class="wallpaper-table-corner">교시</div>
        ${headerCells}
        ${tableRows}
      </div>
    </div>`;
  }

  function renderView() {
    if (isBoardMode) {
      renderBoardView();
      return;
    }
    const days = schoolDaysForTwoWeeks();
    if (!selectedDate) {
      const today = toISO(new Date());
      selectedDate = days.some((day) => day.iso === today) ? today : days[0].iso;
    }
    const visibleClasses = els.viewClass.value === "all" ? classes : [els.viewClass.value || classes[0]];
    const today = toISO(new Date());
    els.todayLabel.textContent = `오늘: ${formatDate(today)} ${weekdayLabelForDate(today)}요일`;
    els.rangeLabel.textContent = `${formatDate(days[0].iso)} ${days[0].weekday.label} - ${formatDate(
      days[days.length - 1].iso
    )} ${days[days.length - 1].weekday.label}`;
    renderDayTabs(days);
    els.viewSchedule.innerHTML = renderScheduleGrid(selectedDate, visibleClasses);
  }

  async function fetchSlideshowMeal(force = false) {
    const now = Date.now();
    if (!force && mealDataCache && now - mealDataFetchedAt < 10 * 60 * 1000) {
      return mealDataCache;
    }
    if (isMealLoading) return mealDataCache;
    isMealLoading = true;
    try {
      const res = await fetch("/api/meal");
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          mealDataCache = data;
          mealDataFetchedAt = now;
          if (currentRoute === "slideshow") {
            renderSlideshow();
          }
        }
      }
    } catch (e) {
      console.warn("Failed to fetch school meal data:", e);
    } finally {
      isMealLoading = false;
    }
    return mealDataCache;
  }

  function renderMealCard() {
    if (!mealDataCache) {
      fetchSlideshowMeal();
      return `<div class="notice-meal-card">
        <div class="notice-meal-header">
          <h4>급식 식단</h4>
        </div>
        <div class="notice-meal-loading">
          <p>급식 정보 불러오는 중...</p>
        </div>
      </div>`;
    }

    const { mealTypeLabel, formattedDate, menu, calories } = mealDataCache;
    const hasMenu = Array.isArray(menu) && menu.length > 0;

    return `<div class="notice-meal-card">
      <div class="notice-meal-header">
        <h4>${escapeHtml(mealTypeLabel || "급식 식단")}</h4>
        ${formattedDate ? `<span class="notice-meal-date">${escapeHtml(formattedDate)}</span>` : ""}
      </div>
      ${
        hasMenu
          ? `<ul class="notice-meal-list">
              ${menu.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>`
          : `<div class="notice-meal-empty"><p>등록된 급식 식단이 없습니다.</p></div>`
      }
      ${calories ? `<div class="notice-meal-cal">${escapeHtml(calories)}</div>` : ""}
    </div>`;
  }

  function slideshowSlides() {
    const day = currentSchoolDay();
    const slides = [];

    if (day) {
      slides.push({
        type: "schedule",
        title: `${formatDate(day.iso)} ${day.weekday.label}요일 시간표`,
        meta: `${state.slideshow.intervalSeconds}초 전환 · ${state.slideshow.refreshSeconds || 60}초 새로고침`,
        html: renderScheduleGrid(day.iso, classes, "slideshow-grid"),
      });
    }

    const notices = state.notices.filter((notice) => notice.title || notice.body);
    const showMeal = state.slideshow && state.slideshow.showMeal !== false;

    notices.forEach((notice, index) => {
      slides.push({
        type: "notice",
        title: "안내사항",
        meta: `${index + 1} / ${notices.length}`,
        html: `<article class="notice-slide ${showMeal ? "has-meal" : "no-meal"}" style="--notice-title-size:${clamp(Number(notice.titleFontSize) || 72, 36, 120)}px;--notice-body-size:${clamp(Number(notice.detailFontSize) || 42, 24, 84)}px">
          <h3>${escapeHtml(notice.title)}</h3>
          <div class="notice-main-content">
            <div class="notice-body-text">
              <p>${escapeHtml(notice.body).replaceAll("\n", "<br />")}</p>
            </div>
            ${
              showMeal
                ? `<div class="notice-meal-container">
                    ${renderMealCard()}
                  </div>`
                : ""
            }
          </div>
        </article>`,
      });
    });

    if (slides.length) return slides;

    return [
      {
        type: "empty",
        title: "슬라이드쇼",
        meta: "표시할 내용 없음",
        html: `<article class="empty-slide">
          <h3>표시할 내용이 없습니다.</h3>
          <p>오늘 시간표 또는 안내사항이 등록되면 슬라이드쇼에 표시됩니다.</p>
        </article>`,
      },
    ];
  }

  function renderSlideshow() {
    const slides = slideshowSlides();
    slideshowIndex = clamp(slideshowIndex, 0, slides.length - 1);
    const slide = slides[slideshowIndex];
    els.slideshowTitle.textContent = slide.title;
    els.slideshowMeta.textContent = slide.meta;
    els.slideshowStage.innerHTML = slide.html;
  }

  function showSlideshowToast(message) {
    let toast = document.querySelector("#slideshowToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "slideshowToast";
      toast.className = "slideshow-toast";
      els.slideshowPage.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(slideshowToastTimer);
    slideshowToastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 1600);
  }

  function moveSlideshow(delta, manual = false) {
    const slides = slideshowSlides();
    if (slides.length <= 1) {
      if (manual) showSlideshowToast("이 페이지가 전부입니다.");
      slideshowIndex = 0;
      renderSlideshow();
      return;
    }

    slideshowIndex = (slideshowIndex + delta + slides.length) % slides.length;
    renderSlideshow();
  }

  function jumpSlideshow(index) {
    const slides = slideshowSlides();
    if (!slides.length) return;
    slideshowIndex = clamp(index, 0, slides.length - 1);
    renderSlideshow();
    startSlideshow();
  }

  function stopSlideshow() {
    if (slideshowTimer) {
      window.clearInterval(slideshowTimer);
      slideshowTimer = null;
    }
    if (slideshowRefreshTimer) {
      window.clearInterval(slideshowRefreshTimer);
      slideshowRefreshTimer = null;
    }
    window.clearTimeout(slideshowToastTimer);
  }

  function startSlideshow() {
    stopSlideshow();
    fetchSlideshowMeal();
    renderSlideshow();
    const seconds = Math.max(3, Number(state.slideshow.intervalSeconds) || 8);
    if (slideshowSlides().length > 1) {
      slideshowTimer = window.setInterval(() => {
        moveSlideshow(1);
      }, seconds * 1000);
    }

    const refreshSeconds = Math.max(10, Number(state.slideshow.refreshSeconds) || 60);
    slideshowRefreshTimer = window.setInterval(() => {
      refreshFromRemote({ keepNoticeSelection: true, restartSlideshow: false });
    }, refreshSeconds * 1000);
  }

  function renderBaseEditor() {
    const weekday = els.baseWeekday.value;
    const headerCells = classes
      .map((className, index) => {
        return `<div class="special-head" style="grid-column:${index + 2};grid-row:1">${escapeHtml(className)}</div>`;
      })
      .join("");
    const rows = periods
      .map((period, periodIndex) => {
        const inputs = classes
          .map((className, classIndex) => {
            const subjects = state.base[className][weekday] || [];
            return `<div class="special-input" style="grid-column:${classIndex + 2};grid-row:${periodIndex + 2}">
              <input data-base-class="${className}" data-period-index="${periodIndex}" type="text" value="${escapeHtml(subjects[periodIndex] || "")}" aria-label="${className} ${period}교시" />
            </div>`;
          })
          .join("");
        return `<div class="special-head" style="grid-column:1;grid-row:${periodIndex + 2}">${period}교시</div>${inputs}`;
      })
      .join("");
    els.baseEditor.innerHTML = `<div class="special-grid" style="--class-count:${classes.length}">
      <div class="special-head" style="grid-column:1;grid-row:1">교시</div>
      ${headerCells}
      ${rows}
    </div>`;
  }

  function renderSpecialDateHint() {
    if (!els.specialDate.value) {
      els.specialDateHint.textContent = "";
      return;
    }
    const weekendText = isWeekend(els.specialDate.value) ? "주말" : "평일";
    els.specialDateHint.textContent = `${formatDate(els.specialDate.value)} ${weekdayLabelForDate(
      els.specialDate.value
    )}요일 · ${weekendText}`;
  }

  function renderSpecialEditor() {
    const date = els.specialDate.value;
    const headerCells = classes
      .map((className, index) => {
        return `<div class="special-head" style="grid-column:${index + 2};grid-row:1">${escapeHtml(className)}</div>`;
      })
      .join("");
    const rows = periods
      .map((period, periodIndex) => {
        const inputs = classes
          .map((className, classIndex) => {
            const subjects = getSubjectsForDate(date, className);
            return `<div class="special-input" style="grid-column:${classIndex + 2};grid-row:${periodIndex + 2}">
              <input data-special-class="${className}" data-period-index="${periodIndex}" type="text" value="${escapeHtml(subjects[periodIndex] || "")}" aria-label="${className} ${period}교시" />
            </div>`;
          })
          .join("");
        return `<div class="special-head" style="grid-column:1;grid-row:${periodIndex + 2}">${period}교시</div>${inputs}`;
      })
      .join("");
    els.specialEditor.innerHTML = `<div class="special-grid" style="--class-count:${classes.length}">
      <div class="special-head" style="grid-column:1;grid-row:1">교시</div>
      ${headerCells}
      ${rows}
    </div>`;
  }

  function renderSpecialList() {
    const entries = Object.entries(state.specialSchedules)
      .map(([date, schedules]) => ({ date, classCount: Object.keys(schedules || {}).length }))
      .sort((a, b) => a.date.localeCompare(b.date));
    els.specialList.innerHTML = entries.length
      ? entries
          .map((item) => {
            return `<article class="list-item">
              <div>
                <strong>${item.date} ${weekdayLabelForDate(item.date)}요일</strong>
                <span>특별시간표 · ${item.classCount}개 학급</span>
              </div>
              <button class="text-button" data-load-special-date="${item.date}" type="button">불러오기</button>
            </article>`;
          })
          .join("")
      : `<p class="empty">등록된 특별시간표가 없습니다.</p>`;
  }

  function renderChangeDateHint() {
    if (!els.changeDate.value) {
      els.changeWeekdayHint.textContent = "";
      return;
    }
    const prefix = els.changeDate.value === toISO(new Date()) ? "오늘" : "선택 날짜";
    els.changeWeekdayHint.textContent = `${prefix}: ${formatDate(els.changeDate.value)} ${weekdayLabelForDate(
      els.changeDate.value
    )}요일`;
  }

  function renderChangeWeekdayFilter() {
    const options = [{ key: "all", label: "전체보기" }, ...weekdays.map((day) => ({ key: day.key, label: `${day.label}요일` }))];
    els.changeWeekdayFilter.innerHTML = options
      .map((option) => {
        const isSelected = option.key === changeFilterWeekday;
        const active = isSelected ? " is-active" : "";
        return `<button class="filter-tab${active}" data-change-weekday="${option.key}" role="tab" aria-selected="${isSelected}" type="button">${option.label}</button>`;
      })
      .join("");
  }

  function renderChangeList() {
    const entries = Object.entries(state.changes)
      .filter(([key]) => {
        if (changeFilterWeekday === "all") return true;
        const [date] = key.split("__");
        return weekdayForDate(date).key === changeFilterWeekday;
      })
      .sort(([a], [b]) => a.localeCompare(b));
    const emptyLabel =
      changeFilterWeekday === "all"
        ? "등록된 단일 변경이 없습니다."
        : `${weekdays.find((day) => day.key === changeFilterWeekday).label}요일 단일 변경이 없습니다.`;
    els.changeList.innerHTML = entries.length
      ? entries
          .map(([key, change]) => {
            const [date, className, period] = key.split("__");
            const weekdayLabel = weekdayLabelForDate(date);
            const originalSubject = getSubjectsForDate(date, className)[Number(period) - 1] || "-";
            const reason = change.memo ? escapeHtml(change.memo) : "없음";
            const typeLabel = isNewChange(change) ? "신설 변경" : "1:1 변경";
            const changeSummary = isNewChange(change)
              ? `신설 -> ${escapeHtml(change.subject)}`
              : `${escapeHtml(originalSubject)} -> ${escapeHtml(change.subject)}`;
            return `<article class="list-item">
              <div>
                <strong>일시: ${date} ${weekdayLabel}요일 · 학급: ${className} · 교시: ${period}교시 · ${typeLabel}</strong>
                <span>${changeSummary} · 사유: ${reason}</span>
              </div>
              <button class="text-button" data-revert-change="${escapeHtml(key)}" type="button">되돌리기</button>
            </article>`;
          })
          .join("")
      : `<p class="empty">${emptyLabel}</p>`;
  }

  function renderEventClassChecks() {
    els.eventClassChecks.innerHTML = classes
      .map((className) => {
        return `<label class="check-item">
          <input type="checkbox" value="${className}" checked />
          <span>${className}</span>
        </label>`;
      })
      .join("");
  }

  function renderBaseMergeClassChecks() {
    els.baseMergeClassChecks.innerHTML = classes
      .map((className) => {
        return `<label class="check-item">
          <input type="checkbox" value="${className}" checked />
          <span>${className}</span>
        </label>`;
      })
      .join("");
  }

  function renderBaseMergeList() {
    const weekdayLabels = Object.fromEntries(weekdays.map((day) => [day.key, day.label]));
    els.baseMergeList.innerHTML = state.baseMerges.length
      ? state.baseMerges
          .map((merge) => {
            return `<article class="list-item">
              <div>
                <strong>${weekdayLabels[merge.weekday] || merge.weekday} · ${escapeHtml(merge.title)}</strong>
                <span>${escapeHtml(merge.classes.join(", "))} · ${formatPeriodRange(merge.start, merge.end)}${merge.memo ? ` · ${escapeHtml(merge.memo)}` : ""}</span>
              </div>
              <button class="text-button" data-delete-base-merge="${merge.id}" type="button">삭제</button>
            </article>`;
          })
          .join("")
      : `<p class="empty">등록된 기본 병합이 없습니다.</p>`;
  }

  function renderEventList() {
    els.eventList.innerHTML = state.events.length
      ? state.events
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((event) => {
            const fontLabel = event.useCustomSlideFontScale === true
              ? ` · 슬라이드 글자 ${eventSlideFontScale(event)}%`
              : " · 슬라이드 글자 공통 설정";
            return `<article class="list-item event-list-item${event.id === selectedEventId ? " is-active" : ""}">
              <div>
                <strong>${event.date} · ${escapeHtml(event.title)}</strong>
                <span>${escapeHtml(event.classes.join(", "))} · ${formatPeriodRange(event.start, event.end)}${event.memo ? ` · ${escapeHtml(event.memo)}` : ""}${fontLabel}</span>
              </div>
              <div class="list-actions">
                <button class="text-button neutral" data-edit-event="${event.id}" type="button">수정</button>
                <button class="text-button" data-delete-event="${event.id}" type="button">삭제</button>
              </div>
            </article>`;
          })
          .join("")
      : `<p class="empty">등록된 행사가 없습니다.</p>`;
  }

  function syncEventCustomFontControls() {
    const enabled = Boolean(els.eventCustomFontEnabled && els.eventCustomFontEnabled.checked);
    const scale = clamp(Number(els.eventCustomFontScale && els.eventCustomFontScale.value) || 100, 70, 150);
    if (els.eventCustomFontControls) {
      els.eventCustomFontControls.classList.toggle("is-hidden", !enabled);
    }
    if (els.eventCustomFontScaleLabel) {
      els.eventCustomFontScaleLabel.textContent = `이 행사 ${scale}%`;
    }
  }

  function resetEventForm() {
    selectedEventId = "";
    els.eventTitle.value = "";
    els.eventMemo.value = "";
    els.eventCustomFontEnabled.checked = false;
    els.eventCustomFontScale.value = String(clamp(Number(state.slideshow && state.slideshow.eventFontScale) || 100, 70, 150));
    syncEventCustomFontControls();
    $$("#eventClassChecks input").forEach((input) => {
      input.checked = true;
    });
    els.saveEventButton.textContent = "행사 저장";
    els.cancelEventEditButton.classList.add("is-hidden");
    renderEventList();
  }

  function loadEventEditor(eventId) {
    const item = state.events.find((event) => event.id === eventId);
    if (!item) {
      showMessage(els.adminMessage, "수정할 행사를 찾을 수 없습니다.");
      return;
    }
    selectedEventId = item.id;
    els.eventDate.value = item.date;
    els.eventStart.value = String(item.start);
    els.eventEnd.value = String(item.end);
    els.eventTitle.value = item.title || "";
    els.eventMemo.value = item.memo || "";
    els.eventCustomFontEnabled.checked = item.useCustomSlideFontScale === true;
    els.eventCustomFontScale.value = String(eventSlideFontScale(item));
    syncEventCustomFontControls();
    $$("#eventClassChecks input").forEach((input) => {
      input.checked = item.classes.includes(input.value);
    });
    els.saveEventButton.textContent = "행사 수정 저장";
    els.cancelEventEditButton.classList.remove("is-hidden");
    renderEventList();
    showMessage(els.adminMessage, "행사 내용을 불러왔습니다. 수정 후 저장하세요.");
  }

  function renderNoticeList() {
    els.noticeList.innerHTML = state.notices.length
      ? state.notices
          .map((notice, index) => {
            return `<article class="list-item notice-list-item${notice.id === selectedNoticeId ? " is-active" : ""}" data-select-notice="${notice.id}">
              <div>
                <strong>${index + 1}페이지 · ${escapeHtml(notice.title || "제목 없음")}</strong>
                <span>${escapeHtml(notice.body)} · 제목 ${Number(notice.titleFontSize) || 72}px · 내용 ${Number(notice.detailFontSize) || 42}px</span>
              </div>
              <button class="text-button" data-delete-notice="${notice.id}" type="button">삭제</button>
            </article>`;
          })
          .join("")
      : `<p class="empty">등록된 안내사항이 없습니다.</p>`;
  }

  function loadNoticeEditor(noticeId) {
    selectedNoticeId = noticeId || "";
    const notice = state.notices.find((item) => item.id === selectedNoticeId);
    els.noticeTitle.value = notice ? notice.title : "";
    els.noticeBody.value = notice ? notice.body : "";
    els.noticeTitleFontSize.value = notice ? Number(notice.titleFontSize) || 72 : 72;
    els.noticeFontSize.value = notice ? Number(notice.detailFontSize) || 42 : 42;
    renderNoticeList();
    renderNoticePreview();
  }

  function renderNoticePreview() {
    const title = els.noticeTitle.value.trim() || "안내사항 제목";
    const body = els.noticeBody.value.trim() || "세부 내용 미리보기입니다.";
    const titleSize = clamp(Number(els.noticeTitleFontSize.value) || 72, 36, 120);
    const bodySize = clamp(Number(els.noticeFontSize.value) || 42, 24, 84);
    const lessonScale = clamp(Number(els.slideLessonFontScale.value) || 100, 70, 150);
    const classHeaderScale = clamp(Number(els.slideClassHeaderFontScale.value) || 100, 70, 170);
    const periodHeaderScale = clamp(Number(els.slidePeriodHeaderFontScale.value) || 100, 70, 170);
    els.slideLessonFontScaleLabel.textContent = `시간표 ${lessonScale}%`;
    els.slideClassHeaderFontScaleLabel.textContent = `학급 ${classHeaderScale}%`;
    els.slidePeriodHeaderFontScaleLabel.textContent = `교시 ${periodHeaderScale}%`;
    els.noticeTitleFontSizeLabel.textContent = `제목 ${titleSize}px`;
    els.noticeFontSizeLabel.textContent = `내용 ${bodySize}px`;
    els.noticePreview.innerHTML = `<article class="notice-preview-card" style="--notice-preview-title-size:${titleSize}px;--notice-preview-size:${bodySize}px">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(body).replaceAll("\n", "<br />")}</p>
    </article>`;
  }

  function roleLabel(role) {
    if (role === "dev") return "dev";
    if (role === "manager") return "manager";
    return "teacher";
  }

  function auditActionLabel(action) {
    const labels = {
      save_state: "전체 상태 저장",
      update_base: "기본 시간표 수정",
      update_base_merge: "기본 병합 수정",
      update_special: "특별시간표 수정",
      update_change: "단일교과 변경",
      update_event: "행사 변경",
      update_notice: "안내사항 수정",
      update_slide_runtime: "슬라이드쇼 설정",
      update_slide_typography: "슬라이드쇼 글자 크기",
      force_reload: "강제 새로고침",
      admin_account_create: "계정 생성",
      admin_account_update: "계정 수정",
      admin_account_deactivate: "계정 비활성화",
      api_key_create: "API key 발급",
      api_key_revoke: "API key 폐기",
    };
    return labels[action] || action || "unknown";
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function resetAccountForm() {
    selectedAdminAccountId = "";
    els.accountUsername.value = "";
    els.accountUsername.disabled = !canRole("manage_accounts");
    els.accountDisplayName.value = "";
    els.accountRole.value = "teacher";
    els.accountPassword.value = "";
    els.accountActive.checked = true;
    els.saveAccountButton.textContent = "계정 생성";
    renderAdminAccounts();
  }

  function loadAccountEditor(userId) {
    const account = adminAccounts.find((item) => item.user_id === userId);
    if (!account) return;
    selectedAdminAccountId = account.user_id;
    els.accountUsername.value = account.username || "";
    els.accountUsername.disabled = true;
    els.accountDisplayName.value = account.display_name || account.username || "";
    els.accountRole.value = account.role || "teacher";
    els.accountPassword.value = "";
    els.accountActive.checked = account.is_active === true;
    els.saveAccountButton.textContent = "계정 수정";
    renderAdminAccounts();
    applyAdminPermissions();
  }

  function renderAdminAccounts() {
    if (!els.accountList) return;
    if (adminAccountsLoading) {
      els.accountList.innerHTML = `<p class="empty">계정 정보를 불러오는 중입니다.</p>`;
      return;
    }
    if (!canRole("manage_accounts")) {
      els.accountList.innerHTML = `<p class="empty">계정 관리는 manager 이상 권한이 필요합니다.</p>`;
      return;
    }
    els.accountList.innerHTML = adminAccounts.length
      ? adminAccounts
          .map((account) => {
            const selected = account.user_id === selectedAdminAccountId ? " is-active" : "";
            const inactive = account.is_active ? "" : " is-disabled";
            const locked = account.role === "dev" && currentAdminRole() !== "dev";
            return `<article class="list-item${selected}${inactive}">
              <div>
                <strong>${escapeHtml(account.display_name || account.username)}</strong>
                <span>${escapeHtml(account.username)} · ${account.is_active ? "활성" : "비활성"} · 수정 ${formatDateTime(account.updated_at)}</span>
                <span class="role-badge is-${escapeHtml(account.role || "teacher")}">${roleLabel(account.role)}</span>
              </div>
              <div class="list-actions">
                <button class="text-button neutral" data-select-account="${escapeHtml(account.user_id)}" type="button"${
                  locked ? " disabled" : ""
                }>수정</button>
              </div>
            </article>`;
          })
          .join("")
      : `<p class="empty">등록된 관리자 계정이 없습니다.</p>`;
    applyAdminPermissions();
  }

  function renderApiKeys() {
    if (!els.apiKeyList) return;
    if (apiKeysLoading) {
      els.apiKeyList.innerHTML = `<p class="empty">API key를 불러오는 중입니다.</p>`;
      return;
    }
    if (!canRole("manage_api_keys")) {
      els.apiKeyList.innerHTML = `<p class="empty">API key 관리는 dev 권한이 필요합니다.</p>`;
      return;
    }
    els.apiKeyList.innerHTML = apiKeys.length
      ? apiKeys
          .map((key) => {
            const revoked = Boolean(key.revokedAt);
            const expired = key.expiresAt && new Date(key.expiresAt) <= new Date();
            const status = revoked ? "폐기" : expired ? "만료" : "사용 가능";
            const application = key.application;
            return `<article class="list-item${revoked || expired ? " is-disabled" : ""}">
              <div>
                <strong>${escapeHtml(key.name)}</strong>
                <span>yj_live_${escapeHtml(key.keyPrefix)}_… · ${status} · 분당 ${Number(key.rateLimitPerMinute)}회</span>
                ${application ? `<span>이메일 인증 신청 · ${escapeHtml(application.email)} · ${escapeHtml(application.phone)}</span>` : `<span>dev 직접 발급</span>`}
                <span>요청 ${Number(key.requestCount || 0).toLocaleString()}회 · 마지막 사용 ${formatDateTime(key.lastUsedAt)} · 만료 ${formatDateTime(key.expiresAt)}</span>
              </div>
              ${revoked || expired ? "" : `<button class="danger-button" data-revoke-api-key="${escapeHtml(key.id)}" type="button">폐기</button>`}
            </article>`;
          })
          .join("")
      : `<p class="empty">발급된 API key가 없습니다.</p>`;
    applyAdminPermissions();
  }

  async function refreshApiKeys() {
    if (!isLoggedIn() || !apiKeysRequest || !canRole("manage_api_keys")) return;
    apiKeysLoading = true;
    renderApiKeys();
    const result = await apiKeysRequest({ action: "list" });
    apiKeysLoading = false;
    if (!result || !result.ok) {
      renderApiKeys();
      showMessage(els.adminMessage, `API key 목록 실패: ${friendlyRemoteError(result && result.error)}`);
      return;
    }
    apiKeys = Array.isArray(result.keys) ? result.keys : [];
    renderApiKeys();
  }

  function renderAuditLogs() {
    if (!els.auditLogList) return;
    if (!canRole("read_audit_logs")) {
      els.auditLogList.innerHTML = `<p class="empty">감사 로그는 로그인 후 확인할 수 있습니다.</p>`;
      return;
    }
    els.auditLogList.innerHTML = auditLogs.length
      ? auditLogs
          .map((log) => {
            const actor = log.actor_username || "unknown";
            const status = log.success === false ? "실패" : "성공";
            const actorName = log.actor_name && log.actor_name !== actor ? ` · ${log.actor_name}` : "";
            return `<article class="audit-log-item${log.success === false ? " is-failed" : ""}">
              <div class="audit-log-main">
                <strong>${escapeHtml(auditActionLabel(log.action))}</strong>
                <span class="audit-status">${status}</span>
              </div>
              <div class="audit-actor">
                <span class="audit-actor-label">작업 계정</span>
                <strong>${escapeHtml(actor)}${escapeHtml(actorName)}</strong>
                ${log.actor_role ? `<span class="role-badge is-${escapeHtml(log.actor_role)}">${escapeHtml(log.actor_role)}</span>` : ""}
              </div>
              <span>${formatDateTime(log.created_at)}</span>
              <span>${escapeHtml(log.action || "unknown")} · ${escapeHtml(log.target_type || "-")}${log.target_id ? ` · ${escapeHtml(log.target_id)}` : ""}${
                log.error_message ? ` · ${escapeHtml(log.error_message)}` : ""
              }</span>
            </article>`;
          })
          .join("")
      : `<p class="empty">감사 로그가 없습니다.</p>`;
  }

  async function refreshAdminAccounts() {
    if (!isLoggedIn() || !adminAccountsRequest) return;
    adminAccountsLoading = true;
    renderAdminAccounts();
    renderApiKeys();
    const result = await adminAccountsRequest({ action: "list" });
    adminAccountsLoading = false;
    if (result && result.ok) {
      adminAccounts = Array.isArray(result.accounts) ? result.accounts : [];
      auditLogs = Array.isArray(result.auditLogs) ? result.auditLogs : [];
      if (selectedAdminAccountId && !adminAccounts.some((account) => account.user_id === selectedAdminAccountId)) {
        selectedAdminAccountId = "";
      }
      renderAdminAccounts();
      renderAuditLogs();
      applyAdminPermissions();
      return;
    }
    renderAdminAccounts();
    renderAuditLogs();
    showMessage(els.adminMessage, `계정 정보를 불러오지 못했습니다: ${friendlyRemoteError(result && result.error)}`);
  }

  function renderSlideScheduleDateOptions() {
    const today = toISO(new Date());
    if (state.slideshow.scheduleDateExpiresOn && today >= state.slideshow.scheduleDateExpiresOn) {
      state.slideshow.scheduleDate = "";
      state.slideshow.scheduleDateExpiresOn = "";
    }
    const days = schoolDaysForTwoWeeks();
    const selectedDate = state.slideshow.scheduleDate || "";
    const selectedDateExists = !selectedDate || days.some((day) => day.iso === selectedDate);
    const extraOption = selectedDate && !selectedDateExists
      ? `<option value="${escapeHtml(selectedDate)}">${formatDate(selectedDate)} ${weekdayLabelForDate(selectedDate)}요일 · 선택됨</option>`
      : "";
    els.slideScheduleDate.innerHTML = `<option value="">자동: 18시 이후 다음 학교일</option>${extraOption}${days
      .map((day) => {
        const label = `${formatDate(day.iso)} ${day.weekday.label}요일 · ${day.weekLabel}`;
        return `<option value="${escapeHtml(day.iso)}">${escapeHtml(label)}</option>`;
      })
      .join("")}`;
    els.slideScheduleDate.value = selectedDateExists ? selectedDate : selectedDate;
  }

  function renderAdmin() {
    updateLastSaveStatus();
    renderBaseEditor();
    renderSpecialDateHint();
    renderSpecialEditor();
    renderSpecialList();
    renderBaseMergeList();
    renderChangeDateHint();
    renderChangeWeekdayFilter();
    renderChangeList();
    renderEventList();
    renderNoticeList();
    renderSlideScheduleDateOptions();
    els.slideInterval.value = state.slideshow.intervalSeconds;
    els.slideRefreshInterval.value = state.slideshow.refreshSeconds || 60;
    if (els.slideShowMeal) {
      els.slideShowMeal.value = state.slideshow.showMeal !== false ? "true" : "false";
    }
    els.slideLessonFontScale.value = clamp(Number(state.slideshow && state.slideshow.lessonFontScale) || 100, 70, 150);
    els.slideClassHeaderFontScale.value = clamp(Number(state.slideshow && state.slideshow.classHeaderFontScale) || 100, 70, 170);
    els.slidePeriodHeaderFontScale.value = clamp(Number(state.slideshow && state.slideshow.periodHeaderFontScale) || 100, 70, 170);
    els.slideEventFontScale.value = clamp(Number(state.slideshow && state.slideshow.eventFontScale) || 100, 70, 150);
    els.slideEventFontScaleLabel.textContent = `행사 ${els.slideEventFontScale.value}%`;
    renderNoticePreview();
    renderAdminAccounts();
    renderAuditLogs();
    applyAdminPermissions();
  }

  function cleanupExpiredScheduleData() {
    const cutoffDate = toISO(mondayOf(new Date()));
    let changed = false;

    Object.keys(state.specialSchedules || {}).forEach((date) => {
      if (date < cutoffDate) {
        delete state.specialSchedules[date];
        changed = true;
      }
    });

    Object.keys(state.changes).forEach((key) => {
      const [date] = key.split("__");
      if (date < cutoffDate) {
        delete state.changes[key];
        changed = true;
      }
    });

    const nextEvents = state.events.filter((event) => event.date >= cutoffDate);
    if (nextEvents.length !== state.events.length) {
      state.events = nextEvents;
      changed = true;
    }

    return changed;
  }

  function canPersistAdminCleanup() {
    return isLoggedIn();
  }

  function applyRemoteState(remoteState, options = {}) {
    const { keepNoticeSelection = false, restartSlideshow = true } = options;
    const previousSlideSeconds = Number(state.slideshow.intervalSeconds) || 8;
    const previousRefreshSeconds = Number(state.slideshow.refreshSeconds) || 60;
    const previousReloadToken = state.slideshow && state.slideshow.reloadToken ? String(state.slideshow.reloadToken) : "";
    const nextReloadToken =
      remoteState.slideshow && remoteState.slideshow.reloadToken ? String(remoteState.slideshow.reloadToken) : "";
    state = remoteState;
    const nextSlideSeconds = Number(state.slideshow.intervalSeconds) || 8;
    const nextRefreshSeconds = Number(state.slideshow.refreshSeconds) || 60;
    if (currentRoute === "slideshow" && nextReloadToken && nextReloadToken !== previousReloadToken) {
      window.location.reload();
      return;
    }
    if (!keepNoticeSelection || !state.notices.some((notice) => notice.id === selectedNoticeId)) {
      selectedNoticeId = state.notices[0] ? state.notices[0].id : "";
    }
    const cleanedExpiredData = canPersistAdminCleanup() && cleanupExpiredScheduleData();
    renderView();
    if (currentRoute === "wallpaper") {
      renderWallpaper();
    }
    renderAdmin();
    if (currentRoute === "slideshow") {
      const slideshowTimingChanged =
        previousSlideSeconds !== nextSlideSeconds || previousRefreshSeconds !== nextRefreshSeconds;
      if (restartSlideshow || slideshowTimingChanged) {
        startSlideshow();
      } else {
        renderSlideshow();
      }
    }
    if (cleanedExpiredData) {
      write(state, "save_state").then((result) => {
        if (result && result.ok === false) {
          console.warn("Expired schedule cleanup failed:", result.error || "unknown error");
        }
      });
    }
  }

  async function refreshFromRemote(options = {}) {
    try {
      const remoteState = await readRemote();
      clearGlobalStatus();
      applyRemoteState(remoteState, options);
    } catch (error) {
      showGlobalError(
        `Supabase 연결 실패: 브라우저에 저장된 시간표를 계속 표시합니다. ${friendlyRemoteError(error)}`
      );
    }
  }

  function startRemoteSync() {
    if (!shouldUseRemoteSync() || remoteUnsubscribe || typeof subscribeRemoteChanges !== "function") return;
    remoteUnsubscribe = subscribeRemoteChanges((remoteState) => {
      applyRemoteState(remoteState, { keepNoticeSelection: true, restartSlideshow: false });
    });
  }

  function stopRemoteSync() {
    if (!remoteUnsubscribe) return;
    remoteUnsubscribe();
    remoteUnsubscribe = null;
  }

  function shouldUseRemoteSync() {
    return isBoardMode || currentRoute === "slideshow";
  }

  function syncRemoteForRoute() {
    if (shouldUseRemoteSync()) {
      startRemoteSync();
    } else {
      stopRemoteSync();
    }
  }

  function confirmAction(message) {
    return window.confirm(message);
  }

  function showGlobalStatus(message, type = "info", options = {}) {
    let statusBox = document.querySelector("#globalStatus");
    if (!statusBox) {
      statusBox = document.createElement("div");
      statusBox.id = "globalStatus";
      document.body.prepend(statusBox);
    }
    window.clearTimeout(globalStatusTimer);
    statusBox.className = `global-status is-${type}`;
    statusBox.textContent = message;

    if (options.retry) {
      const retryButton = document.createElement("button");
      retryButton.type = "button";
      retryButton.dataset.retrySave = "true";
      retryButton.textContent = "다시 저장";
      statusBox.appendChild(retryButton);
    }
    if (options.autoHide) {
      globalStatusTimer = window.setTimeout(() => {
        statusBox.remove();
      }, options.duration || 2400);
    }
  }

  function showGlobalError(message, options = {}) {
    showGlobalStatus(message, "error", options);
  }

  function clearGlobalStatus() {
    const statusBox = document.querySelector("#globalStatus");
    if (statusBox) {
      statusBox.remove();
    }
    window.clearTimeout(globalStatusTimer);
  }

  async function saveState(message, action = "save_state") {
    pendingRetryMessage = message;
    pendingRetryAction = action;
    updateLastSaveStatus("saving");
    const resultPromise = write(state, action);
    renderView();
    if (currentRoute === "wallpaper") {
      renderWallpaper();
    }
    renderAdmin();
    updateLastSaveStatus("saving");
    if (currentRoute === "slideshow") {
      startSlideshow();
    }

    const result = await resultPromise;
    if (result && result.ok === false) {
      const detail = friendlyRemoteError(result.error);
      updateLastSaveStatus("error");
      showGlobalError(`원격 저장 실패: 이 브라우저 화면에는 반영됐지만 다른 기기에는 아직 공유되지 않았습니다. ${detail}`, {
        retry: true,
      });
      showMessage(els.adminMessage, `브라우저에는 반영됨 · 원격 저장 실패: ${detail}`);
      return;
    }
    pendingRetryMessage = "";
    pendingRetryAction = "save_state";
    markLastSaveSuccess();
    showGlobalStatus(message, "success", { autoHide: true });
    showMessage(els.adminMessage, `${message} · ${isSupabaseEnabled && isSupabaseEnabled() ? "원격 동기화 완료" : "이 브라우저에 저장됨"}`);
  }

  function retrySaveState() {
    if (!pendingRetryMessage) return;
    showGlobalStatus("Supabase에 다시 저장하는 중입니다.", "info");
    showMessage(els.adminMessage, "Supabase에 다시 저장하는 중입니다.");
    saveState(pendingRetryMessage, pendingRetryAction);
  }

  function readWallpaperControls() {
    const name = els.wallpaperName ? els.wallpaperName.value.trim() : "";
    const subjects = $$("input[data-wallpaper-subject]:checked").map((input) => input.value);
    const days = $$("input[data-wallpaper-day]:checked").map((input) => input.value);
    const previous = wallpaperSettings();
    const grades = Object.fromEntries(
      subjects.map((subject) => {
        const checkedGrades = $$(`input[data-wallpaper-grade="${CSS.escape(subject)}"]:checked`).map((input) => input.value);
        return [subject, checkedGrades.length ? checkedGrades : normalizedGrades(previous.grades[subject])];
      })
    );
    return { name, subjects, days, grades };
  }

  function initControls() {
    // 안드로이드 앱 모드인 경우 이름 입력 필드 숨기기
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("app") === "true") {
      document.body.classList.add("is-app-mode");
      const nameInput = document.getElementById("wallpaperName");
      if (nameInput) {
        const parentGroup = nameInput.closest(".wallpaper-tool-group");
        if (parentGroup) {
          parentGroup.style.display = "none";
        }
      }
    }

    fillSelect(els.viewClass, isBoardMode ? classes : ["all", ...classes], (value) => (value === "all" ? "전체 학급" : value));
    fillSelect(els.changeClass, classes);
    fillSelect(els.baseWeekday, weekdays.map((day) => day.key), (key) => weekdays.find((day) => day.key === key).label);
    fillSelect(els.changePeriod, periods, (period) => `${period}교시`);
    fillSelect(els.baseMergeStart, periods, (period) => `${period}교시`);
    fillSelect(els.baseMergeEnd, periods, (period) => `${period}교시`);
    fillSelect(els.eventStart, periods, (period) => `${period}교시`);
    fillSelect(els.eventEnd, periods, (period) => `${period}교시`);

    const today = toISO(new Date());
    if (isBoardMode) {
      const savedBoardClass = localStorage.getItem("board-class");
      els.viewClass.value = classes.includes(savedBoardClass) ? savedBoardClass : classes[0];
    }
    els.changeDate.value = today;
    els.changeType.value = "swap";
    changeFilterWeekday = weekdayForDate(today).key;
    els.specialDate.value = today;
    els.eventDate.value = today;
    els.baseMergeStart.value = "1";
    els.baseMergeEnd.value = "2";
    els.eventStart.value = "7";
    els.eventEnd.value = "9";
    els.slideInterval.value = state.slideshow.intervalSeconds;
    els.slideRefreshInterval.value = state.slideshow.refreshSeconds || 60;
    els.slideLessonFontScale.value = clamp(Number(state.slideshow && state.slideshow.lessonFontScale) || 100, 70, 150);
    els.slideClassHeaderFontScale.value = clamp(Number(state.slideshow && state.slideshow.classHeaderFontScale) || 100, 70, 170);
    els.slidePeriodHeaderFontScale.value = clamp(Number(state.slideshow && state.slideshow.periodHeaderFontScale) || 100, 70, 170);
    els.slideEventFontScale.value = clamp(Number(state.slideshow && state.slideshow.eventFontScale) || 100, 70, 150);
    els.slideEventFontScaleLabel.textContent = `행사 ${els.slideEventFontScale.value}%`;
    els.eventCustomFontScale.value = String(els.slideEventFontScale.value);
    syncEventCustomFontControls();
    els.noticeTitleFontSize.value = "72";
    els.noticeFontSize.value = "42";
    renderChangeDateHint();
    renderChangeWeekdayFilter();
    renderSpecialDateHint();
    renderBaseMergeClassChecks();
    renderEventClassChecks();
    loadNoticeEditor(selectedNoticeId);
  }

  function bindEvents() {
    $$("[data-route]").forEach((button) => {
      button.addEventListener("click", () => {
        routeTo(button.dataset.route, { fullscreen: button.dataset.route === "slideshow" });
        refreshAdminAuth();
      });
    });

    els.homeButton.addEventListener("click", () => {
      goHome();
      mainEggLogoClicks += 1;
      window.clearTimeout(mainEggResetTimer);
      mainEggResetTimer = window.setTimeout(() => {
        mainEggLogoClicks = 0;
      }, 1400);
      if (mainEggLogoClicks < 5) return;
      mainEggLogoClicks = 0;
      els.homeButton.classList.add("is-egg-highlight");
      showMainEggToast("용정 시간표 상태: 정상 운영 중");
      window.setTimeout(() => {
        els.homeButton.classList.remove("is-egg-highlight");
      }, 2200);
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-retry-save]")) return;
      retrySaveState();
    });
    document.addEventListener("click", async (event) => {
      if (!event.target.closest("[data-copy-wallpaper-url]")) return;
      const input = els.wallpaperAutomation.querySelector(".wallpaper-url-field input");
      if (!input) return;
      input.select();
      try {
        await navigator.clipboard.writeText(input.value);
        showGlobalStatus("단축어 이미지 URL을 복사했습니다.", "success", { autoHide: true });
      } catch {
        document.execCommand("copy");
        showGlobalStatus("단축어 이미지 URL을 복사했습니다.", "success", { autoHide: true });
      }
    });
    document.addEventListener("click", async (event) => {
      if (!event.target.closest("[data-setup-ios-shortcut]")) return;
      const input = els.wallpaperAutomation.querySelector(".wallpaper-url-field input");
      if (!input) return;
      
      // 고유 PNG 이미지 URL 클립보드 강제 자동 복사
      try {
        await navigator.clipboard.writeText(input.value);
      } catch {
        input.select();
        document.execCommand("copy");
      }
      
      showGlobalStatus("단축어 이미지 URL이 자동 복사되었습니다! 1초 뒤 단축어 앱으로 이동합니다.", "success", { autoHide: true });
      
      setTimeout(() => {
        window.open("https://www.icloud.com/shortcuts/9cdf31ace36745b88f88af68c18f55a8", "_blank");
      }, 1000);
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-download-wallpaper-automation]")) return;
      const settings = wallpaperSettings();
      if (!settings.subjects.length) {
        showGlobalError("과목을 먼저 선택하세요.", { autoHide: true });
        return;
      }
      downloadWallpaperAutomation(settings);
      showGlobalStatus("단축어 설정 파일을 다운로드했습니다.", "success", { autoHide: true });
    });
    document.addEventListener("keydown", (event) => {
      if (event.target && ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(event.target.tagName)) return;
      if (!event.ctrlKey && !event.metaKey && !event.altKey && currentRoute === "view") {
        const key = event.key.toLowerCase();
        if (key.length === 1) {
          mainEggSequence = (mainEggSequence + key).slice(-2);
          if (mainEggSequence === "yj") {
            showMainEggToast("YJ route 확인 완료");
            els.homeButton.classList.add("is-egg-highlight");
            window.setTimeout(() => {
              els.homeButton.classList.remove("is-egg-highlight");
            }, 1800);
          }
        }
      }
      if (currentRoute !== "slideshow") return;
      if (event.key === "Escape") {
        event.preventDefault();
        routeTo("view");
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        jumpSlideshow(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        jumpSlideshow(slideshowSlides().length - 1);
        return;
      }
      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        jumpSlideshow(Number(event.key) - 1);
        return;
      }
      if (["ArrowRight", "ArrowDown", "PageDown", "Enter", " ", "n", "N"].includes(event.key)) {
        event.preventDefault();
        moveSlideshow(1, true);
        startSlideshow();
        return;
      }
      if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "p", "P"].includes(event.key)) {
        event.preventDefault();
        moveSlideshow(-1, true);
        startSlideshow();
      }
    });
    window.addEventListener("popstate", () => {
      routeTo(routeFromPath(), { replace: true });
      refreshAdminAuth();
    });

    els.dayTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-date]");
      if (!button) return;
      selectedDate = button.dataset.date;
      renderView();
    });

    els.todayLabel.addEventListener("click", () => {
      if (currentRoute !== "view") return;
      mainEggTodayClicks += 1;
      window.clearTimeout(mainEggResetTimer);
      mainEggResetTimer = window.setTimeout(() => {
        mainEggTodayClicks = 0;
      }, 1400);
      if (mainEggTodayClicks < 3) return;
      mainEggTodayClicks = 0;
      els.todayLabel.classList.add("is-egg-highlight");
      showMainEggToast("오늘도 시간표 확인 완료");
      window.setTimeout(() => {
        els.todayLabel.classList.remove("is-egg-highlight");
      }, 2200);
    });

    els.viewClass.addEventListener("change", () => {
      if (isBoardMode) {
        localStorage.setItem("board-class", els.viewClass.value);
      }
      renderView();
    });
    if (els.boardThemeButton) {
      els.boardThemeButton.addEventListener("click", () => {
        applyBoardTheme(boardTheme() === "light" ? "dark" : "light");
      });
    }
    els.exitSlideshowButton.addEventListener("click", () => {
      routeTo("view");
    });
    if (els.wallpaperName) {
      els.wallpaperName.addEventListener("input", () => {
        const settings = readWallpaperControls();
        saveWallpaperSettings(settings.subjects, settings.days, settings.grades, settings.name);
        renderWallpaper();
      });
    }
    els.wallpaperSubjects.addEventListener("change", () => {
      const settings = readWallpaperControls();
      saveWallpaperSettings(settings.subjects, settings.days, settings.grades, settings.name);
      renderWallpaper();
    });
    els.wallpaperDays.addEventListener("change", () => {
      const settings = readWallpaperControls();
      saveWallpaperSettings(settings.subjects, settings.days, settings.grades, settings.name);
      renderWallpaper();
    });
    els.wallpaperGrades.addEventListener("change", () => {
      const settings = readWallpaperControls();
      saveWallpaperSettings(settings.subjects, settings.days, settings.grades, settings.name);
      renderWallpaper();
    });
    els.baseWeekday.addEventListener("change", renderBaseEditor);
    els.specialDate.addEventListener("change", () => {
      renderSpecialDateHint();
      renderSpecialEditor();
    });
    els.changeDate.addEventListener("change", () => {
      renderChangeDateHint();
      if (!els.changeDate.value) return;
      changeFilterWeekday = weekdayForDate(els.changeDate.value).key;
      renderChangeWeekdayFilter();
      renderChangeList();
    });
    els.changeWeekdayFilter.addEventListener("click", (event) => {
      const button = event.target.closest("[data-change-weekday]");
      if (!button) return;
      changeFilterWeekday = button.dataset.changeWeekday;
      renderChangeWeekdayFilter();
      renderChangeList();
    });

    els.eventCustomFontEnabled.addEventListener("change", () => {
      if (!canRole("update_slide_typography")) {
        const selectedEvent = state.events.find((item) => item.id === selectedEventId);
        els.eventCustomFontEnabled.checked = Boolean(selectedEvent && selectedEvent.useCustomSlideFontScale === true);
        showMessage(els.adminMessage, "행사별 글자 크기는 manager 이상만 수정할 수 있습니다.");
      }
      syncEventCustomFontControls();
    });

    els.eventCustomFontScale.addEventListener("input", syncEventCustomFontControls);

    els.loginButton.addEventListener("click", async () => {
      const result = await verifyAdminPassword(els.adminUsername.value, els.adminPassword.value);
      if (result.ok) {
        sessionStorage.setItem("timetable-admin", "true");
        els.adminPassword.value = "";
        refreshAdminAuth();
        if (cleanupExpiredScheduleData()) {
          saveState("지난 특별시간표/수업교체/행사를 자동 정리했습니다.", "save_state");
        } else {
          renderAdmin();
        }
        return;
      }
      showMessage(els.loginMessage, result.error ? friendlyRemoteError(result.error) : "아이디 또는 비밀번호가 올바르지 않습니다.");
    });

    els.adminPassword.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      els.loginButton.click();
    });

    els.adminUsername.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      els.loginButton.click();
    });

    els.logoutButton.addEventListener("click", () => {
      sessionStorage.removeItem("timetable-admin");
      clearAdminPassword();
      refreshAdminAuth();
    });

    $$(".admin-tab").forEach((button) => {
      button.addEventListener("click", () => {
        selectAdminTab(button.dataset.adminTab);
        if (button.dataset.adminTab === "accounts" || button.dataset.adminTab === "auditLogs") {
          refreshAdminAccounts();
        }
        if (button.dataset.adminTab === "apiKeys") refreshApiKeys();
      });
    });

    els.refreshApiKeysButton.addEventListener("click", refreshApiKeys);

    els.apiApplyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setControlDisabled(els.sendApiCodeButton, true);
      els.sendApiCodeButton.textContent = "보내는 중...";
      showMessage(els.apiApplyMessage, "인증 메일을 보내고 있습니다.");
      const result = await apiApplicationRequest({
        action: "requestCode",
        application: {
          name: els.apiApplyName.value,
          email: els.apiApplyEmail.value,
          phone: els.apiApplyPhone.value,
        },
      });
      setControlDisabled(els.sendApiCodeButton, false);
      els.sendApiCodeButton.textContent = "인증번호 받기";
      if (!result || !result.ok) {
        showMessage(els.apiApplyMessage, `신청 실패: ${friendlyRemoteError(result && result.error)}`);
        return;
      }
      apiApplicationRequestId = result.requestId;
      apiApplicationEmail = els.apiApplyEmail.value.trim().toLowerCase();
      els.apiVerifyEmail.textContent = apiApplicationEmail;
      els.apiVerificationCode.value = "";
      els.apiVerifyForm.classList.remove("is-hidden");
      els.publicApiKeyValue.textContent = "";
      els.publicApiKeyResult.classList.add("is-hidden");
      showMessage(els.apiApplyMessage, "인증번호를 보냈습니다. 메일함을 확인하세요.");
      els.apiVerificationCode.focus();
    });

    els.apiVerifyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!apiApplicationRequestId || !apiApplicationEmail) return;
      setControlDisabled(els.verifyApiCodeButton, true);
      els.verifyApiCodeButton.textContent = "확인 중...";
      showMessage(els.apiVerifyMessage, "인증번호를 확인하고 있습니다.");
      const result = await apiApplicationRequest({
        action: "verifyCode",
        requestId: apiApplicationRequestId,
        email: apiApplicationEmail,
        code: els.apiVerificationCode.value,
      });
      setControlDisabled(els.verifyApiCodeButton, false);
      els.verifyApiCodeButton.textContent = "인증하고 key 발급";
      if (!result || !result.ok) {
        showMessage(els.apiVerifyMessage, `인증 실패: ${friendlyRemoteError(result && result.error)}`);
        return;
      }
      els.publicApiKeyValue.textContent = result.apiKey;
      els.publicApiKeyResult.classList.remove("is-hidden");
      els.apiVerifyForm.classList.add("is-hidden");
      showMessage(els.apiApplyMessage, "이메일 인증과 API key 발급이 완료되었습니다.");
      showGlobalStatus("API key를 발급했습니다. 지금 복사하세요.", "success", { autoHide: true });
    });

    els.copyPublicApiKeyButton.addEventListener("click", async () => {
      const value = els.publicApiKeyValue.textContent;
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        showGlobalStatus("API key를 복사했습니다.", "success", { autoHide: true });
      } catch {
        showGlobalError("복사 권한이 차단되었습니다. key를 직접 선택해 복사하세요.", { autoHide: true });
      }
    });

    els.createApiKeyButton.addEventListener("click", async () => {
      if (!ensurePermission("manage_api_keys", "API key 관리")) return;
      const name = els.apiKeyName.value.trim();
      const rateLimitPerMinute = Number(els.apiKeyRateLimit.value);
      if (name.length < 2) {
        showMessage(els.adminMessage, "사용처 이름을 2자 이상 입력하세요.");
        return;
      }
      if (!Number.isInteger(rateLimitPerMinute) || rateLimitPerMinute < 1 || rateLimitPerMinute > 1000) {
        showMessage(els.adminMessage, "분당 요청 한도는 1~1000 사이 정수로 입력하세요.");
        return;
      }
      setControlDisabled(els.createApiKeyButton, true);
      const result = await apiKeysRequest({
        action: "create",
        name,
        rateLimitPerMinute,
        expiresOn: els.apiKeyExpiresOn.value || undefined,
      });
      setControlDisabled(els.createApiKeyButton, false);
      if (!result || !result.ok) {
        showMessage(els.adminMessage, `API key 발급 실패: ${friendlyRemoteError(result && result.error)}`);
        return;
      }
      els.newApiKeyValue.textContent = result.apiKey;
      els.apiKeyResult.classList.remove("is-hidden");
      els.apiKeyName.value = "";
      showGlobalStatus("API key를 발급했습니다. 지금 복사하세요.", "success", { autoHide: true });
      refreshApiKeys();
    });

    els.copyApiKeyButton.addEventListener("click", async () => {
      const value = els.newApiKeyValue.textContent;
      if (!value) return;
      await navigator.clipboard.writeText(value);
      showMessage(els.adminMessage, "API key를 복사했습니다.");
    });

    els.apiKeyList.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-revoke-api-key]");
      if (!button || !ensurePermission("manage_api_keys", "API key 관리")) return;
      const key = apiKeys.find((item) => item.id === button.dataset.revokeApiKey);
      if (!key || !confirmAction(`${key.name} API key를 폐기할까요? 폐기 후 복구할 수 없습니다.`)) return;
      setControlDisabled(button, true);
      const result = await apiKeysRequest({ action: "revoke", id: key.id });
      if (!result || !result.ok) {
        showMessage(els.adminMessage, `API key 폐기 실패: ${friendlyRemoteError(result && result.error)}`);
        setControlDisabled(button, false);
        return;
      }
      if (els.newApiKeyValue.textContent.includes(`yj_live_${key.keyPrefix}_`)) {
        els.newApiKeyValue.textContent = "";
        els.apiKeyResult.classList.add("is-hidden");
      }
      showGlobalStatus("API key를 폐기했습니다.", "success", { autoHide: true });
      refreshApiKeys();
    });

    els.refreshAuditLogsButton.addEventListener("click", () => {
      refreshAdminAccounts();
      showMessage(els.adminMessage, "감사 로그를 새로고침했습니다.");
    });

    els.accountList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-select-account]");
      if (!button) return;
      loadAccountEditor(button.dataset.selectAccount);
    });

    els.newAccountButton.addEventListener("click", () => {
      if (!ensurePermission("manage_accounts", "계정 관리")) return;
      resetAccountForm();
      showMessage(els.adminMessage, "새 계정 정보를 입력하세요.");
    });

    els.saveAccountButton.addEventListener("click", async () => {
      if (!ensurePermission("manage_accounts", "계정 관리")) return;
      const username = els.accountUsername.value.trim();
      const displayName = els.accountDisplayName.value.trim();
      const role = els.accountRole.value;
      const password = els.accountPassword.value;
      const isActive = els.accountActive.checked;
      if (!/^[a-z0-9_-]{3,32}$/.test(username)) {
        showMessage(els.adminMessage, "아이디는 영문 소문자, 숫자, _, - 조합 3~32자로 입력하세요.");
        return;
      }
      if (!displayName) {
        showMessage(els.adminMessage, "표시 이름을 입력하세요.");
        return;
      }
      if (role === "dev" && currentAdminRole() !== "dev") {
        showMessage(els.adminMessage, "dev 권한은 dev 계정만 부여할 수 있습니다.");
        return;
      }
      const selectedAccount = adminAccounts.find((account) => account.user_id === selectedAdminAccountId);
      if (selectedAccount && selectedAccount.role === "dev" && currentAdminRole() !== "dev") {
        showMessage(els.adminMessage, "manager는 dev 계정을 수정할 수 없습니다.");
        return;
      }
      if (!selectedAdminAccountId && password.length < 6) {
        showMessage(els.adminMessage, "새 계정 비밀번호는 6자 이상으로 입력하세요.");
        return;
      }
      if (selectedAdminAccountId && password && password.length < 6) {
        showMessage(els.adminMessage, "새 비밀번호는 6자 이상으로 입력하세요.");
        return;
      }

      const payload = selectedAdminAccountId
        ? {
            action: "update",
            account: {
              userId: selectedAdminAccountId,
              displayName,
              role,
              isActive,
              password: password || undefined,
            },
          }
        : {
            action: "create",
            account: {
              username,
              displayName,
              role,
              isActive,
              password,
            },
          };
      showMessage(els.adminMessage, "계정 정보를 저장하는 중입니다.");
      const result = await adminAccountsRequest(payload);
      if (!result || !result.ok) {
        showMessage(els.adminMessage, `계정 저장 실패: ${friendlyRemoteError(result && result.error)}`);
        return;
      }
      els.accountPassword.value = "";
      selectedAdminAccountId = result.account && result.account.user_id ? result.account.user_id : selectedAdminAccountId;
      showGlobalStatus("계정 정보를 저장했습니다.", "success", { autoHide: true });
      showMessage(els.adminMessage, "계정 정보를 저장했습니다.");
      refreshAdminAccounts();
    });

    els.deactivateAccountButton.addEventListener("click", async () => {
      if (!ensurePermission("manage_accounts", "계정 관리")) return;
      const selectedAccount = adminAccounts.find((account) => account.user_id === selectedAdminAccountId);
      if (!selectedAccount) {
        showMessage(els.adminMessage, "비활성화할 계정을 선택하세요.");
        return;
      }
      if (selectedAccount.username === (getAdminProfile() && getAdminProfile().username)) {
        showMessage(els.adminMessage, "현재 로그인한 자기 계정은 비활성화할 수 없습니다.");
        return;
      }
      if (selectedAccount.role === "dev" && currentAdminRole() !== "dev") {
        showMessage(els.adminMessage, "manager는 dev 계정을 비활성화할 수 없습니다.");
        return;
      }
      if (!confirmAction(`${selectedAccount.username} 계정을 비활성화할까요?`)) return;
      const result = await adminAccountsRequest({
        action: "deactivate",
        account: { userId: selectedAccount.user_id },
      });
      if (!result || !result.ok) {
        showMessage(els.adminMessage, `계정 비활성화 실패: ${friendlyRemoteError(result && result.error)}`);
        return;
      }
      selectedAdminAccountId = "";
      resetAccountForm();
      showGlobalStatus("계정을 비활성화했습니다.", "success", { autoHide: true });
      refreshAdminAccounts();
    });

    els.saveBaseButton.addEventListener("click", () => {
      if (!ensurePermission("update_base", "기본 시간표 수정")) return;
      const weekday = els.baseWeekday.value;
      classes.forEach((className) => {
        state.base[className][weekday] = periods.map((_, periodIndex) => {
          const input = $(`#baseEditor input[data-base-class="${className}"][data-period-index="${periodIndex}"]`);
          return input ? input.value.trim() : "";
        });
      });
      saveState("기본 시간표를 저장했습니다.", "update_base");
    });

    els.saveBaseMergeButton.addEventListener("click", () => {
      if (!ensurePermission("update_base_merge", "기본 병합 수정")) return;
      const title = els.baseMergeTitle.value.trim();
      const start = Number(els.baseMergeStart.value);
      const end = Number(els.baseMergeEnd.value);
      const mergeClasses = $$("#baseMergeClassChecks input:checked").map((input) => input.value);
      if (!title || mergeClasses.length === 0 || start > end) {
        showMessage(els.adminMessage, "기본 병합명, 학급, 교시 범위를 확인하세요.");
        return;
      }
      state.baseMerges.push({
        id: `${Date.now()}`,
        weekday: els.baseWeekday.value,
        title,
        start,
        end,
        classes: mergeClasses,
        memo: els.baseMergeMemo.value.trim(),
      });
      els.baseMergeTitle.value = "";
      els.baseMergeMemo.value = "";
      saveState("기본 병합을 저장했습니다.", "update_base_merge");
    });

    els.saveSpecialButton.addEventListener("click", () => {
      if (!ensurePermission("update_special", "특별시간표 수정")) return;
      if (!els.specialDate.value) {
        showMessage(els.adminMessage, "특별시간표 날짜를 선택하세요.");
        return;
      }
      if (!isWeekend(els.specialDate.value)) {
        showMessage(els.adminMessage, "주말 특별시간표는 토요일/일요일 날짜만 저장할 수 있습니다.");
        return;
      }
      const nextSchedule = {};
      classes.forEach((className) => {
        nextSchedule[className] = periods.map((_, periodIndex) => {
          const input = $(`#specialEditor input[data-special-class="${className}"][data-period-index="${periodIndex}"]`);
          return input ? input.value.trim() : "";
        });
      });
      const hasSubject = Object.values(nextSchedule).some((subjects) => subjects.some(Boolean));
      if (!hasSubject) {
        showMessage(els.adminMessage, "특별시간표 교과를 하나 이상 입력하세요.");
        return;
      }
      state.specialSchedules[els.specialDate.value] = nextSchedule;
      saveState("특별시간표를 저장했습니다.", "update_special");
    });

    els.deleteSpecialButton.addEventListener("click", () => {
      if (!ensurePermission("update_special", "특별시간표 수정")) return;
      const date = els.specialDate.value;
      if (!state.specialSchedules[date]) {
        showMessage(els.adminMessage, "삭제할 특별시간표가 없습니다.");
        return;
      }
      if (!confirmAction(`${date} 특별시간표를 삭제할까요?`)) return;
      delete state.specialSchedules[date];
      renderSpecialEditor();
      saveState("특별시간표를 삭제했습니다.", "update_special");
    });

    els.specialList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-load-special-date]");
      if (!button) return;
      els.specialDate.value = button.dataset.loadSpecialDate;
      renderSpecialDateHint();
      renderSpecialEditor();
    });

    els.baseMergeList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-base-merge]");
      if (!button) return;
      if (!ensurePermission("update_base_merge", "기본 병합 수정")) return;
      if (!confirmAction("기본 병합을 삭제할까요?")) return;
      state.baseMerges = state.baseMerges.filter((merge) => merge.id !== button.dataset.deleteBaseMerge);
      saveState("기본 병합을 삭제했습니다.", "update_base_merge");
    });

    els.saveChangeButton.addEventListener("click", () => {
      if (!ensurePermission("update_change", "단일교과 변경")) return;
      const subject = els.changeSubject.value.trim();
      if (!els.changeDate.value || !subject) {
        showMessage(els.adminMessage, "날짜와 변경 교과를 입력하세요.");
        return;
      }
      const key = changeKey(els.changeDate.value, els.changeClass.value, els.changePeriod.value);
      state.changes[key] = {
        subject,
        memo: els.changeMemo.value.trim(),
        type: els.changeType.value === "new" ? "new" : "swap",
      };
      els.changeSubject.value = "";
      els.changeMemo.value = "";
      els.changeType.value = "swap";
      saveState("단일교과 변경을 저장했습니다.", "update_change");
    });

    els.deleteChangeButton.addEventListener("click", () => {
      if (!ensurePermission("update_change", "단일교과 변경")) return;
      const key = changeKey(els.changeDate.value, els.changeClass.value, els.changePeriod.value);
      if (!state.changes[key]) {
        showMessage(els.adminMessage, "삭제할 단일 변경이 없습니다.");
        return;
      }
      if (!confirmAction("해당 단일교과 변경을 삭제할까요?")) return;
      delete state.changes[key];
      saveState("해당 단일 변경을 삭제했습니다.", "update_change");
    });

    els.changeList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-revert-change]");
      if (!button) return;
      if (!ensurePermission("update_change", "단일교과 변경")) return;
      if (!confirmAction("해당 교과 변경을 되돌릴까요?")) return;
      delete state.changes[button.dataset.revertChange];
      saveState("해당 교과 변경을 되돌렸습니다.", "update_change");
    });

    els.saveEventButton.addEventListener("click", () => {
      if (!ensurePermission("update_event", "행사 수정")) return;
      const title = els.eventTitle.value.trim();
      const start = Number(els.eventStart.value);
      const end = Number(els.eventEnd.value);
      const eventClasses = $$("#eventClassChecks input:checked").map((input) => input.value);
      if (!els.eventDate.value || !title || eventClasses.length === 0 || start > end) {
        showMessage(els.adminMessage, "행사 날짜, 이름, 학급, 교시 범위를 확인하세요.");
        return;
      }
      const currentEvent = state.events.find((item) => item.id === selectedEventId) || null;
      const canEditTypography = canRole("update_slide_typography");
      const useCustomSlideFontScale = canEditTypography
        ? els.eventCustomFontEnabled.checked
        : Boolean(currentEvent && currentEvent.useCustomSlideFontScale === true);
      const slideFontScale = canEditTypography
        ? clamp(Number(els.eventCustomFontScale.value) || 100, 70, 150)
        : eventSlideFontScale(currentEvent);
      const nextEvent = {
        id: selectedEventId || `${Date.now()}`,
        date: els.eventDate.value,
        title,
        start,
        end,
        classes: eventClasses,
        memo: els.eventMemo.value.trim(),
        ...(useCustomSlideFontScale ? { useCustomSlideFontScale: true, slideFontScale } : {}),
      };
      if (selectedEventId) {
        state.events = state.events.map((item) => (item.id === selectedEventId ? nextEvent : item));
        resetEventForm();
        saveState("행사 시간표를 수정했습니다.", "update_event");
        return;
      }
      state.events.push(nextEvent);
      resetEventForm();
      saveState("행사 시간표를 저장했습니다.", "update_event");
    });

    els.cancelEventEditButton.addEventListener("click", () => {
      resetEventForm();
      showMessage(els.adminMessage, "행사 수정을 취소했습니다.");
    });

    els.eventList.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-event]");
      if (editButton) {
        loadEventEditor(editButton.dataset.editEvent);
        return;
      }
      const button = event.target.closest("[data-delete-event]");
      if (!button) return;
      if (!ensurePermission("update_event", "행사 수정")) return;
      if (!confirmAction("행사를 삭제할까요?")) return;
      state.events = state.events.filter((item) => item.id !== button.dataset.deleteEvent);
      if (selectedEventId === button.dataset.deleteEvent) {
        resetEventForm();
      }
      saveState("행사를 삭제했습니다.", "update_event");
    });

    els.slideEventFontScale.addEventListener("input", () => {
      const scale = clamp(Number(els.slideEventFontScale.value) || 100, 70, 150);
      els.slideEventFontScaleLabel.textContent = `행사 ${scale}%`;
    });

    els.slideEventFontScale.addEventListener("change", () => {
      if (!ensurePermission("update_slide_typography", "슬라이드쇼 글자 크기 수정")) {
        els.slideEventFontScale.value = clamp(Number(state.slideshow && state.slideshow.eventFontScale) || 100, 70, 150);
        els.slideEventFontScaleLabel.textContent = `행사 ${els.slideEventFontScale.value}%`;
        return;
      }
      state.slideshow.eventFontScale = clamp(Number(els.slideEventFontScale.value) || 100, 70, 150);
      if (currentRoute === "slideshow") renderSlideshow();
      saveState("슬라이드쇼 행사 글자 크기를 저장했습니다.", "update_slide_typography");
    });

    [
      els.noticeTitle,
      els.noticeBody,
      els.slideLessonFontScale,
      els.slideClassHeaderFontScale,
      els.slidePeriodHeaderFontScale,
      els.noticeTitleFontSize,
      els.noticeFontSize,
    ].forEach((input) => {
      input.addEventListener("input", renderNoticePreview);
    });

    els.slideLessonFontScale.addEventListener("change", () => {
      if (!ensurePermission("update_slide_typography", "슬라이드쇼 글자 크기 수정")) {
        els.slideLessonFontScale.value = clamp(Number(state.slideshow && state.slideshow.lessonFontScale) || 100, 70, 150);
        renderNoticePreview();
        return;
      }
      state.slideshow.lessonFontScale = clamp(Number(els.slideLessonFontScale.value) || 100, 70, 150);
      renderView();
      if (currentRoute === "slideshow") renderSlideshow();
      saveState("슬라이드쇼 시간표 글자 크기를 저장했습니다.", "update_slide_typography");
    });

    els.slideClassHeaderFontScale.addEventListener("change", () => {
      if (!ensurePermission("update_slide_typography", "슬라이드쇼 글자 크기 수정")) {
        els.slideClassHeaderFontScale.value = clamp(Number(state.slideshow && state.slideshow.classHeaderFontScale) || 100, 70, 170);
        renderNoticePreview();
        return;
      }
      state.slideshow.classHeaderFontScale = clamp(Number(els.slideClassHeaderFontScale.value) || 100, 70, 170);
      if (currentRoute === "slideshow") renderSlideshow();
      saveState("슬라이드쇼 학급 글자 크기를 저장했습니다.", "update_slide_typography");
    });

    els.slidePeriodHeaderFontScale.addEventListener("change", () => {
      if (!ensurePermission("update_slide_typography", "슬라이드쇼 글자 크기 수정")) {
        els.slidePeriodHeaderFontScale.value = clamp(Number(state.slideshow && state.slideshow.periodHeaderFontScale) || 100, 70, 170);
        renderNoticePreview();
        return;
      }
      state.slideshow.periodHeaderFontScale = clamp(Number(els.slidePeriodHeaderFontScale.value) || 100, 70, 170);
      if (currentRoute === "slideshow") renderSlideshow();
      saveState("슬라이드쇼 교시 글자 크기를 저장했습니다.", "update_slide_typography");
    });

    els.addNoticeButton.addEventListener("click", () => {
      loadNoticeEditor("");
      els.noticeTitle.focus();
      showMessage(els.adminMessage, "새 안내 페이지 내용을 입력한 뒤 저장하세요.");
    });

    els.saveNoticeButton.addEventListener("click", () => {
      if (!ensurePermission("update_notice", "안내사항 수정")) return;
      const title = els.noticeTitle.value.trim();
      const body = els.noticeBody.value.trim();
      if (!title || !body) {
        showMessage(els.adminMessage, "안내사항 제목과 내용을 입력하세요.");
        return;
      }
      const existing = state.notices.find((notice) => notice.id === selectedNoticeId);
      const savedNotice = {
        id: existing ? existing.id : `${Date.now()}`,
        title,
        body,
        titleFontSize: clamp(Number(els.noticeTitleFontSize.value) || 72, 36, 120),
        detailFontSize: clamp(Number(els.noticeFontSize.value) || 42, 24, 84),
      };
      if (existing) {
        Object.assign(existing, savedNotice);
      } else {
        state.notices.push(savedNotice);
        selectedNoticeId = savedNotice.id;
      }
      saveState("안내사항을 저장했습니다.", "update_notice");
    });

    els.noticeList.addEventListener("click", (event) => {
      const deleteButton = event.target.closest("[data-delete-notice]");
      if (deleteButton) {
        if (!ensurePermission("update_notice", "안내사항 수정")) return;
        if (!confirmAction("안내사항을 삭제할까요?")) return;
        state.notices = state.notices.filter((notice) => notice.id !== deleteButton.dataset.deleteNotice);
        if (selectedNoticeId === deleteButton.dataset.deleteNotice) {
          selectedNoticeId = state.notices[0] ? state.notices[0].id : "";
          loadNoticeEditor(selectedNoticeId);
        }
        saveState("안내사항을 삭제했습니다.", "update_notice");
        return;
      }

      const item = event.target.closest("[data-select-notice]");
      if (!item) return;
      loadNoticeEditor(item.dataset.selectNotice);
    });

    els.saveSlideSettingsButton.addEventListener("click", () => {
      if (!ensurePermission("update_slide_runtime", "슬라이드쇼 설정 수정")) return;
      const interval = Math.max(3, Math.min(120, Number(els.slideInterval.value) || 8));
      const refreshInterval = Math.max(10, Math.min(3600, Number(els.slideRefreshInterval.value) || 60));
      const scheduleDate = els.slideScheduleDate.value;
      const selectedNotice = state.notices.find((notice) => notice.id === selectedNoticeId);
      const nextLessonFontScale = clamp(Number(els.slideLessonFontScale.value) || 100, 70, 150);
      const nextClassHeaderFontScale = clamp(Number(els.slideClassHeaderFontScale.value) || 100, 70, 170);
      const nextPeriodHeaderFontScale = clamp(Number(els.slidePeriodHeaderFontScale.value) || 100, 70, 170);
      const nextEventFontScale = clamp(Number(els.slideEventFontScale.value) || 100, 70, 150);
      const typographyChanged =
        nextLessonFontScale !== clamp(Number(state.slideshow && state.slideshow.lessonFontScale) || 100, 70, 150) ||
        nextClassHeaderFontScale !== clamp(Number(state.slideshow && state.slideshow.classHeaderFontScale) || 100, 70, 170) ||
        nextPeriodHeaderFontScale !== clamp(Number(state.slideshow && state.slideshow.periodHeaderFontScale) || 100, 70, 170) ||
        nextEventFontScale !== clamp(Number(state.slideshow && state.slideshow.eventFontScale) || 100, 70, 150);
      if (typographyChanged && !ensurePermission("update_slide_typography", "슬라이드쇼 글자 크기 수정")) {
        renderAdmin();
        return;
      }
      state.slideshow.intervalSeconds = interval;
      state.slideshow.refreshSeconds = refreshInterval;
      state.slideshow.scheduleDate = scheduleDate;
      state.slideshow.scheduleDateExpiresOn = scheduleDate ? nextDateIso(scheduleDate) : "";
      if (els.slideShowMeal) {
        state.slideshow.showMeal = els.slideShowMeal.value !== "false";
      }
      if (canRole("update_slide_typography")) {
        state.slideshow.lessonFontScale = nextLessonFontScale;
        state.slideshow.classHeaderFontScale = nextClassHeaderFontScale;
        state.slideshow.periodHeaderFontScale = nextPeriodHeaderFontScale;
        state.slideshow.eventFontScale = nextEventFontScale;
      }
      if (selectedNotice) {
        selectedNotice.titleFontSize = clamp(Number(els.noticeTitleFontSize.value) || 72, 36, 120);
        selectedNotice.detailFontSize = clamp(Number(els.noticeFontSize.value) || 42, 24, 84);
      }
      els.slideInterval.value = interval;
      els.slideRefreshInterval.value = refreshInterval;
      renderNoticePreview();
      renderNoticeList();
      if (currentRoute === "slideshow") {
        startSlideshow();
      }
      saveState("슬라이드쇼 설정을 저장했습니다.", typographyChanged ? "update_slide_typography" : "update_slide_runtime");
    });

    els.forceSlideReloadButton.addEventListener("click", async () => {
      if (!ensurePermission("force_reload", "슬라이드쇼 강제 새로고침")) return;
      const password = els.slideReloadPassword.value;
      if (!password) {
        showMessage(els.adminMessage, "관리자 비밀번호를 입력하세요.");
        return;
      }
      const profile = getAdminProfile();
      const username = profile && profile.username ? profile.username : els.adminUsername.value;
      const result = await verifyAdminPassword(username, password);
      if (!result.ok) {
        showMessage(els.adminMessage, "비밀번호가 맞지 않습니다.");
        return;
      }
      els.slideReloadPassword.value = "";
      state.slideshow.reloadToken = `${Date.now()}`;
      saveState("슬라이드쇼 화면에 강제 새로고침 명령을 보냈습니다.", "force_reload");
    });

    els.slideReloadPassword.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      els.forceSlideReloadButton.click();
    });
  }

  function init() {
    document.body.classList.toggle("board-mode", isBoardMode);
    currentRoute = isBoardMode ? "view" : routeFromPath();
    applyDeveloperMode();
    initControls();
    applyBoardTheme();
    bindEvents();
    refreshAdminAuth();
    renderView();
    renderAdmin();
    routeTo(currentRoute);
    analyticsRouteTrackingReady = true;
    syncRemoteForRoute();
    if (isBoardMode) {
      const seconds = Math.max(10, Number(state.slideshow && state.slideshow.refreshSeconds) || 60);
      boardRefreshTimer = window.setInterval(() => {
        refreshFromRemote({ keepNoticeSelection: true, restartSlideshow: false });
      }, seconds * 1000);
    }
    refreshFromRemote();
  }

  init();
})();
