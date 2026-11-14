import assert from "node:assert/strict";
import { NoticeCountdownStateSchema } from "./notice-schema.ts";
import { PublicStateSchema } from "./timetable-api.ts";

Deno.test("notice target date survives public API parsing when configured", () => {
  // Given
  const notice = { id: "countdown", title: "시험", body: "", targetDate: "2026-11-21" };
  // When
  const state = PublicStateSchema.parse({ notices: [notice] });
  // Then
  assert.equal(state.notices[0].targetDate, notice.targetDate);
});

Deno.test("notice validation accepts existing notices when no target date is set", () => {
  // Given
  const state = { notices: [{ title: "기존 안내" }, { targetDate: "" }] };
  // When
  const result = NoticeCountdownStateSchema.safeParse(state);
  // Then
  assert.equal(result.success, true);
});

Deno.test("notice validation rejects malformed or impossible target dates", () => {
  // Given
  for (const targetDate of [null, 20261121, "2026-02-29", "2026-04-31", "2026-13-01", "2026-1-01", "<script>"]) {
    // When
    const result = NoticeCountdownStateSchema.safeParse({ notices: [{ targetDate }] });
    // Then
    assert.equal(result.success, false);
  }
});
