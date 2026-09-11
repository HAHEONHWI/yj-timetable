import assert from "node:assert/strict";

import {
  academicYearRange,
  parseNeisSchedulePage,
} from "./neis-academic-calendar.ts";

Deno.test("NEIS 학사일정 응답을 별도 테이블 행으로 변환한다", async () => {
  // Given
  const response = {
    SchoolSchedule: [
      {
        head: [
          { list_total_count: 1 },
          { RESULT: { CODE: "INFO-000", MESSAGE: "정상 처리되었습니다." } },
        ],
      },
      {
        row: [{
          ATPT_OFCDC_SC_CODE: "Q10",
          SD_SCHUL_CODE: "8602013",
          AA_YMD: "20260901",
          EVENT_NM: "산사체험",
          EVENT_CNTNT: "체험 활동",
          ONE_GRADE_EVENT_YN: "Y",
          TW_GRADE_EVENT_YN: "N",
          THREE_GRADE_EVENT_YN: "N",
          SBTR_DD_SC_NM: "해당없음",
          LOAD_DTM: "20260911",
        }],
      },
    ],
  };

  // When
  const result = await parseNeisSchedulePage(response);

  // Then
  assert.equal(result.totalCount, 1);
  assert.deepEqual(result.events[0], {
    id: result.events[0]?.id,
    source: "neis",
    schoolCode: "8602013",
    date: "2026-09-01",
    title: "산사체험",
    content: "체험 활동",
    grades: [1],
    isSchoolDay: true,
    sourceUpdatedAt: "2026-09-11",
  });
  assert.match(result.events[0]?.id ?? "", /^neis:8602013:20260901:/);
});

Deno.test("NEIS 조회 결과 없음 응답을 정상 빈 페이지로 처리한다", async () => {
  // Given
  const response = {
    RESULT: { CODE: "INFO-200", MESSAGE: "해당하는 데이터가 없습니다." },
  };

  // When
  const result = await parseNeisSchedulePage(response);

  // Then
  assert.deepEqual(result, { totalCount: 0, events: [] });
});

Deno.test("NEIS 응답의 문자열 건수와 누락된 갱신일을 허용한다", async () => {
  const response = {
    SchoolSchedule: [{
      head: [{ list_total_count: "1" }, { RESULT: { CODE: "INFO-000", MESSAGE: "정상 처리되었습니다." } }],
    }, { row: [{
      ATPT_OFCDC_SC_CODE: "Q10",
      SD_SCHUL_CODE: "8602013",
      AA_YMD: "20260915",
      EVENT_NM: "재량휴업일",
      EVENT_CNTNT: null,
      ONE_GRADE_EVENT_YN: "N",
      TW_GRADE_EVENT_YN: "N",
      THREE_GRADE_EVENT_YN: "N",
      SBTR_DD_SC_NM: "휴업일",
      LOAD_DTM: "20260915123000",
    }] }],
  };

  const result = await parseNeisSchedulePage(response);

  assert.equal(result.totalCount, 1);
  assert.equal(result.events[0]?.sourceUpdatedAt, "2026-09-15");
});

Deno.test("NEIS 오류 응답을 거부한다", async () => {
  // Given
  const response = {
    RESULT: { CODE: "ERROR-290", MESSAGE: "인증키가 유효하지 않습니다." },
  };

  // When / Then
  await assert.rejects(
    () => parseNeisSchedulePage(response),
    /ERROR-290/,
  );
});

Deno.test("현재 날짜에서 학년도 조회 범위를 계산한다", () => {
  // Given
  const currentDate = new Date("2026-09-11T00:00:00+09:00");

  // When
  const result = academicYearRange(currentDate);

  // Then
  assert.deepEqual(result, { from: "20260301", to: "20270228" });
});

Deno.test("한국 시각 3월 1일 자정에 새 학년도로 전환한다", () => {
  // Given
  const currentDate = new Date("2027-03-01T00:05:00+09:00");

  // When
  const result = academicYearRange(currentDate);

  // Then
  assert.deepEqual(result, { from: "20270301", to: "20280229" });
});
