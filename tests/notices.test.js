const assert = require("node:assert/strict");
const { test } = require("node:test");
const { countdownLabel, renderCountdown } = require("../src/notices.js");

test("countdown uses calendar days in Korea when the device is in another timezone", () => {
  // Given: Korea is already November 14, while UTC is November 13.
  const now = new Date("2026-11-13T15:00:00Z");
  // When: the target is two Korean calendar days away.
  const label = countdownLabel("2026-11-16", now);
  // Then: the device timezone and remaining hours do not change the count.
  assert.equal(label, "D-2");
});

test("countdown shows D-day when the target is today", () => {
  const now = new Date("2026-11-14T14:59:59Z"); // Given: before midnight in Korea.
  const label = countdownLabel("2026-11-14", now); // When
  assert.equal(label, "D-day"); // Then
});

test("countdown shows elapsed days when the target has passed", () => {
  const now = new Date("2026-11-14T15:00:00Z"); // Given: midnight on November 15 in Korea.
  const label = countdownLabel("2026-11-14", now); // When
  assert.equal(label, "D+1"); // Then
});

test("countdown crosses leap day and year boundaries when counting days", () => {
  const cases = [ // Given
    ["2028-03-01", "2028-02-28T12:00:00Z", "D-2"],
    ["2027-01-01", "2026-12-31T12:00:00Z", "D-1"],
  ];
  for (const [target, now, expected] of cases) {
    const label = countdownLabel(target, new Date(now)); // When
    assert.equal(label, expected); // Then
  }
});

test("countdown stays hidden when the target is absent or invalid", () => {
  const values = [undefined, null, "", "2026-02-29", "2026-04-31", "2026-13-01", "2026-1-01", '<img src=x onerror=alert(1)>']; // Given
  for (const value of values) {
    const html = renderCountdown(value, "시험"); // When
    assert.equal(html, ""); // Then
  }
});

test("countdown displays an escaped title when both settings are present", () => {
  const title = '<img src=x onerror=alert(1)> & 시험'; // Given
  const html = renderCountdown("2026-11-21", title); // When
  assert.ok(html.includes("&lt;img"));
  assert.equal(html.includes("<img"), false); // Then: title remains text.
});

test("countdown hides when its title is cleared", () => {
  const targetDate = "2026-11-21"; // Given
  const html = renderCountdown(targetDate, ""); // When
  assert.equal(html, ""); // Then
});
