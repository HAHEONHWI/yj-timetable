const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = { window: {} };
const source = fs.readFileSync(path.join(__dirname, "../src/app-utils.js"), "utf8");
vm.runInNewContext(source, context);

const { clamp, escapeHtml, formatDate, fromISO, mondayOf, toISO } = context.window.TimetableAppUtils;

// Given: date helpers shared by every timetable route
// When: a school date is converted and normalized to its Monday
// Then: calendar values remain stable in local time
const date = fromISO("2026-08-26");
assert.equal(toISO(date), "2026-08-26");
assert.equal(formatDate("2026-08-26"), "8.26");
assert.equal(toISO(mondayOf(date)), "2026-08-24");

// Given: untrusted text and range input
// When: shared rendering helpers process them
// Then: HTML stays escaped and values stay within bounds
assert.equal(escapeHtml('<time "&">'), "&lt;time &quot;&amp;&quot;&gt;");
assert.equal(clamp(12, 0, 10), 10);
assert.equal(clamp(-2, 0, 10), 0);

console.log("app-utils tests passed");
