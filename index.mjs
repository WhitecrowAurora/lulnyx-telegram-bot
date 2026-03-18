import { createWebServer } from "./src/web.js";
import { createConfigStore } from "./src/configStore.js";
import { createStateStore } from "./src/stateStore.js";
import { createLogger } from "./src/logger.js";
import { startLongTermJobs } from "./src/longTermJobs.js";
import { logHardeningWarnings } from "./src/hardening.js";
import { createTelegramController } from "./src/telegramController.js";
import { createPluginManager } from "./src/plugins/manager.js";

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

  // Plugins (optional). Exposed to chat flow via configStore.pluginManager.
  configStore.pluginManager = createPluginManager({ logger, configStore });
  await configStore.pluginManager.scan({ force: true }).catch(() => {});
  const telegram = createTelegramController({ logger, configStore, stateStore });
  const server = createWebServer({ logger, configStore, stateStore, telegram });
  server.listen(config.server.port, config.server.host, () => {
    logger.info(`web listening on http://${config.server.host}:${config.server.port}/`);
  });

  telegram.start();

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
