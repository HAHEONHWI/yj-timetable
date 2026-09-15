(function (global) {
  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function parseMonth(monthKey) {
    const match = String(monthKey).match(/^(\d{4})-(\d{2})$/);
    if (!match) throw new Error("월은 YYYY-MM 형식이어야 합니다.");
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    if (monthIndex < 0 || monthIndex > 11) throw new Error("월은 01~12 범위여야 합니다.");
    return { year, monthIndex };
  }

  function toISO(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function buildMonthGrid(monthKey) {
    const { year, monthIndex } = parseMonth(monthKey);
    const firstDay = new Date(year, monthIndex, 1);
    const gridStart = new Date(year, monthIndex, 1 - firstDay.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return {
        iso: toISO(date),
        day: date.getDate(),
        inMonth: date.getMonth() === monthIndex,
      };
    });
  }

  function shiftMonth(monthKey, offset) {
    const { year, monthIndex } = parseMonth(monthKey);
    const date = new Date(year, monthIndex + Number(offset), 1);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  function eventsForMonth(events, monthKey, className = "all") {
    return (Array.isArray(events) ? events : [])
      .filter((event) => {
        if (!event || typeof event.date !== "string" || !event.date.startsWith(`${monthKey}-`)) return false;
        if (className === "all") return true;
        if (Array.isArray(event.classes)) return event.classes.includes(className);
        if (!Array.isArray(event.grades)) return false;
        const grade = Number(String(className).split("-")[0]);
        return event.grades.length === 0 || event.grades.includes(grade);
      })
      .slice()
      .sort((first, second) => first.date.localeCompare(second.date) || String(first.title || "").localeCompare(String(second.title || ""), "ko"));
  }


  function monthKeyOf(dateISO) {
    const match = String(dateISO).match(/^(\d{4})-(\d{2})-\d{2}$/);
    return match ? `${match[1]}-${match[2]}` : "";
  }

  function upsertEvent(events, event) {
    if (!event || typeof event.id !== "string" || !event.id) throw new Error("학사일정에는 id가 필요합니다.");
    const list = Array.isArray(events) ? events.slice() : [];
    const index = list.findIndex((item) => item && item.id === event.id);
    if (index === -1) list.push(event);
    else list[index] = event;
    return list.sort((first, second) => String(first.date).localeCompare(String(second.date)) || String(first.title || "").localeCompare(String(second.title || ""), "ko"));
  }

  function specialSaturdayDatesFromSundayEvents(events, cutoffDate, specialSchedules) {
    const existing = specialSchedules && typeof specialSchedules === "object" ? specialSchedules : {};
    const saturdayDates = new Set();
    (Array.isArray(events) ? events : []).forEach((event) => {
      if (!event || event.source !== "neis" || !event.isSchoolDay) return;
      const match = String(event.date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return;
      const sunday = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      if (toISO(sunday) !== event.date || sunday.getDay() !== 0) return;
      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      const saturdayISO = toISO(saturday);
      if (saturdayISO >= cutoffDate && !existing[saturdayISO]) saturdayDates.add(saturdayISO);
    });
    return [...saturdayDates].sort();
  }

  const api = { buildMonthGrid, eventsForMonth, monthKeyOf, shiftMonth, specialSaturdayDatesFromSundayEvents, upsertEvent };
  global.TimetableCalendar = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
