(function (global) {
  function countdownLabel(targetDate, now = new Date()) {
    if (typeof targetDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return "";
    const target = new Date(targetDate + "T00:00:00Z");
    if (!Number.isFinite(target.getTime()) || target.toISOString().slice(0, 10) !== targetDate) return "";
    const today = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const days = Math.round((target.getTime() - Date.parse(today + "T00:00:00Z")) / 86400000);
    return days === 0 ? "D-day" : days > 0 ? "D-" + days : "D+" + -days;
  }

  function renderCountdown(targetDate) {
    const label = countdownLabel(targetDate);
    if (!label) return "";
    return '<div class="notice-countdown"><strong>' + label + '</strong><time datetime="' + targetDate + '">' + targetDate + '</time></div>';
  }

  const api = { countdownLabel, renderCountdown };
  global.TimetableNotices = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
