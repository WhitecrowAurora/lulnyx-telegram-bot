import { escapeHtml } from "./util.js";
import { BASE_CSS } from "./styles.js";
import { t } from "./i18n.js";

export function shell({ title, appName, subtitle, content, extraHead = "", ui, nonce } = {}) {
  const lang = ui?.lang === "zh" ? "zh" : "en";
  const theme = ui?.theme === "light" ? "light" : "dark";

  return `<!doctype html>
<html lang="${lang}" data-theme="${theme}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(title)}</title>
  <style>${BASE_CSS}</style>
  ${extraHead}
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="brand">
        <div class="logo" aria-hidden="true"></div>
        <div>
          <div class="title">${escapeHtml(appName || "Bot Admin")}</div>
          <div class="sub">${escapeHtml(subtitle || "")}</div>
        </div>
      </div>
      <div id="topActions">
        <div class="row" style="justify-content:flex-end;align-items:center">
          <button class="btn" id="btnUiTheme" type="button">${escapeHtml(
            t(lang, theme === "dark" ? "ui.theme.to_light" : "ui.theme.to_dark")
          )}</button>
          <button class="btn" id="btnUiLang" type="button">${escapeHtml(
            t(lang, lang === "zh" ? "ui.lang.to_en" : "ui.lang.to_zh")
          )}</button>
        </div>
      </div>
    </div>
    ${content}
    </div>
  <script nonce="${escapeHtml(String(nonce || ""))}">
    (function(){
      function setCookie(name, value){
        document.cookie = name + '=' + encodeURIComponent(String(value||'')) + '; Path=/; Max-Age=31536000; SameSite=Strict';
      }
      async function savePrefs(p){
        try{
          await fetch('/api/ui-prefs', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(p) });
        }catch{
          if(p && p.lang) setCookie('ui_lang', p.lang);
          if(p && p.theme) setCookie('ui_theme', p.theme);
        }
        location.reload();
      }
      const btnTheme = document.getElementById('btnUiTheme');
      if(btnTheme){
        btnTheme.addEventListener('click', function(){
          const cur = (document.documentElement.dataset.theme === 'light') ? 'light' : 'dark';
          const next = (cur === 'light') ? 'dark' : 'light';
          savePrefs({ theme: next });
        });
      }
      const btn = document.getElementById('btnUiLang');
      if(btn){
        btn.addEventListener('click', function(){
          const cur = (document.documentElement.lang === 'zh') ? 'zh' : 'en';
          const next = (cur === 'zh') ? 'en' : 'zh';
          savePrefs({ lang: next });
        });
      }
    })();
  </script>
  <div class="toast" id="toast"></div>
</body>
</html>`;
}
