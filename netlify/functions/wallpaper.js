const SUPABASE_URL = process.env.SUPABASE_URL || "https://jzcectvzwbfvbgiszjkt.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || "sb_publishable_JgPxLeD5pJjk46GnS-n3ZQ_gzZmIIuq";

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

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function kstNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function fromISO(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function mondayOf(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDate(value) {
  const date = fromISO(value);
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

function weekdayForDate(value) {
  const dayIndex = fromISO(value).getDay();
  return weekdays[dayIndex - 1] || weekdays[0];
}

function changeKey(date, className, period) {
  return `${date}__${className}__${period}`;
}

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

function defaultState() {
  return {
    base: makeDefaultBase(),
    baseMerges: [],
    specialSchedules: {},
    changes: {},
    events: [],
  };
}

function normalizeState(value) {
  const parsed = value && typeof value === "object" ? value : {};
  const defaults = defaultState();
  return {
    ...defaults,
    ...parsed,
    base: parsed.base || defaults.base,
    baseMerges: Array.isArray(parsed.baseMerges) ? parsed.baseMerges : [],
    specialSchedules: parsed.specialSchedules || {},
    changes: parsed.changes || {},
    events: Array.isArray(parsed.events) ? parsed.events : [],
  };
}

async function readState() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.main&select=data`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!response.ok) return defaultState();
    const rows = await response.json();
    return normalizeState(rows && rows[0] && rows[0].data);
  } catch {
    return defaultState();
  }
}

function schoolDaysForCurrentWeek(now = kstNow()) {
  const start = mondayOf(now);
  return weekdays.map((weekday, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { iso: toISO(date), weekday };
  });
}

function getSubjectsForDate(state, date, className) {
  const special = state.specialSchedules[date] && state.specialSchedules[date][className];
  if (Array.isArray(special)) return special;
  return state.base[className][weekdayForDate(date).key] || periods.map(() => "");
}

function getEventsForDate(state, date) {
  return state.events.filter((event) => event.date === date);
}

function getBaseMergesForDate(state, date) {
  const weekdayKey = weekdayForDate(date).key;
  return state.baseMerges.filter((merge) => merge.weekday === weekdayKey);
}

function lessonFor(state, date, className, period, periodIndex) {
  const event = getEventsForDate(state, date).find((item) => {
    return item.classes.includes(className) && period >= item.start && period <= item.end;
  });
  if (event) return { title: event.title, type: "event" };

  const change = state.changes[changeKey(date, className, period)];
  if (change) return { title: change.subject, type: "change" };

  const merge = getBaseMergesForDate(state, date).find((item) => {
    return item.classes.includes(className) && period >= item.start && period <= item.end;
  });
  if (merge) return { title: merge.title, type: "merge" };

  return { title: getSubjectsForDate(state, date, className)[periodIndex] || "-", type: "base" };
}

function splitParam(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderText(text, x, y, options = {}) {
  const size = options.size || 34;
  const weight = options.weight || 800;
  const fill = options.fill || "#f8fafc";
  const anchor = options.anchor ? ` text-anchor="${options.anchor}"` : "";
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}"${anchor}>${escapeXml(text)}</text>`;
}

function renderPill(text, x, y, color = "teal") {
  const width = Math.max(112, text.length * 28 + 58);
  const bg = color === "change" ? "#3b3320" : "#123c3f";
  const line = color === "change" ? "#fde68a" : "#2dd4bf";
  const fg = color === "change" ? "#fef3c7" : "#ecfeff";
  return `
    <rect x="${x}" y="${y}" width="${width}" height="46" rx="23" fill="${bg}" stroke="${line}" stroke-width="2" />
    ${renderText(text, x + width / 2, y + 31, { size: 24, fill: fg, anchor: "middle", weight: 900 })}
  `;
}

function renderWallpaperSvg(state, query) {
  const subjects = splitParam(query.subjects || query.subject || query.s);
  const subjectSet = new Set(subjects);
  const selectedDays = splitParam(query.days || query.day || query.d);
  const allowedDaySet = new Set(selectedDays.length ? selectedDays : weekdays.map((day) => day.key));
  const now = kstNow();
  const today = toISO(now);
  const days = schoolDaysForCurrentWeek(now).filter((day) => allowedDaySet.has(day.weekday.key));

  let y = 190;
  const dayBlocks = days
    .map((day) => {
      const rows = [];
      periods.forEach((period, periodIndex) => {
        const matches = classes
          .map((className) => {
            const lesson = lessonFor(state, day.iso, className, period, periodIndex);
            if (!subjectSet.has(lesson.title)) return null;
            return { className, ...lesson };
          })
          .filter(Boolean);
        if (matches.length) rows.push({ period, matches });
      });

      const blockHeight = Math.max(124, 88 + rows.length * 58);
      const isToday = day.iso === today;
      const block = `
        <rect x="58" y="${y}" width="1054" height="${blockHeight}" rx="34" fill="${isToday ? "#12433f" : "#101826"}" stroke="${
        isToday ? "#2dd4bf" : "#334155"
      }" stroke-width="3" />
        ${renderText(`${day.weekday.label}요일`, 96, y + 58, { size: 34 })}
        ${renderText(`${formatDate(day.iso)}${isToday ? " · 오늘" : ""}`, 1018, y + 58, {
          size: 24,
          fill: "#cbd5e1",
          anchor: "end",
        })}
        ${
          rows.length
            ? rows
                .map((row, rowIndex) => {
                  const rowY = y + 94 + rowIndex * 58;
                  let pillX = 212;
                  const pills = row.matches
                    .map((match) => {
                      const label = `${match.className} ${match.title}`;
                      const pill = renderPill(label, pillX, rowY - 34, match.type === "change" ? "change" : "teal");
                      pillX += Math.max(112, label.length * 28 + 58) + 12;
                      return pill;
                    })
                    .join("");
                  return `${renderText(`${row.period}교시`, 96, rowY, { size: 24, fill: "#bfdbfe" })}${pills}`;
                })
                .join("")
            : renderText("선택 과목 수업 없음", 96, y + 105, { size: 25, fill: "#94a3b8" })
        }
      `;
      y += blockHeight + 24;
      return block;
    })
    .join("");

  const subjectLabel = subjects.length ? subjects.join(", ") : "subjects 파라미터 필요";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1170" height="2532" viewBox="0 0 1170 2532">
  <rect width="1170" height="2532" fill="#07111d" />
  <circle cx="104" cy="44" r="260" fill="#2dd4bf" opacity="0.18" />
  <circle cx="1130" cy="2480" r="360" fill="#3b82f6" opacity="0.12" />
  <g font-family="Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif">
    ${renderText("용정 시간표", 64, 82, { size: 26, fill: "#5eead4", weight: 900 })}
    ${renderText("내 과목 주간표", 64, 138, { size: 54, weight: 900 })}
    ${renderText(subjectLabel, 64, 176, { size: 25, fill: "#cbd5e1", weight: 800 })}
    ${dayBlocks}
    ${renderText(`업데이트 ${today}`, 585, 2470, { size: 24, fill: "#64748b", anchor: "middle" })}
  </g>
</svg>`;
}

exports.handler = async (event) => {
  const state = await readState();
  const svg = renderWallpaperSvg(state, event.queryStringParameters || {});
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
    body: svg,
  };
};
