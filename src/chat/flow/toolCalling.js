import { generateAssistantReply } from "../../openai.js";
import { searxngImageSearch, searxngSearch } from "../../search.js";
import { clamp } from "../../util.js";
import {
  buildToolCallingSystemPrompt,
  formatToolCallBlock,
  formatToolResultBlock,
  normalizeToolCall,
  parseToolCallFromAssistantText
} from "../../toolCalling.js";
import { addUsage } from "./usage.js";

export async function generateWithTools({ logger, cfg, provider, systemPrompt, messages, maxCharsPerMessage }) {
  const maxTurns = clamp(Number(cfg.search.toolCallingMaxTurns ?? 2), 1, 4);
  const enabledTools = ["web_search", "image_search"];
  const toolSystem = buildToolCallingSystemPrompt({ enabledTools });
  const sys = `${systemPrompt}\n\n${toolSystem}`.trim();

  let currentMessages = messages.slice();
  let usageAgg = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let requests = 0;

  for (let turn = 0; turn < maxTurns; turn++) {
    const out = await generateAssistantReply({
      logger,
      provider,
      security: cfg.security,
      systemPrompt: sys,
      messages: currentMessages,
      temperature: cfg.openai.temperature,
      topP: cfg.openai.topP,
      presencePenalty: cfg.openai.presencePenalty,
      frequencyPenalty: cfg.openai.frequencyPenalty,
      maxOutputTokens: cfg.openai.maxOutputTokens,
      timeoutMs: cfg.openai.timeoutMs,
      retry: cfg.openai.retry,
      maxCharsPerMessage
    });
    requests += 1;
    if (out?.usage) usageAgg = addUsage(usageAgg, out.usage);

    const rawCall = parseToolCallFromAssistantText(out.text);
    if (!rawCall) return { text: out.text, usage: usageAgg, requests };

    const toolCall = normalizeToolCall(rawCall);
    if (!toolCall) return { text: "tool call rejected (invalid format)", usage: usageAgg, requests };

    if (toolCall.tool !== "web_search" && toolCall.tool !== "image_search") {
      return { text: "tool call rejected (unknown tool)", usage: usageAgg, requests };
    }

    const query = toolCall.query.slice(0, 256);
    const maxResults = clamp(Number.isFinite(toolCall.maxResults) ? toolCall.maxResults : cfg.search.maxResults, 1, 10);

    let resultText = "";
    try {
      if (toolCall.tool === "image_search") {
        const imgs = await searxngImageSearch({
          baseUrl: cfg.search.baseUrl,
          query,
          language: cfg.search.language,
          safeSearch: cfg.search.safeSearch,
          maxResults,
          timeoutMs: cfg.search.timeoutMs,
          security: cfg.security,
          allowPrivateNetwork: cfg.search.allowPrivateNetwork,
          logger
        });
        resultText = formatImageResults(imgs);
      } else {
        const results = await searxngSearch({
          baseUrl: cfg.search.baseUrl,
          query,
          language: cfg.search.language,
          safeSearch: cfg.search.safeSearch,
          categories: cfg.search.categories || "",
          maxResults,
          timeoutMs: cfg.search.timeoutMs,
          security: cfg.security,
          allowPrivateNetwork: cfg.search.allowPrivateNetwork,
          logger
        });
        resultText = formatWebResults(results);
      }
    } catch (err) {
      logger?.warn?.("tool execution failed", err);
      resultText = `ERROR: ${err?.message || "tool_failed"}`;
    }

    currentMessages = currentMessages.concat([
      { role: "assistant", content: formatToolCallBlock({ tool: toolCall.tool, query, maxResults }) },
      { role: "user", content: formatToolResultBlock(resultText) }
    ]);
  }

  return { text: "tool calling exceeded max turns", usage: usageAgg, requests };
}

function formatWebResults(results) {
  const items = Array.isArray(results) ? results : [];
  const lines = [];
  for (const r of items) {
    const title = String(r?.title || "").trim();
    const url = String(r?.url || "").trim();
    const content = String(r?.content || "").trim();
    const engine = String(r?.engine || "").trim();
    const head = [title, url].filter(Boolean).join(" - ");
    if (!head) continue;
    lines.push(`- ${head}${engine ? ` (${engine})` : ""}`);
    if (content) lines.push(`  ${content.slice(0, 400)}`);
  }
  return lines.join("\n").trim();
}

function formatImageResults(results) {
  const items = Array.isArray(results) ? results : [];
  const lines = [];
  for (const r of items) {
    const url = String(r?.url || "").trim();
    const title = String(r?.title || "").trim();
    const engine = String(r?.engine || "").trim();
    if (!url) continue;
    lines.push(`- ${url}${title ? ` (${title})` : ""}${engine ? ` (${engine})` : ""}`);
  }
  return lines.join("\n").trim();
}
