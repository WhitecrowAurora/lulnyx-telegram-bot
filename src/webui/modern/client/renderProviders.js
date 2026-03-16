export function renderClientRenderProviders() {
  return `
function renderProviders(providers, defId) {
  const wrap = $("providers");
  wrap.innerHTML = "";
  const ids = providers.map((p) => String((p && p.id) || "")).filter(Boolean);
  renderSelectOptions($("fDefaultProvider"), ids.length ? ids : [""], defId || ids[0] || "");
  let idx = 0;
  for (const p of providers) {
    const item = document.createElement("details");
    item.className = "details provider-item";
    item.dataset.idx = String(idx++);
    item.open = false;

    const summary = document.createElement("summary");
    const sumLeft = document.createElement("div");
    const sumTitle = document.createElement("div");
    sumTitle.className = "details-title";
    const sumMeta = document.createElement("div");
    sumMeta.className = "details-meta";
    sumLeft.appendChild(sumTitle);
    sumLeft.appendChild(sumMeta);
    const sumRight = document.createElement("div");
    sumRight.className = "details-meta";
    summary.appendChild(sumLeft);
    summary.appendChild(sumRight);
    item.appendChild(summary);

    const body = document.createElement("div");
    body.className = "details-body";

    const mk = (label, type, field, placeholder) => {
      const l = document.createElement("label");
      l.textContent = label;
      const inp = document.createElement(type === "textarea" ? "textarea" : "input");
      if (type === "textarea") {
        inp.style.minHeight = "90px";
        inp.style.fontFamily = "var(--mono)";
        inp.style.fontSize = "13px";
      } else {
        inp.type = type;
        inp.className = "input";
      }
      inp.dataset.field = field;
      if (placeholder) inp.placeholder = placeholder;
      body.appendChild(l);
      body.appendChild(inp);
      return inp;
    };

    const id = mk(I.labelId, "text", "id", "openai");
    const name = mk(I.labelName, "text", "name", "OpenAI");
    const baseUrl = mk(I.labelBaseUrl, "text", "baseUrl", "https://api.openai.com");

    const apiTypeL = document.createElement("label");
    apiTypeL.textContent = I.labelApiType;
    const apiType = document.createElement("select");
    apiType.className = "input";
    apiType.dataset.field = "apiType";
    apiType.innerHTML =
      '<option value="responses">/v1/responses</option><option value="chat_completions">/v1/chat/completions</option>';
    body.appendChild(apiTypeL);
    body.appendChild(apiType);

    const model = mk(I.labelModel, "text", "model", "gpt-4.1-mini");
    mk(I.labelApiKey + " (" + I.keepBlank + ")", "password", "apiKey", I.keepBlank).value = "";

    const rsL = document.createElement("label");
    rsL.textContent = I.labelResponsesStyle;
    const rs = document.createElement("select");
    rs.className = "input";
    rs.dataset.field = "responsesStyle";
    rs.innerHTML =
      '<option value="instructions+messages">instructions+messages</option><option value="all_messages">all_messages</option>';
    body.appendChild(rsL);
    body.appendChild(rs);

    const cfL = document.createElement("label");
    cfL.textContent = I.labelResponsesContentFormat;
    const cf = document.createElement("select");
    cf.className = "input";
    cf.dataset.field = "responsesContentFormat";
    cf.innerHTML = '<option value="text">text</option><option value="openai_array">openai_array</option>';
    body.appendChild(cfL);
    body.appendChild(cf);

    const eh = mk(I.labelExtraHeaders, "textarea", "extraHeaders", '{"x-foo":"bar"}');

    id.value = p && p.id ? p.id : "";
    name.value = p && p.name ? p.name : "";
    baseUrl.value = p && p.baseUrl ? p.baseUrl : "";
    apiType.value = p && p.apiType ? p.apiType : "responses";
    model.value = p && p.model ? p.model : "";
    rs.value = p && p.responsesStyle ? p.responsesStyle : "instructions+messages";
    cf.value = p && p.responsesContentFormat ? p.responsesContentFormat : "text";
    eh.value = p && p.extraHeaders && typeof p.extraHeaders === "object" ? JSON.stringify(p.extraHeaders, null, 2) : "";

    const actions = document.createElement("div");
    actions.className = "details-actions";
    const del = document.createElement("button");
    del.className = "btn danger";
    del.type = "button";
    del.textContent = I.actionRemove;
    del.addEventListener("click", () => {
      item.remove();
      refreshDefaultProviderOptions();
    });
    actions.appendChild(del);
    body.appendChild(actions);
    item.appendChild(body);

    const updateSummary = () => {
      const idv = String(id.value || "").trim();
      const namev = String(name.value || "").trim();
      const typev = String(apiType.value || "responses");
      const modelv = String(model.value || "").trim();
      sumTitle.textContent = namev || idv || I.wordProvider;
      sumMeta.textContent = idv ? I.metaIdPrefix + idv : I.metaIdMissing;
      sumRight.textContent = typev + (modelv ? " · " + modelv : "");
    };
    id.addEventListener("input", updateSummary);
    name.addEventListener("input", updateSummary);
    apiType.addEventListener("change", updateSummary);
    model.addEventListener("input", updateSummary);
    updateSummary();

    wrap.appendChild(item);
  }
  refreshDefaultProviderOptions();
}

function refreshDefaultProviderOptions() {
  const ids = [...document.querySelectorAll('.provider-item [data-field="id"]')]
    .map((i) => String(i.value || "").trim())
    .filter(Boolean);
  const current = $("fDefaultProvider").value;
  renderSelectOptions($("fDefaultProvider"), ids.length ? ids : [""], ids.includes(current) ? current : ids[0] || "");
  const curLt = $("fLtProvider") ? $("fLtProvider").value : "";
  if ($("fLtProvider"))
    renderSelectOptions($("fLtProvider"), [""].concat(ids), ids.includes(curLt) ? curLt : String(curLt || ""));
}
`;
}

