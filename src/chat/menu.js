import { bt } from "../botI18n.js";
import { getActiveUserPrompt, normalizeUserDisplayNameMode, normalizeUserPromptSlot } from "../state/common.js";

function promptSlotLabel(t, slot) {
  const value = normalizeUserPromptSlot(slot);
  if (value === "slot1") return t("profile.user_prompt_slot1");
  if (value === "slot2") return t("profile.user_prompt_slot2");
  return t("profile.user_prompt_off");
}

function nameModeLabel(t, mode) {
  return t(`profile.name_mode_${normalizeUserDisplayNameMode(mode)}`);
}

function currentNameValueLabel(t, profile) {
  const mode = normalizeUserDisplayNameMode(profile?.displayNameMode);
  if (mode === "custom") {
    return String(profile?.customDisplayName || "").trim() || t("profile.custom_name_empty");
  }
  const username = String(profile?.username || "").trim().replace(/^@+/, "");
  return username ? `@${username}` : t("profile.custom_name_empty");
}

export function parseCallbackData(data) {
  const s = String(data || "");
  const first = s.indexOf(":");
  if (first <= 0) return null;
  const type = s.slice(0, first);
  const rest = s.slice(first + 1);
  if (!type || !rest) return null;
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
  const userProfile = stateStore.getUserProfile?.(userId) || null;
  const providerId = chatSettings.providerId || cfg.defaultProviderId || "";
  const promptId = conv?.promptId || cfg.defaultPromptId || "";
  const personaId = conv?.personaId || cfg.defaultPersonaId || "";
  const memEnabled = conv?.memoryEnabled ?? cfg.memory.enabledByDefault;
  const memText = memEnabled ? t("menu.mem_on") : t("menu.mem_off");
  const userPromptText = promptSlotLabel(t, getActiveUserPrompt(userProfile).slot);
  const nameModeText = nameModeLabel(t, userProfile?.displayNameMode);
  const currentNameText = currentNameValueLabel(t, userProfile);

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
  if (screen === "userprompt") {
    return t("menu.select_user_prompt", { slot: userPromptText });
  }
  if (screen === "name") {
    return t("menu.select_name_mode", { mode: nameModeText, name: currentNameText });
  }
  return t("menu.root", {
    provider: providerId,
    prompt: promptId,
    persona: personaId,
    memory: memText,
    userPrompt: userPromptText,
    nameMode: nameModeText
  });
}

export function menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen, lang }) {
  const t = (key, vars) => bt(lang, key, vars);
  const cfg = configStore.get();
  const chatSettings = stateStore.getChatSettings(chatId);
  const conv = stateStore.getConversation({ chatId, userId, chatType }) || {};
  const userProfile = stateStore.getUserProfile?.(userId) || null;
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

  if (screen === "userprompt") {
    const active = normalizeUserPromptSlot(userProfile?.activePromptSlot);
    const has1 = Boolean(String(userProfile?.customPrompt1 || "").trim());
    const has2 = Boolean(String(userProfile?.customPrompt2 || "").trim());
    return {
      inline_keyboard: [
        [
          {
            text: `${active === "" ? "[*] " : ""}${t("profile.user_prompt_off")}`,
            callback_data: "set:userprompt:off"
          }
        ],
        [
          {
            text: `${active === "slot1" ? "[*] " : ""}${t("profile.user_prompt_slot1")}${has1 ? "" : " (" + t("menu.empty") + ")"}`,
            callback_data: "set:userprompt:slot1"
          }
        ],
        [
          {
            text: `${active === "slot2" ? "[*] " : ""}${t("profile.user_prompt_slot2")}${has2 ? "" : " (" + t("menu.empty") + ")"}`,
            callback_data: "set:userprompt:slot2"
          }
        ],
        [{ text: t("menu.back"), callback_data: "menu:root" }]
      ]
    };
  }

  if (screen === "name") {
    const mode = normalizeUserDisplayNameMode(userProfile?.displayNameMode);
    const hasCustom = Boolean(String(userProfile?.customDisplayName || "").trim());
    return {
      inline_keyboard: [
        [
          {
            text: `${mode === "username" ? "[*] " : ""}${t("profile.name_mode_username")}`,
            callback_data: "set:namemode:username"
          }
        ],
        [
          {
            text: `${mode === "custom" ? "[*] " : ""}${t("profile.name_mode_custom")}${hasCustom ? "" : " (" + t("menu.empty") + ")"}`,
            callback_data: "set:namemode:custom"
          }
        ],
        [{ text: t("menu.btn.name_help"), callback_data: "do:namehelp" }],
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
        { text: t("menu.btn.name_mode", { mode: nameModeLabel(t, userProfile?.displayNameMode), value: currentNameValueLabel(t, userProfile) }), callback_data: "menu:name" },
        { text: t("menu.btn.user_prompt", { slot: promptSlotLabel(t, userProfile?.activePromptSlot) }), callback_data: "menu:userprompt" },
        { text: t("menu.btn.reset"), callback_data: "do:reset" }
      ],
      [
        {
          text: t("menu.btn.memory", { state: memEnabled ? t("menu.mem_on") : t("menu.mem_off") }),
          callback_data: `set:memory:${memEnabled ? "off" : "on"}`
        }
      ]
    ]
  };
}
