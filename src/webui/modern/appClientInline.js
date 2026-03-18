import { escapeHtml } from "./util.js";
import { renderClientBootstrap } from "./client/bootstrap.js";
import { renderClientViews } from "./client/views.js";
import { renderClientFormUtils } from "./client/formUtils.js";
import { renderClientRenderForm } from "./client/renderForm.js";
import { renderClientRenderProviders } from "./client/renderProviders.js";
import { renderClientRenderPrompts } from "./client/renderPrompts.js";
import { renderClientRenderPersonas } from "./client/renderPersonas.js";
import { renderClientFormGather } from "./client/formGather.js";
import { renderClientApiConfig } from "./client/apiConfig.js";
import { renderClientApiChats } from "./client/apiChats.js";
import { renderClientApiUsers } from "./client/apiUsers.js";
import { renderClientApiConversations } from "./client/apiConversations.js";
import { renderClientApiSearch } from "./client/apiSearch.js";
import { renderClientApiStats } from "./client/apiStats.js";
import { renderClientApiDaily } from "./client/apiDaily.js";
import { renderClientApiPersonaDoc } from "./client/apiPersonaDoc.js";
import { renderClientApiSummary } from "./client/apiSummary.js";
import { renderClientApiPlugins } from "./client/apiPlugins.js";
import { renderClientApiTelegram } from "./client/apiTelegram.js";
import { renderClientMain } from "./client/main.js";

export function renderAppClientInline({ nonce, tj }) {
  const parts = [
    renderClientBootstrap({ tj }),
    renderClientViews(),
    renderClientFormUtils(),
    renderClientRenderForm(),
    renderClientRenderProviders(),
    renderClientRenderPrompts(),
    renderClientRenderPersonas(),
    renderClientFormGather(),
    renderClientApiConfig(),
    renderClientApiChats(),
    renderClientApiUsers(),
    renderClientApiConversations(),
    renderClientApiSearch(),
    renderClientApiStats(),
    renderClientApiDaily(),
    renderClientApiPersonaDoc(),
    renderClientApiSummary(),
    renderClientApiPlugins(),
    renderClientApiTelegram(),
    renderClientMain()
  ];

  const code = parts
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join("\n\n");

  return `
      <script nonce="${escapeHtml(String(nonce || ""))}">
${code}
      </script>
  `;
}
