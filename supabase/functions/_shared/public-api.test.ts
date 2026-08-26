import assert from "node:assert/strict";

import { hashApiKey, parseApiKey } from "./api-key.ts";
import {
  resolveAllTimetables,
  resolveChanges,
  resolveTimetable,
} from "./timetable-api.ts";

Deno.test("API key에서 조회 prefix를 분리한다", () => {
  const parsed = parseApiKey(
    "yj_live_a1b2c3d4_abcdefghijklmnopqrstuvwxyzABCDE1234567890",
  );

  assert.deepEqual(parsed, { prefix: "a1b2c3d4" });
});

Deno.test("잘못된 API key 형식을 거부한다", () => {
  assert.equal(parseApiKey("invalid-key"), null);
});

Deno.test("API key hash는 동일 입력에만 동일하다", async () => {
  const first = await hashApiKey("yj_live_a1b2c3d4_first-key");
  const second = await hashApiKey("yj_live_a1b2c3d4_second-key");

  assert.equal(first, await hashApiKey("yj_live_a1b2c3d4_first-key"));
  assert.notEqual(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
});

Deno.test("행사가 단일 변경보다 우선하는 읽기 전용 시간표를 만든다", () => {
  const state = {
    base: { "1-1": { mon: ["국어", "수학", "영어"] } },
    teachers: {
      "1-1": { 국어: "송희선", 수학: "곽혜주", 영어: "최세영", 음악: "김세영" },
    },
    baseMerges: [],
    specialSchedules: {},
    changes: {
      "2026-08-17__1-1__1": {
        subject: "과학",
        memo: "교과 변경",
        type: "swap",
      },
      "2026-08-17__1-1__2": { subject: "음악", memo: "신설", type: "new" },
    },
    events: [
      {
        id: "event-1",
        date: "2026-08-17",
        title: "진로 특강",
        start: 1,
        end: 1,
        classes: ["1-1"],
        memo: "강당",
      },
    ],
    notices: [],
  };

  const timetable = resolveTimetable(state, "2026-08-17", "1-1");

  assert.deepEqual(timetable.slice(0, 3), [
    {
      period: 1,
      subject: "진로 특강",
      originalSubject: "국어",
      teacher: "",
      type: "event",
      memo: "강당",
    },
    {
      period: 2,
      subject: "음악",
      originalSubject: "수학",
      teacher: "김세영",
      type: "new",
      memo: "신설",
    },
    {
      period: 3,
      subject: "영어",
      originalSubject: "영어",
      teacher: "최세영",
      type: "lesson",
      memo: "",
    },
  ]);
});

Deno.test("특별시간표가 해당 날짜 기본 시간표를 대체한다", () => {
  const state = {
    base: { "1-1": { mon: ["국어"] } },
    baseMerges: [],
    specialSchedules: { "2026-08-17": { "1-1": ["특별수업"] } },
    changes: {},
    events: [],
    notices: [],
  };

  const timetable = resolveTimetable(state, "2026-08-17", "1-1");

  assert.equal(timetable[0]?.subject, "특별수업");
});

Deno.test("학급을 생략하면 전체 학급 시간표를 반환한다", () => {
  // Given
  const state = {
    base: {
      "1-1": { mon: ["국어"] },
      "1-2": { mon: ["수학"] },
    },
    baseMerges: [],
    specialSchedules: {},
    changes: {},
    events: [],
    notices: [],
  };

  // When
  const timetables = resolveAllTimetables(state, "2026-08-17", ["1-1", "1-2"]);

  // Then
  assert.equal(timetables["1-1"]?.[0]?.subject, "국어");
  assert.equal(timetables["1-2"]?.[0]?.subject, "수학");
});

Deno.test("선택한 날짜와 학급의 교과 변경만 반환한다", () => {
  // Given
  const state = {
    base: {},
    baseMerges: [],
    specialSchedules: {},
    changes: {
      "2026-08-17__1-1__2": { subject: "과학", memo: "교체", type: "swap" },
      "2026-08-17__1-2__2": {
        subject: "영어",
        memo: "다른 학급",
        type: "swap",
      },
      "2026-08-18__1-1__1": { subject: "음악", memo: "다른 날짜", type: "new" },
    },
    events: [],
    notices: [],
  };

  // When
  const changes = resolveChanges(state, "2026-08-17", "1-1");

  // Then
  assert.deepEqual(changes, [
    { period: 2, subject: "과학", memo: "교체", type: "change" },
  ]);
});
