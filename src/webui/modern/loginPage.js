import { shell } from "./shell.js";
import { escapeHtml, jsString } from "./util.js";
import { t } from "./i18n.js";

export function renderLoginPage({ appName, configPath, message, ui, nonce }) {
  const lang = ui?.lang === "zh" ? "zh" : "en";
  const msg = message ? `<div class="msg">${escapeHtml(message)}</div>` : "";
  return shell({
    title: `${appName || "Bot Admin"} - ${t(lang, "page.login")}`,
    appName,
    subtitle: configPath ? t(lang, "subtitle.config", { path: configPath }) : "",
    ui,
    nonce,
    content: `
      <div class="auth-shell">
        <div class="card auth-side">
          <div class="hero-kicker">${escapeHtml(t(lang, "page.login"))}</div>
          <h2 class="auth-title">${escapeHtml(t(lang, "login.sign_in"))}</h2>
          <div class="sub auth-note">${escapeHtml(t(lang, "login.protected"))}</div>
          <div class="auth-pills">
            <span class="pill">${escapeHtml(t(lang, "page.dashboard"))}</span>
            <span class="pill">${escapeHtml(t(lang, "nav.settings"))}</span>
            <span class="pill">${escapeHtml(t(lang, "nav.tools"))}</span>
          </div>
          <div class="sub auth-note">${escapeHtml(t(lang, "login.side_note"))}</div>
        </div>
        <div class="card auth-form">
          ${msg}
          <form id="f" autocomplete="off">
            <label>${escapeHtml(t(lang, "login.username"))}</label>
            <input class="input" name="username" placeholder="admin" required />
            <label>${escapeHtml(t(lang, "login.password"))}</label>
            <input class="input" name="password" type="password" placeholder="••••••••" required />
            <div class="row" style="justify-content:flex-end">
              <button class="btn primary" type="submit">${escapeHtml(t(lang, "login.login"))}</button>
            </div>
          </form>
        </div>
      </div>
      <script nonce="${escapeHtml(String(nonce || ""))}">
        const toast=(t,ok=true)=>{const el=document.getElementById('toast');const d=document.createElement('div');d.className='msg '+(ok?'ok':'err');d.textContent=t;el.appendChild(d);setTimeout(()=>d.remove(),3200)};
        const MSG_LOGIN_FAILED = ${jsString(t(lang, "login.failed"))};
        document.getElementById('f').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const body = { username: fd.get('username'), password: fd.get('password') };
          const res = await fetch('/api/login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
          const json = await res.json().catch(()=>({}));
          if(!res.ok){ toast(json.error||MSG_LOGIN_FAILED, false); return; }
          location.href = '/';
        });
      </script>
    `
  });
}
