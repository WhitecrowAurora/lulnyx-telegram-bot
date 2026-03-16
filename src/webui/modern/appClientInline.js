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
import { renderClientApiConversations } from "./client/apiConversations.js";
import { renderClientApiSearch } from "./client/apiSearch.js";
import { renderClientApiStats } from "./client/apiStats.js";
import { renderClientApiDaily } from "./client/apiDaily.js";
import { renderClientApiPersonaDoc } from "./client/apiPersonaDoc.js";
import { renderClientApiSummary } from "./client/apiSummary.js";
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
    renderClientApiConversations(),
    renderClientApiSearch(),
    renderClientApiStats(),
    renderClientApiDaily(),
    renderClientApiPersonaDoc(),
    renderClientApiSummary(),
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
