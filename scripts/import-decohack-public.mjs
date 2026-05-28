import { readFileSync, writeFileSync } from "node:fs";

const [input = "/private/tmp/decohack-ph.html", output = "data/products.json"] = process.argv.slice(2);
const html = readFileSync(input, "utf8");

function decodeHtml(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value = "") {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(block, pattern) {
  const match = block.match(pattern);
  return match ? decodeHtml(match[1]).trim() : "";
}

function bucketFromKeywords(keywords) {
  const text = keywords.join(" ").toLowerCase();
  const buckets = new Set();
  if (/ai|人工智能|智能|agent|代理|claude|chatgpt|codex|模型|自动化/.test(text)) buckets.add("ai");
  if (/developer|api|代码|编程|开发|github|terminal|ci|服务器|ssh/.test(text)) buckets.add("developer");
  if (/productivity|效率|会议|crm|笔记|表格|管理|同步|搜索/.test(text)) buckets.add("productivity");
  if (/design|设计|视频|动画|视觉|图像|画布|素材|预览/.test(text)) buckets.add("design");
  return [...buckets];
}

const rawBlocks = html
  .split(/<hr\s*\/?>/i)
  .filter((block) => /<h2><a href="https:\/\/www\.producthunt\.com\/products\//.test(block));

const products = rawBlocks.slice(0, 30).map((block, index) => {
  const heading = block.match(/<h2><a href="([^"]+)"[^>]*>\s*(\d+)\.\s*([^<]+)<\/a><\/h2>/);
  if (!heading) return null;

  const productHuntUrl = decodeHtml(heading[1]);
  const rank = Number(heading[2]) || index + 1;
  const name = stripTags(heading[3]);
  const summaryZh = firstMatch(block, /<strong>标语<\/strong>[：:]\s*([\s\S]*?)<br\s*\/?>/);
  const descriptionZh = stripTags(firstMatch(block, /<strong>介绍<\/strong>[：:]\s*([\s\S]*?)<br\s*\/?>\s*<strong>产品网站<\/strong>/));
  const websiteUrl = firstMatch(block, /<strong>产品网站<\/strong>:\s*<a href="([^"]+)"/);
  const image = firstMatch(block, /<img[^>]+src="(https:\/\/ph-files\.imgix\.net\/[^"]+)"/);
  const keywords = firstMatch(block, /<strong>关键词<\/strong>[：:]\s*([\s\S]*?)<br\s*\/?>/)
    .split(/[，,]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
  const votes = Number(firstMatch(block, /<strong>票数<\/strong>:\s*[^0-9]*(\d+)/)) || 0;
  const featured = firstMatch(block, /<strong>是否精选<\/strong>[：:]\s*([\s\S]*?)<br\s*\/?>/) !== "否";
  const publishedAtText = firstMatch(block, /<strong>发布时间<\/strong>[：:]\s*([^<]+)/);

  return {
    name,
    tagline: summaryZh,
    summaryZh,
    description: summaryZh,
    descriptionZh,
    thumbnail: image,
    image,
    productHuntUrl,
    websiteUrl,
    votes,
    comments: 0,
    rank,
    topics: keywords.slice(1, 8),
    buckets: bucketFromKeywords(keywords),
    date: "2026-05-28",
    lastUpdated: "2026-05-28T18:57:19+08:00",
    featured,
    publishedAtText,
    slug: productHuntUrl.match(/\/products\/([^?]+)/)?.[1] || "",
  };
}).filter(Boolean);

const issues = [{
  day: "28",
  title: `产品灵感日报 · ${products.length} 个新品`,
}];

writeFileSync(output, `${JSON.stringify({
  meta: {
    date: "2026-05-28",
    lastUpdated: "2026-05-28T18:57:19+08:00",
    status: "public-page-import",
    source: "Product Hunt via Decohack public daily page",
    sourceUrl: "https://decohack.com/producthunt-daily-2026-05-28/",
    timezone: "Asia/Shanghai",
    issues,
  },
  products,
}, null, 2)}\n`);

console.log(`Imported ${products.length} products to ${output}`);
