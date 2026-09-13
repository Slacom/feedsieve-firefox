# FeedSieve Firefox

本仓库是 [realchendahuang/feedsieve](https://github.com/realchendahuang/feedsieve) 的独立 fork，专门用于 Firefox 浏览器适配。

在保留原项目核心能力的基础上，加入 Firefox Manifest V3、侧边栏和 Firefox 数据同意支持。

本适配由 Codex 协助完成，尚未经过完整验证，当前版本仅建议用于测试和评估。

## Firefox 安装测试

1. 从 [Releases](https://github.com/Slacom/feedsieve-firefox/releases) 下载 Firefox 压缩包并解压。
2. 在 Firefox 地址栏打开 `about:debugging#/runtime/this-firefox`。
3. 点击“临时载入附加组件”，选择解压目录中的 `manifest.json`。
4. 打开或刷新 `x.com`，即可开始测试。Firefox 重启后需重新加载。

构建与更多说明见 [`docs/FIREFOX.md`](docs/FIREFOX.md)。
