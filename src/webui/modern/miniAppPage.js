import { shell } from "./shell.js";
import { escapeHtml, jsString } from "./util.js";
import { t } from "./i18n.js";

export function renderMiniAppPage({ appName, ui, nonce }) {
  const lang = ui?.lang === "zh" ? "zh" : "en";
  const tt = (key, vars) => escapeHtml(t(lang, key, vars));
  const tj = (key, vars) => jsString(t(lang, key, vars));

  const extraHead = `
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <style>
      #topActions{display:none}
      .mini-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      .mini-label{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
      .mini-value{font-size:22px;font-weight:760;margin-top:8px}
      .mini-note{font-size:13px;color:var(--muted);line-height:1.55}
      .mini-stack{display:flex;flex-direction:column;gap:16px}
      .mini-inline{display:flex;gap:10px;flex-wrap:wrap}
      .mini-user{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .mini-user-meta{display:flex;flex-direction:column;gap:6px}
      .mini-chat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
      .mini-chat-card{padding:16px;border:1px solid var(--border);border-radius:18px;background:linear-gradient(180deg,var(--surface1),var(--surface2));box-shadow:var(--shadowSoft)}
      .mini-chat-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .mini-chat-name{font-weight:760}
      .mini-chat-sub{margin-top:6px;color:var(--muted);font-size:12px;line-height:1.55}
      .mini-chat-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      .mini-empty{padding:18px;border:1px dashed var(--border);border-radius:18px;color:var(--muted)}
      @media (max-width:760px){.mini-summary{grid-template-columns:1fr}}
    </style>
  `;

  const content = `
    <div class="main-panel">
      <div class="card hero-card">
        <div class="hero-top">
          <div class="hero-copy">
            <div class="hero-kicker">${tt("mini.title")}</div>
            <h1 class="hero-title">${escapeHtml(appName || "Telegram Panel")}</h1>
            <div class="hero-note">${tt("mini.note")}</div>
          </div>
          <div class="hero-actions">
            <button class="btn" id="miniRefresh" type="button">${tt("mini.refresh")}</button>
            <button class="btn primary" id="miniReload" type="button" hidden>${tt("mini.reload")}</button>
          </div>
        </div>
        <div class="hero-meta" id="miniStatusPills">
          <span class="pill warn" id="miniAuthState">${tt("mini.auth_wait")}</span>
        </div>
      </div>

      <div class="grid cols">
        <div class="section-card mini-stack">
          <div class="section-head">
            <div>
              <div class="section-title">${tt("mini.user_title")}</div>
              <div class="section-desc">${tt("mini.note")}</div>
            </div>
          </div>
          <div class="mini-user">
            <div class="mini-user-meta">
              <div class="title" id="miniUserName">-</div>
              <div class="sub" id="miniUserMeta">-</div>
            </div>
            <span class="pill ok" id="miniRolePill">-</span>
          </div>
          <div class="msg" id="miniRoleHint" hidden>${tt("mini.actions_locked")}</div>
        </div>

        <div class="section-card">
          <div class="section-head">
            <div>
              <div class="section-title">${tt("mini.telegram_title")}</div>
            </div>
          </div>
          <div class="mini-stack mono" id="miniTelegramBox">-</div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-head">
          <div>
            <div class="section-title">${tt("mini.summary_title")}</div>
          </div>
        </div>
        <div class="mini-summary" id="miniSummary"></div>
      </div>

      <div class="section-card">
        <div class="section-head">
          <div>
            <div class="section-title">${tt("mini.chats_title")}</div>
          </div>
        </div>
        <div id="miniChats" class="mini-chat-grid"></div>
      </div>
    </div>

    <script nonce="${escapeHtml(String(nonce || ""))}">
      (function(){
        const I = {
          authWait: ${tj("mini.auth_wait")},
          authFailed: ${tj("mini.auth_failed")},
          notEnabled: ${tj("mini.not_enabled")},
          noInitData: ${tj("mini.no_init_data")},
          role: ${tj("mini.role")},
          refresh: ${tj("mini.refresh")},
          reload: ${tj("mini.reload")},
          reloadOk: ${tj("mini.reload_ok")},
          allow: ${tj("mini.allow")},
          allowOk: ${tj("mini.allow_ok")},
          autoReplyEnable: ${tj("mini.autoreply_enable")},
          autoReplyDisable: ${tj("mini.autoreply_disable")},
          noChats: ${tj("mini.no_chats")},
          roleViewer: ${tj("mini.role_viewer")},
          roleOperator: ${tj("mini.role_operator")},
          roleAdmin: ${tj("mini.role_admin")},
          modePolling: ${tj("mini.mode_polling")},
          modeWebhook: ${tj("mini.mode_webhook")},
          modeUnknown: ${tj("mini.mode_unknown")},
          autoReplyOn: ${jsString(lang === "zh" ? "自动回复：开" : "AutoReply: ON")},
          autoReplyOff: ${jsString(lang === "zh" ? "自动回复：关" : "AutoReply: OFF")},
          allowedYes: ${jsString(lang === "zh" ? "已允许" : "Allowed")},
          allowedNo: ${jsString(lang === "zh" ? "未允许" : "Not allowed")},
          lastActive: ${jsString(lang === "zh" ? "最后活跃" : "Last active")},
          provider: ${jsString(lang === "zh" ? "当前 Provider" : "Current provider")},
          chats: ${jsString(lang === "zh" ? "聊天" : "Chats")},
          providers: ${jsString(lang === "zh" ? "提供方" : "Providers")},
          allowAll: ${jsString(lang === "zh" ? "全开放" : "Allow all")},
          delivery: ${jsString(lang === "zh" ? "投递模式" : "Delivery")},
          roleLabel: ${jsString(lang === "zh" ? "权限" : "Role")}
        };

        const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
        const state = { roleLevel: 0, viewer: null, data: null };

        const $ = (id) => document.getElementById(id);
        const toast = (text, ok = true) => {
          const host = $("toast");
          if (!host) return;
          const node = document.createElement("div");
          node.className = "msg " + (ok ? "ok" : "err");
          node.textContent = text;
          host.appendChild(node);
          setTimeout(() => node.remove(), 3200);
        };

        function roleLabel(role){
          if(role === "admin") return I.roleAdmin;
          if(role === "operator") return I.roleOperator;
          return I.roleViewer;
        }

        function formatTs(ts){
          const value = Number(ts || 0);
          if(!Number.isFinite(value) || value <= 0) return "-";
          const date = new Date(value);
          try { return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(date); }
          catch { return date.toLocaleString(); }
        }

        function setAuthState(text, kind){
          const el = $("miniAuthState");
          if(!el) return;
          el.textContent = text;
          el.className = "pill " + (kind === "ok" ? "ok" : kind === "warn" ? "warn" : "");
        }

        async function request(path, options){
          const res = await fetch(path, options);
          const json = await res.json().catch(() => ({}));
          if(!res.ok) throw new Error(String(json && (json.error || json.message) || res.status));
          return json;
        }

        function renderSummary(summary){
          const host = $("miniSummary");
          host.innerHTML = "";
          const items = [
            { label: I.chats, value: String(Number(summary.knownChatsCount || 0)), note: "known chats" },
            { label: I.providers, value: String(Number(summary.providersCount || 0)), note: String(summary.defaultProviderId || "-") },
            { label: I.delivery, value: summary.telegramMode === "webhook" ? I.modeWebhook : summary.telegramMode === "polling" ? I.modePolling : I.modeUnknown, note: summary.allowAll ? I.allowAll : "-" }
          ];
          for(const item of items){
            const card = document.createElement("div");
            card.className = "stat-card";
            card.innerHTML = '<div class="mini-label"></div><div class="mini-value"></div><div class="mini-note"></div>';
            card.children[0].textContent = item.label;
            card.children[1].textContent = item.value;
            card.children[2].textContent = item.note;
            host.appendChild(card);
          }
        }

        function renderTelegram(status){
          const box = $("miniTelegramBox");
          const mode = String(status && status.mode || "");
          const runtime = status && status.runtime ? status.runtime : null;
          const lines = [
            "mode: " + (mode === "webhook" ? I.modeWebhook : mode === "polling" ? I.modePolling : I.modeUnknown),
            "polling: " + String(Boolean(status && status.polling && status.polling.running)),
            "webhook: " + String(Boolean(status && status.webhook && status.webhook.configured)),
            "last_start: " + formatTs(status && status.lastStartAt),
            "last_error: " + (status && status.lastError ? String(status.lastError) : "-"),
            "last_update: " + formatTs(runtime && runtime.lastUpdateAt)
          ];
          box.textContent = lines.join("\\n");
        }

        function renderUser(viewer){
          $("miniUserName").textContent = viewer.label || viewer.userId;
          $("miniUserMeta").textContent = (viewer.username ? "@" + viewer.username + " · " : "") + viewer.userId;
          $("miniRolePill").textContent = I.roleLabel + ": " + roleLabel(viewer.role);
          $("miniRoleHint").hidden = state.roleLevel > 0;
          $("miniReload").hidden = state.roleLevel < 2;
        }

        function renderChats(chats){
          const host = $("miniChats");
          host.innerHTML = "";
          if(!Array.isArray(chats) || chats.length === 0){
            const empty = document.createElement("div");
            empty.className = "mini-empty";
            empty.textContent = I.noChats;
            host.appendChild(empty);
            return;
          }
          for(const chat of chats){
            const card = document.createElement("div");
            card.className = "mini-chat-card";
            const title = chat.title || chat.username || chat.chatId;
            const globalPersonaText = chat.globalPersonaEnabled ? String(chat.globalPersonaMode || "single") : "off";
            card.innerHTML =
              '<div class="mini-chat-head"><div><div class="mini-chat-name"></div><div class="mini-chat-sub"></div></div><span class="pill"></span></div>' +
              '<div class="chat-tags" style="margin-top:12px"></div><div class="mini-chat-actions"></div>';
            card.querySelector(".mini-chat-name").textContent = title;
            card.querySelector(".mini-chat-sub").textContent = chat.chatId + (chat.username ? " · @" + chat.username : "");
            card.querySelector(".pill").textContent = String(chat.chatType || "");
            const tags = card.querySelector(".chat-tags");
            const addTag = (text) => {
              const pill = document.createElement("span");
              pill.className = "pill";
              pill.textContent = text;
              tags.appendChild(pill);
            };
            addTag((chat.autoReply ? I.autoReplyOn : I.autoReplyOff));
            addTag((chat.allowed ? I.allowedYes : I.allowedNo));
            addTag(I.provider + ": " + String(chat.providerNameEffective || chat.providerEffective || "-"));
            addTag(I.lastActive + ": " + formatTs(chat.lastSeenAt));
            addTag("Persona: " + globalPersonaText);
            const actions = card.querySelector(".mini-chat-actions");
            if(state.roleLevel >= 1){
              const toggle = document.createElement("button");
              toggle.className = "btn";
              toggle.type = "button";
              toggle.textContent = chat.autoReply ? I.autoReplyDisable : I.autoReplyEnable;
              toggle.addEventListener("click", async () => {
                toggle.disabled = true;
                try{
                  const out = await request("/api/mini-app/chat-autoreply", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ chatId: chat.chatId, autoReply: !chat.autoReply })
                  });
                  chat.autoReply = out.chat.autoReply === true;
                  renderChats(state.data.chats || []);
                }catch(err){
                  toast(err.message || String(err), false);
                }finally{
                  toggle.disabled = false;
                }
              });
              actions.appendChild(toggle);
            }
            if(state.roleLevel >= 2 && !chat.allowed){
              const allow = document.createElement("button");
              allow.className = "btn primary";
              allow.type = "button";
              allow.textContent = I.allow;
              allow.addEventListener("click", async () => {
                allow.disabled = true;
                try{
                  await request("/api/mini-app/chat-allow", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ chatId: chat.chatId })
                  });
                  toast(I.allowOk, true);
                  await loadBootstrap();
                }catch(err){
                  toast(err.message || String(err), false);
                }finally{
                  allow.disabled = false;
                }
              });
              actions.appendChild(allow);
            }
            host.appendChild(card);
          }
        }

        async function loadBootstrap(){
          const out = await request("/api/mini-app/bootstrap");
          state.viewer = out.viewer || null;
          state.roleLevel = Number(out.viewer && out.viewer.roleLevel || 0);
          state.data = out;
          renderUser(out.viewer);
          renderSummary(out.summary || {});
          renderTelegram(out.telegramStatus || {});
          renderChats(out.chats || []);
          setAuthState((out.viewer && out.viewer.label ? out.viewer.label : out.viewer && out.viewer.userId) || "ok", "ok");
        }

        async function start(){
          try{
            if(tg){
              try{
                tg.ready();
                tg.expand();
                const scheme = String(tg.colorScheme || "").toLowerCase();
                if(scheme === "light" || scheme === "dark") document.documentElement.dataset.theme = scheme;
              }catch{}
            }
            if(!tg || !tg.initData){
              setAuthState(I.noInitData, "warn");
              return;
            }
            await request("/api/mini-app/auth", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ initData: tg.initData })
            });
            await loadBootstrap();
          }catch(err){
            setAuthState(I.authFailed, "warn");
            toast((err && err.message) ? err.message : I.authFailed, false);
          }
        }

        $("miniRefresh").addEventListener("click", () => { void loadBootstrap().catch((err) => toast(err.message || String(err), false)); });
        $("miniReload").addEventListener("click", async () => {
          try{
            await request("/api/mini-app/reload", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
            toast(I.reloadOk, true);
            await loadBootstrap();
          }catch(err){
            toast(err.message || String(err), false);
          }
        });

        void start();
      })();
    </script>
  `;

  return shell({
    title: `${appName || "Bot"} - ${t(lang, "mini.title")}`,
    appName,
    subtitle: t(lang, "mini.note"),
    content,
    extraHead,
    ui,
    nonce
  });
}
