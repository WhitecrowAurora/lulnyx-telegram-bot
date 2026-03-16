export function renderClientFormUtils() {
  return `
function linesToArr(s) {
  return String(s || "")
    .split("\\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function renderSelectOptions(sel, values, current) {
  sel.innerHTML = "";
  for (const v of values) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    if (v === current) o.selected = true;
    sel.appendChild(o);
  }
}
`;
}

