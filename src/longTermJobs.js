import { generateAssistantReply } from "./openai.js";
import { localDayString, sleep, trimToMaxChars } from "./util.js";

export function startLongTermJobs({ logger, configStore, stateStore }) {
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    const cfg = configStore.get();
    if (!cfg.app?.setupCompleted) return;
    if (!cfg.longTerm?.enabled) return;
    if (!cfg.longTerm.dailySummary?.enabled) return;
    if (!cfg.longTerm.memoryEnabled && !cfg.longTerm.personaEnabled) return;
    if (String(cfg.stateStorage?.type || "") !== "sqlite") return;

    const now = new Date();
    const targetMinutes = parseTimeToMinutes(String(cfg.longTerm.dailySummary.time || "03:00"));
    if (targetMinutes === null) return;
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    if (minutesNow < targetMinutes) return;

    const day = localDayString(now.getTime());
    const last = stateStore.getMeta?.("longterm_daily_last_day");
    if (String(last || "") === day) return;

    await runDailySummaries({ logger, configStore, stateStore, day });
    stateStore.setMeta?.("longterm_daily_last_day", day);
  };

  const timer = setInterval(() => {
    void tick().catch((err) => logger?.warn?.("longTerm tick failed", err));
  }, 60_000);
  timer.unref?.();

  // Best-effort: also run once shortly after startup (if already past scheduled time).
  setTimeout(() => void tick().catch(() => {}), 5_000).unref?.();

  return {
    stop() {
      stopped = true;
      try {
        clearInterval(timer);
      } catch {}
    }
  };
}

async function runDailySummaries({ logger, configStore, stateStore, day }) {
  const cfg = configStore.get();
  const provider = pickSummaryProvider(cfg);
  if (!provider) return;

  const metas = stateStore.listConversationMetas ? stateStore.listConversationMetas() : [];
  if (!Array.isArray(metas) || metas.length === 0) return;

  const startMs = startOfLocalDayMs(day);
  if (!Number.isFinite(startMs)) return;

  const candidates = metas
    .filter((m) => Number(m?.updatedAt || 0) >= startMs)
    .map((m) => String(m.key || ""))
    .filter(Boolean);

  let processed = 0;
  for (const key of candidates.slice(0, 200)) {
    if (stoppedFromMeta(stateStore)) break;
    const conv = stateStore.getConversationByKey ? stateStore.getConversationByKey(key) : null;
    if (!conv) continue;
    const history = Array.isArray(conv.history) ? conv.history : [];
    const today = history.filter((m) => Number(m?.ts || 0) >= startMs);
    if (today.length === 0 && !String(conv.summaryText || "").trim()) continue;

    const transcript = buildTranscript({ conv, today });
    const prompt = buildDailySummaryPrompt({ transcript, wantMemory: cfg.longTerm.memoryEnabled, wantPersona: cfg.longTerm.personaEnabled });

    try {
      const out = await generateAssistantReply({
        logger,
        provider,
        security: cfg.security,
        systemPrompt: prompt.system,
        messages: [{ role: "user", content: trimToMaxChars(prompt.user, 80_000) }],
        temperature: 0.2,
        topP: 1,
        presencePenalty: 0,
        frequencyPenalty: 0,
        maxOutputTokens: Math.max(512, Math.min(2048, Number(cfg.openai?.maxOutputTokens ?? 1024))),
        timeoutMs: Math.max(10_000, Number(cfg.openai?.timeoutMs ?? 60_000)),
        retry: cfg.openai?.retry,
        maxCharsPerMessage: 20_000
      });

      const parsed = safeParseJson(out.text);
      const memoryText = String(parsed?.memory || "").trim() || (cfg.longTerm.memoryEnabled ? out.text.trim() : "");
      const personaText = String(parsed?.persona || "").trim();
      stateStore.upsertDailySummary?.({ day, convKey: key, memoryText, personaText });

      const charsIn = String(prompt.system || "").length + String(prompt.user || "").length;
      const charsOut = String(out.text || "").length;
      const estIn = Math.max(1, Math.ceil(charsIn / 4));
      const estOut = Math.max(1, Math.ceil(charsOut / 4));
      const tokensIn = Number(out?.usage?.inputTokens ?? estIn) || estIn;
      const tokensOut = Number(out?.usage?.outputTokens ?? estOut) || estOut;
      const ids = parseConvKeyIds(key);
      if (ids.chatId) stateStore.addUsageDay?.({ day, scope: "chat", id: ids.chatId, charsIn, charsOut, tokensIn, tokensOut, replies: 0, requests: 1 });
      if (ids.userId) stateStore.addUsageDay?.({ day, scope: "user", id: ids.userId, charsIn, charsOut, tokensIn, tokensOut, replies: 0, requests: 1 });
      processed += 1;
    } catch (err) {
      logger?.warn?.("daily summary failed", { day, convKey: key, message: err?.message });
      await sleep(250);
    }
  }
  logger?.info?.("daily summaries finished", { day, processed });
}

function pickSummaryProvider(cfg) {
  const id = String(cfg.longTerm?.summaryProviderId || cfg.defaultProviderId || "").trim();
  const providers = Array.isArray(cfg.providers) ? cfg.providers : [];
  return providers.find((p) => p.id === id) || providers[0] || null;
}

function buildTranscript({ conv, today }) {
  const parts = [];
  const summary = String(conv?.summaryText || "").trim();
  if (summary) parts.push(`(compressed)\n${summary}\n`);
  for (const m of Array.isArray(today) ? today : []) {
    const role = String(m?.role || "").trim() || "unknown";
    const content = String(m?.content || "").trim();
    if (!content) continue;
    parts.push(`${role}: ${content}`);
  }
  return parts.join("\n");
}

function buildDailySummaryPrompt({ transcript, wantMemory, wantPersona }) {
  const system = [
    "You are an assistant that writes daily archives for a chat bot.",
    "Output MUST be valid JSON and nothing else.",
    "",
    "Fields:",
    `- memory: ${wantMemory ? "required" : "optional"} (concise bullet list, stable facts, preferences, decisions; avoid secrets).`,
    `- persona: ${wantPersona ? "required" : "optional"} (how the assistant should behave next time: tone, style, do/don't).`,
    "",
    "Keep it short and useful."
  ].join("\n");
  const user = [
    "Summarize this day's conversation transcript.",
    "",
    transcript || "(empty)"
  ].join("\n");
  return { system, user };
}

function safeParseJson(text) {
  const s = String(text || "").trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function parseTimeToMinutes(hhmm) {
  const s = String(hhmm || "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function startOfLocalDayMs(day) {
  const s = String(day || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return NaN;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return NaN;
  return new Date(y, mo - 1, d, 0, 0, 0, 0).getTime();
}

function stoppedFromMeta(stateStore) {
  // Placeholder for future stop switch.
  return false;
}

function parseConvKeyIds(convKey) {
  const s = String(convKey || "");
  if (!s) return { chatId: "", userId: "" };
  const idx = s.indexOf(":");
  if (idx < 0) return { chatId: s, userId: "" };
  return { chatId: s.slice(0, idx), userId: s.slice(idx + 1) };
}
