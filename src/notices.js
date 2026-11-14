(function (global) {
  function countdownLabel(targetDate, now = new Date()) {
    if (typeof targetDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return "";
    const target = new Date(targetDate + "T00:00:00Z");
    if (!Number.isFinite(target.getTime()) || target.toISOString().slice(0, 10) !== targetDate) return "";
    const today = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const days = Math.round((target.getTime() - Date.parse(today + "T00:00:00Z")) / 86400000);
    return days === 0 ? "D-day" : days > 0 ? "D-" + days : "D+" + -days;
  }

  function renderCountdown(targetDate, title = "") {
    const label = countdownLabel(targetDate);
    if (!label || typeof title !== "string" || !title.trim()) return "";
    const safeTitle = title.trim().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
    return '<section class="notice-countdown" aria-label="디데이"><h4>' + safeTitle + '</h4><strong>' + label + '</strong><time datetime="' + targetDate + '">' + targetDate + '</time></section>';
  }

  const api = { countdownLabel, renderCountdown };
  global.TimetableNotices = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
