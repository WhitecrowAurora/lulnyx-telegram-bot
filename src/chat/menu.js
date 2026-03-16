import { bt } from "../botI18n.js";

export function parseCallbackData(data) {
  const s = String(data || "");
  const [type, rest] = s.split(":", 2);
  if (!type || rest === undefined) return null;
  if (type === "menu") return { type: "menu", value: rest };
  if (type === "do") return { type: "do", value: rest };
  if (type === "set") {
    const parts = rest.split(":");
    if (parts.length < 2) return null;
    return { type: "set", key: parts[0], value: parts.slice(1).join(":") };
  }
  return null;
}

export function menuText({ configStore, stateStore, chatId, userId, chatType, screen, lang }) {
  const t = (key, vars) => bt(lang, key, vars);
  const cfg = configStore.get();
  const chatSettings = stateStore.getChatSettings(chatId);
  const conv = stateStore.getConversation({ chatId, userId, chatType });
  const providerId = chatSettings.providerId || cfg.defaultProviderId || "";
  const promptId = conv?.promptId || cfg.defaultPromptId || "";
  const personaId = conv?.personaId || cfg.defaultPersonaId || "";
  const memEnabled = conv?.memoryEnabled ?? cfg.memory.enabledByDefault;
  const memText = memEnabled ? t("menu.mem_on") : t("menu.mem_off");

  if (screen === "api") {
    const providers = Array.isArray(cfg.providers) ? cfg.providers : [];
    if (providers.length === 0) return t("providers.none");
    return t("menu.select_provider", { id: providerId });
  }
  if (screen === "prompt") {
    const prompts = Array.isArray(cfg.prompts) ? cfg.prompts : [];
    if (prompts.length === 0) return t("prompts.none");
    return t("menu.select_prompt", { id: promptId });
  }
  if (screen === "persona") {
    const personas = Array.isArray(cfg.personas) ? cfg.personas : [];
    if (personas.length === 0) return t("personas.none");
    return t("menu.select_persona", { id: personaId });
  }
  return t("menu.root", { provider: providerId, prompt: promptId, persona: personaId, memory: memText });
}

export function menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen, lang }) {
  const t = (key, vars) => bt(lang, key, vars);
  const cfg = configStore.get();
  const chatSettings = stateStore.getChatSettings(chatId);
  const conv = stateStore.getConversation({ chatId, userId, chatType }) || {};
  const providerId = chatSettings.providerId || cfg.defaultProviderId || "";
  const promptId = conv.promptId || cfg.defaultPromptId || "";
  const personaId = conv.personaId || cfg.defaultPersonaId || "";
  const memEnabled = conv.memoryEnabled ?? cfg.memory.enabledByDefault;

  if (screen === "api") {
    const providers = Array.isArray(cfg.providers) ? cfg.providers : [];
    return {
      inline_keyboard: [
        ...providers.map((p) => [
          {
            text: `${p.id === providerId ? "[*] " : ""}${p.name || p.id}`,
            callback_data: `set:api:${p.id}`
          }
        ]),
        [{ text: t("menu.back"), callback_data: "menu:root" }]
      ]
    };
  }

  if (screen === "prompt") {
    const prompts = Array.isArray(cfg.prompts) ? cfg.prompts : [];
    return {
      inline_keyboard: [
        ...prompts.map((p) => [
          { text: `${p.id === promptId ? "[*] " : ""}${p.name || p.id}`, callback_data: `set:prompt:${p.id}` }
        ]),
        [{ text: t("menu.back"), callback_data: "menu:root" }]
      ]
    };
  }

  if (screen === "persona") {
    const personas = Array.isArray(cfg.personas) ? cfg.personas : [];
    return {
      inline_keyboard: [
        ...personas.map((p) => [
          { text: `${p.id === personaId ? "[*] " : ""}${p.name || p.id}`, callback_data: `set:persona:${p.id}` }
        ]),
        [{ text: t("menu.back"), callback_data: "menu:root" }]
      ]
    };
  }

  return {
    inline_keyboard: [
      [
        { text: t("menu.btn.provider"), callback_data: "menu:api" },
        { text: t("menu.btn.prompt"), callback_data: "menu:prompt" },
        { text: t("menu.btn.persona"), callback_data: "menu:persona" }
      ],
      [
        {
          text: t("menu.btn.memory", { state: memEnabled ? t("menu.mem_on") : t("menu.mem_off") }),
          callback_data: `set:memory:${memEnabled ? "off" : "on"}`
        },
        { text: t("menu.btn.reset"), callback_data: "do:reset" }
      ]
    ]
  };
}
