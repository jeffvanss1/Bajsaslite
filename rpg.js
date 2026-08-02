javascript:(function () {
  'use strict';
  if (window.BajSASRPG?.loaded) return window.BajSASRPG.open();

  const VERSION = 'rpg-prototype-0.4-integrated';
  const SAVE_KEY = 'bajsas_rpg_profile_v1';
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const freshProfile = () => ({
    level: 1, xp: 0, xpNext: 50, maxHp: 100, hp: 100,
    attack: 12, defense: 5, speed: 8, bandages: 3,
    weapon: 'Rusty Pipe', armor: 'Scrap Armor', wins: 0, losses: 0,
    inventory: ['Rusty Pipe', 'Scrap Armor'],
    campaign: { zone: 1, completed: ['start'], unlocked: ['battle1', 'event1'] }
  });
  let profile;
  try { profile = { ...freshProfile(), ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; }
  catch { profile = freshProfile(); }
  profile.campaign ||= freshProfile().campaign;
  const save = () => localStorage.setItem(SAVE_KEY, JSON.stringify(profile));

  const ROUTE = [
    { id:'start', type:'start', x:26, y:90, next:['battle1','event1'], label:'Outpost' },
    { id:'battle1', type:'battle', x:84, y:48, next:['loot1'], label:'Raiders' },
    { id:'event1', type:'event', x:84, y:132, next:['rest1','loot1'], label:'Ruins' },
    { id:'loot1', type:'loot', x:148, y:48, next:['elite1'], label:'Supply Cache' },
    { id:'rest1', type:'rest', x:148, y:132, next:['elite1'], label:'Campfire' },
    { id:'elite1', type:'elite', x:218, y:90, next:['boss1'], label:'War Chief' },
    { id:'boss1', type:'boss', x:288, y:90, next:[], label:'Overseer' }
  ];
  const routeById = id => ROUTE.find(node => node.id === id);
  let view = 'map';
  let pendingMission = null;
  let battle = null;
  let busy = false;
  let sound = localStorage.getItem('bajsas_rpg_sound') !== '0';
  let audio = null;
  const tone = (frequency, duration = .07, type = 'square') => {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
      osc.type = type; osc.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(.045, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
      osc.connect(gain).connect(audio.destination); osc.start(now); osc.stop(now + duration);
    } catch {}
  };

  const style = document.createElement('style');
  style.id = 'bajsas-rpg-style';
  style.textContent = `
    .bajrpg{display:none;position:absolute;right:14px;bottom:86px;width:320px;min-width:250px;max-width:min(560px,76vw);max-height:calc(100% - 108px);overflow:auto;z-index:2147483645;color:#dce7c4;font:12px/1.3 monospace;pointer-events:auto;opacity:.94;transform:translateZ(0);filter:drop-shadow(0 16px 30px #000);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);contain:layout paint style}
    .bajrpg.show{display:block;animation:bajrpg-in .18s ease-out}.bajrpg:hover{opacity:1}.bajrpg-window{position:relative;background:rgba(18,25,20,.88);border:2px solid #64735a;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:8px;border-radius:5px}.bajrpg-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #4c5946;padding-bottom:6px;margin-bottom:7px}.bajrpg-title{font-weight:bold;color:#d7c36b}.bajrpg-resize{position:absolute!important;left:-7px;top:36px;z-index:4;width:27px;height:27px;padding:0!important;border-radius:50%!important;cursor:nwse-resize!important;touch-action:none;user-select:none}.bajrpg button{font:11px monospace;color:#e9f0d9;background:linear-gradient(#4f5c47,#30392d);border:1px solid #7e906f;padding:5px 8px;cursor:pointer;border-radius:3px}.bajrpg button:hover{filter:brightness(1.16)}.bajrpg button:disabled{opacity:.45;cursor:not-allowed}.bajrpg-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.bajrpg-card{background:rgba(0,0,0,.24);border:1px solid #4c5946;padding:7px}.bajrpg-stat{display:flex;justify-content:space-between}.bajrpg-bar{height:8px;background:#252b23;border:1px solid #596451;margin:3px 0 6px;overflow:hidden}.bajrpg-fill{height:100%;transition:width .25s}.bajrpg-hp{background:#b83d35}.bajrpg-xp{background:#c6ae45}.bajrpg canvas{width:100%;aspect-ratio:16/9;display:block;background:rgba(36,42,36,.66);backdrop-filter:blur(7px);border:2px ridge #69745f;image-rendering:pixelated}.bajrpg-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:7px}.bajrpg-log{height:68px;overflow:auto;background:rgba(16,21,16,.78);border:1px inset #56614e;padding:5px;margin-top:7px;color:#b9c7a7}.bajrpg-loot{color:#e3c85d}.bajrpg-damage{color:#ef776c}.bajrpg-good{color:#75d784}@keyframes bajrpg-in{from{opacity:0;transform:translate3d(12px,8px,0) scale(.97)}to{opacity:1;transform:none}}@media(max-width:800px){.bajrpg{width:290px;min-width:235px;max-width:90vw;right:7px}}
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'bajrpg';
  root.innerHTML = `<div class="bajrpg-window">
    <div class="bajrpg-head"><span class="bajrpg-title">☢ BAJSAS WASTELAND</span><span data-rpg-level></span><div><button class="bajrpg-resize" data-rpg-resize title="Drag to resize">⤡</button><button data-rpg-map>🗺 Map</button> <button data-rpg-sound>🔊</button> <button data-rpg-close>✕</button></div></div>
    <canvas width="320" height="180" data-rpg-canvas></canvas>
    <div class="bajrpg-grid" style="margin-top:7px">
      <div class="bajrpg-card"><b>SURVIVOR</b><div class="bajrpg-stat"><span>HP</span><span data-rpg-hp-text></span></div><div class="bajrpg-bar"><div class="bajrpg-fill bajrpg-hp" data-rpg-hp></div></div><div class="bajrpg-stat"><span>XP</span><span data-rpg-xp-text></span></div><div class="bajrpg-bar"><div class="bajrpg-fill bajrpg-xp" data-rpg-xp></div></div><div data-rpg-stats></div></div>
      <div class="bajrpg-card"><b>GEAR</b><div data-rpg-gear></div><hr style="border-color:#46513f"><div>Bandages: <b data-rpg-bandages></b></div><button data-rpg-new style="margin-top:7px">Patrol</button></div>
    </div>
    <div class="bajrpg-actions"><button data-action="attack">Attack</button><button data-action="defend">Defend</button><button data-action="skill">Power Strike</button><button data-action="item">Bandage</button></div>
    <div class="bajrpg-log" data-rpg-log>Welcome to the wasteland.</div>
  </div>`;

  const findPlayerHost = () => document.querySelector('video')?.closest('[data-a-target="video-player"],[data-test-selector="video-player__video-container"],.video-player,.persistent-player') || document.querySelector('video')?.parentElement;
  let playerHost = findPlayerHost();
  if (!playerHost) return;
  if (getComputedStyle(playerHost).position === 'static') playerHost.style.position = 'relative';
  playerHost.appendChild(root);
  setInterval(() => {
    if (root.isConnected && playerHost.isConnected) return;
    const next = findPlayerHost(); if (!next) return;
    playerHost = next; if (getComputedStyle(playerHost).position === 'static') playerHost.style.position = 'relative';
    playerHost.appendChild(root);
  }, 300);

  const $ = selector => root.querySelector(selector);
  try { const width = Number(localStorage.getItem('bajsas_rpg_width')); if (width) root.style.width = clamp(width, 250, 560) + 'px'; } catch {}
  const resizeHandle = $('[data-rpg-resize]');
  resizeHandle.addEventListener('pointerdown', event => {
    event.preventDefault(); resizeHandle.setPointerCapture(event.pointerId);
    const startX = event.clientX, startWidth = root.getBoundingClientRect().width;
    const move = e => { const max = Math.min(560, innerWidth * .76); root.style.width = Math.round(clamp(startWidth + startX - e.clientX, 250, max)) + 'px'; };
    const end = e => { resizeHandle.releasePointerCapture?.(e.pointerId); resizeHandle.removeEventListener('pointermove', move); resizeHandle.removeEventListener('pointerup', end); resizeHandle.removeEventListener('pointercancel', end); localStorage.setItem('bajsas_rpg_width', String(Math.round(root.getBoundingClientRect().width))); };
    resizeHandle.addEventListener('pointermove', move); resizeHandle.addEventListener('pointerup', end); resizeHandle.addEventListener('pointercancel', end);
  });
  const canvas = $('[data-rpg-canvas]'), ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const log = (message, className = '') => {
    const line = document.createElement('div'); line.className = className; line.textContent = '› ' + message;
    $('[data-rpg-log]').appendChild(line); $('[data-rpg-log]').scrollTop = 99999;
  };

  function newEnemy(kind = 'battle', mission = null) {
    const difficulty = kind === 'boss' ? 2.15 : kind === 'elite' ? 1.55 : 1;
    const scale = (1 + (profile.level - 1) * .18) * difficulty;
    const pools = {
      battle:['Ash Mutant','Scrap Raider','Rad Hound','Tunnel Crawler'],
      elite:['Wasteland War Chief','Armored Brute'],
      boss:['The Overseer']
    };
    const names = pools[kind] || pools.battle;
    battle = { name: names[random(0, names.length - 1)], kind, maxHp: Math.round(55 * scale), hp: Math.round(55 * scale), attack: Math.round(9 * scale), defense: Math.round(3 * scale), defending: false, turn: 'player' };
    pendingMission = mission;
    view = 'battle'; profile.hp = profile.maxHp; busy = false; log(`${battle.name} approaches!`, 'bajrpg-damage'); render();
  }

  function drawSprite(x, y, colors, enemy = false) {
    ctx.save(); if (enemy) ctx.scale(-1, 1), x = -x - 32;
    ctx.fillStyle = colors[0]; ctx.fillRect(x + 10, y, 12, 10); ctx.fillRect(x + 7, y + 10, 18, 22);
    ctx.fillStyle = colors[1]; ctx.fillRect(x + 5, y + 14, 4, 18); ctx.fillRect(x + 23, y + 14, 4, 18); ctx.fillRect(x + 8, y + 32, 6, 15); ctx.fillRect(x + 18, y + 32, 6, 15);
    ctx.fillStyle = colors[2]; ctx.fillRect(x + 13, y + 3, 3, 3); ctx.fillRect(x + 19, y + 3, 3, 3); ctx.restore();
  }

  const nodeState = node => profile.campaign.completed.includes(node.id) ? 'done' : profile.campaign.unlocked.includes(node.id) ? 'open' : 'locked';
  function completeMission(node) {
    if (!node || profile.campaign.completed.includes(node.id)) return;
    profile.campaign.completed.push(node.id);
    profile.campaign.unlocked = profile.campaign.unlocked.filter(id => id !== node.id);
    for (const next of node.next) if (!profile.campaign.completed.includes(next) && !profile.campaign.unlocked.includes(next)) profile.campaign.unlocked.push(next);
    pendingMission = null; save();
  }
  function chooseMission(node) {
    if (nodeState(node) !== 'open') return tone(120, .08);
    tone(650); log(`Mission selected: ${node.label}.`, 'bajrpg-loot');
    if (['battle','elite','boss'].includes(node.type)) return newEnemy(node.type, node);
    if (node.type === 'loot') { profile.bandages += 2; profile.xp += 12; log('Supply cache: 2 Bandages and 12 XP.', 'bajrpg-loot'); }
    if (node.type === 'rest') { profile.hp = profile.maxHp; log('You rest and recover to full health.', 'bajrpg-good'); }
    if (node.type === 'event') {
      if (Math.random() < .5) { profile.attack++; log('You salvage a weapon part. +1 ATK.', 'bajrpg-loot'); }
      else { profile.bandages++; log('You find an abandoned medical kit.', 'bajrpg-loot'); }
    }
    completeMission(node); view = 'map'; render();
  }
  function drawMap() {
    ctx.clearRect(0,0,320,180);ctx.fillStyle='#20271f';ctx.fillRect(0,0,320,180);
    ctx.fillStyle='#384135';for(let x=0;x<320;x+=20)ctx.fillRect(x,145+(x%40?4:0),14,35);
    ctx.lineWidth=3;ctx.strokeStyle='#69745f';
    for(const node of ROUTE)for(const nextId of node.next){const next=routeById(nextId);ctx.beginPath();ctx.moveTo(node.x,node.y);ctx.lineTo(next.x,next.y);ctx.stroke()}
    const icons={start:'⌂',battle:'⚔',event:'?',loot:'▣',rest:'✚',elite:'☠',boss:'◆'};
    for(const node of ROUTE){const state=nodeState(node);ctx.beginPath();ctx.arc(node.x,node.y,13,0,Math.PI*2);ctx.fillStyle=state==='done'?'#667b55':state==='open'?'#c0a747':'#363b34';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=state==='open'?'#f5df75':'#596451';ctx.stroke();ctx.fillStyle=state==='locked'?'#72776e':'#fff2bb';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(icons[node.type],node.x,node.y);ctx.font='8px monospace';ctx.fillText(node.label,node.x,Math.min(174,node.y+22))}
    ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle='#d7c36b';ctx.font='bold 10px monospace';ctx.fillText(`ZONE ${profile.campaign.zone} — WASTELAND ROUTE`,8,13);
  }
  function draw() {
    if (view === 'map') return drawMap();
    ctx.clearRect(0, 0, 320, 180); ctx.fillStyle = '#353b30'; ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = '#59614e'; for (let x = 0; x < 320; x += 32) ctx.fillRect(x, 130 + ((x / 32) % 2) * 5, 25, 50);
    ctx.fillStyle = '#20271f'; ctx.fillRect(0, 153, 320, 27); ctx.fillStyle = '#788065'; for (let x=0;x<320;x+=18) ctx.fillRect(x,155,11,2);
    drawSprite(55, 88, ['#d8b17a','#59694a','#191919']);
    if (battle) drawSprite(233, 88, ['#87935c','#653b31','#e5cf55'], true);
    ctx.font = '10px monospace'; ctx.fillStyle = '#dce7c4'; ctx.fillText('SURVIVOR', 39, 78); if (battle) ctx.fillText(battle.name.toUpperCase(), 207, 78);
    if (battle) { ctx.fillStyle='#251d1b';ctx.fillRect(205,82,80,6);ctx.fillStyle='#bc4339';ctx.fillRect(205,82,80*(battle.hp/battle.maxHp),6); }
  }

  function render() {
    $('[data-rpg-level]').textContent = `LV ${profile.level}`;
    $('[data-rpg-hp-text]').textContent = `${profile.hp}/${profile.maxHp}`; $('[data-rpg-hp]').style.width = `${100 * profile.hp / profile.maxHp}%`;
    $('[data-rpg-xp-text]').textContent = `${profile.xp}/${profile.xpNext}`; $('[data-rpg-xp]').style.width = `${100 * profile.xp / profile.xpNext}%`;
    $('[data-rpg-stats]').innerHTML = `ATK ${profile.attack}<br>DEF ${profile.defense}<br>SPD ${profile.speed}`;
    $('[data-rpg-gear]').innerHTML = `Weapon: ${profile.weapon}<br>Armor: ${profile.armor}`; $('[data-rpg-bandages]').textContent = profile.bandages;
    $('[data-rpg-sound]').textContent = sound ? '🔊' : '🔇';
    root.querySelectorAll('[data-action]').forEach(button => button.disabled = busy || !battle || battle.hp <= 0 || profile.hp <= 0);
    draw(); save();
  }

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function enemyTurn() {
    if (!battle || battle.hp <= 0) return;
    await wait(430); const defended = battle.defending; battle.defending = false;
    const damage = Math.max(1, random(battle.attack - 2, battle.attack + 2) - profile.defense - (defended ? 6 : 0));
    profile.hp = clamp(profile.hp - damage, 0, profile.maxHp); tone(150, .12, 'sawtooth'); log(`${battle.name} hits you for ${damage}.`, 'bajrpg-damage');
    if (profile.hp <= 0) { profile.losses++; log('You were defeated. Find another enemy to retry.', 'bajrpg-damage'); battle = null; }
    busy = false; render();
  }

  async function act(type) {
    if (busy || !battle) return; busy = true; tone(480); let damage = 0;
    if (type === 'attack') { damage = Math.max(1, random(profile.attack - 2, profile.attack + 2) - battle.defense); log(`You strike for ${damage}.`); }
    if (type === 'skill') { damage = Math.max(2, Math.round(profile.attack * 1.65) - battle.defense); log(`Power Strike deals ${damage}!`, 'bajrpg-good'); tone(260, .12, 'sawtooth'); }
    if (type === 'defend') { battle.defending = true; log('You brace for the next attack.', 'bajrpg-good'); }
    if (type === 'item') {
      if (!profile.bandages) { log('No bandages left.'); busy = false; return render(); }
      profile.bandages--; const healing = Math.min(32, profile.maxHp - profile.hp); profile.hp += healing; log(`Bandage restores ${healing} HP.`, 'bajrpg-good');
    }
    if (damage) battle.hp = clamp(battle.hp - damage, 0, battle.maxHp);
    render();
    if (battle.hp <= 0) {
      const xp = 20 + profile.level * 8; profile.xp += xp; profile.wins++; log(`${battle.name} defeated. +${xp} XP`, 'bajrpg-loot');
      if (Math.random() < .35) { profile.bandages++; log('Loot: Bandage', 'bajrpg-loot'); }
      while (profile.xp >= profile.xpNext) { profile.xp -= profile.xpNext; profile.level++; profile.xpNext = Math.round(profile.xpNext * 1.45); profile.maxHp += 12; profile.attack += 3; profile.defense += 2; log(`LEVEL UP! You are level ${profile.level}.`, 'bajrpg-loot'); tone(880, .22); }
      const completed = pendingMission; if (completed) completeMission(completed);
      if (completed?.type === 'boss') { profile.campaign = { zone: profile.campaign.zone + 1, completed:['start'], unlocked:['battle1','event1'] }; log(`ZONE CLEARED! Entering zone ${profile.campaign.zone}.`, 'bajrpg-loot'); }
      battle = null; pendingMission = null; busy = false; view = 'map'; return render();
    }
    enemyTurn();
  }

  canvas.addEventListener('click', event => {
    if (view !== 'map') return;
    const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*320/rect.width,y=(event.clientY-rect.top)*180/rect.height;
    const node=ROUTE.find(n=>Math.hypot(n.x-x,n.y-y)<17);if(node)chooseMission(node);
  });
  root.querySelectorAll('[data-action]').forEach(button => button.onclick = () => act(button.dataset.action));
  $('[data-rpg-new]').onclick = () => newEnemy('battle', null);
  $('[data-rpg-map]').onclick = () => { view='map'; battle=null; pendingMission=null; render(); };
  $('[data-rpg-close]').onclick = () => root.classList.remove('show');
  $('[data-rpg-sound]').onclick = () => { sound = !sound; localStorage.setItem('bajsas_rpg_sound', sound ? '1' : '0'); render(); tone(640); };

  function installButton() {
    const ui = document.getElementById('custom-stream-ui'); if (!ui) return false;
    const existingLoader = ui.querySelector('[data-rpg-loader]');
    if (existingLoader) { existingLoader.textContent='☢ RPG'; existingLoader.onclick=()=>open(); return true; }
    const row = ui.querySelector('.custom-stream-btn')?.parentElement; if (!row || row.querySelector('[data-rpg-open]')) return true;
    const button = document.createElement('button'); button.className = 'custom-stream-btn'; button.dataset.rpgOpen = '1'; button.textContent = '☢ RPG'; button.onclick = () => open(); row.appendChild(button); return true;
  }
  function open() { root.classList.add('show'); render(); }
  const timer = setInterval(() => { if (installButton()) clearInterval(timer); }, 250);
  installButton();

  window.BajSASRPG = { loaded: true, version: VERSION, open, close: () => root.classList.remove('show'), reset: () => { profile = freshProfile(); battle = null; save(); render(); } };
  render();
})();
