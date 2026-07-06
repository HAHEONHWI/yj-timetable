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

function normalizedGrades(value) {
  const grades = Array.isArray(value) ? value.map(String) : [];
  const filtered = grades.filter((grade) => ["1", "2", "3"].includes(grade));
  return filtered.length ? [...new Set(filtered)] : ["1", "2", "3"];
}

function parseGradesParam(value, subjects) {
  const result = Object.fromEntries(subjects.map((subject) => [subject, ["1", "2", "3"]]));
  String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const [subject, grades] = entry.split(":");
      if (!subject) return;
      result[subject.trim()] = normalizedGrades(String(grades || "").split("|"));
    });
  return result;
}

function gradeForClass(className) {
  return String(className || "").split("-")[0];
}

function isSubjectAllowed(gradesBySubject, subject, className) {
  return normalizedGrades(gradesBySubject[subject]).includes(gradeForClass(className));
}

function matchesForCell(state, date, className, period, periodIndex, subjects, gradesBySubject) {
  const subjectSet = new Set(subjects);
  const matches = [];
  const original = getSubjectsForDate(state, date, className)[periodIndex] || "-";
  const change = state.changes[changeKey(date, className, period)];

  if (change) {
    if (subjectSet.has(change.subject) && isSubjectAllowed(gradesBySubject, change.subject, className)) {
      matches.push({ className, title: change.subject, note: `${original}에서 변경`, type: "change" });
    }
    if (subjectSet.has(original) && isSubjectAllowed(gradesBySubject, original, className)) {
      matches.push({ className, title: original, note: `${change.subject}로 변경됨`, type: "original" });
    }
    return matches;
  }

  const lesson = lessonFor(state, date, className, period, periodIndex);
  if (subjectSet.has(lesson.title) && isSubjectAllowed(gradesBySubject, lesson.title, className)) {
    matches.push({ className, title: lesson.title, note: "", type: lesson.type });
  }
  return matches;
}

function renderText(text, x, y, options = {}) {
  const size = options.size || 34;
  const weight = options.weight || 800;
  const fill = options.fill || "#f8fafc";
  const anchor = options.anchor ? ` text-anchor="${options.anchor}"` : "";
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}"${anchor}>${escapeXml(text)}</text>`;
}

function chipColors(type) {
  if (type === "change") return { bg: "#fef3c7", line: "#f59e0b", fg: "#451a03", note: "#92400e" };
  if (type === "original") return { bg: "#f1f5f9", line: "#94a3b8", fg: "#334155", note: "#64748b" };
  if (type === "event" || type === "merge") return { bg: "#ccfbf1", line: "#14b8a6", fg: "#134e4a", note: "#0f766e" };
  return { bg: "#ffffff", line: "#0f172a", fg: "#0f172a", note: "#475569" };
}

function renderChip(match, x, y, width, height) {
  const colors = chipColors(match.type);
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="${colors.bg}" stroke="${colors.line}" stroke-width="2" />
    ${renderText(match.className, x + width / 2, y + 22, { size: 23, fill: colors.fg, anchor: "middle", weight: 900 })}
    ${renderText(match.title, x + width / 2, y + 45, { size: 19, fill: colors.fg, anchor: "middle", weight: 900 })}
    ${match.note ? renderText(match.note, x + width / 2, y + 64, { size: 13, fill: colors.note, anchor: "middle", weight: 800 }) : ""}
  `;
}

function renderWallpaperSvg(state, query) {
  const subjects = splitParam(query.subjects || query.subject || query.s);
  const gradesBySubject = parseGradesParam(query.grades || query.grade || query.g, subjects);
  const selectedDays = splitParam(query.days || query.day || query.d);
  const allowedDaySet = new Set(selectedDays.length ? selectedDays : weekdays.map((day) => day.key));
  const now = kstNow();
  const today = toISO(now);
  const days = schoolDaysForCurrentWeek(now).filter((day) => allowedDaySet.has(day.weekday.key));

  const tableX = 46;
  const tableY = 238;
  const tableWidth = 1078;
  const periodWidth = 92;
  const dayWidth = (tableWidth - periodWidth) / Math.max(days.length, 1);
  const headerHeight = 76;
  const rowHeight = 160;
  const tableHeight = headerHeight + periods.length * rowHeight;

  const headerCells = days
    .map((day, index) => {
      const x = tableX + periodWidth + index * dayWidth;
      const isToday = day.iso === today;
      return `
        <rect x="${x}" y="${tableY}" width="${dayWidth}" height="${headerHeight}" fill="${isToday ? "#134e4a" : "#0b0f18"}" stroke="#f8fafc" stroke-width="3" />
        ${renderText(day.weekday.label, x + dayWidth / 2, tableY + 34, { size: 28, anchor: "middle", weight: 900 })}
        ${renderText(formatDate(day.iso), x + dayWidth / 2, tableY + 62, { size: 18, fill: "#cbd5e1", anchor: "middle", weight: 800 })}
      `;
    })
    .join("");

  const rows = periods
    .map((period, periodIndex) => {
      const y = tableY + headerHeight + periodIndex * rowHeight;
      const periodCell = `
        <rect x="${tableX}" y="${y}" width="${periodWidth}" height="${rowHeight}" fill="#0b0f18" stroke="#f8fafc" stroke-width="3" />
        ${renderText(`P${period}`, tableX + periodWidth / 2, y + 66, { size: 28, anchor: "middle", weight: 900 })}
        ${renderText(`${period}교시`, tableX + periodWidth / 2, y + 96, { size: 15, fill: "#cbd5e1", anchor: "middle", weight: 800 })}
      `;
      const dayCells = days
        .map((day, dayIndex) => {
          const x = tableX + periodWidth + dayIndex * dayWidth;
          const matches = classes.flatMap((className) =>
            matchesForCell(state, day.iso, className, period, periodIndex, subjects, gradesBySubject)
          );
          const chipWidth = Math.max(92, dayWidth / 2 - 10);
          const chipHeight = 70;
          const chips = matches
            .slice(0, 4)
            .map((match, matchIndex) => {
              const chipX = x + 8 + (matchIndex % 2) * (chipWidth + 8);
              const chipY = y + 10 + Math.floor(matchIndex / 2) * (chipHeight + 8);
              return renderChip(match, chipX, chipY, chipWidth, chipHeight);
            })
            .join("");
          const overflow =
            matches.length > 4
              ? renderText(`+${matches.length - 4}`, x + dayWidth - 22, y + rowHeight - 14, {
                  size: 18,
                  fill: "#64748b",
                  anchor: "end",
                })
              : "";
          return `<rect x="${x}" y="${y}" width="${dayWidth}" height="${rowHeight}" fill="#ffffff" stroke="#0f172a" stroke-width="3" />${chips}${overflow}`;
        })
        .join("");
      return periodCell + dayCells;
    })
    .join("");

  const subjectLabel = subjects.length ? subjects.join(", ") : "subjects 파라미터 필요";
  const gradeLabel = subjects
    .map((subject) => `${subject} ${normalizedGrades(gradesBySubject[subject]).join("")}학년`)
    .join(" · ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1170" height="2532" viewBox="0 0 1170 2532">
  <rect width="1170" height="2532" fill="#f8fafc" />
  <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse">
    <path d="M 34 0 L 0 0 0 34" fill="none" stroke="#e2e8f0" stroke-width="2"/>
  </pattern>
  <rect width="1170" height="2532" fill="url(#grid)" />
  <circle cx="76" cy="356" r="240" fill="#fde68a" opacity="0.72" />
  <circle cx="1048" cy="390" r="210" fill="#fca5a5" opacity="0.55" />
  <circle cx="1080" cy="2260" r="310" fill="#fde68a" opacity="0.75" />
  <circle cx="120" cy="2220" r="260" fill="#5eead4" opacity="0.7" />
  <g font-family="Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif">
    ${renderText("용정 시간표", 64, 78, { size: 28, fill: "#475569", weight: 900 })}
    ${renderText("내 과목 주간표", 64, 142, { size: 62, fill: "#0f172a", weight: 900 })}
    ${renderText(subjectLabel, 64, 184, { size: 28, fill: "#0f766e", weight: 900 })}
    ${renderText(gradeLabel, 64, 218, { size: 20, fill: "#64748b", weight: 800 })}
    <rect x="${tableX}" y="${tableY}" width="${periodWidth}" height="${headerHeight}" fill="#0b0f18" stroke="#f8fafc" stroke-width="3" />
    ${renderText("교시", tableX + periodWidth / 2, tableY + 48, { size: 24, anchor: "middle", weight: 900 })}
    ${headerCells}
    ${rows}
    <rect x="0" y="1824" width="1170" height="78" fill="#0b0f18" />
    ${renderText("변경: 노란색 · 원래 있던 수업이 변경된 경우: 회색", 585, 1874, {
      size: 24,
      anchor: "middle",
      weight: 900,
    })}
    ${renderText(`업데이트 ${today}`, 585, 2470, { size: 24, fill: "#475569", anchor: "middle" })}
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
