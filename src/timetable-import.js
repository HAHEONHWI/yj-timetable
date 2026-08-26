(function (global) {
  const expectedClasses = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"];
  const weekdayLabels = [
    { key: "mon", label: "월" },
    { key: "tue", label: "화" },
    { key: "wed", label: "수" },
    { key: "thu", label: "목" },
    { key: "fri", label: "금" },
  ];
  const calendarDayLabels = [...weekdayLabels.map((weekday) => weekday.label), "토", "일"];
  const periodCount = 9;

  function normalizeCell(value) {
    return String(value === null || value === undefined ? "" : value).trim();
  }

  function parseSubjectTeacher(value) {
    const lesson = normalizeCell(value);
    if (!lesson || lesson === "0") return { subject: "", teacher: "" };
    const match = lesson.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    if (!match) return { subject: lesson, teacher: "" };
    const subject = match[1].trim();
    const teacher = match[2].trim();
    // 일부 학교 시스템은 담당교사가 없으면 "과목명(과목명)"으로 내보낸다.
    return { subject, teacher: teacher === subject ? "" : teacher };
  }

  function findScheduleHeader(rows) {
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
      const calendarDayStarts = calendarDayLabels.map((label) => row.findIndex((value) => normalizeCell(value) === label));
      const dayStarts = calendarDayStarts.slice(0, weekdayLabels.length);
      if (dayStarts.some((index) => index < 0)) continue;

      for (let periodRowIndex = rowIndex + 1; periodRowIndex <= Math.min(rowIndex + 3, rows.length - 1); periodRowIndex += 1) {
        const periodRow = Array.isArray(rows[periodRowIndex]) ? rows[periodRowIndex] : [];
        const dayColumns = {};
        let valid = true;

        weekdayLabels.forEach((weekday, dayIndex) => {
          const start = dayStarts[dayIndex];
          const nextDayStart = calendarDayStarts[dayIndex + 1];
          const end = nextDayStart >= 0 ? nextDayStart : periodRow.length;
          const columns = [];
          for (let columnIndex = start; columnIndex < end; columnIndex += 1) {
            const period = Number(normalizeCell(periodRow[columnIndex]));
            if (Number.isInteger(period) && period >= 1 && period <= periodCount) {
              columns[period - 1] = columnIndex;
            }
          }
          if (columns.length !== periodCount || columns.some((column) => !Number.isInteger(column))) valid = false;
          dayColumns[weekday.key] = columns;
        });

        if (valid) return { periodRowIndex, dayColumns };
      }
    }
    throw new Error("월~금 1~9교시 머리글을 찾지 못했습니다.");
  }

  function classNameFromRow(row) {
    const text = row.map(normalizeCell).filter(Boolean).join(" ");
    const gradeMatch = text.match(/([1-3])학년/);
    const classMatch = text.match(/([1-2])반\)?(?:\s|$)/);
    if (!gradeMatch || !classMatch) return "";
    const className = `${gradeMatch[1]}-${classMatch[1]}`;
    return expectedClasses.includes(className) ? className : "";
  }

  function parseWorksheetRows(rows, sourceName = "Excel 파일", options = {}) {
    const { strictTeacherPerSubject = true } = options;
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(`${sourceName}: 읽을 시간표가 없습니다.`);
    }
    const { periodRowIndex, dayColumns } = findScheduleHeader(rows);
    const base = {};
    const classTeachers = {};
    const classTeachersByPeriod = {};

    rows.slice(periodRowIndex + 1).forEach((rawRow) => {
      const row = Array.isArray(rawRow) ? rawRow : [];
      const className = classNameFromRow(row);
      if (!className) return;
      if (base[className]) throw new Error(`${sourceName}: ${className} 학급이 두 번 들어 있습니다.`);
      const teachers = {};
      const teachersByPeriod = {};
      base[className] = Object.fromEntries(
        weekdayLabels.map((weekday) => {
          const teacherRow = [];
          const subjectRow = dayColumns[weekday.key].map((column) => {
            const lesson = parseSubjectTeacher(row[column]);
            if (lesson.subject && lesson.teacher) {
              const existingTeacher = teachers[lesson.subject];
              if (existingTeacher && existingTeacher !== lesson.teacher && strictTeacherPerSubject) {
                throw new Error(`${sourceName}: ${className} ${lesson.subject} 교사가 한 파일 안에서 다릅니다.`);
              }
              teachers[lesson.subject] = lesson.teacher;
            }
            teacherRow.push(lesson.teacher);
            return lesson.subject;
          });
          teachersByPeriod[weekday.key] = teacherRow;
          return [weekday.key, subjectRow];
        })
      );
      classTeachers[className] = teachers;
      classTeachersByPeriod[className] = teachersByPeriod;
    });

    if (Object.keys(base).length === 0) {
      throw new Error(`${sourceName}: 1-1~3-2 학급 행을 찾지 못했습니다.`);
    }
    return { sourceName, base, classTeachers, classTeachersByPeriod };
  }

  function mergeGradeImports(imports) {
    const base = {};
    const teachers = {};
    const teachersByPeriod = {};
    imports.forEach((item) => {
      Object.keys(item.base).forEach((className) => {
        if (base[className]) throw new Error(`${className} 학급이 선택한 파일 여러 개에 중복으로 들어 있습니다.`);
        base[className] = item.base[className];
        teachers[className] = item.classTeachers[className] || {};
        teachersByPeriod[className] = item.classTeachersByPeriod[className] || {};
      });
    });

    const missing = expectedClasses.filter((className) => !base[className]);
    if (missing.length > 0) {
      throw new Error(`누락 학급: ${missing.join(", ")}. 학년별 파일 3개를 모두 선택하세요.`);
    }
    return {
      base: Object.fromEntries(expectedClasses.map((className) => [className, base[className]])),
      teachers: Object.fromEntries(expectedClasses.map((className) => [className, teachers[className]])),
      teachersByPeriod: Object.fromEntries(expectedClasses.map((className) => [className, teachersByPeriod[className]])),
    };
  }

  const api = { expectedClasses, parseSubjectTeacher, parseWorksheetRows, mergeGradeImports };
  global.TimetableImport = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
