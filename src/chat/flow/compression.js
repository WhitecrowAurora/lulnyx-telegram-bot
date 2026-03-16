import { generateAssistantReply } from "../../openai.js";
import { localDayString, trimToMaxChars } from "../../util.js";
import { countCharsForRequest, estimateTokensForRequest, clampInt } from "./usage.js";

export function pickSummaryProvider({ cfg, fallback }) {
  const providers = Array.isArray(cfg?.providers) ? cfg.providers : [];
  const id = String(cfg?.longTerm?.summaryProviderId || "").trim();
  if (id) return providers.find((p) => p.id === id) || fallback;
  return fallback;
}

export async function maybeCompressHistory({ logger, cfg, stateStore, chatId, userId, chatType, provider, conv, maxCharsPerMessage }) {
  const triggerTokens = clampInt(Number(cfg.longTerm?.compression?.triggerTokens ?? 200000), 10_000, 500_000);
  const chunkMessages = clampInt(Number(cfg.longTerm?.compression?.chunkMessages ?? 40), 10, 200);
  const minIntervalMs = 5 * 60_000;
  const last = Number(conv?.summaryUpdatedAt || 0);
  if (last && Date.now() - last < minIntervalMs) return false;

  const history = Array.isArray(conv?.history) ? conv.history : [];
  if (history.length < chunkMessages + 10) return false;

  let chars = String(conv?.summaryText || "").length;
  for (const m of history) chars += String(m?.content || "").length;
  const approxTokens = Math.ceil(chars / 4);
  if (approxTokens < triggerTokens) return false;

  const chunk = history.slice(0, chunkMessages);
  const transcript = chunk
    .map((m) => `${String(m?.role || "unknown")}: ${String(m?.content || "").trim()}`)
    .filter((x) => x.length > 0)
    .join("\n");
  if (!transcript) return false;

  const systemPrompt = [
    "You summarize chat history chunks for long-context compression.",
    "Return a concise, information-dense summary in plain text.",
    "Focus on stable facts, preferences, open tasks, and key decisions.",
    "Do not include sensitive information unless it is necessary for future context."
  ].join("\n");

  const out = await generateAssistantReply({
    logger,
    provider,
    systemPrompt,
    messages: [{ role: "user", content: trimToMaxChars(transcript, 60_000) }],
    temperature: 0.2,
    topP: 1,
    presencePenalty: 0,
    frequencyPenalty: 0,
    maxOutputTokens: Math.max(512, Math.min(2048, Number(cfg.openai?.maxOutputTokens ?? 1024))),
    timeoutMs: Math.max(10_000, Number(cfg.openai?.timeoutMs ?? 60_000)),
    retry: cfg.openai?.retry,
    maxCharsPerMessage
  });

  const summary = String(out?.text || "").trim();
  if (!summary) return false;

  const day = localDayString();
  const stamp = `${day} ${new Date().toTimeString().slice(0, 8)}`;
  stateStore.updateConversation({ chatId, userId, chatType }, (c) => {
    const prev = String(c.summaryText || "").trim();
    const next = prev ? `${prev}\n\n[${stamp}]\n${summary}` : `[${stamp}]\n${summary}`;
    // Keep summary bounded.
    c.summaryText = next.length > 40_000 ? next.slice(next.length - 40_000) : next;
    c.summaryUpdatedAt = Date.now();
    c.history = Array.isArray(c.history) ? c.history.slice(chunkMessages) : [];
  });

  // Account usage as a background request (no user-visible reply).
  const estIn = estimateTokensForRequest({ systemPrompt, messages: [{ role: "user", content: transcript }], maxCharsPerMessage });
  const estOut = Math.max(1, Math.ceil(summary.length / 4));
  const charsIn = countCharsForRequest({ systemPrompt, messages: [{ role: "user", content: transcript }], maxCharsPerMessage });
  const charsOut = summary.length;
  const tokensIn = Number(out?.usage?.inputTokens ?? estIn) || estIn;
  const tokensOut = Number(out?.usage?.outputTokens ?? estOut) || estOut;
  stateStore.addUsageDay?.({ day, scope: "chat", id: String(chatId), charsIn, charsOut, tokensIn, tokensOut, replies: 0, requests: 1 });
  stateStore.addUsageDay?.({ day, scope: "user", id: String(userId), charsIn, charsOut, tokensIn, tokensOut, replies: 0, requests: 1 });

  return true;
}

