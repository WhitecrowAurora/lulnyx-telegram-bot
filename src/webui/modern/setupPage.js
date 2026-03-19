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
            <span class="pill">${escapeHtml(t(lang, "setup.optional"))}</span>
            <span class="pill">Telegram</span>
            <span class="pill">OpenAI</span>
          </div>
          <div class="sub auth-note">${escapeHtml(t(lang, "setup.side_note"))}</div>
        </div>
        <div class="card auth-form">
          <form id="f" autocomplete="off">
            <div class="grid two-col" style="margin-top:4px">
              <div>
                <label>${escapeHtml(t(lang, "setup.display_name"))}</label>
                <input class="input" name="displayName" placeholder="${escapeHtml(t(lang, "placeholder.display_name"))}" />
                <label>${escapeHtml(t(lang, "setup.admin_username"))}</label>
                <input class="input" name="username" value="admin" required />
                <label>${escapeHtml(t(lang, "setup.admin_password"))}</label>
                <input class="input" name="password" type="password" placeholder="${escapeHtml(t(lang, "placeholder.min_8_chars"))}" required />
                <label>${escapeHtml(t(lang, "setup.confirm_password"))}</label>
                <input class="input" name="password2" type="password" required />
              </div>
              <div>
                <div class="pill" style="margin-top:6px">${escapeHtml(t(lang, "setup.optional"))}</div>
                <label>${escapeHtml(t(lang, "setup.telegram_token"))}</label>
                <input class="input" name="telegramToken" placeholder="123456:ABC..." />
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
        document.getElementById('f').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          if(String(fd.get('password')) !== String(fd.get('password2'))){ toast(MSG_PW_MISMATCH, false); return; }
          const body = {
            displayName: fd.get('displayName'),
            username: fd.get('username'),
            password: fd.get('password'),
            telegramToken: fd.get('telegramToken'),
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
