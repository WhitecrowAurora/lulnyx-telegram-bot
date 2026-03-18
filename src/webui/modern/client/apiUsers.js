export function renderClientApiUsers() {
  return `
let userProfilesCache = [];
const userProfileDrafts = new Map();
let userProfileBeforeUnloadBound = false;

function userPromptSlotLabel(slot) {
  const s = String(slot || "");
  if (s === "slot1") return I.usersPromptSlot1;
  if (s === "slot2") return I.usersPromptSlot2;
  return I.usersPromptOff;
}

function userFullName(u) {
  return [String(u?.firstName || "").trim(), String(u?.lastName || "").trim()].filter(Boolean).join(" ").trim();
}

function formatTpl(template, vars) {
  let out = String(template || "");
  for (const [k, v] of Object.entries(vars || {})) out = out.replaceAll("{" + k + "}", String(v ?? ""));
  return out;
}

function userPersonaStateLabel({ enabled, text }) {
  const hasText = Boolean(String(text || "").trim());
  if (enabled && hasText) return I.usersPersonaOn;
  if (hasText) return I.usersPersonaSaved;
  return I.usersPersonaEmpty;
}

function userProfileStateFromRecord(u) {
  return {
    displayNameMode: String(u?.displayNameMode || "username"),
    customDisplayName: String(u?.customDisplayName || ""),
    customPersonaEnabled: Boolean(u?.customPersonaEnabled),
    customPersona: String(u?.customPersona || ""),
    activePromptSlot: String(u?.activePromptSlot || ""),
    customPrompt1: String(u?.customPrompt1 || ""),
    customPrompt2: String(u?.customPrompt2 || "")
  };
}

function userProfileStateKey(state) {
  return JSON.stringify({
    displayNameMode: String(state?.displayNameMode || "username"),
    customDisplayName: String(state?.customDisplayName || ""),
    customPersonaEnabled: Boolean(state?.customPersonaEnabled),
    customPersona: String(state?.customPersona || ""),
    activePromptSlot: String(state?.activePromptSlot || ""),
    customPrompt1: String(state?.customPrompt1 || ""),
    customPrompt2: String(state?.customPrompt2 || "")
  });
}

function getUserProfileViewState(u) {
  const userId = String(u?.userId || "");
  const base = userProfileStateFromRecord(u);
  const draft = userProfileDrafts.get(userId);
  if (!draft) return { base, current: base, dirty: false };
  const baseKey = userProfileStateKey(base);
  const draftKey = userProfileStateKey(draft);
  if (baseKey === draftKey) {
    userProfileDrafts.delete(userId);
    return { base, current: base, dirty: false };
  }
  return { base, current: draft, dirty: true };
}

function updateUserProfileDraft(userId, baseState, nextState) {
  const next = userProfileStateFromRecord(nextState);
  if (userProfileStateKey(baseState) === userProfileStateKey(next)) {
    userProfileDrafts.delete(userId);
    return false;
  }
  userProfileDrafts.set(String(userId || ""), next);
  return true;
}

function hasDirtyUserProfiles() {
  return userProfileDrafts.size > 0;
}

function ensureUserProfileLeaveGuard() {
  if (userProfileBeforeUnloadBound) return;
  userProfileBeforeUnloadBound = true;
  window.addEventListener("beforeunload", (event) => {
    if (!hasDirtyUserProfiles()) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

function renderUsers() {
  ensureUserProfileLeaveGuard();
  const filter = String($("userFilter")?.value || "").trim().toLowerCase();
  const el = $("users");
  if (!el) return;
  el.innerHTML = "";
  el.className = "chat-list";

  const items = userProfilesCache || [];
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "msg";
    empty.textContent = I.usersNoProfiles;
    el.appendChild(empty);
    return;
  }

  for (const u of items) {
    const userId = String(u?.userId || "");
    const state = getUserProfileViewState(u);
    const current = state.current;
    const username = String(u?.username || "");
    const fullName = userFullName(u);
    const customName = String(current?.customDisplayName || "");
    const customPersona = String(current?.customPersona || "");
    const hay = (userId + " " + username + " " + fullName + " " + customName + " " + customPersona).toLowerCase();
    if (filter && !hay.includes(filter)) continue;

    const card = document.createElement("div");
    card.className = "chat-card";
    const left = document.createElement("div");
    left.className = "chat-main";

    const titleRow = document.createElement("div");
    titleRow.className = "chat-title";
    titleRow.appendChild(makePill(I.labelUserId + ": " + userId));
    if (username) titleRow.appendChild(makePill(I.labelUsername + ": @" + username));
    left.appendChild(titleRow);

    const nameEl = document.createElement("div");
    nameEl.className = "chat-name";
    nameEl.textContent = customName || fullName || (username ? "@" + username : userId);
    left.appendChild(nameEl);

    const subEl = document.createElement("div");
    subEl.className = "chat-sub";
    subEl.textContent = fullName ? I.labelFullName + ": " + fullName : "";
    left.appendChild(subEl);

    const tags = document.createElement("div");
    tags.className = "chat-tags";
    tags.appendChild(makePill((current?.displayNameMode === "custom" ? I.usersModeCustom : I.usersModeUsername)));
    tags.appendChild(makePill(I.labelLastActive + ": " + formatLastSeen(u?.lastSeenAt)));
    tags.appendChild(makePill(I.fieldActiveCustomPrompt + ": " + userPromptSlotLabel(current?.activePromptSlot)));
    tags.appendChild(makePill(I.fieldCustomPersona + ": " + userPersonaStateLabel({ enabled: current?.customPersonaEnabled, text: current?.customPersona })));
    if (String(current?.customPrompt1 || "").trim()) tags.appendChild(makePill(I.usersPromptSlot1));
    if (String(current?.customPrompt2 || "").trim()) tags.appendChild(makePill(I.usersPromptSlot2));
    const dirtyPill = makePill(state.dirty ? I.usersUnsaved : I.usersSaved);
    dirtyPill.className = "pill " + (state.dirty ? "warn" : "ok");
    tags.appendChild(dirtyPill);
    left.appendChild(tags);

    const right = document.createElement("div");
    right.className = "chat-actions";

    const modeSel = document.createElement("select");
    modeSel.className = "input";
    modeSel.innerHTML =
      '<option value="username">' + I.usersModeUsername + "</option>" +
      '<option value="custom">' + I.usersModeCustom + "</option>";
    modeSel.value = String(current?.displayNameMode || "username");

    const customInput = document.createElement("input");
    customInput.className = "input";
    customInput.value = customName;
    customInput.placeholder = I.labelName;

    const promptSel = document.createElement("select");
    promptSel.className = "input";
    promptSel.innerHTML =
      '<option value="">' + I.usersPromptOff + "</option>" +
      '<option value="slot1">' + I.usersPromptSlot1 + "</option>" +
      '<option value="slot2">' + I.usersPromptSlot2 + "</option>";
    promptSel.value = String(current?.activePromptSlot || "");

    const personaSel = document.createElement("select");
    personaSel.className = "input";
    personaSel.innerHTML =
      '<option value="off">' + I.usersPersonaOff + "</option>" +
      '<option value="on">' + I.usersPersonaOn + "</option>";
    personaSel.value = current?.customPersonaEnabled ? "on" : "off";

    const personaInput = document.createElement("textarea");
    personaInput.className = "input";
    personaInput.style.minHeight = "120px";
    personaInput.value = customPersona;

    const personaMeta = document.createElement("div");
    personaMeta.className = "chat-tags";
    const personaCountPill = makePill("");
    const personaStatePill = makePill("");
    personaMeta.appendChild(personaCountPill);
    personaMeta.appendChild(personaStatePill);

    const personaPreviewLabel = document.createElement("label");
    personaPreviewLabel.textContent = I.usersPersonaPreview;
    const personaPreview = document.createElement("div");
    personaPreview.className = "msg";
    personaPreview.style.minHeight = "76px";
    personaPreview.style.whiteSpace = "pre-wrap";

    const prompt1 = document.createElement("textarea");
    prompt1.className = "input";
    prompt1.style.minHeight = "120px";
    prompt1.value = String(current?.customPrompt1 || "");

    const prompt2 = document.createElement("textarea");
    prompt2.className = "input";
    prompt2.style.minHeight = "120px";
    prompt2.value = String(current?.customPrompt2 || "");

    const collectState = () =>
      userProfileStateFromRecord({
        displayNameMode: modeSel.value,
        customDisplayName: customInput.value,
        customPersonaEnabled: personaSel.value === "on",
        customPersona: personaInput.value,
        activePromptSlot: promptSel.value,
        customPrompt1: prompt1.value,
        customPrompt2: prompt2.value
      });

    const refreshDraftUi = () => {
      const next = collectState();
      const dirty = updateUserProfileDraft(userId, state.base, next);
      personaCountPill.textContent = formatTpl(I.usersPersonaCount, { count: String(String(next.customPersona || "").trim().length) });
      personaStatePill.textContent = I.fieldCustomPersona + ": " + userPersonaStateLabel({ enabled: next.customPersonaEnabled, text: next.customPersona });
      dirtyPill.textContent = dirty ? I.usersUnsaved : I.usersSaved;
      dirtyPill.className = "pill " + (dirty ? "warn" : "ok");
      personaPreview.textContent = String(next.customPersona || "").trim() || I.usersPersonaEmpty;
      btnSave.disabled = !dirty;
      btnDiscard.disabled = !dirty;
    };

    const bindDraftChange = (node) => {
      node.addEventListener("input", refreshDraftUi);
      node.addEventListener("change", refreshDraftUi);
    };

    const btnSave = document.createElement("button");
    btnSave.className = "btn primary";
    btnSave.type = "button";
    btnSave.textContent = I.actionSave || "Save";
    btnSave.disabled = !state.dirty;
    btnSave.addEventListener("click", async () => {
      const next = collectState();
      const res = await fetch("/api/user-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId,
          patch: {
            displayNameMode: next.displayNameMode,
            customDisplayName: next.customDisplayName,
            customPersonaEnabled: next.customPersonaEnabled,
            customPersona: next.customPersona,
            activePromptSlot: next.activePromptSlot,
            customPrompt1: next.customPrompt1,
            customPrompt2: next.customPrompt2
          }
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json.error || I.errSave, false);
        return;
      }
      const p = json?.profile || {};
      u.displayNameMode = String(p.displayNameMode || modeSel.value || "username");
      u.customDisplayName = String(p.customDisplayName || "");
      u.customPersonaEnabled = Boolean(p.customPersonaEnabled);
      u.customPersona = String(p.customPersona || "");
      u.activePromptSlot = String(p.activePromptSlot || "");
      u.customPrompt1 = String(p.customPrompt1 || "");
      u.customPrompt2 = String(p.customPrompt2 || "");
      u.hasPersona = Boolean(String(u.customPersona || "").trim());
      u.hasPrompt1 = Boolean(String(u.customPrompt1 || "").trim());
      u.hasPrompt2 = Boolean(String(u.customPrompt2 || "").trim());
      userProfileDrafts.delete(userId);
      renderUsers();
      toast(I.userProfileSaved, true);
    });

    const btnDiscard = document.createElement("button");
    btnDiscard.className = "btn ghost";
    btnDiscard.type = "button";
    btnDiscard.textContent = I.actionDiscard || "Discard";
    btnDiscard.disabled = !state.dirty;
    btnDiscard.addEventListener("click", () => {
      userProfileDrafts.delete(userId);
      renderUsers();
    });

    for (const node of [modeSel, customInput, promptSel, personaSel, personaInput, prompt1, prompt2]) bindDraftChange(node);

    const fields = [
      [I.fieldDisplayNameMode || "Display name mode", modeSel],
      [I.fieldCustomDisplayName || "Custom display name", customInput],
      [I.fieldCustomPersonaEnabled || "Custom persona enabled", personaSel],
      [I.fieldCustomPersona || "Custom persona", personaInput],
      [null, personaMeta],
      [null, personaPreviewLabel],
      [null, personaPreview],
      [I.fieldActiveCustomPrompt || "Active custom prompt", promptSel],
      [I.fieldCustomPrompt1 || "Custom prompt 1", prompt1],
      [I.fieldCustomPrompt2 || "Custom prompt 2", prompt2]
    ];
    for (const pair of fields) {
      const wrap = document.createElement("div");
      if (pair[0]) {
        const label = document.createElement("label");
        label.textContent = pair[0];
        wrap.appendChild(label);
      }
      wrap.appendChild(pair[1]);
      right.appendChild(wrap);
    }
    const actionRow = document.createElement("div");
    actionRow.className = "row";
    actionRow.appendChild(btnDiscard);
    actionRow.appendChild(btnSave);
    right.appendChild(actionRow);

    refreshDraftUi();

    card.appendChild(left);
    card.appendChild(right);
    el.appendChild(card);
  }
}

async function loadUsers() {
  const res = await fetch("/api/user-profiles");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(json.error || I.errLoadUsers, false);
    return;
  }
  userProfilesCache = Array.isArray(json.items) ? json.items : [];
  const knownIds = new Set(userProfilesCache.map((item) => String(item?.userId || "")));
  for (const userId of Array.from(userProfileDrafts.keys())) {
    if (!knownIds.has(userId)) userProfileDrafts.delete(userId);
  }
  renderUsers();
}
`;
}
