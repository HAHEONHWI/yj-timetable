const assert = require("node:assert/strict");
const { buildMonthGrid, eventsForMonth, shiftMonth } = require("../src/calendar.js");

// Given: 2026년 9월
// When: 월간 달력 칸을 만든다.
const september = buildMonthGrid("2026-09");
// Then: 일요일 시작 6주 달력으로 앞뒤 달 날짜까지 채운다.
assert.equal(september.length, 42);
assert.deepEqual(september[0], { iso: "2026-08-30", day: 30, inMonth: false });
assert.deepEqual(september[2], { iso: "2026-09-01", day: 1, inMonth: true });
assert.deepEqual(september[41], { iso: "2026-10-10", day: 10, inMonth: false });

// Given: 연말과 연초 경계 월
// When: 이전·다음 달로 이동한다.
// Then: 연도를 넘겨 정확한 월을 반환한다.
assert.equal(shiftMonth("2026-12", 1), "2027-01");
assert.equal(shiftMonth("2026-01", -1), "2025-12");

const events = [
  { id: "all", date: "2026-09-03", title: "개학식", classes: ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"] },
  { id: "first", date: "2026-09-10", title: "1반 체험학습", classes: ["1-1", "2-1", "3-1"] },
  { id: "second", date: "2026-09-11", title: "2반 체험학습", classes: ["1-2", "2-2", "3-2"] },
  { id: "other-month", date: "2026-10-01", title: "개천절 행사", classes: ["1-1"] },
];

// Given: 학생 1-1 조회와 9월 학사일정
// When: 월과 학급으로 행사만 고른다.
// Then: 해당 월·학급 일정만 날짜순으로 남는다.
assert.deepEqual(
  eventsForMonth(events, "2026-09", "1-1").map((event) => event.id),
  ["all", "first"]
);

// Given: 교사 조회와 9월 학사일정
// When: 학급 필터 없이 행사만 고른다.
// Then: 해당 월 전체 학사일정이 남는다.
assert.deepEqual(
  eventsForMonth(events, "2026-09", "all").map((event) => event.id),
  ["all", "first", "second"]
);

console.log("calendar tests passed");
