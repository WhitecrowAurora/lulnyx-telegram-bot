export function renderClientViews() {
  return `
function getActiveView() {
  const el = document.querySelector(".view.active");
  const id = el && el.id ? String(el.id) : "";
  return id.startsWith("view-") ? id.slice(5) : "overview";
}

function setView(name, { pushHash = true } = {}) {
  const requested = String(name || "overview");
  const targetExists = Boolean($("view-" + requested));
  const next = targetExists ? requested : "overview";
  const prev = getActiveView();

  // Leaving raw JSON: try to apply raw config back to the form. If invalid, stay.
  if (prev === "advanced-raw" && next !== "advanced-raw") {
    try {
      const obj = JSON.parse($("cfg").value || "{}");
      renderForm(obj);
    } catch {
      toast(I.cfgJsonParseStay, false);
      return;
    }
  }

  // Entering raw JSON: sync latest form values into the raw textarea.
  if (next === "advanced-raw") {
    try {
      const obj = gatherFormConfig();
      $("cfg").value = JSON.stringify(obj, null, 2) + "\\n";
    } catch {
      /* ignore */
    }
  }

  for (const v of document.querySelectorAll(".view")) v.classList.remove("active");
  const el = $("view-" + next);
  if (el) el.classList.add("active");

  for (const b of document.querySelectorAll(".nav-item[data-view]")) {
    if (b.dataset.view === next) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }

  // Ensure parent section is open.
  try {
    const btn = document.querySelector(
      '.nav-item[data-view="' + (CSS && CSS.escape ? CSS.escape(next) : next) + '"]'
    );
    const details = btn ? btn.closest("details") : null;
    if (details) details.open = true;
  } catch {
    /* ignore */
  }

  if (pushHash) history.replaceState(null, "", "#" + encodeURIComponent(next));

  try {
    onViewEnter(next);
  } catch {
    /* ignore */
  }
}

for (const b of document.querySelectorAll("[data-view]")) {
  b.addEventListener("click", () => setView(b.dataset.view || "overview"));
}

window.addEventListener("hashchange", () => {
  const v = decodeURIComponent(String(location.hash || "").replace(/^#/, "")) || "overview";
  setView(v, { pushHash: false });
});
`;
}
