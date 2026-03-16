export function estimateTokensForRequest({ systemPrompt, messages, maxCharsPerMessage }) {
  let chars = 0;
  chars += String(systemPrompt || "").slice(0, maxCharsPerMessage).length;
  for (const m of Array.isArray(messages) ? messages : []) {
    chars += String(m?.role || "").length;
    chars += String(m?.content || "").slice(0, maxCharsPerMessage).length;
  }
  // Rough heuristic; good enough for quota pre-checks.
  return Math.max(1, Math.ceil(chars / 4));
}

export function countCharsForRequest({ systemPrompt, messages, maxCharsPerMessage }) {
  let charsIn = 0;
  charsIn += String(systemPrompt || "").slice(0, maxCharsPerMessage).length;
  for (const m of Array.isArray(messages) ? messages : []) {
    charsIn += String(m?.content || "").slice(0, maxCharsPerMessage).length;
  }
  return charsIn;
}

export function addUsage(a, b) {
  const aa = a && typeof a === "object" ? a : { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const bb = b && typeof b === "object" ? b : { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const inputTokens = Number(aa.inputTokens || 0) + Number(bb.inputTokens || 0);
  const outputTokens = Number(aa.outputTokens || 0) + Number(bb.outputTokens || 0);
  const totalTokens = Number(aa.totalTokens || 0) + Number(bb.totalTokens || 0) || Number(inputTokens || 0) + Number(outputTokens || 0);
  return { inputTokens, outputTokens, totalTokens };
}

export function clampInt(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

