import { normalizeBaseUrl, sleep, trimToMaxChars } from "./util.js";
import { assertOutboundUrlAllowed } from "./security/outbound.js";

export async function generateAssistantReply({
  logger,
  provider,
  security,
  systemPrompt,
  messages,
  temperature,
  topP,
  presencePenalty,
  frequencyPenalty,
  maxOutputTokens,
  timeoutMs,
  retry,
  maxCharsPerMessage
}) {
  if (!provider?.baseUrl) throw new Error("provider.baseUrl is required");
  if (!provider?.model) throw new Error("provider.model is required");

  const baseUrl = normalizeBaseUrl(provider.baseUrl);
  await assertOutboundUrlAllowed({
    url: baseUrl,
    security,
    allowPrivateNetwork: provider.allowPrivateNetwork === true,
    kind: "provider",
    logger
  });
  const headers = {
    "content-type": "application/json",
    ...normalizeHeaders(provider.extraHeaders)
  };
  if (provider.apiKey) headers.authorization = `Bearer ${provider.apiKey}`;

  const tms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000;
  const retryCfg = retry && typeof retry === "object" ? retry : {};
  const retryEnabled = retryCfg.enabled === true;
  const maxRetries = retryEnabled ? Math.max(0, Math.trunc(Number(retryCfg.maxRetries ?? 0))) : 0;
  const baseDelayMs = Math.max(0, Math.trunc(Number(retryCfg.baseDelayMs ?? 300)));
  const maxDelayMs = Math.max(0, Math.trunc(Number(retryCfg.maxDelayMs ?? 3000)));
  const retryOnTimeout = retryCfg.retryOnTimeout !== false;
  const retryOn429 = retryCfg.retryOn429 !== false;
  const retryOn5xx = retryCfg.retryOn5xx !== false;

  const shouldRetry = (err) => {
    const status = Number(err?.status ?? err?.cause?.status ?? NaN);
    if (err?.code === "TIMEOUT" || err?.name === "AbortError") return retryOnTimeout;
    if (status === 429) return retryOn429;
    if (Number.isFinite(status) && status >= 500 && status <= 599) return retryOn5xx;
    // Network errors (fetch failures) are often TypeError; allow retry if enabled at all.
    if (err && err.name === "TypeError" && String(err.message || "").toLowerCase().includes("fetch")) return true;
    return false;
  };

  const attemptOnce = async () => {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), tms);
    try {
      if (provider.apiType === "chat_completions") {
        const url = `${baseUrl}/v1/chat/completions`;
        const body = {
          model: provider.model,
          stream: false,
          temperature,
          ...(Number.isFinite(topP) ? { top_p: topP } : {}),
          ...(Number.isFinite(presencePenalty) ? { presence_penalty: presencePenalty } : {}),
          ...(Number.isFinite(frequencyPenalty) ? { frequency_penalty: frequencyPenalty } : {}),
          max_tokens: maxOutputTokens,
          messages: [
            { role: "system", content: trimToMaxChars(systemPrompt, maxCharsPerMessage) },
            ...messages.map((m) => ({
              role: m.role,
              content: trimToMaxChars(m.content, maxCharsPerMessage)
            }))
          ]
        };

        const json = await postJson({ url, headers, body, signal: controller.signal });
        const { text, usage } = extractChatCompletions(json);
        return { text, usage };
      }

      const url = `${baseUrl}/v1/responses`;
      const style = String(provider.responsesStyle || "instructions+messages");
      const contentFormat = String(provider.responsesContentFormat || "text");

      const inputMessages = messages.map((m) => ({
        role: m.role,
        content:
          contentFormat === "openai_array"
            ? [{ type: "input_text", text: trimToMaxChars(m.content, maxCharsPerMessage) }]
            : trimToMaxChars(m.content, maxCharsPerMessage)
      }));

      const body =
        style === "all_messages"
          ? {
              model: provider.model,
              temperature,
              ...(Number.isFinite(topP) ? { top_p: topP } : {}),
              max_output_tokens: maxOutputTokens,
              input: [
                {
                  role: "system",
                  content:
                    contentFormat === "openai_array"
                      ? [{ type: "input_text", text: trimToMaxChars(systemPrompt, maxCharsPerMessage) }]
                      : trimToMaxChars(systemPrompt, maxCharsPerMessage)
                },
                ...inputMessages
              ]
            }
          : {
              model: provider.model,
              temperature,
              ...(Number.isFinite(topP) ? { top_p: topP } : {}),
              max_output_tokens: maxOutputTokens,
              instructions: trimToMaxChars(systemPrompt, maxCharsPerMessage),
              input: inputMessages
            };

      const json = await postJson({ url, headers, body, signal: controller.signal });
      const { text, usage } = extractResponses(json);
      return { text, usage };
    } catch (err) {
      if (err?.name === "AbortError") {
        const e = new Error(`Request timeout after ${tms}ms`, { cause: err });
        e.code = "TIMEOUT";
        logger?.warn?.("OpenAI-compatible request timed out", { providerId: provider?.id, timeoutMs: tms });
        throw e;
      }
      logger?.warn?.("OpenAI-compatible request failed", { providerId: provider?.id, message: err?.message, status: err?.status });
      throw err;
    } finally {
      clearTimeout(to);
    }
  };

  let attempt = 0;
  // attempt: 0 .. maxRetries (total maxRetries+1 attempts)
  while (true) {
    try {
      return await attemptOnce();
    } catch (err) {
      if (attempt >= maxRetries || !shouldRetry(err)) throw err;
      const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
      const jitter = Math.trunc(Math.random() * 100);
      const delayMs = Math.max(0, exp + jitter);
      logger?.warn?.("retrying OpenAI-compatible request", {
        providerId: provider?.id,
        attempt: attempt + 1,
        maxRetries,
        delayMs,
        code: err?.code,
        status: err?.status
      });
      if (delayMs > 0) await sleep(delayMs);
      attempt += 1;
    }
  }
}

function normalizeHeaders(h) {
  if (!h || typeof h !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(h)) {
    if (!k) continue;
    out[String(k).toLowerCase()] = String(v);
  }
  return out;
}

async function postJson({ url, headers, body, signal }) {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} from ${url}`);
    err.status = res.status;
    err.body = json ?? text;
    throw err;
  }
  return json ?? {};
}

function extractChatCompletions(json) {
  const text = json?.choices?.[0]?.message?.content;
  const usage = normalizeUsage(json?.usage, "chat_completions");
  if (typeof text === "string" && text.trim()) return { text: text.trim(), usage };
  const alt = json?.choices?.[0]?.delta?.content;
  if (typeof alt === "string" && alt.trim()) return { text: alt.trim(), usage };
  throw new Error("No text in /v1/chat/completions response");
}

function extractResponses(json) {
  const usage = normalizeUsage(json?.usage, "responses");
  if (typeof json?.output_text === "string" && json.output_text.trim()) return { text: json.output_text.trim(), usage };
  if (Array.isArray(json?.output)) {
    const parts = [];
    for (const item of json.output) {
      const content = item?.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        if (typeof c?.text === "string") parts.push(c.text);
        if (typeof c?.content === "string") parts.push(c.content);
      }
    }
    const joined = parts.join("").trim();
    if (joined) return { text: joined, usage };
  }
  const msg = json?.output?.[0]?.content?.[0]?.text;
  if (typeof msg === "string" && msg.trim()) return { text: msg.trim(), usage };
  throw new Error("No text in /v1/responses response");
}

function normalizeUsage(usage, apiType) {
  const u = usage && typeof usage === "object" ? usage : null;
  if (!u) return null;
  if (apiType === "chat_completions") {
    const inputTokens = Number(u.prompt_tokens ?? u.input_tokens ?? 0);
    const outputTokens = Number(u.completion_tokens ?? u.output_tokens ?? 0);
    const totalTokens = Number(u.total_tokens ?? (inputTokens + outputTokens) ?? 0);
    if (!Number.isFinite(inputTokens) && !Number.isFinite(outputTokens) && !Number.isFinite(totalTokens)) return null;
    return {
      inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
      outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
      totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0
    };
  }
  const inputTokens = Number(u.input_tokens ?? u.prompt_tokens ?? 0);
  const outputTokens = Number(u.output_tokens ?? u.completion_tokens ?? 0);
  const totalTokens = Number(u.total_tokens ?? (inputTokens + outputTokens) ?? 0);
  if (!Number.isFinite(inputTokens) && !Number.isFinite(outputTokens) && !Number.isFinite(totalTokens)) return null;
  return {
    inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0
  };
}
