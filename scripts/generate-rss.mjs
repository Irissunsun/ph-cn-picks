#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SITE_URL = "https://irissunsun.github.io/ph-cn-picks/";
const FEED_PATH = resolve(ROOT, "feed.xml");
const ISSUES_INDEX = resolve(ROOT, "data/issues.json");
const MAX_ITEMS = 30;
const MAX_PRODUCTS_PER_ITEM = 8;

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function absoluteUrl(path) {
  return new URL(path.replace(/^\.\//, ""), SITE_URL).toString();
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
}

function productLine(product) {
  const rank = product.rank ? `#${product.rank}` : "#";
  const title = `${rank} ${product.name || "Untitled"}`;
  const summary = product.summaryZh || product.tagline || "暂无摘要";
  const votes = Number.isFinite(Number(product.votes)) ? ` · ${product.votes} votes` : "";
  return `<li><strong>${escapeXml(title)}</strong>：${escapeXml(summary)}${escapeXml(votes)}</li>`;
}

function issueDescription(issueData) {
  const meta = issueData.meta || {};
  const products = Array.isArray(issueData.products) ? issueData.products : [];
  const rows = products.slice(0, MAX_PRODUCTS_PER_ITEM).map(productLine).join("");
  return [
    `<p>Product Hunt ${escapeXml(meta.productHuntDate || "")} 日榜中文精选，共 ${products.length} 个新品。</p>`,
    `<ol>${rows}</ol>`,
    `<p><a href="${escapeXml(`${SITE_URL}?date=${meta.date || ""}`)}">查看完整日报</a></p>`,
  ].join("");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const index = await readJson(ISSUES_INDEX);
  const issues = Array.isArray(index.issues) ? index.issues.slice(0, MAX_ITEMS) : [];
  const items = [];

  for (const issue of issues) {
    const data = await readJson(resolve(ROOT, issue.url.replace(/^\.\//, "")));
    const meta = data.meta || {};
    const date = meta.date || issue.date;
    const link = `${SITE_URL}?date=${encodeURIComponent(date)}`;
    items.push([
      "    <item>",
      `      <title>${escapeXml(`${date} · ${issue.title || "产品灵感日报"}`)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
      `      <pubDate>${escapeXml(formatDate(meta.lastUpdated || issue.lastUpdated))}</pubDate>`,
      `      <description>${escapeXml(issueDescription(data))}</description>`,
      "    </item>",
    ].join("\n"));
  }

  const latest = issues[0];
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>产品灵感日报 | PH 中文精选</title>
    <link>${escapeXml(SITE_URL)}</link>
    <atom:link href="${escapeXml(absoluteUrl("./feed.xml"))}" rel="self" type="application/rss+xml" />
    <description>每天一份值得研究的 Product Hunt 中文产品榜单。</description>
    <language>zh-CN</language>
    <lastBuildDate>${escapeXml(formatDate(latest?.lastUpdated))}</lastBuildDate>
    <generator>ph-cn-picks</generator>
${items.join("\n")}
  </channel>
</rss>
`;

  await writeFile(FEED_PATH, rss, "utf8");
  console.log(`Wrote RSS feed with ${items.length} items to ${FEED_PATH}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
