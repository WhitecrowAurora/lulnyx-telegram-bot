import { startTelegramPolling } from "./src/telegram.js";
import { createWebServer } from "./src/web.js";
import { createConfigStore } from "./src/configStore.js";
import { createStateStore } from "./src/stateStore.js";
import { createLogger } from "./src/logger.js";
import { startLongTermJobs } from "./src/longTermJobs.js";
import { logHardeningWarnings } from "./src/hardening.js";

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.stack || err);
  process.exitCode = 1;
});

async function main() {
  const logger = createLogger();
  const configStore = await createConfigStore({ logger });
  const stateStore = await createStateStore({ logger, configStore });

  const config = configStore.get();
  logHardeningWarnings({ logger, config });
  const server = createWebServer({ logger, configStore, stateStore });
  server.listen(config.server.port, config.server.host, () => {
    logger.info(`web listening on http://${config.server.host}:${config.server.port}/`);
  });

  let telegramStarted = false;
  const maybeStartTelegram = () => {
    if (telegramStarted) return;
    const cfgNow = configStore.get();
    const token = String(cfgNow.telegram?.token || "").trim();
    if (!cfgNow.app?.setupCompleted) return;
    if (!token) return;
    telegramStarted = true;
    logger.info("starting telegram polling...");
    startTelegramPolling({ logger, configStore, stateStore }).catch((err) => {
      telegramStarted = false;
      logger.error("telegram polling crashed", err);
      process.exitCode = 1;
    });
  };

  maybeStartTelegram();
  configStore.subscribe(() => maybeStartTelegram());

  // Background tasks (nightly summaries, etc.)
  const jobs = startLongTermJobs({ logger, configStore, stateStore });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
      logger.info(`received ${signal}, shutting down...`);
      try {
        server.close();
      } catch {}
      try {
        jobs?.stop?.();
      } catch {}
      try {
        await stateStore.flush();
      } catch {}
      process.exit(0);
    });
  }
}
