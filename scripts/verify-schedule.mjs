#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import {
  formatDateInTimeZone,
  getDateWindow,
  getDefaultProductHuntDate,
  getNextDate,
  ISSUE_TIMEZONE,
  PRODUCT_HUNT_TIMEZONE,
  sortPosts,
} from "./fetch-producthunt.mjs";

const workflow = await readFile(".github/workflows/update-producthunt-daily.yml", "utf8");
const html = await readFile("index.html", "utf8");
const script = await readFile("script.js", "utf8");

const summerRun = new Date("2026-05-29T09:00:00.000Z");
assert.equal(formatDateInTimeZone(summerRun, ISSUE_TIMEZONE), "2026-05-29");
assert.equal(getDefaultProductHuntDate(summerRun), "2026-05-28");
assert.equal(getNextDate(getDefaultProductHuntDate(summerRun)), "2026-05-29");
assert.deepEqual(getDateWindow("2026-05-28"), {
  postedAfter: "2026-05-28T07:00:00.000Z",
  postedBefore: "2026-05-29T07:00:00.000Z",
});

const winterRun = new Date("2026-01-10T09:00:00.000Z");
assert.equal(formatDateInTimeZone(winterRun, ISSUE_TIMEZONE), "2026-01-10");
assert.equal(getDefaultProductHuntDate(winterRun), "2026-01-09");
assert.equal(getNextDate(getDefaultProductHuntDate(winterRun)), "2026-01-10");
assert.deepEqual(getDateWindow("2026-01-09"), {
  postedAfter: "2026-01-09T08:00:00.000Z",
  postedBefore: "2026-01-10T08:00:00.000Z",
});

const earlyManualRun = new Date("2026-05-29T01:24:00.000Z");
assert.equal(formatDateInTimeZone(earlyManualRun, ISSUE_TIMEZONE), "2026-05-29");
assert.equal(getDefaultProductHuntDate(earlyManualRun), "2026-05-27");
assert.equal(getNextDate(getDefaultProductHuntDate(earlyManualRun)), "2026-05-28");

assert.equal(PRODUCT_HUNT_TIMEZONE, "America/Los_Angeles");
assert.equal(ISSUE_TIMEZONE, "Asia/Shanghai");

assert.deepEqual(
  sortPosts([
    { name: "B", dailyRank: 2, votesCount: 100 },
    { name: "A", dailyRank: 1, votesCount: 10 },
    { name: "C", votesCount: 500 },
  ]).map((post) => post.name),
  ["A", "B", "C"],
);

assert.match(workflow, /cron:\s*"0 9 \* \* \*"/);
assert.match(workflow, /PRODUCTHUNT_TOKEN:\s*\$\{\{\s*secrets\.PRODUCTHUNT_TOKEN\s*\}\}/);
assert.match(workflow, /actions\/upload-pages-artifact@v3/);
assert.match(workflow, /actions\/deploy-pages@v4/);
assert.match(workflow, /pages:\s*write/);
assert.match(workflow, /id-token:\s*write/);

assert.match(html, /id="ranking-window"/);
assert.match(script, /北京时间每日 17:00 自动生成/);
assert.match(script, /meta\.productHuntDate/);

console.log("Schedule verification passed.");
