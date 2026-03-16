import { normalizeBotLang } from "../botI18n.js";
import { parseCommand, handleCommand } from "./commands.js";
import { handleChat } from "./chatFlow.js";
import { handleCallbackQueryInternal } from "./callbacks.js";

export async function handleIncomingText({ logger, configStore, stateStore, chatId, userId, chatType, languageCode, sender, text }) {
  const lang = normalizeBotLang(languageCode);
  const parsed = parseCommand(text);
  if (parsed) {
    return await handleCommand({ logger, configStore, stateStore, chatId, userId, chatType, lang, ...parsed });
  }
  return await handleChat({ logger, configStore, stateStore, chatId, userId, chatType, lang, sender, text });
}

export async function handleCallbackQuery({ logger, configStore, stateStore, chatId, userId, chatType, messageId, data, languageCode }) {
  const lang = normalizeBotLang(languageCode);
  return await handleCallbackQueryInternal({ logger, configStore, stateStore, chatId, userId, chatType, messageId, data, lang });
}

