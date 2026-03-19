export const BASE_CSS = `
:root{
  color-scheme: dark;
  --bg:#0b0d12;
  --bg2:#11141b;
  --panel:rgba(20,24,33,.82);
  --panelStrong:rgba(16,19,26,.92);
  --panelSoft:rgba(255,255,255,.04);
  --panelSoftHi:rgba(255,255,255,.07);
  --text:#f5f7fb;
  --muted:#99a2b3;
  --muted2:#7f8796;
  --border:rgba(255,255,255,.08);
  --accent:#ff9500;
  --accentHi:#ffb648;
  --accentRgb:255,149,0;
  --success:#2fc28b;
  --danger:#ff5f7a;
  --shadow:0 24px 80px rgba(0,0,0,.34);
  --shadowSoft:0 12px 40px rgba(0,0,0,.22);
  --surface1:rgba(255,255,255,.045);
  --surface2:rgba(255,255,255,.028);
  --surface3:rgba(255,255,255,.075);
  --btnBg:rgba(255,255,255,.05);
  --btnBgHover:rgba(255,255,255,.09);
  --inputBg:rgba(255,255,255,.035);
  --msgBg:rgba(255,255,255,.045);
  --kText:#d4dcf2;
  --mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
  --sans:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --radius:20px;
}
:root[data-theme="light"]{
  color-scheme: light;
  --bg:#f3f5f8;
  --bg2:#eef1f6;
  --panel:rgba(255,255,255,.82);
  --panelStrong:rgba(255,255,255,.94);
  --panelSoft:rgba(15,23,42,.03);
  --panelSoftHi:rgba(15,23,42,.055);
  --text:#131722;
  --muted:#667085;
  --muted2:#8a94a6;
  --border:rgba(15,23,42,.09);
  --shadow:0 24px 70px rgba(15,23,42,.08);
  --shadowSoft:0 14px 40px rgba(15,23,42,.06);
  --surface1:rgba(255,255,255,.9);
  --surface2:rgba(255,255,255,.7);
  --surface3:rgba(15,23,42,.04);
  --btnBg:rgba(15,23,42,.035);
  --btnBgHover:rgba(15,23,42,.07);
  --inputBg:rgba(255,255,255,.94);
  --msgBg:rgba(255,255,255,.82);
  --kText:#334155;
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  font-family:var(--sans);
  color:var(--text);
  background:
    radial-gradient(1200px 720px at 0% -10%, rgba(var(--accentRgb),.18), transparent 58%),
    radial-gradient(900px 520px at 100% 0%, rgba(47,194,139,.12), transparent 54%),
    linear-gradient(180deg, var(--bg), var(--bg2));
}
body::before{
  content:"";
  position:fixed;
  inset:0;
  pointer-events:none;
  background:
    linear-gradient(rgba(255,255,255,.015), rgba(255,255,255,0)),
    linear-gradient(90deg, rgba(255,255,255,.012), rgba(255,255,255,0));
  mix-blend-mode:soft-light;
}
a{color:inherit;text-decoration:none}
button,input,select,textarea{font:inherit}
.wrap{max-width:1400px;margin:0 auto;padding:22px}
.top{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  margin-bottom:18px;
  padding:14px 16px;
  border:1px solid var(--border);
  background:var(--panel);
  box-shadow:var(--shadowSoft);
  backdrop-filter:blur(18px);
  -webkit-backdrop-filter:blur(18px);
  border-radius:24px;
}
.brand{display:flex;align-items:center;gap:14px;min-width:0}
.logo{
  width:40px;
  height:40px;
  border-radius:14px;
  background:linear-gradient(135deg, var(--accent), var(--accentHi));
  box-shadow:0 10px 30px rgba(var(--accentRgb),.28);
  position:relative;
}
.logo::after{
  content:"";
  position:absolute;
  inset:9px;
  border-radius:9px;
  border:1px solid rgba(255,255,255,.22);
}
.title{font-size:18px;font-weight:760;letter-spacing:.01em}
.sub{color:var(--muted);font-size:13px;line-height:1.55}
#topActions .row{gap:10px}
.card{
  background:var(--panel);
  border:1px solid var(--border);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  backdrop-filter:blur(18px);
  -webkit-backdrop-filter:blur(18px);
}
.grid{display:grid;gap:16px}
.grid.cols{grid-template-columns:1.3fr .7fr}
.layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:18px;align-items:start}
.sidebar{position:sticky;top:18px;align-self:start}
.sidebar-card{padding:18px}
.sidebar-head{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.sidebar-kicker{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted2)}
.sidebar-title{font-size:18px;font-weight:760}
.sidebar-note{font-size:13px;color:var(--muted);line-height:1.55}
.nav{display:flex;flex-direction:column;gap:12px}
.nav details{
  border:1px solid var(--border);
  background:var(--surface2);
  border-radius:16px;
  padding:10px;
}
.nav details > summary{
  cursor:pointer;
  list-style:none;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:4px 2px;
  color:var(--muted);
  font-size:13px;
  font-weight:650;
}
.nav details > summary::-webkit-details-marker{display:none}
.nav-items{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.nav-item{
  width:100%;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:12px 13px;
  border-radius:14px;
  border:1px solid transparent;
  background:var(--btnBg);
  color:var(--text);
  cursor:pointer;
  font-weight:650;
  transition:background .18s ease,border-color .18s ease,transform .18s ease,box-shadow .18s ease;
}
.nav-item:hover{
  background:var(--btnBgHover);
  border-color:var(--border);
  transform:translateY(-1px);
}
.nav-item[aria-current="page"]{
  background:linear-gradient(180deg, rgba(var(--accentRgb),.18), rgba(var(--accentRgb),.10));
  border-color:rgba(var(--accentRgb),.45);
  box-shadow:0 12px 26px rgba(var(--accentRgb),.12);
}
.nav-item-main{display:flex;align-items:center;gap:10px;min-width:0}
.nav-icon{
  width:30px;
  height:30px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border-radius:10px;
  background:var(--surface3);
  color:var(--muted);
  flex:0 0 auto;
}
.nav-item[aria-current="page"] .nav-icon{color:var(--text);background:rgba(var(--accentRgb),.18)}
.nav-icon svg,.nav-arrow svg,.shortcut-icon svg{width:16px;height:16px;display:block}
.nav-arrow{color:var(--muted2);display:inline-flex;align-items:center}
.main-panel{display:flex;flex-direction:column;gap:18px;min-width:0}
.hero-card{padding:22px}
.hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap}
.hero-copy{min-width:0;max-width:760px}
.hero-kicker{
  font-size:11px;
  font-weight:760;
  text-transform:uppercase;
  letter-spacing:.14em;
  color:var(--muted2);
  margin-bottom:10px;
}
.hero-title{margin:0;font-size:30px;line-height:1.08;letter-spacing:-.02em}
.hero-note{margin-top:10px;max-width:720px}
.hero-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
.hero-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.hero-actions .btn{min-width:110px}
.status-grid,.shortcut-grid{display:grid;gap:14px}
.status-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
.shortcut-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
.stat-card,.shortcut-card,.section-card{
  border:1px solid var(--border);
  border-radius:18px;
  background:linear-gradient(180deg, var(--surface1), var(--surface2));
  box-shadow:var(--shadowSoft);
}
.stat-card{padding:16px}
.stat-label{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.stat-value{font-size:20px;font-weight:760;margin-top:8px}
.stat-note{margin-top:8px;font-size:13px;color:var(--muted);line-height:1.5}
.shortcut-card{
  padding:16px;
  text-align:left;
  cursor:pointer;
  color:inherit;
  transition:transform .18s ease,border-color .18s ease,background .18s ease;
}
.shortcut-card:hover{transform:translateY(-1px);border-color:rgba(var(--accentRgb),.34);background:linear-gradient(180deg, rgba(var(--accentRgb),.09), var(--surface2))}
.shortcut-top{display:flex;align-items:center;justify-content:space-between;gap:12px}
.shortcut-icon{
  width:36px;
  height:36px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border-radius:12px;
  background:rgba(var(--accentRgb),.12);
  color:var(--text);
}
.shortcut-title{margin-top:14px;font-size:15px;font-weight:700}
.shortcut-note{margin-top:6px;font-size:13px;color:var(--muted);line-height:1.5}
.view{
  display:none;
  padding:20px;
  border:1px solid var(--border);
  border-radius:var(--radius);
  background:var(--panel);
  box-shadow:var(--shadowSoft);
  backdrop-filter:blur(18px);
  -webkit-backdrop-filter:blur(18px);
}
.view.active{display:block;animation:viewFade .16s ease}
@keyframes viewFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.page-head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:14px;
  flex-wrap:wrap;
  margin-bottom:16px;
}
.page-title{font-size:24px;font-weight:760;letter-spacing:-.02em;margin:0}
.page-note{margin-top:6px;max-width:760px}
.section-card{padding:18px}
.section-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  margin-bottom:14px;
  flex-wrap:wrap;
}
.section-title{font-size:16px;font-weight:740;margin:0}
.section-desc{margin-top:6px;font-size:13px;color:var(--muted);line-height:1.55}
.section-stack{display:flex;flex-direction:column;gap:16px}
.section-divider{
  height:1px;
  background:linear-gradient(90deg, transparent, var(--border), transparent);
}
.section-subtitle{
  font-size:12px;
  font-weight:700;
  letter-spacing:.08em;
  text-transform:uppercase;
  color:var(--muted2);
  margin:0 0 2px;
}
.two-col{grid-template-columns:repeat(2,minmax(0,1fr))}
.three-col{grid-template-columns:repeat(3,minmax(0,1fr))}
.wide-col{grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr)}
.btn{
  appearance:none;
  border:1px solid var(--border);
  background:var(--btnBg);
  color:var(--text);
  border-radius:14px;
  padding:10px 14px;
  font-weight:670;
  cursor:pointer;
  transition:background .18s ease,border-color .18s ease,transform .18s ease,box-shadow .18s ease;
}
.btn:hover{background:var(--btnBgHover);border-color:rgba(var(--accentRgb),.22);transform:translateY(-1px)}
.btn.primary{
  background:linear-gradient(135deg, var(--accent), var(--accentHi));
  color:#18120a;
  border-color:transparent;
  box-shadow:0 12px 30px rgba(var(--accentRgb),.22);
}
.btn.primary:hover{filter:saturate(1.03) brightness(1.02)}
.btn.danger{
  background:rgba(255,95,122,.11);
  border-color:rgba(255,95,122,.28);
  color:#ffdbe2;
}
:root[data-theme="light"] .btn.danger{color:#c02749}
.btn.ghost{background:transparent}
.input,textarea,select{
  width:100%;
  padding:11px 13px;
  border-radius:14px;
  border:1px solid var(--border);
  background:var(--inputBg);
  color:var(--text);
  outline:none;
  transition:border-color .18s ease,box-shadow .18s ease,background .18s ease;
}
.input:hover,textarea:hover,select:hover{border-color:rgba(var(--accentRgb),.20)}
.input:focus,textarea:focus,select:focus{
  border-color:rgba(var(--accentRgb),.58);
  box-shadow:0 0 0 4px rgba(var(--accentRgb),.14);
}
label{
  display:block;
  margin:12px 0 6px;
  font-size:12px;
  font-weight:650;
  color:var(--muted);
}
textarea{
  min-height:380px;
  font-family:var(--mono);
  font-size:13px;
  line-height:1.5;
  resize:vertical;
}
.pill{
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:7px 10px;
  border-radius:999px;
  border:1px solid var(--border);
  background:var(--surface1);
  color:var(--muted);
  font-size:12px;
}
.pill.warn{
  border-color:rgba(var(--accentRgb),.42);
  background:rgba(var(--accentRgb),.10);
  color:var(--text);
}
.pill.ok{
  border-color:rgba(47,194,139,.34);
  background:rgba(47,194,139,.10);
  color:var(--text);
}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}
.tab{
  padding:8px 11px;
  border-radius:12px;
  border:1px solid var(--border);
  background:var(--surface1);
  cursor:pointer;
}
.tab[aria-selected="true"]{
  background:rgba(var(--accentRgb),.14);
  border-color:rgba(var(--accentRgb),.45);
  color:var(--text);
}
.toast{
  position:fixed;
  right:18px;
  bottom:18px;
  min-width:240px;
  max-width:420px;
  z-index:20;
}
.toast .msg{margin-top:10px}
.msg{
  padding:12px 13px;
  border-radius:14px;
  border:1px solid var(--border);
  background:var(--msgBg);
  line-height:1.5;
}
.msg.ok{border-color:rgba(47,194,139,.34)}
.msg.err{border-color:rgba(255,95,122,.34)}
.list{
  display:flex;
  flex-direction:column;
  gap:10px;
  max-height:520px;
  overflow:auto;
  padding-right:6px;
}
.item{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  padding:12px 14px;
  border-radius:14px;
  border:1px solid var(--border);
  background:var(--surface1);
}
.item .meta{color:var(--muted);font-size:12px}
.chat-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;max-height:none;padding-right:0}
.chat-card{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(220px,260px);
  gap:16px;
  align-items:start;
  padding:16px;
  border-radius:18px;
  border:1px solid var(--border);
  background:linear-gradient(180deg, var(--surface1), var(--surface2));
  box-shadow:var(--shadowSoft);
}
.chat-main{min-width:0}
.chat-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.chat-name{font-weight:760}
.chat-sub{margin-top:8px;color:var(--muted);font-size:12px;line-height:1.6}
.chat-tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.chat-actions{display:flex;flex-direction:column;gap:10px;align-items:stretch}
.chat-actions .row{justify-content:flex-end}
.chat-actions .btn,.chat-actions .input{width:100%}
.k,.mono{font-family:var(--mono);font-size:12px;color:var(--kText)}
.mono{white-space:pre-wrap}
details.details{
  border:1px solid var(--border);
  background:var(--surface1);
  border-radius:14px;
  padding:10px 12px;
}
details.details > summary{
  cursor:pointer;
  list-style:none;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}
details.details > summary::-webkit-details-marker{display:none}
.details-title{font-weight:700}
.details-meta{color:var(--muted);font-size:12px}
.details-body{margin-top:10px}
.details-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}
.empty-state{
  padding:18px;
  border-radius:18px;
  border:1px dashed var(--border);
  background:linear-gradient(180deg, var(--surface1), transparent);
}
.auth-shell{
  display:grid;
  grid-template-columns:minmax(280px,420px) minmax(0,1fr);
  gap:18px;
  align-items:stretch;
  max-width:1080px;
  margin:28px auto 0;
}
.auth-side,.auth-form{padding:22px}
.auth-title{margin:0;font-size:28px;line-height:1.08;letter-spacing:-.02em}
.auth-note{margin-top:12px}
.auth-pills{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
.auth-form .row{margin-top:16px}
@media (max-width:1200px){
  .status-grid,.shortcut-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:980px){
  .wrap{padding:16px}
  .layout{grid-template-columns:1fr}
  .sidebar{position:static}
  .hero-title{font-size:26px}
  .status-grid,.shortcut-grid,.two-col,.three-col,.wide-col,.grid.cols,.auth-shell{grid-template-columns:1fr}
  .top{padding:14px}
}
@media (max-width:760px){
  .top{flex-direction:column;align-items:flex-start}
  #topActions{width:100%}
  #topActions .row{justify-content:flex-start}
  .hero-card,.section-card,.sidebar-card,.auth-side,.auth-form{padding:18px}
  .chat-card{grid-template-columns:1fr}
  .chat-actions .row{justify-content:stretch}
}
`;
