javascript:(async function(){
 if (window.self !== window.top) return; // don't run inside iframes
 console.log('[BajSAS Lite] Starting...');
 if (document.getElementById('custom-stream-wrapper')) { console.log('[BajSAS Lite] Already running — remove #custom-stream-wrapper first'); return; }

 const v = document.querySelector('video');
 if (!v) { console.log('[BajSAS Lite] No <video> element found — are you on a Twitch channel page?'); return; }
 console.log('[BajSAS Lite] Video found, loading channels...');

 const listUrl = "https://gist.githubusercontent.com/BestestCreature/53b495e6b30595283967c4817e33cfc0/raw/";
 const WORKER_BASE_URL = 'https://bitter-meadow-24f3.jeffvanss1.workers.dev';
 const APP_VERSION = 'lite 3.4';

 const LS_STREAM = "customStream_selected";
 const LS_HIDE = "customStream_hideUntilHover";
 const LS_THEATER = "customStream_theater";
 const LS_FORSEN = "forsenChatEnabled";

 let channels = [];
 try {
 const resp = await fetch(listUrl);
 const text = await resp.text();
 channels = text.trim().split('\n').map(line => line.split(';'));
 } catch (e) { console.log('[BajSAS Lite] Failed to load channel list:', e); return; }

 const savedStream = localStorage.getItem(LS_STREAM);
 const isTheaterSaved = localStorage.getItem(LS_THEATER) === "1";
 let hideUntilHover = localStorage.getItem(LS_HIDE) === "1";

 const liveCache = new Map();

 const injectLiveDotStyle = () => {
 const s = document.createElement('style');
 s.textContent = `
 #custom-stream-ui {
 opacity: 0.5;
 transition: opacity 0.2s;
 }

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

 .live-dot {
 display: none;
 width: 7px;
 height: 7px;
 border-radius: 50%;
 background: #ff1744;
 box-shadow: 0 0 0 rgba(255,23,68,.7);
 animation: livePulse 1.2s infinite;
 }

 .is-live .live-dot {
 display: inline-block;
 }

 @keyframes livePulse {
 0% { box-shadow: 0 0 0 0 rgba(255,23,68,.7); }
 70% { box-shadow: 0 0 0 6px rgba(255,23,68,0); }
 100% { box-shadow: 0 0 0 0 rgba(255,23,68,0); }
 }

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
 `;
 document.head.appendChild(s);
 };

 injectLiveDotStyle();

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
 if (cached && Date.now() - cached.time < 30000) {
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

 const targetContainer = v.closest('div') || v.parentElement;
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
 targetContainer.addEventListener('pointermove', setStreamUiActive, { passive: true });
 targetContainer.addEventListener('pointerdown', setStreamUiActive, { passive: true });
 targetContainer.addEventListener('pointerleave', setStreamUiIdle, { passive: true });
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
 box.style.cssText = 'position:absolute;bottom:75px;left:0px;padding:8px 12px;background:rgba(0,0,0,0.85);backdrop-filter:blur(4px);color:#fff;border-radius:6px;font-family:sans-serif;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;flex-direction:column;gap:6px;pointer-events:auto;';

 const label = document.createElement('div');
 label.innerText = 'Select stream';
 label.style.cssText = 'font-size:11px;font-weight:bold;text-transform:uppercase;opacity:0.7;letter-spacing:0.5px;';
 box.appendChild(label);

 const btnRow = document.createElement('div');
 btnRow.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
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

 const updateBtnLiveUI = async (btn, url, desc, name) => {
 const live = await checkLiveStatus(url);
 btn.classList.toggle('is-live', live);
 btn.title = `${desc || name}${live ? ' — LIVE' : ' — offline/unknown'}`;
 };

 let buttonPreviewCard = null;
 let buttonPreviewTimer = null;
 let buttonPreviewToken = 0;
 let buttonPreviewVisibleUrl = '';
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

 const getButtonPreview = async (name, url) => {
 const cached = buttonPreviewCache.get(url);
 if (cached && Date.now() - cached.at < 60000) return cached.data;
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
 image: thumb || j?.banner_image?.url || (!j?.livestream ? (j?.offline_banner_image?.src || j?.offline_banner_image?.url || j?.user?.profile_pic) : '') || '',
 live: !!j?.livestream
 };
 } else {
 const r = await fetch(`${WORKER_BASE_URL}/stream-preview?url=${encodeURIComponent(url)}`, { cache: 'no-store' });
 const fallback = await r.json();
 data = { title: fallback.title || name, platform: 'Kick', image: fallback.image || '', live: fallback.live === true };
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
 const jobs = channels.filter(([, url]) => url).map(([name, url]) => () => getButtonPreview(name, url));
 let cursor = 0;
 const worker = async () => { while (cursor < jobs.length) { const job = jobs[cursor++]; try { await job(); } catch {} } };
 const start = () => Promise.all([worker(), worker(), worker()]);
 if ('requestIdleCallback' in window) requestIdleCallback(() => start(), { timeout: 1800 });
 else setTimeout(start, 500);
 };

 const hideButtonPreview = () => {
 clearTimeout(buttonPreviewTimer); const token = ++buttonPreviewToken;
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
 }, 60);
 };

 const createBtn = (text, src, desc, isNative = false, emoteUrl = '') => {
 const btn = document.createElement('button');
 btn.className = 'custom-stream-btn';
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

 btn.onclick = () => {
 if (isNative) {
 v.muted = false;
 try { v.play(); } catch {}
 i.src = '';
 i.style.display = 'none';
 removeForsenChat();
 } else {
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

 localStorage.setItem(LS_STREAM, text);
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
 if (!url) return;

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
 if (!url) return;

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

 let bwm = new Map(); // username → { channel, lastSeen }
 const bOfflineTimers = new Map(); // username → pending offline timeout
 let bws = null, bwsTimer = null, bchatObs = null;
     let bid = '';
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
         return '';
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
 bScan(chatBox);
 }

     function bApplyUserSnapshot(users) {
         bwm.clear();
         for (const u of (users || [])) {
             const tw = String(u.twitchUser || '').toLowerCase();
             const ch = u.watching || (u.event?.startsWith('watch:') ? u.event.slice(6) : '');
             if (!tw || !ch || Date.now() - (u.lastSeen || 0) >= 86400000) continue;
             const existing = bwm.get(tw);
             if (!existing || existing.lastSeen <= (u.lastSeen || 0)) {
                 bwm.set(tw, { channel: ch, lastSeen: u.lastSeen || Date.now() });
             }
         }
         bRefreshAll();
         bRescanChat();
     }

     function bConnectWS() {
         try {
             if (bws && bws.readyState <= 1) return;
             bws = new WebSocket(WS_URL);
             bws.onmessage = (e) => {
                 try {
 const m = JSON.parse(e.data);
 if (m.type === 'connected' && Array.isArray(m.users)) {
 bApplyUserSnapshot(m.users);
 } else if (m.type === 'force_watch' && m.channel) {
 const target = String(m.target || 'all').toLowerCase();
 const me = bGetUser();
 const applies = target === 'all' || target === bid.toLowerCase() || (me && target === me);
 if (!applies) return;
 const channel = String(m.channel).trim();
 const native = channel.toLowerCase() === 'twitch'
 ? [...document.querySelectorAll('.custom-stream-btn')].find(btn => !btn.dataset.streamUrl)
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
 const ch = m.watching || (m.event || '').replace('watch:', '');
 const incomingTime = m.lastSeen || Date.now();
 const current = bwm.get(k);
 // A pagehide/offline event from the old stream can arrive immediately before
 // the new watch event. Cancel its pending removal and reject stale updates.
 const pendingOffline = bOfflineTimers.get(k);
 if (pendingOffline) { clearTimeout(pendingOffline); bOfflineTimers.delete(k); }
 if (ch && (!current || incomingTime >= current.lastSeen)) {
 bwm.set(k, { channel: ch, lastSeen: incomingTime });
 bRefreshUser(k);
 }
 } else if (m.type === 'user_offline') {
 const k = (m.twitchUser || '').toLowerCase();
 if (k) {
 const snapshotTime = bwm.get(k)?.lastSeen || 0;
 clearTimeout(bOfflineTimers.get(k));
 const timer = setTimeout(() => {
 bOfflineTimers.delete(k);
 // Do not delete a newer watch update that arrived after this offline event.
 const current = bwm.get(k);
 if (!current || current.lastSeen !== snapshotTime) return;
 bwm.delete(k);
 bRemoveUser(k);
 }, 2000);
 bOfflineTimers.set(k, timer);
 }
 }
                 } catch {}
             };
             bws.onclose = () => { bws = null; if (bwsTimer) clearTimeout(bwsTimer); bwsTimer = setTimeout(bConnectWS, 8000); };
             bws.onerror = () => { try { bws.close(); } catch {} };
         } catch {}
     }

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
             try {
                 fetch(PING_URL + query, {
                     method: 'POST',
                     // text/plain is a CORS-simple request, avoiding the
                     // OPTIONS preflight that delayed every channel switch.
                     headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                     body,
                     keepalive: true,
                     mode: 'cors'
                 }).catch(() => {
                     try { const img = new Image(); img.src = PING_URL + query; } catch {}
                 });
             } catch {
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

     function bScan(root) {
         const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
             acceptNode: (n) => {
                 if (n.tagName !== 'SPAN') return NodeFilter.FILTER_SKIP;
                 const t = n.textContent;
                 return ((t === ': ' || t === ':' || t === ':\u00A0') && n.children.length === 0) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
             }
         });
         const found = [];
         while (w.nextNode()) found.push(w.currentNode);
         for (const cs of found) {
             const msg = cs.closest('[data-a-target="chat-line-message"]') || cs.closest('.seventv-user-message') || cs.closest('.seventv-ban-slider') || cs.parentElement;
             if (msg && !msg.getAttribute('data-baj-processed')) bProcess(msg);
         }
     }

     function bCheckNode(node) {
         if (node.nodeType !== 1) return;
         if (node.tagName === 'SPAN' && node.children.length === 0) {
             const t = node.textContent;
             if (t === ': ' || t === ':' || t === ':\u00A0') {
                 const msg = node.closest('[data-a-target="chat-line-message"]') || node.closest('.seventv-user-message') || node.closest('.seventv-ban-slider') || node.parentElement;
                 if (msg && !msg.getAttribute('data-baj-processed')) bProcess(msg);
                 return;
             }
         }
         for (const sp of node.querySelectorAll('span')) {
             const t = sp.textContent;
             if ((t === ': ' || t === ':' || t === ':\u00A0') && sp.children.length === 0) {
                 const msg = sp.closest('[data-a-target="chat-line-message"]') || sp.closest('.seventv-user-message') || sp.closest('.seventv-ban-slider') || sp.parentElement;
                 if (msg && !msg.getAttribute('data-baj-processed')) bProcess(msg);
             }
         }
     }

     function bGetName(msg) {
         for (const sp of msg.querySelectorAll('span')) {
             const t = sp.textContent;
             if ((t === ': ' || t === ':' || t === ':\u00A0') && sp.children.length === 0) {
                 let prev = sp.previousElementSibling;
                 if (prev) {
                     const deep = prev.querySelector('.seventv-chat-user-username,[data-a-target="chat-message-username"],.chat-author__display-name');
                     const te = deep || prev;
                     const n = te.textContent.trim().toLowerCase().replace('@','').split(' ')[0].split(':')[0];
                     if (/^[a-z0-9_]{3,25}$/.test(n)) return n;
                 }
             }
         }
         for (const sel of ['[data-a-target="chat-message-username"]','.seventv-chat-user-username','.chat-author__display-name']) {
             try { const el = msg.querySelector(sel); if (el) { const n = el.textContent.trim().toLowerCase(); if (/^[a-z0-9_]{3,25}$/.test(n)) return n; } } catch {}
         }
         return '';
     }

     // Same as old app processMessage — badge shows raw watching value,
     // click tries overlay first, falls back to new tab
     function bProcess(msg) {
         if (msg.getAttribute('data-baj-processed')) return;
         if (msg.classList?.contains('seventv-ban-slider')) { const inner = msg.querySelector('.seventv-user-message'); if (inner) { bProcess(inner); return; } }
         msg.setAttribute('data-baj-processed', '1');
         const username = bGetName(msg);
         if (!username) return;
         const watchInfo = bwm.get(username);
         if (!watchInfo || !watchInfo.channel) return;

         const ch = watchInfo.channel;
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
            } catch {}
     }

     // Existing badges are historical snapshots: never rewrite old messages.
     // Only unprocessed/new messages receive the user's latest channel.
 function bRefreshUser(username) {
 const watchInfo = bwm.get(username);
 if (!watchInfo?.channel) return;
 // Updating bwm is enough. MutationObserver will apply this state only to
 // messages inserted from this point onward.
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
         const curCh = bActiveStream || ch;
         if (curCh === bLastProcessedCh) return;
         bLastCh = ch;
         bLastProcessedCh = curCh;
         bActiveStream = ''; // URL changed → native Twitch

         console.log('[BajSAS] Channel changed: → ' + curCh);

         if (curCh) {
             bApplyLocalWatch(curCh);
             bPing('watch:' + curCh.slice(0,30));
         }
         bRefreshAll();

         if (bchatObs) { bchatObs.disconnect(); bchatObs = null; }
         setTimeout(bStartObs, 1500);
         setTimeout(bStartObs, 3000);

     }

     function bStartObs() {
         const chatBox = document.querySelector('.stream-chat');
         if (!chatBox) { setTimeout(bStartObs, 2000); return; }
         bchatObs = new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) bCheckNode(n); });
         bchatObs.observe(chatBox, { childList: true, subtree: true });
         bScan(chatBox);
     }

     // Hook into stream selector buttons — same as old app handleNavigation
     function bHookButtons() {
         document.querySelectorAll('.custom-stream-btn').forEach(btn => {
             btn.addEventListener('click', () => {
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
