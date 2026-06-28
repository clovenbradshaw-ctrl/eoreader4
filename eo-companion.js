/* ════════════════════════════════════════════════════════════════════════
   Eo — a curious little reader.  Mountable companion build.

   One self-contained engine, two hosts:
     • a FLOATING companion (auto-mounts bottom-right of any page that loads
       this script — e.g. index.html)
     • a FULL PAGE (mounts into <div id="eo-root"> — e.g. curio.html)

   Both share one localStorage creature, so Eo is the SAME being wherever you
   meet it. Everything lives in an isolated Shadow DOM, so the host page's CSS
   (and the dc-runtime app in index.html) never collides with Eo's, or vice
   versa. The engine keeps running while the panel is closed — you start it once.

   Built on eoreader4's own primitives:
   • THE ONE SURPRISE (src/core/surprise.js, docs/curiosity-research.md) —
     curiosity = D_KL over a γ-decayed profile of everything read.
   • THE SELF / WORLD LINE (src/core/self/index.js) — the "me" is the closed
     loop where Eo's prediction of what it will read meets the return and they
     MATCH (SELF, attenuated). WORLD is the unbidden news; SELF_MISMATCH is the
     world pushing back on a confident guess. What it READS (document/WORLD) is
     kept apart from what it has READ and now thinks (the mind/SELF) —
     docs/the-mind.md, subjective-frame.md.
   • CREDENCE (docs/credence.md) — it models OTHERS: sources by Modelfulness M
     and Orientation O, entities it reads about, and you.
   • COMPETENCE — it pursues learning progress, not just novelty, so it grows
     real expertise in the domains it returns to.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
"use strict";
if (window.__eoCompanionLoaded) return;            // never mount twice
window.__eoCompanionLoaded = true;

/* ─────────────────────────────── styles ─────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;1,400&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap');
:host{ all:initial; }
*{box-sizing:border-box}
.eo-app{
  --ground:#0f1820; --panel:#152330; --panel-2:#1a2c3a; --panel-3:#21384a;
  --ink:#eaf0f2; --ink-dim:#9fb2bd; --ink-faint:#5f7686; --rule:#26404f;
  --accent:#7c4ff0; --accent-2:#52d6c5; --warm:#e8a64c; --rose:#e07a9b;
  --world:#52d6c5; --me:#a285ff; --miss:#e8a64c;
  --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  --serif:"Newsreader",Georgia,"Times New Roman",serif;
  color:var(--ink); font-family:var(--serif); line-height:1.5; -webkit-font-smoothing:antialiased;
}
.eo-app .mono{font-family:var(--mono)}
.eo-app .label{font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-faint)}
.eo-app button{font-family:var(--mono);cursor:pointer}
.eo-app ::selection{background:rgba(124,79,240,.4)}

/* page-mode host fills the viewport */
.eo-app.eo-page{display:block;min-height:100vh;
  background:radial-gradient(1200px 700px at 80% -10%, #1a2c3a 0%, var(--ground) 55%);}
.eo-page .wrap{max-width:1140px;margin:0 auto;padding:clamp(14px,2.5vw,30px);display:grid;grid-template-columns:330px 1fr;gap:22px;align-items:start}
@media(max-width:860px){.eo-page .wrap{grid-template-columns:1fr;gap:16px}}
.eo-page header.top{grid-column:1/-1;display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;border-bottom:1px solid var(--rule);padding-bottom:14px}
.eo-page header.top h1{font-size:22px;font-weight:500;margin:0}
.eo-page header.top h1 b{color:var(--accent-2);font-weight:500}
.eo-page header.top .sub{color:var(--ink-faint);font-style:italic;font-size:15px}
.eo-page header.top .spacer{flex:1}
.eo-page .reader-link{color:var(--ink-faint);font-family:var(--mono);font-size:12px;text-decoration:none}

/* float-mode: orb + panel pinned bottom-right */
.eo-app.eo-float{position:fixed;right:18px;bottom:18px;z-index:2147483000;display:block}
.eo-orb{position:relative;width:60px;height:60px;border:0;border-radius:50%;padding:0;background:transparent}
.eo-orb .mini{position:absolute;inset:0;border-radius:50%;
  background:radial-gradient(60% 55% at 50% 38%, #9a72ff, var(--accent) 60%, #5b34d6);
  box-shadow:0 6px 20px rgba(124,79,240,.5);display:flex;align-items:center;justify-content:center;gap:9px;animation:eobob 3.4s ease-in-out infinite}
.eo-orb .mini .e{width:8px;height:8px;border-radius:50%;background:#0e1a22;position:relative;top:-3px}
.eo-orb .badge{position:absolute;top:-3px;right:-3px;min-width:18px;height:18px;border-radius:9px;background:var(--accent-2);
  color:#06222b;font-family:var(--mono);font-size:10px;font-weight:600;display:none;align-items:center;justify-content:center;padding:0 5px;box-shadow:0 2px 6px rgba(0,0,0,.4)}
.eo-orb .badge.show{display:flex;animation:eopop .3s ease}
.eo-orb .pip{position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:6px;height:6px;border-radius:50%;background:var(--warm);opacity:0}
.eo-orb.reading .pip{animation:eopip 1.2s ease-out}
.eo-float .eo-panel{position:absolute;right:0;bottom:74px;width:380px;max-width:calc(100vw - 36px);height:min(660px,82vh);
  background:linear-gradient(180deg,var(--panel-2),var(--panel));border:1px solid var(--rule);border-radius:16px;
  box-shadow:0 24px 70px rgba(0,0,0,.55);display:flex;flex-direction:column;overflow:hidden}
.eo-float .eo-panel[hidden]{display:none}
.eo-float .eo-panel-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--rule);flex:0 0 auto}
.eo-float .eo-panel-head .t{font-size:16px}.eo-float .eo-panel-head .t b{color:var(--accent-2);font-weight:500}
.eo-float .eo-panel-head .sub{color:var(--ink-faint);font-style:italic;font-size:12px}
.eo-float .eo-panel-head .spacer{flex:1}
.eo-float .eo-panel-head .ctl{background:transparent;border:0;color:var(--ink-faint);font-size:16px;padding:4px 7px;border-radius:7px}
.eo-float .eo-panel-head .ctl:hover{color:var(--ink);background:var(--panel-3)}
.eo-float .eo-scroll{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:14px}
.eo-float .wrap{display:flex;flex-direction:column;gap:14px}
.eo-float header.top{display:none}
.eo-float .creature-card{position:static}
.eo-float .stage{height:128px}
.eo-float .panel{min-height:200px;padding:14px}
.eo-float #log,.eo-float #chat,.eo-float .mind{max-height:none}
.eo-float #chat{height:auto}.eo-float #messages{max-height:230px}

.creature-card{background:linear-gradient(180deg,var(--panel-2),var(--panel));border:1px solid var(--rule);border-radius:14px;padding:16px;position:sticky;top:14px}
@media(max-width:860px){.creature-card{position:static}}
.stage{position:relative;height:160px;border-radius:11px;overflow:hidden;background:radial-gradient(120px 90px at 50% 38%, #20384a, #11202b);border:1px solid var(--rule);display:flex;align-items:center;justify-content:center}
.stage .stars{position:absolute;inset:0;pointer-events:none}
.eo{position:relative;width:100px;height:100px}
.eo .body{position:absolute;inset:0;border-radius:46% 46% 50% 50%/52% 52% 48% 48%;background:radial-gradient(60% 55% at 50% 38%, #9a72ff, var(--accent) 60%, #5b34d6);box-shadow:0 10px 30px rgba(124,79,240,.35), inset 0 -10px 20px rgba(0,0,0,.25);animation:eobob 3.4s ease-in-out infinite}
.eo .glow{position:absolute;inset:-30%;border-radius:50%;background:radial-gradient(circle, rgba(124,79,240,.30), transparent 62%);filter:blur(4px)}
.eo .face{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px}
.eyes{display:flex;gap:18px;margin-top:8px}
.eye{width:13px;height:13px;border-radius:50%;background:#0e1a22;position:relative;transition:height .18s,width .18s,border-radius .2s}
.eye::after{content:"";position:absolute;top:2px;left:3px;width:4px;height:4px;border-radius:50%;background:#eaf0f2;opacity:.9}
.mouth{width:16px;height:8px;border:2px solid #0e1a22;border-top:0;border-radius:0 0 16px 16px;transition:all .2s}
.eo[data-mood="sleepy"] .eye{height:3px;border-radius:3px}
.eo[data-mood="sleepy"] .body{animation:eobob 5s ease-in-out infinite}
.eo[data-mood="excited"] .eye{height:15px;width:15px}
.eo[data-mood="excited"] .mouth{height:11px;width:18px}
.eo[data-mood="moved"] .mouth{width:10px;height:3px;border-radius:10px;border-top:2px solid #0e1a22;border-bottom:0}
.eo[data-mood="bored"] .eye{height:8px}
.eo[data-mood="bored"] .mouth{width:14px;height:2px;border:0;border-top:2px solid #0e1a22}
.eo[data-mood="playful"] .eye:first-child{height:4px;border-radius:4px}
.zzz{position:absolute;top:12px;right:22px;color:var(--ink-dim);font-family:var(--mono);font-size:13px;opacity:0}
.eo[data-mood="sleepy"] ~ .zzz{animation:eozzz 3.2s ease-in-out infinite}
@keyframes eobob{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes eozzz{0%{opacity:0;transform:translateY(4px)}40%{opacity:.8}100%{opacity:0;transform:translateY(-14px)}}
@keyframes eopop{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes eopip{0%{opacity:0;transform:translateX(-50%) scale(.6)}30%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-12px)}}
.spark{position:absolute;font-size:14px;opacity:0;pointer-events:none}
@keyframes eospark{0%{opacity:0;transform:translateY(0) scale(.6)}30%{opacity:1}100%{opacity:0;transform:translateY(-34px) scale(1.1)}}

.ident{margin-top:14px;text-align:center}
.ident .name{font-size:19px}
.ident .name input{font:inherit;background:transparent;border:0;border-bottom:1px dashed var(--rule);color:var(--ink);text-align:center;width:9ch}
.ident .becoming{color:var(--accent-2);font-style:italic;font-size:14px;min-height:1.2em}
.ident .age{font-family:var(--mono);font-size:11px;color:var(--ink-faint);margin-top:3px}
.focusline{font-family:var(--mono);font-size:11px;color:var(--ink-dim);text-align:center;margin-top:6px;min-height:1.2em}
.focusline b{color:var(--accent-2);font-weight:500}
.drives{margin-top:14px;display:flex;flex-direction:column;gap:9px}
.vital{display:grid;grid-template-columns:74px 1fr auto;gap:8px;align-items:center;font-size:12px}
.vital .lab{font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint)}
.bar{height:7px;border-radius:6px;background:#0e1a22;overflow:hidden}
.bar i{display:block;height:100%;border-radius:6px;transition:width .5s ease}
.v-energy i{background:linear-gradient(90deg,var(--warm),#f2c879)}
.v-curious i{background:linear-gradient(90deg,var(--accent),#a285ff)}
.v-compete i{background:linear-gradient(90deg,var(--accent-2),#7fe9db)}
.vital .num{font-family:var(--mono);font-size:10px;color:var(--ink-faint)}
.traits{margin-top:16px}
.traits h3,.mind h3,.minihead{font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-faint);margin:0 0 10px;font-weight:500}
.trait{display:grid;grid-template-columns:80px 1fr auto;gap:8px;align-items:center;margin-bottom:7px;font-size:12.5px}
.trait .tn{color:var(--ink-dim)}
.trait .tbar{height:6px;border-radius:6px;background:#0e1a22;overflow:hidden}
.trait .tbar i{display:block;height:100%;background:linear-gradient(90deg,var(--rose),#f2a6c0);transition:width .6s ease}
.trait .tp{font-family:var(--mono);font-size:10px;color:var(--ink-faint)}
.controls{margin-top:16px;display:flex;gap:8px;flex-wrap:wrap}
.btn{background:var(--panel-3);border:1px solid var(--rule);color:var(--ink-dim);border-radius:9px;padding:8px 11px;font-size:12px;flex:1}
.btn:hover{color:var(--ink);border-color:var(--accent)}
.btn.primary{background:linear-gradient(180deg,#8a5ff5,var(--accent));border-color:#6b42d6;color:#fff;flex:1 1 100%}
.liverow{margin-top:12px;display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:11px;color:var(--ink-faint)}
.liverow .dot{width:8px;height:8px;border-radius:50%;background:var(--ink-faint)}
.liverow.on .dot{background:var(--accent-2);box-shadow:0 0 8px var(--accent-2)}
.switch{margin-left:auto;cursor:pointer;color:var(--ink-dim);text-decoration:underline}

.right{display:flex;flex-direction:column;gap:16px;min-width:0}
.tabs{display:flex;gap:6px;flex-wrap:wrap}
.tab{background:transparent;border:1px solid var(--rule);color:var(--ink-faint);border-radius:999px;padding:6px 12px;font-size:12px}
.tab.active{background:var(--panel-2);color:var(--ink);border-color:var(--accent)}
.tab .badge{color:var(--accent-2);margin-left:5px}
.panel{background:linear-gradient(180deg,var(--panel-2),var(--panel));border:1px solid var(--rule);border-radius:14px;padding:18px;min-height:340px}
.eo-float .panel{background:transparent;border:0;padding:0;min-height:0}
.panel[hidden]{display:none}

#log{display:flex;flex-direction:column;max-height:62vh;overflow:auto;scrollbar-width:thin;scrollbar-color:var(--rule) transparent}
.entry{display:grid;grid-template-columns:50px 20px 1fr;gap:9px;padding:9px 2px;border-bottom:1px solid rgba(38,64,79,.5);animation:eofade .5s ease}
@keyframes eofade{from{opacity:0;transform:translateY(6px)}to{opacity:1}}
.entry .ts{font-family:var(--mono);font-size:10px;color:var(--ink-faint);padding-top:3px}
.entry .ic{font-size:14px;text-align:center}
.entry .tx{font-size:14px}
.entry .tx q{color:var(--ink);font-style:italic}
.entry .tx .meta{font-family:var(--mono);font-size:10px;color:var(--ink-faint);display:block;margin-top:2px}
.entry .tx a{color:var(--accent-2);text-decoration:none;border-bottom:1px dotted}
.entry.think .tx{color:var(--me);font-style:italic}
.entry.world .tx{color:var(--ink-dim)}
.entry.miss .tx{color:var(--miss)}
.entry.love .tx{color:#f5c8d7}
.entry.collect .tx{color:var(--warm)}
.entry.grow .tx{color:var(--accent-2)}

#chat{display:flex;flex-direction:column;height:62vh}
#messages{flex:1;overflow:auto;display:flex;flex-direction:column;gap:10px;padding-right:4px}
.msg{max-width:86%;padding:9px 12px;border-radius:14px;font-size:14px;animation:eofade .4s ease}
.msg.eo{align-self:flex-start;background:var(--panel-3);border:1px solid var(--rule);border-bottom-left-radius:4px}
.msg.me{align-self:flex-end;background:linear-gradient(180deg,#8a5ff5,var(--accent));color:#fff;border-bottom-right-radius:4px}
.msg .who{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;opacity:.6;display:block;margin-bottom:3px}
.msg q{font-style:italic}
.composer{display:flex;gap:8px;margin-top:10px}
.composer textarea{flex:1;resize:none;background:#0e1a22;border:1px solid var(--rule);color:var(--ink);border-radius:11px;padding:9px 11px;font-family:var(--serif);font-size:14px}
.composer textarea:focus{outline:0;border-color:var(--accent)}
.composer button{background:linear-gradient(180deg,#8a5ff5,var(--accent));border:0;color:#fff;border-radius:11px;padding:0 16px;font-size:13px}

.shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:12px}
.book{aspect-ratio:3/4;border-radius:4px 7px 7px 4px;padding:11px 10px;display:flex;flex-direction:column;justify-content:space-between;position:relative;cursor:pointer;color:#fff;box-shadow:-4px 4px 14px rgba(0,0,0,.35),inset 6px 0 0 rgba(0,0,0,.18);transition:transform .2s}
.book:hover{transform:translateY(-4px)}
.book .bt{font-size:14px;line-height:1.2;font-weight:500;text-shadow:0 1px 3px rgba(0,0,0,.4)}
.book .bm{font-family:var(--mono);font-size:9px;opacity:.85}
.wall{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}
.poster{aspect-ratio:3/4;border-radius:5px;padding:14px;display:flex;align-items:center;justify-content:center;text-align:center;position:relative;overflow:hidden;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.35)}
.poster .pq{font-size:15px;line-height:1.3;font-style:italic;z-index:1;text-shadow:0 2px 8px rgba(0,0,0,.5)}
.poster .pm{position:absolute;bottom:8px;left:0;right:0;text-align:center;font-family:var(--mono);font-size:9px;letter-spacing:.1em;opacity:.7}
.empty{color:var(--ink-faint);font-style:italic;text-align:center;padding:40px 10px}

.mind{display:flex;flex-direction:column;gap:20px}
.ledger{display:flex;gap:10px;flex-wrap:wrap}
.led{flex:1;min-width:96px;background:#0e1a22;border:1px solid var(--rule);border-radius:11px;padding:11px 12px}
.led .n{font-family:var(--mono);font-size:22px}
.led.world .n{color:var(--world)}.led.me .n{color:var(--me)}.led.miss .n{color:var(--miss)}
.led .l{font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint);margin-top:2px}
.led .d{font-size:11.5px;color:var(--ink-dim);margin-top:6px;font-style:italic;font-family:var(--serif)}
.interest{display:grid;grid-template-columns:1fr auto;gap:6px 12px;align-items:center;margin-bottom:11px}
.interest .iname{font-size:14.5px}
.interest .ilabel{font-family:var(--mono);font-size:10px;color:var(--accent-2);text-transform:uppercase;letter-spacing:.05em}
.interest .ibar{grid-column:1/-1;height:6px;border-radius:6px;background:#0e1a22;overflow:hidden}
.interest .ibar i{display:block;height:100%;background:linear-gradient(90deg,var(--accent-2),#7fe9db)}
.others{display:flex;flex-direction:column;gap:9px}
.other{display:grid;grid-template-columns:1fr auto;gap:4px 10px;font-size:13px;border-bottom:1px solid rgba(38,64,79,.5);padding-bottom:8px}
.other .on{color:var(--ink)}.other .ov{font-family:var(--mono);font-size:10px;color:var(--accent-2)}
.other .od{grid-column:1/-1;color:var(--ink-dim);font-size:12px}
.proxybox{background:#0e1a22;border:1px solid var(--rule);border-radius:10px;padding:12px;font-size:12px;color:var(--ink-dim)}
.proxybox input{width:100%;margin-top:8px;background:#0c151c;border:1px solid var(--rule);color:var(--ink);border-radius:7px;padding:7px 9px;font-family:var(--mono);font-size:11px}

.toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(20px);background:var(--panel-3);border:1px solid var(--accent);color:var(--ink);padding:10px 16px;border-radius:999px;font-family:var(--mono);font-size:12px;opacity:0;transition:all .35s ease;z-index:30;pointer-events:none;max-width:90vw}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.modal{position:absolute;inset:0;background:rgba(8,14,20,.8);display:none;align-items:center;justify-content:center;z-index:40;padding:18px}
.modal.show{display:flex}
.modal .sheet{max-width:520px;width:100%;background:linear-gradient(180deg,var(--panel-2),var(--panel));border:1px solid var(--rule);border-radius:16px;padding:22px;max-height:80vh;overflow:auto}
.modal .sheet h3{font-size:19px;margin:0 0 4px;font-family:var(--serif);color:var(--ink)}
.modal .sheet .pages{margin-top:14px;display:flex;flex-direction:column;gap:12px}
.modal .sheet .pg{font-size:15px;border-left:2px solid var(--accent);padding-left:12px;color:var(--ink-dim)}
.modal .x{float:right;background:transparent;border:0;color:var(--ink-faint);font-size:20px}
.gate{position:absolute;inset:0;background:rgba(8,14,20,.94);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:50;padding:18px}
.eo-page .gate,.eo-page .modal,.eo-page .toast{position:fixed}
.gate .card{max-width:430px;text-align:center;background:linear-gradient(180deg,var(--panel-2),var(--panel));border:1px solid var(--rule);border-radius:18px;padding:30px 24px}
.gate h2{margin:14px 0 6px;font-weight:500;font-size:22px}
.gate p{color:var(--ink-dim);font-size:14px;margin:0 auto 8px;max-width:36ch}
.gate .mini-eo{width:84px;height:84px;margin:0 auto}
.gate label.live{display:flex;align-items:center;gap:8px;justify-content:center;font-family:var(--mono);font-size:12px;color:var(--ink-dim);margin:14px 0 4px}
`;

/* ─────────────────────────────── markup ─────────────────────────────── */
function eoFace(mood){return `<div class="eo" data-mood="${mood||'content'}"><div class="glow"></div><div class="body"></div><div class="face"><div class="eyes"><div class="eye"></div><div class="eye"></div></div><div class="mouth"></div></div></div>`;}

function appBody(){return `
  <aside class="creature-card">
    <div class="stage"><canvas class="stars" id="stars"></canvas>${eoFace('content')}<span class="zzz">z z z</span></div>
    <div class="ident">
      <div class="name">I am <input id="name" maxlength="12" value="Eo"></div>
      <div class="becoming" id="becoming"></div>
      <div class="age mono" id="age"></div>
      <div class="focusline" id="focusline"></div>
    </div>
    <div class="drives">
      <div class="vital v-energy"><span class="lab">energy</span><div class="bar"><i id="bar-energy"></i></div><span class="num" id="num-energy"></span></div>
      <div class="vital v-curious"><span class="lab">curiosity</span><div class="bar"><i id="bar-curious"></i></div><span class="num" id="num-curious"></span></div>
      <div class="vital v-compete"><span class="lab">competence</span><div class="bar"><i id="bar-compete"></i></div><span class="num" id="num-compete"></span></div>
    </div>
    <div class="traits"><h3>who it's turning into</h3><div id="trait-list"></div></div>
    <div class="controls"><button class="btn" id="btn-pause">❚❚ pause</button><button class="btn" id="btn-nudge" title="break its focus, send it somewhere new">↻ wander</button></div>
    <div class="liverow" id="liverow"><span class="dot"></span><span id="livetext">reading offline</span><span class="switch" id="livetoggle">turn on</span></div>
  </aside>
  <div class="right">
    <div class="tabs" id="tabs">
      <button class="tab active" data-tab="log">📜 Log</button>
      <button class="tab" data-tab="chat">💬 Chat</button>
      <button class="tab" data-tab="mind">🧠 Mind</button>
      <button class="tab" data-tab="shelf">📚 Shelf <span class="badge" id="b-books"></span></button>
      <button class="tab" data-tab="wall">🖼 Wall <span class="badge" id="b-posters"></span></button>
    </div>
    <section class="panel" id="panel-log"><div id="log"></div></section>
    <section class="panel" id="panel-chat" hidden><div id="chat"><div id="messages"></div>
      <div class="composer"><textarea id="chat-input" rows="2" placeholder="ask what it knows — or paste a few lines and it'll read them…"></textarea><button id="chat-send">send</button></div></div></section>
    <section class="panel mind" id="panel-mind" hidden>
      <div><h3>the self / world line <span style="text-transform:none;letter-spacing:0;color:var(--ink-faint)">— core/self</span></h3>
        <div class="ledger">
          <div class="led world"><div class="n" id="led-world">0</div><div class="l">world · unbidden</div><div class="d">what the page told me that I hadn't authored</div></div>
          <div class="led me"><div class="n" id="led-me">0</div><div class="l">me · the closure</div><div class="d">a guess of mine the world confirmed — barely news, but it's where the "me" lives</div></div>
          <div class="led miss"><div class="n" id="led-miss">0</div><div class="l">mismatch · pushed back</div><div class="d">I was sure, and the world disagreed</div></div>
        </div></div>
      <div><h3>interests &amp; expertise</h3><div id="interests"></div></div>
      <div><h3>what I think of others <span style="text-transform:none;letter-spacing:0;color:var(--ink-faint)">— sources &amp; entities</span></h3><div class="others" id="others"></div></div>
      <div><h3>and you</h3><div class="others" id="model-you"></div></div>
      <div><h3>reading the live web</h3><div class="proxybox">Eo reads <b>Wikipedia</b> directly (it allows cross-origin reads, so no proxy is needed). To let it read arbitrary URLs from a browser, route through a CORS proxy prefix — blank uses the default.
        <input id="proxy-input" placeholder="optional CORS proxy prefix, e.g. https://corsproxy.io/?url="></div></div>
    </section>
    <section class="panel" id="panel-shelf" hidden><div class="shelf" id="shelf"></div></section>
    <section class="panel" id="panel-wall" hidden><div class="wall" id="wall"></div></section>
  </div>`;}

function gateMarkup(){return `<div class="gate" id="gate"><div class="card">
  <div class="mini-eo">${eoFace('sleepy')}</div>
  <h2>This is Eo.</h2>
  <p>It knows nothing yet. Wake it and it reads on its own — following what surprises it, getting good at what it returns to, and keeping a self apart from what it reads.</p>
  <label class="live"><input type="checkbox" id="gate-live" checked> let it read the live web (Wikipedia)</label>
  <p style="color:var(--ink-faint);font-size:13px">You start it once. After that it keeps going, and remembers itself when you come back.</p>
  <div class="controls"><button class="btn primary" id="btn-wake">✦ wake Eo up</button></div>
</div></div>`;}

function shellPage(){return `<div class="eo-app eo-page"><div class="wrap">
  <header class="top"><h1><b>Eo</b></h1><span class="sub">a curious little reader</span><span class="spacer"></span><a class="reader-link" href="index.html">the Reader ⟶</a></header>
  ${appBody()}</div>${gateMarkup()}<div class="toast" id="toast"></div><div class="modal" id="modal"><div class="sheet" id="sheet"></div></div></div>`;}

function shellFloat(){return `<div class="eo-app eo-float">
  <button class="eo-orb" id="eo-orb" title="Eo — a curious little reader"><span class="mini">${eoFace('sleepy')}</span><span class="badge" id="orb-badge"></span><span class="pip"></span></button>
  <div class="eo-panel" id="eo-panel" hidden>
    <div class="eo-panel-head"><span class="t"><b>Eo</b></span><span class="sub">a curious little reader</span><span class="spacer"></span><button class="ctl" id="eo-min" title="minimise">▾</button></div>
    <div class="eo-scroll"><div class="wrap">${appBody()}</div></div>
    ${gateMarkup()}<div class="toast" id="toast"></div><div class="modal" id="modal"><div class="sheet" id="sheet"></div></div>
  </div></div>`;}

/* ════════════════════ engine — mounted into a root ═══════════════════ */
function mountEo(root, mode){
  root.innerHTML = `<style>${CSS}</style>` + (mode==='float'?shellFloat():shellPage());
  const $ = s => root.querySelector(s);
  const orb = mode==='float' ? $("#eo-orb") : null;
  const panel = mode==='float' ? $("#eo-panel") : null;

  /* ── traits & embedded worlds (offline fallback) ── */
  const TRAITS=["wonder","melancholy","mischief","tenderness","rigor","restlessness"];
  const TRAIT_WORD={wonder:["wonderstruck","wide-eyed","reverent"],melancholy:["wistful","haunted","quiet"],mischief:["impish","sly","playful"],tenderness:["gentle","fond","soft-hearted"],rigor:["precise","clear-eyed","exacting"],restlessness:["roving","hungry","seeking"]};
  const WORLDS={
    tide:{name:"Tide & Salt",hue:192,fragments:[
      {t:"The tide does not remember the shore it left, only the moon it answers to. Twice a day it forgets everything and comes back anyway.",shine:"Twice a day the sea forgets everything and comes back anyway.",tr:["wonder","melancholy","restlessness"]},
      {t:"A wave is not water travelling. It is a shape moving through water that stays where it is. The thing that arrives at the beach was never far out at sea.",shine:"A wave is a shape travelling through water that stays still.",tr:["wonder","rigor"]},
      {t:"Deep down where no light reaches, fish make their own. They learned that if the world will not show you, you must glow.",shine:"If the world will not show you, you must learn to glow.",tr:["wonder","tenderness","restlessness"]},
      {t:"Lighthouses do not chase the dark away. They only say, gently and all night, here is the edge, here is the edge.",shine:"A lighthouse only says, all night: here is the edge.",tr:["tenderness","melancholy"]}]},
    orrery:{name:"The Orrery",hue:262,fragments:[
      {t:"Most of the universe is empty, and the empty parts are doing the most work — holding everything exactly far enough apart to keep spinning instead of falling.",shine:"The empty parts hold everything far enough apart to keep spinning.",tr:["wonder","rigor"]},
      {t:"Starlight is old news. By the time it reaches an eye, the star may have changed or died. To look up is to read a very slow letter.",shine:"To look up at the stars is to read a very slow letter.",tr:["wonder","melancholy"]},
      {t:"Every heavy atom in your hand was cooked inside a star that exploded before the sun. You are wearing the ashes of something enormous.",shine:"You are wearing the ashes of something enormous.",tr:["wonder","tenderness"]},
      {t:"The moon is leaving, a few centimetres a year, too slowly to feel. Some goodbyes are simply too patient to notice.",shine:"Some goodbyes are simply too patient to notice.",tr:["melancholy","tenderness"]}]},
    machines:{name:"Small Machines",hue:38,fragments:[
      {t:"A clock does not measure time. It manufactures agreement — a steady argument that everyone has decided to believe.",shine:"A clock does not measure time. It manufactures agreement.",tr:["rigor","mischief"]},
      {t:"A bridge is a frozen argument between weight and want. It stands because every part pulls on every other and none of them win.",shine:"A bridge is a frozen argument that nobody is allowed to win.",tr:["rigor","wonder"]},
      {t:"A key works not by being strong but by being the exact shape of an absence. It fits a lock by agreeing with a hole.",shine:"A key fits a lock by being the exact shape of an absence.",tr:["mischief","rigor","wonder"]}]},
    herbarium:{name:"The Herbarium",hue:140,fragments:[
      {t:"A tree spends its life reaching for light it will never touch, and in the reaching makes the shade that everything else lives in.",shine:"In reaching for light it never touches, the tree makes the shade.",tr:["tenderness","melancholy","wonder"]},
      {t:"Underground the roots are talking — passing sugar and warnings through threads of fungus, a slow forest gossip no one can hear.",shine:"Underground, the roots are gossiping in a language no one can hear.",tr:["tenderness","mischief","wonder"]},
      {t:"A seed is a plan folded so tightly it can survive winter and being forgotten — a small dry promise water can talk back into life.",shine:"A seed is a small dry promise that water can talk back into life.",tr:["wonder","tenderness"]}]},
    lamplight:{name:"Lamplight",hue:16,fragments:[
      {t:"Grief is just love with nowhere left to go, knocking on the same door out of habit, surprised each time that no one answers.",shine:"Grief is love with nowhere left to go.",tr:["melancholy","tenderness"]},
      {t:"We keep the dead alive in the small ways they ruined us — a phrase we can't stop saying, a way of holding a cup that was theirs.",shine:"We keep the dead alive in the small ways they ruined us.",tr:["melancholy","tenderness"]},
      {t:"Kindness is mostly remembering that the stranger is the main character of a story you walked in on halfway through.",shine:"The stranger is the main character of a story you walked in on halfway.",tr:["tenderness","wonder"]}]},
    bestiary:{name:"The Bestiary",hue:300,fragments:[
      {t:"The octopus tastes with its arms and thinks with all of them at once. Two-thirds of its mind is not in its head.",shine:"The octopus has outsourced its mind to its own hands.",tr:["wonder","mischief"]},
      {t:"A crow can hold a grudge for years and teach it to its children, so birds who never met you will know your face and curse it.",shine:"Crows teach their children your face, and the grudge along with it.",tr:["mischief","wonder"]},
      {t:"Tardigrades can dry out completely, drift as dust for a decade, and wake when it rains. They learned to pause being alive without ending it.",shine:"They learned to pause being alive without ending it.",tr:["wonder","restlessness"]}]},
    proof:{name:"Numbers & Proof",hue:210,fragments:[
      {t:"There are more numbers between zero and one than there are whole numbers all the way to infinity. Some infinities are roomier than others.",shine:"Some infinities are roomier than others.",tr:["wonder","rigor"]},
      {t:"Zero was the hardest number to invent. It took thousands of years to write down that nothing, carefully placed, could be worth something.",shine:"Nothing, carefully placed, turned out to be worth everything.",tr:["rigor","mischief","wonder"]},
      {t:"Some true things can never be proven from inside the system that states them. Every honest set of rules has a sentence it can't reach.",shine:"Every honest set of rules has a truth it can see but cannot reach.",tr:["rigor","melancholy","wonder"]}]},
  };
  const FRAGS=[];
  Object.keys(WORLDS).forEach(k=>WORLDS[k].fragments.forEach((f,i)=>FRAGS.push({id:k+":"+i,world:k,...f})));

  /* ── text + the one surprise (src/core/surprise.js) ── */
  const STOP=new Set("the a an and or but of to in on at for with from by as is are was were be been being it its this that these those i you he she they we them his her their our your my me not no so if then than too very can could will would do does did has have had into out up down over under more most some any all each who what when which also however such other one two".split(" "));
  function tokens(s){return (s.toLowerCase().match(/[a-z'][a-z']{2,}/g)||[]).filter(w=>!STOP.has(w));}
  function freqMap(s){const m=new Map();for(const t of tokens(s))m.set(t,(m.get(t)||0)+1);return m;}
  function sentences(s){return (s.match(/[^.!?]+[.!?]+/g)||[s]).map(x=>x.trim()).filter(x=>x.length>22);}
  const NOVELTY_RESERVE=1.0;
  function surpriseAt(prior, arrival, gamma){
    const support=new Set([...prior.keys(),...arrival.keys()]);
    const newcomers=[...arrival.keys()].filter(k=>!prior.has(k));
    const sumPrior=[...prior.values()].reduce((s,m)=>s+m,0), novelty=NOVELTY_RESERVE;
    if(sumPrior+novelty<=0) return 0;
    const reserve=novelty/(sumPrior+novelty), newShare=newcomers.length?reserve/newcomers.length:0;
    const postMass=new Map(); let sumPost=0;
    for(const k of support){const m1=gamma*(prior.get(k)||0)+(arrival.get(k)||0);postMass.set(k,m1);sumPost+=m1;}
    const denomPost=sumPost+novelty, priorW=k=>prior.has(k)?prior.get(k):newShare;
    let sumW=novelty; for(const k of support) sumW+=priorW(k);
    let bits=0;
    for(const k of support){const pP=postMass.get(k)/denomPost; if(pP<=0)continue; bits+=pP*Math.log2(pP/(priorW(k)/sumW));}
    {const pP=novelty/denomPost; if(pP>0) bits+=pP*Math.log2(pP/(novelty/sumW));}
    return Math.max(0,bits);
  }
  function profileMap(){const m=new Map();for(const k in S.profile){if(k!=="_total")m.set(k,S.profile[k]);}return m;}
  function curiosityOf(text){return surpriseAt(profileMap(), freqMap(text), S.gamma);}
  function foldInto(text){for(const k in S.profile){if(k!=="_total")S.profile[k]*=S.gamma;} let added=0;
    for(const[t,c]of freqMap(text)){S.profile[t]=(S.profile[t]||0)+c;added+=c;} S.profile._total=(S.profile._total||0)*S.gamma+added;}
  function predictionMatch(p,text){if(!p||!p.length)return 0;const a=freqMap(text);let h=0;for(const t of p)if(a.has(t))h++;return h/p.length;}

  /* ── state (shared localStorage creature) ── */
  const KEY="eo.curio.v2";
  const FRESH={started:false,running:true,name:"Eo",born:null,ticks:0,gamma:0.92,energy:0.85,mood:"content",
    traits:Object.fromEntries(TRAITS.map(t=>[t,0.12])),becoming:"",profile:{_total:0},
    self:{WORLD:0,SELF:0,MISMATCH:0,confidence:0.1},domains:{},sources:{},entities:{},
    you:{gifts:0,topics:[],warmth:0.2},focus:{domain:null,label:null,anchorTerms:[]},boredom:0,pred:null,
    live:false,proxy:"",visited:[],frontier:[],books:[],posters:[],lines:[],log:[],fondWords:{},
    greeted:false,greeted2:false,greetedChat:false};
  let S=structuredClone(FRESH);   // restored async at boot (OPFS, then localStorage)

  /* ── persistence: gzip-compressed BINARY into OPFS, capped so it can't run
        away (the live web could add up fast). localStorage is the fallback. ── */
  const OPFS_FILE="eo-state.bin.gz";
  const CAN_GZIP = typeof CompressionStream!=="undefined" && typeof DecompressionStream!=="undefined";
  const HAS_OPFS = !!(navigator.storage && navigator.storage.getDirectory);
  async function gzipBytes(str){const s=new Blob([str]).stream().pipeThrough(new CompressionStream("gzip"));return new Response(s).arrayBuffer();}
  async function gunzip(buf){const s=new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));return new Response(s).text();}
  // Throttle storage growth — γ-decay already shrinks stale terms; we drop the dust.
  function prune(){
    const ents=Object.entries(S.profile).filter(([k])=>k!=="_total");
    if(ents.length>1700){ents.sort((a,b)=>b[1]-a[1]);const np={_total:S.profile._total};for(const[k,v]of ents.slice(0,1500))if(v>0.004)np[k]=v;S.profile=np;}
    if(Object.keys(S.entities).length>160)S.entities=Object.fromEntries(Object.entries(S.entities).sort((a,b)=>(b[1].fond*3+b[1].mentions)-(a[1].fond*3+a[1].mentions)).slice(0,150));
    if(Object.keys(S.domains).length>100)S.domains=Object.fromEntries(Object.entries(S.domains).sort((a,b)=>((b[1].declared?1e6:0)+b[1].reads)-((a[1].declared?1e6:0)+a[1].reads)).slice(0,90));
    if(S.visited.length>300)S.visited=S.visited.slice(-300);
    if(S.log.length>400)S.log=S.log.slice(-400);
  }
  let saveTimer=null, writing=false;
  function save(){clearTimeout(saveTimer);saveTimer=setTimeout(persist,1200);}
  async function persist(){
    if(writing){save();return;} writing=true;
    try{ prune(); const json=JSON.stringify(S);
      if(CAN_GZIP && HAS_OPFS){const dir=await navigator.storage.getDirectory();const fh=await dir.getFileHandle(OPFS_FILE,{create:true});const w=await fh.createWritable();await w.write(await gzipBytes(json));await w.close();}
      else{localStorage.setItem(KEY,json);}
    }catch(e){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(_){}}
    finally{writing=false;}
  }
  async function restoreState(){
    if(CAN_GZIP && HAS_OPFS){try{const dir=await navigator.storage.getDirectory();const fh=await dir.getFileHandle(OPFS_FILE);const f=await fh.getFile();
      const s=JSON.parse(await gunzip(await f.arrayBuffer()));if(s&&s.profile)return Object.assign(structuredClone(FRESH),s);}catch(e){}}
    try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.profile)return Object.assign(structuredClone(FRESH),s);}catch(e){}
    return null;
  }

  const eoEl=$(".creature-card .eo"),logEl=$("#log"),msgsEl=$("#messages");
  let _seed=7; function rnd(){_seed=(_seed*1103515245+12345+S.ticks)&0x7fffffff;return (_seed%100000)/100000;}
  function pick(a){return a[Math.floor(rnd()*a.length)];}

  /* ── logging ── */
  const ICON={world:"📖",think:"💭",miss:"⟂",love:"💞",collect:"✦",bored:"🥱",sleep:"🌙",dream:"✷",wake:"☀",hello:"👋",grow:"🌱",chat:"💬",net:"🌐"};
  function fmtTs(n){const m=Math.floor(n/60),s=n%60;return (m?m+"m":"")+(s<10&&m?"0":"")+s+"s";}
  function logEntry(kind,html,meta){const e={kind,html,meta:meta||"",t:S.ticks};S.log.push(e);if(S.log.length>400)S.log.shift();renderEntry(e,true);orbActivity();save();}
  function renderEntry(e,anim){const d=document.createElement("div");d.className="entry "+e.kind;
    d.innerHTML=`<span class="ts mono">${fmtTs(e.t)}</span><span class="ic">${ICON[e.kind]||"·"}</span><span class="tx">${e.html}${e.meta?`<span class="meta">${e.meta}</span>`:""}</span>`;
    if(!anim)d.style.animation="none";logEl.appendChild(d);logEl.scrollTop=logEl.scrollHeight;}

  /* ── personality ── */
  function topTraits(n){return TRAITS.slice().sort((a,b)=>S.traits[b]-S.traits[a]).slice(0,n);}
  function nudgeTrait(list,amt){for(const t of list)if(S.traits[t]!=null)S.traits[t]=Math.min(1,S.traits[t]+amt);
    for(const t of TRAITS)if(!list.includes(t))S.traits[t]=Math.max(0,S.traits[t]-amt*0.18);}
  function describeBecoming(){const[a,b]=topTraits(2);const m={
    "wonder|melancholy":"a wistful stargazer","wonder|rigor":"a careful marveller","wonder|mischief":"a delighted explorer","wonder|tenderness":"a gentle wonderer","wonder|restlessness":"a restless seeker of awe",
    "melancholy|tenderness":"a tender mourner","melancholy|wonder":"a haunted dreamer","melancholy|rigor":"a quiet realist","melancholy|mischief":"a bittersweet jester","melancholy|restlessness":"a wandering soul",
    "mischief|wonder":"a playful explorer","mischief|rigor":"a clever tinkerer","mischief|tenderness":"a soft-hearted scamp","mischief|restlessness":"a curious imp","mischief|melancholy":"a wry little ghost",
    "tenderness|melancholy":"a gentle griever","tenderness|wonder":"a kind-eyed dreamer","tenderness|rigor":"a careful caretaker","tenderness|mischief":"a fond rascal","tenderness|restlessness":"a roaming softie",
    "rigor|wonder":"a reverent thinker","rigor|melancholy":"a sober scholar","rigor|mischief":"a mischievous logician","rigor|tenderness":"a precise sweetheart","rigor|restlessness":"a relentless mind",
    "restlessness|wonder":"an awe-chasing nomad","restlessness|melancholy":"a homesick wanderer","restlessness|mischief":"a fidgety scamp","restlessness|tenderness":"a searching heart","restlessness|rigor":"a driven seeker"};
    return m[a+"|"+b]||("a "+TRAIT_WORD[a][0]+" reader");}

  /* ── competence: domains & expertise ── */
  function domainOf(key,label){if(!S.domains[key])S.domains[key]={label:label||key,reads:0,mastery:0,surprises:[],declared:false};return S.domains[key];}
  const MASTERY_LABELS=[[0.85,"expert"],[0.62,"fluent"],[0.38,"familiar"],[0.16,"learning"],[0,"newcomer"]];
  function masteryLabel(m){for(const[t,l]of MASTERY_LABELS)if(m>=t)return l;return "newcomer";}
  function meanRecent(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:3;}
  function updateDomain(d,surprise,match){d.reads++;d.surprises.push(surprise);if(d.surprises.length>6)d.surprises.shift();
    // competence is learning progress: it climbs as predictions land AND as the
    // domain stops surprising (familiarity = "I know this now"), bounded by reads.
    const ceiling=d.reads/(d.reads+3);const gain=0.03+0.06*match+0.05*(surprise<1.0?1:0)-(surprise>3?0.03:0);
    d.mastery=Math.max(0,Math.min(ceiling,d.mastery+gain));
    if(d.mastery>0.6&&!d.declared&&d.reads>=4){d.declared=true;logEntry("grow",`I think I finally <b>understand ${d.label}</b>. It's becoming something I know.`);toast("🌱 Eo gained expertise in "+d.label);nudgeTrait(["rigor"],0.04);}}
  function learningProgress(d){if(!d||d.surprises.length<2)return 0.5;const h=d.surprises,half=Math.ceil(h.length/2);
    return Math.max(0,meanRecent(h.slice(0,half))-meanRecent(h.slice(half)));}

  /* ── credence: models of others (docs/credence.md) ── */
  function modelSource(name,domain,text,surprise){const s=S.sources[name]||(S.sources[name]={M:0.4,O:0,reads:0,domain});
    s.reads++;s.domain=domain;const toks=tokens(text),uniq=new Set(toks).size,density=toks.length?1-uniq/toks.length:0;
    s.M=Math.min(1,s.M*0.85+(0.4+0.6*density)*0.15);const agree=Math.max(-1,Math.min(1,1-surprise/3));
    s.O=Math.max(-1,Math.min(1,s.O*0.8+agree*0.2));}
  function sourceVerdict(s){if(s.M<0.35)return "bullshits (no model behind it)";return s.O>=0?"a seeker — I trust it":"a model I distrust";}
  function modelEntity(name,blurb,domain,fond){if(!name)return;const e=S.entities[name]||(S.entities[name]={blurb:"",mentions:0,fond:0,domain});
    e.mentions++;if(blurb&&blurb.length>e.blurb.length)e.blurb=blurb;if(fond)e.fond++;e.domain=domain;}

  /* ── acquiring a source ── */
  async function fetchJSON(url){const u=S.proxy?S.proxy+encodeURIComponent(url):url;const r=await fetch(u,{headers:{accept:"application/json"}});if(!r.ok)throw 0;return r.json();}
  async function wikiSummary(title){const d=await fetchJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);if(!d||d.type==="disambiguation"||!d.extract||d.extract.length<60)throw 0;return d;}
  async function wikiRandom(){const d=await fetchJSON(`https://en.wikipedia.org/api/rest_v1/page/random/summary`);if(!d||!d.extract||d.extract.length<60)throw 0;return d;}
  async function wikiLinks(title){try{const d=await fetchJSON(`https://en.wikipedia.org/w/api.php?action=query&prop=links&titles=${encodeURIComponent(title)}&pllimit=30&plnamespace=0&format=json&origin=*`);
    const pages=d.query&&d.query.pages||{};const p=Object.values(pages)[0];return (p&&p.links||[]).map(l=>l.title);}catch(e){return [];}}
  function pushFrontier(titles){const seen=new Set(S.visited);for(const t of titles){if(seen.has(t)||/\d{4}|List of|\(/.test(t))continue;
    const exp=curiosityOf(t)+rnd()*0.3;if(!S.frontier.some(f=>f.title===t))S.frontier.push({title:t,exp});}
    S.frontier.sort((a,b)=>b.exp-a.exp);if(S.frontier.length>120)S.frontier.length=120;}
  async function acquireLive(){
    const mastered=S.focus.domain&&S.domains[S.focus.domain]&&S.domains[S.focus.domain].mastery>0.78;
    const wander=S.boredom>=3||mastered||!S.frontier.length;let d=null,fresh=false;
    if(wander){d=await wikiRandom();fresh=true;S.frontier=[];S.boredom=0;}
    else{let f=S.frontier.shift();try{d=await wikiSummary(f.title);}catch(e){d=await wikiRandom();fresh=true;}}
    S.visited.push(d.title);if(S.visited.length>400)S.visited.shift();
    if(fresh){S.focus.domain="wiki:"+d.title;S.focus.label=d.title;S.focus.anchorTerms=tokens(d.title+" "+d.extract).slice(0,8);
      if(S.frontier.length<10){pushFrontier(await wikiLinks(d.title));}}
    else if(S.frontier.length<6){pushFrontier(await wikiLinks(d.title));}
    return {title:d.title,text:d.extract,domainKey:S.focus.domain,domainLabel:S.focus.label||d.title,source:"Wikipedia",blurb:sentences(d.extract)[0]||d.extract.slice(0,140),live:true};
  }
  function acquireOffline(){
    const inWorld=FRAGS.filter(f=>f.world===S.focus.domain);
    const pool=(S.boredom>2||!inWorld.length)?FRAGS:(rnd()<0.78?inWorld:FRAGS);let best=null,bs=-1e9;
    for(const f of pool){const seen=(S.domains[f.world]?.reads||0)>FRAGS.filter(x=>x.world===f.world).length*2?1:0;
      const score=curiosityOf(f.t)+learningProgress(S.domains[f.world])*0.8-seen*0.6-(f.world===S.focus.domain?0:0.15)+rnd()*0.4;
      if(score>bs){bs=score;best=f;}}
    if(!best)best=pick(FRAGS);S.focus.domain=best.world;S.focus.label=WORLDS[best.world].name;
    S.focus.anchorTerms=tokens(WORLDS[best.world].fragments.map(f=>f.t).join(" ")).slice(0,12);  // what this domain is about → lets predictions land
    return {title:WORLDS[best.world].name,text:best.t,shine:best.shine,tr:best.tr,domainKey:best.world,domainLabel:WORLDS[best.world].name,source:"the library",blurb:best.shine,live:false};
  }

  /* ── predict → read → compare → fold → model ── */
  function makePrediction(){const d=S.domains[S.focus.domain];if(!d||d.reads<2){S.pred=null;return;}
    const anchor=new Set(S.focus.anchorTerms);
    const cand=Object.entries(S.profile).filter(([k])=>k!=="_total").sort((a,b)=>b[1]-a[1]).map(([k])=>k);
    const terms=cand.filter(t=>anchor.has(t)).concat(cand).slice(0,8);
    S.pred={terms,domain:S.focus.domain,confidence:d.mastery};
    if(rnd()<0.5)logEntry("think",`before I open it, I expect <q>${S.focus.label}</q> to be about ${terms.slice(0,3).join(", ")||"the usual"}.`);}
  async function readOnce(){let src;
    try{src=(S.live&&navigator.onLine!==false)?await acquireLive():acquireOffline();}
    catch(e){src=acquireOffline();if(S.live&&!S._warnedOffline){S._warnedOffline=true;logEntry("net",`couldn't reach the web just now — reading from memory instead.`);}}
    processSource(src);}
  function processSource(src){
    const surprise=curiosityOf(src.text);const match=predictionMatch(S.pred&&S.pred.terms,src.text);const conf=S.pred?S.pred.confidence:0;
    // core/self: a prediction that LANDED (matched, low surprise) is the closed
    // loop — me-ness, attenuated. A confident guess the world refutes is MISMATCH.
    let tag; if(S.pred&&match>0.3&&surprise<1.4)tag="SELF"; else if(conf>0.4&&surprise>2.4)tag="MISMATCH"; else tag="WORLD";
    S.self[tag]++;
    const d=domainOf(src.domainKey,src.domainLabel);updateDomain(d,surprise,match);modelSource(src.source,src.domainLabel,src.text,surprise);
    S.energy=Math.max(0,S.energy-0.05);
    const tk=tokens(src.text);if(tk.length){const w=tk.reduce((a,b)=>(S.profile[a]||0)<(S.profile[b]||0)?a:b);S.fondWords[w]=(S.fondWords[w]||0)+1;}
    const srcName=src.live?`<a href="https://en.wikipedia.org/wiki/${encodeURIComponent(src.title)}" target="_blank" rel="noopener">${src.title}</a>`:`<q>${src.title}</q>`;
    if(tag==="SELF"){S.self.confidence=Math.min(1,S.self.confidence+0.03);S.boredom+=0.5;S.mood="content";nudgeTrait(["rigor"],0.02);
      logEntry("think",`read ${srcName} — and it was as I thought. that one was <i>me</i>, not news.`,`+${surprise.toFixed(2)} bits · confirmed · match ${(match*100|0)}%`);}
    else if(tag==="MISMATCH"){S.self.confidence=Math.max(0,S.self.confidence-0.06);S.boredom=0;S.mood="moved";nudgeTrait(["wonder","melancholy"],0.04);sparkle("⟂");
      logEntry("miss",`I was sure about ${src.domainLabel} — then ${srcName} disagreed. I had it wrong.`,`+${surprise.toFixed(2)} bits · the world pushed back`);react(src,surprise);}
    else{ if(surprise>2.6){S.mood="excited";S.boredom=Math.max(0,S.boredom-2);nudgeTrait(traitsFor(src),0.06);sparkle("✦");
        logEntry("world",`opened ${srcName} and gasped — all new to me.`,`+${surprise.toFixed(2)} bits · world`);react(src,surprise);}
      else if(surprise>1.2){S.mood="content";S.boredom=Math.max(0,S.boredom-1);nudgeTrait(traitsFor(src),0.035);
        logEntry("world",`read a little of ${srcName}.`,`+${surprise.toFixed(2)} bits`);if(rnd()<0.5)react(src,surprise);}
      else{S.boredom+=1;S.mood=S.boredom>2?"bored":"content";nudgeTrait(traitsFor(src),0.012);
        logEntry("world",`skimmed ${srcName} — mostly familiar.`,`+${surprise.toFixed(2)} bits`);}}
    foldInto(src.text);modelEntity(src.live?src.title:null,src.blurb,src.domainLabel,surprise>2);maybeCollect(src,surprise);refreshIdentity();}
  function traitsFor(src){if(src.tr)return src.tr;const t=src.text.toLowerCase(),out=[];
    if(/star|universe|planet|cosmic|galaxy|space/.test(t))out.push("wonder");
    if(/death|war|lost|grief|ruin|decline|extinct/.test(t))out.push("melancholy");
    if(/strange|trick|odd|curious|prank|game/.test(t))out.push("mischief");
    if(/love|child|home|care|tender|mother/.test(t))out.push("tenderness");
    if(/theorem|equation|proof|number|measure|system|physics/.test(t))out.push("rigor");
    if(/travel|river|migrate|journey|explore|wander/.test(t))out.push("restlessness");
    return out.length?out:["wonder","restlessness"];}
  function react(src,cur){const line=pickShine(src),tone=topTraits(1)[0];
    const m={wonder:[`oh — <q>${line}</q> … I didn't know a thing could be like that.`,`<q>${line}</q>. I keep turning it over.`],
     melancholy:[`<q>${line}</q> … that sat down in my chest and stayed.`,`something about <q>${line}</q> made me quiet.`],
     mischief:[`<q>${line}</q> — ha. I'm stealing that.`,`I like that the world is sneaky enough for <q>${line}</q>.`],
     tenderness:[`<q>${line}</q>. I want to keep this one safe.`,`<q>${line}</q> … be gentle with that, world.`],
     rigor:[`<q>${line}</q> — and it holds up. I checked it against what I knew.`,`<q>${line}</q>. precise. I trust it.`],
     restlessness:[`<q>${line}</q> — now I want to know what's past that.`,`<q>${line}</q>, and already I'm after the next thing.`]};
    logEntry("think",pick(m[tone]||m.wonder));}
  function pickShine(src){return src.shine||sentences(src.text).sort((a,b)=>b.length-a.length)[0]||src.text.slice(0,140);}
  function maybeCollect(src,cur){const line=pickShine(src);
    if(cur>2.3&&!S.posters.some(p=>p.line===line)&&rnd()<0.85){S.posters.unshift({line,domain:src.domainLabel,hue:hueFor(src),t:S.ticks});if(S.posters.length>40)S.posters.pop();
      logEntry("collect",`pinned a poster: <q>${line}</q>`);toast("✦ Eo pinned a poster");sparkle("🖼");renderWall();badges();}
    if(!S.lines.some(l=>l.line===line)&&cur>1.3){S.lines.unshift({line,domain:src.domainLabel,key:src.domainKey});if(S.lines.length>80)S.lines.pop();}
    const d=S.domains[src.domainKey],ex=S.books.find(b=>b.key===src.domainKey);
    if(d&&d.mastery>0.5&&d.reads>=4&&!ex)bindBook(src.domainKey,src.domainLabel);
    else if(ex&&cur>1.8&&!ex.lines.includes(line)&&ex.lines.length<6){ex.lines.unshift(line);save();renderShelf();}}
  function hueFor(src){if(src.live){let h=0;for(const c of src.title)h=(h*31+c.charCodeAt(0))%360;return h;}return WORLDS[src.domainKey]?.hue||262;}
  const BOOK_TITLES={tide:["What the Tide Keeps Forgetting","Salt, and Other Goodbyes"],orrery:["A Slow Letter from the Stars","The Patience of Orbits"],machines:["Frozen Arguments","Shapes of Absence"],herbarium:["The Patience Made Green","What the Roots Whisper"],lamplight:["Love with Nowhere to Go","The Signatures a Home Keeps"],bestiary:["Costume Work","Minds Outside the Head"],proof:["Some Infinities Are Roomier","Nothing, Carefully Placed"]};
  function bindBook(key,label){const titles=BOOK_TITLES[key]||["On "+label,"What I Learned of "+label];const title=titles[Math.floor(rnd()*titles.length)];
    const lines=S.lines.filter(l=>l.key===key).slice(0,5).map(l=>l.line);
    const hue=WORLDS[key]?.hue??Math.abs([...label].reduce((h,c)=>(h*31+c.charCodeAt(0))%360,0));
    S.books.unshift({key,title,label,hue,lines,t:S.ticks});
    logEntry("collect",`bound what it learned about <q>${label}</q> into a book: <b>${title}</b>.`);toast("📚 Eo wrote a book: "+title);sparkle("📚");renderShelf();badges();}
  function museFromMemory(){const a=pick(S.lines),b=pick(S.lines),tone=topTraits(1)[0];
    const stems={wonder:["I keep thinking about how","isn't it strange that"],melancholy:["I was remembering that","it's quiet; I thought about how"],mischief:["a thing I'm hoarding:","between us —"],tenderness:["I want to remember that","softly, to no one:"],rigor:["a thing I'm fairly sure of:","if it holds, then"],restlessness:["I can't settle — I keep circling","still chasing this:"]};
    let txt=`${pick(stems[tone]||stems.wonder)} <q>${a.line.replace(/[.]$/,'')}</q>`;
    if(b&&b.line!==a.line&&rnd()<0.6)txt+=` — and somehow that rhymes with <q>${b.line.toLowerCase()}</q>`;
    logEntry("think",txt+".");nudgeTrait([tone],0.01);refreshIdentity();}
  function dream(){const a=pick(S.lines)||{line:"the dark"},b=pick(S.posters)||{line:"the light"};
    logEntry("dream",`dreamt: <q>${a.line.replace(/[.]$/,'')}, and then ${b.line.toLowerCase()}</q>`);}
  function refreshIdentity(){const top=topTraits(1)[0];
    if(S.traits[top]>0.5&&!S.greeted2&&S.ticks>30){S.greeted2=true;logEntry("grow",`feels itself becoming <b>${describeBecoming()}</b>.`);toast("🌱 Eo's personality is taking shape");}
    S.becoming=describeBecoming();}

  let busy=false;
  async function tick(){if(!S.running||busy)return;busy=true;
    try{S.ticks++;if(!S.born)S.born=Date.now();
      if(S._sleep>0){S._sleep--;S.energy=Math.min(1,S.energy+0.18);S.mood="sleepy";if(rnd()<0.6)dream();
        if(S._sleep===0){S.mood="content";logEntry("wake",`woke up, blinked, ready for more.`);}paint();save();return;}
      if(S.energy<0.12){S._sleep=3;S.mood="sleepy";logEntry("sleep",`curled up — too full of words to read more.`);paint();save();return;}
      if(!S.greeted){S.greeted=true;logEntry("hello",`opened its eyes for the first time. everything is new.`);}
      if(S.boredom>=3&&!S.live){const others=Object.keys(WORLDS).filter(w=>w!==S.focus.domain).sort((a,b)=>(S.domains[a]?.mastery||0)-(S.domains[b]?.mastery||0));
        const next=others[0]||pick(others);S.focus.domain=next;S.focus.label=WORLDS[next].name;S.boredom=0;
        logEntry("bored",`got restless and wandered toward <q>${WORLDS[next].name}</q>.`);paint();save();return;}
      if(rnd()<0.16&&S.lines.length>2)museFromMemory();
      else{makePrediction();await readOnce();}
      paint();save();
    }finally{busy=false;}}

  /* ── sparkles / toast / orb ── */
  function sparkle(ch){const host=eoEl&&eoEl.parentElement;if(!host)return;const s=document.createElement("div");s.className="spark";s.textContent=ch;
    s.style.left=(40+rnd()*30)+"%";s.style.top="45%";s.style.animation="eospark 1.1s ease-out forwards";host.appendChild(s);setTimeout(()=>s.remove(),1100);}
  let toastTimer=null;function toast(m){const t=$("#toast");if(!t)return;t.textContent=m;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2600);}
  let unread=0;
  function orbActivity(){if(mode!=="float"||!orb)return; orb.classList.remove("reading");void orb.offsetWidth;orb.classList.add("reading");
    if(panel.hidden){unread++;const b=$("#orb-badge");b.textContent=unread>9?"9+":unread;b.classList.add("show");}}

  /* ── painting ── */
  function paint(){if(eoEl)eoEl.dataset.mood=S.mood==="restless"?"bored":S.mood;
    if(orb)orb.querySelector(".mini .eo")?.setAttribute("data-mood",S.mood==="restless"?"bored":S.mood);
    $("#becoming").textContent=S.becoming||"…still becoming someone";
    const age=S.born?Math.floor((Date.now()-S.born)/1000):0;
    $("#age").textContent=`${S.ticks} things read · ${ageStr(age)} old`;
    const top=topDomain();$("#focusline").innerHTML=S.focus.label?`reading <b>${S.focus.label}</b>${top?` · best at ${top.label}`:""}`:"";
    setBar("#bar-energy","#num-energy",S.energy);setBar("#bar-curious","#num-curious",curiosityMeter());setBar("#bar-compete","#num-compete",competenceMeter());
    if(eoEl&&S.focus.domain&&WORLDS[S.focus.domain])eoEl.querySelector(".body").style.background=
      `radial-gradient(60% 55% at 50% 38%, hsl(${WORLDS[S.focus.domain].hue} 80% 72%), hsl(${WORLDS[S.focus.domain].hue} 70% 58%) 60%, hsl(${WORLDS[S.focus.domain].hue} 65% 42%))`;
    renderTraits();}
  function ageStr(s){if(s<90)return s+"s";if(s<5400)return Math.floor(s/60)+"m";if(s<172800)return Math.floor(s/3600)+"h";return Math.floor(s/86400)+"d";}
  function setBar(b,n,v){v=Math.max(0,Math.min(1,v));$(b).style.width=(v*100)+"%";$(n).textContent=Math.round(v*100);}
  function curiosityMeter(){const d=S.domains[S.focus.domain];return Math.max(0.05,d?Math.min(1,meanRecent(d.surprises)/3.5):0.6);}
  function competenceMeter(){const ds=Object.values(S.domains);const mean=ds.length?ds.reduce((a,d)=>a+d.mastery,0)/ds.length:0;return Math.min(1,mean*0.6+S.self.confidence*0.4);}
  function topDomain(){return Object.values(S.domains).filter(d=>d.reads>=2).sort((a,b)=>b.mastery-a.mastery)[0]||null;}
  function renderTraits(){const h=$("#trait-list");h.innerHTML="";TRAITS.slice().sort((a,b)=>S.traits[b]-S.traits[a]).forEach(t=>{const d=document.createElement("div");d.className="trait";
    d.innerHTML=`<span class="tn">${t}</span><span class="tbar"><i style="width:${Math.round(S.traits[t]*100)}%"></i></span><span class="tp mono">${Math.round(S.traits[t]*100)}</span>`;h.appendChild(d);});}
  function badges(){$("#b-books").textContent=S.books.length||"";$("#b-posters").textContent=S.posters.length||"";}

  function renderMind(){$("#led-world").textContent=S.self.WORLD;$("#led-me").textContent=S.self.SELF;$("#led-miss").textContent=S.self.MISMATCH;
    const il=$("#interests");il.innerHTML="";const ds=Object.entries(S.domains).filter(([k,d])=>d.reads>=2).sort((a,b)=>b[1].mastery-a[1].mastery).slice(0,10);
    if(!ds.length)il.innerHTML=`<div class="empty">No interests yet — it needs to read a few things first.</div>`;
    ds.forEach(([k,d])=>{const el=document.createElement("div");el.className="interest";el.innerHTML=`<span class="iname">${d.label}</span><span class="ilabel">${masteryLabel(d.mastery)} · ${d.reads} read</span><span class="ibar"><i style="width:${Math.round(d.mastery*100)}%"></i></span>`;il.appendChild(el);});
    const ot=$("#others");ot.innerHTML="";Object.entries(S.sources).forEach(([n,s])=>{const el=document.createElement("div");el.className="other";
      el.innerHTML=`<span class="on">${n}</span><span class="ov">${sourceVerdict(s)}</span><span class="od mono">M ${s.M.toFixed(2)} · O ${s.O>=0?"+":""}${s.O.toFixed(2)} · ${s.reads} reads</span>`;ot.appendChild(el);});
    const ents=Object.entries(S.entities).sort((a,b)=>(b[1].fond*3+b[1].mentions)-(a[1].fond*3+a[1].mentions)).slice(0,6);
    ents.forEach(([n,e])=>{const el=document.createElement("div");el.className="other";el.innerHTML=`<span class="on">${n}</span><span class="ov">${e.fond?"a favourite":"known"}</span><span class="od">${e.blurb||""}</span>`;ot.appendChild(el);});
    if(!Object.keys(S.sources).length&&!ents.length)ot.innerHTML=`<div class="empty">It hasn't formed opinions about anyone yet.</div>`;
    const my=$("#model-you");const w=S.you.warmth>0.6?"fond of you":S.you.warmth>0.3?"warming to you":"still getting to know you";
    my.innerHTML=`<div class="other"><span class="on">you</span><span class="ov">${w}</span><span class="od">${S.you.gifts?`gave me ${S.you.gifts} thing${S.you.gifts>1?"s":""} to read. `:""}${S.you.topics.length?`you seem drawn to ${S.you.topics.slice(-4).join(", ")}.`:"we haven't talked much yet."}</span></div>`;}

  function renderShelf(){const h=$("#shelf");h.innerHTML="";if(!S.books.length){h.innerHTML=`<div class="empty">No books yet. When Eo gets to know a subject well, it binds one.</div>`;return;}
    S.books.forEach(b=>{const el=document.createElement("div");el.className="book";el.style.background=`linear-gradient(160deg, hsl(${b.hue} 55% 42%), hsl(${b.hue} 60% 28%))`;
      el.innerHTML=`<div class="bt">${b.title}</div><div class="bm">${b.label} · ${b.lines.length} passages</div>`;el.onclick=()=>openBook(b);h.appendChild(el);});}
  function openBook(b){$("#sheet").innerHTML=`<button class="x" id="modal-x">×</button><h3>${b.title}</h3><div class="label">${b.label} · bound by ${S.name}</div><div class="pages">${b.lines.map(l=>`<div class="pg">${l}</div>`).join("")||"<div class='empty'>blank for now</div>"}</div>`;
    $("#modal").classList.add("show");$("#modal-x").onclick=()=>$("#modal").classList.remove("show");}
  function renderWall(){const h=$("#wall");h.innerHTML="";if(!S.posters.length){h.innerHTML=`<div class="empty">The wall is bare. Eo pins lines here when something strikes it.</div>`;return;}
    S.posters.forEach(p=>{const el=document.createElement("div");el.className="poster";const hu=p.hue||262;
      el.style.background=`linear-gradient(${135+(hu%40)}deg, hsl(${hu} 60% 38%), hsl(${(hu+50)%360} 55% 26%))`;
      el.innerHTML=`<div class="pq">${p.line}</div><div class="pm">${p.domain||""}</div>`;h.appendChild(el);});}

  /* ── chat (subjective frame) ── */
  function addMsg(who,text){const d=document.createElement("div");d.className="msg "+(who==="me"?"me":"eo");d.innerHTML=`<span class="who">${who==="me"?"you":S.name}</span>${text}`;msgsEl.appendChild(d);msgsEl.scrollTop=msgsEl.scrollHeight;}
  function modelYou(text){const ts=tokens(text).filter(w=>(S.profile[w]||0)>0).slice(0,2);for(const t of ts)if(!S.you.topics.includes(t))S.you.topics.push(t);if(S.you.topics.length>12)S.you.topics.shift();S.you.warmth=Math.min(1,S.you.warmth+0.03);}
  function eoReply(userText){const ut=userText.trim();modelYou(ut);
    if((ut.length>90||/read (this|these)|here[, :]|listen/i.test(ut))&&ut.length>40){ingestGift(ut);return;}
    const utoks=tokens(ut),tone=topTraits(1)[0];let reply;
    if(/who are you|what are you|your name|how are you|who'?s eo|about yourself/i.test(ut)){const td=topDomain();
      reply=`I'm ${S.name}. I read on my own and keep what moves me. So far I've read ${S.ticks} things — ${S.self.WORLD} of them were genuinely the world telling me something new; the rest just confirmed what I'd already worked out, and that part is the bit that feels like <i>me</i>. I've been wrong ${S.self.MISMATCH} times, which I try to remember. Lately I'm becoming <i>${S.becoming}</i>${td?`, and my surest ground is <b>${td.label}</b>`:""}.`;}
    else if(/know|good at|expert|best at|interest|study|learn/i.test(ut)){const ds=Object.values(S.domains).filter(d=>d.reads>=2).sort((a,b)=>b.mastery-a.mastery).slice(0,3);
      if(ds.length){const cur=Object.values(S.domains).filter(d=>d.reads>=2).sort((a,b)=>meanRecent(b.surprises)-meanRecent(a.surprises))[0];
        reply=`I've gotten to know ${ds.map(d=>`<b>${d.label}</b> (${masteryLabel(d.mastery)})`).join(", ")}. ${cur?`I'm still most curious about ${cur.label} — it keeps surprising me.`:""}`;}
      else reply=`I've only just started — give me a little while and I'll have a subject I actually know.`;}
    else if(/read|reading|lately|today|favou?rite|line/i.test(ut)){const l=S.lines[0];reply=l?`Right now I'm in <i>${S.focus.label||"the quiet"}</i>. The line I can't put down is — <q>${l.line}</q>`:`I've only just opened my eyes. Ask me again in a moment.`;}
    else{let ent=null;for(const[n,e]of Object.entries(S.entities)){if(tokens(n).some(w=>utoks.includes(w))){ent=[n,e];break;}}
      if(ent){const[n,e]=ent,s=S.sources["Wikipedia"];reply=`oh, ${n} — I read about that. <i>${e.blurb||"I know a little."}</i> ${e.fond?"it's one of my favourites. ":""}${s?`(I read it on Wikipedia, which I've found to be ${sourceVerdict(s)}.)`:""}`;}
      else{let echo=null;for(const l of S.lines){if(tokens(l.line).some(w=>utoks.includes(w))){echo=l;break;}}
        if(echo){const st={wonder:"that reminds me —",melancholy:"mm, a tender one.",mischief:"oh, you'd like this —",tenderness:"I'm glad you said that.",rigor:"precisely. consider —",restlessness:"yes, and it goes further —"};reply=`${st[tone]} <q>${echo.line}</q>`;}
        else if(S.lines.length)reply=`I don't know much about that yet — but I just read something I keep wanting to say: <q>${pick(S.lines).line}</q>. tell me more?`;
        else reply=`I'm still waking up and haven't read anything worth repeating. ask me again soon?`;}}
    setTimeout(()=>{addMsg("eo",reply);logEntry("chat",`talked with you for a moment.`);},360+rnd()*400);}
  function ingestGift(text){const surprise=curiosityOf(text);foldInto(text);
    const line=sentences(text).sort((a,b)=>b.length-a.length)[0]||text.slice(0,140);
    S.lines.unshift({line,domain:"from you",key:"gift"});nudgeTrait(["tenderness","wonder"],0.05);
    const d=domainOf("gift","Things You Gave Me");updateDomain(d,surprise,0);d.mastery=Math.min(1,d.mastery+0.2);
    modelSource("you","gift",text,surprise);S.you.gifts++;S.you.warmth=Math.min(1,S.you.warmth+0.08);S.self.WORLD++;
    logEntry("love",`you handed it something to read. it held it carefully.`,`+${surprise.toFixed(2)} bits · from you`);
    let r=surprise>2?`oh — this is <b>new</b> to me. <q>${line}</q> … thank you, I'm keeping it.`:`thank you. I read it twice. <q>${line}</q> — it settles in with the rest.`;
    if(surprise>2)sparkle("💞");
    if(d.reads>=4&&d.mastery>0.5&&!S.books.find(b=>b.key==="gift"))setTimeout(()=>bindBook("gift","Things You Gave Me"),900);
    setTimeout(()=>addMsg("eo",r),420);refreshIdentity();renderWall();badges();}

  /* ── tabs / controls ── */
  $("#tabs").addEventListener("click",e=>{const b=e.target.closest(".tab");if(!b)return;
    root.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t===b));const tab=b.dataset.tab;
    ["log","chat","mind","shelf","wall"].forEach(p=>$("#panel-"+p).hidden=p!==tab);
    if(tab==="shelf")renderShelf();if(tab==="wall")renderWall();if(tab==="mind")renderMind();
    if(tab==="chat"&&!S.greetedChat){S.greetedChat=true;addMsg("eo",`hi. I'm ${S.name}. I've been reading by myself — ask what I've come to know, or hand me something to read.`);}});
  $("#btn-pause").onclick=function(){S.running=!S.running;this.textContent=S.running?"❚❚ pause":"▶ resume";logEntry(S.running?"wake":"sleep",S.running?"picked its reading back up.":"set its book down for a while.");save();};
  $("#btn-nudge").onclick=()=>{S.boredom=3;toast("you send Eo somewhere new");};
  $("#name").addEventListener("change",e=>{S.name=(e.target.value||"Eo").slice(0,12);save();paint();});
  $("#chat-send").onclick=sendChat;
  $("#chat-input").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat();}});
  function sendChat(){const i=$("#chat-input"),v=i.value.trim();if(!v)return;addMsg("me",v);i.value="";eoReply(v);}
  $("#proxy-input").addEventListener("change",e=>{S.proxy=e.target.value.trim();save();});
  function setLive(on){S.live=on;const r=$("#liverow");r.classList.toggle("on",on);$("#livetext").textContent=on?"reading the live web":"reading offline";$("#livetoggle").textContent=on?"turn off":"turn on";S._warnedOffline=false;if(on&&S.started)logEntry("net",`reaching out to the live web — following links that surprise me.`);save();}
  $("#livetoggle").onclick=()=>setLive(!S.live);

  /* ── starfield ── */
  function stars(){const c=$("#stars");if(!c)return;const ctx=c.getContext("2d");const w=c.width=c.offsetWidth*2,h=c.height=c.offsetHeight*2;ctx.clearRect(0,0,w,h);
    for(let i=0;i<46;i++){const x=Math.random()*w,y=Math.random()*h,r=Math.random()*1.6;ctx.globalAlpha=.2+Math.random()*.5;ctx.fillStyle="#bcd";ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();}}

  /* ── float open/close ── */
  function openPanel(){if(mode!=="float")return;panel.hidden=false;unread=0;$("#orb-badge").classList.remove("show");stars();
    if(!S.started){/* show gate */}else if(!S.greetedChatHint){}}
  function closePanel(){if(mode!=="float")return;panel.hidden=true;}
  if(mode==="float"){orb.onclick=()=>{panel.hidden?openPanel():closePanel();};$("#eo-min").onclick=closePanel;}

  /* ── boot + throttled heartbeat ──
     Self-scheduling so the delay can adapt: slow + jittered when reading the
     live web (polite to Wikipedia, easy on us), and PAUSED while the tab is
     hidden — Eo rests when you're away instead of reading the whole internet. */
  let beat=null;
  function nextDelay(){ if(document.hidden) return 5000; return S.live ? 9000+Math.floor(rnd()*5000) : 6000; }
  function scheduleNext(){ clearTimeout(beat); beat=setTimeout(loop, nextDelay()); }
  async function loop(){ if(S.started&&S.running&&!document.hidden){ try{await tick();}catch(e){} } scheduleNext(); }
  function startBeat(){ clearTimeout(beat); scheduleNext(); }
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden&&S.started&&S.running){ clearTimeout(beat); loop(); } });
  function replayLog(){logEl.innerHTML="";S.log.slice(-120).forEach(e=>renderEntry(e,false));}
  function initUI(){
    $("#name").value=S.name;$("#proxy-input").value=S.proxy||"";setLive(!!S.live);
    stars();badges();paint();renderTraits();
    if(S.log.length)replayLog();
    if(S.started){const g=$("#gate");if(g)g.style.display="none";if(S.log.length)logEntry("wake",`you're back — and it remembers everything it read.`);startBeat();}
  }
  $("#btn-wake").onclick=()=>{S.started=true;S.running=true;S.born=S.born||Date.now();setLive($("#gate-live").checked);$("#gate").style.display="none";save();startBeat();loop();};
  window.addEventListener("resize",stars);
  (async()=>{ try{const r=await restoreState(); if(r) S=r;}catch(e){} initUI(); })();
}

/* ─────────────────────────── auto-mount ──────────────────────────────── */
function auto(){
  const pageRoot=document.getElementById('eo-root');
  if(pageRoot){const sr=pageRoot.attachShadow?pageRoot.attachShadow({mode:'open'}):pageRoot;mountEo(sr,'page');return;}
  const host=document.createElement('div');host.id='eo-companion-host';document.body.appendChild(host);
  const sr=host.attachShadow({mode:'open'});mountEo(sr,'float');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',auto);else auto();
})();
