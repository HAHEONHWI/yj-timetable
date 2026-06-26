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
    fontScale: 1,
    subjectFilters: [],
    subjectGradeFilters: {},
  };

  const els = {
    closeButton: document.querySelector("#closeButton"),
    dateLabel: document.querySelector("#dateLabel"),
    fontScaleLabel: document.querySelector("#fontScaleLabel"),
    fontScaleRange: document.querySelector("#fontScaleRange"),
    opacityRange: document.querySelector("#opacityRange"),
    pinToggle: document.querySelector("#pinToggle"),
    refreshButton: document.querySelector("#refreshButton"),
    schedule: document.querySelector("#schedule"),
    startupToggle: document.querySelector("#startupToggle"),
    status: document.querySelector("#status"),
    subjectFilterButton: document.querySelector("#subjectFilterButton"),
    subjectFilterClose: document.querySelector("#subjectFilterClose"),
    subjectFilterMenu: document.querySelector("#subjectFilterMenu"),
    subjectFilterOverlay: document.querySelector("#subjectFilterOverlay"),
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

  function getEventsForDate(date) {
    return state.events.filter((event) => event.date === date);
  }

  function hasEventCovering(date, className, period) {
    return getEventsForDate(date).some((event) => {
      return event.classes.includes(className) && period >= event.start && period <= event.end;
    });
  }

  function weekdayLabelForDate(value) {
    const labels = ["일", "월", "화", "수", "목", "금", "토"];
    return labels[fromISO(value).getDay()] || "";
  }

  function hasScheduleForToday(date) {
    return isSchoolWeekday(date) || Boolean(state.specialSchedules[date]);
  }

  function contiguousClassGroups(classNames) {
    const indexes = classNames
      .map((className) => classes.indexOf(className))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b);
    const groups = [];
    indexes.forEach((index) => {
      const last = groups[groups.length - 1];
      if (last && last[last.length - 1] === index - 1) {
        last.push(index);
      } else {
        groups.push([index]);
      }
    });
    return groups;
  }

  function formatPeriodRange(start, end) {
    return start === end ? `${start}교시` : `${start}-${end}교시`;
  }

  function renderMergedBlock(item, className, options = {}) {
    return contiguousClassGroups(item.classes)
      .map((group) => {
        const start = Number(item.start);
        const end = Number(item.end);
        const rowStart = start + 1;
        const rowEnd = end + 2;
        const columnStart = group[0] + 2;
        const columnEnd = group[group.length - 1] + 3;
        const groupClassNames = group.map((classIndex) => classes[classIndex]);
        const memo = item.memo ? ` · ${escapeHtml(item.memo)}` : "";
        const prefix = options.prefix ? `${options.prefix} · ` : "";
        return `<div class="lesson ${className}${subjectHighlightClass(item.title, { classNames: groupClassNames })}" style="grid-column:${columnStart}/${columnEnd};grid-row:${rowStart}/${rowEnd}">
          <strong>${escapeHtml(item.title)}</strong>
          <small>${prefix}${formatPeriodRange(start, end)}${memo}</small>
        </div>`;
      })
      .join("");
  }

  function renderCell(date, className, period, periodIndex) {
    const change = getChange(date, className, period);

    if (change) {
      const original = getSubjectsForDate(date, className)[periodIndex] || "-";
      return `<div class="lesson is-change${subjectHighlightClass(change.subject, { className })}">
        <strong>${escapeHtml(change.subject)}</strong>
        <small>${escapeHtml(original)} 변경${change.memo ? ` · ${escapeHtml(change.memo)}` : ""}</small>
      </div>`;
    }

    const subject = getSubjectsForDate(date, className)[periodIndex] || "-";
    return `<div class="lesson${subjectHighlightClass(subject, { className })}">
      <strong>${escapeHtml(subject)}</strong>
    </div>`;
  }

  function normalizedSubject(value) {
    return String(value || "").trim();
  }

  function normalizedSubjectFilters(value = settings.subjectFilters) {
    const rawFilters = Array.isArray(value)
      ? value
      : String(value || settings.subjectFilter || "")
          .split(",")
          .map((subject) => subject.trim());
    return [...new Set(rawFilters.map(normalizedSubject).filter((subject) => subject && subject !== "all"))];
  }

  function normalizedGrades(value) {
    const rawGrades = Array.isArray(value)
      ? value
      : String(value || "")
          .split(",")
          .map((grade) => grade.trim());
    return [...new Set(rawGrades.filter((grade) => ["1", "2", "3"].includes(grade)))];
  }

  function normalizedSubjectGradeFilters(value = settings.subjectGradeFilters) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .map(([subject, grades]) => [normalizedSubject(subject), normalizedGrades(grades)])
        .filter(([subject]) => subject),
    );
  }

  function gradesForSubject(subject) {
    const subjectName = normalizedSubject(subject);
    const gradeFilters = normalizedSubjectGradeFilters();
    if (Object.prototype.hasOwnProperty.call(gradeFilters, subjectName)) {
      return gradeFilters[subjectName];
    }
    return ["1", "2", "3"];
  }

  function gradeForClassName(className) {
    const grade = String(className || "").split("-")[0];
    return ["1", "2", "3"].includes(grade) ? grade : "";
  }

  function isSubjectAllowedForClasses(subject, options = {}) {
    const classNames = options.classNames || (options.className ? [options.className] : []);
    if (!classNames.length) return true;
    const allowedGrades = new Set(gradesForSubject(subject));
    if (!allowedGrades.size) return false;
    return classNames.some((className) => allowedGrades.has(gradeForClassName(className)));
  }

  function subjectHighlightClass(subject, options = {}) {
    const selected = new Set(normalizedSubjectFilters());
    if (!selected.size) return "";
    if (!selected.has(normalizedSubject(subject))) return "";
    if (!isSubjectAllowedForClasses(subject, options)) return "";
    return " is-subject-highlight";
  }

  function collectBaseSubjects() {
    const subjects = [];
    classes.forEach((className) => {
      weekdays.forEach((weekday) => {
        const classSubjects = state.base[className] && state.base[className][weekday.key];
        if (Array.isArray(classSubjects)) subjects.push(...classSubjects);
      });
    });
    state.baseMerges.forEach((merge) => subjects.push(merge.title));
    return subjects;
  }

  function syncSubjectFilterOptions() {
    if (!els.subjectFilterButton || !els.subjectFilterMenu) return;
    const uniqueSubjects = [...new Set(collectBaseSubjects().map(normalizedSubject).filter((subject) => subject && subject !== "-"))].sort(
      (a, b) => a.localeCompare(b, "ko-KR"),
    );
    const validSubjects = new Set(uniqueSubjects);
    const selected = normalizedSubjectFilters().filter((subject) => validSubjects.has(subject));
    const gradeFilters = normalizedSubjectGradeFilters();
    const selectedGradeFilters = Object.fromEntries(
      selected.map((subject) => [subject, Object.prototype.hasOwnProperty.call(gradeFilters, subject) ? gradeFilters[subject] : ["1", "2", "3"]]),
    );
    settings.subjectFilters = selected;
    settings.subjectGradeFilters = selectedGradeFilters;

    const optionHtml = [
      '<button class="subject-clear" type="button" data-clear-subjects>전체 보기</button>',
      ...uniqueSubjects.map((subject) => {
        const isSelected = selected.includes(subject);
        const subjectChecked = isSelected ? " checked" : "";
        const disabled = isSelected ? "" : " disabled";
        const grades = gradesForSubject(subject);
        return `<div class="subject-setting-row${isSelected ? " is-active" : ""}">
          <label class="subject-setting-subject">
            <input type="checkbox" value="${escapeHtml(subject)}" data-subject-filter${subjectChecked} />
            <span>${escapeHtml(subject)}</span>
          </label>
          <div class="subject-grade-options" aria-label="${escapeHtml(subject)} 표시 학년">
            ${["1", "2", "3"]
              .map((grade) => {
                const checked = grades.includes(grade) ? " checked" : "";
                return `<label class="subject-option">
                  <input type="checkbox" value="${grade}" data-subject-grade="${escapeHtml(subject)}"${checked}${disabled} />
                  <span>${grade}</span>
                </label>`;
              })
              .join("")}
          </div>
        </div>`;
      }),
    ].join("");
    if (els.subjectFilterMenu.innerHTML !== optionHtml) {
      els.subjectFilterMenu.innerHTML = optionHtml;
    }

    if (!selected.length) {
      els.subjectFilterButton.textContent = "전체";
    } else if (selected.length === 1) {
      els.subjectFilterButton.textContent = selected[0];
    } else {
      els.subjectFilterButton.textContent = `${selected[0]} 외 ${selected.length - 1}`;
    }
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
      syncSubjectFilterOptions();
      els.schedule.innerHTML = `<div class="empty-state">
        <strong>오늘 등록된 시간표가 없습니다.</strong>
        <span>평일 기본 시간표 또는 오늘 특별시간표가 등록되면 전체 학급 시간표가 표시됩니다.</span>
      </div>`;
      return;
    }

    const baseMerges = isSchoolWeekday(today)
      ? state.baseMerges
          .filter((merge) => merge.weekday === weekdayForDate(today).key)
          .map((merge) => {
            const classNames = merge.classes.filter((className) => {
              return (
                classes.includes(className) &&
                periods
                  .filter((period) => period >= merge.start && period <= merge.end)
                  .every((period) => !hasEventCovering(today, className, period) && !getChange(today, className, period))
              );
            });
            return { ...merge, classes: classNames };
          })
          .filter((merge) => merge.classes.length > 0)
      : [];

    syncSubjectFilterOptions();

    const hasRenderedBaseMerge = (className, period) => {
      return baseMerges.some((merge) => {
        return merge.classes.includes(className) && period >= merge.start && period <= merge.end;
      });
    };

    const rows = periods
      .map((period, periodIndex) => {
        const cells = classes
          .map((className, classIndex) => {
            if (hasEventCovering(today, className, period)) return "";
            if (hasRenderedBaseMerge(className, period)) return "";
            return `<div style="grid-column:${classIndex + 2};grid-row:${periodIndex + 2}">
              ${renderCell(today, className, period, periodIndex)}
            </div>`;
          })
          .join("");
        return `<div class="period-head" style="grid-column:1;grid-row:${periodIndex + 2}">${period}교시</div>${cells}`;
      })
      .join("");
    const mergedBlocks = [
      ...baseMerges.map((merge) => renderMergedBlock(merge, "is-merge")),
      ...getEventsForDate(today).map((event) => renderMergedBlock(event, "is-event", { prefix: "행사" })),
    ].join("");

    els.schedule.innerHTML = `<div class="today-grid">
      <div class="corner" style="grid-column:1;grid-row:1">교시</div>
      ${heads}
      ${rows}
      ${mergedBlocks}
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
      const storedSettings = await window.widgetApi.getSettings();
      settings = { ...settings, ...storedSettings };
      if (!Array.isArray(storedSettings.subjectFilters)) {
        settings.subjectFilters = normalizedSubjectFilters(storedSettings.subjectFilter || "all");
      }
    } else {
      settings = {
        opacity: Number(localStorage.getItem("widget-opacity")) || 0.96,
        alwaysOnTop: localStorage.getItem("widget-pin") !== "false",
        openAtLogin: localStorage.getItem("widget-startup") === "true",
        theme: localStorage.getItem("widget-theme") === "light" ? "light" : "dark",
        fontScale: Number(localStorage.getItem("widget-font-scale")) || 1,
        subjectFilters: parseStoredSubjectFilters(),
        subjectGradeFilters: parseStoredSubjectGradeFilters(),
      };
      document.body.style.opacity = settings.opacity;
    }
    settings.subjectFilters = normalizedSubjectFilters(settings.subjectFilters);
    settings.subjectGradeFilters = migrateSubjectGradeFilters(settings);
    applyTheme(settings.theme);
    applyFontScale(settings.fontScale);
    els.opacityRange.value = Math.round(settings.opacity * 100);
    els.fontScaleRange.value = Math.round((Number(settings.fontScale) || 1) * 100);
    els.fontScaleLabel.textContent = `글씨 ${els.fontScaleRange.value}%`;
    els.pinToggle.checked = Boolean(settings.alwaysOnTop);
    els.startupToggle.checked = Boolean(settings.openAtLogin);
    syncSubjectFilterOptions();
    els.themeToggle.checked = settings.theme === "light";
  }

  async function saveSettings(patch) {
    settings = { ...settings, ...patch };
    settings.subjectFilters = normalizedSubjectFilters(settings.subjectFilters);
    settings.subjectGradeFilters = normalizedSubjectGradeFilters(settings.subjectGradeFilters);
    settings.subjectFilter = settings.subjectFilters[0] || "all";
    if (window.widgetApi) {
      settings = await window.widgetApi.updateSettings(settings);
      settings.subjectFilters = normalizedSubjectFilters(settings.subjectFilters);
      settings.subjectGradeFilters = normalizedSubjectGradeFilters(settings.subjectGradeFilters);
      settings.subjectFilter = settings.subjectFilters[0] || "all";
    } else {
      localStorage.setItem("widget-opacity", String(settings.opacity));
      localStorage.setItem("widget-pin", String(settings.alwaysOnTop));
      localStorage.setItem("widget-startup", String(settings.openAtLogin));
      localStorage.setItem("widget-theme", settings.theme);
      localStorage.setItem("widget-font-scale", String(settings.fontScale));
      localStorage.setItem("widget-subject-filters", JSON.stringify(settings.subjectFilters));
      localStorage.setItem("widget-subject-filter", settings.subjectFilters[0] || "all");
      localStorage.setItem("widget-subject-grade-filters", JSON.stringify(settings.subjectGradeFilters));
      document.body.style.opacity = settings.opacity;
    }
    applyTheme(settings.theme);
    applyFontScale(settings.fontScale);
    els.opacityRange.value = Math.round(settings.opacity * 100);
    els.fontScaleRange.value = Math.round((Number(settings.fontScale) || 1) * 100);
    els.fontScaleLabel.textContent = `글씨 ${els.fontScaleRange.value}%`;
    els.pinToggle.checked = Boolean(settings.alwaysOnTop);
    els.startupToggle.checked = Boolean(settings.openAtLogin);
    syncSubjectFilterOptions();
    els.themeToggle.checked = settings.theme === "light";
  }

  function parseStoredSubjectFilters() {
    try {
      const storedFilters = JSON.parse(localStorage.getItem("widget-subject-filters") || "[]");
      if (Array.isArray(storedFilters)) return normalizedSubjectFilters(storedFilters);
    } catch {
      // Fall back to the previous single-select key.
    }
    return normalizedSubjectFilters(localStorage.getItem("widget-subject-filter") || "all");
  }

  function parseStoredSubjectGradeFilters() {
    try {
      const storedGradeFilters = JSON.parse(localStorage.getItem("widget-subject-grade-filters") || "{}");
      return normalizedSubjectGradeFilters(storedGradeFilters);
    } catch {
      return {};
    }
  }

  function migrateSubjectGradeFilters(sourceSettings) {
    const gradeFilters = normalizedSubjectGradeFilters(sourceSettings.subjectGradeFilters);
    if (Object.keys(gradeFilters).length) return gradeFilters;

    const excludedGrades = normalizedGrades(sourceSettings.excludedGrades);
    if (!excludedGrades.length) return {};

    const allowedGrades = ["1", "2", "3"].filter((grade) => !excludedGrades.includes(grade));
    return Object.fromEntries(normalizedSubjectFilters(sourceSettings.subjectFilters).map((subject) => [subject, allowedGrades]));
  }

  function applyTheme(theme) {
    document.body.classList.toggle("theme-light", theme === "light");
    document.body.classList.toggle("theme-dark", theme !== "light");
  }

  function applyFontScale(fontScale) {
    const scale = Math.min(1.5, Math.max(0.8, Number(fontScale) || 1));
    document.body.style.setProperty("--widget-font-scale", scale);
  }

  async function init() {
    await loadSettings();
    els.opacityRange.addEventListener("input", () => {
      saveSettings({ opacity: Number(els.opacityRange.value) / 100 });
    });
    els.fontScaleRange.addEventListener("input", () => {
      const fontScale = Number(els.fontScaleRange.value) / 100;
      applyFontScale(fontScale);
      els.fontScaleLabel.textContent = `글씨 ${els.fontScaleRange.value}%`;
      saveSettings({ fontScale });
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
    els.subjectFilterButton.addEventListener("click", () => {
      syncSubjectFilterOptions();
      els.subjectFilterOverlay.hidden = false;
    });
    els.subjectFilterClose.addEventListener("click", () => {
      els.subjectFilterOverlay.hidden = true;
    });
    els.subjectFilterOverlay.addEventListener("click", (event) => {
      if (event.target === els.subjectFilterOverlay) {
        els.subjectFilterOverlay.hidden = true;
      }
    });
    els.subjectFilterMenu.addEventListener("click", (event) => {
      if (event.target.closest("[data-clear-subjects]")) {
        saveSettings({ subjectFilters: [], subjectGradeFilters: {} });
        render();
      }
    });
    els.subjectFilterMenu.addEventListener("change", () => {
      const subjectFilters = [...els.subjectFilterMenu.querySelectorAll("input[data-subject-filter]:checked")].map(
        (input) => input.value,
      );
      const subjectGradeFilters = Object.fromEntries(
        subjectFilters.map((subject) => {
          const gradeInputs = [
            ...els.subjectFilterMenu.querySelectorAll(`input[data-subject-grade="${CSS.escape(subject)}"]`),
          ];
          const grades = gradeInputs.length
            ? gradeInputs.filter((input) => input.checked).map((input) => input.value)
            : gradesForSubject(subject);
          return [subject, grades];
        }),
      );
      saveSettings({ subjectFilters, subjectGradeFilters });
      render();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        els.subjectFilterOverlay.hidden = true;
      }
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
