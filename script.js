const DATA_URL = "./data/products.json";
const ISSUES_URL = "./data/issues.json";

const state = {
  products: [], filtered: [], issues: [], activeTopic: "all", query: "",
  meta: null, selectedId: null, saved: new Set(JSON.parse(localStorage.getItem("ph-cn-saved") || "[]")),
};

const $ = (selector) => document.querySelector(selector);
const els = {
  sidebarDate: $("#sidebar-date"), sidebarVolume: $("#sidebar-volume"), currentIssueLink: $("#current-issue-link"),
  calendarMonth: $("#calendar-month"), calendarGrid: $("#calendar-grid"), archiveCount: $("#archive-count"),
  issueRail: $("#issue-rail"), volume: $("#volume-label"),
  stories: $("#stories-label"), dateLine: $("#date-line"), lastUpdated: $("#last-updated"),
  rankingWindow: $("#ranking-window"), search: $("#search-input"), topics: $("#topic-filters"),
  list: $("#product-list"), summary: $("#result-summary"), empty: $("#empty-state"),
  template: $("#product-row-template"), detail: $("#feature-detail"), save: $("#save-product"),
};

const normalize = (value) => String(value || "").trim().toLowerCase();
const productId = (p) => String(p.id || p.slug || p.name);
const phUrl = (p) => p.productHuntUrl || `https://www.producthunt.com/search?q=${encodeURIComponent(p.name || "")}`;
const siteUrl = (p) => p.websiteUrl || phUrl(p);
const topicLabel = { ai: "AI", developer: "开发", productivity: "效率", design: "设计" };

function formatChineseDate(value) {
  if (!value) return "日期待更新";
  const date = new Date(`${value}T00:00:00+08:00`);
  const weekday = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", weekday: "long" }).format(date);
  return `${value.replaceAll("-", ".")}　${weekday}`;
}

function volumeNumber(issue, index = 0) {
  const fromIssue = String(issue?.volume || issue?.vol || "").match(/\d+/)?.[0];
  if (fromIssue) return fromIssue.padStart(4, "0");
  return String(Math.max(1, 361 - index)).padStart(4, "0");
}

function renderCalendar(dateValue) {
  if (!dateValue) return;
  const active = new Date(`${dateValue}T00:00:00+08:00`);
  const year = active.getFullYear();
  const month = active.getMonth();
  const issueByDate = new Map(state.issues.map((issue) => [issue.date, issue]));
  els.calendarMonth.textContent = `${year}年${month + 1}月`;

  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const nodes = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const calendarDate = [
      day.getFullYear(),
      String(day.getMonth() + 1).padStart(2, "0"),
      String(day.getDate()).padStart(2, "0"),
    ].join("-");
    const issue = issueByDate.get(calendarDate);
    const item = document.createElement(issue ? "a" : "span");
    item.className = "calendar-day";
    if (issue) {
      item.dataset.date = calendarDate;
      const url = new URL(location.href);
      url.searchParams.set("date", calendarDate);
      item.href = url.toString();
      item.title = `${calendarDate} · ${issue.title || "产品灵感日报"}`;
      item.setAttribute("aria-label", `查看 ${calendarDate} 日报`);
    }
    if (day.getMonth() !== month) item.classList.add("muted");
    if (
      day.getFullYear() === active.getFullYear() &&
      day.getMonth() === active.getMonth() &&
      day.getDate() === active.getDate()
    ) item.classList.add("active");
    item.textContent = String(day.getDate());
    return item;
  });
  els.calendarGrid.replaceChildren(...nodes);
}

function productMatches(p) {
  const buckets = p.buckets || [];
  const topicMatch = state.activeTopic === "all" || buckets.includes(state.activeTopic);
  const text = [p.name, p.tagline, p.summaryZh, p.descriptionZh, ...(p.topics || [])].map(normalize).join(" ");
  return topicMatch && (!state.query || text.includes(normalize(state.query)));
}

function renderMeta() {
  const meta = state.meta || {};
  els.sidebarDate.textContent = meta.date || "等待数据";
  els.volume.textContent = `VOL.${String(meta.date || "").replaceAll("-", ".")}`;
  els.stories.textContent = `${state.products.length} STORIES`;
  els.dateLine.textContent = formatChineseDate(meta.date);
  els.lastUpdated.textContent = meta.lastUpdated
    ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" }).format(new Date(meta.lastUpdated))
    : "每日 17:00 后";
  els.rankingWindow.textContent = meta.productHuntDate ? `Product Hunt ${meta.productHuntDate} 日榜` : "Product Hunt 当日热榜";
  const activeIssue = state.issues.find((issue) => issue.date === meta.date) || { date: meta.date, title: "产品灵感日报" };
  const activeIndex = Math.max(0, state.issues.findIndex((issue) => issue.date === meta.date));
  els.sidebarVolume.textContent = `Vol. ${volumeNumber(activeIssue, activeIndex)}`;
  els.currentIssueLink.href = `?date=${meta.date}`;
  els.archiveCount.textContent = `(${state.issues.length || 1})`;
  renderCalendar(meta.date);
  els.issueRail.replaceChildren(...state.issues.map((issue, index) => {
    const link = document.createElement("a");
    link.className = `issue-link${issue.date === meta.date ? " active" : ""}`;
    link.href = issue.date === meta.date ? location.pathname + location.search : `?date=${issue.date}`;
    link.setAttribute("aria-current", issue.date === meta.date ? "page" : "false");
    const date = document.createElement("span");
    date.className = "issue-date";
    date.textContent = issue.date || "待定";
    const title = document.createElement("span");
    title.className = "issue-title";
    title.textContent = `Vol. ${volumeNumber(issue, index)}`;
    link.append(date, title);
    return link;
  }));
}

function renderRow(p) {
  const row = els.template.content.firstElementChild.cloneNode(true);
  row.dataset.id = productId(p);
  row.classList.toggle("active", productId(p) === state.selectedId);
  row.querySelector(".rank").textContent = String(p.rank || "—").padStart(2, "0");
  const thumb = row.querySelector(".product-thumb img");
  thumb.src = p.image || "";
  thumb.alt = "";
  row.querySelector(".product-name").textContent = p.name || "Untitled";
  row.querySelector(".product-tagline").textContent = p.summaryZh || p.tagline || "暂无标语";
  row.querySelector(".product-topics").textContent = (p.buckets || []).map((x) => topicLabel[x] || x).join(" · ");
  row.querySelector(".product-score").textContent = `▲ ${p.votes || 0}`;
  row.addEventListener("click", () => selectProduct(p));
  return row;
}

function intro(p) {
  return p.descriptionZh || p.summaryZh || p.description || p.tagline || "这个产品值得加入今天的灵感研究清单。";
}

function selectProduct(p, scroll = true) {
  state.selectedId = productId(p);
  const saved = state.saved.has(state.selectedId);
  els.save.textContent = saved ? "已收藏" : "收藏本项";
  els.save.classList.toggle("saved", saved);
  els.detail.innerHTML = `
    <figure class="feature-visual">
      <img src="${p.image || ""}" alt="${p.name || "产品"} 产品展示图" />
      <span class="feature-rank">NO.${String(p.rank || "—").padStart(2, "0")}</span>
    </figure>
    <div class="feature-head">
      <div><h2>${p.name || "Untitled"}</h2><p>${p.summaryZh || p.tagline || "暂无标语"}</p></div>
      <div class="metric"><strong>${p.votes || 0}</strong><span>UPVOTES · ${p.comments || 0} COMMENTS</span></div>
    </div>
    <div class="feature-body">
      <p>${intro(p)}</p>
      <dl class="feature-meta">
        <div><dt>Category</dt><dd>${(p.buckets || []).map((x) => topicLabel[x] || x).join(" · ") || "其他"}</dd></div>
        <div><dt>Topics</dt><dd>${(p.topics || []).slice(0, 5).join(" · ") || "暂无标签"}</dd></div>
        <div><dt>Featured</dt><dd>${p.featured === false ? "否" : "是"}</dd></div>
      </dl>
    </div>
    <div class="feature-actions">
      <a href="${siteUrl(p)}" target="_blank" rel="noreferrer">访问官网</a>
      <a href="${phUrl(p)}" target="_blank" rel="noreferrer">Product Hunt</a>
    </div>`;
  els.list.querySelectorAll(".product-row").forEach((row) => row.classList.toggle("active", row.dataset.id === state.selectedId));
  if (scroll && matchMedia("(max-width: 780px)").matches) $(".feature-column").scrollIntoView({ behavior: "smooth" });
}

function render() {
  renderMeta();
  state.filtered = state.products.filter(productMatches).sort((a, b) => (a.rank || 999) - (b.rank || 999));
  els.list.replaceChildren(...state.filtered.map(renderRow));
  els.empty.hidden = state.filtered.length > 0;
  els.summary.textContent = `${state.filtered.length} / ${state.products.length} PRODUCTS`;
  const selected = state.filtered.find((p) => productId(p) === state.selectedId) || state.filtered[0];
  if (selected) selectProduct(selected, false);
  else els.detail.innerHTML = "";
}

function getRequestedDate() {
  const date = new URLSearchParams(location.search).get("date");
  return /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date : "";
}

async function loadProducts() {
  try {
    const index = await fetch(ISSUES_URL, { cache: "no-store" }).then((r) => r.json());
    state.issues = index.issues || [];
    const date = getRequestedDate() || index.latest || state.issues[0]?.date;
    const issue = state.issues.find((x) => x.date === date);
    const data = await fetch(issue?.url || DATA_URL, { cache: "no-store" }).then((r) => r.json());
    state.meta = data.meta || {};
    state.products = data.products || [];
    state.selectedId = productId(state.products[0] || {});
    render();
  } catch (error) {
    console.error(error);
    els.summary.textContent = "数据暂时不可用";
    els.empty.hidden = false;
  }
}

els.search.addEventListener("input", (event) => { state.query = event.target.value; render(); });
els.topics.addEventListener("click", (event) => {
  const button = event.target.closest("[data-topic]");
  if (!button) return;
  state.activeTopic = button.dataset.topic;
  els.topics.querySelectorAll(".segment").forEach((x) => x.classList.toggle("active", x === button));
  render();
});
els.save.addEventListener("click", () => {
  if (!state.selectedId) return;
  state.saved.has(state.selectedId) ? state.saved.delete(state.selectedId) : state.saved.add(state.selectedId);
  localStorage.setItem("ph-cn-saved", JSON.stringify([...state.saved]));
  const p = state.products.find((x) => productId(x) === state.selectedId);
  if (p) selectProduct(p, false);
});

loadProducts();
