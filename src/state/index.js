import { createJsonStateStore } from "./jsonStore.js";
import { createSqliteStateStore } from "./sqliteStore.js";

export async function createStateStore({ logger, configStore }) {
  const cfg = configStore.get();
  const type = cfg.stateStorage?.type === "sqlite" ? "sqlite" : "json";
  if (type === "sqlite") return await createSqliteStateStore({ logger, configStore });
  return createJsonStateStore({ logger, configStore });
}

