# 产品灵感日报

静态版 Product Hunt 中文精选站。页面读取 `data/products.json`，定时任务每天生成一次数据。

## 本地预览

```bash
npm run check
npm run serve
```

打开 `http://localhost:4177/`。

## 每天自动更新

Product Hunt 按 `America/Los_Angeles` 的自然日更新榜单。脚本默认抓取“Product Hunt 昨日完整榜单”，适合每天北京时间 17:00 后运行。

## 推到 GitHub

本目录已经可以作为独立仓库使用。创建 GitHub 空仓库后，在本地执行：

```bash
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

然后在 GitHub 仓库里配置：

1. `Settings -> Secrets and variables -> Actions -> New repository secret`
2. 新增 `PRODUCTHUNT_TOKEN`
3. `Settings -> Pages -> Build and deployment -> Source` 选择 `GitHub Actions`
4. `Actions -> Update Product Hunt Daily -> Run workflow` 手动试跑一次

试跑成功后，工作流会每天北京时间 17:00 自动更新 `data/products.json` 并部署页面。

### 本地或 VPS

```bash
export PRODUCTHUNT_TOKEN="你的 Product Hunt API token"
cd /path/to/ph-cn-picks
npm run update:daily
```

cron 示例：

```cron
0 17 * * * cd /path/to/ph-cn-picks && PRODUCTHUNT_TOKEN=你的token npm run update:daily
```

### GitHub Actions

把本目录作为仓库根目录使用时，`.github/workflows/update-producthunt-daily.yml` 会每天 UTC 09:00 运行，也就是北京时间 17:00。

需要在 GitHub 仓库 Secrets 里配置：

- `PRODUCTHUNT_TOKEN`：必填，Product Hunt API v2 token。
- `TRANSLATE_API_URL`：可选，中文翻译接口。
- `TRANSLATE_API_KEY`：可选，翻译接口鉴权。

推到 GitHub 后，进入仓库的 `Actions` 页面，可以手动点 `Update Product Hunt Daily` 里的 `Run workflow` 先试跑一次。正常跑完会自动提交更新后的 `data/products.json`，随后立刻部署 GitHub Pages。

### GitHub Pages 部署

仓库推到 GitHub 后，到 `Settings -> Pages -> Build and deployment` 里选择 `GitHub Actions`。

有两条发布路径：

- `update-producthunt-daily.yml`：每天北京时间 17:00 更新数据，并在同一次任务里部署页面。
- `deploy-pages.yml`：普通 push 到 `main` 或手动触发时部署页面，适合改样式、改文案后发布。

如果用 Vercel 或 Cloudflare Pages，发布根目录就是这个项目目录，不需要构建命令。

### 手动指定日期

```bash
PRODUCTHUNT_TOKEN=你的token node scripts/fetch-producthunt.mjs --date 2026-05-27 --issue-date 2026-05-28
```

`--date` 是 Product Hunt 榜单日期，按洛杉矶时间理解。`--issue-date` 是页面展示的日报日期，按北京时间理解。
