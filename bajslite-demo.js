javascript:(async function(){
 if (window.self !== window.top) return; // don't run inside iframes
 console.log('[BajSAS Lite] Starting...');
 if (document.getElementById('custom-stream-wrapper')) { console.log('[BajSAS Lite] Already running — remove #custom-stream-wrapper first'); return; }

 const v = document.querySelector('video');
 if (!v) { console.log('[BajSAS Lite] No <video> element found — are you on a Twitch channel page?'); return; }
 console.log('[BajSAS Lite] Video found, loading channels...');

 const listUrl = "https://gist.githubusercontent.com/BestestCreature/53b495e6b30595283967c4817e33cfc0/raw/";
 const WORKER_BASE_URL = 'https://bitter-meadow-24f3.jeffvanss1.workers.dev';
 const APP_VERSION = 'lite 6.97';
 const DEBUG = true;
 const debugBuffer = [];
 const dbg = (event, details = {}) => {
 const entry = { at: new Date().toISOString(), event, ...details };
 debugBuffer.push(entry);
 if (debugBuffer.length > 500) debugBuffer.shift();
 if (DEBUG) console.debug(`[BajSAS ${APP_VERSION}] ${event}`, details);
 };
 window.__BAJSAS_DEBUG__ = { version: APP_VERSION, logs: debugBuffer, dump: () => [...debugBuffer] };
 dbg('app:start', { href: location.href });

 const LS_STREAM = "customStream_selected";
 const LS_HIDE = "customStream_hideUntilHover";
 const LS_THEATER = "customStream_theater";
 const LS_FORSEN = "forsenChatEnabled";

 let channels = [];
 try {
 const resp = await fetch(listUrl);
 const text = await resp.text();
 channels = text.trim().split('\n').map(line => line.split(';'));
 dbg('channels:loaded', { count: channels.length });
 } catch (e) { console.log('[BajSAS Lite] Failed to load channel list:', e); return; }

 // Always start on the native Twitch player. Stream selection is session-only;
 // discard values saved by older versions instead of restoring an overlay.
 localStorage.removeItem(LS_STREAM);
 const savedStream = 'Twitch';
 const isTheaterSaved = localStorage.getItem(LS_THEATER) === "1";
 let hideUntilHover = localStorage.getItem(LS_HIDE) === "1";

 const liveCache = new Map();

 const injectLiveDotStyle = () => {
 const s = document.createElement('style');
 s.textContent = `
 #custom-stream-ui {
 opacity: 0.5;
 transition: opacity 0.2s, bottom 0.2s ease, top 0.2s ease, transform 0.2s ease;
 z-index: 2147483646 !important;
 }

 #custom-stream-ui .custom-stream-btn { min-height:26px;padding:3px 7px;align-items:center;justify-content:center; }
 #custom-stream-ui>div:first-child:hover { opacity:1!important;color:#fff; }

 .stream-container-mod.stream-hide-ui #custom-stream-ui {
 opacity: 0;
 }

 .stream-container-mod.stream-ui-active #custom-stream-ui {
 opacity: 1 !important;
 }

 .custom-stream-btn {
 cursor: pointer;
 padding: 4px 8px;
 border: none;
 border-radius: 4px;
 background: #444;
 color: #fff;
 font-weight: bold;
 font-size: 12px;
 transition: 0.1s;
 display: flex !important;
 align-items: center !important;
 gap: 4px !important;
 overflow: visible !important;
 white-space: nowrap !important;
 }

 .custom-stream-btn .btn-emote {
 display: inline-block !important;
 width: 28px !important;
 height: 28px !important;
 object-fit: contain !important;
 image-rendering: auto !important;
 border-radius: 4px !important;
 flex-shrink: 0 !important;
 visibility: visible !important;
 opacity: 1 !important;
 min-width: 28px !important;
 min-height: 28px !important;
 }

 .custom-stream-btn .btn-name {
 visibility: visible !important;
 opacity: 1 !important;
 font-size: 12px !important;
 font-weight: bold !important;
 color: #fff !important;
 white-space: nowrap !important;
 overflow: visible !important;
 display: block !important;
 }

 .live-dot { display:none !important; }
 .custom-stream-btn.bajsas-game-selector {
 border:1px solid rgba(0,220,110,.72)!important;
 box-shadow:0 0 3px rgba(0,220,110,.38);
 }
 .custom-stream-btn.bajsas-game-selector:hover {
 border-color:#21e889!important;
 box-shadow:0 0 5px rgba(0,230,120,.72),0 0 9px rgba(0,230,120,.2);
 }
 .custom-stream-btn.is-live {
 position:relative;
 border:1px solid rgba(255,39,79,.72) !important;
 animation:bajsasNeonLive 2s ease-in-out infinite;
 }
 .custom-stream-btn.is-live::after { content:none !important; display:none !important; }

 @keyframes bajsasNeonLive {
 0%,100% { box-shadow:0 0 1px rgba(255,24,63,.24); }
 50% { box-shadow:0 0 4px rgba(255,24,63,.68),0 0 7px rgba(255,24,63,.2); }
 }
 @media (prefers-reduced-motion:reduce) { .custom-stream-btn.is-live { animation:none!important;box-shadow:0 0 3px rgba(255,24,63,.5); } }

 .bajsas-watch-badge {
 display: inline !important;
 color: #bf94ff !important;
 font-size: 11px !important;
 font-weight: 600 !important;
 margin-right: 1px !important;
margin-left: 2px !important;
 cursor: pointer !important;
 background: rgba(145,71,255,0.12) !important;
 border: 1px solid rgba(145,71,255,0.25) !important;
 padding: 1px 6px !important;
 border-radius: 999px !important;
 vertical-align: middle !important;
 transition: background .15s, color .15s, transform .1s !important;
 }
 .bajsas-watch-badge:hover {
 background: rgba(145,71,255,0.28) !important;
 color: #e4d5ff !important;
 transform: scale(1.06) !important;
 }
 .bajsas-watch-badge:active {
 transform: scale(0.96) !important;
 background: rgba(145,71,255,0.35) !important;
 }
 .bajsas-stream-preview {
 position: fixed; z-index: 2147483647; width: 292px; padding: 7px;
 border-radius: 9px; background: rgba(14,14,18,.96);
 border: 1px solid rgba(255,255,255,.16); box-shadow: 0 16px 42px rgba(0,0,0,.58);
 color: #efeff1; font: 12px/1.35 Arial,sans-serif; pointer-events: none;
 opacity: 0; visibility: hidden; transform: translate3d(0,8px,0) scale(.975);
 transform-origin: 50% 100%; transition: opacity 140ms ease-out,transform 180ms cubic-bezier(.2,.8,.2,1),visibility 0s linear 180ms;
 will-change: transform,opacity; backface-visibility: hidden; contain: layout paint style;
 }
 .bajsas-stream-preview.show { opacity: 1; visibility: visible; transform: translate3d(0,0,0) scale(1); transition-delay: 0s; }
 .bajsas-stream-preview img { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; border-radius: 6px; background: #18181b; transform: translateZ(0); }
 .bajsas-offline-banner { width:100%; aspect-ratio:16/9; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:7px; border-radius:6px; overflow:hidden; position:relative; background:radial-gradient(circle at 50% 20%,rgba(145,71,255,.28),transparent 48%),linear-gradient(135deg,#19151f,#0e0e12); color:#efeff1; border:1px solid rgba(255,255,255,.08); }
 .bajsas-offline-banner::before { content:""; position:absolute; inset:0; opacity:.16; background:repeating-linear-gradient(135deg,transparent 0 12px,rgba(255,255,255,.08) 12px 13px); }
 .bajsas-offline-banner.is-live { background:radial-gradient(circle at 50% 20%,rgba(0,200,83,.3),transparent 48%),linear-gradient(135deg,#102019,#0e0e12); }
 .bajsas-offline-banner.is-live .bajsas-offline-icon { color:#69f0ae; border-color:rgba(105,240,174,.45); background:rgba(0,200,83,.18); }
 .bajsas-offline-icon { z-index:1; width:54px; height:54px; display:grid; place-items:center; border-radius:8px; background:rgba(145,71,255,.2); border:1px solid rgba(191,148,255,.38); font-size:20px; overflow:hidden; }
 .bajsas-offline-icon img { width:100% !important; height:100% !important; aspect-ratio:1; object-fit:contain !important; display:block !important; border-radius:7px !important; }
 .bajsas-offline-label { z-index:1; font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
 .bajsas-offline-platform { z-index:1; color:#adadb8; font-size:10px; }
 .bajsas-stream-preview-title { display: block; font-weight: 700; margin-top: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
 .bajsas-stream-preview-meta { display: block; color: #adadb8; font-size: 11px; margin-top: 2px; }
 .bajsas-presence-toggle { position:absolute!important; top:12px; right:12px; z-index:2147483647; pointer-events:auto!important; opacity:1; transform:translate3d(0,0,0); transition:opacity .2s ease,transform .2s ease; background:rgba(20,20,24,.82)!important; border:1px solid rgba(255,255,255,.16)!important; box-shadow:0 5px 18px rgba(0,0,0,.38); }
 .bajsas-presence-toggle.is-idle { opacity:0; transform:translate3d(0,-5px,0); pointer-events:none!important; }
 .stream-container-mod:hover .bajsas-presence-toggle.is-idle,.bajsas-presence-toggle.panel-open { opacity:.88; transform:translate3d(0,0,0); pointer-events:auto!important; }
 .bajsas-presence-toggle:hover { opacity:1!important; }
 .bajsas-presence-panel { display:none; position:absolute; top:48px; right:12px; z-index:2147483647; pointer-events:auto; width:min(290px,62vw); max-height:min(360px,65vh); overflow:auto; background:rgba(14,14,18,.94); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,.16); border-radius:7px; box-shadow:0 16px 40px rgba(0,0,0,.6); }
 .bajsas-presence-panel.show { display:block; animation:bajPresenceIn .14s ease-out; }
 @keyframes bajPresenceIn { from { opacity:0; transform:translate3d(8px,-6px,0) scale(.98); } to { opacity:1; transform:none; } }
 @media (max-width:600px) { .bajsas-presence-toggle{top:8px;right:8px}.bajsas-presence-panel{top:44px;right:6px;width:min(290px,calc(100% - 12px))} }
 .bajsas-presence-group { border-top:1px solid rgba(255,255,255,.1); }
 .bajsas-presence-group:first-child { border-top:0; }
 .bajsas-presence-group > summary { list-style:none; }
 .bajsas-presence-group > summary::-webkit-details-marker { display:none; }
 .bajsas-presence-channel { position:sticky; top:0; z-index:2; display:flex; justify-content:space-between; align-items:center; gap:8px; padding:8px 9px; background:#26262c; color:#efeff1; font-size:11px; font-weight:800; cursor:pointer; user-select:none; }
 .bajsas-presence-channel:hover { background:#303038; }
 .bajsas-presence-channel-name::before { content:'▸'; display:inline-block; width:14px; color:#adadb8; }
 .bajsas-presence-group[open] .bajsas-presence-channel-name::before { content:'▾'; }
 .bajsas-presence-count { min-width:22px; padding:1px 7px; border-radius:999px; text-align:center; color:#d8c7ff; background:rgba(145,71,255,.22); border:1px solid rgba(191,148,255,.28); }
 .bajsas-presence-users { display:flex; flex-wrap:wrap; gap:5px; padding:7px 8px 9px; background:rgba(0,0,0,.16); }
 .bajsas-presence-row { display:inline-flex; align-items:center; gap:4px; max-width:100%; padding:3px 7px; border:1px solid rgba(255,255,255,.1); border-radius:999px; background:rgba(255,255,255,.055); font-size:10px; }
 .bajsas-presence-user { max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
 .bajsas-presence-dot { width:6px; height:6px; margin-right:1px; }
 .bajsas-presence-dot { display:inline-block; width:7px; height:7px; margin-right:5px; border-radius:50%; background:#00c853; box-shadow:0 0 7px rgba(0,200,83,.7); }
 .bajsas-presence-empty { padding:16px; text-align:center; color:#adadb8; font-size:11px; }
 .bajsas-media{display:none;position:absolute;inset:0;z-index:2147483644;background:#0e0e10;pointer-events:auto}.bajsas-media.show{display:grid;grid-template-rows:1fr auto}#custom-stream-wrapper:has(.bajsas-media.show) #custom-stream-ui{top:10px!important;bottom:auto!important;transform:none;touch-action:pan-x}#custom-stream-wrapper:has(.bajsas-media.show) #custom-stream-ui>div:first-child{cursor:ns-resize;user-select:none;touch-action:none}#custom-stream-wrapper:has(.bajsas-media.show):hover #custom-stream-ui{opacity:1!important}.bajsas-media iframe{width:100%;height:100%;border:0;pointer-events:auto}.bajsas-media-lock{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:3;padding:4px 9px;border-radius:999px;background:rgba(14,14,18,.72);color:#c9b7ef;font:10px sans-serif;pointer-events:none;backdrop-filter:blur(5px)}.bajsas-media-fetch-warning{display:none;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:6;width:min(430px,82%);padding:12px 14px;border-radius:8px;background:rgba(20,14,12,.94);border:1px solid rgba(255,170,100,.45);box-shadow:0 14px 40px #000;color:#ffd1aa;text-align:center;font:12px/1.45 sans-serif}.bajsas-media-fetch-warning.show{display:block}.bajsas-media-fetch-warning [data-media-warning-close]{position:absolute;right:6px;top:5px;border:0;background:transparent;color:#fff;cursor:pointer;font-size:15px}.bajsas-media-bar{display:flex;gap:6px;align-items:center;padding:8px;background:rgba(20,20,24,.96);color:#fff}.bajsas-media-bar input{flex:1;min-width:100px;background:#18181b;color:#fff;border:1px solid #555;padding:6px}.bajsas-media-queue{max-width:35%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#adadb8;cursor:help}.bajsas-media-queue-list{display:none;position:fixed;left:8px;top:8px;z-index:2147483647;pointer-events:auto;width:min(330px,80vw);max-height:300px;overflow:auto;padding:7px;background:rgba(14,14,18,.97);border:1px solid rgba(255,255,255,.17);border-radius:7px;box-shadow:0 15px 40px rgba(0,0,0,.65);color:#fff}.bajsas-media-queue-list.show{display:block}.bajsas-media-queue-item{display:grid;grid-template-columns:26px 1fr auto;gap:7px;padding:7px;border-top:1px solid rgba(255,255,255,.07);font:11px sans-serif}.bajsas-media-queue-item:first-child{border-top:0}.bajsas-media-queue-index{display:grid;place-items:center;width:23px;height:23px;border-radius:50%;background:rgba(145,71,255,.25);color:#d8c7ff;font-weight:800}.bajsas-media-queue-title{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bajsas-media-queue-meta{color:#adadb8;font-size:10px;margin-top:2px}
 .bajsas-game-modal{display:none;position:absolute;right:14px;bottom:86px;z-index:2147483646;pointer-events:auto;width:310px;min-width:250px;max-width:min(520px,75vw);max-height:calc(100% - 110px);overflow:auto;opacity:.94;transform:translateZ(0);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);contain:layout paint style}.bajsas-hidden{display:none!important}.bajsas-game-resize{position:absolute!important;left:-8px!important;top:-8px!important;z-index:8;cursor:nwse-resize!important;user-select:none;touch-action:none;font-size:16px!important;line-height:1!important;width:27px;height:27px;display:grid!important;place-items:center;padding:0!important;border-radius:50%!important;opacity:.82}.bajsas-game-resize:hover{opacity:1}.bajsas-game-modal.show{display:block;animation:bajGameIn .2s ease-out}.bajsas-game-modal:hover{opacity:1}.bajsas-game-modal.lobby-mode .bajsas-game-window{background-color:#2a1d14;background-image:linear-gradient(45deg,rgba(221,190,145,.09) 25%,transparent 25%,transparent 75%,rgba(221,190,145,.09) 75%),linear-gradient(45deg,rgba(221,190,145,.09) 25%,transparent 25%,transparent 75%,rgba(221,190,145,.09) 75%),linear-gradient(160deg,rgba(96,70,47,.9),rgba(42,29,20,.88));background-position:0 0,14px 14px,0 0;background-size:28px 28px,28px 28px,100% 100%;border-color:#b38b5d;color:#f8e7c3;box-shadow:0 18px 55px rgba(0,0,0,.72),inset 0 0 0 1px rgba(255,240,205,.12)}.bajsas-game-modal.lobby-mode .bajsas-game-head{border-bottom:2px groove #9c764f;padding:2px 2px 8px;color:#ffe8bd}.bajsas-game-modal.lobby-mode .custom-stream-btn{background:linear-gradient(#8a6545,#5b3e29)!important;color:#fff0d2!important;border:1px solid #b99368!important;box-shadow:inset 0 1px rgba(255,255,255,.18),0 2px 2px rgba(0,0,0,.4)}.bajsas-game-modal.lobby-mode .custom-stream-btn:hover{background:linear-gradient(#a57b54,#6d4a30)!important}.bajsas-game-modal.lobby-mode [data-room-create]{background:linear-gradient(#cf493d,#8f241f)!important;border-color:#e67c67!important}.bajsas-game-modal.lobby-mode [data-room-name],.bajsas-game-modal.lobby-mode [data-room-time]{background:#f7e6c4!important;color:#2b1c12!important;border:2px inset #c9a87a!important;border-radius:4px!important}.bajsas-game-modal.lobby-mode [data-game-status]{color:#dbc39c;font-weight:700}.bajsas-game-window{position:relative;width:100%;background:linear-gradient(rgba(81,69,55,.9),rgba(44,38,31,.88));color:#f6e6bd;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:2px solid #88765c;border-radius:7px;padding:9px;box-shadow:0 18px 55px #000}.bajsas-game-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}.bajsas-game-board{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));grid-template-rows:repeat(8,minmax(0,1fr));width:calc(100% - 20px);max-width:420px;aspect-ratio:1;margin:0 auto;container-type:inline-size;border:3px ridge rgba(154,129,93,.82);background:rgba(40,29,20,.5);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);box-shadow:inset 0 0 18px rgba(0,0,0,.62),0 7px 18px rgba(0,0,0,.38);transform:translateZ(0);overflow:hidden}.bajsas-game-cell{display:grid;place-items:center;border:0;padding:0;min-width:0;min-height:0;overflow:hidden}.bajsas-game-cell.light{background:rgba(201,181,141,.5)}.bajsas-game-cell.dark{background:rgba(114,84,61,.5)}.bajsas-piece{position:relative;display:grid;place-items:center;width:72%;height:auto;aspect-ratio:1;border-radius:50%;box-sizing:border-box;box-shadow:inset 0 0 0 3px rgba(255,255,255,.18),0 3px 5px #000}.bajsas-piece.red{background:#d9382f}.bajsas-piece.black{background:#151515}.bajsas-piece.king:after{content:'★';position:absolute;inset:0;display:grid;place-items:center;color:#ffd54f;font-size:clamp(11px,4.5cqi,18px);line-height:1;pointer-events:none}.bajsas-game-cell.selected{outline:4px solid #69f0ae;outline-offset:-4px}.bajsas-game-cell.legal{box-shadow:inset 0 0 0 5px rgba(255,213,79,.78)}.bajsas-game-cell.selectable .bajsas-piece{filter:drop-shadow(0 0 5px #fff1a8)}.bajsas-game-controls{display:flex;gap:6px;align-items:center;margin-bottom:7px;flex-wrap:wrap}.bajsas-game-controls select{background:#211d18;color:#fff;border:1px solid #8b7759;padding:5px}.bajsas-lobby{background:rgba(30,20,13,.82);border:2px inset #8d6947;padding:8px;border-radius:5px;max-height:310px;overflow:auto;scrollbar-color:#8d6947 #2a1d14}.bajsas-room-card{position:relative;background:linear-gradient(90deg,#f5e4c2,#dcc096);color:#2b211a;border:2px solid #8b6745;border-radius:6px;padding:9px 9px 9px 42px;margin-bottom:8px;box-shadow:0 3px 0 #160e09,inset 0 0 0 1px #fff4dc}.bajsas-room-card:before{content:"";position:absolute;left:9px;top:10px;width:23px;height:23px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff6b62,#b51f1a 65%,#6d0e0b);box-shadow:inset 0 0 0 2px rgba(255,255,255,.22),0 2px 2px rgba(0,0,0,.45)}.bajsas-room-card:nth-child(even):before{background:radial-gradient(circle at 35% 30%,#555,#151515 65%,#000)}.bajsas-room-top{display:flex;justify-content:space-between;gap:8px;font-weight:900}.bajsas-room-top span:last-child{background:#2b211a;color:#f8d989;border-radius:99px;padding:2px 7px;font-size:10px}.bajsas-room-meta{font-size:10px;color:#715f49;margin:5px 0 7px}.bajsas-room-actions{display:flex;gap:5px;justify-content:flex-end}.bajsas-room-actions button{border:1px solid #5e4933;border-radius:5px;padding:4px 12px;font-weight:900;cursor:pointer;box-shadow:0 2px 0 #3d2c1e}.bajsas-room-join{background:#c9332d;color:#fff}.bajsas-room-watch{background:#27211d;color:#f7e7c1}.bajsas-lobby-empty{text-align:center;padding:30px 8px;color:#ddc79d}.bajsas-game-score{display:grid;grid-template-columns:1fr auto 1fr;gap:7px;align-items:center;margin:7px 0;text-align:center}.bajsas-game-player{background:rgba(0,0,0,.25);padding:5px;border:1px solid #76644c}.bajsas-game-clock{font:bold 16px monospace;color:#fff}.bajsas-game-actions{display:flex;justify-content:center;gap:6px;margin-top:8px;flex-wrap:wrap}.bajsas-game-head>b{font-size:13px;letter-spacing:.025em;text-shadow:0 1px 2px #000}.bajsas-game-head [data-game-side]{background:rgba(0,0,0,.26);border:1px solid rgba(255,222,160,.25);padding:3px 7px;border-radius:99px;font-size:10px}.bajsas-game-cell{position:relative;transition:filter .12s,transform .12s}.bajsas-game-cell:hover{filter:brightness(1.08)}.bajsas-game-cell.last-move{box-shadow:inset 0 0 0 3px rgba(88,184,255,.58)}.bajsas-game-cell.legal{box-shadow:none}.bajsas-game-cell.legal:after{content:"";position:absolute;width:25%;height:25%;border-radius:50%;background:rgba(255,222,82,.88);box-shadow:0 0 0 3px rgba(59,35,15,.3),0 0 12px rgba(255,222,82,.75)}.bajsas-piece{transition:transform .14s,filter .14s}.bajsas-game-cell.selectable:hover .bajsas-piece{transform:translateY(-2px) scale(1.04)}.bajsas-piece.red{background:radial-gradient(circle at 35% 28%,#ff766d,#cf302a 48%,#7e1512 78%)}.bajsas-piece.black{background:radial-gradient(circle at 35% 28%,#686868,#242424 48%,#050505 80%)}.bajsas-game-player{transition:border-color .15s,box-shadow .15s,background .15s}.bajsas-game-player.active{border-color:#ffd45e;background:rgba(255,204,64,.1);box-shadow:0 0 0 1px rgba(255,212,94,.28),0 0 14px rgba(255,191,52,.18)}.bajsas-game-player.me{outline:1px solid rgba(105,240,174,.48);outline-offset:1px}.bajsas-game-controls [data-game-status]{display:inline-block;padding:3px 7px;border-radius:99px;background:rgba(0,0,0,.24);font-size:10px}.bajsas-game-resize:hover{color:#ffe082!important;transform:scale(1.08)}@media(prefers-reduced-motion:reduce){.bajsas-game-modal.show{animation:none}.bajsas-game-cell,.bajsas-piece{transition:none}}@keyframes bajGameIn{from{opacity:0;transform:translate3d(16px,10px,0) scale(.96)}to{opacity:1;transform:none}}@media(max-width:800px){.bajsas-game-modal{width:290px;min-width:230px;max-width:88vw;right:8px;bottom:72px}.bajsas-game-board{width:calc(100% - 16px)}}
 `;
 document.head.appendChild(s);
 };

 injectLiveDotStyle();

 // Warm network handshakes without starting hidden video players. Preloading
 // every iframe wastes bandwidth and can trigger ads/autoplay limits; preconnect
 // gives most of the startup benefit with no stream downloads.
 const playerOrigins = [
 'https://player.twitch.tv',
 'https://player.kick.com',
 'https://player.angelthump.com',
 'https://www.youtube-nocookie.com',
 'https://static-cdn.jtvnw.net',
 'https://files.kick.com',
 'https://thumbnail.angelthump.com',
 'https://i.ytimg.com'
 ];
 for (const origin of playerOrigins) {
 if (document.head.querySelector(`link[data-bajsas-preconnect="${origin}"]`)) continue;
 const link = document.createElement('link');
 link.rel = 'preconnect'; link.href = origin; link.crossOrigin = 'anonymous';
 link.dataset.bajsasPreconnect = origin;
 document.head.appendChild(link);
 }
 dbg('network:preconnect', { origins: playerOrigins.length });

 const extractTwitchLogin = (url) => {
 try {
 const u = new URL(url);
 return u.searchParams.get('channel') || u.pathname.split('/').filter(Boolean)[0] || '';
 } catch {
 return '';
 }
 };

 const extractKickSlug = (url) => {
 try {
 const u = new URL(url);
 return u.pathname.split('/').filter(Boolean)[0] || '';
 } catch {
 return '';
 }
 };

 const extractAngelthumpChannel = (url) => {
 try {
 const u = new URL(url);
 const parts = u.pathname.split('/').filter(Boolean);
 return u.searchParams.get('channel') || parts.at(-1) || '';
 } catch {
 return '';
 }
 };

 const extractYouTubeVideoId = (url) => {
 try {
 const u = new URL(url);
 const host = u.hostname.toLowerCase().replace(/^www\./, '');
 if (host === 'youtu.be') return u.pathname.split('/').filter(Boolean)[0] || '';
 if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
 if (u.searchParams.get('v')) return u.searchParams.get('v');
 const parts = u.pathname.split('/').filter(Boolean);
 if (['embed', 'live', 'shorts'].includes(parts[0])) return parts[1] || '';
 }
 return '';
 } catch {
 return '';
 }
 };

 const isYouTubeUrl = (url) => /(?:youtube(?:-nocookie)?\.com|youtu\.be)/i.test(url || '');

 const checkLiveStatus = async (url) => {
 if (!url) return false;

 const cached = liveCache.get(url);
 // YouTube status is fetched once per BajSAS page session.
 if (cached && (isYouTubeUrl(url) || Date.now() - cached.time < 30000)) {
 return cached.live;
 }

 let live = false;

 try {
 if (url.includes('twitch.tv')) {
 const login = extractTwitchLogin(url);
 if (login) {
 const res = await fetch('https://gql.twitch.tv/gql', {
 method: 'POST',
 headers: {
 'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 query: `query { user(login: "${login}") { stream { type } } }`
 })
 });

 const data = await res.json();
 live = data?.data?.user?.stream?.type === 'live';
 }
 }

 else if (url.includes('kick.com')) {
 const slug = extractKickSlug(url);
 if (slug) {
 const res = await fetch(`https://kick.com/api/v2/channels/${slug}`);
 const data = await res.json();
 live = !!data?.livestream;
 }
 }

 else if (url.includes('angelthump.com')) {
 const channel = extractAngelthumpChannel(url);
 if (channel) {
 const res = await fetch(`https://api.angelthump.com/v3/streams?username=${encodeURIComponent(channel)}`);
 const data = await res.json();
 live = Array.isArray(data) && data[0]?.type === 'live';
 }
 }

 else if (isYouTubeUrl(url)) {
 const videoId = extractYouTubeVideoId(url);
 if (videoId) {
 // The API key remains server-side in the Worker's YOUTUBE_API_KEY secret.
 const res = await fetch(`${WORKER_BASE_URL}/youtube-live?id=${encodeURIComponent(videoId)}`, {
 cache: 'no-store'
 });
 if (!res.ok) throw new Error(`YouTube live check failed: ${res.status}`);
 const data = await res.json();
 live = data?.live === true;
 }
 }

 else {
 live = false;
 }
 } catch {
 live = false;
 }

 liveCache.set(url, { live, time: Date.now() });
 return live;
 };

 const createForsenChat = () => {
 document.getElementById('forsen-chat-container')?.remove();

 const chat = document.querySelector('[data-a-target="right-column-chat-bar"]');
 if (!chat) return;

 chat.style.width = '50%';
 chat.style.flex = '0 0 50%';

 const container = document.createElement('div');
 container.id = 'forsen-chat-container';
 Object.assign(container.style, {
 width: '100%',
 height: '100%',
 display: 'flex',
 flexDirection: 'column',
 background: '#18181b',
 borderLeft: '1px solid rgba(255,255,255,0.08)'
 });

 const title = document.createElement('div');
 title.textContent = 'Forsen Chat';
 Object.assign(title.style, {
 padding: '10px',
 fontWeight: '700',
 fontSize: '13px',
 borderBottom: '1px solid rgba(255,255,255,0.08)',
 color: '#fff'
 });

 const iframe = document.createElement('iframe');
 iframe.src = 'https://www.twitch.tv/popout/forsen/chat?popout=';
 Object.assign(iframe.style, {
 flex: '1',
 width: '100%',
 border: 'none',
 background: '#18181b'
 });

 container.appendChild(title);
 container.appendChild(iframe);

 chat.parentNode.style.display = 'flex';
 chat.parentNode.insertBefore(container, chat.nextSibling);
 chat.style.flex = '0 0 0%';
 };

 const removeForsenChat = () => {
 document.getElementById('forsen-chat-container')?.remove();

 const chat = document.querySelector('[data-a-target="right-column-chat-bar"]');
 if (chat) {
 chat.style.width = '';
 chat.style.flex = '';
 }
 };

 const findStablePlayerContainer = () => {
 const video = document.querySelector('video');
 return video?.closest('[data-a-target="video-player"], [data-test-selector="video-player__video-container"], .video-player, .persistent-player')
 || video?.parentElement?.parentElement
 || video?.parentElement;
 };
 let targetContainer = findStablePlayerContainer();
 targetContainer.style.position = 'relative';
 targetContainer.classList.add('stream-container-mod');

 // Do not rely on :hover for visibility. Twitch can replace/cover the native
 // video during an ad while the container remains hovered, leaving the UI at
 // full opacity indefinitely. Treat recent pointer activity as the signal and
 // always return to the idle opacity after a short delay.
 let streamUiIdleTimer = null;
 const setStreamUiActive = () => {
 targetContainer.classList.add('stream-ui-active');
 clearTimeout(streamUiIdleTimer);
 streamUiIdleTimer = setTimeout(() => {
 targetContainer.classList.remove('stream-ui-active');
 }, 2500);
 };
 const setStreamUiIdle = () => {
 clearTimeout(streamUiIdleTimer);
 targetContainer.classList.remove('stream-ui-active');
 };
 const boundPlayerContainers = new WeakSet();
 const bindPlayerContainer = container => {
 if (!container || boundPlayerContainers.has(container)) return;
 boundPlayerContainers.add(container);
 container.addEventListener('pointermove', setStreamUiActive, { passive: true });
 container.addEventListener('pointerdown', setStreamUiActive, { passive: true });
 container.addEventListener('pointerleave', setStreamUiIdle, { passive: true });
 };
 bindPlayerContainer(targetContainer);
 window.addEventListener('blur', setStreamUiIdle);
 document.addEventListener('visibilitychange', () => {
 if (document.hidden) setStreamUiIdle();
 });

 const wrapper = document.createElement('div');
 wrapper.id = 'custom-stream-wrapper';
 wrapper.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:9999;pointer-events:none;';

 const i = document.createElement('iframe');
 i.allow = "autoplay; fullscreen";
 i.style.cssText = 'width:100%;height:100%;border:none;pointer-events:auto;';
 wrapper.appendChild(i);

 const box = document.createElement('div');
 box.id = 'custom-stream-ui';
 box.style.cssText = 'position:absolute;bottom:75px;left:0px;padding:5px 8px;background:rgba(0,0,0,0.85);backdrop-filter:blur(4px);color:#fff;border-radius:6px;font-family:sans-serif;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;flex-direction:column;gap:4px;pointer-events:auto;';

 const label = document.createElement('div');
 label.innerText = '☰  Select stream';
 label.style.cssText = 'font-size:11px;font-weight:bold;text-transform:uppercase;opacity:0.72;letter-spacing:0.5px;line-height:18px;display:flex;align-items:center;gap:4px;';
 box.appendChild(label);

 const btnRow = document.createElement('div');
 btnRow.style.cssText = 'display:flex;column-gap:5px;row-gap:4px;align-items:center;flex-wrap:wrap;';
 box.appendChild(btnRow);

 let activeBtn = null;

 const setActive = (btn) => {
 if (activeBtn) {
 activeBtn.style.background = '#444';
 activeBtn.style.transform = 'none';
 }

 btn.style.background = '#00c853';
 btn.style.transform = 'scale(1.05)';
 activeBtn = btn;
 };

 const formatUrl = (url) => {
 if (isYouTubeUrl(url)) {
 const videoId = extractYouTubeVideoId(url);
 if (videoId) {
 return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&mute=0&playsinline=1`;
 }
 }
 const connector = url.includes('?') ? '&' : '?';
 return `${url}${connector}autoplay=1&muted=0`;
 };

 const setLivePulsePhase=btn=>{btn.style.animationDelay=`-${Date.now()%2000}ms`};
 const updateBtnLiveUI = async (btn, url, desc, name) => {
 const live = await checkLiveStatus(url);
 btn.classList.toggle('is-live', live);
 if(live)setLivePulsePhase(btn);else btn.style.removeProperty('animation-delay');
 btn.title = `${desc || name}${live ? ' — LIVE' : ' — offline/unknown'}`;
 };

 let buttonPreviewCard = null;
 let buttonPreviewTimer = null;
 let buttonPreviewToken = 0;
 let buttonPreviewVisibleUrl = '';
 let buttonPreviewRefreshTimer = null;
 const buttonPreviewCache = new Map();
 const buttonPreviewInflight = new Map();
 const buttonPreviewImages = new Map();

 const preloadPreviewImage = async (url) => {
 if (!url) return null;
 if (buttonPreviewImages.has(url)) return buttonPreviewImages.get(url);
 const image = new Image();
 image.decoding = 'async'; image.fetchPriority = 'low'; image.referrerPolicy = 'no-referrer';
 const promise = new Promise(resolve => {
 image.onload = async () => { try { await image.decode?.(); } catch {} resolve(image); };
 image.onerror = () => resolve(null);
 });
 image.src = url;
 buttonPreviewImages.set(url, promise);
 return promise;
 };

 const withPreviewCacheBust = imageUrl => {
 if (!imageUrl) return '';
 try { const u = new URL(imageUrl); u.searchParams.set('_bajts', String(Date.now())); return u.toString(); }
 catch { return imageUrl; }
 };

 const getButtonPreview = async (name, url) => {
 const cached = buttonPreviewCache.get(url);
 const cacheTtl = url.includes('kick.com') ? 10000 : 60000;
 if (cached && Date.now() - cached.at < cacheTtl) return cached.data;
 if (buttonPreviewInflight.has(url)) return buttonPreviewInflight.get(url);
 const task = (async () => {
 let data = { title: name, platform: 'Stream', image: '' };
 try {
 if (url.includes('twitch.tv')) {
 const login = extractTwitchLogin(url);
 let user = null;
 if (login) {
 try {
 const r = await fetch('https://gql.twitch.tv/gql', {
 method: 'POST',
 headers: { 'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko', 'Content-Type': 'application/json' },
 body: JSON.stringify({ query: `query { user(login: "${login}") { displayName profileImageURL(width: 320) bannerImageURL stream { type previewImageURL(width: 320, height: 180) } } }` })
 });
 user = (await r.json())?.data?.user;
 } catch {}
 }
 const live = user?.stream?.type === 'live';
 data = {
 title: user?.displayName || name,
 platform: 'Twitch', live,
 image: live
 ? (user?.stream?.previewImageURL || `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login.toLowerCase()}-320x180.jpg?t=${Date.now()}`)
 : (user?.bannerImageURL || user?.profileImageURL || '')
 };
 } else if (isYouTubeUrl(url)) {
 const id = extractYouTubeVideoId(url);
 data = { title: name, platform: 'YouTube', image: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '' };
 } else if (url.includes('kick.com')) {
 const slug = extractKickSlug(url);
 let j = null;
 try {
 // Kick often blocks Cloudflare Worker IPs but allows its public API from
 // browsers. Prefer the direct request and use the Worker only as fallback.
 const r = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`);
 if (r.ok) j = await r.json();
 } catch {}
 if (j) {
 const thumb = typeof j?.livestream?.thumbnail === 'string' ? j.livestream.thumbnail : j?.livestream?.thumbnail?.url;
 data = {
 title: j?.livestream?.session_title || j?.user?.username || name,
 platform: 'Kick',
 image: withPreviewCacheBust(thumb || j?.banner_image?.url || (!j?.livestream ? (j?.offline_banner_image?.src || j?.offline_banner_image?.url || j?.user?.profile_pic) : '') || ''),
 live: !!j?.livestream
 };
 } else {
 const r = await fetch(`${WORKER_BASE_URL}/stream-preview?url=${encodeURIComponent(url)}`, { cache: 'no-store' });
 const fallback = await r.json();
 data = { title: fallback.title || name, platform: 'Kick', image: withPreviewCacheBust(fallback.image || ''), live: fallback.live === true };
 }
 } else if (url.includes('angelthump.com')) {
 const r = await fetch(`${WORKER_BASE_URL}/stream-preview?url=${encodeURIComponent(url)}`, { cache: 'no-store' });
 const j = await r.json();
 data = { title: j.title || name, platform: 'AngelThump', image: j.image || '', live: j.live === true };
 }
 } catch {}
 buttonPreviewCache.set(url, { data, at: Date.now() });
 if (data.image && data.live !== false) preloadPreviewImage(data.image).catch(() => {});
 return data;
 })();
 buttonPreviewInflight.set(url, task);
 try { return await task; }
 finally { buttonPreviewInflight.delete(url); }
 };

 const warmButtonPreviews = () => {
 dbg('preview:warm-start', { channels: channels.length });
 const jobs = channels.filter(([, url]) => url).map(([name, url]) => () => getButtonPreview(name, url));
 let cursor = 0;
 const worker = async () => { while (cursor < jobs.length) { const job = jobs[cursor++]; try { await job(); } catch {} } };
 const start = () => Promise.all([worker(), worker(), worker()]);
 if ('requestIdleCallback' in window) requestIdleCallback(() => start(), { timeout: 1800 });
 else setTimeout(start, 500);
 };

 const hideButtonPreview = () => {
 clearTimeout(buttonPreviewTimer); clearTimeout(buttonPreviewRefreshTimer); const token = ++buttonPreviewToken;
 if (!buttonPreviewCard) return;
 buttonPreviewCard.classList.remove('show');
 setTimeout(() => { if (token === buttonPreviewToken) buttonPreviewCard.style.display = 'none'; }, 190);
 };

 const makeStatusBanner = (platform, state = 'offline') => {
 const banner = document.createElement('div'); banner.className = 'bajsas-offline-banner' + (state === 'live' ? ' is-live' : '');
 const icon = document.createElement('div'); icon.className = 'bajsas-offline-icon';
 if (state === 'loading') {
 icon.textContent = '…';
 } else {
 const emote = document.createElement('img');
 emote.src = 'https://cdn.7tv.app/emote/01F6NS89X000013ACMMJPDTDNP/4x.webp';
 emote.alt = state === 'live' ? 'Live' : 'Offline';
 emote.decoding = 'async';
 icon.appendChild(emote);
 }
 const label = document.createElement('div'); label.className = 'bajsas-offline-label';
 label.textContent = state === 'loading' ? 'Loading Preview' : state === 'live' ? 'Live • Preview Unavailable' : 'Channel Offline';
 const source = document.createElement('div'); source.className = 'bajsas-offline-platform'; source.textContent = platform || 'Stream';
 banner.append(icon, label, source); return banner;
 };

 const renderButtonPreview = (name, data) => {
 buttonPreviewCard.replaceChildren();
 // Use one consistent generated design for every confirmed offline channel,
 // even when the platform supplies its own offline banner.
 if (data.live === false) {
 buttonPreviewCard.appendChild(makeStatusBanner(data.platform, data.live === true ? 'live' : 'offline'));
 } else if (data.image) {
 const img = document.createElement('img'); img.src = data.image; img.alt = ''; img.decoding = 'async'; img.fetchPriority = 'high'; img.referrerPolicy = 'no-referrer';
 img.onerror = () => img.replaceWith(makeStatusBanner(data.platform, data.live === true ? 'live' : 'offline')); buttonPreviewCard.appendChild(img);
 } else {
 buttonPreviewCard.appendChild(makeStatusBanner(data.platform, data.loading === true ? 'loading' : data.live === true ? 'live' : 'offline'));
 }
 const title = document.createElement('div'); title.className = 'bajsas-stream-preview-title'; title.textContent = data.title || name;
 const meta = document.createElement('div'); meta.className = 'bajsas-stream-preview-meta';
 const state = data.live === true ? ' • LIVE' : data.live === false ? ' • OFFLINE' : '';
 meta.textContent = data.platform + state;
 buttonPreviewCard.append(title, meta);
 };

 const showButtonPreview = (btn, name, url) => {
 dbg('preview:hover', { name, url });
 clearTimeout(buttonPreviewTimer); const token = ++buttonPreviewToken; const rect = btn.getBoundingClientRect();
 buttonPreviewTimer = setTimeout(async () => {
 if (!buttonPreviewCard) { buttonPreviewCard = document.createElement('div'); buttonPreviewCard.className = 'bajsas-stream-preview'; document.body.appendChild(buttonPreviewCard); }
 const cached = buttonPreviewCache.get(url)?.data;
 renderButtonPreview(name, cached || { title: name, platform: 'Stream', image: '', loading: true });
 buttonPreviewVisibleUrl = url;
 buttonPreviewCard.style.display = 'block';
 buttonPreviewCard.style.left = Math.max(8, Math.min(innerWidth - 300, rect.left)) + 'px';
 buttonPreviewCard.style.top = Math.max(8, rect.top > 215 ? rect.top - 205 : rect.bottom + 8) + 'px';
 requestAnimationFrame(() => requestAnimationFrame(() => { if (token === buttonPreviewToken) buttonPreviewCard.classList.add('show'); }));
 const data = cached || await getButtonPreview(name, url);
 if (token !== buttonPreviewToken || buttonPreviewVisibleUrl !== url) return;
 if (data.image && data.live !== false) await Promise.race([preloadPreviewImage(data.image), new Promise(resolve => setTimeout(resolve, 250))]);
 if (token === buttonPreviewToken) renderButtonPreview(name, data);
 // Kick commonly reuses the same thumbnail URL while replacing the image.
 // Refresh an open preview every 10 seconds and cache-bust the image request.
 if (url.includes('kick.com') && token === buttonPreviewToken) {
 const refresh = async () => {
 if (token !== buttonPreviewToken || buttonPreviewVisibleUrl !== url) return;
 buttonPreviewCache.delete(url);
 const fresh = await getButtonPreview(name, url);
 if (token !== buttonPreviewToken) return;
 if (fresh.image) await Promise.race([preloadPreviewImage(fresh.image), new Promise(resolve => setTimeout(resolve, 250))]);
 if (token === buttonPreviewToken) renderButtonPreview(name, fresh);
 buttonPreviewRefreshTimer = setTimeout(refresh, 10000);
 };
 buttonPreviewRefreshTimer = setTimeout(refresh, 10000);
 }
 }, 60);
 };

 const createBtn = (text, src, desc, isNative = false, emoteUrl = '') => {
 const btn = document.createElement('button');
 btn.className = 'custom-stream-btn';
 btn.dataset.streamSelector = '1';
 btn.title = desc || '';

 const dot = document.createElement('span');
 dot.className = 'live-dot';

 if (emoteUrl && !isNative) {
     const emote = document.createElement('img');
     emote.className = 'btn-emote';
     // Convert gist URL (4x.avif) → 2x.webp for maximum browser compat
     // 2x.webp confirmed HTTP 200 for ALL 18 emotes on 7TV CDN
     const optimizedUrl = emoteUrl.replace(/\/\d+x\.\w+$/, '/2x.webp');
     emote.src = optimizedUrl;
     emote.alt = text;
     let _triedOriginal = false;
     emote.onerror = () => {
         if (!_triedOriginal) {
             _triedOriginal = true;
             emote.src = emoteUrl; // try original URL as last resort
         } else {
             emote.remove(); nameEl.style.display = ''; // give up, show text
         }
     };
     btn.appendChild(dot);
     btn.appendChild(emote);
 } else {
     btn.appendChild(dot);
 }

 const nameEl = document.createElement('span');
 nameEl.className = 'btn-name';
 nameEl.textContent = text;
 nameEl.style.cssText = 'visibility:visible!important;opacity:1!important;font-size:12px!important;font-weight:bold!important;color:#fff!important;white-space:nowrap!important;overflow:visible!important;display:block!important;';
 btn.appendChild(nameEl);

     btn.onclick = (event) => {
         if (isNative) {
             dbg('player:native-selected', { source: event?.isTrusted ? 'user' : 'script' });
 v.muted = false;
 try { v.play(); } catch {}
 i.src = '';
 i.style.display = 'none';
 removeForsenChat();
         } else {
             dbg('player:overlay-selected', { name: text, url: src, source: event?.isTrusted ? 'user' : 'script' });
             v.muted = true;

             i.src = formatUrl(src);
 i.style.display = 'block';

 if (text.toLowerCase() === 'forsen') {
 localStorage.setItem(LS_FORSEN, "1");
 createForsenChat();
 } else {
 localStorage.setItem(LS_FORSEN, "0");
 removeForsenChat();
 }
 }

     // Do not persist the selected stream across app/page starts.
     setActive(btn);
 };

 if (!isNative && src) {
 btn.addEventListener('mouseenter', () => showButtonPreview(btn, text, src));
 btn.addEventListener('mouseleave', hideButtonPreview);
 updateBtnLiveUI(btn, src, desc, text);
 }

 return btn;
 };

 const nativeBtn = createBtn('Twitch', '', 'Watch default Twitch stream', true);
 btnRow.appendChild(nativeBtn);

 let isInitialized = false;

 if (savedStream === 'Twitch') {
 nativeBtn.onclick();
 isInitialized = true;
 }

 channels.forEach(([name, url, desc, emote], index) => {
 const btn = createBtn(name, url, desc, false, emote || '');
 btn.dataset.streamName = name;
 btn.dataset.streamUrl = url;
 btn.dataset.streamDesc = desc || '';
 btn.dataset.streamEmote = emote || '';
 btnRow.appendChild(btn);

 const isDefault = savedStream ? (savedStream === name) : (!isInitialized && index === 0);
 if (isDefault) {
 btn.onclick();
 isInitialized = true;
 }
 });

 if (!isInitialized) {
 nativeBtn.onclick();
 }

 const sep = document.createElement('div');
 sep.innerText = '|';
 sep.style.cssText = 'color:#666;font-weight:bold;padding:0 2px;user-select:none;';
 btnRow.appendChild(sep);

 const triggerTheater = () => {
 const b = [...document.querySelectorAll('button')].find(el => {
 const a = (el.getAttribute('aria-label') || '').toLowerCase();
 const t = (el.textContent || '').toLowerCase();
 return a.includes('theater') || a.includes('theatre') || t.includes('theater') || t.includes('theatre');
 });

 if (b) b.click();
 };

 const theaterBtn = document.createElement('button');
 theaterBtn.innerText = '⧉';
 theaterBtn.title = 'Theater Mode';
 theaterBtn.style.cssText = 'cursor:pointer;padding:4px 8px;border:none;border-radius:4px;color:#fff;font-weight:bold;font-size:14px;transition:0.1s;';

 const updateTheaterUI = (active) => {
 theaterBtn.style.background = active ? '#00c853' : '#555';
 };

 theaterBtn.onclick = () => {
 const wasActive = localStorage.getItem(LS_THEATER) === "1";
 const newState = !wasActive;

 localStorage.setItem(LS_THEATER, newState ? "1" : "0");
 triggerTheater();
 updateTheaterUI(newState);
 };

 btnRow.appendChild(theaterBtn);

 if (isTheaterSaved) {
 triggerTheater();
 updateTheaterUI(true);
 } else {
 updateTheaterUI(false);
 }

 const refreshBtn = document.createElement('button');
 refreshBtn.innerText = '↻';
 refreshBtn.title = 'Refresh stream';
 refreshBtn.style.cssText = 'cursor:pointer;padding:4px 8px;border:none;border-radius:4px;background:#555;color:#fff;font-weight:bold;font-size:14px;';

 refreshBtn.onclick = () => {
 if (i.style.display !== 'none') {
 const cur = i.src;
 i.src = '';
 setTimeout(() => i.src = cur, 50);
 }

 [...btnRow.querySelectorAll('.custom-stream-btn')].forEach(btn => {
 const url = btn.dataset.streamUrl;
 if (!url || isYouTubeUrl(url)) return;

 liveCache.delete(url);
 updateBtnLiveUI(
 btn,
 url,
 btn.dataset.streamDesc || '',
 btn.dataset.streamName || btn.textContent.trim()
 );
 });
 };

 btnRow.appendChild(refreshBtn);

 if (!hideUntilHover) {
 const hideBtn = document.createElement('button');
 hideBtn.innerText = 'Hide this UI until hover';
 hideBtn.style.cssText = 'cursor:pointer;padding:4px 8px;border:none;border-radius:4px;background:#c62828;color:#fff;font-size:11px;font-weight:bold;margin-top:4px;';

 hideBtn.onclick = () => {
 localStorage.setItem(LS_HIDE, "1");
 targetContainer.classList.add('stream-hide-ui');
 hideBtn.remove();
 };

 box.appendChild(hideBtn);
 } else {
 targetContainer.classList.add('stream-hide-ui');
 }

 setInterval(() => {
 [...btnRow.querySelectorAll('.custom-stream-btn')].forEach(btn => {
 const url = btn.dataset.streamUrl;
 if (!url || isYouTubeUrl(url)) return;

 updateBtnLiveUI(
 btn,
 url,
 btn.dataset.streamDesc || '',
 btn.dataset.streamName || btn.textContent.trim()
 );
 });
 }, 60000);

 wrapper.appendChild(box);
 targetContainer.appendChild(wrapper);

 // Twitch replaces player DOM during ads, quality changes, and SPA navigation.
 // Keep the existing iframe alive and move it to the new stable player host
 // instead of exposing the native player and appearing to switch streams.
 const playerMountWatchdog = setInterval(() => {
 if (wrapper.isConnected && targetContainer.isConnected) return;
 const nextContainer = findStablePlayerContainer();
 if (!nextContainer) return;
 const previous = targetContainer;
 targetContainer = nextContainer;
 targetContainer.style.position = 'relative';
 targetContainer.classList.add('stream-container-mod');
 if (hideUntilHover) targetContainer.classList.add('stream-hide-ui');
 bindPlayerContainer(targetContainer);
 targetContainer.appendChild(wrapper);
 dbg('player:wrapper-reattached', { previousConnected: previous?.isConnected || false });
 }, 250);

 // Warm metadata and decode thumbnails during idle time so hover performs no
 // network or image-decoding work on the interaction frame.
 warmButtonPreviews();

 // ═══════════════════════════════════════════════════════════════════
 // BajSAS Chat Watch Badges — lightweight
 // Badges show the watched channel and switch the existing overlay.
 // Works with native Twitch, 7TV, BTTV, and FFZ.
 // ═══════════════════════════════════════════════════════════════════
 {
     const BASE_URL   = 'https://bitter-meadow-24f3.jeffvanss1.workers.dev';
     const PING_KEY   = 'bajsas_ping_2024'; // sent in ?key= and POST body for auth
 const WS_URL = 'wss://' + BASE_URL.replace('https://','') + '/ws?key=bajsas_secret_2024&version=' + encodeURIComponent(APP_VERSION);
 const PING_URL = BASE_URL + '/ping';
 const TOKEN_URL = BASE_URL + '/token';

 const WATCH_CACHE_KEY = 'bajsas_watch_cache_v1';
 const WATCH_CACHE_TTL = 24 * 60 * 60 * 1000; // bootstrap cache; WebSocket replaces it after connect
 let bwm = new Map(); // authoritative live map
 const bLocalWatchCache = new Map(); // fast startup/message fallback
 try {
 const cached = JSON.parse(localStorage.getItem(WATCH_CACHE_KEY) || '[]');
 const now = Date.now();
 for (const [username, info] of cached) {
 if (username && info?.channel && now - (info.lastSeen || 0) < WATCH_CACHE_TTL) {
 bLocalWatchCache.set(username, info);
 bwm.set(username, info);
 }
 }
 dbg('watch-cache:hydrated', { entries: bwm.size });
 } catch (error) { dbg('watch-cache:error', { error: String(error) }); }
 const bSaveWatchCache = () => {
 try {
 const now = Date.now();
 for (const [username, info] of bwm) if (info?.channel) bLocalWatchCache.set(username, info);
 const entries = [...bLocalWatchCache].filter(([, info]) => info?.channel && now - (info.lastSeen || 0) < WATCH_CACHE_TTL).slice(0, 500);
 localStorage.setItem(WATCH_CACHE_KEY, JSON.stringify(entries));
 dbg('watch-cache:saved', { entries: entries.length });
 } catch (error) { dbg('watch-cache:save-error', { error: String(error) }); }
 };
 const bOfflineTimers = new Map(); // username → pending offline timeout
 const bPresenceUsers = new Map();
 const expandedPresenceGroups = new Set();
 const presencePanel = document.createElement('div'); presencePanel.className = 'bajsas-presence-panel';
 const presenceButton = document.createElement('button'); presenceButton.className = 'custom-stream-btn bajsas-presence-toggle'; presenceButton.textContent = '👥 Online 0'; presenceButton.title = 'Show online BajSAS users';
 const renderPresence = () => {
   const users = [...bPresenceUsers.values()].filter(user => user.online);
   presenceButton.textContent = `👥 Online ${users.length}`;
   presencePanel.replaceChildren();
   if (!users.length) { const empty=document.createElement('div'); empty.className='bajsas-presence-empty'; empty.textContent='No online users'; presencePanel.appendChild(empty); return; }
   const groups = new Map();
   for (const user of users) {
     const channel = String(user.watching || 'Not watching').trim() || 'Not watching';
     const key = channel.toLowerCase();
     if (!groups.has(key)) groups.set(key, { key, channel, users:[] });
     groups.get(key).users.push(user);
   }
   const sortedGroups = [...groups.values()].sort((a,b) => b.users.length - a.users.length || a.channel.localeCompare(b.channel));
   for (const group of sortedGroups) {
     group.users.sort((a,b) => a.username.localeCompare(b.username));
     const section=document.createElement('details'); section.className='bajsas-presence-group'; section.open=expandedPresenceGroups.has(group.key);
     section.addEventListener('toggle',()=>{if(section.open)expandedPresenceGroups.add(group.key);else expandedPresenceGroups.delete(group.key)});
     const header=document.createElement('summary'); header.className='bajsas-presence-channel';
     const channel=document.createElement('span'); channel.className='bajsas-presence-channel-name'; channel.textContent=group.channel; channel.title=group.channel;
     const count=document.createElement('span'); count.className='bajsas-presence-count'; count.textContent=String(group.users.length);
     header.append(channel,count); section.appendChild(header);
     const userList=document.createElement('div'); userList.className='bajsas-presence-users';
     for (const user of group.users) {
       const row=document.createElement('div'); row.className='bajsas-presence-row';
       const status=document.createElement('span'); status.title='Online'; const dot=document.createElement('i'); dot.className='bajsas-presence-dot'; status.appendChild(dot);
       const name=document.createElement('span'); name.className='bajsas-presence-user'; name.textContent=user.username;
       row.append(status,name); userList.appendChild(row);
     }
     section.appendChild(userList); presencePanel.appendChild(section);
   }
 };
 presenceButton.onclick = event => { event.stopPropagation(); const opened=presencePanel.classList.toggle('show'); presenceButton.classList.toggle('panel-open',opened); renderPresence(); };
 wrapper.appendChild(presenceButton); wrapper.appendChild(presencePanel);
 // Introduce the control on launch, then keep it subtle until the player is hovered.
 setTimeout(() => presenceButton.classList.add('is-idle'), 7000);
 presencePanel.addEventListener('click', event => event.stopPropagation());
 document.addEventListener('pointerdown', event => { if (!presencePanel.classList.contains('show')) return; if (presencePanel.contains(event.target) || presenceButton.contains(event.target)) return; presencePanel.classList.remove('show'); presenceButton.classList.remove('panel-open'); }, true);
 document.addEventListener('keydown', event => { if (event.key === 'Escape') { presencePanel.classList.remove('show'); presenceButton.classList.remove('panel-open'); } });
 const mediaPanel=document.createElement('div');mediaPanel.className='bajsas-media';mediaPanel.innerHTML='<iframe allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe><div class="bajsas-media-lock" data-media-sync-status>Sync waiting…</div><div class="bajsas-media-fetch-warning" data-media-fetch-warning><button type="button" data-media-warning-close aria-label="Close">✕</button>Player is taking too long to load. Close DevTools/Console, then close and reopen MAIN 2.</div><div class="bajsas-media-bar"><input placeholder="IMDb link/ID, TMDB ID, or TV ID season episode"><button class="custom-stream-btn" data-media-add>Request</button><button class="custom-stream-btn" data-media-vote>Vote Skip</button><span class="bajsas-media-queue" data-media-status>No media</span><button class="custom-stream-btn" data-media-close>✕</button></div>';wrapper.appendChild(mediaPanel);
 const mediaButton=document.createElement('button');mediaButton.className='custom-stream-btn is-live';mediaButton.textContent='▶ MAIN 2';mediaButton.title='Media Share watch party';mediaButton.dataset.mediaChannel='1';const mainButton=[...btnRow.querySelectorAll('.custom-stream-btn[data-stream-selector="1"]')].find(button=>(button.dataset.streamName||'').toLowerCase()==='main');if(mainButton)mainButton.insertAdjacentElement('afterend',mediaButton);else btnRow.appendChild(mediaButton);setLivePulsePhase(mediaButton);
 let mediaFrame=mediaPanel.querySelector('iframe');const mediaInput=mediaPanel.querySelector('input'),mediaStatus=mediaPanel.querySelector('[data-media-status]'),mediaFetchWarning=mediaPanel.querySelector('[data-media-fetch-warning]'),mediaSyncStatus=mediaPanel.querySelector('[data-media-sync-status]');let mediaFetchTimer=null,mediaFallbackTimer=null;const createMediaFrame=()=>{const frame=document.createElement('iframe');frame.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';frame.setAttribute('allowfullscreen','');mediaPanel.prepend(frame);return frame};const mediaQueueList=document.createElement('div');mediaQueueList.className='bajsas-media-queue-list';document.body.appendChild(mediaQueueList);let mediaCurrentId='',mediaCurrentServer='',mediaCurrentProvider='',mediaAttemptId='',mediaAttemptStartedAt=0,mediaReadyKey='',mediaRevision=0,mediaSuppressUntil=0,mediaClockOffset=0,mediaLastState=null,mediaHoverCard=null,mediaLastObservedTime=-1,mediaLastAdvancedAt=Date.now(),mediaBufferReportedKey='',mediaLastSyncCorrection=0,mediaSyncIgnoreUntil=0,mediaSeekAttemptKey='',mediaWarningDismissed=false,mediaLocalSource='vidfast';
 const renderMediaQueue=state=>{mediaQueueList.replaceChildren();const queue=state?.queue||[],ownNextId=queue.find(item=>item.requestedBy===bGetUser())?.id||'';if(queue.length&&!state?.confirmationOpen){const note=document.createElement('div');note.className='bajsas-media-queue-meta';note.style.padding='7px';note.textContent='Confirmation opens during the final 3 minutes of the current movie.';mediaQueueList.appendChild(note)}if(!queue.length){const empty=document.createElement('div');empty.className='bajsas-presence-empty';empty.textContent='Queue is empty';mediaQueueList.appendChild(empty);return}queue.forEach((item,index)=>{const row=document.createElement('div');row.className='bajsas-media-queue-item';const number=document.createElement('span');number.className='bajsas-media-queue-index';number.textContent=String(index+1);const info=document.createElement('div');const title=document.createElement('div');title.className='bajsas-media-queue-title';title.textContent=item.title+(item.year?' ('+item.year+')':'');const meta=document.createElement('div');meta.className='bajsas-media-queue-meta';const wait=Math.max(0,Number(item.estimatedWaitSec)-(Number.isFinite(Number(state?.serverNow))?Math.max(0,(mediaNow()-Number(state.serverNow))/1000):0)),eta=item.estimatedWaitSec==null?'Waiting time unavailable':wait<90?'Expected next':wait<3600?'Expected in about '+Math.max(1,Math.round(wait/60))+' minutes':'Expected in about '+Math.floor(wait/3600)+' hour'+(Math.floor(wait/3600)===1?'':'s')+(Math.round((wait%3600)/60)?' '+Math.round((wait%3600)/60)+' minutes':'');meta.textContent='Requested by '+item.requestedBy+' • '+(item.confirmedBy?.length||0)+' confirmed • '+eta;info.append(title,meta);const action=document.createElement('span');if(state?.confirmationOpen&&item.requestedBy===bGetUser()&&item.id===ownNextId){const confirm=document.createElement('button');confirm.className='custom-stream-btn';confirm.textContent=item.confirmedBy?.includes(bGetUser())?'✓':'Confirm';confirm.disabled=item.confirmedBy?.includes(bGetUser());confirm.onclick=event=>{event.stopPropagation();sendMedia({type:'media_confirm',itemId:item.id})};action.appendChild(confirm)}else{action.className='bajsas-media-queue-meta';action.textContent=item.confirmedBy?.length?'✓':''}row.append(number,info,action);mediaQueueList.appendChild(row)})};
 mediaStatus.addEventListener('mouseenter',()=>{renderMediaQueue(mediaLastState);mediaQueueList.classList.add('show');const r=mediaStatus.getBoundingClientRect();requestAnimationFrame(()=>{const width=mediaQueueList.offsetWidth,height=mediaQueueList.offsetHeight;mediaQueueList.style.left=Math.max(8,Math.min(innerWidth-width-8,r.right-width))+'px';mediaQueueList.style.top=Math.max(8,r.top-height-8)+'px'})});mediaStatus.addEventListener('mouseleave',()=>setTimeout(()=>{if(!mediaQueueList.matches(':hover'))mediaQueueList.classList.remove('show')},100));mediaQueueList.addEventListener('mouseleave',()=>mediaQueueList.classList.remove('show'));
 const mediaNow=()=>Date.now()+mediaClockOffset;
 const mediaExpectedTime=cur=>{const pb=cur?.playback;if(!pb)return 0;return Math.max(0,Number(pb.position||0)+(pb.playing?(mediaNow()-Number(pb.updatedAt||mediaNow()))/1000:0))};
 const syncMediaClock=async()=>{try{const started=performance.now(),response=await fetch(`${WORKER_BASE_URL}/time?t=${Date.now()}`,{cache:'no-store'}),received=performance.now(),data=await response.json(),midpoint=Date.now()-(received-started)/2,measured=Number(data.now)-midpoint;if(Number.isFinite(measured))mediaClockOffset=mediaClockOffset*.7+measured*.3;dbg('media:clock-sync',{offsetMs:Math.round(mediaClockOffset),rttMs:Math.round(received-started)})}catch(error){dbg('media:clock-sync-error',{error:String(error)})}};
 syncMediaClock();setInterval(syncMediaClock,30000);
 const sendMedia=message=>{if(bws?.readyState===1)bws.send(JSON.stringify(message))};
 const vidfastOrigins=new Set(['https://vidfast.pro','https://vidfast.in','https://vidfast.io','https://vidfast.me','https://vidfast.net','https://vidfast.pm','https://vidfast.xyz','https://vidfast.vc','https://vidfast.bz']);
 const mediaCommand=(command,args={})=>{try{if(mediaLocalSource==='cinesrc')mediaFrame.contentWindow?.postMessage({type:'cinesrc:command',command,args},'https://cinesrc.st');else mediaFrame.contentWindow?.postMessage({command,...args},'*')}catch(error){dbg('media:command-error',{source:mediaLocalSource,command,error:String(error)})}};
 const switchToCineSrc=reason=>{const cur=mediaLastState?.current;if(!cur||mediaLocalSource!=='vidfast'||!mediaPanel.classList.contains('show'))return;const tmdbId=cur.tmdbId||(/^\d+$/.test(String(cur.providerId||''))?cur.providerId:'');if(!tmdbId){mediaFetchWarning.classList.add('show');dbg('media:cinesrc-fallback-unavailable',{reason:'no_tmdb_id'});return}mediaLocalSource='cinesrc';mediaReadyKey='';mediaLastSyncCorrection=0;mediaSuppressUntil=Date.now()+3000;const start=Math.floor(mediaExpectedTime(cur)),params=`autoplay=1&autonext=0&autoskip=0&t=${start}`;mediaSyncStatus.textContent=`CineSrc fallback • Worker ${Math.floor(start/60)}:${String(start%60).padStart(2,'0')} • Player waiting`;clearTimeout(mediaFetchTimer);clearTimeout(mediaFallbackTimer);mediaFetchWarning.classList.remove('show');mediaFrame.src=cur.type==='tv'?`https://cinesrc.st/embed/tv/${encodeURIComponent(tmdbId)}?s=${Number(cur.season||1)}&e=${Number(cur.episode||1)}&${params}`:`https://cinesrc.st/embed/movie/${encodeURIComponent(tmdbId)}?${params}`;mediaFetchTimer=setTimeout(()=>{if(!mediaWarningDismissed)mediaFetchWarning.classList.add('show')},12000);dbg('media:fallback-cinesrc',{reason,start})};
 const applyMediaPlayback=cur=>{const pb=cur?.playback;if(!pb)return;mediaRevision=pb.revision||0;const expected=Math.max(0,mediaExpectedTime(cur));mediaSuppressUntil=Date.now()+2500;mediaCommand('seek',{time:expected});mediaCommand(pb.playing===false?'pause':'play');dbg('media:worker-revision-applied',{revision:mediaRevision,playing:pb.playing!==false,time:expected})};
 const renderMedia=state=>{mediaLastState=state;if(mediaQueueList.classList.contains('show'))renderMediaQueue(state);if(Number.isFinite(Number(state.serverNow))&&Math.abs((Number(state.serverNow)-Date.now())-mediaClockOffset)>2000)mediaClockOffset=Number(state.serverNow)-Date.now();const cur=state.current,main2Visible=mediaPanel.classList.contains('show')&&String(bActiveStream||'').toLowerCase().replace(/\s+/g,'')==='main2';mediaStatus.textContent=cur?`${cur.title}${cur.year?' ('+cur.year+')':''} • by ${cur.requestedBy} • ${state.votes}/${state.required} votes • ${state.queue.length} queued`:'Queue empty';if(!main2Visible){if(mediaCurrentId)destroyMediaPlayer();return}if(cur&&(cur.id!==mediaCurrentId||String(cur.server||'VidFast.vc')!==mediaCurrentServer||String(cur.provider||'vidfast')!==mediaCurrentProvider)){mediaCurrentId=cur.id;mediaLocalSource='vidfast';mediaCurrentServer=String(cur.server||'VidFast.vc');mediaCurrentProvider=String(cur.provider||'vidfast');mediaAttemptId=String(cur.sourceAttemptId||'');mediaAttemptStartedAt=Date.now();mediaReadyKey='';mediaLastSyncCorrection=0;const pb=cur.playback||{playing:true,position:0,updatedAt:cur.startedAt,revision:0};mediaRevision=pb.revision||0;const start=Math.floor(mediaExpectedTime(cur));const playerId=/^tt\d+$/i.test(String(cur.providerId||''))?cur.providerId:(cur.tmdbId||cur.providerId);const params=`autoPlay=true&startAt=${start}&chromecast=false&nextButton=false&autoNext=false&autoSkip=false&theme=${encodeURIComponent(String(state.playerConfig?.color||'e50914').replace(/^#/,''))}&sub=${encodeURIComponent(state.playerConfig?.sub||'en')}`;mediaSyncStatus.textContent=`Worker ${Math.floor(start/60)}:${String(start%60).padStart(2,'0')} • Player waiting`;mediaFrame.src=cur.type==='tv'?`https://vidfast.vc/tv/${encodeURIComponent(playerId)}/${Number(cur.season||1)}/${Number(cur.episode||1)}?${params}`:`https://vidfast.vc/movie/${encodeURIComponent(playerId)}?${params}`;clearTimeout(mediaFetchTimer);mediaFetchWarning.classList.remove('show');mediaFetchTimer=setTimeout(()=>{if(!mediaWarningDismissed)mediaFetchWarning.classList.add('show')},12000);mediaFrame.onload=()=>{dbg('media:vidfast-iframe-loaded');setTimeout(()=>mediaCommand('getStatus'),700);setTimeout(()=>mediaCommand('getStatus'),2500)};clearTimeout(mediaFallbackTimer);mediaFallbackTimer=setTimeout(()=>switchToCineSrc('vidfast_timeout'),20000)}else if(cur&&(cur.playback?.revision||0)>mediaRevision)applyMediaPlayback(cur);if(!cur){mediaCurrentId='';mediaCurrentServer='';mediaCurrentProvider='';mediaAttemptId='';mediaAttemptStartedAt=0;mediaReadyKey='';mediaRevision=0;mediaFrame.src='about:blank';mediaSyncStatus.textContent='Sync waiting…'}};
 const destroyMediaPlayer=()=>{clearTimeout(mediaFetchTimer);clearTimeout(mediaFallbackTimer);mediaFetchWarning.classList.remove('show');mediaPanel.classList.remove('show');mediaQueueList.classList.remove('show');const oldFrame=mediaFrame;oldFrame.onload=null;try{oldFrame.contentWindow?.postMessage({command:'pause'},'*');oldFrame.contentWindow?.postMessage({command:'mute',muted:true},'*');oldFrame.src='about:blank'}catch{}oldFrame.remove();mediaFrame=createMediaFrame();mediaCurrentId='';mediaCurrentServer='';mediaCurrentProvider='';mediaAttemptId='';mediaAttemptStartedAt=0;mediaReadyKey='';mediaRevision=0;mediaSuppressUntil=0;mediaWarningDismissed=false;mediaLocalSource='vidfast';mediaSyncStatus.textContent='Sync waiting…';box.classList.remove('bajsas-main2-selector');box.style.removeProperty('top');box.style.left='0px';dbg('media:player-hard-destroyed')};
 let mediaLastProgressSent=0;window.addEventListener('message',event=>{const isVidFast=vidfastOrigins.has(event.origin)&&event.data?.type==='PLAYER_EVENT',isCine=event.origin==='https://cinesrc.st'&&String(event.data?.type||'').startsWith('cinesrc:');if(event.source!==mediaFrame.contentWindow||(!isVidFast&&!isCine)||(mediaLocalSource==='vidfast'&&!isVidFast)||(mediaLocalSource==='cinesrc'&&!isCine))return;const raw=isVidFast?(event.data.data||{}):event.data,status=isVidFast?String(raw.event||''):String(raw.type||'').replace('cinesrc:',''),time=Math.max(0,Number(raw.currentTime??raw.time)||0),duration=Math.max(0,Number(raw.duration)||0),cur=mediaLastState?.current;if(!cur)return;if(mediaLocalSource==='vidfast')clearTimeout(mediaFallbackTimer);clearTimeout(mediaFetchTimer);mediaFetchWarning.classList.remove('show');if(status==='error'){if(mediaLocalSource==='vidfast')switchToCineSrc('vidfast_error');else{mediaFetchWarning.classList.add('show');dbg('media:cinesrc-error',{data:raw})}return}if(mediaReadyKey!==mediaCurrentId+'|'+mediaLocalSource){mediaReadyKey=mediaCurrentId+'|'+mediaLocalSource;sendMedia({type:'media_source_ready',mediaId:mediaCurrentId,server:mediaLocalSource==='cinesrc'?'CineSrc':'VidFast.vc',attemptId:mediaAttemptId,startupMs:Date.now()-mediaAttemptStartedAt})}const expected=mediaExpectedTime(cur),drift=time-expected,fmt=value=>`${Math.floor(Math.max(0,value)/60)}:${String(Math.floor(Math.max(0,value))%60).padStart(2,'0')}`;mediaSyncStatus.textContent=`${mediaLocalSource==='cinesrc'?'CineSrc':'VidFast'} • Worker ${fmt(expected)} • Player ${fmt(time)} • Δ${Math.abs(drift).toFixed(1)}s`;const workerPlaying=cur.playback?.playing!==false,playing=isVidFast?Boolean(raw.playing):status==='play'||status==='timeupdate',canCorrect=Date.now()>mediaSuppressUntil;if(workerPlaying&&['play','timeupdate','playerstatus','seeked','ready'].includes(status)&&Math.abs(drift)>3&&canCorrect&&Date.now()-mediaLastSyncCorrection>4000){mediaLastSyncCorrection=Date.now();mediaSuppressUntil=Date.now()+2500;mediaCommand('seek',{time:expected});mediaCommand('play');dbg('media:drift-corrected',{source:mediaLocalSource,status,time,expected,drift})}else if(workerPlaying&&status==='pause'&&canCorrect){mediaSuppressUntil=Date.now()+2500;mediaCommand('seek',{time:expected});mediaCommand('play')}else if(!workerPlaying&&playing&&canCorrect){mediaSuppressUntil=Date.now()+1500;mediaCommand('pause')}if(status==='ended')sendMedia({type:'media_ended',mediaId:mediaCurrentId,currentTime:time,duration});if(Date.now()-mediaLastProgressSent>8000&&['play','timeupdate','playerstatus'].includes(status)){mediaLastProgressSent=Date.now();sendMedia({type:'media_progress',time,duration,playing})}});

 const MAIN2_SELECTOR_Y_KEY='bajsas_main2_selector_y';
 const clampMain2SelectorY=y=>Math.max(0,Math.min(Math.max(0,wrapper.clientHeight-box.offsetHeight),y));
 const setMain2SelectorY=y=>box.style.setProperty('top',clampMain2SelectorY(y)+'px','important');
 const restoreMain2SelectorY=()=>{const saved=Number(localStorage.getItem(MAIN2_SELECTOR_Y_KEY));setMain2SelectorY(Number.isFinite(saved)?saved:10)};
 label.addEventListener('pointerdown',event=>{if(!mediaPanel.classList.contains('show'))return;event.preventDefault();const startY=event.clientY,startTop=parseFloat(getComputedStyle(box).top)||10;label.setPointerCapture?.(event.pointerId);const move=e=>setMain2SelectorY(startTop+e.clientY-startY);const up=e=>{label.removeEventListener('pointermove',move);label.removeEventListener('pointerup',up);label.removeEventListener('pointercancel',up);localStorage.setItem(MAIN2_SELECTOR_Y_KEY,String(Math.round(parseFloat(getComputedStyle(box).top)||10)));try{label.releasePointerCapture?.(e.pointerId)}catch{}};label.addEventListener('pointermove',move);label.addEventListener('pointerup',up);label.addEventListener('pointercancel',up)});
 window.addEventListener('resize',()=>{if(mediaPanel.classList.contains('show'))restoreMain2SelectorY()});

 mediaPanel.querySelector('[data-media-warning-close]').onclick=()=>{mediaWarningDismissed=true;mediaFetchWarning.classList.remove('show')};

 mediaButton.onclick=()=>{snakeExit();destroyMediaPlayer();box.classList.add('bajsas-main2-selector');restoreMain2SelectorY();bGameUiEnabled=false;bGameModal.classList.remove('show');v.muted=true;i.src='';i.style.display='none';bActiveStream='MAIN 2';bLastProcessedCh='MAIN 2';bApplyLocalWatch('MAIN 2');bPing('watch:MAIN 2');mediaPanel.classList.add('show');sendMedia({type:'media_get'});setActive(mediaButton)};mediaPanel.querySelector('[data-media-close]').onclick=()=>nativeBtn.click();mediaPanel.querySelector('[data-media-add]').onclick=()=>{if(mediaInput.value.trim()){sendMedia({type:'media_request',query:mediaInput.value.trim()});mediaInput.value=''}};mediaPanel.querySelector('[data-media-vote]').onclick=()=>sendMedia({type:'media_vote_skip'});
 mediaButton.addEventListener('mouseenter',()=>{const cur=mediaLastState?.current;if(!cur)return;if(!mediaHoverCard){mediaHoverCard=document.createElement('div');mediaHoverCard.className='bajsas-stream-preview';document.body.appendChild(mediaHoverCard)}mediaHoverCard.replaceChildren();if(cur.poster){const img=document.createElement('img');img.src=cur.poster;img.alt='';mediaHoverCard.appendChild(img)}const title=document.createElement('div');title.className='bajsas-stream-preview-title';title.textContent=cur.title+(cur.year?' ('+cur.year+')':'');const meta=document.createElement('div');meta.className='bajsas-stream-preview-meta';meta.textContent='Now playing • requested by '+cur.requestedBy;mediaHoverCard.append(title,meta);const r=mediaButton.getBoundingClientRect();mediaHoverCard.style.display='block';mediaHoverCard.style.left=Math.max(8,Math.min(innerWidth-300,r.left))+'px';mediaHoverCard.style.top=(r.bottom+8)+'px';requestAnimationFrame(()=>mediaHoverCard.classList.add('show'))});mediaButton.addEventListener('mouseleave',()=>{mediaHoverCard?.classList.remove('show');setTimeout(()=>{if(mediaHoverCard&&!mediaHoverCard.classList.contains('show'))mediaHoverCard.style.display='none'},180)});
 let bws = null, bwsTimer = null, bchatObs = null, bObservedChatBox = null;
 let bChatRetryTimer = null;
 let bid = '';
 let bSelfUser = ''; // resolved from Twitch DOM/storage or Worker snapshot
 let bActiveStream = ''; // tracks which overlay stream is active (empty = native Twitch)
     let bToken = ''; // HMAC token for ping auth — server-issued, time-limited (optional enhancement)
     let bTokenTimer = null; // token refresh timer

     // Fetch HMAC token from server (optional — adds ?tok= to pings for extra auth)
     // Worker accepts ?key= without token, so this is best-effort
     async function bFetchToken() {
         try {
             const r = await fetch(TOKEN_URL, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ key: PING_KEY }),
                 cache: 'no-store'
             });
             if (r.ok) {
                 const d = await r.json();
                 if (d.token) {
                     bToken = d.token;
                     // Refresh at 75% of TTL to avoid expiry window
                     const refreshMs = Math.max(60000, (d.expiresIn || 90000) * 0.75);
                     if (bTokenTimer) clearTimeout(bTokenTimer);
                     bTokenTimer = setTimeout(bFetchToken, refreshMs);
                 }
             }
         } catch(e) { /* token fetch failed — pings still work with ?key= */ }
     }

     function bGetId() {
         try { let id = localStorage.getItem('bajsas_id'); if (!id) { id = Math.random().toString(36).slice(2,18); localStorage.setItem('bajsas_id', id); } return id; }
         catch { return Math.random().toString(36).slice(2,18); }
     }
     function bGetUser() {
         try { const r = localStorage.getItem('twilight.user'); if (r) { const j = JSON.parse(r); if (j?.login) return j.login.toLowerCase(); } } catch {}
         try { const m = document.cookie.match(/twilight-user=([^;]+)/); if (m) { const j = JSON.parse(decodeURIComponent(m[1])); if (j?.login) return j.login.toLowerCase(); } } catch {}
         try { const el = document.querySelector('[data-a-target="user-display-name"],[data-a-target="top-nav-username"]'); if (el) { const t = el.textContent.trim().toLowerCase(); if (/^[a-z0-9_]{3,25}$/.test(t)) return t; } } catch {}
         return bSelfUser;
     }
     function bGetCh() { try { return new URL(location.href).pathname.split('/').filter(Boolean)[0]?.toLowerCase() || ''; } catch { return ''; } }

     // Same as old app: bCurrentChannel returns what the user is actually watching
     function bCurrentChannel() { return bActiveStream || bGetCh(); }

     // Extract the real channel name from a stream URL
     // Same logic as extractTwitchLogin / extractKickSlug / extractAngelthumpChannel
     // but returns just the channel name (same as how the worker stores "watching")
     function bExtractChannel(url) {
         if (!url) return '';
         if (url.includes('twitch.tv')) return extractTwitchLogin(url) || '';
         if (url.includes('kick.com')) return extractKickSlug(url) || '';
         if (url.includes('angelthump.com')) return extractAngelthumpChannel(url) || '';
         return '';
     }

     // Find the overlay button matching a watching value
     // Same as old app: SERVER_CHANNELS.find(c => c.name === target)
     function bFindOverlayBtn(channel) {
         if (!channel) return null;
         const target = channel.toLowerCase();
         if (target === 'main 2' || target === 'main2' || target === 'media') return mediaButton;
         const btns = document.querySelectorAll('.custom-stream-btn[data-stream-url]');
         // Match by button display name first (same as old app name match)
         for (const btn of btns) {
             const name = (btn.dataset.streamName || '').toLowerCase();
             if (name && name === target) return btn;
         }
         // Partial match on display name
         for (const btn of btns) {
             const name = (btn.dataset.streamName || '').toLowerCase();
             if (name && (name.includes(target) || target.includes(name))) return btn;
         }
         // Fallback: try matching URL-extracted channel
         for (const btn of btns) {
             const ch = bExtractChannel(btn.dataset.streamUrl);
             if (ch && ch.toLowerCase() === target) return btn;
         }
         return null;
     }

 // Scan only genuinely unprocessed messages. Never reprocess an old message
 // with a newer watch state, otherwise history is rewritten after a switch.
 function bRescanChat() {
 const chatBox = document.querySelector('.stream-chat');
 if (!chatBox) return;
 // Firefox/7TV may rerender a message and remove injected children while
 // leaving our data attributes on the message container. Restore from the
 // immutable per-message snapshot, never from the user's newer channel.
 chatBox.querySelectorAll('[data-baj-snapshot-channel][data-baj-processed]').forEach(msg => {
 if (msg.querySelector('.bajsas-watch-badge')) return;
 msg.removeAttribute('data-baj-processed');
 // Snapshot is already known: restore synchronously inside the mutation
 // microtask so Firefox cannot paint a frame without the badge.
 bProcess(msg);
 });
 bScan(chatBox);
 }

     function bApplyUserSnapshot(users) {
         bwm.clear(); bPresenceUsers.clear();
         for (const u of (users || [])) {
             const tw = String(u.twitchUser || '').toLowerCase();
             const watching = u.watching || (u.event?.startsWith('watch:') ? u.event.slice(6) : '');
             const online = Boolean(u.socketConnected || (u.isOnline !== false && u.event !== 'offline' && Date.now() - (u.lastSeen || 0) < 600000));
             if (tw) bPresenceUsers.set(tw, { username:tw, watching, online, lastSeen:u.lastSeen || 0 });
             if (u.id === bid && tw) { bSelfUser = tw; dbg('self:resolved-from-snapshot', { username: tw }); }
             const ch = u.watching || (u.event?.startsWith('watch:') ? u.event.slice(6) : '');
             if (!tw || !ch || Date.now() - (u.lastSeen || 0) >= 86400000) continue;
             const existing = bwm.get(tw);
             if (!existing || existing.lastSeen <= (u.lastSeen || 0)) {
                 bwm.set(tw, { channel: ch, lastSeen: u.lastSeen || Date.now() });
             }
         }
         bSaveWatchCache();
         renderPresence();
         bRefreshAll();
         bRescanChat();
     }

     function bConnectWS() {
         try {
             if (bws && bws.readyState <= 1) return;
             const identityUrl = WS_URL + '&id=' + encodeURIComponent(bid) + '&twitchUser=' + encodeURIComponent(bGetUser());
             dbg('ws:connecting', { url: identityUrl.replace(/key=[^&]+/, 'key=REDACTED') });
             bws = new WebSocket(identityUrl);
             bws.onopen = () => {dbg('ws:open', { id: bid, twitchUser: bGetUser() });if(pixelPanelShell?.isConnected){pixelStatus.textContent='Loading canvas…';bws.send(JSON.stringify({type:'pixel_get'}))}};
             bws.onmessage = (e) => {
                 try {
 const m = JSON.parse(e.data);
 dbg('ws:message', { type: m.type, twitchUser: m.twitchUser || '', watching: m.watching || '', id: m.id || '' });
 if (m.type === 'connected' && Array.isArray(m.users)) {
 bApplyUserSnapshot(m.users);if(pixelPanelShell?.isConnected&&!pixelSnapshotLoaded)bws.send(JSON.stringify({type:'pixel_get'}));
 } else if (m.type === 'media_state') {
 renderMedia(m);
 } else if (m.type === 'media_error') {
 mediaStatus.textContent='Error: '+String(m.error||'unknown').replaceAll('_',' ');
 } else if (String(m.type||'').startsWith('snake_')) {
 snakeHandle(m);
 } else if (String(m.type||'').startsWith('pixel_')) {
 pixelHandle(m);
 } else if (String(m.type||'').startsWith('checkers_')) {
 bHandleCheckers(m);
 } else if (m.type === 'force_watch' && m.channel) {
 const target = String(m.target || 'all').toLowerCase();
 const me = bGetUser();
 const applies = target === 'all' || target === bid.toLowerCase() || (me && target === me);
 if (!applies) return;
 const channel = String(m.channel).trim();
 const native = channel.toLowerCase() === 'twitch'
 ? [...btnRow.querySelectorAll('.custom-stream-btn[data-stream-selector="1"]')].find(btn => !btn.dataset.streamUrl)
 : null;
 const found = native || bFindOverlayBtn(channel);
 if (found) {
 found.click();
 console.log('[BajSAS] Admin switched this viewer to: ' + channel);
 } else {
 console.warn('[BajSAS] Admin switch ignored; channel button not found:', channel);
 }
 } else if (m.type === 'watch_update' && m.twitchUser) {
 const k = m.twitchUser.toLowerCase();
 if (m.id === bid) { bSelfUser = k; dbg('self:resolved-from-update', { username: k }); }
 const ch = m.watching || (m.event || '').replace('watch:', '');
 const incomingTime = m.lastSeen || Date.now();
 bPresenceUsers.set(k, { username:k, watching:ch, online:m.isOnline !== false, lastSeen:incomingTime });
 renderPresence();
 const current = bwm.get(k);
 // A pagehide/offline event from the old stream can arrive immediately before
 // the new watch event. Cancel its pending removal and reject stale updates.
 const pendingOffline = bOfflineTimers.get(k);
 if (pendingOffline) { clearTimeout(pendingOffline); bOfflineTimers.delete(k); }
 if (ch && (!current || incomingTime >= current.lastSeen)) {
 bwm.set(k, { channel: ch, lastSeen: incomingTime });
 bSaveWatchCache();
 bRefreshUser(k);
 }
 } else if (m.type === 'user_offline') {
 const k = (m.twitchUser || '').toLowerCase();
 if (k) {
 const presence = bPresenceUsers.get(k); if (presence) { presence.online=false; bPresenceUsers.set(k,presence); renderPresence(); }
 const snapshotTime = bwm.get(k)?.lastSeen || 0;
 clearTimeout(bOfflineTimers.get(k));
 const timer = setTimeout(() => {
 bOfflineTimers.delete(k);
 // Do not delete a newer watch update that arrived after this offline event.
 const current = bwm.get(k);
 if (!current || current.lastSeen !== snapshotTime) return;
 bwm.delete(k);
 bLocalWatchCache.delete(k);
 bSaveWatchCache();
 bRemoveUser(k);
 }, 2000);
 bOfflineTimers.set(k, timer);
 }
 }
                 } catch {}
             };
             bws.onclose = (event) => { dbg('ws:close', { code: event.code, reason: event.reason }); bws = null; if (bwsTimer) clearTimeout(bwsTimer); bwsTimer = setTimeout(bConnectWS, 8000); };
             bws.onerror = () => { dbg('ws:error'); try { bws.close(); } catch {} };
         } catch {}
     }

     let bGame={id:'',board:[],turn:'red',red:'',black:'',status:'idle',selected:-1,redMs:300000,blackMs:300000,turnStartedAt:0};
     let bGameUiEnabled=false;
     let bGameAudioEnabled=localStorage.getItem('bajsas_game_audio')!=='0',bGameAudioCtx=null;
     const bGameTone=(kind='move')=>{if(!bGameAudioEnabled)return;try{bGameAudioCtx||=new (window.AudioContext||window.webkitAudioContext)();const o=bGameAudioCtx.createOscillator(),g=bGameAudioCtx.createGain(),now=bGameAudioCtx.currentTime;const spec={ui:[520,.035],move:[420,.055],capture:[220,.11],start:[660,.14],end:[150,.3],invite:[820,.12]}[kind]||[420,.06];o.frequency.setValueAtTime(spec[0],now);if(kind==='start')o.frequency.exponentialRampToValueAtTime(990,now+spec[1]);g.gain.setValueAtTime(.07,now);g.gain.exponentialRampToValueAtTime(.001,now+spec[1]);o.connect(g).connect(bGameAudioCtx.destination);o.start(now);o.stop(now+spec[1])}catch{}};
     const bGameModal=document.createElement('div');bGameModal.className='bajsas-game-modal';bGameModal.innerHTML='<div class="bajsas-game-window"><div class="bajsas-game-head"><b>⚫ BajSAS Checkers</b><span data-game-side style="font-weight:800;color:#ffd58a">Lobby</span><div style="display:flex;gap:5px"><button class="custom-stream-btn bajsas-game-resize" data-game-resize title="Drag to resize">⤡</button><button class="custom-stream-btn" data-game-close>✕</button></div></div><div class="bajsas-game-controls"><input data-room-name placeholder="Room name" maxlength="32" style="flex:1;min-width:100px;background:#211d18;color:#fff;border:1px solid #8b7759;padding:5px"><select data-room-time title="Time per player"><option value="1">1 min</option><option value="3">3 min</option><option value="5" selected>5 min</option><option value="10">10 min</option><option value="15">15 min</option></select><button class="custom-stream-btn" data-room-create>Create</button><button class="custom-stream-btn bajsas-hidden" data-room-cancel>Cancel Room</button><button class="custom-stream-btn" data-game-audio title="Toggle game sounds">🔊</button><button class="custom-stream-btn" data-room-refresh>↻</button><button class="custom-stream-btn" data-game-back style="display:none">← Lobby</button><span data-game-status>Lobby</span></div><div class="bajsas-lobby" data-room-list><div class="bajsas-lobby-empty">No public rooms yet.<br>Create one to start playing.</div></div><div data-game-play style="display:none"><div class="bajsas-game-board" data-game-board></div><div class="bajsas-game-score"><div class="bajsas-game-player"><div data-red-name>Red</div><div class="bajsas-game-clock" data-red-clock>5:00</div><small data-red-count>12 pieces</small></div><b>VS</b><div class="bajsas-game-player"><div data-black-name>Black</div><div class="bajsas-game-clock" data-black-clock>5:00</div><small data-black-count>12 pieces</small></div></div><div class="bajsas-game-actions"><button class="custom-stream-btn" data-game-draw>Offer Draw</button><button class="custom-stream-btn" data-game-resign>Resign</button><button class="custom-stream-btn" data-room-close>Close Game</button></div></div></div>';targetContainer.appendChild(bGameModal);
     // The floating panel resizes independently and never changes Twitch's
     // video layout. Persist the user's preferred dimensions per browser.
     try {
         const savedSize = JSON.parse(localStorage.getItem('bajsas_game_size') || 'null');
         if (savedSize?.width) bGameModal.style.width = Math.max(250, Math.min(520, savedSize.width)) + 'px';
     } catch {}
     const resizeHandle = bGameModal.querySelector('[data-game-resize]');
     resizeHandle.addEventListener('pointerdown', event => {
         event.preventDefault();
         resizeHandle.setPointerCapture(event.pointerId);
         const startX = event.clientX;
         const startWidth = bGameModal.getBoundingClientRect().width;
         const onMove = move => {
             // The panel is anchored on the right, so dragging left increases it.
             const max = Math.min(520, innerWidth * .75);
             const width = Math.max(250, Math.min(max, startWidth + (startX - move.clientX)));
             bGameModal.style.width = Math.round(width) + 'px';
         };
         const onEnd = end => {
             resizeHandle.releasePointerCapture?.(end.pointerId);
             resizeHandle.removeEventListener('pointermove', onMove);
             resizeHandle.removeEventListener('pointerup', onEnd);
             resizeHandle.removeEventListener('pointercancel', onEnd);
             const width = Math.round(bGameModal.getBoundingClientRect().width);
             localStorage.setItem('bajsas_game_size', JSON.stringify({ width }));
             dbg('game:resized', { width, aspect: 'board 1:1' });
         };
         resizeHandle.addEventListener('pointermove', onMove);
         resizeHandle.addEventListener('pointerup', onEnd);
         resizeHandle.addEventListener('pointercancel', onEnd);
     });
     const bGameBoard=bGameModal.querySelector('[data-game-board]'),bGameStatus=bGameModal.querySelector('[data-game-status]'),bRoomList=bGameModal.querySelector('[data-room-list]'),bGamePlay=bGameModal.querySelector('[data-game-play]'),bGameBack=bGameModal.querySelector('[data-game-back]'),bRoomCancel=bGameModal.querySelector('[data-room-cancel]');
     bGamePlay.style.position='relative';bGamePlay.prepend(resizeHandle);
     let bLobbyRooms=[];
     function bGameSend(x){if(bws?.readyState===1)bws.send(JSON.stringify(x));else dbg('game:ws-not-open');}
     function bLeaveGame(){if(bGame.id)bGameSend({type:'checkers_leave_room',gameId:bGame.id});bGame={id:'',board:[],turn:'red',red:'',black:'',status:'idle',selected:-1,redMs:300000,blackMs:300000,turnStartedAt:0};}
     const bRoomSetupControls=['[data-room-name]','[data-room-time]','[data-room-create]','[data-room-refresh]'].map(s=>bGameModal.querySelector(s));
     function bShowLobby(){bRoomCancel.classList.add('bajsas-hidden');bGameModal.classList.add('lobby-mode');bGameModal.querySelector('[data-game-side]').textContent='Lobby';bGamePlay.style.display='none';bGamePlay.classList.add('bajsas-hidden');bRoomList.style.display='block';bRoomList.classList.remove('bajsas-hidden');bGameBack.style.display='flex';bGameBack.classList.add('bajsas-hidden');for(const el of bRoomSetupControls)el?.classList.remove('bajsas-hidden');bGameStatus.textContent='Public Lobby';bGameSend({type:'checkers_lobby_list'});}
     function bShowBoard(){bRoomCancel.classList.add('bajsas-hidden');bGameModal.classList.remove('lobby-mode');bRoomList.classList.add('bajsas-hidden');bGamePlay.style.display='block';bGamePlay.classList.remove('bajsas-hidden');bGameBack.style.display='flex';bGameBack.classList.remove('bajsas-hidden');for(const el of bRoomSetupControls)el?.classList.add('bajsas-hidden');bRenderGame();}
     function bOpenGame(){bGameUiEnabled=true;bGameModal.classList.add('show');bShowLobby();}
     function bRenderLobby(){bRoomList.replaceChildren();const hosted=bLobbyRooms.find(r=>r.host===bGetUser()&&r.status==='open');bRoomCancel.classList.toggle('bajsas-hidden',!hosted);bRoomCancel.dataset.gameId=hosted?.gameId||'';if(!bLobbyRooms.length){const empty=document.createElement('div');empty.className='bajsas-lobby-empty';empty.innerHTML='No public rooms yet.<br>Create one to start playing.';bRoomList.appendChild(empty);return;}for(const r of bLobbyRooms){const card=document.createElement('div');card.className='bajsas-room-card';const top=document.createElement('div');top.className='bajsas-room-top';const name=document.createElement('span');name.textContent=r.roomName;const cost=document.createElement('span');cost.textContent=(r.timeControlMin||5)+' min';top.append(name,cost);const meta=document.createElement('div');meta.className='bajsas-room-meta';meta.textContent=`Host: ${r.host}${r.opponent?' • vs '+r.opponent:''} • ${r.status} • ${r.spectators} watching`;const actions=document.createElement('div');actions.className='bajsas-room-actions';if(r.status==='open'&&r.host!==bGetUser()){const join=document.createElement('button');join.className='bajsas-room-join';join.textContent='Join';join.onclick=()=>{bGameStatus.textContent='Joining '+r.roomName+'…';bGameSend({type:'checkers_join_room',gameId:r.gameId});};actions.appendChild(join)}const watch=document.createElement('button');watch.className='bajsas-room-watch';watch.textContent='Watch';watch.onclick=()=>bGameSend({type:'checkers_spectate',gameId:r.gameId});actions.appendChild(watch);card.append(top,meta,actions);bRoomList.appendChild(card)}}
     const bFmtClock=ms=>`${Math.max(0,ms)/60000|0}:${String(Math.max(0,ms)/1000%60|0).padStart(2,'0')}`;
     function bClientLegalMoves(board,side,forcedFrom=null){const dirs=p=>p.king?[[-1,-1],[-1,1],[1,-1],[1,1]]:p.side==='red'?[[-1,-1],[-1,1]]:[[1,-1],[1,1]];const pieceMoves=(from,capturesOnly=false)=>{const p=board[from];if(!p)return[];const r=from>>3,c=from&7,caps=[],steps=[];for(const[dR,dC]of dirs(p)){const r1=r+dR,c1=c+dC;if(r1<0||r1>7||c1<0||c1>7)continue;const one=r1*8+c1;if(!board[one]){if(!capturesOnly)steps.push({from,to:one,capture:null});continue}if(board[one].side===p.side)continue;const r2=r+dR*2,c2=c+dC*2;if(r2>=0&&r2<8&&c2>=0&&c2<8&&!board[r2*8+c2])caps.push({from,to:r2*8+c2,capture:one})}return caps.length?caps:(capturesOnly?[]:steps)};if(forcedFrom!=null)return pieceMoves(forcedFrom,true);const caps=[],steps=[];for(let n=0;n<64;n++)if(board[n]?.side===side)for(const m of pieceMoves(n))(m.capture==null?steps:caps).push(m);return caps.length?caps:steps}
     function bRenderGame(){bGameBoard.innerHTML='';const me=bGetUser(),mySide=me===bGame.red?'red':me===bGame.black?'black':'spectator',legal=mySide!=='spectator'&&bGame.turn===mySide?bClientLegalMoves(bGame.board,mySide,bGame.forcedFrom):[],selectable=new Set(legal.map(m=>m.from)),destinations=new Set(legal.filter(m=>m.from===bGame.selected).map(m=>m.to)),captureRequired=legal.some(m=>m.capture!=null);bGameModal.querySelector('[data-game-side]').textContent=mySide==='spectator'?'Spectating':'You are '+mySide.toUpperCase();bGameModal.querySelector('[data-room-close]').classList.toggle('bajsas-hidden',mySide!=='red');bGameModal.querySelector('[data-game-resign]').classList.toggle('bajsas-hidden',mySide==='spectator');bGameModal.querySelector('[data-game-draw]').classList.toggle('bajsas-hidden',mySide==='spectator');for(let visual=0;visual<64;visual++){const n=mySide==='black'?63-visual:visual;const c=document.createElement('button');c.className='bajsas-game-cell '+((((n>>3)+(n&7))%2)?'dark':'light')+(bGame.selected===n?' selected':'')+(selectable.has(n)?' selectable':'')+(destinations.has(n)?' legal':'')+(bGame.lastMove&&(bGame.lastMove.from===n||bGame.lastMove.to===n)?' last-move':'');const p=bGame.board[n];if(p){const q=document.createElement('span');q.className='bajsas-piece '+p.side+(p.king?' king':'');c.appendChild(q)}c.onclick=()=>{if(!bGame.id||bGame.status!=='playing'||mySide==='spectator'||bGame.turn!==mySide)return;if(bGame.selected<0){if(selectable.has(n))bGame.selected=n}else if(selectable.has(n)){bGame.selected=n}else if(destinations.has(n)){bGameSend({type:'checkers_move',gameId:bGame.id,from:bGame.selected,to:n});bGame.selected=-1}else bGame.selected=-1;bRenderGame()};bGameBoard.appendChild(c)}const elapsed=bGame.status==='playing'?Date.now()-(bGame.turnStartedAt||Date.now()):0;const redMs=bGame.redMs-(bGame.turn==='red'?elapsed:0),blackMs=bGame.blackMs-(bGame.turn==='black'?elapsed:0);const redName=bGameModal.querySelector('[data-red-name]'),blackName=bGameModal.querySelector('[data-black-name]');redName.textContent=bGame.red||'Red';blackName.textContent=bGame.black||'Black';redName.parentElement.classList.toggle('active',bGame.status==='playing'&&bGame.turn==='red');blackName.parentElement.classList.toggle('active',bGame.status==='playing'&&bGame.turn==='black');redName.parentElement.classList.toggle('me',mySide==='red');blackName.parentElement.classList.toggle('me',mySide==='black');bGameModal.querySelector('[data-red-clock]').textContent=bFmtClock(redMs);bGameModal.querySelector('[data-black-clock]').textContent=bFmtClock(blackMs);bGameModal.querySelector('[data-red-count]').textContent=bGame.board.filter(x=>x?.side==='red').length+' pieces';bGameModal.querySelector('[data-black-count]').textContent=bGame.board.filter(x=>x?.side==='black').length+' pieces';const reconnecting=(bGame.reconnecting||[]).length?' • Reconnecting: '+bGame.reconnecting.join(', '):'';bGameStatus.textContent=bGame.status==='playing'?'Turn: '+bGame.turn+(captureRequired?' • Capture required':'')+reconnecting:bGame.status+(bGame.winner?' • Winner: '+bGame.winner:'')+(bGame.winReason?' • '+String(bGame.winReason).replaceAll('_',' '):'');}
     setInterval(()=>{if(bGameModal.classList.contains('show')&&bGame.status==='playing')bRenderGame()},1000);
     function bHandleCheckers(m){dbg('game:event',m);if(m.type==='checkers_error'){bGameStatus.textContent='Error: '+String(m.error||'unknown').replaceAll('_',' ');dbg('game:error',m);}else if(m.type==='checkers_lobby'){bLobbyRooms=m.rooms||[];bRenderLobby();}else if(m.type==='checkers_room_closed'){bGame={...bGame,id:'',status:'room closed'};bRenderGame();}else if(m.type==='checkers_invite'){bGameTone('invite');if(confirm(`${m.from} invited you to checkers. Accept?`)){bGameUiEnabled=true;bGame.id=m.gameId;bGameSend({type:'checkers_accept',gameId:m.gameId});bGameModal.classList.add('show')}else bGameSend({type:'checkers_decline',gameId:m.gameId})}else if(m.type==='checkers_state'){if(!Array.isArray(m.board)||m.board.length!==64){bGameStatus.textContent='Invalid board state';dbg('game:invalid-state',m);return;}const previous=bGame,oldPieces=(previous.board||[]).filter(Boolean).length,newPieces=m.board.filter(Boolean).length;bGame={...bGame,...m,id:m.gameId,selected:m.forcedFrom??-1};if(previous.status!=='playing'&&m.status==='playing')bGameTone('start');else if(m.status==='finished'&&previous.status!=='finished')bGameTone('end');else if(newPieces<oldPieces)bGameTone('capture');else if(previous.turn&&previous.turn!==m.turn)bGameTone('move');if(bGameUiEnabled){bGameModal.classList.add('show');if(m.status==='open')bShowLobby();else bShowBoard()}}else if(m.type==='checkers_draw_offer'){if(confirm(`${m.from} offers a draw. Accept?`))bGameSend({type:'checkers_draw_accept',gameId:m.gameId});else bGameSend({type:'checkers_draw_decline',gameId:m.gameId})}else if(m.type==='checkers_declined'){bGameStatus.textContent='Invitation declined'}else if(m.type==='checkers_draw_declined'){bGameStatus.textContent='Draw declined'}}
     bGameModal.addEventListener('click',e=>{if(e.target.closest('button,select,input'))bGameTone('ui')},true);bGameModal.querySelector('[data-game-close]').onclick=()=>{bGameUiEnabled=false;bLeaveGame();bGameModal.classList.remove('show')};bGameModal.querySelector('[data-game-audio]').onclick=e=>{bGameAudioEnabled=!bGameAudioEnabled;localStorage.setItem('bajsas_game_audio',bGameAudioEnabled?'1':'0');e.currentTarget.textContent=bGameAudioEnabled?'🔊':'🔇';if(bGameAudioEnabled)bGameTone('start')};bGameModal.querySelector('[data-game-audio]').textContent=bGameAudioEnabled?'🔊':'🔇';bGameModal.querySelector('[data-room-create]').onclick=()=>bGameSend({type:'checkers_create_room',roomName:bGameModal.querySelector('[data-room-name]').value||`${bGetUser()}'s room`,timeControlMin:Number(bGameModal.querySelector('[data-room-time]').value)});bRoomCancel.onclick=()=>{const gameId=bRoomCancel.dataset.gameId||bGame.id;if(gameId&&confirm('Cancel this open room?')){bGameSend({type:'checkers_close_room',gameId});bRoomCancel.classList.add('bajsas-hidden');bGame={...bGame,id:'',status:'idle'}}};bGameModal.querySelector('[data-room-refresh]').onclick=()=>bGameSend({type:'checkers_lobby_list'});bGameBack.onclick=()=>{bLeaveGame();bShowLobby()};bGameModal.querySelector('[data-game-resign]').onclick=()=>{if(bGame.id)bGameSend({type:'checkers_resign',gameId:bGame.id})};bGameModal.querySelector('[data-game-draw]').onclick=()=>{if(bGame.id)bGameSend({type:'checkers_draw',gameId:bGame.id})};bGameModal.querySelector('[data-room-close]').onclick=()=>{if(bGame.id&&confirm('Close this room?'))bGameSend({type:'checkers_close_room',gameId:bGame.id})};
     const gameBtn=document.createElement('button');gameBtn.className='custom-stream-btn bajsas-game-selector';gameBtn.textContent='🎮 Checkers';gameBtn.title='Play multiplayer checkers';gameBtn.onclick=()=>{snakeExit();bOpenGame()};btnRow.appendChild(gameBtn);
     const pixelStyle=document.createElement('style');pixelStyle.textContent='.bajsas-pixel-panel-shell{width:100%;max-width:100%;margin:14px 0;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.22)}.bajsas-pixel{display:flex;position:relative;width:100%;height:560px;min-height:420px;background:#fff;color:#fff;pointer-events:auto;font:12px sans-serif;overflow:hidden;flex-direction:column}.bajsas-pixel.show{display:flex;flex-direction:column}.pixel-top{display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(24,24,27,.97);border-bottom:1px solid #444}.pixel-top b{flex:1}.pixel-view{flex:1;overflow:hidden;background:#fff;position:relative;cursor:grab;touch-action:none}.pixel-view.dragging{cursor:grabbing}.pixel-stage{position:absolute;left:50%;top:50%;image-rendering:pixelated;transform-origin:0 0;box-shadow:0 3px 18px rgba(0,0,0,.22)}.pixel-stage canvas{display:block;width:100%;height:100%;image-rendering:pixelated}.pixel-grid{display:none;position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.pixel-stage.grid .pixel-grid{display:block}.pixel-selection{display:none;position:absolute;pointer-events:none;border:2px solid #fff;box-shadow:0 0 0 1px #000,0 0 8px #fff;box-sizing:border-box}.pixel-bottom{display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:8px 10px;background:rgba(24,24,27,.98);border-top:1px solid #444}.pixel-palette{display:none;position:absolute;z-index:12;width:190px;gap:4px;flex-wrap:wrap;padding:8px;background:rgba(24,24,27,.97);border:1px solid #555;border-radius:7px;box-shadow:0 8px 24px rgba(0,0,0,.45)}.pixel-palette.show{display:flex}.pixel-color{width:25px;height:25px;border:2px solid transparent;padding:0;cursor:pointer}.pixel-color.active{border-color:#fff;box-shadow:0 0 0 2px #000;transform:translateY(-2px)}.pixel-status{color:#ddd;min-width:150px}.pixel-cooldown{font-weight:800;color:#ffd166}';document.head.appendChild(pixelStyle);
     const pixelModal=document.createElement('div');pixelModal.className='bajsas-pixel show';pixelModal.innerHTML='<div class="pixel-view"><div class="pixel-stage"><canvas width="128" height="128"></canvas><canvas class="pixel-grid"></canvas><i class="pixel-selection"></i></div></div><div class="pixel-bottom"><div class="pixel-palette"></div><span data-pixel-rev>rev 0</span><span data-pixel-coord>—</span><span class="pixel-status">Select a color and pixel.</span><span class="pixel-cooldown"></span><button class="custom-stream-btn" data-pixel-out>−</button><button class="custom-stream-btn" data-pixel-in>+</button><button class="custom-stream-btn" data-pixel-reset>Fit</button><button class="custom-stream-btn" data-pixel-sound>🔊</button></div>';const pixelPanelShell=document.createElement('div');pixelPanelShell.className='bajsas-pixel-panel-shell';pixelPanelShell.appendChild(pixelModal);
     const pixelCanvas=pixelModal.querySelector('canvas:not(.pixel-grid)'),pixelCtx=pixelCanvas.getContext('2d'),pixelGrid=pixelModal.querySelector('.pixel-grid'),pixelGridCtx=pixelGrid.getContext('2d'),pixelStage=pixelModal.querySelector('.pixel-stage'),pixelSelection=pixelModal.querySelector('.pixel-selection'),pixelStatus=pixelModal.querySelector('.pixel-status'),pixelCoord=pixelModal.querySelector('[data-pixel-coord]'),pixelCooldown=pixelModal.querySelector('.pixel-cooldown'),pixelPaletteEl=pixelModal.querySelector('.pixel-palette'),pixelPlace=document.createElement('button'),pixelView=pixelModal.querySelector('.pixel-view');let pixelColors=["#FFFFFF", "#6D001A", "#BE0039", "#FF4500", "#FFA800", "#FFD635", "#00A368", "#00CC78", "#7EED56", "#2450A4", "#3690EA", "#51E9F4", "#493AC1", "#6A5CFF", "#811E9F", "#FF3881", "#FF99AA", "#6D482F", "#9C6926", "#000000", "#515252", "#898D90", "#D4D7D9"];let pixelData=new Uint8Array(16384),pixelOwners={},pixelTimes={},pixelRevision=0,pixelSelectedColor=5,pixelSelected=null,pixelZoom=5,pixelPanX=0,pixelPanY=0,pixelCooldownUntil=0,pixelSoundEnabled=localStorage.getItem('bajsas_pixel_sound')!=='0',pixelAudio=null,pixelLastTap={x:-1,y:-1,at:0},pixelSnapshotLoaded=false;pixelPlace.className='custom-stream-btn';pixelPlace.textContent='Place';pixelPlace.disabled=true;pixelPlace.dataset.pixelPlace='1';const pixelCancel=document.createElement('button');pixelCancel.className='custom-stream-btn';pixelCancel.textContent='Cancel';const pixelHex=document.createElement('span');pixelHex.style.cssText='width:100%;color:#fff;font:700 10px monospace';pixelPaletteEl.addEventListener('pointerdown',e=>e.stopPropagation());pixelView.appendChild(pixelPaletteEl);
     const pixelTone=(kind='place')=>{if(!pixelSoundEnabled)return;try{pixelAudio||=new(window.AudioContext||window.webkitAudioContext)();const o=pixelAudio.createOscillator(),g=pixelAudio.createGain(),map={open:[420,.06,.045],close:[260,.04,.04],select:[620,.025,.025],place:[880,.045,.055],other:[520,.018,.018],error:[125,.12,.06]};const[f,d,v]=map[kind]||map.place;o.frequency.setValueAtTime(f,pixelAudio.currentTime);if(kind==='place')o.frequency.exponentialRampToValueAtTime(1180,pixelAudio.currentTime+d);o.type=kind==='error'?'sawtooth':'sine';g.gain.setValueAtTime(v,pixelAudio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,pixelAudio.currentTime+d);o.connect(g).connect(pixelAudio.destination);o.start();o.stop(pixelAudio.currentTime+d)}catch{}};
     function pixelDrawGrid(){const size=128*pixelZoom;pixelGrid.width=size;pixelGrid.height=size;pixelGridCtx.clearRect(0,0,size,size);if(pixelZoom<5)return;pixelGridCtx.beginPath();pixelGridCtx.strokeStyle='rgba(0,0,0,.24)';pixelGridCtx.lineWidth=.45;const boundary=(a,b)=>!(pixelOwners[a]&&pixelOwners[b]&&pixelData[a]===pixelData[b]);for(let y=0;y<128;y++)for(let x=1;x<128;x++){const a=y*128+x-1,b=a+1;if(boundary(a,b)){const px=x*pixelZoom;pixelGridCtx.moveTo(px,y*pixelZoom);pixelGridCtx.lineTo(px,(y+1)*pixelZoom)}}for(let y=1;y<128;y++)for(let x=0;x<128;x++){const a=(y-1)*128+x,b=y*128+x;if(boundary(a,b)){const py=y*pixelZoom;pixelGridCtx.moveTo(x*pixelZoom,py);pixelGridCtx.lineTo((x+1)*pixelZoom,py)}}pixelGridCtx.rect(.25,.25,size-.5,size-.5);pixelGridCtx.stroke()}
     function pixelTransform(){const size=128*pixelZoom;pixelStage.style.width=size+'px';pixelStage.style.height=size+'px';pixelStage.style.setProperty('--pixel-z',pixelZoom+'px');pixelStage.classList.toggle('grid',pixelZoom>=5);pixelDrawGrid();pixelStage.style.transform=`translate(calc(-50% + ${pixelPanX}px),calc(-50% + ${pixelPanY}px))`;if(pixelSelected){pixelSelection.style.display='block';pixelSelection.style.left=pixelSelected.x*pixelZoom+'px';pixelSelection.style.top=pixelSelected.y*pixelZoom+'px';pixelSelection.style.width=pixelZoom+'px';pixelSelection.style.height=pixelZoom+'px';pixelSelection.style.background=pixelColors[pixelSelectedColor]+'99'}}
     function pixelDraw(){const image=pixelCtx.createImageData(128,128);for(let i=0;i<16384;i++){const n=parseInt((pixelColors[pixelData[i]]||pixelColors[0]).slice(1),16),o=i*4;image.data[o]=n>>16;image.data[o+1]=n>>8&255;image.data[o+2]=n&255;image.data[o+3]=255}pixelCtx.putImageData(image,0,0);pixelModal.querySelector('[data-pixel-rev]').textContent='rev '+pixelRevision;pixelTransform()}
     function pixelBuildPalette(){pixelPaletteEl.replaceChildren();pixelColors.forEach((color,index)=>{const b=document.createElement('button');b.className='pixel-color'+(index===pixelSelectedColor?' active':'');b.style.background=color;b.title=color;b.dataset.colorIndex=String(index);b.onclick=e=>{const selected=Number(e.currentTarget.dataset.colorIndex);if(!Number.isInteger(selected)||selected<0||selected>=pixelColors.length)return;pixelSelectedColor=selected;pixelPaletteEl.querySelectorAll('[data-color-index]').forEach(x=>x.classList.toggle('active',Number(x.dataset.colorIndex)===selected));pixelHex.textContent='Selected '+pixelColors[selected];pixelTransform();pixelTone('select')};pixelPaletteEl.appendChild(b)});pixelHex.textContent='Selected '+pixelColors[pixelSelectedColor];pixelPaletteEl.append(pixelHex,pixelPlace,pixelCancel)}pixelBuildPalette();
     function pixelHandle(m){if(m.type==='pixel_snapshot'){const raw=atob(m.pixels||''),next=Uint8Array.from(raw,c=>c.charCodeAt(0));if(next.length!==16384){pixelStatus.textContent='Invalid board snapshot';pixelTone('error');return}if(Array.isArray(m.palette)&&m.palette.length>=2&&m.palette.every(c=>/^#[0-9a-f]{6}$/i.test(String(c)))){const incoming=m.palette.map(c=>String(c).toUpperCase());if(incoming.join(',')!==pixelColors.join(',')){pixelColors=incoming;if(pixelSelectedColor>=pixelColors.length)pixelSelectedColor=0;pixelBuildPalette()}}pixelData=next;pixelOwners=m.owners||{};pixelTimes=m.times||{};pixelRevision=Number(m.revision)||0;pixelSnapshotLoaded=true;pixelDraw();requestAnimationFrame(pixelFit);pixelStatus.textContent=m.locked?'Board locked by admin.':'Select a color and pixel.'}else if(m.type==='pixel_update'){if(Number(m.revision)<=pixelRevision)return;if(Number(m.revision)>pixelRevision+1){bws?.send(JSON.stringify({type:'pixel_get'}));return}const i=Number(m.y)*128+Number(m.x);pixelData[i]=Number(m.color);pixelOwners[i]=m.username||'';pixelTimes[i]=Number(m.placedAt)||0;pixelRevision=Number(m.revision);pixelDraw();if(m.username===bGetUser()){pixelCooldownUntil=Number(m.cooldownUntil)||Date.now()+30000;pixelPaletteEl.classList.remove('show');pixelTone('place')}else pixelTone('other')}else if(m.type==='pixel_resync')bws?.send(JSON.stringify({type:'pixel_get'}));else if(m.type==='pixel_error'){if(m.error==='cooldown')pixelCooldownUntil=Date.now()+Number(m.remainingMs||0);pixelStatus.textContent='Error: '+String(m.error||'unknown').replaceAll('_',' ');pixelTone('error')}}
     const pixelAgo=time=>{const seconds=Math.max(0,Math.floor((Date.now()-Number(time||0))/1000));if(seconds<10)return'just now';if(seconds<60)return seconds+' seconds ago';const minutes=Math.floor(seconds/60);if(minutes<60)return minutes+' minute'+(minutes===1?'':'s')+' ago';const hours=Math.floor(minutes/60);if(hours<24)return hours+' hour'+(hours===1?'':'s')+' ago';const days=Math.floor(hours/24);if(days<30)return days+' day'+(days===1?'':'s')+' ago';const months=Math.floor(days/30);if(months<12)return months+' month'+(months===1?'':'s')+' ago';const years=Math.floor(days/365);return years+' year'+(years===1?'':'s')+' ago'};
     const pixelAtEvent=e=>{const r=pixelCanvas.getBoundingClientRect();return{x:Math.floor((e.clientX-r.left)/r.width*128),y:Math.floor((e.clientY-r.top)/r.height*128)}};pixelCanvas.addEventListener('pointermove',e=>{const{x,y}=pixelAtEvent(e),i=y*128+x;if(x>=0&&y>=0&&x<128&&y<128){pixelCoord.textContent=`${x}, ${y}`;pixelStatus.textContent=pixelOwners[i]?`Placed by ${pixelOwners[i]} • ${pixelAgo(pixelTimes[i])}`:'Empty pixel'}});const pixelSendPlacement=()=>{if(!pixelSelected||Date.now()<pixelCooldownUntil){pixelTone('error');return false}bws?.send(JSON.stringify({type:'pixel_place',x:pixelSelected.x,y:pixelSelected.y,color:pixelSelectedColor}));pixelPlace.disabled=true;pixelPaletteEl.classList.remove('show');return true};const pixelSelectAt=e=>{if(!pixelSnapshotLoaded){pixelStatus.textContent='Loading canvas…';return false}const{x,y}=pixelAtEvent(e);if(x<0||y<0||x>=128||y>=128)return false;const now=Date.now(),doubleTap=pixelLastTap.x===x&&pixelLastTap.y===y&&now-pixelLastTap.at<=400;pixelSelected={x,y};pixelCoord.textContent=`${x}, ${y}`;pixelStatus.textContent=doubleTap?`Placing (${x}, ${y})…`:`Previewing (${x}, ${y})`;pixelTransform();if(!doubleTap){const vr=pixelView.getBoundingClientRect(),cr=pixelCanvas.getBoundingClientRect(),left=Math.max(6,Math.min(pixelView.clientWidth-206,cr.left-vr.left+(x+.5)*cr.width/128+10)),top=Math.max(6,Math.min(pixelView.clientHeight-120,cr.top-vr.top+(y+.5)*cr.height/128+10));pixelPaletteEl.style.left=left+'px';pixelPaletteEl.style.top=top+'px';pixelPaletteEl.classList.add('show')}if(doubleTap){pixelPaletteEl.classList.remove('show');pixelLastTap={x:-1,y:-1,at:0};pixelSendPlacement()}else{pixelLastTap={x,y,at:now};pixelTone('select')}return true};pixelPlace.onclick=pixelSendPlacement;
     let pixelDrag=null,pixelSuppressClick=false;pixelView.onpointerdown=e=>{pixelSuppressClick=false;pixelDrag={x:e.clientX,y:e.clientY,px:pixelPanX,py:pixelPanY};pixelView.classList.add('dragging');pixelView.setPointerCapture(e.pointerId)};pixelView.onpointermove=e=>{if(!pixelDrag)return;const dx=e.clientX-pixelDrag.x,dy=e.clientY-pixelDrag.y;if(Math.hypot(dx,dy)>4)pixelSuppressClick=true;pixelPanX=pixelDrag.px+dx;pixelPanY=pixelDrag.py+dy;pixelTransform()};pixelView.onpointerup=e=>{const wasClick=Boolean(pixelDrag)&&!pixelSuppressClick;pixelDrag=null;pixelView.classList.remove('dragging');if(wasClick)pixelSelectAt(e);pixelSuppressClick=false};pixelView.onwheel=e=>{e.preventDefault();pixelZoom=Math.max(2,Math.min(20,pixelZoom+(e.deltaY<0?1:-1)));pixelTransform()};
     const pixelFit=()=>{if(!pixelView.isConnected||pixelView.clientWidth<1||pixelView.clientHeight<1)return;pixelZoom=Math.max(1,Math.min(20,Math.min((pixelView.clientWidth-12)/128,(pixelView.clientHeight-12)/128)));pixelPanX=0;pixelPanY=0;pixelTransform()};
     const pixelSetZoom=d=>{pixelZoom=Math.max(1,Math.min(20,pixelZoom+d));pixelTransform()};pixelModal.querySelector('[data-pixel-in]').onclick=()=>pixelSetZoom(1);pixelModal.querySelector('[data-pixel-out]').onclick=()=>pixelSetZoom(-1);pixelModal.querySelector('[data-pixel-reset]').onclick=pixelFit;pixelModal.querySelector('[data-pixel-sound]').textContent=pixelSoundEnabled?'🔊':'🔇';pixelModal.querySelector('[data-pixel-sound]').onclick=e=>{pixelSoundEnabled=!pixelSoundEnabled;localStorage.setItem('bajsas_pixel_sound',pixelSoundEnabled?'1':'0');e.currentTarget.textContent=pixelSoundEnabled?'🔊':'🔇';pixelTone('select')};pixelCancel.onclick=()=>{pixelSelected=null;pixelSelection.style.display='none';pixelPaletteEl.classList.remove('show')};setInterval(()=>{if(!pixelModal.classList.contains('show'))return;const remain=Math.max(0,pixelCooldownUntil-Date.now());pixelCooldown.textContent=remain?'Cooldown '+Math.ceil(remain/1000)+'s':'';pixelPlace.disabled=!pixelSnapshotLoaded||!pixelSelected||remain>0},250);
     const mountPixelPanel=()=>{if(pixelPanelShell.isConnected)return true;const mounts=[...document.querySelectorAll('.channel-panels,[data-test-selector="channel-panels"],[data-test-selector="about-panel"],[data-a-target="channel-about-panel"],section[data-test-selector*="about"]')],mount=mounts.find(el=>el.isConnected&&getComputedStyle(el).display!=='none')||mounts[0];if(!mount)return false;mount.appendChild(pixelPanelShell);pixelPanX=pixelPanY=0;pixelSnapshotLoaded=false;pixelStatus.textContent='Loading canvas…';pixelDraw();requestAnimationFrame(pixelFit);pixelTone('open');bws?.readyState===1&&bws.send(JSON.stringify({type:'pixel_get'}));dbg('pixel:mounted-in-channel-panels',{className:mount.className||'',selector:mount.classList?.contains('channel-panels')?'.channel-panels':'fallback'});return true};let pixelMountTimer=null;const schedulePixelMount=()=>{if(pixelPanelShell.isConnected)return;clearTimeout(pixelMountTimer);pixelMountTimer=setTimeout(mountPixelPanel,80)};mountPixelPanel();const pixelMountObserver=new MutationObserver(schedulePixelMount);pixelMountObserver.observe(document.body,{childList:true,subtree:true});const pixelResizeObserver=new ResizeObserver(()=>{if(pixelPanelShell.isConnected)pixelFit()});pixelResizeObserver.observe(pixelView);setInterval(mountPixelPanel,1200);
     const snakeStyle=document.createElement('style');snakeStyle.textContent='.bajsas-snake{display:none;position:absolute;inset:0;z-index:2147483646;background:#090b10;color:#fff;pointer-events:auto;font:12px sans-serif}.bajsas-snake.show{display:flex;flex-direction:column}.snake-stage{flex:1 1 auto;display:grid;place-items:center;min-height:0;overflow:hidden;position:relative;z-index:1}.snake-stage canvas{display:block;width:auto;height:auto;max-width:100%;max-height:100%;aspect-ratio:4/3;image-rendering:pixelated;border:1px solid #303541;background:#11151c}.snake-bar{position:relative;z-index:3;flex:0 0 auto;display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:8px;background:#18181d}.snake-players{flex:1;display:flex;gap:5px;flex-wrap:wrap}.snake-chip{padding:3px 6px;border-radius:3px;background:#292932}.snake-chip.ready{outline:1px solid #55e88b}.snake-mobile{display:none;place-items:center;position:absolute;inset:0;background:#111;z-index:2;font-size:16px}@media(pointer:coarse),(max-width:700px){.snake-mobile{display:grid}.snake-stage,.snake-bar{visibility:hidden}}';document.head.appendChild(snakeStyle);
     const snakeModal=document.createElement('div');snakeModal.className='bajsas-snake';snakeModal.innerHTML='<div class="snake-mobile">Snake Battle is available on desktop only.</div><div class="snake-stage"><canvas width="800" height="600"></canvas></div><div class="snake-bar"><div class="snake-players"></div><b data-snake-status>Single global lobby</b><button class="custom-stream-btn" data-snake-ready disabled>Ready</button><button class="custom-stream-btn" data-snake-sound>🔊</button><button class="custom-stream-btn" data-snake-close>✕</button></div>';targetContainer.appendChild(snakeModal);const snakeCanvas=snakeModal.querySelector('canvas'),snakeCtx=snakeCanvas.getContext('2d'),snakePlayers=snakeModal.querySelector('.snake-players'),snakeStatus=snakeModal.querySelector('[data-snake-status]'),snakeReady=snakeModal.querySelector('[data-snake-ready]');let snakeState={status:'lobby',players:[],food:{x:20,y:15}},snakeSound=localStorage.getItem('bajsas_snake_sound')!=='0',snakeAudio=null;const snakeTone=(f=440,d=.04)=>{if(!snakeSound)return;try{snakeAudio||=new(window.AudioContext||window.webkitAudioContext)();const o=snakeAudio.createOscillator(),g=snakeAudio.createGain();o.frequency.value=f;g.gain.setValueAtTime(.035,snakeAudio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,snakeAudio.currentTime+d);o.connect(g).connect(snakeAudio.destination);o.start();o.stop(snakeAudio.currentTime+d)}catch{}};
     const snakeSend=x=>bws?.readyState===1&&bws.send(JSON.stringify(x));function snakeDraw(){snakeCtx.fillStyle='#11151c';snakeCtx.fillRect(0,0,800,600);snakeCtx.strokeStyle='rgba(255,255,255,.035)';snakeCtx.lineWidth=1;for(let x=0;x<=40;x++){snakeCtx.beginPath();snakeCtx.moveTo(x*20,0);snakeCtx.lineTo(x*20,600);snakeCtx.stroke()}for(let y=0;y<=30;y++){snakeCtx.beginPath();snakeCtx.moveTo(0,y*20);snakeCtx.lineTo(800,y*20);snakeCtx.stroke()}snakeCtx.fillStyle='#ffd635';snakeCtx.beginPath();snakeCtx.arc(snakeState.food.x*20+10,snakeState.food.y*20+10,7,0,Math.PI*2);snakeCtx.fill();for(const p of snakeState.players){snakeCtx.fillStyle=p.alive?p.color:'#444';p.body.forEach((q,i)=>{snakeCtx.globalAlpha=i?0.82:1;snakeCtx.fillRect(q.x*20+1,q.y*20+1,18,18)});snakeCtx.globalAlpha=1;if(p.alive&&p.body[0]){const h=p.body[0],label=String(p.user||'').slice(0,18);snakeCtx.font='bold 13px monospace';snakeCtx.textBaseline='bottom';const w=snakeCtx.measureText(label).width+8,x=Math.max(1,Math.min(799-w,h.x*20+10-w/2)),y=Math.max(16,h.y*20-3);snakeCtx.fillStyle='rgba(0,0,0,.72)';snakeCtx.fillRect(x,y-15,w,17);snakeCtx.fillStyle='#fff';snakeCtx.fillText(label,x+4,y)}}}
     function snakeHandle(m){if(m.type==='snake_error'){snakeStatus.textContent='Error: '+String(m.error||'unknown').replaceAll('_',' ');return}const previous=snakeState,myOld=previous.players?.find(p=>p.user===bGetUser()),myNew=m.players?.find(p=>p.user===bGetUser());snakeState=m;if(previous.status!==m.status)snakeTone(m.status==='playing'?760:m.status==='finished'?980:520,.08);else if(myNew&&myOld&&myNew.score>myOld.score)snakeTone(1100,.06);snakeDraw();const me=bGetUser(),mine=m.players.find(p=>p.user===me);snakePlayers.replaceChildren();for(const p of m.players){const c=document.createElement('span');c.className='snake-chip'+(p.ready?' ready':'');c.style.borderLeft='5px solid '+(p.color||'#777');c.textContent=p.user+(p.score?' • '+p.score:'')+(p.ready&&m.status==='lobby'?' ✓':'');snakePlayers.appendChild(c)}snakeReady.disabled=m.status!=='lobby'||!mine;snakeReady.textContent=mine?.ready?'Unready':'Ready';if(m.status==='countdown')snakeStatus.textContent='Starting in '+Math.max(1,Math.ceil((m.countdownEndsAt-Date.now())/1000))+'…';else if(m.status==='playing')snakeStatus.textContent='Battle in progress • '+m.players.filter(p=>p.alive).length+' alive';else if(m.status==='finished')snakeStatus.textContent=m.winner==='draw'?'Draw!':'Winner: '+m.winner;else snakeStatus.textContent=m.players.length<2?'Waiting for at least 2 players':m.players.every(p=>p.ready)?'Starting…':'Everyone must press Ready'}
     snakeReady.onclick=()=>{const me=snakeState.players.find(p=>p.user===bGetUser());snakeSend({type:'snake_ready',ready:!me?.ready})};function snakeExit(){if(!snakeModal.classList.contains('show')&&!snakeState.players?.some(p=>p.user===bGetUser())&&!snakeState.spectators?.includes(bGetUser()))return;snakeSend({type:'snake_leave'});snakeModal.classList.remove('show')}snakeModal.querySelector('[data-snake-close]').onclick=snakeExit;snakeModal.querySelector('[data-snake-sound]').textContent=snakeSound?'🔊':'🔇';snakeModal.querySelector('[data-snake-sound]').onclick=e=>{snakeSound=!snakeSound;localStorage.setItem('bajsas_snake_sound',snakeSound?'1':'0');e.currentTarget.textContent=snakeSound?'🔊':'🔇'};document.addEventListener('keydown',e=>{if(!snakeModal.classList.contains('show')||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key))return;e.preventDefault();const d={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'}[e.key];snakeSend({type:'snake_direction',direction:d})});setInterval(()=>{if(snakeState.status==='countdown')snakeStatus.textContent='Starting in '+Math.max(1,Math.ceil((snakeState.countdownEndsAt-Date.now())/1000))+'…'},250);
     const snakeBtn=document.createElement('button');snakeBtn.className='custom-stream-btn bajsas-game-selector';snakeBtn.textContent='SNAKE';snakeBtn.onclick=()=>{snakeModal.classList.add('show');snakeSend({type:'snake_join'});snakeSend({type:'snake_get'})};btnRow.appendChild(snakeBtn);window.addEventListener('pagehide',snakeExit);


     function bPing(ev) {
         try {
             const tw = bGetUser();
             const payload = { id: bid, version: APP_VERSION, event: ev, twitchUser: tw };
             const body = JSON.stringify(payload);
             // Auth: send ?key= (always) + ?tok= (if available)
             // Worker accepts both — key is legacy fallback, tok is HMAC token
             const keyQ = 'key=' + encodeURIComponent(PING_KEY);
             const tokQ = bToken ? '&tok=' + encodeURIComponent(bToken) : '';
             const query = '?' + keyQ + tokQ + '&id=' + encodeURIComponent(bid) + '&version=' + encodeURIComponent(APP_VERSION) + '&event=' + encodeURIComponent(ev) + '&twitchUser=' + encodeURIComponent(tw) + '&t=' + Date.now();
             // Send one request. The previous implementation fired fetch, an
             // image beacon, and sendBeacon simultaneously; button handlers also
             // called bPing twice. That produced up to six writes for one switch
             // and queued Durable Object storage before the WebSocket update.
             // Use the image transport only when the primary fetch actually fails.
             dbg('ping:send', { event: ev, twitchUser: tw, id: bid });
             try {
                 fetch(PING_URL + query, {
                     method: 'POST',
                     // text/plain is a CORS-simple request, avoiding the
                     // OPTIONS preflight that delayed every channel switch.
                     headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                     body,
                     keepalive: true,
                     mode: 'cors'
                 }).then(r => dbg('ping:response', { event: ev, status: r.status })).catch((error) => {
                     dbg('ping:fallback-image', { event: ev, error: String(error) });
                     try { const img = new Image(); img.src = PING_URL + query; } catch {}
                 });
             } catch (error) {
                 dbg('ping:exception', { event: ev, error: String(error) });
                 try { const img = new Image(); img.src = PING_URL + query; } catch {}
             }
         } catch {}
     }

     function bApplyLocalWatch(channel) {
         const me = bGetUser();
         if (!me || !channel) return;
         const now = Date.now();
         const pendingOffline = bOfflineTimers.get(me);
         if (pendingOffline) { clearTimeout(pendingOffline); bOfflineTimers.delete(me); }
         bwm.set(me, { channel, lastSeen: now });
         bSaveWatchCache();
         // Update this browser immediately instead of waiting for the Worker
         // round trip. The WebSocket echo remains authoritative for everyone else.
         bRefreshUser(me);
     }

     function bStartPing() {
         // One-shot state update only. Repeating heartbeat pings were removed;
 // navigation, stream selection, and tab visibility still send updates.
 const ch = bCurrentChannel();
 if (ch) {
 const safeCh = ch.slice(0,30).replace(/[^a-zA-Z0-9_\- ]/g,'');
 bPing('watch:' + safeCh);
 } else bPing('heartbeat');
 }

     const bMessageTimers = new WeakMap();
     function bQueueProcess(msg, delay = 0) {
         if (!msg || msg.getAttribute('data-baj-processed') || bMessageTimers.has(msg)) return;
         // Render on the native message frame. Local watch-cache hydration means
         // normal messages no longer wait for a WebSocket round trip.
         dbg('badge:queue', { delay, snapshot: msg.dataset.bajSnapshotChannel || '', pendingUser: msg.dataset.bajPendingUser || '' });
         const timer = setTimeout(() => {
             bMessageTimers.delete(msg);
             if (msg.isConnected && !msg.getAttribute('data-baj-processed')) bProcess(msg);
         }, delay);
         bMessageTimers.set(msg, timer);
     }

     const MESSAGE_SELECTOR = '[data-a-target="chat-line-message"], .seventv-user-message, .seventv-ban-slider';
     const bCanonicalMessage = msg => {
         if (!msg) return null;
         if (msg.classList?.contains('seventv-ban-slider')) return msg.querySelector('.seventv-user-message') || msg;
         // 7TV can nest its message inside Twitch's native line. Always choose
         // one canonical owner so two observers cannot inject duplicate badges.
         return msg.querySelector?.('.seventv-user-message') || msg;
     };

     function bScan(root) {
         const messages = [];
         if (root?.nodeType === 1 && root.matches?.(MESSAGE_SELECTOR)) messages.push(bCanonicalMessage(root));
         if (root?.querySelectorAll) messages.push(...[...root.querySelectorAll(MESSAGE_SELECTOR)].map(bCanonicalMessage));
         for (const msg of new Set(messages.filter(Boolean))) {
             if (!msg.getAttribute('data-baj-processed')) bQueueProcess(msg);
         }
     }

     function bCheckNode(node) {
         if (node.nodeType !== 1) return;
         const closest = bCanonicalMessage(node.closest?.(MESSAGE_SELECTOR));
         if (closest && !closest.getAttribute('data-baj-processed')) bQueueProcess(closest);
         bScan(node);
     }

     function bGetName(msg) {
         const valid = value => {
             const n = String(value || '').trim().toLowerCase().replace(/^@/, '');
             return /^[a-z0-9_]{3,25}$/.test(n) ? n : '';
         };

         // Prefer machine-readable login attributes. Display names may contain
         // Unicode, localized text, badges, or casing that differs from login.
         for (const el of [msg, ...msg.querySelectorAll('[data-user], [data-login], [data-username], [data-a-user]')]) {
             const n = valid(el.dataset?.user || el.dataset?.login || el.dataset?.username || el.getAttribute?.('data-a-user'));
             if (n) { dbg('badge:username-found', { method: 'attribute', username: n }); return n; }
         }

         const selectors = [
             '[data-a-target="chat-message-username"]',
             '.seventv-chat-user-username',
             '.chat-author__display-name',
             '[data-test-selector="message-username"]',
             'button[aria-label*="username" i]'
         ];
         for (const selector of selectors) {
             const el = msg.querySelector(selector);
             if (!el) continue;
             const candidates = [
                 el.getAttribute('data-user'), el.getAttribute('data-login'), el.getAttribute('data-username'),
                 el.getAttribute('data-a-user'), el.textContent
             ];
             for (const candidate of candidates) {
                 const n = valid(candidate);
                 if (n) { dbg('badge:username-found', { method: selector, username: n }); return n; }
             }
         }

         dbg('badge:username-missing', { html: msg.outerHTML?.slice(0, 500) || '' });
         return '';
     }

     function bLookupWatch(username) {
         const live = bwm.get(username);
         if (live?.channel) {
             dbg('badge:watch-found', { username, channel: live.channel, source: 'memory' });
             return live;
         }
         const cached = bLocalWatchCache.get(username);
         if (cached?.channel && Date.now() - (cached.lastSeen || 0) < WATCH_CACHE_TTL) {
             bwm.set(username, cached);
             dbg('badge:watch-found', { username, channel: cached.channel, source: 'localStorage' });
             return cached;
         }
         dbg('badge:watch-missing', { username });
         return null;
     }

     // Same as old app processMessage — badge shows raw watching value,
     // click tries overlay first, falls back to new tab
     function bProcess(msg) {
         if (msg.getAttribute('data-baj-processed')) return;
         if (msg.classList?.contains('seventv-ban-slider')) { const inner = msg.querySelector('.seventv-user-message'); if (inner) { bProcess(inner); return; } }
         const username = msg.dataset.bajSnapshotUser || bGetName(msg);
         if (!username) {
             // Twitch/7TV often inserts the message container in multiple DOM
             // mutations. Do not permanently mark a half-built message as done.
             const attempts = Number(msg.dataset.bajNameAttempts || 0) + 1;
             msg.dataset.bajNameAttempts = String(attempts);
             dbg('badge:username-not-ready', { attempts });
             if (attempts < 20) bQueueProcess(msg, 50);
             return;
         }
         delete msg.dataset.bajNameAttempts;
         msg.setAttribute('data-baj-processed', '1');
         const self = bGetUser();
         if (self && username === self) {
             const currentChannel = bCurrentChannel();
             if (currentChannel) {
                 const ownState = { channel: currentChannel, lastSeen: Date.now() };
                 bwm.set(username, ownState);
                 bLocalWatchCache.set(username, ownState);
                 bSaveWatchCache();
                 dbg('badge:self-immediate-state', { username, channel: currentChannel });
             }
         }
         const watchInfo = bLookupWatch(username);
         const snapshotChannel = msg.dataset.bajSnapshotChannel || '';
         if (!snapshotChannel && (!watchInfo || !watchInfo.channel)) {
             // Keep only a short-lived pending marker. A watch_update can fill
             // this message, while old chat history is never rewritten later.
             msg.dataset.bajPendingUser = username;
             msg.dataset.bajPendingAt = String(Date.now());
             dbg('badge:pending-watch-state', { username });
             return;
         }
         delete msg.dataset.bajPendingUser;
         delete msg.dataset.bajPendingAt;

         // Once assigned, this value is the immutable state for this message.
         // It also lets us reconstruct the badge after a Firefox/7TV rerender.
         const ch = snapshotChannel || watchInfo.channel;
         msg.dataset.bajSnapshotChannel = ch;
         msg.dataset.bajSnapshotUser = username;
         // Same as old app: includes() for same-channel check
         const currentTwitchChannel = bGetCh();
         const isSame = currentTwitchChannel && ch.toLowerCase().includes(currentTwitchChannel);

         // Find the colon span for badge insertion
         let colonSpan = null;
         for (const sp of msg.querySelectorAll('span')) {
             const t = sp.textContent;
             if ((t === ': ' || t === ':' || t === ':\u00A0') && sp.children.length === 0) { colonSpan = sp; break; }
         }

         // Same badge format as old app
         const badge = document.createElement('span');
         badge.className = 'bajsas-watch-badge';
         badge.dataset.bajUser = username;
         badge.dataset.bajChannel = ch;
         badge.textContent = ch.slice(0,20);
         const timeStr = new Date(watchInfo.lastSeen || Date.now()).toLocaleTimeString();
         badge.title = 'Watching ' + ch + ' since ' + timeStr + ' (click to join) \u2022 BajSAS';

         // Click: try overlay button first, else load in existing overlay iframe
         // Same as old app: _doLoadStream(found.url, found.name, 'overlay')
         // Never window.open — keeps 1 overlay on the page
         const handleBadgeAction = () => {
             try {
                 // Each message keeps the channel captured when it was created.
                 const found = bFindOverlayBtn(ch);
                 if (found) {
                     found.click();
                 } else {
                     v.muted = false;
                     try { v.play(); } catch {}
                     i.src = '';
                     i.style.display = 'none';
                     removeForsenChat();
                     location.assign('/' + encodeURIComponent(ch));
                 }
             } catch(err) { console.warn('[BajSAS] join error', err); }
         };

         // Same event handlers as old app — beat 7TV pointer capture
         badge.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
         badge.addEventListener('click', (e) => {
             e.stopPropagation();
             e.stopImmediatePropagation();
             e.preventDefault();
             handleBadgeAction();
         }, true);

         if (isSame) {
             badge.style.opacity = '0.55';
             badge.style.background = 'rgba(255,255,255,0.08)';
             badge.style.color = '#adadb8';
         }

         try {
             if (colonSpan) {
                 colonSpan.parentNode.insertBefore(badge, colonSpan);
             } else {
                 msg.appendChild(badge);
             }
             dbg('badge:displayed', { username, channel: ch, restored: Boolean(snapshotChannel), insertion: colonSpan ? 'before-colon' : 'append' });
             } catch (error) { dbg('badge:display-error', { username, channel: ch, error: String(error) }); }
     }

     // Existing badges are historical snapshots: never rewrite old messages.
     // Only unprocessed/new messages receive the user's latest channel.
 function bRefreshUser(username) {
 const watchInfo = bwm.get(username);
 if (!watchInfo?.channel) return;
 // Recover only messages that arrived during the current network race window.
 // Existing badges and older history remain immutable.
 const now = Date.now();
 document.querySelectorAll('[data-baj-pending-user]').forEach(msg => {
 if (msg.dataset.bajPendingUser !== username) return;
 const age = now - Number(msg.dataset.bajPendingAt || 0);
 delete msg.dataset.bajPendingUser;
 delete msg.dataset.bajPendingAt;
 if (age < 5000) {
 msg.removeAttribute('data-baj-processed');
 bQueueProcess(msg, 0);
 }
 });
 }

     // When user goes offline, dim their badges but don't remove —
     // the messages were real, the user WAS watching at that time.
     function bRemoveUser(username) {
         document.querySelectorAll('.bajsas-watch-badge').forEach(b => {
             if (b.dataset.bajUser !== username) return;
             b.style.opacity = '0.35';
             b.style.textDecoration = 'line-through';
             b.title = (b.dataset.bajChannel || '') + ' (offline) \u2022 BajSAS';
         });
     }

     // Scan only for messages that do not have a badge yet. Existing message
     // badges remain immutable historical snapshots.
     function bRefreshAll() {
         bRescanChat();
     }

     let bLastCh = bGetCh();
     let bNavCheckTimer = null;
     let bLastProcessedCh = bLastCh;

     function bOnNav() {
         clearTimeout(bNavCheckTimer);
         bNavCheckTimer = setTimeout(bCheckNav, 50);
         setTimeout(bCheckNav, 300);
         setTimeout(bCheckNav, 800);
         setTimeout(bCheckNav, 2000);
     }

     function bCheckNav() {
         const ch = bGetCh();
         const urlChanged = ch !== bLastCh;

         // A Twitch SPA navigation always means native Twitch. Clear the old
         // overlay state BEFORE calculating curCh; previously the stale overlay
         // name could equal bLastProcessedCh and return early, skipping the new
         // chat observer and watch-state update.
         if (urlChanged) { snakeExit(); bActiveStream = ''; }
         const curCh = bActiveStream || ch;
         if (!urlChanged && curCh === bLastProcessedCh) return;

         if (String(curCh).toLowerCase().replace(/\s+/g,'') !== 'main2') destroyMediaPlayer();
         bGameUiEnabled=false;bGameModal.classList.remove('show');
         const previousUrlChannel = bLastCh;
         bLastCh = ch;
         bLastProcessedCh = curCh;
         dbg('navigation:changed', { from: previousUrlChannel, to: ch, watching: curCh, urlChanged });

         if (curCh) {
             bApplyLocalWatch(curCh);
             bPing('watch:' + curCh.slice(0,30));
         }

         // Twitch reconstructs chat during SPA navigation. Invalidate the old
         // target reference so bStartObs cannot mistake a detached/shell node
         // for the current chat and scan it repeatedly.
         if (urlChanged && bObservedChatBox && !bObservedChatBox.isConnected) {
             bchatObs?.disconnect();
             bchatObs = null;
             bObservedChatBox = null;
         }
         bStartObs();
         requestAnimationFrame(bStartObs);
         setTimeout(bStartObs, 50);
         setTimeout(bStartObs, 150);
         setTimeout(bStartObs, 400);
     }

     function bStartObs() {
         const chatBox = document.querySelector('.stream-chat');
         if (!chatBox) {
             clearTimeout(bChatRetryTimer);
             bChatRetryTimer = setTimeout(bStartObs, 100);
             return;
         }
         clearTimeout(bChatRetryTimer);
         if (bchatObs && bObservedChatBox === chatBox) {
             bScan(chatBox);
             return;
         }
         bchatObs?.disconnect();
         bObservedChatBox = chatBox;
         dbg('chat-observer:bound', { className: chatBox.className });
         bchatObs = new MutationObserver((muts) => {
             for (const m of muts) {
                 for (const n of m.addedNodes) bCheckNode(n);
                 // A framework rerender can remove only our badge. Recover the
                 // same historical snapshot immediately instead of waiting for
                 // the 15-second safety scan.
                 const msg = m.target.nodeType === 1
                     ? (m.target.closest?.('[data-baj-snapshot-channel]') || null)
                     : null;
                 if (msg && !msg.querySelector('.bajsas-watch-badge')) {
                     dbg('badge:removed-by-dom-rerender', { username: msg.dataset.bajSnapshotUser || '', channel: msg.dataset.bajSnapshotChannel || '' });
                     msg.removeAttribute('data-baj-processed');
                     // Restore before the browser's next paint. setTimeout(0)
                     // caused a visible one-frame blink in Firefox.
                     bProcess(msg);
                 }
             }
         });
         bchatObs.observe(chatBox, { childList: true, subtree: true });
         bScan(chatBox);
     }

     // Hook into stream selector buttons — same as old app handleNavigation
     function bHookButtons() {
         btnRow.querySelectorAll('.custom-stream-btn[data-stream-selector="1"]').forEach(btn => {
             btn.addEventListener('click', () => {
                 snakeExit();destroyMediaPlayer();
                 bGameUiEnabled=false;bGameModal.classList.remove('show');
                 if (btn.dataset.streamUrl) {
                     // Use the button display name (first field before ; in channel list)
                     // Same as old app: _activeStreamName = name
                     // e.g. "---Cinema MAIN---" not "krichure"
                     const name = btn.dataset.streamName || '';
                     bActiveStream = name;
                     bLastProcessedCh = name;
                     // Sanitize same as old app: keep alphanumeric, dash, underscore, space
                     const safeName = name.slice(0,30).replace(/[^a-zA-Z0-9_\- ]/g,'');
                     bApplyLocalWatch(safeName);
                     bPing('watch:' + safeName);
                 } else {
                     bActiveStream = '';
                     const ch = bGetCh();
                     bLastProcessedCh = ch;
                     if (ch) {
                         bApplyLocalWatch(ch.slice(0,30));
                         bPing('watch:' + ch.slice(0,30));
                     } else bPing('heartbeat');
             }
             // The branch above already sent the new state exactly once.
             bRefreshAll();
         });
     });
 }

     // Init
     bid = bGetId();

    // Detect which stream is already active on page load.
    // The initial selection above is made with btn.onclick() before
    // bHookButtons() is installed, so derive the state from activeBtn too.
    // Without this, a fresh install that defaults to the first overlay reports
    // the Twitch page URL until the user clicks a button (or the next poll).
    if (activeBtn?.dataset.streamUrl) {
        bActiveStream = activeBtn.dataset.streamName || savedStream || '';
    } else {
        bActiveStream = '';
    }
    bLastProcessedCh = bCurrentChannel();

    // Install click tracking before starting network synchronization.
    bHookButtons();

    // Start token fetch in background (adds ?tok= to pings when ready).
    // Fetch the map once now, then again after the initial ping has had time
    // to reach the worker. Previously the only retry was the 120-second poll.
    bFetchToken();
    bConnectWS();
    bStartObs();
    bStartPing();

     // Safety net: periodic re-scan for messages that didn't get badges
     setInterval(() => { bRescanChat(); }, 15000);

     if (window.navigation) window.navigation.addEventListener('navigate', () => setTimeout(bOnNav, 100));
     const titleEl = document.querySelector('title');
     if (titleEl) new MutationObserver(() => { if (bGetCh() !== bLastCh) bOnNav(); }).observe(titleEl, { childList: true, subtree: true });
     window.addEventListener('popstate', bOnNav);

     // Offline ping — send key + token for auth
     function bPingOffline() {
         const tw = bGetUser();
         const payload = { id: bid, version: APP_VERSION, event: 'offline', twitchUser: tw };
         const body = JSON.stringify(payload);
         const keyQ = 'key=' + encodeURIComponent(PING_KEY);
         const tokQ = bToken ? '&tok=' + encodeURIComponent(bToken) : '';
         try { fetch(PING_URL + '?' + keyQ + tokQ, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true, mode: 'cors' }).catch(()=>{}); } catch {}
         try { if (navigator.sendBeacon) { const blob = new Blob([body], { type: 'application/json' }); navigator.sendBeacon(PING_URL + '?' + keyQ + tokQ, blob); } } catch {}
     }
     window.addEventListener('beforeunload', bPingOffline);
     window.addEventListener('pagehide', bPingOffline);

     // Same as old app: send heartbeat when tab becomes visible
     document.addEventListener('visibilitychange', () => {
         if (!document.hidden) {
             const ch = bCurrentChannel();
             bPing(ch ? 'watch:' + ch.slice(0,30) : 'heartbeat');
         }
     });

     console.log('[BajSAS] Chat watch badges initialized (active: ' + (bActiveStream || bGetCh() || 'none') + ')');
 }
})();
