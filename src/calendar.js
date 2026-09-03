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
        return className === "all" || (Array.isArray(event.classes) && event.classes.includes(className));
      })
      .slice()
      .sort((first, second) => first.date.localeCompare(second.date) || String(first.title || "").localeCompare(String(second.title || ""), "ko"));
  }

  const api = { buildMonthGrid, eventsForMonth, shiftMonth };
  global.TimetableCalendar = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
