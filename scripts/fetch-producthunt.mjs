#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API_URL = "https://api.producthunt.com/v2/api/graphql";
const PRODUCT_HUNT_TIMEZONE = "America/Los_Angeles";
const ISSUE_TIMEZONE = "Asia/Shanghai";
const DEFAULT_LIMIT = 30;
const MIN_SELECTED = 20;
const TARGET_TOPICS = {
  ai: ["ai", "artificial intelligence", "machine learning", "chatgpt", "llm"],
  developer: ["developer tools", "api", "github", "documentation", "no-code", "web app"],
  productivity: ["productivity", "calendar", "task management", "automation", "workflow"],
  design: ["design tools", "design", "figma", "marketing", "video", "maker tools"],
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = resolve(__dirname, "../data/products.json");

function parseArgs(argv) {
  const args = {
    date: getDefaultProductHuntDate(),
    issueDate: formatDateInTimeZone(new Date(), ISSUE_TIMEZONE),
    out: DEFAULT_OUT,
    limit: DEFAULT_LIMIT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--date") args.date = argv[index + 1];
    if (item === "--issue-date") args.issueDate = argv[index + 1];
    if (item === "--out") args.out = resolve(argv[index + 1]);
    if (item === "--limit") args.limit = Number(argv[index + 1]);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
    throw new Error("Invalid --date. Expected YYYY-MM-DD.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.issueDate)) {
    throw new Error("Invalid --issue-date. Expected YYYY-MM-DD.");
  }

  if (!Number.isFinite(args.limit) || args.limit < 1 || args.limit > 50) {
    throw new Error("Invalid --limit. Expected a number from 1 to 50.");
  }

  return args;
}

function formatDateInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getDefaultProductHuntDate(now = new Date()) {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return formatDateInTimeZone(yesterday, PRODUCT_HUNT_TIMEZONE);
}

function getZonedParts(date, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = Number(part.value);
    return acc;
  }, {});
}

function getTimeZoneOffsetMs(timeZone, date) {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

function zonedTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0 }, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const firstOffset = getTimeZoneOffsetMs(timeZone, new Date(utcGuess));
  const firstResult = new Date(utcGuess - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(timeZone, firstResult);
  return new Date(utcGuess - secondOffset);
}

function parseDateParts(date) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function getDateWindow(date) {
  const start = zonedTimeToUtc(parseDateParts(date), PRODUCT_HUNT_TIMEZONE);
  const endParts = new Date(start.getTime() + 36 * 60 * 60 * 1000);
  const nextProductHuntDay = formatDateInTimeZone(endParts, PRODUCT_HUNT_TIMEZONE);
  const end = zonedTimeToUtc(parseDateParts(nextProductHuntDay), PRODUCT_HUNT_TIMEZONE);
  return {
    postedAfter: start.toISOString(),
    postedBefore: end.toISOString(),
  };
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function classify(topics) {
  const normalizedTopics = topics.map(normalize);
  const buckets = Object.entries(TARGET_TOPICS)
    .filter(([, keywords]) =>
      normalizedTopics.some((topic) => keywords.some((keyword) => topic.includes(keyword) || keyword.includes(topic))),
    )
    .map(([bucket]) => bucket);

  return [...new Set(buckets)];
}

function pickProducts(products) {
  const relevant = products.filter((product) => product.buckets.length > 0);
  const selected = relevant.length >= MIN_SELECTED ? relevant : [...relevant, ...products.filter((item) => !relevant.includes(item))];
  return selected.slice(0, DEFAULT_LIMIT);
}

function extractNodes(connection) {
  if (!connection) return [];
  if (Array.isArray(connection.nodes)) return connection.nodes;
  if (Array.isArray(connection.edges)) return connection.edges.map((edge) => edge.node).filter(Boolean);
  return [];
}

async function fetchProductHuntPosts({ token, date, limit }) {
  const { postedAfter, postedBefore } = getDateWindow(date);
  const query = `
    query DailyPosts($first: Int!, $postedAfter: DateTime!, $postedBefore: DateTime!) {
      posts(first: $first, postedAfter: $postedAfter, postedBefore: $postedBefore) {
        edges {
          node {
            id
            name
            tagline
            description
            url
            website
            dailyRank
            votesCount
            commentsCount
            featuredAt
            thumbnail {
              url
            }
            topics(first: 8) {
              edges {
                node {
                  name
                  slug
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { first: limit, postedAfter, postedBefore },
    }),
  });

  if (response.status === 429) {
    throw new Error("Product Hunt API rate limit reached (429). Old data was left untouched.");
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Product Hunt API failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  if (body?.errors?.length) {
    throw new Error(`Product Hunt GraphQL errors: ${body.errors.map((error) => error.message).join("; ")}`);
  }

  return extractNodes(body?.data?.posts);
}

function sortPosts(posts) {
  return [...posts].sort((a, b) => {
    const rankA = Number(a.dailyRank || 9999);
    const rankB = Number(b.dailyRank || 9999);
    if (rankA !== rankB) return rankA - rankB;
    return Number(b.votesCount || 0) - Number(a.votesCount || 0);
  });
}

async function translateText(text, productName) {
  const endpoint = process.env.TRANSLATE_API_URL;
  if (!endpoint || !text) return `待翻译：${text || productName}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.TRANSLATE_API_KEY ? { Authorization: `Bearer ${process.env.TRANSLATE_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      text,
      targetLanguage: "zh-CN",
      style: "concise product summary",
      productName,
    }),
  });

  if (!response.ok) throw new Error(`Translation service failed with HTTP ${response.status}`);

  const data = await response.json();
  return String(data.translation || data.text || data.result || "").trim() || `待翻译：${text}`;
}

async function mapPost(post, index, date, issueDate, lastUpdated) {
  const topics = extractNodes(post.topics)
    .map((topic) => topic.name || topic.slug)
    .filter(Boolean);
  const buckets = classify(topics);
  const baseText = post.description || post.tagline || "";
  let summaryZh;

  try {
    summaryZh = await translateText(baseText, post.name);
  } catch (error) {
    summaryZh = `待翻译：${baseText || post.name}`;
    console.warn(`[translate] ${post.name}: ${error.message}`);
  }

  return {
    name: post.name,
    tagline: post.tagline || "",
    summaryZh,
    description: post.description || "",
    thumbnail: post.thumbnail?.url || "",
    image: post.thumbnail?.url || "",
    productHuntUrl: post.url || "",
    websiteUrl: post.website || "",
    votes: Number(post.votesCount || 0),
    comments: Number(post.commentsCount || 0),
    featured: Boolean(post.featuredAt),
    publishedAt: post.featuredAt || null,
    rank: Number(post.dailyRank || index + 1),
    topics,
    buckets,
    date: issueDate,
    productHuntDate: date,
    lastUpdated,
  };
}

async function readPreviousData(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function writeData(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.PRODUCTHUNT_TOKEN;

  if (!token) {
    throw new Error("Missing PRODUCTHUNT_TOKEN. Create a Product Hunt developer token and export it before running.");
  }

  const previous = await readPreviousData(args.out);
  const lastUpdated = new Date().toISOString();
  const posts = await fetchProductHuntPosts({ token, date: args.date, limit: args.limit });

  if (posts.length === 0) {
    const fallback = previous || { products: [] };
    await writeData(args.out, {
      ...fallback,
      meta: {
        ...(fallback.meta || {}),
        date: args.issueDate,
        productHuntDate: args.date,
        status: "fallback",
        error: "Product Hunt API returned no posts for the selected date.",
      },
    });
    console.warn("Product Hunt returned no posts. Existing data was preserved with fallback status.");
    return;
  }

  const rankedPosts = sortPosts(posts);
  const mapped = [];
  for (let index = 0; index < rankedPosts.length; index += 1) {
    mapped.push(await mapPost(rankedPosts[index], index, args.date, args.issueDate, lastUpdated));
  }

  const products = pickProducts(mapped);
  const issueDay = args.issueDate.split("-").at(-1);
  await writeData(args.out, {
    meta: {
      date: args.issueDate,
      productHuntDate: args.date,
      lastUpdated,
      status: "live",
      source: "producthunt-api-v2",
      timezone: ISSUE_TIMEZONE,
      productHuntTimezone: PRODUCT_HUNT_TIMEZONE,
      attribution: "Product data attributed to Product Hunt.",
      commercialUsage: "Product Hunt API must not be used for commercial purposes without Product Hunt approval.",
      issues: [{
        day: issueDay,
        title: `产品灵感日报 · ${products.length} 个新品`,
      }],
    },
    products,
  });

  console.log(`Wrote ${products.length} products to ${args.out}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
