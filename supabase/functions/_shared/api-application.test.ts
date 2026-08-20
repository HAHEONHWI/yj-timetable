import assert from "node:assert/strict";

import {
  normalizeKoreanPhone,
  parseApiApplication,
} from "./api-application.ts";

Deno.test("API 신청 연락처를 정규화한다", () => {
  // Given
  const input = {
    name: "  학생회 앱  ",
    email: " Student@YJMS.KR ",
    phone: "010-1234-5678",
  };

  // When
  const result = parseApiApplication(input);

  // Then
  assert.deepEqual(result, {
    name: "학생회 앱",
    email: "student@yjms.kr",
    phone: "01012345678",
  });
});

Deno.test("유효하지 않은 국내 전화번호를 거부한다", () => {
  // Given
  const input = "02-123-456";

  // When
  const result = normalizeKoreanPhone(input);

  // Then
  assert.equal(result, null);
});

Deno.test("국가번호가 있는 휴대전화 번호를 국내 형식으로 바꾼다", () => {
  // Given
  const input = "+82 10-1234-5678";

  // When
  const result = normalizeKoreanPhone(input);

  // Then
  assert.equal(result, "01012345678");
});
