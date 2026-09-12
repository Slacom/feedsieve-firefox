# Firefox 独立 fork

本仓库基于 [realchendahuang/feedsieve](https://github.com/realchendahuang/feedsieve) 的公开代码，保留检测器、X 页面适配、持久化拉黑队列和 React 工作区，并加入 Firefox 专用构建目标。

Firefox 构建使用 Manifest V3、`sidebar_action` 和 Firefox 的后台脚本兼容路径；Chrome 构建仍可用，两个目标共用业务逻辑。

## 本地构建

环境要求：Node.js 22 或更高版本、pnpm 11。

```powershell
pnpm install
pnpm build:firefox
```

开发模式：

```powershell
pnpm --filter @feedsieve/extension dev:firefox
```

构建目录为 `apps/extension/.output/firefox-mv3`。

## 在 Firefox 中临时加载

1. 打开 `about:debugging#/runtime/this-firefox`。
2. 点击“临时载入附加组件”。
3. 选择 `apps/extension/.output/firefox-mv3/manifest.json`。
4. 打开 `https://x.com/`，刷新页面后即可看到黄框标注和操作入口。

工具栏弹窗中提供“打开侧边栏”入口；也可以使用 Firefox 的“查看 → 侧栏”菜单选择 FeedSieve Firefox。

## 生成 Firefox ZIP

```powershell
pnpm pack:firefox
```

产物：

- `apps/extension/.output/feedsieve-<版本>-firefox.zip`
- 同目录的 `.sha256` 校验文件
- WXT 同时生成用于审查的 `feedsieve-<版本>-sources.zip`

未签名 ZIP 适合本地开发和提交前检查；永久安装、自动更新或提交 AMO 需要按照 Mozilla 的签名/分发流程处理。

## Firefox manifest 说明

- 扩展权限：`storage`。
- 页面权限：`https://x.com/*` 和官方社区 API `https://api.feedsieve.win/*`。
- 侧栏页面：复用 `popup.html`，避免维护两套工作区 UI。
- `browser_specific_settings.gecko.id` 当前为 `@feedsieve-firefox`；正式提交 AMO 前，如发生 ID 冲突，应在发布配置中改成可用的唯一 ID。
- 核心识别、拉黑、撤销和统计在本地运行；社区名单上传仍受扩展设置中的开关控制。Firefox manifest 中将相关数据类型标为可选，新安装默认仅本地运行；用户关闭或拒绝可选传输时，名单、短语、抢救票、贡献统计和猎手档案请求都会被门控，不影响本地清理功能。重新打开“名单上传”或执行档案写入会在用户手势中请求 Firefox 同意。

## 验证

```powershell
pnpm --filter @feedsieve/extension typecheck
pnpm lint
pnpm test
pnpm pack:firefox
```

仓库级门禁直接运行 `pnpm verify`；它使用跨平台 Node 编排，不依赖 Windows 上的 `sh`，并会同时构建 Chrome 与 Firefox 目标。

`pnpm test` 还会校验仓库内社区名单快照；若上游快照与其 manifest 已经不一致，需先按上游维护流程更新快照，不能把该失败误判为 Firefox 构建失败。
