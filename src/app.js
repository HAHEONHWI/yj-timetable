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
    clearAdminPassword,
    changeKey,
  } = window.TimetableStore;
  let state = read();
  let selectedDate = "";
  let currentRoute = "view";
  let selectedNoticeId = state.notices[0] ? state.notices[0].id : "";
  let changeFilterWeekday = "all";
  let slideshowIndex = 0;
  let slideshowTimer = null;
  let slideshowRefreshTimer = null;
  let slideshowToastTimer = null;
  let boardRefreshTimer = null;
  let remoteUnsubscribe = null;
  let pendingRetryMessage = "";
  const isBoardMode = location.pathname.replace(/\/+$/, "") === "/board";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const els = {
    viewPage: $("#viewPage"),
    slideshowPage: $("#slideshowPage"),
    downloadPage: $("#downloadPage"),
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
    loginPanel: $("#loginPanel"),
    adminWorkspace: $("#adminWorkspace"),
    adminPassword: $("#adminPassword"),
    loginButton: $("#loginButton"),
    logoutButton: $("#logoutButton"),
    loginMessage: $("#loginMessage"),
    adminMessage: $("#adminMessage"),
    baseClass: $("#baseClass"),
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
    slideEventFontScale: $("#slideEventFontScale"),
    slideEventFontScaleLabel: $("#slideEventFontScaleLabel"),
    saveEventButton: $("#saveEventButton"),
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
    slideInterval: $("#slideInterval"),
    slideRefreshInterval: $("#slideRefreshInterval"),
    saveSlideSettingsButton: $("#saveSlideSettingsButton"),
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
    const today = toISO(new Date());
    const days = schoolDaysForTwoWeeks();
    const regularDay = days.find((day) => day.iso === today);
    if (regularDay) return regularDay;
    if (state.specialSchedules[today]) {
      return { iso: today, weekday: { key: "special", label: weekdayLabelForDate(today) }, weekLabel: "특별" };
    }
    return null;
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

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function isLoggedIn() {
    return sessionStorage.getItem("timetable-admin") === "true";
  }

  function routeFromPath() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/admin") return "admin";
    if (path === "/slide" || path === "/slideshow") return "slideshow";
    if (path === "/download" || path === "/downloads") return "download";
    return "view";
  }

  function pathForRoute(route) {
    if (route === "admin") return "/admin";
    if (route === "slideshow") return "/slide";
    if (route === "download") return "/download";
    return "/";
  }

  function refreshAdminAuth() {
    const loggedIn = isLoggedIn();
    els.loginPanel.classList.toggle("is-hidden", loggedIn);
    els.adminWorkspace.classList.toggle("is-hidden", !loggedIn);
  }

  function routeTo(route, options = {}) {
    currentRoute = route;
    els.viewPage.classList.toggle("is-hidden", route !== "view");
    els.slideshowPage.classList.toggle("is-hidden", route !== "slideshow");
    els.downloadPage.classList.toggle("is-hidden", route !== "download");
    els.adminPage.classList.toggle("is-hidden", route !== "admin");
    document.body.classList.toggle("slideshow-mode", route === "slideshow");
    $$(".nav-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.route === route);
    });

    if (route === "slideshow") {
      startSlideshow();
    } else {
      stopSlideshow();
    }

    const nextPath = pathForRoute(route);
    if (!isBoardMode && location.pathname !== nextPath) {
      const method = options.replace ? "replaceState" : "pushState";
      history[method]({ route }, "", nextPath);
    }
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
          const lengthPenalty = Math.max(0, String(item.title).length - 6) * (compact ? 1 : 1.2);
          const titleMax =
            rowSpan === 1
              ? compact
                ? hasMemo
                  ? 28
                  : 46
                : 22
              : rowSpan === 2
                ? compact
                  ? hasMemo
                    ? 44
                    : 54
                  : 30
                : compact
                  ? hasMemo
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
            hasMemo ? (rowSpan === 1 ? 11 : titleSize * 0.4) : rowSpan === 1 ? 10 : titleSize * 0.32,
            10,
            hasMemo ? (rowSpan === 1 ? 12 : compact ? 18 : 15) : rowSpan === 1 ? 12 : 14
          );
          const titleLines = hasMemo ? (rowSpan === 1 ? 1 : 2) : rowSpan === 1 ? 2 : 3;
          const metaLines = rowSpan === 1 ? 1 : 2;
          const periodStart = placement.periodStart || item.start;
          const periodEnd = placement.periodEnd || item.end;
          const eventScale = isEventCell && compact ? clamp(Number(state.slideshow && state.slideshow.eventFontScale) || 100, 70, 150) / 100 : 1;
          const showMeta = !(isEventCell && compact && !hasMemo);
          return `<div class="${className}${hasMemo ? " has-memo" : " is-no-memo"}${rowSpan === 1 ? " is-single-row" : ""}" style="grid-column:${placement.columnStart}/${placement.columnEnd};grid-row:${placement.rowStart}/${placement.rowEnd};--merge-title-size:${titleSize * eventScale}px;--merge-meta-size:${metaSize}px;--merge-title-lines:${titleLines};--merge-meta-lines:${metaLines};--merge-gap:${rowSpan === 1 ? (hasMemo ? 3 : 1) : 4}px;--merge-padding:${rowSpan === 1 ? 5 : 8}px">
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
            return `<div class="lesson-cell${change ? " is-change" : ""}" style="${placement}">
              <strong>${escapeHtml(subject || "-")}</strong>${memo}
            </div>`;
          })
          .join("");
        return `<div class="period-head row-head" style="grid-column:1;grid-row:${index + 2}">${period}교시</div>${cells}`;
      })
      .join("");

    const lessonScale = variant === "slideshow-grid" ? clamp(Number(state.slideshow && state.slideshow.lessonFontScale) || 100, 70, 150) / 100 : 1;
    return `<div class="schedule-grid class-columns ${variant}" style="--class-count:${visibleClasses.length};--lesson-font-scale:${lessonScale}">
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
      return `<div class="board-lesson is-change${isToday ? " is-today" : ""}">
        <strong>${escapeHtml(change.subject)}</strong>
        <small>${escapeHtml(original)} 변경${change.memo ? ` · ${escapeHtml(change.memo)}` : ""}</small>
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

    notices.forEach((notice, index) => {
      slides.push({
        type: "notice",
        title: "안내사항",
        meta: `${index + 1} / ${notices.length}`,
        html: `<article class="notice-slide" style="--notice-title-size:${clamp(Number(notice.titleFontSize) || 72, 36, 120)}px;--notice-body-size:${clamp(Number(notice.detailFontSize) || 42, 24, 84)}px">
          <h3>${escapeHtml(notice.title)}</h3>
          <p>${escapeHtml(notice.body).replaceAll("\n", "<br />")}</p>
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
    const className = els.baseClass.value;
    const weekday = els.baseWeekday.value;
    const subjects = state.base[className][weekday];
    els.baseEditor.innerHTML = periods
      .map((period, index) => {
        return `<div class="period-input">
          <label for="basePeriod${period}">${period}교시</label>
          <input id="basePeriod${period}" data-period-index="${index}" type="text" value="${escapeHtml(subjects[index] || "")}" />
        </div>`;
      })
      .join("");
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
            return `<article class="list-item">
              <div>
                <strong>일시: ${date} ${weekdayLabel}요일 · 학급: ${className} · 교시: ${period}교시</strong>
                <span>${escapeHtml(originalSubject)} -> ${escapeHtml(change.subject)} · 사유: ${reason}</span>
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
            return `<article class="list-item event-list-item">
              <div>
                <strong>${event.date} · ${escapeHtml(event.title)}</strong>
                <span>${escapeHtml(event.classes.join(", "))} · ${formatPeriodRange(event.start, event.end)}${event.memo ? ` · ${escapeHtml(event.memo)}` : ""}</span>
              </div>
              <button class="text-button" data-delete-event="${event.id}" type="button">삭제</button>
            </article>`;
          })
          .join("")
      : `<p class="empty">등록된 행사가 없습니다.</p>`;
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
    els.slideLessonFontScaleLabel.textContent = `시간표 ${lessonScale}%`;
    els.noticeTitleFontSizeLabel.textContent = `제목 ${titleSize}px`;
    els.noticeFontSizeLabel.textContent = `내용 ${bodySize}px`;
    els.noticePreview.innerHTML = `<article class="notice-preview-card" style="--notice-preview-title-size:${titleSize}px;--notice-preview-size:${bodySize}px">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(body).replaceAll("\n", "<br />")}</p>
    </article>`;
  }

  function renderAdmin() {
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
    renderNoticePreview();
    els.slideInterval.value = state.slideshow.intervalSeconds;
    els.slideRefreshInterval.value = state.slideshow.refreshSeconds || 60;
  }

  function cleanupExpiredScheduleData() {
    const cutoffDate = toISO(mondayOf(new Date()));
    let changed = false;

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
    return isLoggedIn() && Boolean(sessionStorage.getItem("timetable-admin-password"));
  }

  function applyRemoteState(remoteState, options = {}) {
    const { keepNoticeSelection = false, restartSlideshow = true } = options;
    const previousSlideSeconds = Number(state.slideshow.intervalSeconds) || 8;
    const previousRefreshSeconds = Number(state.slideshow.refreshSeconds) || 60;
    state = remoteState;
    const nextSlideSeconds = Number(state.slideshow.intervalSeconds) || 8;
    const nextRefreshSeconds = Number(state.slideshow.refreshSeconds) || 60;
    if (!keepNoticeSelection || !state.notices.some((notice) => notice.id === selectedNoticeId)) {
      selectedNoticeId = state.notices[0] ? state.notices[0].id : "";
    }
    const cleanedExpiredData = canPersistAdminCleanup() && cleanupExpiredScheduleData();
    renderView();
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
      write(state).then((result) => {
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
        `Supabase 연결 실패: 브라우저에 저장된 시간표를 계속 표시합니다. 관리자 저장은 원격 연결이 복구된 뒤 다시 시도하세요. ${
          error.message || "Supabase DB 연결에 실패했습니다."
        }`
      );
    }
  }

  function startRemoteSync() {
    if (remoteUnsubscribe || typeof subscribeRemoteChanges !== "function") return;
    remoteUnsubscribe = subscribeRemoteChanges((remoteState) => {
      applyRemoteState(remoteState, { keepNoticeSelection: true, restartSlideshow: false });
    });
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
    statusBox.className = `global-status is-${type}`;
    statusBox.textContent = message;

    if (options.retry) {
      const retryButton = document.createElement("button");
      retryButton.type = "button";
      retryButton.dataset.retrySave = "true";
      retryButton.textContent = "다시 저장";
      statusBox.appendChild(retryButton);
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
  }

  async function saveState(message) {
    pendingRetryMessage = message;
    const resultPromise = write(state);
    renderView();
    renderAdmin();
    if (currentRoute === "slideshow") {
      startSlideshow();
    }

    const result = await resultPromise;
    if (result && result.ok === false) {
      const detail = result.error || "알 수 없는 오류";
      showGlobalError(`Supabase 저장 실패: 화면에는 반영됐지만 다른 기기에는 아직 공유되지 않았습니다. ${detail}`, {
        retry: true,
      });
      showMessage(els.adminMessage, `브라우저에는 반영됨 · Supabase 저장 실패: ${detail}`);
      return;
    }
    pendingRetryMessage = "";
    clearGlobalStatus();
    showMessage(els.adminMessage, message);
  }

  function retrySaveState() {
    if (!pendingRetryMessage) return;
    showMessage(els.adminMessage, "Supabase에 다시 저장하는 중입니다.");
    saveState(pendingRetryMessage);
  }

  function initControls() {
    fillSelect(els.viewClass, isBoardMode ? classes : ["all", ...classes], (value) => (value === "all" ? "전체 학급" : value));
    fillSelect(els.baseClass, classes);
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
    els.slideEventFontScale.value = clamp(Number(state.slideshow && state.slideshow.eventFontScale) || 100, 70, 150);
    els.slideEventFontScaleLabel.textContent = `행사 ${els.slideEventFontScale.value}%`;
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
    $$(".nav-button").forEach((button) => {
      button.addEventListener("click", () => {
        routeTo(button.dataset.route);
        refreshAdminAuth();
      });
    });

    els.homeButton.addEventListener("click", goHome);
    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-retry-save]")) return;
      retrySaveState();
    });
    document.addEventListener("keydown", (event) => {
      if (currentRoute !== "slideshow") return;
      if (event.target && ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(event.target.tagName)) return;
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        moveSlideshow(1, true);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveSlideshow(-1, true);
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
    els.baseClass.addEventListener("change", renderBaseEditor);
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

    els.loginButton.addEventListener("click", async () => {
      const result = await verifyAdminPassword(els.adminPassword.value);
      if (result.ok) {
        sessionStorage.setItem("timetable-admin", "true");
        els.adminPassword.value = "";
        refreshAdminAuth();
        if (cleanupExpiredScheduleData()) {
          saveState("지난 수업교체/행사를 자동 정리했습니다.");
        } else {
          renderAdmin();
        }
        return;
      }
      showMessage(els.loginMessage, result.error ? `로그인 함수 오류: ${result.error}` : "비밀번호가 올바르지 않습니다.");
    });

    els.adminPassword.addEventListener("keydown", (event) => {
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
        $$(".admin-tab").forEach((tab) => tab.classList.toggle("is-active", tab === button));
        $$(".admin-panel").forEach((panel) => panel.classList.add("is-hidden"));
        $(`#${button.dataset.adminTab}Panel`).classList.remove("is-hidden");
      });
    });

    els.saveBaseButton.addEventListener("click", () => {
      const className = els.baseClass.value;
      const weekday = els.baseWeekday.value;
      state.base[className][weekday] = $$("#baseEditor input").map((input) => input.value.trim());
      saveState("기본 시간표를 저장했습니다.");
    });

    els.saveBaseMergeButton.addEventListener("click", () => {
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
      saveState("기본 병합을 저장했습니다.");
    });

    els.saveSpecialButton.addEventListener("click", () => {
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
      saveState("특별시간표를 저장했습니다.");
    });

    els.deleteSpecialButton.addEventListener("click", () => {
      const date = els.specialDate.value;
      if (!state.specialSchedules[date]) {
        showMessage(els.adminMessage, "삭제할 특별시간표가 없습니다.");
        return;
      }
      if (!confirmAction(`${date} 특별시간표를 삭제할까요?`)) return;
      delete state.specialSchedules[date];
      renderSpecialEditor();
      saveState("특별시간표를 삭제했습니다.");
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
      if (!confirmAction("기본 병합을 삭제할까요?")) return;
      state.baseMerges = state.baseMerges.filter((merge) => merge.id !== button.dataset.deleteBaseMerge);
      saveState("기본 병합을 삭제했습니다.");
    });

    els.saveChangeButton.addEventListener("click", () => {
      const subject = els.changeSubject.value.trim();
      if (!els.changeDate.value || !subject) {
        showMessage(els.adminMessage, "날짜와 변경 교과를 입력하세요.");
        return;
      }
      const key = changeKey(els.changeDate.value, els.changeClass.value, els.changePeriod.value);
      state.changes[key] = { subject, memo: els.changeMemo.value.trim() };
      els.changeSubject.value = "";
      els.changeMemo.value = "";
      saveState("단일교과 변경을 저장했습니다.");
    });

    els.deleteChangeButton.addEventListener("click", () => {
      const key = changeKey(els.changeDate.value, els.changeClass.value, els.changePeriod.value);
      if (!state.changes[key]) {
        showMessage(els.adminMessage, "삭제할 단일 변경이 없습니다.");
        return;
      }
      if (!confirmAction("해당 단일교과 변경을 삭제할까요?")) return;
      delete state.changes[key];
      saveState("해당 단일 변경을 삭제했습니다.");
    });

    els.changeList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-revert-change]");
      if (!button) return;
      if (!confirmAction("해당 교과 변경을 되돌릴까요?")) return;
      delete state.changes[button.dataset.revertChange];
      saveState("해당 교과 변경을 되돌렸습니다.");
    });

    els.saveEventButton.addEventListener("click", () => {
      const title = els.eventTitle.value.trim();
      const start = Number(els.eventStart.value);
      const end = Number(els.eventEnd.value);
      const eventClasses = $$("#eventClassChecks input:checked").map((input) => input.value);
      if (!els.eventDate.value || !title || eventClasses.length === 0 || start > end) {
        showMessage(els.adminMessage, "행사 날짜, 이름, 학급, 교시 범위를 확인하세요.");
        return;
      }
      state.events.push({
        id: `${Date.now()}`,
        date: els.eventDate.value,
        title,
        start,
        end,
        classes: eventClasses,
        memo: els.eventMemo.value.trim(),
      });
      els.eventTitle.value = "";
      els.eventMemo.value = "";
      saveState("행사 시간표를 저장했습니다.");
    });

    els.eventList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-event]");
      if (!button) return;
      if (!confirmAction("행사를 삭제할까요?")) return;
      state.events = state.events.filter((item) => item.id !== button.dataset.deleteEvent);
      saveState("행사를 삭제했습니다.");
    });

    els.slideEventFontScale.addEventListener("input", () => {
      const scale = clamp(Number(els.slideEventFontScale.value) || 100, 70, 150);
      els.slideEventFontScaleLabel.textContent = `행사 ${scale}%`;
    });

    els.slideEventFontScale.addEventListener("change", () => {
      state.slideshow.eventFontScale = clamp(Number(els.slideEventFontScale.value) || 100, 70, 150);
      if (currentRoute === "slideshow") renderSlideshow();
      saveState("슬라이드쇼 행사 글자 크기를 저장했습니다.");
    });

    [els.noticeTitle, els.noticeBody, els.slideLessonFontScale, els.noticeTitleFontSize, els.noticeFontSize].forEach((input) => {
      input.addEventListener("input", renderNoticePreview);
    });

    els.slideLessonFontScale.addEventListener("change", () => {
      state.slideshow.lessonFontScale = clamp(Number(els.slideLessonFontScale.value) || 100, 70, 150);
      renderView();
      if (currentRoute === "slideshow") renderSlideshow();
      saveState("슬라이드쇼 시간표 글자 크기를 저장했습니다.");
    });

    els.addNoticeButton.addEventListener("click", () => {
      loadNoticeEditor("");
      els.noticeTitle.focus();
      showMessage(els.adminMessage, "새 안내 페이지 내용을 입력한 뒤 저장하세요.");
    });

    els.saveNoticeButton.addEventListener("click", () => {
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
      saveState("안내사항을 저장했습니다.");
    });

    els.noticeList.addEventListener("click", (event) => {
      const deleteButton = event.target.closest("[data-delete-notice]");
      if (deleteButton) {
        if (!confirmAction("안내사항을 삭제할까요?")) return;
        state.notices = state.notices.filter((notice) => notice.id !== deleteButton.dataset.deleteNotice);
        if (selectedNoticeId === deleteButton.dataset.deleteNotice) {
          selectedNoticeId = state.notices[0] ? state.notices[0].id : "";
          loadNoticeEditor(selectedNoticeId);
        }
        saveState("안내사항을 삭제했습니다.");
        return;
      }

      const item = event.target.closest("[data-select-notice]");
      if (!item) return;
      loadNoticeEditor(item.dataset.selectNotice);
    });

    els.saveSlideSettingsButton.addEventListener("click", () => {
      const interval = Math.max(3, Math.min(120, Number(els.slideInterval.value) || 8));
      const refreshInterval = Math.max(10, Math.min(3600, Number(els.slideRefreshInterval.value) || 60));
      state.slideshow.intervalSeconds = interval;
      state.slideshow.refreshSeconds = refreshInterval;
      els.slideInterval.value = interval;
      els.slideRefreshInterval.value = refreshInterval;
      saveState("슬라이드쇼 설정을 저장했습니다.");
    });
  }

  function init() {
    document.body.classList.toggle("board-mode", isBoardMode);
    currentRoute = isBoardMode ? "view" : routeFromPath();
    initControls();
    applyBoardTheme();
    bindEvents();
    refreshAdminAuth();
    renderView();
    renderAdmin();
    routeTo(currentRoute);
    startRemoteSync();
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
