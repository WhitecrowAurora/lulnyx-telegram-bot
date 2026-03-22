export function renderClientFormUtils() {
  return `
function linesToArr(s) {
  return String(s || "")
    .split("\\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalizeMiniAppRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (value === "viewer" || value === "operator" || value === "admin") return value;
  return "admin";
}

function miniAppUsersToText(users) {
  return Array.isArray(users)
    ? users
        .map((item) => {
          const userId = String(item && item.userId || "").trim();
          if (!userId) return "";
          const label = String(item && item.label || "").trim();
          const role = normalizeMiniAppRole(item && item.role);
          return [userId, label, role].join("|");
        })
        .filter(Boolean)
        .join("\\n")
    : "";
}

function parseMiniAppUsers(text) {
  return linesToArr(text)
    .map((line) => {
      const parts = String(line || "").split("|");
      const userId = String(parts[0] || "").trim();
      if (!userId) return null;
      const label = String(parts[1] || "").trim();
      const role = normalizeMiniAppRole(parts[2]);
      return { userId, label, role };
    })
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
