export function renderClientMain() {
  return `
async function onViewEnter(name) {
  if (name === "tools-analytics") await loadStats();
  if (name === "tools-daily") await loadDailyDays();
  if (name === "tools-plugins") await loadPlugins();
  if (name === "tools-users") await loadUsers();
  if (name === "settings-longterm") await loadManualPersona();
  if (name === "settings-basics") await loadTelegramStatus();
}

$("btnSave").addEventListener("click", saveConfig);
$("btnReload").addEventListener("click", reloadConfig);
$("btnLogout").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" }).catch(() => {});
  location.href = "/login";
});
$("btnChats").addEventListener("click", loadChats);
$("chatFilter").addEventListener("input", renderChats);
$("btnUsers").addEventListener("click", loadUsers);
$("userFilter").addEventListener("input", renderUsers);
$("btnConvRefresh").addEventListener("click", refreshConvList);
$("convFilter").addEventListener("input", renderConvList);
$("btnConvSave").addEventListener("click", saveConversation);
$("btnConvDelete").addEventListener("click", deleteConversation);
$("btnSearch").addEventListener("click", doSearch);
$("btnStatsRefresh").addEventListener("click", loadStats);
$("btnDailyRefresh").addEventListener("click", loadDailyDays);
$("btnPluginsRefresh").addEventListener("click", loadPlugins);
$("btnPersonaLoad").addEventListener("click", loadManualPersona);
$("btnPersonaSave").addEventListener("click", saveManualPersona);
$("btnSummary").addEventListener("click", loadSummary);
if ($("btnTgStatus")) $("btnTgStatus").addEventListener("click", loadTelegramStatus);
$("providers").addEventListener("input", (e) => {
  if (e && e.target && e.target.dataset && e.target.dataset.field === "id") refreshDefaultProviderOptions();
});
$("prompts").addEventListener("input", (e) => {
  if (e && e.target && e.target.dataset && e.target.dataset.field === "id") refreshDefaultPromptOptions();
});
$("personas").addEventListener("input", (e) => {
  if (e && e.target && e.target.dataset && e.target.dataset.field === "id") refreshDefaultPersonaOptions();
});

$("btnAddProvider").addEventListener("click", () => {
  const base = gatherFormConfig();
  base.providers = Array.isArray(base.providers) ? base.providers : [];
  let n = 1;
  const ids = new Set(base.providers.map((p) => String((p && p.id) || "")));
  while (ids.has("provider-" + n)) n++;
  base.providers.push({
    id: "provider-" + n,
    name: I.wordProvider + " " + n,
    baseUrl: "",
    apiKey: "",
    apiType: "responses",
    streamMode: "auto",
    model: "gpt-4.1-mini",
    responsesStyle: "instructions+messages",
    responsesContentFormat: "text",
    extraHeaders: {}
  });
  renderForm(base);
  toast(I.providerAdded, true);
});

$("btnAddPrompt").addEventListener("click", () => {
  const base = gatherFormConfig();
  base.prompts = Array.isArray(base.prompts) ? base.prompts : [];
  let n = 1;
  const ids = new Set(base.prompts.map((p) => String((p && p.id) || "")));
  while (ids.has("prompt-" + n)) n++;
  base.prompts.push({ id: "prompt-" + n, name: I.wordPrompt + " " + n, system: "" });
  renderForm(base);
  toast(I.promptAdded, true);
});

$("btnAddPersona").addEventListener("click", () => {
  const base = gatherFormConfig();
  base.personas = Array.isArray(base.personas) ? base.personas : [];
  let n = 1;
  const ids = new Set(base.personas.map((p) => String((p && p.id) || "")));
  while (ids.has("persona-" + n)) n++;
  base.personas.push({ id: "persona-" + n, name: I.wordPersona + " " + n, system: "" });
  renderForm(base);
  toast(I.personaAdded, true);
});

(async () => {
  await loadConfig();
  await loadSummary();
  await loadChats();
  await loadUsers();
  await refreshConvList();
  const v = decodeURIComponent(String(location.hash || "").replace(/^#/, "")) || "overview";
  setView(v, { pushHash: false });
})();
`;
}
