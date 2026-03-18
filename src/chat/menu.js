import { bt } from "../botI18n.js";
import { getActiveUserPersona, getActiveUserPrompt, normalizeUserDisplayNameMode, normalizeUserPromptSlot } from "../state/common.js";

function promptSlotLabel(t, slot) {
  const value = normalizeUserPromptSlot(slot);
  if (value === "slot1") return t("profile.user_prompt_slot1");
  if (value === "slot2") return t("profile.user_prompt_slot2");
  return t("profile.user_prompt_off");
}

function userPromptStateLabel(t, profile) {
  const active = getActiveUserPrompt(profile);
  if (active.slot) return t("menu.user_prompt_override");
  const has1 = Boolean(String(profile?.customPrompt1 || "").trim());
  const has2 = Boolean(String(profile?.customPrompt2 || "").trim());
  return has1 || has2 ? t("menu.user_prompt_off_saved") : t("profile.user_prompt_off");
}

function userPromptSummaryLabel(t, profile) {
  const active = getActiveUserPrompt(profile);
  if (active.slot) return t("menu.user_prompt_override_with_slot", { slot: promptSlotLabel(t, active.slot) });
  return userPromptStateLabel(t, profile);
}

function buildUserPromptMenuText({ t, profile }) {
  const active = getActiveUserPrompt(profile);
  const has1 = Boolean(String(profile?.customPrompt1 || "").trim());
  const has2 = Boolean(String(profile?.customPrompt2 || "").trim());
  return [
    t("menu.user_prompt_title"),
    `${t("menu.user_prompt_state")}: ${userPromptStateLabel(t, profile)}`,
    `${t("menu.user_prompt_active_slot")}: ${active.slot ? promptSlotLabel(t, active.slot) : t("profile.user_prompt_off")}`,
    `${t("menu.default_prompt_state")}: ${active.slot ? t("menu.state_overridden") : t("menu.state_active")}`,
    `${t("menu.user_prompt_slots")}: ${t("menu.user_prompt_slots_value", { slot1: has1 ? t("menu.state_saved") : t("menu.empty"), slot2: has2 ? t("menu.state_saved") : t("menu.empty") })}`
  ].join("\n");
}

function promptPresetSummaryLabel(t, promptId, profile) {
  const active = getActiveUserPrompt(profile);
  if (!active.slot) return promptId;
  return t("menu.default_prompt_overridden_with_id", {
    id: String(promptId || ""),
    slot: promptSlotLabel(t, active.slot)
  });
}

function nameModeLabel(t, mode) {
  return t(`profile.name_mode_${normalizeUserDisplayNameMode(mode)}`);
}

function previewText(value, maxLen) {
  const text = String(value || "").trim();
  const limit = Math.max(12, Math.trunc(Number(maxLen) || 0));
  if (!text || text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function userPersonaCharCount(profile) {
  return String(profile?.customPersona || "").trim().length;
}

function userPersonaStateLabel(t, profile) {
  if (getActiveUserPersona(profile).enabled) return t("menu.user_persona_on");
  return String(profile?.customPersona || "").trim() ? t("menu.user_persona_off_saved") : t("menu.user_persona_off");
}

function userPersonaSummaryLabel(t, profile) {
  const count = userPersonaCharCount(profile);
  const state = getActiveUserPersona(profile).enabled ? t("menu.user_persona_override") : userPersonaStateLabel(t, profile);
  if (!count) return state;
  return t("menu.user_persona_state_with_len", { state, count: String(count) });
}

function buildUserPersonaMenuText({ t, profile }) {
  const count = userPersonaCharCount(profile);
  const preview = previewText(profile?.customPersona, 180) || t("menu.user_persona_preview_empty");
  return [
    t("menu.user_persona_title"),
    `${t("menu.user_persona_state")}: ${userPersonaStateLabel(t, profile)}`,
    `${t("menu.default_persona_state")}: ${getActiveUserPersona(profile).enabled ? t("menu.state_overridden") : t("menu.state_active")}`,
    `${t("menu.user_persona_length")}: ${t("menu.user_persona_chars", { count: String(count) })}`,
    `${t("menu.user_persona_preview")}: ${preview}`,
    "",
    t("menu.user_persona_edit_hint")
  ].join("\n");
}

function personaPresetSummaryLabel(t, personaId, profile) {
  if (!getActiveUserPersona(profile).enabled) return personaId;
  return t("menu.default_persona_overridden_with_id", { id: String(personaId || "") });
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
  const userPromptText = userPromptSummaryLabel(t, userProfile);
  const userPersonaText = userPersonaSummaryLabel(t, userProfile);
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
    return t("menu.select_prompt", { id: promptPresetSummaryLabel(t, promptId, userProfile) });
  }
  if (screen === "persona") {
    const personas = Array.isArray(cfg.personas) ? cfg.personas : [];
    if (personas.length === 0) return t("personas.none");
    return t("menu.select_persona", { id: personaPresetSummaryLabel(t, personaId, userProfile) });
  }
  if (screen === "userprompt") {
    return buildUserPromptMenuText({ t, profile: userProfile });
  }
  if (screen === "userpersona") {
    return buildUserPersonaMenuText({ t, profile: userProfile });
  }
  if (screen === "name") {
    return t("menu.select_name_mode", { mode: nameModeText, name: currentNameText });
  }
  return t("menu.root", {
    provider: providerId,
    prompt: promptPresetSummaryLabel(t, promptId, userProfile),
    persona: personaPresetSummaryLabel(t, personaId, userProfile),
    memory: memText,
    userPrompt: userPromptText,
    userPersona: userPersonaText,
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
        ...(has1 ? [[{ text: t("menu.btn.user_prompt_clear_slot1"), callback_data: "do:userpromptclear:slot1" }]] : []),
        ...(has2 ? [[{ text: t("menu.btn.user_prompt_clear_slot2"), callback_data: "do:userpromptclear:slot2" }]] : []),
        [{ text: t("menu.back"), callback_data: "menu:root" }]
      ]
    };
  }

  if (screen === "userpersona") {
    const enabled = getActiveUserPersona(userProfile).enabled;
    const hasPersona = Boolean(String(userProfile?.customPersona || "").trim());
    return {
      inline_keyboard: [
        [
          {
            text: `${enabled ? "[*] " : ""}${t("menu.user_persona_on")}${hasPersona ? "" : " (" + t("menu.empty") + ")"}`,
            callback_data: "set:userpersona:on"
          }
        ],
        [
          {
            text: `${!enabled ? "[*] " : ""}${t("menu.user_persona_off")}`,
            callback_data: "set:userpersona:off"
          }
        ],
        ...(hasPersona ? [[{ text: t("menu.btn.user_persona_clear"), callback_data: "do:userpersonaclear" }]] : []),
        [{ text: t("menu.btn.user_persona_help"), callback_data: "do:userpersonahelp" }],
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
        { text: t("menu.btn.user_prompt", { slot: userPromptSummaryLabel(t, userProfile) }), callback_data: "menu:userprompt" },
        { text: t("menu.btn.user_persona", { state: userPersonaSummaryLabel(t, userProfile) }), callback_data: "menu:userpersona" }
      ],
      [
        { text: t("menu.btn.reset"), callback_data: "do:reset" },
        {
          text: t("menu.btn.memory", { state: memEnabled ? t("menu.mem_on") : t("menu.mem_off") }),
          callback_data: `set:memory:${memEnabled ? "off" : "on"}`
        }
      ]
    ]
  };
}
