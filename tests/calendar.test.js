const assert = require("node:assert/strict");
const {
  buildMonthGrid,
  eventsForMonth,
  monthKeyOf,
  shiftMonth,
  specialSaturdayDatesFromSundayEvents,
  upsertEvent,
} = require("../src/calendar.js");

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
  { id: "neis-first", date: "2026-09-15", title: "1학년 진로체험", grades: [1], source: "neis" },
  { id: "neis-all", date: "2026-09-20", title: "학교장 재량휴업일", grades: [], source: "neis" },
];

// Given: 학생 1-1 조회와 9월 학사일정
// When: 월과 학급으로 행사만 고른다.
// Then: 해당 월·학급 일정만 날짜순으로 남는다.
assert.deepEqual(
  eventsForMonth(events, "2026-09", "1-1").map((event) => event.id),
  ["all", "first", "neis-first", "neis-all"]
);

// Given: 2학년 학급 조회와 학년별 NEIS 일정
// When: 월과 학급으로 학사일정을 고른다.
// Then: 1학년 전용 일정은 빠지고 전교 일정은 남는다.
assert.deepEqual(
  eventsForMonth(events, "2026-09", "2-1").map((event) => event.id),
  ["all", "first", "neis-all"]
);

// Given: 교사 조회와 9월 학사일정
// When: 학급 필터 없이 행사만 고른다.
// Then: 해당 월 전체 학사일정이 남는다.
assert.deepEqual(
  eventsForMonth(events, "2026-09", "all").map((event) => event.id),
  ["all", "first", "second", "neis-first", "neis-all"]
);

// Given: 관리자 화면이 고른 날짜
// When: 그 날짜가 속한 달을 구한다.
// Then: YYYY-MM만 남기고, 날짜 형식이 아니면 빈 문자열이다.
assert.equal(monthKeyOf("2026-09-17"), "2026-09");
assert.equal(monthKeyOf("2026-09"), "");

// Given: 관리자 학사일정 등록
// When: 새 id로 저장한다.
// Then: 목록에 추가되고 날짜순으로 정렬된다.
const added = upsertEvent(events, { id: "new", date: "2026-09-01", title: "학부모 총회", classes: ["1-1"] });
assert.equal(added.length, events.length + 1);
assert.deepEqual(added.map((event) => event.id), ["new", "all", "first", "second", "neis-first", "neis-all", "other-month"]);

// Given: 이미 등록된 학사일정
// When: 같은 id로 다시 저장한다.
// Then: 새로 추가하지 않고 해당 항목만 교체한다.
const edited = upsertEvent(events, { id: "first", date: "2026-09-24", title: "1반 체험학습", classes: ["1-1"] });
assert.equal(edited.length, events.length);
assert.equal(edited.find((event) => event.id === "first").date, "2026-09-24");
assert.deepEqual(edited.map((event) => event.id), ["all", "second", "neis-first", "neis-all", "first", "other-month"]);

// Given: id가 없는 값
// When: 저장을 시도한다.
// Then: 목록을 망가뜨리지 않고 즉시 실패한다.
assert.throws(() => upsertEvent(events, { date: "2026-09-01", title: "잘못된 일정" }), /id/);

const sundayEvents = [
  { source: "neis", isSchoolDay: true, date: "2026-10-25", title: "학교 행사" },
  { source: "neis", isSchoolDay: true, date: "2026-10-25", title: "중복 행사" },
  { source: "neis", isSchoolDay: true, date: "2027-01-10", title: "졸업 행사" },
  { source: "neis", isSchoolDay: true, date: "2026-10-24", title: "토요일 행사는 기준 아님" },
  { source: "manual", isSchoolDay: true, date: "2026-11-01", title: "수동 행사" },
  { source: "neis", isSchoolDay: false, date: "2026-11-08", title: "휴업일" },
];

// Given: NEIS에 수업일인 일요일 행사가 있다.
// When: 자동 생성할 특별 토요일을 계산한다.
// Then: 각 일요일의 다음 토요일만 중복 없이 반환한다.
assert.deepEqual(
  specialSaturdayDatesFromSundayEvents(sundayEvents, "2026-09-14", {}),
  ["2026-10-31", "2027-01-16"]
);

// Given: 관리자가 이미 만든 토요일 특별시간표와 지난 주 일요일 행사가 있다.
// When: 자동 생성 대상을 계산한다.
// Then: 기존 시간표와 cutoff 이전 날짜는 건너뛴다.
assert.deepEqual(
  specialSaturdayDatesFromSundayEvents(sundayEvents, "2026-09-14", { "2026-10-31": {} }),
  ["2027-01-16"]
);
assert.deepEqual(
  specialSaturdayDatesFromSundayEvents(
    [{ source: "neis", isSchoolDay: true, date: "2026-09-06", title: "지난 일요일 행사" }],
    "2026-09-14",
    {}
  ),
  []
);

console.log("calendar tests passed");
