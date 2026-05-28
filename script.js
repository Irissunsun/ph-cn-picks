const DATA_URL = "./data/products.json";

const state = {
  products: [],
  filtered: [],
  activeTopic: "all",
  query: "",
  meta: null,
};

const els = {
  sidebarDate: document.querySelector("#sidebar-date"),
  issueList: document.querySelector("#issue-list"),
  volumeLabel: document.querySelector("#volume-label"),
  storiesLabel: document.querySelector("#stories-label"),
  dateLine: document.querySelector("#date-line"),
  lastUpdated: document.querySelector("#last-updated"),
  rankingWindow: document.querySelector("#ranking-window"),
  search: document.querySelector("#search-input"),
  topicFilters: document.querySelector("#topic-filters"),
  list: document.querySelector("#product-list"),
  summary: document.querySelector("#result-summary"),
  empty: document.querySelector("#empty-state"),
  template: document.querySelector("#product-card-template"),
};

function formatDate(value) {
  if (!value) return "未知日期";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(`${value}T00:00:00+08:00`));
}

function formatVolumeDate(value) {
  return String(value || "").replaceAll("-", ".");
}

function formatChineseDate(value) {
  if (!value) return "日期待更新";
  const date = new Date(`${value}T00:00:00+08:00`);
  const digits = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const months = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
  const year = String(date.getFullYear()).split("").map((digit) => digits[Number(digit)]).join("");
  const dayNumber = date.getDate();
  const day = dayNumber <= 10
    ? `初${digits[dayNumber]}`
    : dayNumber < 20
      ? `十${digits[dayNumber - 10]}`
      : dayNumber === 20
        ? "二十"
        : dayNumber < 30
          ? `二十${digits[dayNumber - 20]}`
          : dayNumber === 30
            ? "三十"
            : "三十一";
  const dateText = `${year}年${months[date.getMonth()]}${day}日`;
  const weekday = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    weekday: "long",
  }).format(date);
  return `${dateText}　${weekday}`;
}

function formatDateTime(value) {
  if (!value) return "暂无成功更新时间";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPublishTime(value, fallbackDate) {
  const date = value ? new Date(value) : new Date(`${fallbackDate || state.meta?.date}T15:01:00+08:00`);
  if (Number.isNaN(date.getTime())) return "暂无发布时间";
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}年${parts.month}月${parts.day}日 ${parts.hour}:${parts.minute} (北京时间)`;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function productMatchesTopic(product) {
  if (state.activeTopic === "all") return true;
  const buckets = product.buckets || [];
  const topics = (product.topics || []).map((topic) => normalizeText(topic));
  return buckets.includes(state.activeTopic) || topics.some((topic) => topic.includes(state.activeTopic));
}

function productMatchesQuery(product) {
  const query = normalizeText(state.query);
  if (!query) return true;

  const haystack = [
    product.name,
    product.tagline,
    product.summaryZh,
    product.description,
    ...(product.topics || []),
  ]
    .map(normalizeText)
    .join(" ");

  return haystack.includes(query);
}

function sortProducts(products) {
  return [...products].sort((a, b) => {
    return (a.rank || 999) - (b.rank || 999);
  });
}

function applyFilters() {
  state.filtered = sortProducts(state.products.filter(productMatchesTopic).filter(productMatchesQuery));
  render();
}

function renderMeta() {
  const meta = state.meta || {};
  els.sidebarDate.textContent = meta.date || "等待数据";
  els.volumeLabel.textContent = `VOL.${formatVolumeDate(meta.date)}`;
  els.storiesLabel.textContent = `${state.products.length} STORIES`;
  els.dateLine.textContent = formatChineseDate(meta.date);
  els.lastUpdated.textContent = `北京时间每日 16:30 自动生成；最后成功更新：${formatDateTime(meta.lastUpdated)}`;
  if (els.rankingWindow) {
    const phDate = meta.productHuntDate ? formatDate(meta.productHuntDate) : "等待数据";
    const issueDate = meta.date ? formatDate(meta.date) : "等待数据";
    els.rankingWindow.textContent = `本期发布日：${issueDate}；数据基于 Product Hunt ${phDate} 日榜。`;
  }
  renderIssues(meta);
}

function renderIssues(meta) {
  const issues = Array.isArray(meta.issues) && meta.issues.length > 0
    ? meta.issues
    : buildFallbackIssues(meta.date);

  els.issueList.replaceChildren(
    ...issues.map((issue, index) => {
      const link = document.createElement("a");
      link.href = index === 0 ? "#daily" : "#";
      link.className = `issue-link${index === 0 ? " active" : ""}`;
      const day = document.createElement("span");
      day.className = "issue-day";
      day.textContent = `${issue.day} 日`;
      const title = document.createElement("span");
      title.className = "issue-title";
      title.textContent = issue.title;
      link.append(day, title);
      return link;
    }),
  );
}

function buildFallbackIssues(date) {
  const base = date ? new Date(`${date}T00:00:00+08:00`) : new Date();
  return [{
    day: String(base.getDate()).padStart(2, "0"),
    title: "产品灵感日报 · 本期",
  }];
}

function createTag(label) {
  const tag = document.createElement("span");
  tag.textContent = label;
  return tag;
}

function isGenericProductHuntUrl(url) {
  const value = String(url || "").replace(/\/+$/, "");
  return value === "https://www.producthunt.com" || value === "https://producthunt.com";
}

function isProductHuntProductPage(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "") === "producthunt.com" && parsed.pathname.startsWith("/products/");
  } catch {
    return false;
  }
}

function getProductHuntUrl(product) {
  if (product.productHuntUrl && !isGenericProductHuntUrl(product.productHuntUrl)) {
    return product.productHuntUrl;
  }
  return `https://www.producthunt.com/search?q=${encodeURIComponent(product.name || "")}`;
}

function buildChineseIntro(product) {
  if (product.descriptionZh) return product.descriptionZh;
  const summary = product.summaryZh || product.tagline || "这个产品提供了一组新的工具能力。";
  const topics = (product.topics || []).slice(0, 4).join("、");
  const topicText = topics ? `它主要关联 ${topics} 等方向，` : "";
  const bucketMap = {
    ai: "AI 应用和自动化探索",
    developer: "开发者工作流优化",
    productivity: "个人或团队效率提升",
    design: "设计、内容或发布素材生产",
  };
  const scenes = (product.buckets || []).map((bucket) => bucketMap[bucket]).filter(Boolean);
  const sceneText = scenes.length > 0 ? `适合关注${[...new Set(scenes)].join("、")}的人进一步研究。` : "适合加入当天的产品灵感池继续观察。";
  return `${summary} ${topicText}${sceneText}`;
}

function renderProduct(product) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  const phLink = node.querySelector(".primary-link");
  const websiteLink = node.querySelector(".secondary-link");
  const phTextLink = node.querySelector(".ph-text-link");
  const websiteTextLink = node.querySelector(".website-text-link");
  const titleLink = node.querySelector(".title-link");
  const image = node.querySelector(".product-image");
  const topics = product.topics || [];
  const keywords = [
    product.name,
    ...topics,
    ...(product.buckets || []).map((bucket) => ({ ai: "AI", developer: "开发工具", productivity: "效率", design: "设计工具" })[bucket] || bucket),
  ].filter(Boolean);
  const phUrl = getProductHuntUrl(product);
  const hasProductHuntPage = product.productHuntUrl && !isGenericProductHuntUrl(product.productHuntUrl);
  const hasSpecificWebsite = product.websiteUrl && !isGenericProductHuntUrl(product.websiteUrl) && !isProductHuntProductPage(product.websiteUrl);
  const siteUrl = hasSpecificWebsite ? product.websiteUrl : phUrl;

  node.querySelector(".rank-pill").textContent = `${product.votes || 0} 票 · ${product.comments || 0} 评`;
  titleLink.textContent = `${product.rank || "-"}. ${product.name || "Untitled"}`;
  titleLink.href = phUrl;
  node.querySelector(".summary").textContent = buildChineseIntro(product);
  node.querySelector(".tagline").textContent = product.summaryZh || product.tagline || "暂无标语";
  const source = node.querySelector(".source-line");
  source.append(createTag("官方"), document.createTextNode(`${product.name || "Product"} · Product Hunt`));
  node.querySelector(".keywords").textContent = [...new Set(keywords)].join("，");
  node.querySelector(".votes-line").textContent = `▲ ${product.votes || 0}`;
  node.querySelector(".featured-line").textContent = product.featured === false ? "否" : "是";
  node.querySelector(".published-line").textContent = product.publishedAtText || formatPublishTime(product.publishedAt, product.date);

  image.src = product.image || `https://placehold.co/1200x630/f7f1f3/8f2f46?text=${encodeURIComponent(product.name || "Product")}`;
  image.alt = product.name ? `${product.name} 产品展示图` : "产品展示图";
  image.onerror = () => {
    image.src = `https://placehold.co/1200x630/f7f1f3/8f2f46?text=${encodeURIComponent(product.name || "Product")}`;
  };

  phLink.href = phUrl;
  phTextLink.href = phUrl;
  if (!hasProductHuntPage) {
    phLink.textContent = "搜索 PH";
    phTextLink.textContent = "在 Product Hunt 搜索";
  }
  websiteLink.href = siteUrl;
  websiteTextLink.href = siteUrl;
  if (!hasSpecificWebsite) {
    websiteLink.textContent = "来源页";
    websiteTextLink.textContent = "查看来源页";
  }

  return node;
}

function render() {
  renderMeta();
  els.list.replaceChildren(...state.filtered.map(renderProduct));
  els.empty.hidden = state.filtered.length !== 0;
  els.summary.textContent = `显示 ${state.filtered.length} / ${state.products.length} 个产品`;
}

function bindEvents() {
  els.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    applyFilters();
  });

  els.topicFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-topic]");
    if (!button) return;
    state.activeTopic = button.dataset.topic;
    els.topicFilters.querySelectorAll(".segment").forEach((segment) => {
      segment.classList.toggle("active", segment === button);
    });
    applyFilters();
  });
}

async function loadProducts() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.meta = data.meta || {};
    state.products = Array.isArray(data.products) ? data.products : [];
    applyFilters();
  } catch (error) {
    state.meta = {
      date: new Date().toISOString().slice(0, 10),
      lastUpdated: null,
      status: "fallback",
    };
    state.products = [];
    state.filtered = [];
    render();
    els.summary.textContent = "数据文件未能载入";
    els.empty.hidden = false;
    els.empty.querySelector("strong").textContent = "数据暂时不可用";
    els.empty.querySelector("p").textContent = "请检查 data/products.json 是否存在，或稍后重试。";
    console.error(error);
  }
}

bindEvents();
loadProducts();
