import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveAppRootDir } from "../appPaths.js";

export function createPluginManager({ logger, configStore }) {
  const state = {
    scannedAt: 0,
    dirPath: "",
    discovered: [],
    loadedById: new Map(),
    lastError: ""
  };

  const getConfig = () => configStore.get();

  const scan = async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && now - state.scannedAt < 10_000) return state.discovered;
    state.scannedAt = now;
    state.lastError = "";

    const cfg = getConfig();
    const rel = String(cfg.plugins?.dir || "plugins");
    const root = resolveAppRootDir();
    const dirPath = path.isAbsolute(rel) ? rel : path.join(root, rel);
    state.dirPath = dirPath;

    let entries = [];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      state.discovered = [];
      return state.discovered;
    }

    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((n) => n.endsWith(".mjs") || n.endsWith(".js"))
      .sort();

    const enabledIds = new Set(
      Array.isArray(cfg.plugins?.enabledIds) ? cfg.plugins.enabledIds.map((x) => String(x || "").trim()).filter(Boolean) : []
    );

    const discovered = [];
    for (const name of files) {
      const full = path.join(dirPath, name);
      const mod = await importMaybe(full).catch((err) => {
        logger?.warn?.("plugin import failed", { file: full, message: err?.message });
        return null;
      });
      const plug = normalizePlugin(mod);
      if (!plug) continue;
      discovered.push({
        id: plug.id,
        name: plug.name,
        version: plug.version,
        description: plug.description,
        file: name,
        enabled: enabledIds.has(plug.id)
      });
      if (enabledIds.has(plug.id)) state.loadedById.set(plug.id, plug);
      else state.loadedById.delete(plug.id);
    }
    state.discovered = discovered;
    // Remove loaded plugins no longer discovered
    for (const id of Array.from(state.loadedById.keys())) {
      if (!discovered.some((d) => d.id === id && d.enabled)) state.loadedById.delete(id);
    }
    return discovered;
  };

  const getDiscovered = () => state.discovered.slice();

  const getEnabled = () => Array.from(state.loadedById.values());

  const applyBeforeModel = async ({ systemPrompt, messages, ctx }) => {
    const enabled = getEnabled();
    let sys = String(systemPrompt || "");
    let msgs = Array.isArray(messages) ? messages.slice() : [];

    for (const p of enabled) {
      const fn = p?.hooks?.beforeModel;
      if (typeof fn !== "function") continue;
      try {
        const out = await fn({ systemPrompt: sys, messages: msgs, ctx });
        if (out && typeof out === "object") {
          if (typeof out.systemPrompt === "string") sys = out.systemPrompt;
          if (Array.isArray(out.messages)) msgs = out.messages;
        }
      } catch (err) {
        logger?.warn?.("plugin beforeModel failed", { pluginId: p.id, message: err?.message });
      }
    }
    return { systemPrompt: sys, messages: msgs };
  };

  const applyAfterModel = async ({ replyText, ctx }) => {
    const enabled = getEnabled();
    let text = String(replyText || "");
    for (const p of enabled) {
      const fn = p?.hooks?.afterModel;
      if (typeof fn !== "function") continue;
      try {
        const out = await fn({ replyText: text, ctx });
        if (typeof out === "string") text = out;
        else if (out && typeof out === "object" && typeof out.replyText === "string") text = out.replyText;
      } catch (err) {
        logger?.warn?.("plugin afterModel failed", { pluginId: p.id, message: err?.message });
      }
    }
    return text;
  };

  return { scan, getDiscovered, getEnabled, applyBeforeModel, applyAfterModel, _state: state };
}

async function importMaybe(filePath) {
  const url = pathToFileURL(filePath).href;
  // Cache-bust so newly edited plugins are picked up after rescan.
  return await import(`${url}?t=${Date.now()}`);
}

function normalizePlugin(mod) {
  if (!mod) return null;
  const plug = mod.default ?? mod.plugin ?? null;
  if (!plug || typeof plug !== "object") return null;
  const id = String(plug.id || "").trim();
  if (!id) return null;
  return {
    id,
    name: String(plug.name || id),
    version: String(plug.version || ""),
    description: String(plug.description || ""),
    hooks: plug.hooks && typeof plug.hooks === "object" ? plug.hooks : {}
  };
}

