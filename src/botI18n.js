const STRINGS = {
  en: {
    // Telegram command descriptions
    "cmd.help.desc": "Show help",
    "cmd.api.desc": "List/switch API provider",
    "cmd.prompt.desc": "List/switch prompt preset",
    "cmd.persona.desc": "List/switch persona",
    "cmd.rules.desc": "Show rules",
    "cmd.status.desc": "Show current settings",
    "cmd.chatid.desc": "Show chat/user id",
    "cmd.search.desc": "Web search (if enabled)",
    "cmd.img.desc": "Image search (if enabled)",
    "cmd.reset.desc": "Clear conversation history",
    "cmd.memory.desc": "Toggle conversation memory",
    "cmd.remember.desc": "Add a memory fact",
    "cmd.forget.desc": "Clear memory facts",
    "cmd.menu.desc": "Clickable menu",
    "cmd.wipe.desc": "Clear facts + history",
    "cmd.reload.desc": "Reload config.json from disk",
    "cmd.autoreply.desc": "Toggle group auto-reply",

    // Command replies / UI
    "err.invalid_action": "Invalid action.",
    "err.unknown_action": "Unknown action.",
    "err.unknown_command": "Unknown command: /{command}",
    "err.no_conversation": "No conversation.",
    "err.conversation_na": "Conversation not available.",
    "err.no_providers": "No providers configured (config.providers).",
    "err.no_prompts": "No prompts configured (config.prompts).",

    "ok.reloaded": "Reloaded config.json",
    "ok.conversation_cleared": "Conversation cleared",
    "ok.saved": "Saved",
    "ok.cleared_facts": "Cleared facts",
    "ok.cleared_facts_history": "Cleared facts + history",

    "usage.search": "Usage: /search <query>",
    "usage.img": "Usage: /img <query>",
    "usage.memory": "Usage: /memory on|off",
    "usage.remember": "Usage: /remember <text>",
    "usage.autoreply": "Usage: /autoreply on|off",

    "search.disabled": "Search is disabled (config.search.enabled=false)",
    "search.unsupported": "Unsupported search.type (only searxng)",
    "search.no_results": "No results",
    "search.results": "Results:",
    "search.error": "Search error: {message}",
    "img.no_results": "No image results",
    "img.error": "Image search error: {message}",

    "quota.chat_replies": "Quota exceeded: chat replies/day",
    "quota.user_replies": "Quota exceeded: user replies/day",
    "quota.chat_tokens": "Quota exceeded: chat tokens/day",
    "quota.user_tokens": "Quota exceeded: user tokens/day",

    "rules.none": "No rules configured",
    "rules.title": "Rules:",

    "providers.none": "No providers configured",
    "providers.title": "Providers:",
    "providers.use": "Use: /api <id>",
    "providers.unknown": "Unknown provider id: {id}",
    "providers.set": "Provider set to: {id}",

    "prompts.none": "No prompts configured",
    "prompts.title": "Prompts:",
    "prompts.use": "Use: /prompt <id>",
    "prompts.unknown": "Unknown prompt id: {id}",
    "prompts.set": "Prompt set to: {id}",

    "personas.none": "No personas configured",
    "personas.title": "Personas:",
    "personas.use": "Use: /persona <id>",
    "personas.unknown": "Unknown persona id: {id}",
    "personas.set": "Persona set to: {id}",

    "status.title": "Status:",
    "status.provider": "provider",
    "status.prompt": "prompt",
    "status.persona": "persona",
    "status.memory": "memory",
    "status.facts": "facts",
    "status.history": "history",

    "memory.on": "on",
    "memory.off": "off",

    "autoreply.on": "auto-reply: on",
    "autoreply.off": "auto-reply: off",

    "help.title": "Commands:",
    "help.api_list": "/api - list providers",
    "help.api_set": "/api <id> - set provider for this chat",
    "help.prompt_list": "/prompt - list prompts",
    "help.prompt_set": "/prompt <id> - set prompt for this chat",
    "help.persona_list": "/persona - list personas",
    "help.persona_set": "/persona <id> - set persona",
    "help.search": "/search <q> - web search (if enabled)",
    "help.img": "/img <q> - image search (if enabled)",
    "help.reset": "/reset - clear conversation",
    "help.memory": "/memory on|off - toggle conversation memory",
    "help.remember": "/remember <text> - add a memory fact",
    "help.forget": "/forget - clear memory facts",
    "help.forget_all": "/forget all - clear facts + history",
    "help.wipe": "/wipe - clear facts + history",
    "help.menu": "/menu - clickable menu",
    "help.reload": "/reload - reload config.json from disk",
    "help.autoreply": "/autoreply on|off - toggle group auto-reply",
    "help.rules": "/rules - show rules",
    "help.status": "/status - show current settings",
    "help.chatid": "/chatid - show chat/user id",

    "menu.select_provider": "Select provider (current: {id})",
    "menu.select_prompt": "Select prompt (current: {id})",
    "menu.select_persona": "Select persona (current: {id})",
    "menu.root": "Menu\nprovider: {provider}\nprompt: {prompt}\npersona: {persona}\nmemory: {memory}",
    "menu.back": "← Back",
    "menu.btn.provider": "Provider",
    "menu.btn.prompt": "Prompt",
    "menu.btn.persona": "Persona",
    "menu.btn.reset": "Reset",
    "menu.btn.memory": "Memory: {state}",
    "menu.mem_on": "ON",
    "menu.mem_off": "OFF",

    "cb.provider_set": "Provider set: {id}",
    "cb.prompt_set": "Prompt set: {id}",
    "cb.persona_set": "Persona set: {id}",
    "cb.unknown_provider": "Unknown provider: {id}",
    "cb.unknown_prompt": "Unknown prompt: {id}",
    "cb.unknown_persona": "Unknown persona: {id}",
    "cb.memory": "Memory: {mode}",
    "cb.memory_invalid": "Invalid memory mode",
    "cb.cleared": "Conversation cleared",

    "auth.not_allowed": "This chat is not approved.\nAsk the admin to allow chat_id: {chatId}\n(user_id: {userId})."
  },
  zh: {
    // Telegram command descriptions
    "cmd.help.desc": "显示帮助",
    "cmd.api.desc": "列出/切换提供方",
    "cmd.prompt.desc": "列出/切换提示词",
    "cmd.persona.desc": "列出/切换人格",
    "cmd.rules.desc": "查看规则",
    "cmd.status.desc": "查看当前状态",
    "cmd.chatid.desc": "查看 chat/user id",
    "cmd.search.desc": "联网搜索（如已启用）",
    "cmd.img.desc": "图片搜索（如已启用）",
    "cmd.reset.desc": "清空历史消息",
    "cmd.memory.desc": "切换记忆开关",
    "cmd.remember.desc": "添加一条记忆",
    "cmd.forget.desc": "清空记忆",
    "cmd.menu.desc": "打开菜单",
    "cmd.wipe.desc": "清空记忆+历史",
    "cmd.reload.desc": "重新加载 config.json",
    "cmd.autoreply.desc": "切换群自动回复",

    // Command replies / UI
    "err.invalid_action": "无效操作。",
    "err.unknown_action": "未知操作。",
    "err.unknown_command": "未知命令：/{command}",
    "err.no_conversation": "没有会话。",
    "err.conversation_na": "当前会话不可用。",
    "err.no_providers": "未配置提供方（config.providers）。",
    "err.no_prompts": "未配置提示词（config.prompts）。",

    "ok.reloaded": "已重新加载 config.json",
    "ok.conversation_cleared": "已清空对话历史",
    "ok.saved": "已保存",
    "ok.cleared_facts": "已清空记忆",
    "ok.cleared_facts_history": "已清空记忆和历史",

    "usage.search": "用法：/search <关键词>",
    "usage.img": "用法：/img <关键词>",
    "usage.memory": "用法：/memory on|off",
    "usage.remember": "用法：/remember <内容>",
    "usage.autoreply": "用法：/autoreply on|off",

    "search.disabled": "搜索功能已关闭（config.search.enabled=false）",
    "search.unsupported": "不支持的 search.type（仅支持 searxng）",
    "search.no_results": "没有结果",
    "search.results": "搜索结果：",
    "search.error": "搜索错误：{message}",
    "img.no_results": "没有图片结果",
    "img.error": "图片搜索错误：{message}",

    "quota.chat_replies": "已达到每日聊天回复上限",
    "quota.user_replies": "已达到每日用户回复上限",
    "quota.chat_tokens": "已达到每日聊天 tokens 上限",
    "quota.user_tokens": "已达到每日用户 tokens 上限",

    "rules.none": "未配置规则",
    "rules.title": "规则：",

    "providers.none": "未配置提供方",
    "providers.title": "提供方：",
    "providers.use": "用法：/api <id>",
    "providers.unknown": "未知提供方 id：{id}",
    "providers.set": "已切换提供方：{id}",

    "prompts.none": "未配置提示词",
    "prompts.title": "提示词：",
    "prompts.use": "用法：/prompt <id>",
    "prompts.unknown": "未知提示词 id：{id}",
    "prompts.set": "已切换提示词：{id}",

    "personas.none": "未配置人格",
    "personas.title": "人格：",
    "personas.use": "用法：/persona <id>",
    "personas.unknown": "未知人格 id：{id}",
    "personas.set": "已切换人格：{id}",

    "status.title": "状态：",
    "status.provider": "提供方",
    "status.prompt": "提示词",
    "status.persona": "人格",
    "status.memory": "记忆",
    "status.facts": "记忆条数",
    "status.history": "历史条数",

    "memory.on": "开",
    "memory.off": "关",

    "autoreply.on": "群自动回复：开",
    "autoreply.off": "群自动回复：关",

    "help.title": "命令：",
    "help.api_list": "/api - 列出提供方",
    "help.api_set": "/api <id> - 切换本聊天提供方",
    "help.prompt_list": "/prompt - 列出提示词",
    "help.prompt_set": "/prompt <id> - 切换本聊天提示词",
    "help.persona_list": "/persona - 列出人格",
    "help.persona_set": "/persona <id> - 切换人格",
    "help.search": "/search <q> - 联网搜索（如已启用）",
    "help.img": "/img <q> - 图片搜索（如已启用）",
    "help.reset": "/reset - 清空历史消息",
    "help.memory": "/memory on|off - 切换记忆开关",
    "help.remember": "/remember <text> - 添加一条记忆",
    "help.forget": "/forget - 清空记忆",
    "help.forget_all": "/forget all - 清空记忆+历史",
    "help.wipe": "/wipe - 清空记忆+历史",
    "help.menu": "/menu - 打开菜单",
    "help.reload": "/reload - 重新加载 config.json",
    "help.autoreply": "/autoreply on|off - 切换群自动回复",
    "help.rules": "/rules - 查看规则",
    "help.status": "/status - 查看当前状态",
    "help.chatid": "/chatid - 查看 chat/user id",

    "menu.select_provider": "请选择提供方（当前：{id}）",
    "menu.select_prompt": "请选择提示词（当前：{id}）",
    "menu.select_persona": "请选择人格（当前：{id}）",
    "menu.root": "菜单\n提供方：{provider}\n提示词：{prompt}\n人格：{persona}\n记忆：{memory}",
    "menu.back": "← 返回",
    "menu.btn.provider": "提供方",
    "menu.btn.prompt": "提示词",
    "menu.btn.persona": "人格",
    "menu.btn.reset": "清空历史",
    "menu.btn.memory": "记忆：{state}",
    "menu.mem_on": "开",
    "menu.mem_off": "关",

    "cb.provider_set": "已切换提供方：{id}",
    "cb.prompt_set": "已切换提示词：{id}",
    "cb.persona_set": "已切换人格：{id}",
    "cb.unknown_provider": "未知提供方：{id}",
    "cb.unknown_prompt": "未知提示词：{id}",
    "cb.unknown_persona": "未知人格：{id}",
    "cb.memory": "记忆：{mode}",
    "cb.memory_invalid": "记忆模式无效",
    "cb.cleared": "已清空历史",

    "auth.not_allowed": "此聊天尚未授权。\n请联系管理员允许 chat_id：{chatId}\n（user_id：{userId}）。"
  }
};

export function normalizeBotLang(languageCodeOrLang) {
  const s = String(languageCodeOrLang || "").toLowerCase();
  if (s === "zh" || s.startsWith("zh")) return "zh";
  return "en";
}

export function bt(lang, key, vars = {}) {
  const l = normalizeBotLang(lang);
  const dict = STRINGS[l] || STRINGS.en;
  let out = dict[key] ?? STRINGS.en[key] ?? String(key || "");
  for (const [k, v] of Object.entries(vars || {})) {
    out = out.replaceAll(`{${k}}`, String(v ?? ""));
  }
  return out;
}

export function getTelegramCommands(lang) {
  const t = (k) => bt(lang, k);
  return [
    { command: "help", description: t("cmd.help.desc") },
    { command: "api", description: t("cmd.api.desc") },
    { command: "prompt", description: t("cmd.prompt.desc") },
    { command: "persona", description: t("cmd.persona.desc") },
    { command: "rules", description: t("cmd.rules.desc") },
    { command: "status", description: t("cmd.status.desc") },
    { command: "chatid", description: t("cmd.chatid.desc") },
    { command: "search", description: t("cmd.search.desc") },
    { command: "img", description: t("cmd.img.desc") },
    { command: "reset", description: t("cmd.reset.desc") },
    { command: "memory", description: t("cmd.memory.desc") },
    { command: "remember", description: t("cmd.remember.desc") },
    { command: "forget", description: t("cmd.forget.desc") },
    { command: "autoreply", description: t("cmd.autoreply.desc") },
    { command: "menu", description: t("cmd.menu.desc") },
    { command: "wipe", description: t("cmd.wipe.desc") },
    { command: "reload", description: t("cmd.reload.desc") }
  ];
}
