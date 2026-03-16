import { localDayString } from "../../util.js";
import { clampInt } from "./usage.js";

export async function buildLongTermAdditions({ cfg, stateStore, convKey }) {
  const out = { longTermMemory: "", longTermPersona: "" };
  if (!cfg?.longTerm?.enabled) return out;
  const needsSqlite = Boolean(cfg.longTerm.memoryEnabled || cfg.longTerm.personaEnabled);
  if (needsSqlite && String(cfg.stateStorage?.type || "") !== "sqlite") return out;

  const limit = clampInt(Number(cfg.longTerm.daysToInclude ?? 7), 1, 30);
  const today = localDayString();
  const items = stateStore.listDailySummariesByConv ? stateStore.listDailySummariesByConv({ convKey, limit }) : [];
  const past = Array.isArray(items) ? items.filter((x) => String(x?.day || "") && String(x.day) !== today) : [];

  if (cfg.longTerm.memoryEnabled) {
    const blocks = [];
    for (const r of past) {
      const mem = String(r?.memoryText || "").trim();
      if (!mem) continue;
      blocks.push(`[${String(r.day)}]\n${mem}`);
    }
    out.longTermMemory = blocks.join("\n\n");
  }

  if (cfg.longTerm.personaEnabled) {
    const manual = String(stateStore.getBotDoc?.("persona_manual")?.value || "").trim();
    const latestAuto = past.find((r) => String(r?.personaText || "").trim());
    const parts = [];
    if (manual) parts.push(`(manual)\n${manual}`);
    if (latestAuto) parts.push(`(auto ${String(latestAuto.day)})\n${String(latestAuto.personaText || "").trim()}`);
    out.longTermPersona = parts.join("\n\n");
  }

  return out;
}

