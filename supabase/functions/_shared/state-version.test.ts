import assert from "node:assert/strict";

import { parseExpectedStateVersion } from "./state-version.ts";

Deno.test("유효한 상태 버전을 허용한다", () => {
  // Given: a version returned by the latest remote state read
  // When: the client sends it with an update
  // Then: the integer version is preserved
  assert.equal(parseExpectedStateVersion(7), 7);
});

Deno.test("누락되거나 잘못된 상태 버전을 거부한다", () => {
  // Given: malformed client payload versions
  // When: an update boundary parses them
  // Then: no unsafe update version is produced
  assert.equal(parseExpectedStateVersion(undefined), null);
  assert.equal(parseExpectedStateVersion(0), null);
  assert.equal(parseExpectedStateVersion(1.5), null);
  assert.equal(parseExpectedStateVersion("7"), null);
});
