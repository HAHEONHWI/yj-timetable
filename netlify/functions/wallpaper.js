const { Resvg } = require("@resvg/resvg-js");
const path = require("path");
const fs = require("fs");

let activeFontDir = null;
let activeFontPath = null;
const fontPaths = [
  path.join(__dirname, "fonts", "NanumGothic-Bold.ttf"),
  path.join(__dirname, "netlify", "functions", "fonts", "NanumGothic-Bold.ttf"),
  path.join(process.cwd(), "netlify", "functions", "fonts", "NanumGothic-Bold.ttf"),
];

for (const fp of fontPaths) {
  try {
    if (fs.existsSync(fp)) {
      activeFontDir = path.dirname(fp);
      activeFontPath = fp;
      break;
    }
  } catch (err) {
    // ignore
  }
}

if (!activeFontDir) {
  console.error("Critical: Fonts directory could not be resolved from paths:", fontPaths);
}

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
  if (lesson.type === "event" || (subjectSet.has(lesson.title) && isSubjectAllowed(gradesBySubject, lesson.title, className))) {
    matches.push({ className, title: lesson.title, note: "", type: lesson.type });
  }
  return matches;
}

function renderText(text, x, y, options = {}) {
  const size = options.size || 34;
  const weight = options.weight || 800;
  const fill = options.fill || "#f8fafc";
  const anchor = options.anchor ? ` text-anchor="${options.anchor}"` : "";
  const decor = options.decoration ? ` text-decoration="${options.decoration}"` : "";
  return `<text x="${x}" y="${y}" font-family="NanumGothicBold, NanumGothic, Pretendard, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}"${anchor}${decor}>${escapeXml(text)}</text>`;
}

function textWidthUnits(value) {
  return Array.from(String(value || "")).reduce((total, character) => {
    if (/\s/.test(character)) return total + 0.34;
    if (/[\x00-\x7F]/.test(character)) return total + 0.58;
    return total + 1;
  }, 0);
}

function truncateToUnits(value, maxUnits) {
  const characters = Array.from(String(value || ""));
  if (textWidthUnits(characters.join("")) <= maxUnits) return characters.join("");

  const ellipsis = "…";
  const limit = Math.max(0, maxUnits - textWidthUnits(ellipsis));
  let result = "";
  for (const character of characters) {
    if (textWidthUnits(result + character) > limit) break;
    result += character;
  }
  return `${result.trimEnd()}${ellipsis}`;
}

function splitBalancedLines(value) {
  const text = String(value || "").trim();
  const characters = Array.from(text);
  if (characters.length < 2) return [text];

  let best = null;
  for (let index = 1; index < characters.length; index++) {
    const first = characters.slice(0, index).join("").trim();
    const second = characters.slice(index).join("").trim();
    if (!first || !second) continue;
    const imbalance = Math.abs(textWidthUnits(first) - textWidthUnits(second));
    const boundaryBonus = /[\s/·,()-]/.test(characters[index - 1]) || /[\s/·,()-]/.test(characters[index]) ? -0.35 : 0;
    const score = imbalance + boundaryBonus;
    if (!best || score < best.score) best = { score, lines: [first, second] };
  }
  return best ? best.lines : [text];
}

function fitText(value, maxWidth, options = {}) {
  const text = String(value || "").trim();
  const baseSize = options.size || 34;
  const minSize = Math.min(options.minSize || Math.max(8, baseSize * 0.55), baseSize);
  const maxLines = Math.max(1, options.maxLines || 1);
  if (!text) return { lines: [""], size: baseSize };

  const singleLineSize = Math.min(baseSize, maxWidth / Math.max(textWidthUnits(text), 0.01));
  if (singleLineSize >= minSize || maxLines === 1) {
    const size = Math.max(minSize, singleLineSize);
    return {
      lines: [truncateToUnits(text, maxWidth / size)],
      size,
    };
  }

  const lines = splitBalancedLines(text).slice(0, maxLines);
  const widestLine = Math.max(...lines.map(textWidthUnits), 0.01);
  const size = Math.max(minSize, Math.min(baseSize, maxWidth / widestLine));
  const maxUnits = maxWidth / size;
  return {
    lines: lines.map((line) => truncateToUnits(line, maxUnits)),
    size,
  };
}

function renderFittedText(text, x, centerY, maxWidth, options = {}) {
  const fitted = fitText(text, maxWidth, options);
  const fill = options.fill || "#f8fafc";
  const weight = options.weight || 800;
  const anchor = options.anchor || "middle";
  const decor = options.decoration ? ` text-decoration="${options.decoration}"` : "";
  const lineHeight = fitted.size * (options.lineHeight || 1.08);
  const tspans = fitted.lines
    .map((line, index) => {
      const y = centerY + (index - (fitted.lines.length - 1) / 2) * lineHeight;
      return `<tspan x="${x}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("");
  return `<text x="${x}" y="${centerY}" text-anchor="${anchor}" dominant-baseline="middle" font-family="NanumGothicBold, NanumGothic, Pretendard, sans-serif" font-size="${fitted.size}" font-weight="${weight}" fill="${fill}"${decor}>${tspans}</text>`;
}

function chipColors(type) {
  if (type === "change") return { bg: "rgba(43, 27, 10, 0.95)", line: "#f59e0b", fg: "#fef3c7", note: "#fbbf24" };
  if (type === "original") return { bg: "rgba(23, 29, 38, 0.15)", line: "rgba(148, 163, 184, 0.25)", fg: "rgba(203, 213, 225, 0.35)", note: "rgba(148, 163, 184, 0.35)" };
  if (type === "event" || type === "merge") return { bg: "rgba(10, 37, 43, 0.95)", line: "#14b8a6", fg: "#ccfbf1", note: "#2dd4bf" };
  return { bg: "rgba(15, 23, 42, 0.95)", line: "#475569", fg: "#e2e8f0", note: "#94a3b8" };
}

function renderChip(match, x, y, width, height, isFullSize = false) {
  const colors = chipColors(match.type);
  const hasClassName = !!match.className;
  const hasNote = !!match.note;
  const compact = !isFullSize || height < 100;
  const maxTextWidth = Math.max(24, width - 16);
  const classSize = compact ? 18 : 28;
  const titleSize = compact ? 17 : 32;
  const noteSize = compact ? 10 : 14;
  const centerY = y + height / 2;

  let classY = centerY;
  let titleY = centerY;
  let noteY = centerY;
  if (hasClassName && hasNote) {
    classY = y + height * 0.2;
    titleY = y + height * 0.5;
    noteY = y + height * 0.82;
  } else if (hasClassName) {
    classY = y + height * 0.31;
    titleY = y + height * 0.68;
  } else if (hasNote) {
    titleY = y + height * 0.38;
    noteY = y + height * 0.72;
  }

  const dashAttr = match.type === "original" ? ' stroke-dasharray="6,4"' : '';
  const titleDecor = match.type === "original" ? "line-through" : "";
  const clipId = `wallpaper-chip-${renderChip.sequence++}`;

  return `
    <defs><clipPath id="${clipId}"><rect x="${x + 4}" y="${y + 4}" width="${Math.max(0, width - 8)}" height="${Math.max(0, height - 8)}" rx="7" /></clipPath></defs>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="${colors.bg}" stroke="${colors.line}" stroke-width="2"${dashAttr} />
    <g clip-path="url(#${clipId})">
      ${hasClassName ? renderFittedText(match.className, x + width / 2, classY, maxTextWidth, { size: classSize, minSize: compact ? 11 : 16, maxLines: 1, fill: colors.fg, weight: 900 }) : ""}
      ${renderFittedText(match.title, x + width / 2, titleY, maxTextWidth, { size: titleSize, minSize: compact ? 9 : 16, maxLines: 2, fill: colors.fg, weight: 900, decoration: titleDecor })}
      ${hasNote ? renderFittedText(match.note, x + width / 2, noteY, maxTextWidth, { size: noteSize, minSize: compact ? 7 : 9, maxLines: 2, fill: colors.note, weight: 800 }) : ""}
    </g>
  `;
}

renderChip.sequence = 0;

function mergeSameEvents(matches) {
  const merged = [];
  const eventGroups = {};

  for (const match of matches) {
    if (match.type === "event") {
      if (!eventGroups[match.title]) {
        eventGroups[match.title] = {
          title: match.title,
          type: "event",
          classes: [match.className],
        };
      } else {
        eventGroups[match.title].classes.push(match.className);
      }
    } else {
      merged.push(match);
    }
  }

  for (const title in eventGroups) {
    const group = eventGroups[title];
    group.className = "";
    group.note = group.classes.join(", ");
    merged.push(group);
  }

  return merged;
}

function renderWallpaperSvg(state, query) {
  renderChip.sequence = 0;
  const name = query.name || query.n || "";
  const titleLabel = name ? `${name} 선생님의 이번 주 시간표` : "내 과목 주간표";
  const titleSize = name ? (name.length > 5 ? 44 : 52) : 62;
  const subjects = splitParam(query.subjects || query.subject || query.s);
  const gradesBySubject = parseGradesParam(query.grades || query.grade || query.g, subjects);
  const selectedDays = splitParam(query.days || query.day || query.d);
  const allowedDaySet = new Set(selectedDays.length ? selectedDays : weekdays.map((day) => day.key));
  const now = kstNow();
  const today = toISO(now);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const updateTimeStr = `${today} ${hh}:${mm}`;
  const days = schoolDaysForCurrentWeek(now).filter((day) => allowedDaySet.has(day.weekday.key));

  const tableX = 0;
  const tableY = 830;
  const tableWidth = 1170;
  const periodWidth = 110;
  const dayWidth = (tableWidth - periodWidth) / Math.max(days.length, 1);
  const headerHeight = 76;
  const rowHeight = 145;
  const tableHeight = headerHeight + periods.length * rowHeight;

  const grid = [];
  for (let d = 0; d < days.length; d++) {
    grid[d] = [];
    for (let p = 0; p < periods.length; p++) {
      const day = days[d];
      const period = periods[p];
      const rawMatches = classes.flatMap((className) =>
        matchesForCell(state, day.iso, className, period, p, subjects, gradesBySubject)
      );
      grid[d][p] = mergeSameEvents(rawMatches);
    }
  }

  if (query.format === "json" || query.f === "json") {
    const jsonResult = {
      days: days.map(d => ({ iso: d.iso, label: d.weekday.label })),
      periods: periods,
      grid: grid.map(dayRow =>
        dayRow.map(cell =>
          cell.map(match => ({
            title: match.title,
            type: match.type,
            note: match.note || "",
            className: match.className || ""
          }))
        )
      )
    };
    return JSON.stringify(jsonResult);
  }

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
          return `<rect x="${x}" y="${y}" width="${dayWidth}" height="${rowHeight}" fill="#1e293b" fill-opacity="0.4" stroke="#334155" stroke-width="2" />`;
        })
        .join("");
      return periodCell + dayCells;
    })
    .join("");

  let chipsMarkup = "";
  const visited = [];
  for (let d = 0; d < days.length; d++) {
    visited[d] = Array(periods.length).fill(false);
  }

  for (let d = 0; d < days.length; d++) {
    const x = tableX + periodWidth + d * dayWidth;
    for (let p = 0; p < periods.length; p++) {
      if (visited[d][p]) continue;

      const cellMatches = grid[d][p];
      if (!cellMatches || cellMatches.length === 0) continue;

      const firstMatch = cellMatches[0];
      if (cellMatches.length === 1 && firstMatch.type === "event") {
        let rowspan = 1;
        for (let nextP = p + 1; nextP < periods.length; nextP++) {
          const nextCell = grid[d][nextP];
          if (nextCell && nextCell.length === 1 && nextCell[0].type === "event" && nextCell[0].title === firstMatch.title) {
            rowspan++;
            visited[d][nextP] = true;
          } else {
            break;
          }
        }

        const y = tableY + headerHeight + p * rowHeight;
        const chipWidth = dayWidth - 16;
        const chipHeight = rowspan * rowHeight - 20;

        chipsMarkup += renderChip(firstMatch, x + 8, y + 10, chipWidth, chipHeight, true);
        visited[d][p] = true;
      } else {
        const y = tableY + headerHeight + p * rowHeight;
        let cellChips = "";
        if (cellMatches.length === 1) {
          const chipWidth = dayWidth - 16;
          const chipHeight = rowHeight - 20;
          cellChips = renderChip(cellMatches[0], x + 8, y + 10, chipWidth, chipHeight, true);
        } else if (cellMatches.length === 2) {
          const chipWidth = dayWidth / 2 - 12;
          const chipHeight = rowHeight - 20;
          cellChips = cellMatches
            .map((match, matchIndex) => {
              const chipX = x + 8 + matchIndex * (chipWidth + 8);
              return renderChip(match, chipX, y + 10, chipWidth, chipHeight, false);
            })
            .join("");
        } else {
          const chipWidth = Math.max(92, dayWidth / 2 - 10);
          const chipHeight = (rowHeight - 22) / 2;
          const visibleMatches = cellMatches.length > 4
            ? [...cellMatches.slice(0, 3), { className: "", title: `+${cellMatches.length - 3}`, note: "추가 수업", type: "base" }]
            : cellMatches.slice(0, 4);
          cellChips = visibleMatches
            .map((match, matchIndex) => {
              const chipX = x + 8 + (matchIndex % 2) * (chipWidth + 8);
              const chipY = y + 10 + Math.floor(matchIndex / 2) * (chipHeight + 8);
              return renderChip(match, chipX, chipY, chipWidth, chipHeight, false);
            })
            .join("");
        }

        chipsMarkup += cellChips;
        visited[d][p] = true;
      }
    }
  }

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
  <g font-family="NanumGothicBold, NanumGothic, Pretendard, sans-serif">
    ${renderText("용정 시간표", 64, 670, { size: 28, fill: "#64748b", weight: 900 })}
    ${renderText(titleLabel, 64, 725, { size: titleSize, fill: "#f8fafc", weight: 900 })}
    ${renderFittedText(subjectLabel, 64, 770, 1042, { size: 28, minSize: 15, maxLines: 1, fill: "#2dd4bf", weight: 900, anchor: "start" })}
    ${renderFittedText(gradeLabel, 64, 803, 1042, { size: 20, minSize: 12, maxLines: 1, fill: "#64748b", weight: 800, anchor: "start" })}
    <rect x="${tableX}" y="${tableY}" width="${periodWidth}" height="${headerHeight}" fill="#0f172a" fill-opacity="0.85" stroke="#334155" stroke-width="2" />
    ${renderText("교시", tableX + periodWidth / 2, tableY + 48, { size: 24, fill: "#f8fafc", anchor: "middle", weight: 900 })}
    ${headerCells}
    ${rows}
    ${chipsMarkup}
    <rect x="46" y="2260" width="1078" height="78" fill="#0f172a" fill-opacity="0.8" stroke="#334155" stroke-width="2" rx="12" />
    ${renderText("수업 변경: 주황색 · 취소된 원래 수업: 회색 · 행사: 민트색", 585, 2306, {
      size: 20,
      fill: "#94a3b8",
      anchor: "middle",
      weight: 800,
    })}
    ${renderText(`업데이트 ${updateTimeStr}`, 585, 2470, { size: 24, fill: "#475569", anchor: "middle" })}
  </g>
</svg>`;
}

exports.handler = async (event) => {
  const state = await readState();
  const query = event.queryStringParameters || {};
  
  const debugToken = process.env.WALLPAPER_DEBUG_TOKEN || "";
  if (query.debug === "true" && debugToken && query.debugToken === debugToken) {
    const debugInfo = {
      __dirname,
      cwd: process.cwd(),
      activeFontPath,
      fontPathsEvaluated: fontPaths.map(fp => ({
        path: fp,
        exists: fs.existsSync(fp)
      })),
      filesInDirname: fs.existsSync(__dirname) ? fs.readdirSync(__dirname) : null,
      filesInCwd: fs.existsSync(process.cwd()) ? fs.readdirSync(process.cwd()) : null,
      parentDirs: []
    };
    try {
      let current = __dirname;
      for (let i = 0; i < 3; i++) {
        current = path.dirname(current);
        debugInfo.parentDirs.push({
          dir: current,
          files: fs.existsSync(current) ? fs.readdirSync(current) : null
        });
      }
    } catch (e) {}
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(debugInfo, null, 2),
    };
  }

  const svgOrJson = renderWallpaperSvg(state, query);

  if (query.format === "json" || query.f === "json") {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
      body: svgOrJson,
    };
  }

  const svg = svgOrJson;

  const isPng = (event.path && event.path.endsWith(".png")) || query.format === "png";
  if (isPng) {
    try {
      const resvg = new Resvg(svg, {
        fitTo: { mode: "width", value: 1170 },
        font: {
          fontDirs: activeFontDir ? [activeFontDir] : [],
          loadSystemFonts: false,
          defaultFontFamily: "NanumGothicBold",
        },
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
