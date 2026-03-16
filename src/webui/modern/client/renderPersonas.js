export function renderClientRenderPersonas() {
  return `
function renderPersonas(personas, defId) {
  const wrap = $("personas");
  wrap.innerHTML = "";
  const ids = personas.map((p) => String((p && p.id) || "")).filter(Boolean);
  renderSelectOptions($("fDefaultPersona"), ids.length ? ids : [""], defId || ids[0] || "");
  let idx = 0;
  for (const p of personas) {
    const item = document.createElement("details");
    item.className = "details persona-item";
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
    summary.appendChild(sumLeft);
    item.appendChild(summary);

    const body = document.createElement("div");
    body.className = "details-body";
    const l1 = document.createElement("label");
    l1.textContent = I.labelId;
    const id = document.createElement("input");
    id.className = "input";
    id.dataset.field = "id";
    id.value = p && p.id ? p.id : "";
    const l2 = document.createElement("label");
    l2.textContent = I.labelName;
    const name = document.createElement("input");
    name.className = "input";
    name.dataset.field = "name";
    name.value = p && p.name ? p.name : "";
    const l3 = document.createElement("label");
    l3.textContent = I.labelSystemPersona;
    const sys = document.createElement("textarea");
    sys.dataset.field = "system";
    sys.style.minHeight = "120px";
    sys.style.fontFamily = "var(--mono)";
    sys.style.fontSize = "13px";
    sys.value = p && p.system ? p.system : "";
    body.appendChild(l1);
    body.appendChild(id);
    body.appendChild(l2);
    body.appendChild(name);
    body.appendChild(l3);
    body.appendChild(sys);

    const actions = document.createElement("div");
    actions.className = "details-actions";
    const del = document.createElement("button");
    del.className = "btn danger";
    del.type = "button";
    del.textContent = I.actionRemove;
    del.addEventListener("click", () => {
      item.remove();
      refreshDefaultPersonaOptions();
    });
    actions.appendChild(del);
    body.appendChild(actions);
    item.appendChild(body);

    const updateSummary = () => {
      const idv = String(id.value || "").trim();
      const namev = String(name.value || "").trim();
      sumTitle.textContent = namev || idv || I.wordPersona;
      sumMeta.textContent = idv ? I.metaIdPrefix + idv : I.metaIdMissing;
    };
    id.addEventListener("input", updateSummary);
    name.addEventListener("input", updateSummary);
    updateSummary();

    wrap.appendChild(item);
  }
  refreshDefaultPersonaOptions();
}

function refreshDefaultPersonaOptions() {
  const ids = [...document.querySelectorAll('.persona-item [data-field="id"]')]
    .map((i) => String(i.value || "").trim())
    .filter(Boolean);
  const current = $("fDefaultPersona").value;
  renderSelectOptions($("fDefaultPersona"), ids.length ? ids : [""], ids.includes(current) ? current : ids[0] || "");
}
`;
}

