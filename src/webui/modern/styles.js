export const BASE_CSS = `
:root{
  color-scheme: dark;
  --bg:#0b1020;--panel:#111833;--panel2:#0f1530;--text:#e7ecff;--muted:#9aa6d2;
  --border:rgba(255,255,255,.10);--accent:#ff8a00;--accentRgb:255,138,0;--accentHi:#ffb000;--accent2:#31d0aa;--danger:#ff4d6d;
  --bgSpot1: rgba(var(--accentRgb),.35);
  --bgSpot2: rgba(49,208,170,.25);
  --card1: rgba(255,255,255,.06);
  --card2: rgba(255,255,255,.03);
  --shadow: rgba(0,0,0,.28);
  --logoShadow: rgba(var(--accentRgb),.28);
  --surface1: rgba(0,0,0,.18);
  --navItemBg: rgba(255,255,255,.05);
  --navItemBgHover: rgba(255,255,255,.08);
  --btnBg: rgba(255,255,255,.06);
  --btnBgHover: rgba(255,255,255,.10);
  --inputBg: rgba(0,0,0,.20);
  --msgBg: rgba(0,0,0,.35);
  --kText: #cbd6ff;
  --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
}
:root[data-theme="light"]{
  color-scheme: light;
  --bg:#f6f7ff;--panel:#ffffff;--panel2:#ffffff;--text:#141a33;--muted:#56618a;
  --border:rgba(0,0,0,.12);
  --bgSpot1: rgba(var(--accentRgb),.16);
  --bgSpot2: rgba(49,208,170,.14);
  --card1: rgba(255,255,255,.92);
  --card2: rgba(255,255,255,.78);
  --shadow: rgba(0,0,0,.10);
  --logoShadow: rgba(var(--accentRgb),.18);
  --surface1: rgba(255,255,255,.70);
  --navItemBg: rgba(0,0,0,.03);
  --navItemBgHover: rgba(0,0,0,.06);
  --btnBg: rgba(0,0,0,.03);
  --btnBgHover: rgba(0,0,0,.06);
  --inputBg: rgba(255,255,255,.92);
  --msgBg: rgba(255,255,255,.72);
  --kText: #2b335d;
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;font-family:var(--sans);background:
  radial-gradient(1200px 600px at 10% -10%, var(--bgSpot1), transparent 60%),
  radial-gradient(900px 500px at 110% 0%, var(--bgSpot2), transparent 55%),
  var(--bg);
  color:var(--text);
}
a{color:inherit}
.wrap{max-width:1100px;margin:0 auto;padding:24px}
.top{
  display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px
}
.brand{display:flex;align-items:center;gap:10px}
.logo{
  width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--accent),var(--accentHi));
  box-shadow:0 12px 40px var(--logoShadow)
}
.title{font-weight:700;letter-spacing:.2px}
.sub{color:var(--muted);font-size:13px}
.card{
  background:linear-gradient(180deg, var(--card1), var(--card2));
  border:1px solid var(--border);border-radius:16px;padding:16px;
  box-shadow:0 18px 50px var(--shadow);
}
.grid{display:grid;gap:16px}
.grid.cols{grid-template-columns: 1.3fr .7fr}
@media (max-width: 900px){.grid.cols{grid-template-columns:1fr}}
.layout{display:grid;grid-template-columns:260px 1fr;gap:16px;align-items:start}
@media (max-width: 980px){.layout{grid-template-columns:1fr}}
.sidebar{position:sticky;top:16px;align-self:start}
@media (max-width: 980px){.sidebar{position:static}}
.nav{display:flex;flex-direction:column;gap:10px}
.nav details{border:1px solid var(--border);background:var(--surface1);border-radius:14px;padding:10px 10px}
.nav details > summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--muted);font-size:13px}
.nav details > summary::-webkit-details-marker{display:none}
.nav .nav-item{width:100%;text-align:left}
.nav-item{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:10px 12px;border-radius:12px;border:1px solid var(--border);
  background:var(--navItemBg);color:var(--text);cursor:pointer;font-weight:650;
}
.nav-item:hover{background:var(--navItemBgHover)}
.nav-item[aria-current="page"]{background:rgba(var(--accentRgb),.14);border-color:rgba(var(--accentRgb),.45)}
.main-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.view{display:none}
.view.active{display:block}
.section{margin-top:12px}
.section h3{margin:0 0 10px;font-size:15px}
.row{display:flex;gap:10px;flex-wrap:wrap}
.btn{
  appearance:none;border:1px solid var(--border);background:var(--btnBg);
  color:var(--text);border-radius:12px;padding:10px 12px;font-weight:600;cursor:pointer;
}
.btn:hover{background:var(--btnBgHover)}
.btn.primary{background:linear-gradient(135deg,var(--accent),var(--accentHi));border-color:transparent}
.btn.danger{background:rgba(255,77,109,.12);border-color:rgba(255,77,109,.35);color:#ffd5dd}
.btn.ghost{background:transparent}
.input, textarea{
  width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--border);
  background:var(--inputBg);color:var(--text);outline:none;
}
.input:focus, textarea:focus{border-color:rgba(var(--accentRgb),.62);box-shadow:0 0 0 3px rgba(var(--accentRgb),.18)}
label{display:block;font-size:12px;color:var(--muted);margin:12px 0 6px}
textarea{min-height:380px;font-family:var(--mono);font-size:13px;line-height:1.35;resize:vertical}
.pill{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;border:1px solid var(--border);
  background:var(--surface1);color:var(--muted);font-size:12px
}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}
.tab{padding:8px 10px;border-radius:12px;border:1px solid var(--border);background:var(--surface1);cursor:pointer}
.tab[aria-selected="true"]{background:rgba(var(--accentRgb),.14);border-color:rgba(var(--accentRgb),.45);color:var(--text)}
.toast{position:fixed;right:18px;bottom:18px;min-width:240px;max-width:420px;z-index:20}
.toast .msg{margin-top:10px}
.msg{padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:var(--msgBg)}
.msg.ok{border-color:rgba(49,208,170,.45)}
.msg.err{border-color:rgba(255,77,109,.45)}
.list{display:flex;flex-direction:column;gap:8px;max-height:420px;overflow:auto;padding-right:6px}
.item{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:var(--surface1)}
.item .meta{color:var(--muted);font-size:12px}
.k{font-family:var(--mono);font-size:12px;color:var(--kText)}
details.details{border:1px solid var(--border);background:var(--surface1);border-radius:12px;padding:10px 12px}
details.details > summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px}
details.details > summary::-webkit-details-marker{display:none}
.details-title{font-weight:700}
.details-meta{color:var(--muted);font-size:12px}
.details-body{margin-top:10px}
.details-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}
`;
