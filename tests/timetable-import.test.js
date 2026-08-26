const assert = require("node:assert/strict");
const { mergeGradeImports, parseWorksheetRows, parseSubjectTeacher } = require("../src/timetable-import.js");

const dayStarts = [3, 15, 27, 39, 52, 64, 77];
const dayLabels = ["월", "화", "수", "목", "금", "토", "일"];

function fixtureRows(grade, lessonsByClass) {
  const rows = Array.from({ length: 8 }, () => Array(89).fill(""));
  dayStarts.forEach((start, dayIndex) => {
    rows[4][start] = dayLabels[dayIndex];
    const periodColumns = Array.from({ length: 9 }, (_, index) => start + index + (dayIndex === 3 && index >= 5 ? 1 : 0));
    periodColumns.forEach((column, index) => {
      rows[5][column] = index + 1;
    });
    Object.entries(lessonsByClass).forEach(([section, lessons], rowIndex) => {
      rows[6 + rowIndex][1] = rowIndex === 0 ? `${grade}학년` : "";
      rows[6 + rowIndex][2] = `학급${section}(${grade}학년) 학급${section}반)`;
      periodColumns.forEach((column, index) => {
        const lesson = dayIndex < 5 ? lessons[index] : null;
        rows[6 + rowIndex][column] = lesson ? `${lesson.subject}(${lesson.teacher})` : "0";
      });
    });
  });
  return rows;
}

const firstClassLessons = ["국어", "수학", "영어", "사회", "과학", "체육", "미술", "음악", "창체"].map(
  (subject) => ({ subject, teacher: `${subject}교사` })
);
const secondClassLessons = ["수학", "국어", "사회", "영어", "체육", "과학", "음악", "미술", "창체"].map(
  (subject) => ({ subject, teacher: `${subject}교사` })
);

assert.deepEqual(parseSubjectTeacher(" 기술·가정(정지안) "), { subject: "기술·가정", teacher: "정지안" });
assert.deepEqual(parseSubjectTeacher("0"), { subject: "", teacher: "" });
assert.deepEqual(parseSubjectTeacher("철학(철학)"), { subject: "철학", teacher: "" });

const gradeImports = [1, 2, 3].map((grade) =>
  parseWorksheetRows(
    fixtureRows(grade, {
      1: firstClassLessons,
      2: secondClassLessons,
    }),
    `${grade}학년.xlsx`
  )
);

const merged = mergeGradeImports(gradeImports);
assert.deepEqual(Object.keys(merged.base), ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"]);
assert.equal(merged.base["1-1"].mon[0], "국어");
assert.equal(merged.base["1-1"].thu[5], "체육");
assert.equal(merged.base["3-2"].fri[8], "창체");
assert.equal(merged.teachers["1-1"].국어, "국어교사");

assert.throws(
  () => mergeGradeImports(gradeImports.slice(0, 2)),
  /누락 학급: 3-1, 3-2/
);

const classSpecificTeacherImport = parseWorksheetRows(
  fixtureRows(1, {
    1: Array.from({ length: 9 }, () => ({ subject: "국어", teacher: "국어교사" })),
    2: Array.from({ length: 9 }, () => ({ subject: "국어", teacher: "다른교사" })),
  }),
  "1학년.xlsx"
);
const classSpecificMerged = mergeGradeImports([classSpecificTeacherImport, gradeImports[1], gradeImports[2]]);
assert.equal(classSpecificMerged.teachers["1-1"].국어, "국어교사");
assert.equal(classSpecificMerged.teachers["1-2"].국어, "다른교사");

const conflictRows = Array.from({ length: 8 }, () => Array(89).fill(""));
dayStarts.forEach((start, dayIndex) => {
  conflictRows[4][start] = dayLabels[dayIndex];
  for (let index = 0; index < 9; index += 1) conflictRows[5][start + index] = index + 1;
});
conflictRows[6][1] = "1학년";
conflictRows[6][2] = "학급1(1학년) 학급1반)";
conflictRows[6][dayStarts[0]] = "국어(김선생)"; // 월요일 1교시
conflictRows[6][dayStarts[2]] = "국어(이선생)"; // 수요일 1교시 - 같은 과목, 다른 교사

assert.throws(
  () => parseWorksheetRows(conflictRows, "충돌.xlsx"),
  /1-1 국어 교사가 한 파일 안에서 다릅니다/
);

const lenient = parseWorksheetRows(conflictRows, "충돌.xlsx", { strictTeacherPerSubject: false });
assert.equal(lenient.classTeachersByPeriod["1-1"].mon[0], "김선생");
assert.equal(lenient.classTeachersByPeriod["1-1"].wed[0], "이선생");

console.log("timetable-import tests passed");
