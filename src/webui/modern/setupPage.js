import { shell } from "./shell.js";
import { escapeHtml, jsString } from "./util.js";
import { t } from "./i18n.js";

export function renderSetupPage({ appName, configPath, ui, nonce }) {
  const lang = ui?.lang === "zh" ? "zh" : "en";
  return shell({
    title: `${appName || "Bot Admin"} - ${t(lang, "page.setup")}`,
    appName,
    subtitle: configPath ? t(lang, "subtitle.create", { path: configPath }) : "",
    ui,
    nonce,
    content: `
      <div class="auth-shell">
        <div class="card auth-side">
          <div class="hero-kicker">${escapeHtml(t(lang, "page.setup"))}</div>
          <h2 class="auth-title">${escapeHtml(t(lang, "setup.first_time"))}</h2>
          <div class="sub auth-note">${escapeHtml(t(lang, "setup.desc"))}</div>
          <div class="auth-pills">
            <span class="pill">${escapeHtml(t(lang, "setup.local_only"))}</span>
            <span class="pill">${escapeHtml(t(lang, "setup.optional"))}</span>
            <span class="pill">Telegram</span>
            <span class="pill">OpenAI</span>
            <span class="pill">Mini App</span>
          </div>
          <div class="sub auth-note">${escapeHtml(t(lang, "setup.side_note"))}</div>
          <div class="empty-state" style="margin-top:18px">
            <div class="section-subtitle">${escapeHtml(t(lang, "setup.deployment"))}</div>
            <div class="sub">${escapeHtml(t(lang, "setup.local_only_note"))}</div>
            <div class="sub" style="margin-top:10px">${escapeHtml(t(lang, "setup.public_base_url_note"))}</div>
            <div class="sub" style="margin-top:10px">${escapeHtml(t(lang, "setup.recommended_polling"))}</div>
            <div class="sub" style="margin-top:10px">${escapeHtml(t(lang, "setup.miniapp_note"))}</div>
          </div>
        </div>
        <div class="card auth-form">
          <form id="f" autocomplete="off">
            <div class="grid two-col" style="margin-top:4px">
              <div>
                <div style="font-weight:700;margin:4px 0 6px">${escapeHtml(t(lang, "setup.general"))}</div>
                <label>${escapeHtml(t(lang, "setup.display_name"))}</label>
                <input class="input" name="displayName" placeholder="${escapeHtml(t(lang, "placeholder.display_name"))}" />
                <label>${escapeHtml(t(lang, "setup.server_host"))}</label>
                <input class="input" name="serverHost" value="127.0.0.1" placeholder="127.0.0.1" />
                <label>${escapeHtml(t(lang, "setup.server_port"))}</label>
                <input class="input" name="serverPort" type="number" min="1" max="65535" value="3210" />
                <label>${escapeHtml(t(lang, "setup.state_storage"))}</label>
                <select class="input" name="stateStorageType">
                  <option value="json">json</option>
                  <option value="sqlite">sqlite</option>
                </select>

                <div style="font-weight:700;margin:18px 0 6px">${escapeHtml(t(lang, "basics.admin"))}</div>
                <label>${escapeHtml(t(lang, "setup.admin_username"))}</label>
                <input class="input" name="username" value="admin" required />
                <label>${escapeHtml(t(lang, "setup.admin_password"))}</label>
                <input class="input" name="password" type="password" placeholder="${escapeHtml(t(lang, "placeholder.min_8_chars"))}" required />
                <label>${escapeHtml(t(lang, "setup.confirm_password"))}</label>
                <input class="input" name="password2" type="password" required />
              </div>
              <div>
                <div style="font-weight:700;margin:4px 0 6px">${escapeHtml(t(lang, "setup.telegram"))}</div>
                <label>${escapeHtml(t(lang, "setup.telegram_token"))}</label>
                <input class="input" name="telegramToken" placeholder="123456:ABC..." />
                <label>${escapeHtml(t(lang, "setup.telegram_delivery_mode"))}</label>
                <select class="input" name="telegramDeliveryMode">
                  <option value="polling">polling</option>
                  <option value="webhook">webhook</option>
                </select>
                <label>${escapeHtml(t(lang, "setup.public_base_url"))}</label>
                <input class="input" name="publicBaseUrl" placeholder="https://example.com" />
                <div class="sub" style="margin-top:8px">${escapeHtml(t(lang, "setup.public_base_url_note"))}</div>

                <div style="font-weight:700;margin:18px 0 6px">${escapeHtml(t(lang, "setup.miniapp"))}</div>
                <label>${escapeHtml(t(lang, "setup.enable_miniapp"))}</label>
                <select class="input" name="miniAppEnabled" id="setupMiniAppEnabled">
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
                <label>${escapeHtml(t(lang, "setup.miniapp_user_id"))}</label>
                <input class="input setup-miniapp-field" name="miniAppUserId" placeholder="123456789" />
                <label>${escapeHtml(t(lang, "setup.miniapp_button_text"))}</label>
                <input class="input setup-miniapp-field" name="miniAppButtonText" value="Panel" placeholder="Panel" />
                <label>${escapeHtml(t(lang, "setup.miniapp_title"))}</label>
                <input class="input setup-miniapp-field" name="miniAppTitle" value="Telegram Panel" placeholder="Telegram Panel" />
                <div class="sub" style="margin-top:8px">${escapeHtml(t(lang, "setup.miniapp_note"))}</div>

                <div style="font-weight:700;margin:18px 0 6px">${escapeHtml(t(lang, "setup.provider"))}</div>
                <label>${escapeHtml(t(lang, "setup.provider_base_url"))}</label>
                <input class="input" name="providerBaseUrl" placeholder="https://api.openai.com" />
                <label>${escapeHtml(t(lang, "setup.provider_api_key"))}</label>
                <input class="input" name="providerApiKey" placeholder="sk-..." />
                <label>${escapeHtml(t(lang, "setup.model"))}</label>
                <input class="input" name="providerModel" placeholder="gpt-4.1-mini" />
                <label>${escapeHtml(t(lang, "setup.api_type"))}</label>
                <select class="input" name="providerApiType">
                  <option value="responses">/v1/responses</option>
                  <option value="chat_completions">/v1/chat/completions</option>
                </select>
              </div>
            </div>
            <div class="row" style="justify-content:flex-end">
              <button class="btn primary" type="submit">${escapeHtml(t(lang, "setup.create_config"))}</button>
            </div>
          </form>
        </div>
      </div>
      <script nonce="${escapeHtml(String(nonce || ""))}">
        const toast=(t,ok=true)=>{const el=document.getElementById('toast');const d=document.createElement('div');d.className='msg '+(ok?'ok':'err');d.textContent=t;el.appendChild(d);setTimeout(()=>d.remove(),3800)};
        const MSG_PW_MISMATCH = ${jsString(t(lang, "setup.passwords_mismatch"))};
        const MSG_SETUP_FAILED = ${jsString(t(lang, "setup.failed"))};
        const MSG_SETUP_OK = ${jsString(t(lang, "setup.complete_login"))};
        const miniToggle = document.getElementById('setupMiniAppEnabled');
        const syncMiniApp = () => {
          const enabled = miniToggle && miniToggle.value === 'true';
          document.querySelectorAll('.setup-miniapp-field').forEach((el) => {
            el.disabled = !enabled;
          });
        };
        if(miniToggle){
          miniToggle.addEventListener('change', syncMiniApp);
          syncMiniApp();
        }
        document.getElementById('f').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          if(String(fd.get('password')) !== String(fd.get('password2'))){ toast(MSG_PW_MISMATCH, false); return; }
          const body = {
            displayName: fd.get('displayName'),
            serverHost: fd.get('serverHost'),
            serverPort: fd.get('serverPort'),
            stateStorageType: fd.get('stateStorageType'),
            username: fd.get('username'),
            password: fd.get('password'),
            telegramToken: fd.get('telegramToken'),
            telegramDeliveryMode: fd.get('telegramDeliveryMode'),
            publicBaseUrl: fd.get('publicBaseUrl'),
            miniAppEnabled: fd.get('miniAppEnabled'),
            miniAppUserId: fd.get('miniAppUserId'),
            miniAppButtonText: fd.get('miniAppButtonText'),
            miniAppTitle: fd.get('miniAppTitle'),
            provider: {
              baseUrl: fd.get('providerBaseUrl'),
              apiKey: fd.get('providerApiKey'),
              model: fd.get('providerModel'),
              apiType: fd.get('providerApiType')
            }
          };
          const res = await fetch('/api/setup', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
          const json = await res.json().catch(()=>({}));
          if(!res.ok){ toast(json.error||MSG_SETUP_FAILED, false); return; }
          toast(MSG_SETUP_OK, true);
          setTimeout(()=>location.href='/login', 800);
        });
      </script>
    `
  });
}
