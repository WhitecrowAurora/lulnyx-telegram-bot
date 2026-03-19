import { normalizeBaseUrl } from "./util.js";

export function createTelegramApi({ token, logger }) {
  const baseUrl = normalizeBaseUrl(`https://api.telegram.org/bot${token}`);

  async function call(method, params) {
    const url = `${baseUrl}/${method}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params ?? {})
    });
    let json = null;
    try {
      json = await res.json();
    } catch {}

    if (!res.ok || !json?.ok) {
      const err = new Error(`Telegram API error: ${method} status=${res.status}`);
      err.details = json;
      throw err;
    }
    return json.result;
  }

  return {
    getUpdates: (params) => call("getUpdates", params),
    getMe: () => call("getMe", {}),
    getWebhookInfo: () => call("getWebhookInfo", {}),
    setWebhook: (params) => call("setWebhook", params),
    deleteWebhook: (params) => call("deleteWebhook", params ?? {}),
    sendMessage: (params) => call("sendMessage", params),
    sendPhoto: (params) => call("sendPhoto", params),
    sendChatAction: (params) => call("sendChatAction", params),
    editMessageText: (params) => call("editMessageText", params),
    answerCallbackQuery: (params) => call("answerCallbackQuery", params),
    setMyCommands: (params) => call("setMyCommands", params).catch((e) => logger.warn("setMyCommands failed", e)),
    setChatMenuButton: (params) => call("setChatMenuButton", params).catch((e) => logger.warn("setChatMenuButton failed", e))
  };
}
