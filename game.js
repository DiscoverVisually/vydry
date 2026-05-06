const OTTERS = [
  { id: 'maxo', meno: 'Maxo', pohlavie: 'Chlapec', stats: [6,6,6,6,6,6,6,6] },
  { id: 'riki', meno: 'Riki', pohlavie: 'Chlapec', stats: [9,8,4,4,7,4,9,5] },
  { id: 'bruno', meno: 'Bruno', pohlavie: 'Chlapec', stats: [4,4,7,8,4,7,3,9] },
  { id: 'nino', meno: 'Nino', pohlavie: 'Chlapec', stats: [6,5,5,9,8,5,6,4] },
  { id: 'luna', meno: 'Luna', pohlavie: 'Dievča', stats: [7,7,8,4,5,7,8,4] },
  { id: 'mia', meno: 'Mia', pohlavie: 'Dievča', stats: [5,9,9,3,4,6,6,4] },
  { id: 'tara', meno: 'Tara', pohlavie: 'Dievča', stats: [5,5,7,4,5,10,6,5] },
  { id: 'zora', meno: 'Zora', pohlavie: 'Dievča', stats: [7,6,5,6,9,5,8,4] },
];
const STAT_NAMES = ['Plávanie','Ponor','Kyslík','Sila','Rýchlosť hodu','Batoh','Obratnosť','Odolnosť'];

const screens = ['start-screen','select-screen','game-screen','result-screen'].reduce((acc,id)=>{
  acc[id]=document.getElementById(id); return acc;
},{});
const otterGrid = document.getElementById('otter-grid');
const btnConfirm = document.getElementById('btn-confirm');
let selectedOtter = null;

const META_KEY = 'svet_vydier_meta_v1';
let meta = { pearls: 0, oxygenLevel: 0 };

function loadMeta(){
  try {
    const raw = localStorage.getItem(META_KEY);
    if(raw) meta = { ...meta, ...JSON.parse(raw) };
  } catch {}
}
function saveMeta(){
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}
function oxygenUpgradeCost(){ return 20 + meta.oxygenLevel * 15; }
function renderMeta(){
  document.getElementById('meta-pearls').textContent = meta.pearls;
  document.getElementById('meta-oxygen-level').textContent = meta.oxygenLevel * 5;
  document.getElementById('meta-oxygen-cost').textContent = oxygenUpgradeCost();
}

function showScreen(id){ Object.values(screens).forEach(s=>s.classList.remove('active')); screens[id].classList.add('active'); syncMenuMusic(id); }

function renderOtters(){
  otterGrid.innerHTML = '';
  OTTERS.forEach(otter=>{
    const c = document.createElement('button');
    c.className = 'otter-card';
    c.innerHTML = `<h3>${otter.meno} (${otter.pohlavie})</h3><ul class="stats">${STAT_NAMES.map((n,i)=>`<li>${n}: ${otter.stats[i]}</li>`).join('')}</ul>`;
    c.onclick = () => {
      selectedOtter = otter;
      [...otterGrid.children].forEach(x=>x.classList.remove('selected'));
      c.classList.add('selected');
      btnConfirm.disabled = false;
    };
    otterGrid.appendChild(c);
  });
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const keys = new Set();
let game = null;
const menuMusic = document.getElementById('menu-music');

function syncMenuMusic(screenId){
  const shouldPlay = screenId === 'start-screen' || screenId === 'select-screen';
  if(!menuMusic) return;
  if(shouldPlay){
    menuMusic.volume = 0.35;
    menuMusic.play().catch(()=>{});
  } else {
    menuMusic.pause();
    menuMusic.currentTime = 0;
  }
}

document.addEventListener('keydown',e=>keys.add(e.key.toLowerCase()));
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));

function startGame(otter){
  const [swim,dive,oxygen,attack,throwRate,capacity,agility,resist] = otter.stats;
  game = {
    otter,
    pearls: 0,
    stones: { bojovy: 2, bonusovy: 1 },
    hp: 3,
    oxygen: Math.min(150, 100 + meta.oxygenLevel * 5),
    score: 0,
    timeAlive: 0,
    maxDepth: 0,
    shotsFired: 0,
    hits: 0,
    buffSpeedUntil: 0,
    player:{x:220,y:250,vx:0,vy:0},
    projectiles:[],
    creatures:[],
    collectibles:[],
    lanes:[120,210,300,390,480,570],
    cooldown:0,
    alive:true,
    cfg:{swim,dive,oxygen,attack,throwRate,capacity,agility,resist}
  };
  for(let i=0;i<10;i++) spawnCollectible();
  for(let i=0;i<7;i++) spawnCreature(Math.random()<0.45);
  document.getElementById('hud-otter').textContent = otter.meno;
  showScreen('game-screen');
  requestAnimationFrame(loop);
}

function spawnCollectible(){
  const roll = Math.random();
  const type = roll < 0.65 ? 'perla' : roll < 0.9 ? 'kamienok_bojovy' : 'kamienok_bonusovy';
  game.collectibles.push({x:Math.random()*1080+60,y:Math.random()*560+60,type});
}
function spawnCreature(isEnemy){
  const laneIdx = Math.floor(Math.random()*game.lanes.length);
  const dir = Math.random()<0.5 ? 1 : -1;
  game.creatures.push({
    x: dir>0?-40:1240, y: game.lanes[laneIdx], lane: laneIdx, dir,
    speed: 70+Math.random()*70, enemy:isEnemy,
    telegraph:0, targetLane: laneIdx, switchArrowPulse: 0
  });
}

function loop(){
  if(!game || !game.alive) return;
  update(1/60);
  draw();
  requestAnimationFrame(loop);
}

function update(dt){
  const p = game.player, c = game.cfg;
  game.timeAlive += dt;
  game.maxDepth = Math.max(game.maxDepth, p.y);

  const left = keys.has('a') || keys.has('arrowleft');
  const right = keys.has('d') || keys.has('arrowright');
  const up = keys.has('w') || keys.has('arrowup');
  const down = keys.has('s') || keys.has('arrowdown');

  const speedBuff = game.timeAlive < game.buffSpeedUntil ? 1.35 : 1;
  p.vx = (right-left) * (120 + c.swim*18) * speedBuff;
  p.vy = (down-up) * (100 + c.dive*17) * speedBuff;
  p.x = Math.max(20,Math.min(1180,p.x + p.vx*dt));
  p.y = Math.max(40,Math.min(640,p.y + p.vy*dt));

  game.oxygen -= (0.6 + (10-c.oxygen)*0.12) * dt;
  if(game.oxygen<=0) return endRun('Došiel kyslík. Vydra sa vynorila na hladinu.');

  if(keys.has(' ') && game.cooldown<=0 && (game.stones.bojovy + game.stones.bonusovy > 0)){
    game.cooldown = Math.max(0.2, 0.8 - c.throwRate*0.06);
    const useCombat = game.stones.bojovy > 0;
    if(useCombat) game.stones.bojovy -= 1;
    else game.stones.bonusovy -= 1;
    game.projectiles.push({
      x:p.x+16, y:p.y, vx:320+40*c.attack, life:2,
      type: useCombat ? 'bojovy' : 'bonusovy'
    });
    game.shotsFired += 1;
  }
  game.cooldown -= dt;

  for(const pr of game.projectiles){ pr.x += pr.vx*dt; pr.life -= dt; }
  game.projectiles = game.projectiles.filter(pr=>pr.life>0 && pr.x<1220);

  for(const cr of game.creatures){
    if(cr.telegraph>0){
      cr.telegraph -= dt;
      cr.switchArrowPulse += dt * 12;
      cr.speed *= 0.994;
      if(cr.telegraph<=0) {
        cr.lane = cr.targetLane;
        cr.speed = Math.max(70, cr.speed + 20);
      }
    }
    cr.y += (game.lanes[cr.lane]-cr.y) * Math.min(1, dt*8);
    cr.x += cr.dir * cr.speed * dt;
    if(cr.x<-70 || cr.x>1270){
      cr.dir *= -1; cr.x = cr.x<-70? -40 : 1240;
    }
    if(Math.random()<0.003 && cr.telegraph<=0){
      const t = Math.max(0,Math.min(game.lanes.length-1, cr.lane + (Math.random()<0.5?-1:1)));
      if(t!==cr.lane){ cr.telegraph = 1.1; cr.targetLane = t; cr.switchArrowPulse = 0; }
    }
  }

  game.collectibles = game.collectibles.filter(it=>{
    const d = Math.hypot(it.x-p.x, it.y-p.y);
    if(d<28){
      if(it.type==='perla') game.pearls += 1;
      else if(it.type==='kamienok_bojovy') game.stones.bojovy += 1;
      else game.stones.bonusovy += 1;
      spawnCollectible();
      return false;
    }
    return true;
  });

  for(const cr of game.creatures){
    const d = Math.hypot(cr.x-p.x, cr.y-p.y);
    if(d<34){
      if(cr.enemy){
        game.hp -= 1;
        p.x -= 30*cr.dir;
        if(game.hp<=0) return endRun('Došlo HP. Vydra sa zľakla a utiekla nad hladinu.');
      } else {
        game.pearls += 2;
      }
    }
    for(const pr of game.projectiles){
      if(Math.hypot(cr.x-pr.x, cr.y-pr.y)<26 && cr.enemy){
        cr.x = cr.dir>0? -60:1260;
        pr.life = 0;
        game.hits += 1;
        if(pr.type === 'bojovy') game.pearls += 3;
        else {
          game.buffSpeedUntil = game.timeAlive + 5;
          game.oxygen = Math.min(100, game.oxygen + 12);
        }
      }
    }
  }

  game.score = Math.floor(game.pearls * 10 + game.timeAlive * 2 + game.hits * 6 + game.maxDepth * 0.04);
  document.getElementById('hud-pearls').textContent = game.pearls;
  document.getElementById('hud-stones').textContent = `${game.stones.bojovy}B/${game.stones.bonusovy}X`;
  document.getElementById('hud-oxygen').textContent = Math.max(0,Math.floor(game.oxygen));
  document.getElementById('hud-hp').textContent = game.hp;
}

function draw(){
  const g = ctx.createLinearGradient(0,0,0,680);
  g.addColorStop(0,'#b7e8ff'); g.addColorStop(1,'#4da5d2');
  ctx.fillStyle = g; ctx.fillRect(0,0,1200,680);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for(const y of game.lanes){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(1200,y); ctx.stroke(); }

  for(const it of game.collectibles){
    ctx.fillStyle = it.type==='perla' ? '#ffefcf' : it.type==='kamienok_bojovy' ? '#9fd0ff' : '#c8ffb1';
    ctx.beginPath(); ctx.arc(it.x,it.y,9,0,Math.PI*2); ctx.fill();
  }

  for(const cr of game.creatures){
    if(cr.telegraph>0){
      const alpha = 0.4 + (Math.sin(cr.switchArrowPulse) + 1) * 0.3;
      ctx.fillStyle = `rgba(255,220,80,${alpha})`;
      ctx.beginPath();
      const dy = game.lanes[cr.targetLane]-cr.y;
      ctx.moveTo(cr.x,cr.y);
      ctx.lineTo(cr.x-12,cr.y+Math.sign(dy)*18);
      ctx.lineTo(cr.x+12,cr.y+Math.sign(dy)*18);
      ctx.closePath(); ctx.fill();

      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(cr.x, cr.y, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = cr.enemy? '#466f8b':'#ffd55f';
    ctx.beginPath(); ctx.ellipse(cr.x,cr.y,24,14,0,0,Math.PI*2); ctx.fill();
  }

  for(const pr of game.projectiles){
    ctx.fillStyle = pr.type === 'bojovy' ? '#d7ebff' : '#d8ffd6';
    ctx.beginPath(); ctx.arc(pr.x,pr.y,5,0,Math.PI*2); ctx.fill();
  }

  const p = game.player;
  ctx.fillStyle = '#7a5b45'; ctx.beginPath(); ctx.ellipse(p.x,p.y,22,14,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#f4dfbf'; ctx.beginPath(); ctx.arc(p.x+10,p.y-4,7,0,Math.PI*2); ctx.fill();
}

function endRun(msg){
  game.alive = false;
  const presnost = game.shotsFired > 0 ? Math.round((game.hits / game.shotsFired) * 100) : 0;
  document.getElementById('result-title').textContent = 'Kolo skončilo';
  document.getElementById('result-text').innerHTML = `${msg}<br>Perly: <strong>${game.pearls}</strong> · Skóre: <strong>${game.score}</strong><br>Čas: ${game.timeAlive.toFixed(1)} s · Max hĺbka: ${Math.floor(game.maxDepth)} · Presnosť: ${presnost}%`;
  meta.pearls += game.pearls;
  saveMeta();
  renderMeta();
  showScreen('result-screen');
}

document.getElementById('btn-start').onclick = ()=>showScreen('select-screen');
document.getElementById('btn-upgrade-oxygen').onclick = ()=>{
  const cost = oxygenUpgradeCost();
  if(meta.pearls >= cost){
    meta.pearls -= cost;
    meta.oxygenLevel += 1;
    saveMeta();
    renderMeta();
  }
};
document.getElementById('btn-back').onclick = ()=>showScreen('start-screen');
btnConfirm.onclick = ()=> startGame(selectedOtter);
document.getElementById('btn-restart').onclick = ()=>{ selectedOtter = null; btnConfirm.disabled = true; loadMeta();
renderMeta();
renderOtters(); showScreen('start-screen'); };

loadMeta();
renderMeta();
renderOtters();
