import { shell } from "./shell.js";
import { escapeHtml, jsString } from "./util.js";
import { t } from "./i18n.js";
import { renderAppClientInline } from "./appClientInline.js";

function renderIcon(name) {
  const icons = {
    overview: '<path d="M3 11.5L12 4l9 7.5"/><path d="M5 10v9h5v-5h4v5h5v-9"/>',
    basics: '<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 9h8"/><path d="M8 13h5"/>',
    model: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/><circle cx="17" cy="17" r="2.2"/>',
    prompts: '<path d="M6 4h9l3 3v13H6z"/><path d="M15 4v4h4"/><path d="M9 12h6"/><path d="M9 16h6"/>',
    rules: '<path d="M7 4h10a2 2 0 0 1 2 2v12l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2z"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
    longterm: '<path d="M12 5v7l4 2"/><circle cx="12" cy="12" r="8"/>',
    quotas: '<path d="M5 19V9"/><path d="M12 19V5"/><path d="M19 19v-8"/>',
    chats: '<path d="M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>',
    users: '<path d="M16 19a4 4 0 0 0-8 0"/><circle cx="12" cy="9" r="3"/><path d="M5 19a3.5 3.5 0 0 1 3-3.46"/><path d="M19 19a3.5 3.5 0 0 0-3-3.46"/>',
    plugins: '<path d="M9 3v5"/><path d="M15 3v5"/><path d="M8 8h8a3 3 0 0 1 3 3v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6v-3a3 3 0 0 1 3-3z"/>',
    memory: '<path d="M7 5h10"/><path d="M7 9h10"/><path d="M7 13h7"/><rect x="4" y="3" width="16" height="18" rx="3"/>',
    analytics: '<path d="M4 18l5-6 4 3 7-9"/><path d="M4 20h16"/>',
    daily: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M4 10h16"/>',
    advanced: '<path d="M9.5 4.5l-1 3.5"/><path d="M15.5 4.5l1 3.5"/><path d="M6 13l-2 2 2 2"/><path d="M18 13l2 2-2 2"/><path d="M13 10l-2 10"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>'
  };
  const body = icons[name] || icons.overview;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

function navButton({ view, label, icon, current = false }) {
  return `
    <button class="nav-item" data-view="${escapeHtml(view)}"${current ? ' aria-current="page"' : ""} type="button">
      <span class="nav-item-main">
        <span class="nav-icon">${renderIcon(icon)}</span>
        <span>${label}</span>
      </span>
      <span class="nav-arrow">${renderIcon("chevron")}</span>
    </button>
  `;
}

function shortcutButton({ view, title, note, icon }) {
  return `
    <button class="shortcut-card" data-view="${escapeHtml(view)}" type="button">
      <div class="shortcut-top">
        <span class="shortcut-icon">${renderIcon(icon)}</span>
        <span class="nav-arrow">${renderIcon("chevron")}</span>
      </div>
      <div class="shortcut-title">${title}</div>
      <div class="shortcut-note">${note}</div>
    </button>
  `;
}

export function renderAppPage({ appName, configPath, hasConfigFile, ui, nonce }) {
  const lang = ui?.lang === "zh" ? "zh" : "en";
  const tt = (key, vars) => escapeHtml(t(lang, key, vars));
  const tj = (key, vars) => jsString(t(lang, key, vars));

  const subtitle = hasConfigFile
    ? t(lang, "subtitle.config", { path: configPath })
    : t(lang, "dashboard.config_missing");
  return shell({
    title: `${appName || "Bot Admin"} - ${t(lang, "page.dashboard")}`,
    appName,
    subtitle,
    ui,
    nonce,
    content: `
      <div class="layout">
        <div class="sidebar">
          <div class="card sidebar-card">
            <div class="sidebar-head">
              <div class="sidebar-kicker">${tt("page.dashboard")}</div>
              <div class="sidebar-title">${tt("dashboard.title")}</div>
              <div class="sidebar-note">${tt("dashboard.hero_note")}</div>
            </div>
            <div class="nav">
              ${navButton({ view: "overview", label: tt("nav.overview"), icon: "overview", current: true })}

              <details open>
                <summary>${tt("nav.settings")}</summary>
                <div class="nav-items">
                  ${navButton({ view: "settings-basics", label: tt("nav.basics"), icon: "basics" })}
                  ${navButton({ view: "settings-model", label: tt("nav.model_providers"), icon: "model" })}
                  ${navButton({ view: "settings-prompts", label: tt("nav.prompts_personas"), icon: "prompts" })}
                  ${navButton({ view: "settings-rules", label: tt("nav.rules_storage"), icon: "rules" })}
                  ${navButton({ view: "settings-search", label: tt("nav.search"), icon: "search" })}
                  ${navButton({ view: "settings-longterm", label: tt("nav.longterm"), icon: "longterm" })}
                  ${navButton({ view: "settings-quotas", label: tt("nav.quotas"), icon: "quotas" })}
                </div>
              </details>

              <details open>
                <summary>${tt("nav.tools")}</summary>
                <div class="nav-items">
                  ${navButton({ view: "tools-chats", label: tt("nav.known_chats"), icon: "chats" })}
                  ${navButton({ view: "tools-users", label: tt("nav.user_profiles"), icon: "users" })}
                  ${navButton({ view: "tools-plugins", label: tt("nav.plugins"), icon: "plugins" })}
                  ${navButton({ view: "tools-memory", label: tt("nav.memory_admin"), icon: "memory" })}
                  ${navButton({ view: "tools-search", label: tt("nav.search_test"), icon: "search" })}
                  ${navButton({ view: "tools-analytics", label: tt("nav.analytics"), icon: "analytics" })}
                  ${navButton({ view: "tools-daily", label: tt("nav.daily_memory"), icon: "daily" })}
                </div>
              </details>

              <details>
                <summary>${tt("nav.advanced")}</summary>
                <div class="nav-items">
                  ${navButton({ view: "advanced-raw", label: tt("nav.raw_json"), icon: "advanced" })}
                </div>
              </details>
            </div>
          </div>
        </div>

        <div class="main-panel">
          <div class="card hero-card">
            <div class="hero-top">
              <div class="hero-copy">
                <div class="hero-kicker">${tt("dashboard.title")}</div>
                <h1 class="hero-title">${tt("dashboard.title")}</h1>
                <div class="sub hero-note">${tt("dashboard.hero_note")}</div>
                <div class="hero-meta">
                  <span class="pill">${escapeHtml(subtitle)}</span>
                  <span class="pill">${tt("overview.save_note")}</span>
                </div>
              </div>
              <div class="hero-actions">
                <button class="btn" id="btnReload" type="button">${tt("action.reload")}</button>
                <button class="btn primary" id="btnSave" type="button">${tt("action.save")}</button>
                <button class="btn ghost" id="btnLogout" type="button">${tt("action.logout")}</button>
              </div>
            </div>
          </div>

          <div class="view active" id="view-overview">
            <div class="page-head">
              <div>
                <h2 class="page-title">${tt("nav.overview")}</h2>
                <div class="sub page-note">${tt("dashboard.subtitle")}</div>
              </div>
            </div>
            <div class="grid two-col">
              <div class="section-card">
                <div class="section-head">
                  <div>
                    <h3 class="section-title">${tt("overview.summary_title")}</h3>
                    <div class="section-desc">${tt("overview.summary_note")}</div>
                  </div>
                  <button class="btn" id="btnSummary" type="button">${tt("overview.summary_refresh")}</button>
                </div>
                <textarea id="summaryOut" style="min-height:240px" readonly></textarea>
              </div>
              <div class="section-card">
                <div class="section-head">
                  <div>
                    <h3 class="section-title">${tt("overview.diagnostics")}</h3>
                    <div class="section-desc">${tt("overview.diagnostics_note")}</div>
                  </div>
                </div>
                <div class="empty-state">
                  <div class="sub">${tt("storage.secret_hint")}</div>
                  <div class="sub" style="margin-top:10px">${tt("overview.restart_note")}</div>
                  <div class="row" style="margin-top:14px">
                    <a class="btn" id="btnDiagnostics" href="/api/diagnostics" target="_blank" rel="noreferrer">${tt("overview.diagnostics_open")}</a>
                  </div>
                </div>
              </div>
            </div>
            <div class="section-card" style="margin-top:16px">
              <div class="section-head">
                <div>
                  <h3 class="section-title">${tt("overview.quick_links")}</h3>
                  <div class="section-desc">${tt("overview.quick_links_note")}</div>
                </div>
              </div>
              <div class="shortcut-grid">
                ${shortcutButton({ view: "settings-basics", title: tt("nav.basics"), note: tt("basics.telegram"), icon: "basics" })}
                ${shortcutButton({ view: "settings-model", title: tt("nav.model_providers"), note: tt("model.params"), icon: "model" })}
                ${shortcutButton({ view: "settings-prompts", title: tt("nav.prompts_personas"), note: tt("personas.title"), icon: "prompts" })}
                ${shortcutButton({ view: "tools-chats", title: tt("nav.known_chats"), note: tt("tools.chats_allow_hint"), icon: "chats" })}
                ${shortcutButton({ view: "tools-users", title: tt("nav.user_profiles"), note: tt("users.note"), icon: "users" })}
                ${shortcutButton({ view: "tools-analytics", title: tt("nav.analytics"), note: tt("analytics.note"), icon: "analytics" })}
              </div>
            </div>
          </div>

          <div id="cfgForm">
            <div class="view" id="view-settings-basics">
              <div class="grid" style="grid-template-columns:1fr 1fr;gap:16px">
                <div>
                  <div style="font-weight:700;margin:4px 0 6px">${tt("basics.general")}</div>
                  <label>${tt("field.display_name")}</label>
                  <input class="input" id="fDisplayName" placeholder="${tt("placeholder.display_name")}" />
                  <label>${tt("field.server_host")}</label>
                  <input class="input" id="fServerHost" placeholder="127.0.0.1" />
                  <label>${tt("field.server_port")}</label>
                  <input class="input" id="fServerPort" type="number" min="1" max="65535" />

                  <div style="font-weight:700;margin:18px 0 6px">${tt("basics.admin")}</div>
                  <label>${tt("field.admin_username")}</label>
                  <input class="input" id="fAdminUser" placeholder="${tt("placeholder.admin_username")}" />
                  <label>${tt("field.admin_password_keep")}</label>
                  <input class="input" id="fAdminPass" type="password" placeholder="${tt("placeholder.keep_blank")}" />
                  <label>${tt("storage.cookie_secure")}</label>
                  <select class="input" id="fCookieSecure">
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                </div>

                <div>
                  <div style="font-weight:700;margin:4px 0 6px">${tt("basics.telegram")}</div>
                  <label>${tt("field.tg_token_keep")}</label>
                  <input class="input" id="fTgToken" placeholder="123456:ABC..." />
                  <label>${tt("field.tg_allow_all")}</label>
                  <select class="input" id="fTgAllowAll">
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                  <label>${tt("field.tg_delivery_mode")}</label>
                  <select class="input" id="fTgDeliveryMode">
                    <option value="polling">polling</option>
                    <option value="webhook">webhook</option>
                  </select>
                  <label>${tt("field.tg_public_base_url")}</label>
                  <input class="input" id="fTgPublicBaseUrl" placeholder="https://example.com" />
                  <label>${tt("field.tg_webhook_secret_keep")}</label>
                  <input class="input" id="fTgWebhookSecret" type="password" placeholder="${tt("placeholder.keep_blank")}" />
                  <label>${tt("field.tg_drop_pending_updates")}</label>
                  <select class="input" id="fTgDropPending">
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                  <label>${tt("field.tg_reply_style_default")}</label>
                  <select class="input" id="fTgReplyStyleDefault">
                    <option value="reply_only">${tt("label.reply_only")}</option>
                    <option value="reply_and_mention">${tt("label.reply_and_mention")}</option>
                    <option value="mention_only">${tt("label.mention_only")}</option>
                  </select>
                  <div class="sub" style="margin-top:8px">${tt("telegram.webhook_note")}</div>
                  <label>${tt("field.allowed_chat_ids")}</label>
                  <textarea id="fAllowedChats" style="min-height:110px"></textarea>
                  <label>${tt("field.allowed_user_ids")}</label>
                  <textarea id="fAllowedUsers" style="min-height:110px"></textarea>
                  <label>${tt("field.queue_min_interval")}</label>
                  <input class="input" id="fTgMinInterval" type="number" min="0" />
                  <label>${tt("field.queue_max_concurrent_jobs")}</label>
                  <input class="input" id="fTgMaxConcurrent" type="number" min="0" />
                  <label>${tt("field.queue_max_pending_per_chat")}</label>
                  <input class="input" id="fTgMaxPendingPerChat" type="number" min="0" />

                  <div style="font-weight:700;margin:18px 0 6px">${tt("telegram.status_title")}</div>
                  <div class="row">
                    <button class="btn" id="btnTgStatus" type="button">${tt("telegram.status_refresh")}</button>
                  </div>
                  <textarea id="tgStatusOut" style="min-height:140px" readonly></textarea>
                </div>
              </div>
            </div>

            <div class="view" id="view-settings-model">
              <div class="grid" style="grid-template-columns:1fr 1fr;gap:16px">
                <div>
                  <div class="row" style="justify-content:space-between;align-items:center">
                    <div style="font-weight:700">${tt("model.providers")}</div>
                    <button class="btn" id="btnAddProvider" type="button">${tt("action.add")}</button>
                  </div>
                  <label>${tt("model.default_provider")}</label>
                  <select class="input" id="fDefaultProvider"></select>
                  <div id="providers" style="margin-top:10px;display:flex;flex-direction:column;gap:10px"></div>
                </div>

                <div>
                  <div style="font-weight:700;margin:4px 0 6px">${tt("model.params")}</div>
                  <label>${tt("field.timeout_ms")}</label>
                  <input class="input" id="fTimeoutMs" type="number" min="1000" />
                  <label>${tt("field.temperature")}</label>
                  <input class="input" id="fTemp" type="number" step="0.01" />
                  <label>${tt("field.top_p")}</label>
                  <input class="input" id="fTopP" type="number" step="0.01" />
                  <label>${tt("field.presence_penalty")}</label>
                  <input class="input" id="fPresence" type="number" step="0.1" />
                  <label>${tt("field.frequency_penalty")}</label>
                  <input class="input" id="fFrequency" type="number" step="0.1" />
                  <label>${tt("field.max_output_tokens")}</label>
                  <input class="input" id="fMaxOut" type="number" min="1" />

                  <div style="font-weight:700;margin:18px 0 6px">Retry</div>
                  <label>${tt("field.retry_enabled")}</label>
                  <select class="input" id="fRetryEnabled">
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                  <label>${tt("field.retry_max_retries")}</label>
                  <input class="input" id="fRetryMaxRetries" type="number" min="0" max="10" />
                  <label>${tt("field.retry_base_delay_ms")}</label>
                  <input class="input" id="fRetryBaseDelay" type="number" min="0" />
                  <label>${tt("field.retry_max_delay_ms")}</label>
                  <input class="input" id="fRetryMaxDelay" type="number" min="0" />
                  <label>${tt("field.retry_on_timeout")}</label>
                  <select class="input" id="fRetryOnTimeout">
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                  <label>${tt("field.retry_on_429")}</label>
                  <select class="input" id="fRetryOn429">
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                  <label>${tt("field.retry_on_5xx")}</label>
                  <select class="input" id="fRetryOn5xx">
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>

                  <div style="font-weight:700;margin:18px 0 6px">${tt("memory.title")}</div>
                  <label>${tt("memory.enabled_by_default")}</label>
                  <select class="input" id="fMemDefault">
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                  <label>${tt("memory.max_messages")}</label>
                  <input class="input" id="fMemMax" type="number" min="0" />
                  <label>${tt("memory.max_chars_per_message")}</label>
                  <input class="input" id="fMemMaxChars" type="number" min="200" />
                  <label>${tt("memory.max_facts")}</label>
                  <input class="input" id="fMaxFacts" type="number" min="0" />
                </div>
              </div>
            </div>

            <div class="view" id="view-settings-prompts">
              <div class="grid" style="grid-template-columns:1fr 1fr;gap:16px">
                <div>
                  <div class="row" style="justify-content:space-between;align-items:center">
                    <div style="font-weight:700">${tt("prompts.title")}</div>
                    <button class="btn" id="btnAddPrompt" type="button">${tt("action.add")}</button>
                  </div>
                  <label>${tt("prompts.default_prompt")}</label>
                  <select class="input" id="fDefaultPrompt"></select>
                  <div id="prompts" style="margin-top:10px;display:flex;flex-direction:column;gap:10px"></div>
                </div>
                <div>
                  <div class="row" style="justify-content:space-between;align-items:center">
                    <div style="font-weight:700">${tt("personas.title")}</div>
                    <button class="btn" id="btnAddPersona" type="button">${tt("action.add")}</button>
                  </div>
                  <label>${tt("personas.default_persona")}</label>
                  <select class="input" id="fDefaultPersona"></select>
                  <div id="personas" style="margin-top:10px;display:flex;flex-direction:column;gap:10px"></div>
                </div>
              </div>
            </div>

            <div class="view" id="view-settings-rules">
              <div class="grid" style="grid-template-columns:1fr 1fr;gap:16px">
                <div>
                  <div style="font-weight:700;margin:4px 0 6px">${tt("rules.title")}</div>
                  <label>${tt("rules.one_per_line")}</label>
                  <textarea id="fRules" style="min-height:180px"></textarea>
                </div>
                <div>
                  <div style="font-weight:700;margin:4px 0 6px">${tt("storage.title")}</div>
                  <label>${tt("storage.type_restart")}</label>
                  <select class="input" id="fStateType">
                    <option value="json">json</option>
                    <option value="sqlite">sqlite</option>
                  </select>
                  <label>${tt("storage.json_path")}</label>
                  <input class="input" id="fStateJson" placeholder="data/state.json" />
                  <label>${tt("storage.sqlite_path")}</label>
                  <input class="input" id="fStateSqlite" placeholder="data/state.sqlite" />
                  <div class="sub" style="margin-top:8px">${tt("storage.secret_hint")}</div>

                  <div style="font-weight:700;margin:18px 0 6px">${tt("security.title")}</div>
                  <div class="sub">${tt("security.note")}</div>
                  <label>${tt("security.block_private")}</label>
                  <select class="input" id="fSecBlockPrivate">
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                  <label>${tt("security.dns_resolve")}</label>
                  <select class="input" id="fSecDnsResolve">
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                  <label>${tt("security.dns_timeout_ms")}</label>
                  <input class="input" id="fSecDnsTimeout" type="number" min="0" />
                  <label>${tt("security.deny_on_resolve_failure")}</label>
                  <select class="input" id="fSecDenyOnResolveFail">
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                  <label>${tt("security.allowed_host_suffixes")}</label>
                  <textarea id="fSecAllowedSuffixes" style="min-height:110px"></textarea>
                </div>
              </div>
            </div>

            <div class="view" id="view-settings-search">
              <div class="grid" style="grid-template-columns:1fr 1fr;gap:16px">
                <div>
                  <div style="font-weight:700;margin:4px 0 6px">${tt("search.title")}</div>
                  <label>${tt("field.enabled")}</label>
                  <select class="input" id="fSearchEnabled">
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                  <label>${tt("search.base_url")}</label>
                  <input class="input" id="fSearchBase" placeholder="http://127.0.0.1:8080" />
                  <label>${tt("search.allow_private_network")}</label>
                  <select class="input" id="fSearchAllowPrivate">
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                  <label>${tt("field.timeout_ms")}</label>
                  <input class="input" id="fSearchTimeout" type="number" min="1000" />
                  <label>${tt("search.max_results")}</label>
                  <input class="input" id="fSearchMax" type="number" min="1" max="20" />
                  <label>${tt("search.language")}</label>
                  <input class="input" id="fSearchLang" placeholder="en" />
                  <label>${tt("search.safe_search")}</label>
                  <input class="input" id="fSearchSafe" type="number" min="0" max="2" />
                  <label>${tt("search.categories_optional")}</label>
                  <input class="input" id="fSearchCategories" placeholder="news,general" />
                </div>
                <div>
                  <div style="font-weight:700;margin:4px 0 6px">${tt("toolcalling.title")}</div>
                  <div class="sub">${tt("toolcalling.desc")}</div>
                  <label>${tt("field.enabled")}</label>
                  <select class="input" id="fToolCalling">
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                  <label>${tt("toolcalling.max_turns")}</label>
                  <input class="input" id="fToolTurns" type="number" min="1" max="4" />
                </div>
              </div>
            </div>

            <div class="view" id="view-settings-longterm">
              <div class="grid" style="grid-template-columns:1fr 1fr;gap:16px">
                <div>
                  <div style="font-weight:700;margin:4px 0 6px">${tt("longterm.title")}</div>
                  <div class="sub">${tt("longterm.sqlite_note")}</div>
                  <label>${tt("field.enabled")}</label>
                  <select class="input" id="fLtEnabled">
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                  <label>${tt("longterm.memory_enabled")}</label>
                  <select class="input" id="fLtMem">
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                  <label>${tt("longterm.persona_enabled")}</label>
                  <select class="input" id="fLtPersona">
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                  <label>${tt("longterm.days_to_include")}</label>
                  <input class="input" id="fLtDays" type="number" min="1" max="30" />
                  <label>${tt("longterm.summary_provider")}</label>
                  <select class="input" id="fLtProvider"></select>
                </div>
                <div>
                  <div style="font-weight:700;margin:4px 0 6px">${tt("longterm.daily_title")}</div>
                  <label>${tt("field.enabled")}</label>
                  <select class="input" id="fLtDailyEnabled">
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                  <label>${tt("longterm.daily_time")}</label>
                  <input class="input" id="fLtDailyTime" type="time" />

                  <div style="font-weight:700;margin:18px 0 6px">${tt("longterm.compress_title")}</div>
                  <label>${tt("field.enabled")}</label>
                  <select class="input" id="fLtCompressEnabled">
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                  <label>${tt("longterm.compress_trigger_tokens")}</label>
                  <input class="input" id="fLtCompressTokens" type="number" min="10000" step="1000" />
                  <label>${tt("longterm.compress_chunk_messages")}</label>
                  <input class="input" id="fLtCompressChunk" type="number" min="10" max="200" />
                </div>
              </div>

              <div style="margin-top:14px">
                <div style="font-weight:700;margin:4px 0 6px">${tt("longterm.manual_persona_title")}</div>
                <div class="sub">${tt("longterm.manual_persona_desc")}</div>
                <textarea id="fManualPersona" style="min-height:140px"></textarea>
                <div class="row" style="margin-top:10px">
                  <button class="btn" id="btnPersonaLoad" type="button">${tt("action.refresh")}</button>
                  <button class="btn primary" id="btnPersonaSave" type="button">${tt("action.save")}</button>
                </div>
              </div>
            </div>

            <div class="view" id="view-settings-quotas">
              <div class="grid" style="grid-template-columns:1fr 1fr;gap:16px">
                <div>
                  <div style="font-weight:700;margin:4px 0 6px">${tt("quotas.title")}</div>
                  <div class="sub">${tt("quotas.note")}</div>
                  <label>${tt("field.enabled")}</label>
                  <select class="input" id="fQuotaEnabled">
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                  <label>${tt("quotas.per_user_tokens")}</label>
                  <input class="input" id="fQuotaUserTokens" type="number" min="0" step="1000" />
                  <label>${tt("quotas.per_user_replies")}</label>
                  <input class="input" id="fQuotaUserReplies" type="number" min="0" step="1" />
                </div>
                <div>
                  <div style="font-weight:700;margin:4px 0 6px">${tt("quotas.per_chat_title")}</div>
                  <label>${tt("quotas.per_chat_tokens")}</label>
                  <input class="input" id="fQuotaChatTokens" type="number" min="0" step="1000" />
                  <label>${tt("quotas.per_chat_replies")}</label>
                  <input class="input" id="fQuotaChatReplies" type="number" min="0" step="1" />
                </div>
              </div>
            </div>
          </div>

          <div class="view" id="view-advanced-raw">
            <label>${tt("advanced.config_json_label")}</label>
            <textarea id="cfg" style="min-height:520px"></textarea>
          </div>

          <div class="view" id="view-tools-memory">
            <div class="grid" style="grid-template-columns:.9fr 1.1fr;gap:16px">
              <div>
                <div class="row" style="justify-content:space-between;align-items:center">
                  <div style="font-weight:700">${tt("tools.conversations")}</div>
                  <button class="btn" id="btnConvRefresh">${tt("action.refresh")}</button>
                </div>
                <label>${tt("field.filter")}</label>
                <input class="input" id="convFilter" placeholder="${tt("placeholder.conv_filter")}" />
                <div class="list" id="convList" style="margin-top:10px"></div>
              </div>
              <div>
                <div class="row" style="justify-content:space-between;align-items:center">
                  <div style="font-weight:700">${tt("tools.conversation")}</div>
                  <div class="row">
                    <button class="btn danger" id="btnConvDelete" disabled>${tt("action.delete")}</button>
                    <button class="btn primary" id="btnConvSave" disabled>${tt("action.save")}</button>
                  </div>
                </div>
                <label>${tt("field.key")}</label>
                <input class="input" id="convKey" readonly />
                <label>${tt("field.json")}</label>
                <textarea id="convJson" style="min-height:260px"></textarea>
              </div>
            </div>
          </div>

          <div class="view" id="view-tools-search">
            <div class="row" style="align-items:flex-end">
              <div style="flex:1">
                <label>${tt("search.query")}</label>
                <input class="input" id="q" placeholder="${tt("placeholder.search_query")}" />
              </div>
              <button class="btn primary" id="btnSearch">${tt("search.search")}</button>
            </div>
            <div id="searchOut" style="margin-top:12px"></div>
          </div>

          <div class="view" id="view-tools-chats">
            <div class="row" style="justify-content:space-between;align-items:center">
              <div style="font-weight:700">${tt("nav.known_chats")}</div>
              <button class="btn" id="btnChats" type="button">${tt("action.refresh")}</button>
            </div>
            <div class="sub" style="margin:8px 0 10px">${tt("tools.chats_allow_hint")}</div>
            <label>${tt("field.filter")}</label>
            <input class="input" id="chatFilter" placeholder="${tt("placeholder.chat_filter")}" />
            <div class="list" id="chats"></div>
          </div>

          <div class="view" id="view-tools-users">
            <div class="row" style="justify-content:space-between;align-items:center">
              <div style="font-weight:700">${tt("users.title")}</div>
              <button class="btn" id="btnUsers" type="button">${tt("action.refresh")}</button>
            </div>
            <div class="sub" style="margin:8px 0 10px">${tt("users.note")}</div>
            <label>${tt("field.filter")}</label>
            <input class="input" id="userFilter" placeholder="${tt("placeholder.user_filter")}" />
            <div class="list" id="users"></div>
          </div>

          <div class="view" id="view-tools-plugins">
            <div class="row" style="justify-content:space-between;align-items:center">
              <div style="font-weight:700">${tt("plugins.title")}</div>
              <button class="btn" id="btnPluginsRefresh" type="button">${tt("action.refresh")}</button>
            </div>
            <div class="sub" style="margin:8px 0 10px">${tt("plugins.note")}</div>
            <div class="list" id="plugins"></div>
          </div>

          <div class="view" id="view-tools-analytics">
            <div class="row" style="justify-content:space-between;align-items:center">
              <div style="font-weight:700">${tt("analytics.title")}</div>
              <button class="btn" id="btnStatsRefresh" type="button">${tt("action.refresh")}</button>
            </div>
            <div class="sub" style="margin:8px 0 12px">${tt("analytics.note")}</div>
            <div id="statsOut"></div>
          </div>

          <div class="view" id="view-tools-daily">
            <div class="row" style="justify-content:space-between;align-items:center">
              <div style="font-weight:700">${tt("daily.title")}</div>
              <button class="btn" id="btnDailyRefresh" type="button">${tt("action.refresh")}</button>
            </div>
            <div class="sub" style="margin:8px 0 12px">${tt("daily.note")}</div>
            <div class="grid" style="grid-template-columns:.7fr 1.3fr;gap:16px">
              <div>
                <div class="list" id="dailyDays"></div>
              </div>
              <div>
                <div id="dailyOut" class="mono" style="white-space:pre-wrap"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      ${renderAppClientInline({ nonce, tj })}
    `
  });
}

