(function () {
  const {
    classes,
    weekdays,
    periods,
    read,
    readRemote,
    subscribeRemoteChanges,
    changeKey,
  } = window.TimetableStore;

  let state = read();
  let refreshTimer = null;
  let remoteUnsubscribe = null;
  let settings = {
    opacity: 0.96,
    alwaysOnTop: true,
    openAtLogin: false,
    theme: "dark",
  };

  const els = {
    closeButton: document.querySelector("#closeButton"),
    dateLabel: document.querySelector("#dateLabel"),
    opacityRange: document.querySelector("#opacityRange"),
    pinToggle: document.querySelector("#pinToggle"),
    refreshButton: document.querySelector("#refreshButton"),
    schedule: document.querySelector("#schedule"),
    startupToggle: document.querySelector("#startupToggle"),
    status: document.querySelector("#status"),
    themeToggle: document.querySelector("#themeToggle"),
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

  function weekdayForDate(value) {
    const dayIndex = fromISO(value).getDay();
    return weekdays[dayIndex - 1] || weekdays[0];
  }

  function isSchoolWeekday(value) {
    const day = fromISO(value).getDay();
    return day >= 1 && day <= 5;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getSubjectsForDate(date, className) {
    const special = state.specialSchedules[date] && state.specialSchedules[date][className];
    if (Array.isArray(special)) return special;
    if (!isSchoolWeekday(date)) return periods.map(() => "");
    return state.base[className][weekdayForDate(date).key] || periods.map(() => "");
  }

  function getChange(date, className, period) {
    return state.changes[changeKey(date, className, period)] || null;
  }

  function getEvent(date, className, period) {
    return state.events.find((event) => {
      return event.date === date && event.classes.includes(className) && period >= event.start && period <= event.end;
    });
  }

  function getBaseMerge(date, className, period) {
    if (!isSchoolWeekday(date)) return null;
    const weekdayKey = weekdayForDate(date).key;
    return state.baseMerges.find((merge) => {
      return (
        merge.weekday === weekdayKey &&
        merge.classes.includes(className) &&
        period >= merge.start &&
        period <= merge.end
      );
    });
  }

  function weekdayLabelForDate(value) {
    const labels = ["일", "월", "화", "수", "목", "금", "토"];
    return labels[fromISO(value).getDay()] || "";
  }

  function hasScheduleForToday(date) {
    return isSchoolWeekday(date) || Boolean(state.specialSchedules[date]);
  }

  function renderCell(date, className, period, periodIndex) {
    const event = getEvent(date, className, period);
    const change = getChange(date, className, period);
    const baseMerge = getBaseMerge(date, className, period);

    if (event) {
      return `<div class="lesson is-event">
        <strong>${escapeHtml(event.title)}</strong>
        <small>행사 · ${event.start}-${event.end}교시${event.memo ? ` · ${escapeHtml(event.memo)}` : ""}</small>
      </div>`;
    }

    if (change) {
      const original = getSubjectsForDate(date, className)[periodIndex] || "-";
      return `<div class="lesson is-change">
        <strong>${escapeHtml(change.subject)}</strong>
        <small>${escapeHtml(original)} 변경${change.memo ? ` · ${escapeHtml(change.memo)}` : ""}</small>
      </div>`;
    }

    if (baseMerge) {
      return `<div class="lesson is-merge">
        <strong>${escapeHtml(baseMerge.title)}</strong>
        <small>${baseMerge.start}-${baseMerge.end}교시${baseMerge.memo ? ` · ${escapeHtml(baseMerge.memo)}` : ""}</small>
      </div>`;
    }

    const subject = getSubjectsForDate(date, className)[periodIndex] || "-";
    return `<div class="lesson">
      <strong>${escapeHtml(subject)}</strong>
    </div>`;
  }

  function render() {
    const today = toISO(new Date());
    els.dateLabel.textContent = `${formatDate(today)} ${weekdayLabelForDate(today)}요일 · 전체 학급`;

    const heads = classes
      .map((className, index) => {
        return `<div class="class-head" style="grid-column:${index + 2};grid-row:1">
          <strong>${escapeHtml(className)}</strong>
          <small>오늘</small>
        </div>`;
      })
      .join("");

    if (!hasScheduleForToday(today)) {
      els.schedule.innerHTML = `<div class="empty-state">
        <strong>오늘 등록된 시간표가 없습니다.</strong>
        <span>평일 기본 시간표 또는 오늘 특별시간표가 등록되면 전체 학급 시간표가 표시됩니다.</span>
      </div>`;
      return;
    }

    const rows = periods
      .map((period, periodIndex) => {
        const cells = classes
          .map((className, classIndex) => {
            return `<div style="grid-column:${classIndex + 2};grid-row:${periodIndex + 2}">
              ${renderCell(today, className, period, periodIndex)}
            </div>`;
          })
          .join("");
        return `<div class="period-head" style="grid-column:1;grid-row:${periodIndex + 2}">${period}교시</div>${cells}`;
      })
      .join("");

    els.schedule.innerHTML = `<div class="today-grid">
      <div class="corner" style="grid-column:1;grid-row:1">교시</div>
      ${heads}
      ${rows}
    </div>`;
  }

  async function refresh() {
    els.status.textContent = "Supabase에서 최신 시간표를 자동 확인하는 중입니다.";
    els.status.classList.remove("is-error");
    try {
      state = await readRemote();
      render();
      restartAutoRefresh();
      els.status.textContent = `최신 시간표 표시 중 · ${new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      })} · 자동 동기화`;
    } catch (error) {
      state = read();
      render();
      restartAutoRefresh();
      els.status.textContent = `원격 연결 실패 · 다음 주기에 다시 확인합니다 (${error.message || "알 수 없는 오류"})`;
      els.status.classList.add("is-error");
    }
  }

  function refreshIntervalMs() {
    const seconds = Math.max(10, Number(state.slideshow && state.slideshow.refreshSeconds) || 60);
    return seconds * 1000;
  }

  function restartAutoRefresh() {
    window.clearInterval(refreshTimer);
    refreshTimer = window.setInterval(() => {
      refresh();
    }, refreshIntervalMs());
  }

  function startRemoteSync() {
    if (remoteUnsubscribe || typeof subscribeRemoteChanges !== "function") return;
    remoteUnsubscribe = subscribeRemoteChanges((remoteState) => {
      state = remoteState;
      render();
      restartAutoRefresh();
      els.status.textContent = `원격 변경사항 자동 반영 · ${new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
      els.status.classList.remove("is-error");
    });
  }

  async function loadSettings() {
    if (window.widgetApi) {
      settings = await window.widgetApi.getSettings();
    } else {
      settings = {
        opacity: Number(localStorage.getItem("widget-opacity")) || 0.96,
        alwaysOnTop: localStorage.getItem("widget-pin") !== "false",
        openAtLogin: localStorage.getItem("widget-startup") === "true",
        theme: localStorage.getItem("widget-theme") === "light" ? "light" : "dark",
      };
      document.body.style.opacity = settings.opacity;
    }
    applyTheme(settings.theme);
    els.opacityRange.value = Math.round(settings.opacity * 100);
    els.pinToggle.checked = Boolean(settings.alwaysOnTop);
    els.startupToggle.checked = Boolean(settings.openAtLogin);
    els.themeToggle.checked = settings.theme === "light";
  }

  async function saveSettings(patch) {
    settings = { ...settings, ...patch };
    if (window.widgetApi) {
      settings = await window.widgetApi.updateSettings(settings);
    } else {
      localStorage.setItem("widget-opacity", String(settings.opacity));
      localStorage.setItem("widget-pin", String(settings.alwaysOnTop));
      localStorage.setItem("widget-startup", String(settings.openAtLogin));
      localStorage.setItem("widget-theme", settings.theme);
      document.body.style.opacity = settings.opacity;
    }
    applyTheme(settings.theme);
    els.opacityRange.value = Math.round(settings.opacity * 100);
    els.pinToggle.checked = Boolean(settings.alwaysOnTop);
    els.startupToggle.checked = Boolean(settings.openAtLogin);
    els.themeToggle.checked = settings.theme === "light";
  }

  function applyTheme(theme) {
    document.body.classList.toggle("theme-light", theme === "light");
    document.body.classList.toggle("theme-dark", theme !== "light");
  }

  async function init() {
    await loadSettings();
    els.opacityRange.addEventListener("input", () => {
      saveSettings({ opacity: Number(els.opacityRange.value) / 100 });
    });
    els.pinToggle.addEventListener("change", () => {
      saveSettings({ alwaysOnTop: els.pinToggle.checked });
    });
    els.startupToggle.addEventListener("change", () => {
      saveSettings({ openAtLogin: els.startupToggle.checked });
    });
    els.themeToggle.addEventListener("change", () => {
      saveSettings({ theme: els.themeToggle.checked ? "light" : "dark" });
    });
    els.refreshButton.addEventListener("click", refresh);
    els.closeButton.addEventListener("click", () => {
      if (window.widgetApi) {
        window.widgetApi.close();
      } else {
        window.close();
      }
    });

    render();
    startRemoteSync();
    restartAutoRefresh();
    refresh();
  }

  init();
})();
