const { Resvg } = require("@resvg/resvg-js");

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
  if (type === "change") return { bg: "rgba(245, 158, 11, 0.18)", line: "#f59e0b", fg: "#fef3c7", note: "#fbbf24" };
  if (type === "original") return { bg: "rgba(148, 163, 184, 0.18)", line: "#94a3b8", fg: "#cbd5e1", note: "#94a3b8" };
  if (type === "event" || type === "merge") return { bg: "rgba(20, 184, 166, 0.18)", line: "#14b8a6", fg: "#ccfbf1", note: "#2dd4bf" };
  return { bg: "rgba(30, 41, 59, 0.6)", line: "#475569", fg: "#e2e8f0", note: "#94a3b8" };
}

function renderChip(match, x, y, width, height, isFullSize = false) {
  const colors = chipColors(match.type);
  const classSize = isFullSize ? 28 : 23;
  const titleSize = isFullSize ? 36 : 19;
  const noteSize = isFullSize ? 18 : 13;

  const classY = isFullSize ? y + 42 : y + 22;
  const titleY = isFullSize ? y + 84 : y + 45;
  const noteY = isFullSize ? y + 118 : y + 64;

  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="${colors.bg}" stroke="${colors.line}" stroke-width="2" />
    ${renderText(match.className, x + width / 2, classY, { size: classSize, fill: colors.fg, anchor: "middle", weight: 900 })}
    ${renderText(match.title, x + width / 2, titleY, { size: titleSize, fill: colors.fg, anchor: "middle", weight: 900 })}
    ${match.note ? renderText(match.note, x + width / 2, noteY, { size: noteSize, fill: colors.note, anchor: "middle", weight: 800 }) : ""}
  `;
}

function renderWallpaperSvg(state, query) {
  const name = query.name || query.n || "";
  const titleLabel = name ? `${name} 선생님의 이번 주 시간표` : "내 과목 주간표";
  const titleSize = name ? (name.length > 5 ? 44 : 52) : 62;
  const subjects = splitParam(query.subjects || query.subject || query.s);
  const gradesBySubject = parseGradesParam(query.grades || query.grade || query.g, subjects);
  const selectedDays = splitParam(query.days || query.day || query.d);
  const allowedDaySet = new Set(selectedDays.length ? selectedDays : weekdays.map((day) => day.key));
  const now = kstNow();
  const today = toISO(now);
  const days = schoolDaysForCurrentWeek(now).filter((day) => allowedDaySet.has(day.weekday.key));

  const tableX = 0;
  const tableY = 720;
  const tableWidth = 1170;
  const periodWidth = 110;
  const dayWidth = (tableWidth - periodWidth) / Math.max(days.length, 1);
  const headerHeight = 76;
  const rowHeight = 160;
  const tableHeight = headerHeight + periods.length * rowHeight;

  const headerCells = days
    .map((day, index) => {
      const x = tableX + periodWidth + index * dayWidth;
      const isToday = day.iso === today;
      return `
        <rect x="${x}" y="${tableY}" width="${dayWidth}" height="${headerHeight}" fill="${isToday ? "#1e293b" : "#0f172a"}" fill-opacity="0.85" stroke="#334155" stroke-width="2" />
        ${renderText(day.weekday.label, x + dayWidth / 2, tableY + 34, { size: 28, anchor: "middle", weight: 900 })}
        ${renderText(formatDate(day.iso), x + dayWidth / 2, tableY + 62, { size: 18, fill: isToday ? "#2dd4bf" : "#64748b", anchor: "middle", weight: 800 })}
      `;
    })
    .join("");

  const rows = periods
    .map((period, periodIndex) => {
      const y = tableY + headerHeight + periodIndex * rowHeight;
      const periodCell = `
        <rect x="${tableX}" y="${y}" width="${periodWidth}" height="${rowHeight}" fill="#0f172a" fill-opacity="0.85" stroke="#334155" stroke-width="2" />
        ${renderText(`${period}교시`, tableX + periodWidth / 2, y + 90, { size: 23, fill: "#f8fafc", anchor: "middle", weight: 900 })}
      `;
      const dayCells = days
        .map((day, dayIndex) => {
          const x = tableX + periodWidth + dayIndex * dayWidth;
          const matches = classes.flatMap((className) =>
            matchesForCell(state, day.iso, className, period, periodIndex, subjects, gradesBySubject)
          );

          let chips = "";
          if (matches.length === 1) {
            const chipWidth = dayWidth - 16;
            const chipHeight = rowHeight - 20;
            chips = renderChip(matches[0], x + 8, y + 10, chipWidth, chipHeight, true);
          } else if (matches.length === 2) {
            const chipWidth = dayWidth / 2 - 12;
            const chipHeight = rowHeight - 20;
            chips = matches
              .map((match, matchIndex) => {
                const chipX = x + 8 + matchIndex * (chipWidth + 8);
                return renderChip(match, chipX, y + 10, chipWidth, chipHeight, false);
              })
              .join("");
          } else {
            const chipWidth = Math.max(92, dayWidth / 2 - 10);
            const chipHeight = 70;
            chips = matches
              .slice(0, 4)
              .map((match, matchIndex) => {
                const chipX = x + 8 + (matchIndex % 2) * (chipWidth + 8);
                const chipY = y + 10 + Math.floor(matchIndex / 2) * (chipHeight + 8);
                return renderChip(match, chipX, chipY, chipWidth, chipHeight, false);
              })
              .join("");
          }

          const overflow =
            matches.length > 4
              ? renderText(`+${matches.length - 4}`, x + dayWidth - 22, y + rowHeight - 14, {
                  size: 18,
                  fill: "#94a3b8",
                  anchor: "end",
                })
              : "";
          return `<rect x="${x}" y="${y}" width="${dayWidth}" height="${rowHeight}" fill="#1e293b" fill-opacity="0.4" stroke="#334155" stroke-width="2" />${chips}${overflow}`;
        })
        .join("");
      return periodCell + dayCells;
    })
    .join("");

  const subjectLabel = subjects.length ? subjects.join(", ") : "선택된 과목이 없습니다.";
  const gradeLabel = subjects
    .map((subject) => `${subject} ${normalizedGrades(gradesBySubject[subject]).join(",")}학년`)
    .join(" · ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1170" height="2532" viewBox="0 0 1170 2532">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="90" />
    </filter>
  </defs>
  <rect width="1170" height="2532" fill="#090d16" />
  <circle cx="120" cy="850" r="300" fill="#3b82f6" opacity="0.22" filter="url(#glow)" />
  <circle cx="1000" cy="950" r="280" fill="#8b5cf6" opacity="0.18" filter="url(#glow)" />
  <circle cx="1000" cy="2100" r="350" fill="#ec4899" opacity="0.15" filter="url(#glow)" />
  <circle cx="150" cy="2000" r="320" fill="#14b8a6" opacity="0.18" filter="url(#glow)" />
  <g font-family="Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif">
    ${renderText("용정 시간표", 64, 530, { size: 28, fill: "#64748b", weight: 900 })}
    ${renderText(titleLabel, 64, 594, { size: titleSize, fill: "#f8fafc", weight: 900 })}
    ${renderText(subjectLabel, 64, 640, { size: 28, fill: "#2dd4bf", weight: 900 })}
    ${renderText(gradeLabel, 64, 674, { size: 20, fill: "#64748b", weight: 800 })}
    <rect x="${tableX}" y="${tableY}" width="${periodWidth}" height="${headerHeight}" fill="#0f172a" fill-opacity="0.85" stroke="#334155" stroke-width="2" />
    ${renderText("교시", tableX + periodWidth / 2, tableY + 48, { size: 24, fill: "#f8fafc", anchor: "middle", weight: 900 })}
    ${headerCells}
    ${rows}
    <rect x="46" y="2260" width="1078" height="78" fill="#0f172a" fill-opacity="0.8" stroke="#334155" stroke-width="2" rx="12" />
    ${renderText("수업 변경: 주황색 · 취소된 원래 수업: 회색 · 행사: 민트색", 585, 2306, {
      size: 20,
      fill: "#94a3b8",
      anchor: "middle",
      weight: 800,
    })}
    ${renderText(`업데이트 ${today}`, 585, 2470, { size: 24, fill: "#475569", anchor: "middle" })}
  </g>
</svg>`;
}

exports.handler = async (event) => {
  const state = await readState();
  const query = event.queryStringParameters || {};
  const svg = renderWallpaperSvg(state, query);

  const isPng = (event.path && event.path.endsWith(".png")) || query.format === "png";
  if (isPng) {
    try {
      const resvg = new Resvg(svg, {
        fitTo: { mode: "width", value: 1170 },
      });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
        body: pngBuffer.toString("base64"),
        isBase64Encoded: true,
      };
    } catch (err) {
      console.error("PNG conversion failed:", err);
    }
  }

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
