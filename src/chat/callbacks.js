import { bt } from "../botI18n.js";
import { clearConversationHistory } from "./commands.js";
import { menuMarkup, menuText, parseCallbackData } from "./menu.js";

export async function handleCallbackQueryInternal({ logger, configStore, stateStore, chatId, userId, chatType, messageId, data, lang }) {
  const t = (key, vars) => bt(lang, key, vars);
  const parsed = parseCallbackData(data);
  if (!parsed) return { text: t("err.invalid_action"), mode: "send" };

  if (parsed.type === "menu") {
    const screen = parsed.value;
    return {
      text: menuText({ configStore, stateStore, chatId, userId, chatType, screen, lang }),
      mode: "edit",
      replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen, lang })
    };
  }

  if (parsed.type === "set") {
    const { key, value } = parsed;
    const cfg = configStore.get();
    const conv = stateStore.getConversation({ chatId, userId, chatType });
    if (!conv) return { text: t("err.no_conversation"), mode: "send" };

    if (key === "api") {
      const exists = cfg.providers.some((p) => p.id === value);
      if (exists) stateStore.updateChatSettings(chatId, (c) => (c.providerId = value));
      return {
        text: exists ? t("cb.provider_set", { id: value }) : t("cb.unknown_provider", { id: value }),
        mode: "edit",
        replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "root", lang })
      };
    }

    if (key === "prompt") {
      const exists = cfg.prompts.some((p) => p.id === value);
      if (exists) stateStore.updateConversation({ chatId, userId, chatType }, (c) => (c.promptId = value));
      return {
        text: exists ? t("cb.prompt_set", { id: value }) : t("cb.unknown_prompt", { id: value }),
        mode: "edit",
        replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "root", lang })
      };
    }

    if (key === "persona") {
      const exists = cfg.personas.some((p) => p.id === value);
      if (exists) stateStore.updateConversation({ chatId, userId, chatType }, (c) => (c.personaId = value));
      return {
        text: exists ? t("cb.persona_set", { id: value }) : t("cb.unknown_persona", { id: value }),
        mode: "edit",
        replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "root", lang })
      };
    }

    if (key === "memory") {
      const mode = value === "on" ? "on" : value === "off" ? "off" : "";
      if (!mode) return { text: t("cb.memory_invalid"), mode: "send" };
      stateStore.updateConversation({ chatId, userId, chatType }, (c) => (c.memoryEnabled = mode === "on"));
      return {
        text: t("cb.memory", { mode: mode === "on" ? t("memory.on") : t("memory.off") }),
        mode: "edit",
        replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "root", lang })
      };
    }
  }

  if (parsed.type === "do") {
    if (parsed.value === "reset") {
      clearConversationHistory({ stateStore, chatId, userId, chatType });
      return {
        text: t("cb.cleared"),
        mode: "edit",
        replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "root", lang })
      };
    }
  }

  return { text: t("err.unknown_action"), mode: "send" };
}

