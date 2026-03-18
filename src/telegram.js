export { createTelegramRuntime } from "./telegramRuntime.js";

// Backward-compatible entrypoint (polling mode).
export async function startTelegramPolling({ logger, configStore, stateStore }) {
  const { createTelegramRuntime } = await import("./telegramRuntime.js");
  const rt = await createTelegramRuntime({ logger, configStore, stateStore });
  return await rt.startPolling();
}

