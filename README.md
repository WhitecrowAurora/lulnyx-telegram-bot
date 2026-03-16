# Telegram ChatGPT Bot (lightweight)
# Telegram ChatGPT 机器人（轻量版）

Lightweight Telegram bot + modern web admin panel (CN/EN, dark/light).
轻量级 Telegram 机器人 + 现代化 Web 控制面板（中英双语、深浅色主题）。

Supports OpenAI-compatible `/v1/responses` and `/v1/chat/completions`.
支持 OpenAI 兼容的 `/v1/responses` 与 `/v1/chat/completions`。

## Features
## 功能

- Multi-provider switch (different baseUrl/apiKey/model)
- 多提供方切换（不同 baseUrl/apiKey/model）
- Prompts, personas, rules, memory (JSON or SQLite)
- 提示词、人格、规则、记忆（JSON 或 SQLite）
- Secure admin panel (login, localhost-by-default, secrets masked on save)
- 安全控制台（登录、默认仅本机、保存时脱敏密钥）
- Allowlist-first Telegram access control (`telegram.allowAll=false` by default)
- Telegram 默认更安全（`telegram.allowAll=false`，优先白名单）
- Group mode: commands/menu, mention/reply triggers, optional per-group auto-reply
- 群聊：命令/菜单、@提及/回复触发、可选群自动回复
- Optional SearxNG web/image search + tool-calling search
- 可选 SearxNG 网页/图片搜索 + 工具调用搜索
- Optional daily quotas, usage analytics, queue/rate limit controls
- 可选每日配额、用量统计、队列/限速控制

## Quick start
## 快速开始

1) Start:
1）启动：

- `node index.mjs`

2) Open the web panel:
2）打开控制面板：

- `http://127.0.0.1:<server.port>/` (default: `3210`)
- `http://127.0.0.1:<server.port>/`（默认 `3210`）

If `config.json` is missing, a local-only setup wizard will create it.
如果没有 `config.json`，会进入“仅本机可用”的初始化向导自动创建。

## Single-binary build (optional)
## 单文件可执行（可选）

Node.js SEA can package this repo into one executable (build on the same OS/arch as your server).
可使用 Node.js SEA 打包为单文件（建议在与服务器相同的 OS/架构上构建）。

- Windows: `npm run build:sea:win` -> `dist/bot.exe`
- Windows：`npm run build:sea:win` -> `dist/bot.exe`
- Linux: `npm run build:sea:linux` -> `dist/bot`
- Linux：`npm run build:sea:linux` -> `dist/bot`

Put `config.json` next to the binary and run it from that directory.
将 `config.json` 放在可执行文件同目录下运行即可。

Compatibility note: Linux SEA binaries depend on system `glibc`.
兼容性提示：Linux 的 SEA 产物依赖系统 `glibc`。

## Providers
## 提供方配置

- `apiType`: `"chat_completions"` -> `/v1/chat/completions`, `"responses"` -> `/v1/responses`
- `apiType`：`"chat_completions"` -> `/v1/chat/completions`，`"responses"` -> `/v1/responses`
- `responsesStyle` (responses only): `"instructions+messages"` (default) or `"all_messages"`
- `responsesStyle`（仅 responses）：`"instructions+messages"`（默认）或 `"all_messages"`
- `responsesContentFormat` (responses only): `"text"` (default) or `"openai_array"`
- `responsesContentFormat`（仅 responses）：`"text"`（默认）或 `"openai_array"`
- `extraHeaders`: optional extra HTTP headers
- `extraHeaders`：可选的额外 HTTP 请求头

## Telegram notes (groups)
## Telegram 群聊说明

In groups, the bot replies to known commands, explicit `@botusername` mentions, or replies to the bot (to avoid spam).
为避免刷屏，群里默认只响应：已知命令、`@bot用户名` 提及、回复 bot 的消息。

If you enable per-group auto-reply (`/autoreply on`), it replies to normal text too.
开启群自动回复：`/autoreply on`（仅对该群生效），之后会对普通文本消息也回复。

If Group Privacy was changed in BotFather, re-add the bot to the group for changes to take effect.
若在 BotFather 修改了 Group Privacy，请将 bot 退出并重新加入群聊后再测试。

## Open source
## 开源

- License: `LICENSE`
- 许可证：`LICENSE`
- Security: `SECURITY.md`
- 安全漏洞报告：`SECURITY.md`
- Contributing: `CONTRIBUTING.md`
- 贡献指南：`CONTRIBUTING.md`

## Telegram commands
## Telegram 命令

- `/help` show help
- `/api` list providers
- `/api <id>` switch provider for this chat
- `/prompt` list prompt presets
- `/prompt <id>` switch prompt preset for this chat
- `/persona` list personas
- `/persona <id>` switch persona (per-user in groups)
- `/rules` show global rules
- `/status` show current settings
- `/chatid` show chat_id/user_id (useful for whitelisting groups)
- `/reset` clear conversation history for this chat
- `/autoreply on|off` toggle group auto-reply (per group)
- `/memory on|off` toggle conversation memory for this chat
- `/remember <text>` add a long-term memory “fact” for this chat
- `/forget` clear long-term memory facts for this chat
- `/forget all` clear facts + history
- `/wipe` clear facts + history
- `/menu` clickable menu (inline buttons)
- `/search <q>` web search (if enabled)
- `/img <q>` image search (if enabled; sends photos)

## Group memory isolation

In private chats, memory is keyed by `chatId`. In groups/supergroups, memory is keyed by `chatId:userId` (each user has their own memory in the same group).
私聊中，记忆按 `chatId` 隔离；群/超级群中，记忆按 `chatId:userId` 隔离（同一群里每个用户各自独立）。
