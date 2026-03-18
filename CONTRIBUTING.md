# Contributing

## English

Thanks for your interest in contributing.

### Development

- Node.js: `>= 18` (recommended: latest LTS)
- Start: `node index.mjs`
- Web panel: `http://127.0.0.1:3210/` (default)

### Pull Requests

- Keep changes focused and small when possible.
- Do not commit secrets. This repo ignores `config.json` and `data/*` state by default.
- For UI changes, keep CN/EN strings in sync (`src/webui/modern/i18n.js` and `src/botI18n.js`).
- For security-related changes, add a short note in the PR description explaining threat model and tradeoffs.

## 中文

欢迎贡献代码与改进建议。

### 本地开发

- Node.js：`>= 18`（推荐：最新 LTS）
- 启动：`node index.mjs`
- 控制面板：默认 `http://127.0.0.1:3210/`

### 提交 PR

- 尽量保持改动小而聚焦。
- 不要提交任何密钥/Token。仓库默认忽略 `config.json` 和 `data/*` 状态文件。
- UI 文案保持中英文同步（`src/webui/modern/i18n.js` 与 `src/botI18n.js`）。

