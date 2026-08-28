(function () {
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

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

  window.TimetableAppUtils = {
    clamp,
    escapeHtml,
    fillSelect,
    formatDate,
    fromISO,
    mondayOf,
    nextDateIso,
    pad,
    toISO,
  };
})();
