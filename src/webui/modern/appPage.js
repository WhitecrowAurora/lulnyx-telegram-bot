import { shell } from "./shell.js";
import { escapeHtml, jsString } from "./util.js";
import { t } from "./i18n.js";
import { renderAppClientInline } from "./appClientInline.js";

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
          <div class="card">
            <div style="font-weight:800;margin-bottom:8px">${tt("nav.menu")}</div>
            <div class="nav">
              <button class="nav-item" data-view="overview" aria-current="page">${tt("nav.overview")}</button>

              <details open>
                <summary>${tt("nav.settings")}</summary>
                <div class="nav-items">
                  <button class="nav-item" data-view="settings-basics">${tt("nav.basics")}</button>
                  <button class="nav-item" data-view="settings-model">${tt("nav.model_providers")}</button>
                  <button class="nav-item" data-view="settings-prompts">${tt("nav.prompts_personas")}</button>
                  <button class="nav-item" data-view="settings-rules">${tt("nav.rules_storage")}</button>
                  <button class="nav-item" data-view="settings-search">${tt("nav.search")}</button>
                  <button class="nav-item" data-view="settings-longterm">${tt("nav.longterm")}</button>
                  <button class="nav-item" data-view="settings-quotas">${tt("nav.quotas")}</button>
                </div>
              </details>

              <details open>
                <summary>${tt("nav.tools")}</summary>
                <div class="nav-items">
                  <button class="nav-item" data-view="tools-chats">${tt("nav.known_chats")}</button>
                  <button class="nav-item" data-view="tools-memory">${tt("nav.memory_admin")}</button>
                  <button class="nav-item" data-view="tools-search">${tt("nav.search_test")}</button>
                  <button class="nav-item" data-view="tools-analytics">${tt("nav.analytics")}</button>
                  <button class="nav-item" data-view="tools-daily">${tt("nav.daily_memory")}</button>
                </div>
              </details>

              <details>
                <summary>${tt("nav.advanced")}</summary>
                <div class="nav-items">
                  <button class="nav-item" data-view="advanced-raw">${tt("nav.raw_json")}</button>
                </div>
              </details>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="row" style="justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:700">${tt("dashboard.title")}</div>
              <div class="sub">${tt("dashboard.subtitle")}</div>
            </div>
            <div class="row">
              <button class="btn" id="btnReload">${tt("action.reload")}</button>
              <button class="btn primary" id="btnSave">${tt("action.save")}</button>
              <button class="btn ghost" id="btnLogout">${tt("action.logout")}</button>
            </div>
          </div>

          <div class="view active" id="view-overview">
            <div class="msg">${tt("overview.select_section")}</div>
            <div class="sub" style="margin-top:10px">${tt("overview.save_note")}</div>
            <div class="grid" style="grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
              <div>
                <div class="row" style="justify-content:space-between;align-items:center">
                  <div style="font-weight:700">${tt("overview.summary_title")}</div>
                  <button class="btn" id="btnSummary" type="button">${tt("overview.summary_refresh")}</button>
                </div>
                <textarea id="summaryOut" style="min-height:240px" readonly></textarea>
              </div>
              <div>
                <div style="font-weight:700;margin:4px 0 6px">${tt("overview.diagnostics")}</div>
                <div class="sub">${tt("storage.secret_hint")}</div>
                <div class="row" style="margin-top:10px">
                  <a class="btn" id="btnDiagnostics" href="/api/diagnostics" target="_blank" rel="noreferrer">${tt("overview.diagnostics_open")}</a>
                </div>
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

