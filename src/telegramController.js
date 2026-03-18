import { createTelegramRuntime } from "./telegramRuntime.js";

export function createTelegramController({ logger, configStore, stateStore }) {
  let runtime = null;
  let pollingPromise = null;
  let pollingRunning = false;
  let lastConfigSig = "";

  const status = {
    mode: "polling",
    polling: { running: false },
    webhook: { configured: false, url: "" },
    lastStartAt: 0,
    lastErrorAt: 0,
    lastError: ""
  };

  const cfgSignature = (cfg) => {
    const token = String(cfg.telegram?.token || "");
    const mode = String(cfg.telegram?.delivery?.mode || "polling");
    const pub = String(cfg.telegram?.delivery?.publicBaseUrl || "");
    const secret = String(cfg.telegram?.delivery?.webhookSecret || "");
    return [token, mode, pub, secret].join("|");
  };

  const ensureRuntime = async () => {
    const cfg = configStore.get();
    const token = String(cfg.telegram?.token || "").trim();
    if (!token) return null;
    if (runtime) return runtime;
    runtime = await createTelegramRuntime({ logger, configStore, stateStore });
    return runtime;
  };

  const stopPolling = () => {
    if (!runtime) return;
    try {
      runtime.stop();
    } catch {}
    pollingRunning = false;
    status.polling.running = false;
  };

  const startPolling = async () => {
    const rt = await ensureRuntime();
    if (!rt) return;
    if (pollingRunning) return;
    pollingRunning = true;
    status.polling.running = true;
    status.mode = "polling";
    status.lastStartAt = Date.now();
    pollingPromise = rt
      .startPolling()
      .catch((err) => {
        pollingRunning = false;
        status.polling.running = false;
        status.lastErrorAt = Date.now();
        status.lastError = String(err?.message || err || "");
        logger?.error?.("telegram polling crashed", err);
      })
      .finally(() => {
        pollingRunning = false;
        status.polling.running = false;
      });
  };

  const ensureWebhook = async () => {
    const rt = await ensureRuntime();
    if (!rt) return;
    status.mode = "webhook";
    status.lastStartAt = Date.now();
    const out = await rt.ensureWebhook();
    status.webhook.configured = true;
    status.webhook.url = String(out?.url || "");
    return out;
  };

  const deleteWebhook = async () => {
    const rt = await ensureRuntime();
    if (!rt) return;
    await rt.deleteWebhook({ dropPendingUpdates: false }).catch(() => {});
    status.webhook.configured = false;
    status.webhook.url = "";
  };

  const applyConfig = async () => {
    const cfg = configStore.get();
    if (!cfg.app?.setupCompleted) return;

    const sig = cfgSignature(cfg);
    if (sig === lastConfigSig && (pollingRunning || status.mode === "webhook")) return;
    lastConfigSig = sig;

    const token = String(cfg.telegram?.token || "").trim();
    if (!token) return;

    const mode = cfg.telegram?.delivery?.mode === "webhook" ? "webhook" : "polling";
    status.mode = mode;

    try {
      if (mode === "polling") {
        await deleteWebhook().catch(() => {});
        await startPolling();
      } else {
        stopPolling();
        await ensureWebhook();
      }
    } catch (err) {
      status.lastErrorAt = Date.now();
      status.lastError = String(err?.message || err || "");
      logger?.warn?.("telegram mode setup failed", err);
    }
  };

  const handleWebhookUpdate = async ({ secret, update, reqIp }) => {
    const cfg = configStore.get();
    if (!cfg.app?.setupCompleted) return { ok: false, error: "setup_required" };
    const token = String(cfg.telegram?.token || "").trim();
    if (!token) return { ok: false, error: "telegram_not_configured" };
    if (cfg.telegram?.delivery?.mode !== "webhook") return { ok: false, error: "webhook_disabled" };

    const want = String(cfg.telegram?.delivery?.webhookSecret || "").trim();
    if (!want || String(secret || "") !== want) return { ok: false, error: "invalid_secret" };

    const rt = await ensureRuntime();
    if (!rt) return { ok: false, error: "telegram_not_ready" };
    void rt
      .handleUpdate(update, { source: "webhook" })
      .catch((err) => logger?.warn?.("webhook update failed", { reqIp, message: err?.message }));
    return { ok: true };
  };

  return {
    start() {
      void applyConfig();
      configStore.subscribe(() => void applyConfig());
    },
    handleWebhookUpdate,
    getStatus() {
      const rt = runtime;
      return {
        ...status,
        runtime: rt?.status ? { ...rt.status } : null
      };
    },
    // For tests/maintenance
    _unsafe: {
      applyConfig,
      ensureWebhook,
      startPolling,
      stopPolling,
      deleteWebhook
    }
  };
}

