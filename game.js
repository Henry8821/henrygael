/* =============================================================================
   NOVA STRIKE — game.js
   Pure HTML5 Canvas game engine. No external game framework used.
   Handles: canvas setup, game loop, physics, spawning, collision,
   weapons, power-ups, bosses, HUD, audio, and the public startGame() API.
============================================================================= */
"use strict";

// ─── CANVAS SETUP ────────────────────────────────────────────────────────────

// The main game canvas and its 2D drawing context.
// Both start as null and are assigned by initCanvas() once the DOM is ready.
let canvas = null;
let ctx = null;
let _resizeTimer = null; // debounce timer for window resize events

// Find the <canvas id="gameCanvas"> element and get its 2D context.
// Returns true if successful, false if the element isn't in the DOM yet.
function initCanvas() {
  if (!canvas) {
    canvas = document.getElementById("gameCanvas");
    if (canvas) {
      ctx = canvas.getContext("2d");
    }
  }
  return canvas && ctx;
}

// Resize the canvas to fill the entire browser window.
// Called on startup and whenever the window is resized.
function resizeCanvas() { 
  if (initCanvas()) {
    canvas.width = window.innerWidth; 
    canvas.height = window.innerHeight; 
  }
}

// Quick safety check used before any drawing operation.
// Returns false if the canvas isn't ready or has zero size.
function canvasReady() {
  return canvas && ctx && canvas.width > 0 && canvas.height > 0;
}

// Debounce resize events so we don't thrash the canvas on every pixel change.
window.addEventListener("resize", ()=>{ 
  clearTimeout(_resizeTimer); 
  _resizeTimer = setTimeout(resizeCanvas, 100); 
});

// Initialize the canvas as soon as the HTML is parsed.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCanvas);
} else {
  initCanvas();
}

// ─── GAME CONSTANTS ───────────────────────────────────────────────────────────

// Radius of the player's hit-box in pixels. Larger = easier to get hit.
const PLAYER_HIT_R = 32;

// The five predefined levels. Each entry controls:
//   spawnRate  — how many frames between asteroid spawns (lower = more asteroids)
//   speed      — base movement speed of asteroids
//   boss       — whether a boss spawns when the score threshold is reached
const LEVELS = [
  {id:1,name:"PATROL",  colorHex:"#00ffff",spawnRate:78,speed:1.9,bgTop:"#050520",bgBot:"#0a1560",boss:false},
  {id:2,name:"STORM",   colorHex:"#ffee00",spawnRate:58,speed:2.9,bgTop:"#0a0a05",bgBot:"#1a1800",boss:false},
  {id:3,name:"ASSAULT", colorHex:"#ff7700",spawnRate:42,speed:3.9,bgTop:"#100008",bgBot:"#200010",boss:true},
  {id:4,name:"CRISIS",  colorHex:"#ff2d78",spawnRate:30,speed:5.2,bgTop:"#150005",bgBot:"#250008",boss:false},
  {id:5,name:"OMEGA",   colorHex:"#cc00ff",spawnRate:20,speed:6.8,bgTop:"#080010",bgBot:"#120025",boss:true},
];

// ─── DAY / NIGHT BACKGROUND ───────────────────────────────────────────────────

// Read the player's local clock and return background gradient colours that
// match the time of day (dawn, day, dusk, night). This makes every session
// look slightly different without any extra work from the player.
function getDayNightColors() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeOfDay = hours + minutes / 60; // decimal hours, e.g. 14.5 = 2:30 PM
  // Define time periods and their colors - DARKER for better bullet visibility
  let bgTop, bgBot, period;
  
  if (timeOfDay >= 6 && timeOfDay < 9) {
    // Dawn (6 AM - 9 AM) - Darker orange/pink sunrise
    const progress = (timeOfDay - 6) / 3;
    bgTop = interpolateColor("#1a0a2e", "#3d1a0d", progress); // Much darker
    bgBot = interpolateColor("#2d1b69", "#5d2a1e", progress); // Much darker
    period = "dawn";
  } else if (timeOfDay >= 9 && timeOfDay < 17) {
    // Day (9 AM - 5 PM) - MUCH DARKER blue sky for bullet visibility
    const progress = (timeOfDay - 9) / 8;
    bgTop = interpolateColor("#1a2a4a", "#2a3a5a", progress); // Dark blue instead of bright
    bgBot = interpolateColor("#2a3a6a", "#3a4a7a", progress); // Dark blue instead of bright
    period = "day";
  } else if (timeOfDay >= 17 && timeOfDay < 20) {
    // Dusk (5 PM - 8 PM) - Darker purple/orange sunset
    const progress = (timeOfDay - 17) / 3;
    bgTop = interpolateColor("#3d1a0d", "#2d1b69", progress); // Darker
    bgBot = interpolateColor("#5d2a1e", "#1a0a2e", progress); // Darker
    period = "dusk";
  } else {
    // Night (8 PM - 6 AM) - Deep space colors (unchanged)
    bgTop = "#050520";
    bgBot = "#0a1560";
    period = "night";
  }
  
  return { bgTop, bgBot, period, timeOfDay };
}

// Helper function to interpolate between two hex colors
function interpolateColor(color1, color2, factor) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  
  const r = Math.round(c1.r + (c2.r - c1.r) * factor);
  const g = Math.round(c1.g + (c2.g - c1.g) * factor);
  const b = Math.round(c1.b + (c2.b - c1.b) * factor);
  
  return rgbToHex(r, g, b);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : {r: 5, g: 5, b: 32};
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
// Score thresholds that trigger a level-up (one entry per level transition).
const LEVEL_THRESHOLDS = [0,350,800,1500,2500];

// All collectible power-up types. The `w` field is a spawn weight —
// higher weight = more likely to appear. Shield and rapid-fire are common;
// nova bomb and missiles are rare.
const PU_DEFS = [
  {type:"shield", colorHex:"#00f5ff",icon:"S",label:"+SHIELD",   w:24},
  {type:"rapid",  colorHex:"#ff6400",icon:"R",label:"RAPID FIRE",w:18},
  {type:"slow",   colorHex:"#b400ff",icon:"T",label:"SLOW TIME", w:15},
  {type:"score2x",colorHex:"#ffd60a",icon:"2",label:"SCORE x2",  w:20},
  {type:"life",   colorHex:"#ff006e",icon:"L",label:"+LIFE",     w:8},
  {type:"nova",   colorHex:"#00ff88",icon:"N",label:"NOVA BOMB", w:5},
  {type:"magnet", colorHex:"#ffaa00",icon:"M",label:"MAGNET",    w:10},
  // New weapon power-ups
  {type:"plasma", colorHex:"#ff00ff",icon:"P",label:"PLASMA GUN", w:6},
  {type:"laser",  colorHex:"#ff0000",icon:"L",label:"LASER BEAM", w:4},
  {type:"missile",colorHex:"#ffaa00",icon:"M",label:"MISSILES",   w:3},
  {type:"spread", colorHex:"#00ff00",icon:"S",label:"SPREAD SHOT",w:5},
  {type:"coins",  colorHex:"#ffd700",icon:"C",label:"+COINS",     w:12},
  {type:"xp",     colorHex:"#00ffff",icon:"X",label:"+XP",        w:10},
];

// All weapon types available in the game.
// `damage` = hits to destroy a normal asteroid, `shots` = bullets per fire,
// `cooldown` = frames between shots, `cost` = coins to unlock in the shop.
const WEAPON_DEFS = {
  basic: {
    name: "Basic Laser",
    damage: 1,
    shots: 1,
    cooldown: 4,
    color: "#00aaff",
    description: "Standard ship weapon",
    cost: 0,
    unlockLevel: 1
  },
  plasma: {
    name: "Plasma Cannon",
    damage: 2,
    shots: 2,
    cooldown: 5,
    color: "#ff00ff",
    description: "Dual plasma bolts with high damage",
    cost: 150,
    unlockLevel: 2
  },
  laser: {
    name: "Focused Laser",
    damage: 3,
    shots: 1,
    cooldown: 6,
    color: "#ff0000",
    description: "High-damage concentrated beam",
    cost: 300,
    unlockLevel: 3
  },
  missile: {
    name: "Homing Missiles",
    damage: 5,
    shots: 1,
    cooldown: 15,
    color: "#ffaa00",
    description: "Slow but devastating guided missiles",
    cost: 500,
    unlockLevel: 4
  },
  spread: {
    name: "Spread Shot",
    damage: 1,
    shots: 5,
    cooldown: 8,
    color: "#00ff00",
    description: "Wide area coverage",
    cost: 250,
    unlockLevel: 3
  }
};
function pickPU() {
  const tot = PU_DEFS.reduce((s,p)=>s+p.w,0); let r = Math.random()*tot;
  for (const p of PU_DEFS) { r -= p.w; if (r<=0) return p; } return PU_DEFS[0];
}
// Boss definitions for levels 3 and 5.
// `hp` = total hit points, `r` = radius, `spd` = movement speed,
// `sR` = frames between boss shots (lower = faster shooting).
const BOSS_DEFS = {
  3:{name:"TITAN CRUSHER",hp:120,colorHex:"#ff4400",r:55,spd:1.4,sR:90}, // Increased from 40 to 120
  5:{name:"VOID EMPEROR", hp:200,colorHex:"#cc00ff",r:70,spd:1.8,sR:60}, // Increased from 80 to 200
};
const SKIN_COLORS = ["#00aaff","#ff2244","#b400ff","#ffd60a"];

// Ship definitions: each has a PNG, color, name, and stat bonuses
const SHIP_DEFS = [
  {id:0, img:"ship1.png",   name:"NOVA",      color:"#00aaff", desc:"Balanced fighter",      speedBonus:0,   shieldBonus:0,   fireBonus:0},
  {id:1, img:"ship3.png",   name:"CRIMSON",   color:"#ff2244", desc:"Fast interceptor",      speedBonus:2,   shieldBonus:-20, fireBonus:1},
  {id:2, img:"fighter.png", name:"PHANTOM",   color:"#b400ff", desc:"Heavy armor",           speedBonus:-1,  shieldBonus:30,  fireBonus:0},
  {id:3, img:"ship4.png",   name:"SPECTRE",   color:"#ffd60a", desc:"Rapid fire specialist", speedBonus:1,   shieldBonus:-10, fireBonus:2},
];

// ─── GAME STATE ───────────────────────────────────────────────────────────────
// G is the single source of truth for everything happening in the current game.
// It is reset by startGame() at the beginning of each new run.
const G = {
  running:false, paused:false,
  score:0, level:1, lives:3, shield:100,
  combo:1, maxCombo:1, asteroidsKilled:0,
  surviveSec:0, frame:0, mult:1,
  rapidFire:false, rapidTimer:0,
  slowTime:false,  slowTimer:0,
  magnet:false,    magnetTimer:0,
  bossActive:false, bossSpawned:false,
  invincible:false, invTimer:0,
  shootCD:0, puCollected:0, bossKills:0,
  comboDecay:0,          // frames since last kill  combo decays after 180 frames
  shieldRegen:0,         // regen timer
  thrustTrail:[],        // engine exhaust particles
  hitMarkers:[],         // bullet-hit sparks
  dangerPings:[],        // off-screen enemy indicators
  speedLines:[],         // warp lines when moving fast
  // Enhanced weapon system
  weaponType: "basic",   // basic, plasma, laser, missile, spread
  weaponLevel: 1,        // weapon upgrade level (1-5)
  weaponAmmo: -1,        // -1 = infinite, otherwise limited ammo
  // Enhanced reward system
  coins: 0,              // currency for shop
  experience: 0,         // XP for unlocking weapons
  weaponsUnlocked: ["basic"], // unlocked weapon types
  ship:{x:0,y:0,vx:0,vy:0,angle:-Math.PI/2},
  asteroids:[], bullets:[], bossBullets:[],
  enemyShips:[], enemyBullets:[],
  powerups:[], particles:[], stars:[],
  boss:null,
  keys:{left:false,right:false,up:false,down:false,fire:false,firePulse:false},
  shake:{active:false,timer:0,intensity:0},
  camX:0, camY:0,
  flashCol:null, flashA:0,
  frameId:null,
};
window.G = G;

//  HELPERS 
// Adaptive endless level system with dynamic day/night backgrounds
// ─── LEVEL HELPERS ────────────────────────────────────────────────────────────

// Return the config object for the current level.
// Levels 1-5 use the LEVELS table; beyond level 5 the difficulty scales
// infinitely and a new boss appears every 3 levels.
function getLvl() {
  const dayNight = getDayNightColors();
  
  if (G.level <= LEVELS.length) {
    const baseLevel = LEVELS[G.level-1];
    // Override base level colors with day/night system
    return {
      ...baseLevel,
      bgTop: dayNight.bgTop,
      bgBot: dayNight.bgBot,
      period: dayNight.period
    };
  }
  
  const ex = G.level - LEVELS.length;
  const bl = LEVELS[LEVELS.length-1];
  // Adaptive scaling: speed and spawn rate scale with level
  const adaptSpeed     = bl.speed + ex * 0.35;
  const adaptSpawnRate = Math.max(6, bl.spawnRate - ex * 2);
  
  const colors = ["#00ffff","#ff2d78","#ffee00","#00ffaa","#cc00ff","#ff8800","#ff4444","#44ffff"];
  const colorHex = colors[ex % colors.length];
  
  return {
    id: G.level,
    name: "SECTOR " + G.level,
    colorHex: colorHex,
    spawnRate: adaptSpawnRate,
    speed: adaptSpeed,
    bgTop: dayNight.bgTop,
    bgBot: dayNight.bgBot,
    period: dayNight.period,
    boss: ex % 3 === 0  // boss every 3 levels past level 5
  };
}
// Return a difficulty multiplier based on the player's chosen difficulty setting.
// Used to scale enemy speed and spawn rates.
function getDiffMod() { return {easy:.6,normal:1,hard:1.4,insane:2}[window.NS?.difficulty||"normal"]||1; }
function makePts(r,n,j=.35) {
  return Array.from({length:n},(_,i)=>{
    const a=(i/n)*Math.PI*2, rr=r*(1-j+Math.random()*j*2);
    return {x:Math.cos(a)*rr, y:Math.sin(a)*rr};
  });
}
// world  screen
function wx(x) { return x - G.camX; }
function wy(y) { return y - G.camY; }

//  AUDIO 
let audioCx = null;
function getAudio() { if (!audioCx) audioCx = new (window.AudioContext||window.webkitAudioContext)(); window._audioCx = audioCx; return audioCx; }
function vol() { return (window.NS?.volume ?? 7) / 10; }
function osc(freq, type, dur, gain, delay=0, freqEnd=null) {
  if (window.NS?.sfx === false) return;
  try {
    const c=getAudio(), o=c.createOscillator(), g=c.createGain(), t=c.currentTime+delay;
    o.connect(g); g.connect(c.destination); o.type=type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd != null) o.frequency.exponentialRampToValueAtTime(Math.max(freqEnd,1), t+dur);
    g.gain.setValueAtTime(gain*vol(), t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.start(t); o.stop(t+dur);
  } catch(e) {}
}
function noise(dur, gain, delay=0, lpFreq=800) {
  if (window.NS?.sfx === false) return;
  try {
    const c=getAudio(), buf=c.createBuffer(1,c.sampleRate*dur,c.sampleRate);
    const data=buf.getChannelData(0); for (let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
    const src=c.createBufferSource(), lp=c.createBiquadFilter(), g=c.createGain(), t=c.currentTime+delay;
    src.buffer=buf; lp.type="lowpass"; lp.frequency.value=lpFreq;
    src.connect(lp); lp.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(gain*vol(), t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    src.start(t); src.stop(t+dur);
  } catch(e) {}
}
const sfx = {
  // Crisp laser shot with harmonic tail
  shoot:      ()=>{
    osc(1600,"square",0.05,0.14,0,180);
    osc(800,"sawtooth",0.07,0.07,0.01,55);
    osc(400,"sine",0.04,0.03,0.02,100);
  },
  // Rich multi-layer explosion
  explode:    ()=>{
    noise(0.5,0.6,0,700);
    noise(0.35,0.4,0,180);
    osc(50,"sawtooth",0.55,0.45,0,18);
    osc(100,"square",0.35,0.22,0.04,28);
    osc(200,"sine",0.2,0.1,0.08,50);
  },
  // Sharp impact crunch
  hit:        ()=>{
    noise(0.22,0.5,0,500);
    osc(140,"sawtooth",0.14,0.35,0,35);
    osc(280,"square",0.1,0.18,0.02,70);
    osc(560,"sine",0.06,0.08,0.04,140);
  },
  // Satisfying ascending chime
  pickup:     ()=>{
    [523,659,784,1047,1319].forEach((f,i)=>osc(f,"sine",0.2,0.16,i*0.05));
    noise(0.1,0.06,0.18,2000);
  },
  // Triumphant level-up fanfare
  levelUp:    ()=>{
    [262,330,392,523,659,784,1047].forEach((f,i)=>osc(f,"square",0.32,0.11,i*0.08));
    [524,660,784].forEach((f,i)=>osc(f,"sine",0.4,0.07,0.5+i*0.06));
    noise(0.25,0.18,0.45,1500);
  },
  // Ominous boss entrance  deep rumble + alarm
  boss:       ()=>{
    osc(40,"sawtooth",2.2,0.5,0,22);
    osc(60,"square",2.2,0.28,0,38);
    osc(80,"sawtooth",1.5,0.18,0.25,50);
    osc(160,"square",0.8,0.12,0.5,80);
    noise(0.8,0.25,0,250);
    noise(0.4,0.15,0.6,600);
  },
  // Epic nova bomb  massive layered explosion
  nova:       ()=>{
    noise(1.0,0.8,0,1200);
    noise(0.6,0.5,0.1,400);
    osc(60,"sawtooth",1.2,0.55,0,18);
    osc(120,"square",1.0,0.35,0.08,36);
    osc(240,"sine",0.8,0.22,0.15,72);
    osc(480,"sine",0.5,0.12,0.25,120);
    [200,300,400,500].forEach((f,i)=>osc(f,"sawtooth",0.3,0.08,0.4+i*0.05,f*0.5));
  },
  // Subtle engine rumble
  thrust:     ()=>{
    if(Math.random()<0.18){
      osc(45+Math.random()*20,"sawtooth",0.14,0.05);
      if(Math.random()<0.3) noise(0.08,0.03,0,200);
    }
  },
  // Distinct enemy laser  different pitch from player
  enemyShoot: ()=>{
    osc(500,"sawtooth",0.12,0.08,0,120);
    osc(250,"square",0.1,0.05,0.02,60);
  },
  // Subtle UI hover
  hover:      ()=>osc(660,"sine",0.04,0.025),
  // Snappy UI click
  click:      ()=>{
    osc(1100,"square",0.04,0.07,0,280);
    osc(550,"sine",0.06,0.04,0.02);
  },
  // Combo milestone sound
  combo:      (n)=>{
    const f=220*Math.pow(1.2,Math.min(n,8));
    osc(f,"square",0.12,0.1,0,f*1.5);
    osc(f*1.5,"sine",0.1,0.06,0.04);
  },
  // Shield low warning
  shieldLow:  ()=>{
    osc(220,"sawtooth",0.15,0.12,0,110);
    osc(110,"square",0.1,0.08,0.08,55);
  },
  // Life lost  dramatic
  lifeLost:   ()=>{
    osc(200,"sawtooth",0.4,0.4,0,50);
    osc(150,"square",0.5,0.3,0.1,40);
    noise(0.3,0.3,0,300);
  },
};
window.sfx = sfx;
let musicInt=null, _beat=0;

// Space battle soundtrack -- cinematic, intense, layered
// Three sections that cycle: Patrol (calm), Combat (intense), Boss (epic)
const MUSIC = {
  // Pentatonic minor bass -- dark, driving
  bass:    [41,41,49,41,55,55,49,41, 37,37,44,37,55,49,44,37],
  // Heroic lead melody
  mel:     [392,440,523,587,523,440,392,349, 330,392,440,494,440,392,330,294],
  // Tension arpeggio
  arp:     [196,247,294,370,247,294,370,440, 220,277,330,415,277,330,415,494],
  // Deep atmospheric pads
  pad:     [98,123,147, 110,138,165, 82,104,123, 92,116,138],
  // Boss stinger notes
  boss:    [55,55,65,73,55,49,55,65],
};

function startMusic() {
  if (window.NS && window.NS.music === false) return;
  stopMusic(); _beat = 0;
  // 150 BPM -- energetic space battle pace
  var step = (60/150/4)*1000;
  try {
    musicInt = setInterval(function(){
      var b = _beat;
      var m = (window.NS && window.NS.volume != null ? window.NS.volume : 7) / 10;
      if (m === 0) { _beat++; return; }
      var lv = (window.G && window.G.level) || 1;
      var boss = !!(window.G && window.G.bossActive);
      // Intensity scales with level
      var intensity = Math.min(1.0, 0.4 + lv * 0.12);

      // === DRUMS ===
      // Kick: every beat (4/4)
      if (b%4===0) {
        noise(0.08, 0.38*m*intensity, 0, 120);
        osc(50, "sine", 0.18, 0.5*m*intensity, 0, 28);
      }
      // Snare: beats 2 and 4
      if (b%4===2) {
        noise(0.14, 0.32*m, 0, 5000);
        osc(180, "square", 0.07, 0.12*m, 0, 90);
      }
      // Closed hi-hat: every 8th note
      if (b%2===1) noise(0.04, 0.07*m, 0, 10000);
      // Open hi-hat: offbeat at level 2+
      if (lv>=2 && b%8===6) noise(0.1, 0.09*m, 0, 8000);
      // Extra percussion at level 3+
      if (lv>=3 && b%8===3) {
        noise(0.06, 0.12*m, 0, 3000);
        osc(120, "square", 0.05, 0.08*m, 0, 60);
      }

      // === BASS ===
      if (b%4===0) {
        var bn = MUSIC.bass[Math.floor(b/4) % MUSIC.bass.length];
        // Deep sawtooth bass
        osc(bn, "sawtooth", 0.32, 0.22*m*intensity, 0, bn*0.92);
        // Sub-bass sine
        osc(bn*0.5, "sine", 0.38, 0.18*m*intensity, 0, bn*0.48);
        // Octave harmonic
        osc(bn*2, "square", 0.16, 0.06*m, 0, bn*1.9);
      }

      // === LEAD MELODY ===
      if (b%8===0) {
        var mn = MUSIC.mel[Math.floor(b/8) % MUSIC.mel.length];
        osc(mn, "square", 0.38, 0.11*m, 0, mn*0.97);
        // Slight detune for richness
        osc(mn*1.006, "triangle", 0.38, 0.07*m, 0.01, mn*0.98);
      }
      // Melody echo at level 2+
      if (lv>=2 && b%8===4) {
        var me = MUSIC.mel[(Math.floor(b/8)+4) % MUSIC.mel.length];
        osc(me*0.5, "sine", 0.3, 0.06*m, 0, me*0.49);
      }

      // === ARPEGGIO ===
      { var an = MUSIC.arp[b % MUSIC.arp.length]; osc(an, "square", 0.1, 0.05*m, 0, an*0.96); }

      // === ATMOSPHERIC PADS (every 16 beats) ===
      if (b%16===0) {
        var pi = Math.floor(b/16) % 4;
        var padSlice = MUSIC.pad.slice(pi*3, pi*3+3);
        for (var pi2=0; pi2<padSlice.length; pi2++) {
          osc(padSlice[pi2], "sawtooth", 0.55, 0.04*m, pi2*0.02);
        }
      }

      // === BOSS STINGER (extra tension) ===
      if (boss) {
        if (b%4===1) {
          var bsn = MUSIC.boss[Math.floor(b/4) % MUSIC.boss.length];
          osc(bsn, "sawtooth", 0.1, 0.09*m, 0, bsn*0.88);
          noise(0.07, 0.05*m, 0, 400);
        }
        // Boss alarm pulse
        if (b%16===0) {
          osc(55, "sawtooth", 0.4, 0.12*m, 0, 28);
          osc(82, "square",   0.4, 0.08*m, 0.05, 41);
        }
      }

      // === CINEMATIC SWELL every 32 beats ===
      if (b%32===0 && lv>=2) {
        [196,247,294,370].forEach(function(f,i){ osc(f,"sine",1.2,0.04*m,i*0.08); });
      }

      _beat++;
    }, step);
  } catch(e) {}
}
function stopMusic() { clearInterval(musicInt); musicInt=null; }
window.stopMusic = stopMusic;

// ─── HUD UPDATES ─────────────────────────────────────────────────────────────

// Add points to the player's score. Also awards coins and XP based on the
// amount scored, and shows floating reward indicators above the ship.
function addScore(pts) {
  G.score += Math.round(pts);
  
  // Award coins and XP based on score
  const coinGain = Math.floor(pts / 50); // 1 coin per 50 points
  const xpGain = Math.floor(pts / 25);   // 1 XP per 25 points
  
  if (coinGain > 0) {
    G.coins += coinGain;
    
    // Also update saved data immediately
    const savedData = loadData();
    savedData.coins = (savedData.coins || 0) + coinGain;
    saveData(savedData);
    
    updateRewardHUD();
    showFloatingReward(G.ship.x, G.ship.y - 30, `+${coinGain}`, "#ffd700", "fas fa-coins");
  }
  
  if (xpGain > 0) {
    G.experience += xpGain;
    
    // Also update saved data immediately
    const savedData = loadData();
    savedData.experience = (savedData.experience || 0) + xpGain;
    saveData(savedData);
    
    updateRewardHUD();
    showFloatingReward(G.ship.x, G.ship.y - 50, `+${xpGain} XP`, "#00ffff", "fas fa-star");
  }
  
  const el = document.getElementById("gnScore");
  if (el) { 
    el.textContent = G.score.toLocaleString(); 
    el.classList.add("pop"); 
    setTimeout(()=>el.classList.remove("pop"),160); 
  }
}
function updateComboHUD()  { const el=document.getElementById("gnCombo");  if(el) el.textContent="x"+G.combo; updateMissionPanel(); }
function updateShieldBar() { const el=document.getElementById("gnShield"); if(!el) return; el.style.width=Math.max(0,G.shield)+"%"; el.classList.toggle("low",G.shield<=30); }
function updateLivesHUD() {
  var el = document.getElementById("gnLives");
  if (!el) return;
  el.innerHTML = "";
  for (var i = 0; i < 5; i++) {
    if (i >= 3) break; // max display 3
    var s = document.createElement("span");
    s.className = "life-icon" + (i >= G.lives ? " lost" : "");
    s.innerHTML = '<i class="fas fa-rocket"></i>';
    el.appendChild(s);
  }
}
function updateLevelHUD()  { const cfg=getLvl(); const ln=document.getElementById("gnLevel"),nn=document.getElementById("gnLevelName"); if(ln)ln.textContent=G.level; if(nn)nn.textContent=cfg.name; updateMissionPanel(); }
function updateAmmoHUD()   { 
  const el=document.getElementById("gnAmmo"); 
  if(el) {
    let text = "";
    if (G.rapidFire) text += "3x ";
    if (G.weaponType !== "basic") {
      const weapon = WEAPON_DEFS[G.weaponType];
      text += weapon ? weapon.name : G.weaponType.toUpperCase();
    }
    el.textContent = text;
  }
}

function updateMissionPanel() {
  const sector = document.getElementById("gmpSector");
  if (!sector) return;
  const cfg = getLvl();
  const threats = (G.asteroids?.length || 0) + (G.enemyShips?.length || 0) + (G.boss ? 1 : 0);
  const nextGoal = LEVEL_THRESHOLDS[G.level] || (LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (G.level - LEVELS.length + 1) * 900);
  const remain = Math.max(0, nextGoal - G.score);
  sector.textContent = `SECTOR ${G.level} - ${cfg.name}`;
  const threatEl = document.getElementById("gmpThreats");
  const killsEl = document.getElementById("gmpKills");
  const nextEl = document.getElementById("gmpNext");
  const objEl = document.getElementById("gmpObjective");
  if (threatEl) threatEl.textContent = threats;
  if (killsEl) killsEl.textContent = G.asteroidsKilled || 0;
  if (nextEl) nextEl.textContent = remain ? remain.toLocaleString() : "CLEAR";
  if (objEl) {
    objEl.textContent = G.boss
      ? `Focus fire on ${G.boss.name} and dodge the heavy volleys.`
      : G.shield <= 30
        ? "Shield critical. Break away, collect power-ups, then counterattack."
        : G.combo >= 4
          ? `Combo x${G.combo} active. Keep firing to preserve the streak.`
          : "Dodge incoming threats, collect power-ups, and build your combo.";
  }
}

function updateWeaponHUD() {
  const el = document.getElementById("gnWeapon");
  if (el) {
    const weapon = WEAPON_DEFS[G.weaponType] || WEAPON_DEFS.basic;
    el.textContent = weapon.name;
    el.style.color = weapon.color;
  }
}

function updateRewardHUD() {
  const coinsEl = document.getElementById("gnCoins");
  const xpEl = document.getElementById("gnXP");
  
  if (coinsEl) coinsEl.textContent = G.coins.toLocaleString();
  if (xpEl) xpEl.textContent = G.experience.toLocaleString();
  
  // Also update navigation bar
  if (typeof updateNavRewards === 'function') {
    updateNavRewards();
  }
}
function showFloatingReward(worldX, worldY, text, color, icon) {
  const screenX = wx(worldX);
  const screenY = wy(worldY);
  
  // Only show if on screen
  if (screenX < -50 || screenX > canvas.width + 50 || screenY < -50 || screenY > canvas.height + 50) return;
  
  const el = document.createElement("div");
  el.className = "floating-reward";
  el.style.cssText = `
    left: ${screenX}px;
    top: ${screenY}px;
    color: ${color};
  `;
  el.innerHTML = `<i class="${icon}"></i> ${text}`;
  
  document.body.appendChild(el);
  
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 2000);
}

function showRewardPopup(title, description, icon, color = "#ffd700") {
  const popup = document.createElement("div");
  popup.className = "reward-popup";
  popup.innerHTML = `
    <div class="reward-popup-icon" style="color: ${color}">
      <i class="${icon}"></i>
    </div>
    <div class="reward-popup-text">${title}</div>
    <div class="reward-popup-desc">${description}</div>
  `;
  
  document.body.appendChild(popup);
  
  setTimeout(() => {
    if (popup.parentNode) popup.parentNode.removeChild(popup);
  }, 3000);
}
function showToastMsg(msg) { if(window.showToast) showToast(msg); }

// ─── STARS ────────────────────────────────────────────────────────────────────

// Fill the G.stars array with 200 randomly placed background stars.
// Each star has its own speed and twinkle rate for a parallax effect.
function initStars() {
  G.stars = Array.from({length:200},()=>({
    x:Math.random()*canvas.width*4, y:Math.random()*canvas.height*4,
    r:.2+Math.random()*1.8, speed:.15+Math.random()*.7, a:.1+Math.random()*.55,
    twinkleSpeed: 0.5+Math.random()*3, twinkleOffset: Math.random()*Math.PI*2,
  }));
}

// ─── SPAWNING ────────────────────────────────────────────────────────────────

// Create a new asteroid just off-screen (top, left, or right edge).
// `forced` = true makes it smaller (used during boss fights).
// Asteroids can be normal, armoured (3 HP), or split (breaks into 2 on death).
function spawnAsteroid(forced) {
  const cfg=getLvl(), r=forced?16+Math.random()*14:18+Math.random()*24;
  const types=G.level>=3?["normal","normal","armoured","split"]:["normal","normal"];
  const type=types[Math.floor(Math.random()*types.length)];
  const dm=getDiffMod(), speed=(cfg.speed+Math.random()*1.5)*(G.slowTime?.35:1)*dm;
  const W=canvas.width, H=canvas.height;
  const edge=Math.floor(Math.random()*3);
  let x,y,vx,vy;
  if(edge===0){x=G.camX+r+Math.random()*(W-r*2);y=G.camY-r;vx=(Math.random()-.5)*speed*.8;vy=speed;}
  else if(edge===1){x=G.camX-r;y=G.camY+60+r+Math.random()*(H-r*2-60);vx=speed;vy=(Math.random()-.5)*speed*.5;}
  else{x=G.camX+W+r;y=G.camY+60+r+Math.random()*(H-r*2-60);vx=-speed;vy=(Math.random()-.5)*speed*.5;}
  G.asteroids.push({x,y,vx,vy,rot:0,rs:(Math.random()-.5)*.06,pts:makePts(r,7+Math.floor(Math.random()*4)),r,type,hp:type==="armoured"?3:type==="split"?2:1,maxHp:type==="armoured"?3:type==="split"?2:1,split:type==="split"});
}
function splitAsteroid(a) {
  for(let i=0;i<2;i++){const angle=Math.random()*Math.PI*2,nr=a.r*.55;G.asteroids.push({x:a.x+Math.cos(angle)*nr,y:a.y+Math.sin(angle)*nr,vx:Math.cos(angle)*2,vy:a.vy*.8,rot:0,rs:(Math.random()-.5)*.1,pts:makePts(nr,6),r:nr,type:"normal",hp:1,maxHp:1,split:false});}
}
// Spawn an enemy fighter ship that shoots back at the player.
// Enemies have 2-3 HP depending on level, and fire predictive shots.
function spawnEnemy() {
  if(G.bossActive&&Math.random()>.42) return;
  const dm=getDiffMod();
  const styles=[["#ff3355","#991122"],["#ff7722","#882200"],["#aa44ee","#440088"],["#22ccaa","#006644"],["#ff4488","#aa1155"]];
  const [body,acc]=styles[Math.floor(Math.random()*styles.length)];
  const hp=G.level>=4?3:2, speed=(1.05+getLvl().speed*.2)*dm;
  const W=canvas.width, H=canvas.height, edge=Math.floor(Math.random()*3);
  let x,y,vx,vy;
  if(edge===0){x=G.camX+52+Math.random()*(W-104);y=G.camY-58;vx=(Math.random()-.5)*2;vy=speed;}
  else if(edge===1){x=G.camX-58;y=G.camY+60+52+Math.random()*(H-164);vx=speed;vy=(Math.random()-.5)*2;}
  else{x=G.camX+W+58;y=G.camY+60+52+Math.random()*(H-164);vx=-speed;vy=(Math.random()-.5)*2;}
  G.enemyShips.push({x,y,vx,vy,r:45,hp,maxHp:hp,shootCd:45+Math.random()*40,shootInterval:Math.max(52,96-G.level*6+Math.floor(Math.random()*36)),body,accent:acc,wing:Math.random()>.45,bank:Math.random()*Math.PI*2,imgIdx:Math.floor(Math.random()*3)}); // Increased radius from 30 to 45
}
function fireEnemyBolt(e) {
  // Lead the target: predict where player will be based on their velocity
  const dx=G.ship.x-e.x, dy=G.ship.y-e.y;
  const dist=Math.sqrt(dx*dx+dy*dy)||1;
  const bulletSpd=9+G.level*0.5;
  // Time to reach player at current distance
  const travelTime=dist/bulletSpd;
  // Aim at predicted position (lead shot)
  const predX=G.ship.x+G.ship.vx*travelTime*0.6;
  const predY=G.ship.y+G.ship.vy*travelTime*0.6;
  const pdx=predX-e.x, pdy=predY-e.y;
  const pd=Math.sqrt(pdx*pdx+pdy*pdy)||1;
  const nx=pdx/pd, ny=pdy/pd;
  G.enemyBullets.push({
    x:e.x+nx*32, y:e.y+ny*32,
    vx:nx*bulletSpd, vy:ny*bulletSpd,
    r:5, color:e.accent, trail:[]
  });
}
// Spawn a random power-up (shield, rapid-fire, nova bomb, etc.).
// Skipped if a boss is active or if the random roll fails.
function spawnPU() {
  if(G.bossActive||Math.random()>.18) return;
  const def=pickPU();
  G.powerups.push({x:G.camX+30+Math.random()*(canvas.width-60),y:G.camY-22,vy:2.0,vx:0,r:14,angle:0,...def});
}
// Spawn the level boss at the top of the screen.
// Uses BOSS_DEFS for levels 3 and 5; generates a scaled adaptive boss for
// any level beyond 5 (harder each time).
function spawnBoss() {
  var def = BOSS_DEFS[G.level];
  if (!def) {
    // Adaptive boss: scales with level
    var ex = Math.max(0, G.level - 5);
    def = {
      name: "SECTOR " + G.level + " OVERLORD",
      hp:   120 + ex * 40, // Increased base from 40 to 120, and scaling from 15 to 40
      colorHex: ["#ff4400","#cc00ff","#00ffcc","#ff2d78","#ffaa00"][ex % 5],
      r:    55 + Math.min(ex * 3, 30),
      spd:  1.4 + ex * 0.15,
      sR:   Math.max(30, 90 - ex * 8)
    };
  }
  G.boss={x:G.camX+canvas.width/2,y:G.camY-85,targetY:G.camY+130,vx:def.spd,r:def.r,colorHex:def.colorHex,name:def.name,hp:def.hp,maxHp:def.hp,pts:makePts(def.r,10,.18),shootTimer:0,shootRate:def.sR,enraged:false};
  G.bossActive=true; G.bossSpawned=true;
  const ov=document.getElementById("overlayBoss");
  if (ov) {
    document.getElementById("bossWarnName").textContent=def.name;
    ov.classList.remove("hidden"); sfx.boss();
    setTimeout(()=>ov.classList.add("hidden"),2500);
  }
}
function spawnExplosion(x,y,color,size) {
  if(!window.NS?.particles) return;
  if(G.particles.length>500) G.particles.splice(0, G.particles.length-400);

  const n = Math.min(40, Math.floor(size * 1.4));

  // Stage 1: Fast bright fire core (white/yellow center)
  for(let i=0;i<Math.floor(n*0.3);i++){
    const a=Math.random()*Math.PI*2, s=3+Math.random()*(size/8);
    G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      r:2+Math.random()*3, life:1, decay:0.06+Math.random()*0.04,
      color:"#ffffff", type:"fire"});
  }

  // Stage 2: Orange/yellow fire debris
  for(let i=0;i<Math.floor(n*0.35);i++){
    const a=Math.random()*Math.PI*2, s=1.5+Math.random()*(size/12);
    const fireColor = Math.random()<0.5 ? "#ffaa00" : "#ff6600";
    G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      r:1.5+Math.random()*4, life:1, decay:0.03+Math.random()*0.03,
      color:fireColor, type:"fire"});
  }

  // Stage 3: Colored debris matching explosion color
  for(let i=0;i<Math.floor(n*0.25);i++){
    const a=Math.random()*Math.PI*2, s=0.8+Math.random()*(size/16);
    G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      r:1+Math.random()*3, life:1, decay:0.02+Math.random()*0.025,
      color:color, type:"debris"});
  }

  // Stage 4: Dark smoke (slow, large, fades)
  for(let i=0;i<Math.floor(n*0.1);i++){
    const a=Math.random()*Math.PI*2, s=0.3+Math.random()*(size/25);
    G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-0.5,
      r:4+Math.random()*6, life:0.7, decay:0.008+Math.random()*0.01,
      color:"rgba(40,40,40,0.6)", type:"smoke"});
  }

  // Stage 5: Shockwave ring (single large expanding ring)
  G.particles.push({x,y,vx:0,vy:0,
    r:size*0.3, life:1, decay:0.08,
    color:color, type:"ring", maxR:size*1.8});
}

// ─── FIRING ──────────────────────────────────────────────────────────────────

// Fire the player's current weapon. Respects the shoot cooldown (G.shootCD).
// Rapid-fire triples the shot count; each weapon type has its own bullet pattern.
function fireShot() {
  if(G.shootCD>0) return;
  sfx.shoot();
  const lc=getLvl();
  let shots=1, offsets=[0], dmg=1, cd=4; // Reduced cooldown from 7 to 4 for faster shooting
  
  // Apply weapon upgrades
  if (G.weaponType === "plasma") {
    shots = 2; offsets = [-12, 12]; dmg = 2; cd = 5;
  } else if (G.weaponType === "laser") {
    shots = 1; offsets = [0]; dmg = 3; cd = 6;
  } else if (G.weaponType === "missile") {
    shots = 1; offsets = [0]; dmg = 5; cd = 15;
  } else if (G.weaponType === "spread") {
    shots = 5; offsets = [-24, -12, 0, 12, 24]; dmg = 1; cd = 8;
  }
  
  if(G.rapidFire){
    shots = Math.max(shots, 3);
    if (shots === 1) offsets = [-16, 0, 16];
    cd = Math.max(2, Math.floor(cd * 0.5)); // Rapid fire reduces cooldown by 50%
  }
  
  G.shootCD=cd;
  const cosA=Math.cos(G.ship.angle), sinA=Math.sin(G.ship.angle);
  // Increased bullet speed for more responsive combat
  const BULLET_SPEED = 60; // Increased from 48 to 60
  
  for(let i=0;i<shots;i++){
    const ox=offsets[i];
    const px=Math.cos(G.ship.angle+Math.PI/2)*ox;
    const py=Math.sin(G.ship.angle+Math.PI/2)*ox;
    // Add ship velocity so bullets feel connected to movement
    const inheritVel = 0.4;
    
    const bullet = {
      x: G.ship.x+cosA*30+px,
      y: G.ship.y+sinA*30+py,
      vx: cosA*BULLET_SPEED + G.ship.vx*inheritVel,
      vy: sinA*BULLET_SPEED + G.ship.vy*inheritVel,
      r: G.weaponType === "laser" ? 6 : 4,
      colorHex: getWeaponColor(),
      trail: [],
      dmg: dmg,
      born: G.frame,
      type: G.weaponType || "basic"
    };
    
    G.bullets.push(bullet);
  }
}

function getWeaponColor() {
  const lc = getLvl();
  switch(G.weaponType) {
    case "plasma": return "#ff00ff";
    case "laser": return "#ff0000";
    case "missile": return "#ffaa00";
    case "spread": return "#00ff00";
    default: return lc.colorHex;
  }
}

//  POWER-UP APPLY 
function applyPU(p) {
  sfx.pickup(); G.puCollected++;
  spawnFloatLabel(p.x,p.y,p.label,p.colorHex);
  switch(p.type){
    case"shield":G.shield=Math.min(100,G.shield+40);updateShieldBar();showToastMsg("Shield +40%!");break;
    case"rapid":G.rapidFire=true;G.rapidTimer=480;updateAmmoHUD();showToastMsg("Rapid Fire!");break;
    case"slow":G.slowTime=true;G.slowTimer=360;showToastMsg("Time Slowed!");break;
    case"score2x":G.mult=2;setTimeout(()=>{G.mult=1;document.getElementById("bonusStat").classList.add("d-none");document.getElementById("bonusStat").classList.remove("d-flex");},10000);document.getElementById("bonusStat").classList.remove("d-none");document.getElementById("bonusStat").classList.add("d-flex");document.getElementById("gnBonus").textContent="x2";showToastMsg("Score x2!");break;
    case"life":G.lives=Math.min(5,G.lives+1);updateLivesHUD();showToastMsg("Extra Life!");break;
    case"nova":novaBomb();break;
    case"magnet":G.magnet=true;G.magnetTimer=400;showToastMsg("Magnet Active!");break;
    // New weapon power-ups
    case"plasma":
      if (!G.weaponsUnlocked.includes("plasma")) {
        G.weaponsUnlocked.push("plasma");
        showRewardPopup("PLASMA CANNON UNLOCKED!", "Dual plasma bolts with 2x damage", "fas fa-bolt", "#ff00ff");
      }
      G.weaponType = "plasma";
      updateWeaponHUD();
      showToastMsg("Plasma Cannon Active!");
      break;
    case"laser":
      if (!G.weaponsUnlocked.includes("laser")) {
        G.weaponsUnlocked.push("laser");
        showRewardPopup("LASER BEAM UNLOCKED!", "High-damage concentrated beam", "fas fa-laser-pointer", "#ff0000");
      }
      G.weaponType = "laser";
      updateWeaponHUD();
      showToastMsg("Laser Beam Active!");
      break;
    case"missile":
      if (!G.weaponsUnlocked.includes("missile")) {
        G.weaponsUnlocked.push("missile");
        showRewardPopup("MISSILES UNLOCKED!", "Devastating guided missiles", "fas fa-rocket", "#ffaa00");
      }
      G.weaponType = "missile";
      updateWeaponHUD();
      showToastMsg("Missiles Active!");
      break;
    case"spread":
      if (!G.weaponsUnlocked.includes("spread")) {
        G.weaponsUnlocked.push("spread");
        showRewardPopup("SPREAD SHOT UNLOCKED!", "Wide area coverage", "fas fa-expand-arrows-alt", "#00ff00");
      }
      G.weaponType = "spread";
      updateWeaponHUD();
      showToastMsg("Spread Shot Active!");
      break;
    case"coins":
      const coinAmount = 25 + Math.floor(Math.random() * 25);
      G.coins += coinAmount;
      updateRewardHUD();
      showFloatingReward(p.x, p.y, `+${coinAmount}`, "#ffd700", "fas fa-coins");
      showToastMsg(`+${coinAmount} Coins!`);
      break;
    case"xp":
      const xpAmount = 10 + Math.floor(Math.random() * 15);
      G.experience += xpAmount;
      updateRewardHUD();
      showFloatingReward(p.x, p.y, `+${xpAmount} XP`, "#00ffff", "fas fa-star");
      showToastMsg(`+${xpAmount} XP!`);
      checkXPLevelUp();
      break;
  }
  const d=window.loadData&&loadData(); window.saveData&&saveData({totalPU:(d.totalPU||0)+1});
}
function novaBomb() {
  sfx.nova();
  const n=G.asteroids.length+G.enemyShips.length;
  G.asteroids.forEach(a=>{addScore((15+a.r)*G.mult);spawnExplosion(a.x,a.y,"#00ff88",a.r);G.asteroidsKilled++;});
  G.enemyShips.forEach(e=>{addScore(40*G.mult);spawnExplosion(e.x,e.y,e.body,26);G.asteroidsKilled++;});
  G.asteroids=[];G.bossBullets=[];G.enemyShips=[];G.enemyBullets=[];
  showToastMsg(" NOVA BOMB  "+n+" cleared!");
  G.flashCol="#00ff88"; G.flashA=.52;
}

//  BOSS UPDATE 
function updateBoss() {
  const b=G.boss; if(!b) return;
  const sp=G.slowTime?.35:1;
  b.targetY=G.camY+130;
  if(b.y<b.targetY) b.y+=2;
  b.x+=b.vx*sp;
  if(b.x<G.camX+b.r+20||b.x>G.camX+canvas.width-b.r-20) b.vx*=-1;
  if(b.hp<=b.maxHp*.3&&!b.enraged){b.enraged=true;b.vx*=1.8;b.shootRate=Math.floor(b.shootRate*.5);showToastMsg("BOSS ENRAGED!");}
  b.shootTimer++;
  if(b.shootTimer>=b.shootRate){b.shootTimer=0;bossFire(b);}
}
function bossFire(b) {
  // Spread shot pattern + aimed center shot
  const dx=G.ship.x-b.x, dy=G.ship.y-b.y, d=Math.sqrt(dx*dx+dy*dy)||1;
  const aimAngle=Math.atan2(dy,dx);
  const n=b.enraged?7:(b.hp<=b.maxHp*.6?5:3);
  const spread=b.enraged?0.28:0.22;
  const spd=b.enraged?7:5;
  for(let i=0;i<n;i++){
    const a=aimAngle+(i-Math.floor(n/2))*spread;
    G.bossBullets.push({x:b.x,y:b.y+b.r,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,r:8,color:b.colorHex});
  }
}
function killBoss() {
  sfx.nova(); spawnExplosion(G.boss.x,G.boss.y,G.boss.colorHex,G.boss.r*3);
  addScore(500); G.bossKills++;
  showToastMsg("BOSS DEFEATED! +500 pts");
  G.boss=null; G.bossActive=false;
  G.flashCol="#ffd60a"; G.flashA=.52; sfx.levelUp();
  window.unlockAch&&unlockAch("boss1");
  const d=window.loadData&&loadData(); window.saveData&&saveData({bossKills:(d.bossKills||0)+1});
}

//  SHIP HIT 
function shipHit() {
  G.shield-=30; sfx.hit(); updateShieldBar();
  G.combo=1; updateComboHUD();
  G.flashCol="#ff006e"; G.flashA=.52;
  if(window.NS?.shake!==false) G.shake={active:true,timer:20,intensity:6};
  if(G.shield<=30&&G.shield>0) sfx.shieldLow();
  if(G.shield<=0){
    G.lives--; G.shield=100; updateShieldBar(); updateLivesHUD();
    G.invincible=true; G.invTimer=120;
    sfx.lifeLost();
    if(G.lives<=0){endGame();return;}
    showToastMsg("Life lost!");
  }
}

//  COLLISIONS 
function collide() {
  const sx=G.ship.x, sy=G.ship.y, ph=PLAYER_HIT_R;
  // bullets vs asteroids & enemies
  for(let bi=G.bullets.length-1;bi>=0;bi--){
    const b=G.bullets[bi]; let hit=false;
    for(let ai=G.asteroids.length-1;ai>=0;ai--){
      const a=G.asteroids[ai];
      if((b.x-a.x)**2+(b.y-a.y)**2<(b.r+a.r)**2){
        a.hp-=b.dmg; hit=true; spawnExplosion(b.x,b.y,getLvl().colorHex,10);
        if(a.hp<=0){if(a.split)splitAsteroid(a);spawnExplosion(a.x,a.y,"#ff6400",a.r*1.2);sfx.explode();G.asteroids.splice(ai,1);G.asteroidsKilled++;
          const prevCombo=G.combo;
          G.combo=Math.min(G.combo+1,8);G.maxCombo=Math.max(G.maxCombo,G.combo);G.comboDecay=0;
          if(G.combo>prevCombo&&G.combo>=3) sfx.combo(G.combo);
          addScore((20+a.r)*G.combo*G.mult);updateComboHUD();}else{spawnHitMarker(a.x,a.y,getLvl().colorHex);}
        break;
      }
    }
    if(!hit){
      for(let ei=G.enemyShips.length-1;ei>=0;ei--){
        const e=G.enemyShips[ei];
        if((b.x-e.x)**2+(b.y-e.y)**2<(b.r+e.r*.88)**2){
          e.hp-=b.dmg; hit=true; spawnExplosion(b.x,b.y,e.accent,11);
          if(e.hp<=0){spawnExplosion(e.x,e.y,e.body,30);sfx.explode();G.enemyShips.splice(ei,1);G.asteroidsKilled++;
            const prevCombo=G.combo;
            G.combo=Math.min(G.combo+1,8);G.maxCombo=Math.max(G.maxCombo,G.combo);G.comboDecay=0;
            if(G.combo>prevCombo&&G.combo>=3) sfx.combo(G.combo);
            addScore((55+e.maxHp*18)*G.combo*G.mult);updateComboHUD();}else{spawnHitMarker(e.x,e.y,e.accent);}
          break;
        }
      }
    }
    if(hit){G.bullets.splice(bi,1);continue;}
    if(Math.hypot(b.x-sx,b.y-sy)>canvas.width*1.5) G.bullets.splice(bi,1);
  }
  // bullets vs boss
  if(G.boss){
    for(let bi=G.bullets.length-1;bi>=0;bi--){
      const b=G.bullets[bi];
      if((b.x-G.boss.x)**2+(b.y-G.boss.y)**2<(b.r+G.boss.r)**2){
        G.boss.hp-=b.dmg; G.bullets.splice(bi,1); spawnExplosion(b.x,b.y,G.boss.colorHex,14); addScore(50*G.mult);
        if(G.boss.hp<=0) killBoss();
      }
    }
  }
  if(G.invincible) return;
  // ship vs asteroids -- physics bounce
  for(let ai=G.asteroids.length-1;ai>=0;ai--){
    const a=G.asteroids[ai];
    const dist2=(sx-a.x)**2+(sy-a.y)**2;
    const hitDist=ph+a.r;
    if(dist2<hitDist*hitDist){
      const dx=sx-a.x, dy=sy-a.y, d=Math.sqrt(dist2)||1;
      // Elastic-style bounce: ship bounces off asteroid surface
      const nx=dx/d, ny=dy/d;
      const relVx=G.ship.vx-a.vx, relVy=G.ship.vy-a.vy;
      const dot=relVx*nx+relVy*ny;
      if(dot<0){ // only bounce if moving toward each other
        const bounce=1.4;
        G.ship.vx-=bounce*dot*nx;
        G.ship.vy-=bounce*dot*ny;
        // Push asteroid away
        a.vx+=dot*nx*0.5;
        a.vy+=dot*ny*0.5;
      }
      // Separate overlapping objects
      const overlap=hitDist-Math.sqrt(dist2);
      G.ship.x+=nx*overlap*0.6;
      G.ship.y+=ny*overlap*0.6;
      // Damage
      spawnExplosion(sx-nx*ph,sy-ny*ph,"#ff6600",a.r*0.8);
      if(window.NS?.shake!==false) G.shake={active:true,timer:12,intensity:7};
      shipHit();
      a.hp--;
      if(a.hp<=0){if(a.split)splitAsteroid(a);G.asteroids.splice(ai,1);}
      break;
    }
  }
  // ship vs enemies -- realistic collision with knockback and destruction
  for(let ei=G.enemyShips.length-1;ei>=0;ei--){
    const e=G.enemyShips[ei];
    const dist2=(sx-e.x)**2+(sy-e.y)**2;
    const hitDist=ph+e.r*0.75;
    if(dist2<hitDist*hitDist){
      const dx=sx-e.x, dy=sy-e.y, d=Math.sqrt(dist2)||1;
      // Knockback: ship bounces away from enemy
      G.ship.vx+=(dx/d)*9;
      G.ship.vy+=(dy/d)*9;
      // Enemy pushed back too
      e.vx-=(dx/d)*5;
      e.vy-=(dy/d)*5;
      // Big explosion + strong screen shake
      spawnExplosion(e.x,e.y,e.body,44);
      sfx.explode();
      if(window.NS?.shake!==false) G.shake={active:true,timer:28,intensity:14};
      G.flashCol="#ff4400"; G.flashA=0.65;
      // Enemy destroyed instantly on direct collision
      G.enemyShips.splice(ei,1);
      G.asteroidsKilled++;
      addScore(80*G.mult);
      // Ship takes damage
      shipHit();
      break;
    }
  }
  // ship vs boss bullets
  for(let bi=G.bossBullets.length-1;bi>=0;bi--){
    const b=G.bossBullets[bi];
    if((sx-b.x)**2+(sy-b.y)**2<(ph+b.r)**2){
      G.bossBullets.splice(bi,1);
      // Impact flash + particles
      spawnExplosion(b.x,b.y,b.color||"#ff4400",18);
      G.flashCol="#ff2200"; G.flashA=0.45;
      if(window.NS?.shake!==false) G.shake={active:true,timer:18,intensity:10};
      shipHit();
      break;
    }
  }
  // ship vs enemy bullets
  for(let bi=G.enemyBullets.length-1;bi>=0;bi--){
    const b=G.enemyBullets[bi];
    if((sx-b.x)**2+(sy-b.y)**2<(ph+b.r)**2){
      G.enemyBullets.splice(bi,1);
      // Impact flash + particles
      spawnExplosion(b.x,b.y,b.color||"#ff3355",14);
      G.flashCol="#ff1144"; G.flashA=0.38;
      if(window.NS?.shake!==false) G.shake={active:true,timer:14,intensity:8};
      shipHit();
      break;
    }
  }
  // ship vs powerups
  for(let pi=G.powerups.length-1;pi>=0;pi--){
    const p=G.powerups[pi];
    if(G.magnet){const dx=sx-p.x,dy=sy-p.y,d=Math.sqrt(dx*dx+dy*dy);if(d<200){p.x+=dx/d*5;p.y+=dy/d*5;}}
    if((sx-p.x)**2+(sy-p.y)**2<(ph+p.r)**2){applyPU(p);G.powerups.splice(pi,1);}
    else if(p.y>G.camY+canvas.height+30) G.powerups.splice(pi,1);
  }
}

//  LEVEL UP 
// Adaptive level-up: thresholds scale with level for endless play
function checkLevelUp() {
  // Threshold formula: each level needs progressively more score
  // Early levels: easy ramp. Later levels: steeper but fair.
  var th;
  if (G.level < LEVEL_THRESHOLDS.length) {
    th = LEVEL_THRESHOLDS[G.level];
  } else {
    // Adaptive: base 2500 + 1200 per level past 5, capped growth
    var extra = G.level - LEVEL_THRESHOLDS.length + 1;
    th = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length-1] + extra * Math.min(1800, 800 + extra * 80);
  }

  if(G.score >= th){
    G.level++;
    sfx.levelUp();
    updateLevelHUD();
    const cfg = getLvl();

    // Update level-up overlay
    var luTitle = document.getElementById("luTitle");
    var luName  = document.getElementById("luName");
    var luStars = document.getElementById("luStars");
    if (luTitle) luTitle.textContent = "LEVEL " + G.level;
    if (luName)  luName.textContent  = cfg.name;
    if (luStars) {
      var stars = Math.min(G.level, 5);
      luStars.textContent = "STAR".repeat(0) + Array(stars+1).join("*") + Array(Math.max(0,5-stars)+1).join("-");
    }

    const ov = document.getElementById("overlayLevelUp");
    if (ov) { ov.classList.remove("hidden"); setTimeout(()=>ov.classList.add("hidden"), 2800); }

    // Spawn boss if this level has one
    if (cfg.boss && !G.bossSpawned) setTimeout(spawnBoss, 3000);

    // Adaptive difficulty: increase enemy count cap at higher levels
    // (handled in spawn logic via G.level)
  }
}

// XP Level Up - unlock weapons based on XP thresholds
function checkXPLevelUp() {
  const xpThresholds = {
    100: "plasma",   // Unlock plasma at 100 XP
    250: "spread",   // Unlock spread at 250 XP  
    500: "laser",    // Unlock laser at 500 XP
    1000: "missile"  // Unlock missile at 1000 XP
  };
  
  for (const [threshold, weapon] of Object.entries(xpThresholds)) {
    if (G.experience >= parseInt(threshold) && !G.weaponsUnlocked.includes(weapon)) {
      G.weaponsUnlocked.push(weapon);
      const weaponDef = WEAPON_DEFS[weapon];
      showRewardPopup(
        `${weaponDef.name.toUpperCase()} UNLOCKED!`, 
        `XP Milestone Reached! ${weaponDef.description}`, 
        "fas fa-star", 
        weaponDef.color
      );
      showToastMsg(`${weaponDef.name} Unlocked via XP!`);
      updateRewardHUD();
    }
  }
}

//  DRAW 
function drawBg() {
  const lc = getLvl();
  const t = Date.now() / 1000;

  // Enhanced space cycle with day/night awareness
  const cycle = (t % 120) / 120; // 0..1 over 2 minutes
  const phase = cycle * Math.PI * 2;

  // Base level colors with day/night modifications
  let r0 = parseInt(lc.bgTop.slice(1,3)||"05",16);
  let g0 = parseInt(lc.bgTop.slice(3,5)||"05",16);
  let b0 = parseInt(lc.bgTop.slice(5,7)||"20",16);

  // Atmospheric effects based on time period
  let atmosphericEffect = 1.0;
  let cloudAlpha = 0.04;
  let nebulaIntensity = 1.0;
  
  if (lc.period === "dawn") {
    // Dawn: warm, gentle pulsing
    atmosphericEffect = 1.2;
    cloudAlpha = 0.08;
    r0 = Math.min(255, r0 * 1.3);
    g0 = Math.min(255, g0 * 1.1);
  } else if (lc.period === "day") {
    // Day: bright, clear, minimal nebula
    atmosphericEffect = 1.5;
    cloudAlpha = 0.02;
    nebulaIntensity = 0.3;
    r0 = Math.min(255, r0 * 1.4);
    g0 = Math.min(255, g0 * 1.4);
    b0 = Math.min(255, b0 * 1.4);
  } else if (lc.period === "dusk") {
    // Dusk: dramatic, warm colors
    atmosphericEffect = 1.3;
    cloudAlpha = 0.06;
    r0 = Math.min(255, r0 * 1.2);
    g0 = Math.min(255, g0 * 0.9);
  } else {
    // Night: deep space, enhanced nebula
    atmosphericEffect = 0.8;
    cloudAlpha = 0.05;
    nebulaIntensity = 1.2;
  }

  // Nebula pulse with atmospheric enhancement
  const nebulaR = Math.floor(r0 + Math.sin(phase) * 8 * atmosphericEffect);
  const nebulaG = Math.floor(g0 + Math.sin(phase * 0.7) * 6 * atmosphericEffect);
  const nebulaB = Math.floor(b0 + Math.cos(phase * 0.5) * 12 * atmosphericEffect);

  const topColor = `rgb(${Math.max(0,Math.min(255,nebulaR))},${Math.max(0,Math.min(255,nebulaG))},${Math.max(0,Math.min(255,nebulaB))})`;

  // Bottom color with atmospheric effects
  const botShift = Math.sin(phase * 0.3) * 10 * atmosphericEffect;
  let r1 = parseInt(lc.bgBot.slice(1,3)||"0a",16);
  let g1 = parseInt(lc.bgBot.slice(3,5)||"15",16);
  let b1 = parseInt(lc.bgBot.slice(5,7)||"60",16);
  
  // Apply period-specific color adjustments
  if (lc.period === "day") {
    r1 = Math.min(255, r1 * 1.4);
    g1 = Math.min(255, g1 * 1.4);
    b1 = Math.min(255, b1 * 1.4);
  } else if (lc.period === "dawn" || lc.period === "dusk") {
    r1 = Math.min(255, r1 * 1.2);
  }
  
  const botColor = `rgb(${Math.max(0,Math.min(255,r1+botShift|0))},${Math.max(0,Math.min(255,g1))},${Math.max(0,Math.min(255,b1))})`;

  const grad = ctx.createLinearGradient(0,0,0,canvas.height);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, botColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // Enhanced nebula cloud with period-specific effects
  const nx = (canvas.width * 0.3 + Math.sin(t*0.04)*canvas.width*0.15);
  const ny = (canvas.height * 0.4 + Math.cos(t*0.03)*canvas.height*0.1);
  const nebulaGrad = ctx.createRadialGradient(nx,ny,0,nx,ny,canvas.width*0.45);
  const nebulaAlpha = cloudAlpha + Math.sin(phase) * 0.02 * nebulaIntensity;
  nebulaGrad.addColorStop(0, lc.colorHex + Math.floor(nebulaAlpha*255).toString(16).padStart(2,"0"));
  nebulaGrad.addColorStop(1, "transparent");
  ctx.fillStyle = nebulaGrad;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  
  // Additional atmospheric effects for day periods
  if (lc.period === "dawn" || lc.period === "dusk") {
    // Add warm atmospheric glow
    const glowGrad = ctx.createRadialGradient(canvas.width*0.7, canvas.height*0.2, 0, canvas.width*0.7, canvas.height*0.2, canvas.width*0.6);
    const glowColor = lc.period === "dawn" ? "#ff6b35" : "#ff4500";
    glowGrad.addColorStop(0, glowColor + "08");
    glowGrad.addColorStop(1, "transparent");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0,0,canvas.width,canvas.height);
  } else if (lc.period === "day") {
    // Add subtle sun rays effect
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + t * 0.01;
      const x1 = canvas.width * 0.8 + Math.cos(angle) * 50;
      const y1 = canvas.height * 0.2 + Math.sin(angle) * 50;
      const x2 = canvas.width * 0.8 + Math.cos(angle) * canvas.width * 0.4;
      const y2 = canvas.height * 0.2 + Math.sin(angle) * canvas.width * 0.4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
function drawStars() {
  const t=Date.now()/1000;
  G.stars.forEach(s=>{
    const px=((s.x-G.camX*s.speed*.1)%(canvas.width*4)+canvas.width*4)%(canvas.width*4);
    const py=((s.y-G.camY*s.speed*.1)%(canvas.height*4)+canvas.height*4)%(canvas.height*4);
    if(px>canvas.width||py>canvas.height) return;
    // Twinkling effect
    const twinkle=s.a*(0.7+0.3*Math.sin(t*s.twinkleSpeed+s.twinkleOffset));
    ctx.beginPath(); ctx.arc(px,py,s.r,0,Math.PI*2);
    ctx.fillStyle=`rgba(210,235,255,${twinkle})`; ctx.fill();
  });
}
function drawShip() {
  if(G.invincible&&Math.floor(Date.now()/80)%2===0) return;
  const color=SKIN_COLORS[window.selectedSkin||0];
  window.drawShipOnCtx&&drawShipOnCtx(ctx,wx(G.ship.x),wy(G.ship.y),color,Date.now()/1000,G.ship.angle);
  // Low shield warning -- radial glow pulse, no hard border
  if(G.shield<40){
    const pulse=0.4+Math.sin(Date.now()/120)*0.35;
    const grd=ctx.createRadialGradient(wx(G.ship.x),wy(G.ship.y),10,wx(G.ship.x),wy(G.ship.y),PLAYER_HIT_R+18);
    grd.addColorStop(0,"transparent");
    grd.addColorStop(1,"rgba(255,30,60,"+pulse+")");
    ctx.fillStyle=grd;
    ctx.beginPath();ctx.arc(wx(G.ship.x),wy(G.ship.y),PLAYER_HIT_R+18,0,Math.PI*2);
    ctx.fill();
  }
}
function drawAsteroid(a) {
  const x=wx(a.x), y=wy(a.y);
  if(x<-a.r-20||x>canvas.width+a.r+20||y<-a.r-20||y>canvas.height+a.r+20) return;
  ctx.save(); ctx.translate(x,y); ctx.rotate(a.rot);
  const dr=1-(a.hp/a.maxHp);
  let fg, strokeCol;
  if(a.type==="armoured"){
    fg=ctx.createRadialGradient(0,0,2,0,0,a.r);
    fg.addColorStop(0,"#aabbcc"); fg.addColorStop(.5,"#667788"); fg.addColorStop(1,"#223344");
    strokeCol="#88aacc";
  } else if(a.type==="split"){
    fg=ctx.createRadialGradient(0,0,2,0,0,a.r);
    fg.addColorStop(0,"#cc6600"); fg.addColorStop(.6,"#884400"); fg.addColorStop(1,"#331100");
    strokeCol="#ff8800";
  } else {
    // Normal: bright rocky brown/grey -- easy to see against dark space
    const r0=Math.min(255,120+dr*60|0), g0=Math.max(0,90-dr*30|0), b0=Math.max(0,60-dr*20|0);
    fg=ctx.createRadialGradient(-a.r*.25,-a.r*.25,a.r*.1,0,0,a.r);
    fg.addColorStop(0,`rgb(${r0+40},${g0+30},${b0+20})`);
    fg.addColorStop(.6,`rgb(${r0},${g0},${b0})`);
    fg.addColorStop(1,"#1a0a04");
    strokeCol=getLvl().colorHex;
  }
  // Fill
  ctx.fillStyle=fg;
  ctx.beginPath(); ctx.moveTo(a.pts[0].x,a.pts[0].y);
  a.pts.forEach(p=>ctx.lineTo(p.x,p.y)); ctx.closePath(); ctx.fill();
  // Bright outline -- always visible regardless of level
  ctx.strokeStyle = strokeCol;
  ctx.lineWidth = a.type==="armoured" ? 2.5 : 2;
  ctx.globalAlpha = 0.85;
  ctx.shadowColor = strokeCol;
  ctx.shadowBlur  = 6;
  ctx.beginPath(); ctx.moveTo(a.pts[0].x,a.pts[0].y);
  a.pts.forEach(p=>ctx.lineTo(p.x,p.y)); ctx.closePath(); ctx.stroke();
  ctx.globalAlpha=1; ctx.shadowBlur=0;
  ctx.restore();
}
//  ENEMY & BOSS PNG IMAGES
// enemy2.png, enemy3.png, Boss-SpaceShip-Game-Sprites2.png = enemy ships
// Boss.png, boss2.png, boss3.png = boss ships
var _enemyImgs = [];
var _bossImgs  = [];
(function(){
  var eSrcs = ["enemy3.png", "enemy2.png", "Boss-SpaceShip-Game-Sprites2.png"];
  var bSrcs = ["Boss.png", "boss2.png", "boss3.png"];
  eSrcs.forEach(function(src){
    var img = new Image();
    img.src = src;
    _enemyImgs.push(img);
  });
  bSrcs.forEach(function(src){
    var img = new Image();
    img.src = src;
    _bossImgs.push(img);
  });
})();

function drawEnemy(e) {
  const x=wx(e.x), y=wy(e.y);
  if(x<-80||x>canvas.width+80||y<-80||y>canvas.height+80) return; // Increased bounds
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(Math.sin(e.bank)*.18 + Math.PI);

  var imgIdx = e.imgIdx !== undefined ? e.imgIdx : 0;
  var img = _enemyImgs[imgIdx % _enemyImgs.length];

  if (img && img.complete && img.naturalWidth > 0) {
    // Significantly increased size for better visibility and clarity
    var sz = 140; // Increased from 80 to 140
    // Enhanced engine glow behind enemy
    ctx.shadowColor = e.accent;
    ctx.shadowBlur  = 24; // Increased glow
    ctx.globalAlpha = 0.4; // More visible glow
    ctx.fillStyle = e.accent;
    ctx.beginPath();
    ctx.arc(0, sz*0.15, sz*0.25, 0, Math.PI*2); // Larger engine glow
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    // Draw PNG with high quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -sz/2, -sz/2, sz, sz);
  } else {
    // Fallback vector enemy - also increased size
    ctx.scale(1.6, 1.6); // Increased scale
    ctx.fillStyle=e.body; 
    ctx.shadowColor=e.accent; 
    ctx.shadowBlur=16; // Increased glow
    ctx.beginPath(); 
    ctx.moveTo(0,26); ctx.lineTo(15,-14); ctx.lineTo(7,-18); 
    ctx.lineTo(0,-10); ctx.lineTo(-7,-18); ctx.lineTo(-15,-14); 
    ctx.closePath(); 
    ctx.fill();
    ctx.shadowBlur=0; 
    ctx.fillStyle=e.accent; 
    ctx.globalAlpha=.88;
    ctx.beginPath(); 
    ctx.arc(0,4,6,0,Math.PI*2); // Larger core
    ctx.fill(); 
    ctx.globalAlpha=1;
  }
  ctx.restore();

  // Enemy HP bar -- positioned higher due to larger ship
  const ex2=wx(e.x), ey2=wy(e.y);
  const barW=60, barH=7, barX=ex2-barW/2, barY=ey2-65; // Increased bar size and moved up
  const pct=e.hp/e.maxHp;
  // Background
  ctx.fillStyle="rgba(0,0,0,0.7)";
  ctx.beginPath(); ctx.roundRect(barX-1,barY-1,barW+2,barH+2,3); ctx.fill();
  // HP fill -- green to red
  const hpColor = pct>0.6?"#00ff88":pct>0.3?"#ffcc00":"#ff2244";
  ctx.fillStyle=hpColor;
  ctx.shadowColor=hpColor; ctx.shadowBlur=4;
  ctx.beginPath(); ctx.roundRect(barX,barY,barW*pct,barH,2); ctx.fill();
  ctx.shadowBlur=0;
  // HP text
  ctx.font="bold 9px Orbitron,monospace";
  ctx.fillStyle="#ffffff"; ctx.textAlign="center";
  ctx.fillText(e.hp+"/"+e.maxHp, ex2, barY-3);
}
function drawBullet(b) {
  const x=wx(b.x), y=wy(b.y);
  if(x<-20||x>canvas.width+20||y<-20||y>canvas.height+20) return;
  const angle = Math.atan2(b.vy, b.vx);
  const len = 16; // Slightly longer bullet for better visibility
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  
  // Enhanced bullet visibility with stronger glow and contrast
  const bulletColor = b.colorHex || "#00ffff";
  
  // Outer glow for maximum visibility
  ctx.shadowColor = bulletColor;
  ctx.shadowBlur = 20; // Increased glow
  ctx.fillStyle = bulletColor + "44"; // Semi-transparent outer glow
  ctx.beginPath();
  ctx.ellipse(0, 0, len/2 + 4, 4, 0, 0, Math.PI*2);
  ctx.fill();
  
  // Main bullet trail with gradient
  const grad = ctx.createLinearGradient(-len, 0, 4, 0);
  grad.addColorStop(0, "transparent");
  grad.addColorStop(0.3, bulletColor + "AA"); // More opaque
  grad.addColorStop(1, bulletColor);
  ctx.shadowBlur = 15; // Strong glow
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, len/2, 3, 0, 0, Math.PI*2); // Slightly thicker
  ctx.fill();
  
  // Bright white core for maximum contrast
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.ellipse(0, 0, len/3, 2, 0, 0, Math.PI*2);
  ctx.fill();
  
  // Ultra-bright tip
  ctx.fillStyle = "#ffffff";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(len/2 - 1, 0, 2.5, 0, Math.PI*2); // Larger tip
  ctx.fill();
  
  ctx.shadowBlur = 0;
  ctx.restore();
}
function drawEnemyBullet(b) {
  const x=wx(b.x), y=wy(b.y);
  if(x<-30||x>canvas.width+30||y<-30||y>canvas.height+30) return;
  if(!b.trail) b.trail=[];
  b.trail.push({x,y}); if(b.trail.length>10) b.trail.shift();

  const angle=Math.atan2(b.vy,b.vx);
  const missileLen=18;
  const col=b.color||"#ff3355";

  // Glowing trail
  for(let i=0;i<b.trail.length;i++){
    const t=b.trail[i];
    const alpha=(i/b.trail.length)*0.5;
    const radius=b.r*0.5*(i/b.trail.length);
    ctx.beginPath();ctx.arc(t.x,t.y,radius,0,Math.PI*2);
    ctx.fillStyle=col;ctx.globalAlpha=alpha;ctx.fill();
  }
  ctx.globalAlpha=1;

  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(angle);

  // Missile body -- elongated with nose cone
  ctx.shadowColor=col; ctx.shadowBlur=14;

  // Engine exhaust glow
  const exhaust=ctx.createRadialGradient(-missileLen*0.6,0,0,-missileLen*0.6,0,missileLen*0.5);
  exhaust.addColorStop(0,"rgba(255,180,0,0.9)");
  exhaust.addColorStop(0.4,"rgba(255,80,0,0.5)");
  exhaust.addColorStop(1,"transparent");
  ctx.fillStyle=exhaust;
  ctx.beginPath();ctx.arc(-missileLen*0.6,0,missileLen*0.5,0,Math.PI*2);ctx.fill();

  // Missile body
  const bodyGrad=ctx.createLinearGradient(-missileLen,0,missileLen*0.3,0);
  bodyGrad.addColorStop(0,col+"44");
  bodyGrad.addColorStop(0.5,col);
  bodyGrad.addColorStop(1,"#ffffff");
  ctx.fillStyle=bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0,0,missileLen*0.5,b.r*0.7,0,0,Math.PI*2);
  ctx.fill();

  // Nose tip
  ctx.fillStyle="#ffffff";
  ctx.shadowBlur=8;
  ctx.beginPath();ctx.arc(missileLen*0.4,0,2.5,0,Math.PI*2);ctx.fill();

  ctx.shadowBlur=0;
  ctx.restore();
}
function drawPU(p) {
  const x=wx(p.x), y=wy(p.y);
  if(x<-30||x>canvas.width+30||y<-30||y>canvas.height+30) return;
  p.angle+=.03;
  const gr=ctx.createRadialGradient(x,y,2,x,y,p.r+12); gr.addColorStop(0,p.colorHex+"99"); gr.addColorStop(1,"transparent");
  ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(x,y,p.r+12,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=.85+Math.sin(Date.now()/200)*.12; ctx.strokeStyle=p.colorHex; ctx.lineWidth=2; ctx.fillStyle=p.colorHex+"22";
  ctx.beginPath(); ctx.arc(x,y,p.r,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.globalAlpha=1;
  ctx.font=`${p.r+2}px serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(p.icon,x,y+1);
}
function drawBoss() {
  const b=G.boss; if(!b) return;
  const x=wx(b.x), y=wy(b.y);

  // Calculate damage state for visual effects
  const healthPct = b.hp / b.maxHp;
  const damageState = healthPct > 0.75 ? 'healthy' : 
                     healthPct > 0.5 ? 'damaged' : 
                     healthPct > 0.25 ? 'critical' : 'dying';

  // Enhanced glow aura for better visibility - changes with damage
  const glowIntensity = damageState === 'dying' ? '88' : 
                       damageState === 'critical' ? '77' : 
                       damageState === 'damaged' ? '66' : '55';
  const glow=ctx.createRadialGradient(x,y,b.r*.5,x,y,b.r*2.5);
  glow.addColorStop(0,b.colorHex+glowIntensity);
  glow.addColorStop(1,"transparent");
  ctx.fillStyle=glow; 
  ctx.beginPath(); 
  ctx.arc(x,y,b.r*2.5,0,Math.PI*2);
  ctx.fill();

  // Damage sparks and smoke effects
  if (damageState === 'critical' || damageState === 'dying') {
    // Add damage sparks
    if (Math.random() < 0.3) {
      const sparkX = x + (Math.random() - 0.5) * b.r * 1.5;
      const sparkY = y + (Math.random() - 0.5) * b.r * 1.5;
      ctx.fillStyle = '#ffaa00';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 2 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Boss image: level 3 = Boss.png, level 5 = boss2.png, level 7+ = boss3.png
  var bossImgIdx = 0;
  if (b.name === "VOID EMPEROR") bossImgIdx = 1;
  if (G.level >= 7 || b.enraged) bossImgIdx = 2;
  var bImg = _bossImgs[bossImgIdx % _bossImgs.length];

  if (bImg && bImg.complete && bImg.naturalWidth > 0) {
    // Significantly increased boss size for better visibility
    var sz = b.r * 3.2;
    ctx.save();
    ctx.translate(x, y);
    
    // Damage-based visual effects
    if (damageState === 'dying') {
      // Flickering effect when dying
      ctx.globalAlpha = 0.7 + Math.sin(Date.now() / 50) * 0.3;
    } else if (damageState === 'critical') {
      // Red tint when critical
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
      ctx.fillRect(-sz/2, -sz/2, sz, sz);
    }
    
    // Enraged: pulse scale
    if (b.enraged) {
      var pulse = 1 + Math.sin(Date.now()/80) * 0.08;
      ctx.scale(pulse, pulse);
    }
    
    ctx.shadowColor = b.colorHex;
    ctx.shadowBlur = b.enraged ? 50 : 30;
    
    // High quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bImg, -sz/2, -sz/2, sz, sz);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  } else {
    // Fallback vector boss - also increased size with damage effects
    const bg=ctx.createRadialGradient(x-b.r*.2,y-b.r*.2,b.r*.1,x,y,b.r);
    const baseColor = b.enraged ? "#ff4400" : "#444";
    const damageColor = damageState === 'critical' ? "#ff2200" : 
                       damageState === 'dying' ? "#ff0000" : baseColor;
    bg.addColorStop(0, damageColor); 
    bg.addColorStop(1,"#111");
    ctx.fillStyle=bg; 
    ctx.beginPath(); 
    ctx.moveTo(x+b.pts[0].x*1.4,y+b.pts[0].y*1.4);
    b.pts.forEach(p=>ctx.lineTo(x+p.x*1.4,y+p.y*1.4)); 
    ctx.closePath(); 
    ctx.fill();
    
    // Damage-based outline
    const outlineColor = damageState === 'dying' ? "#ff0000" : 
                        damageState === 'critical' ? "#ff4400" : b.colorHex;
    ctx.strokeStyle = outlineColor + (b.enraged ? "ff" : "88"); 
    ctx.lineWidth = b.enraged ? 4 : 3;
    ctx.beginPath(); 
    ctx.moveTo(x+b.pts[0].x*1.4,y+b.pts[0].y*1.4);
    b.pts.forEach(p=>ctx.lineTo(x+p.x*1.4,y+p.y*1.4)); 
    ctx.closePath(); 
    ctx.stroke();
    
    ctx.fillStyle = outlineColor; 
    ctx.shadowColor = outlineColor; 
    ctx.shadowBlur = 25;
    ctx.beginPath(); 
    ctx.arc(x,y,b.r*.3,0,Math.PI*2);
    ctx.fill(); 
    ctx.shadowBlur=0;
  }

  // Compact Boss Health Bar - smaller and less intrusive
  const barW = Math.min(canvas.width * 0.4, 280); // Smaller width
  const barH = 8; // Thinner bar
  const barX = x - barW/2;
  const barY = y - b.r - 50; // Closer to boss
  
  // Background with border
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(barX-2, barY-2, barW+4, barH+4);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX-2, barY-2, barW+4, barH+4);
  
  // Health bar segments for better visibility
  const segments = 8; // Fewer segments
  const segmentWidth = barW / segments;
  const filledSegments = Math.ceil((b.hp / b.maxHp) * segments);
  
  for (let i = 0; i < segments; i++) {
    const segX = barX + i * segmentWidth;
    const isFilled = i < filledSegments;
    
    if (isFilled) {
      // Color based on health percentage
      const segmentColor = healthPct > 0.6 ? "#00ff88" : 
                          healthPct > 0.3 ? "#ffcc00" : "#ff2244";
      ctx.fillStyle = segmentColor;
      ctx.shadowColor = segmentColor;
      ctx.shadowBlur = 3; // Reduced glow
      ctx.fillRect(segX, barY, segmentWidth-1, barH);
      ctx.shadowBlur = 0;
    } else {
      // Empty segment
      ctx.fillStyle = "rgba(100,100,100,0.2)";
      ctx.fillRect(segX, barY, segmentWidth-1, barH);
    }
  }
  
  // Boss name and health text - smaller font
  ctx.font = "bold 11px Orbitron,monospace";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.shadowColor = "#000000";
  ctx.shadowBlur = 2;
  
  // Boss name with damage state indicator
  const stateText = damageState === 'dying' ? " [CRITICAL]" : 
                   damageState === 'critical' ? " [DAMAGED]" : 
                   b.enraged ? " [ENRAGED]" : "";
  ctx.fillText(`${b.name}${stateText}`, x, barY - 6);
  
  // Health numbers
  ctx.font = "bold 11px Orbitron,monospace";
  ctx.fillText(`${b.hp}/${b.maxHp} HP`, x, barY + barH + 18);
  ctx.shadowBlur = 0;
  ctx.textAlign = "left";
}
function drawParticles() {
  G.particles.forEach(p=>{
    const x=wx(p.x), y=wy(p.y);
    if(x<-60||x>canvas.width+60||y<-60||y>canvas.height+60) return;

    if(p.type==="ring"){
      // Expanding shockwave ring
      const progress = 1 - p.life;
      const currentR = p.r + (p.maxR - p.r) * progress;
      ctx.globalAlpha = p.life * 0.7;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3 * p.life;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12 * p.life;
      ctx.beginPath(); ctx.arc(x,y,currentR,0,Math.PI*2); ctx.stroke();
      ctx.shadowBlur=0;
    } else if(p.type==="smoke"){
      // Smoke: large, dark, expands slightly
      ctx.globalAlpha = Math.max(0, p.life * 0.5);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(x,y,p.r*(2-p.life),0,Math.PI*2); ctx.fill();
    } else if(p.type==="fire"){
      // Fire: bright, flickers
      const flicker = 0.8 + Math.random()*0.2;
      ctx.globalAlpha = Math.max(0,p.life) * flicker;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8 * p.life;
      ctx.beginPath(); ctx.arc(x,y,p.r,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    } else {
      // Default debris
      ctx.globalAlpha = Math.max(0,p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.arc(x,y,p.r,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    }
  });
  ctx.globalAlpha=1; ctx.shadowBlur=0;
}

//  THRUST TRAIL 
function spawnThrustParticle() {
  const angle=G.ship.angle+Math.PI, spread=(Math.random()-.5)*.6, spd=2+Math.random()*2;
  G.thrustTrail.push({x:G.ship.x+Math.cos(angle+spread)*18,y:G.ship.y+Math.sin(angle+spread)*18,vx:Math.cos(angle+spread)*spd+G.ship.vx*.3,vy:Math.sin(angle+spread)*spd+G.ship.vy*.3,r:3+Math.random()*3,life:1,hot:Math.random()>.5});
}
function drawThrustTrail() {
  const color=SKIN_COLORS[window.selectedSkin||0];
  for(let i=G.thrustTrail.length-1;i>=0;i--){
    const t=G.thrustTrail[i]; t.x+=t.vx; t.y+=t.vy; t.life-=0.06; t.r*=0.92;
    if(t.life<=0){G.thrustTrail.splice(i,1);continue;}
    ctx.globalAlpha=t.life*0.7; ctx.fillStyle=t.hot?color:"rgba(255,140,0,0.6)";
    ctx.shadowColor=color; ctx.shadowBlur=6;
    ctx.beginPath(); ctx.arc(wx(t.x),wy(t.y),t.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1; ctx.shadowBlur=0;
}
//  HIT MARKERS 
function spawnHitMarker(x,y,color) {
  for(let i=0;i<5;i++){const a=Math.random()*Math.PI*2,spd=2+Math.random()*3;G.hitMarkers.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:1,color:color||"#fff"});}
}
function drawHitMarkers() {
  for(let i=G.hitMarkers.length-1;i>=0;i--){
    const h=G.hitMarkers[i]; h.x+=h.vx; h.y+=h.vy; h.life-=0.1;
    if(h.life<=0){G.hitMarkers.splice(i,1);continue;}
    ctx.globalAlpha=h.life; ctx.fillStyle=h.color; ctx.shadowColor=h.color; ctx.shadowBlur=4;
    ctx.beginPath(); ctx.arc(wx(h.x),wy(h.y),2,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1; ctx.shadowBlur=0;
}
// -- SPEED LINES --
function updateSpeedLines() {
  const spd=Math.hypot(G.ship.vx,G.ship.vy);
  if(spd>4&&G.frame%3===0){G.speedLines.push({x:G.camX+Math.random()*canvas.width,y:G.camY+Math.random()*canvas.height,len:20+spd*8,angle:Math.atan2(G.ship.vy,G.ship.vx),life:1,alpha:Math.min(1,(spd-4)/6)*0.35});}
  for(let i=G.speedLines.length-1;i>=0;i--){G.speedLines[i].life-=0.15;if(G.speedLines[i].life<=0)G.speedLines.splice(i,1);}
}
function drawSpeedLines() {
  G.speedLines.forEach(s=>{ctx.globalAlpha=s.life*s.alpha;ctx.strokeStyle="#aaddff";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(wx(s.x),wy(s.y));ctx.lineTo(wx(s.x)-Math.cos(s.angle)*s.len,wy(s.y)-Math.sin(s.angle)*s.len);ctx.stroke();});ctx.globalAlpha=1;
}
//  DANGER PINGS 
function drawDangerPings() {
  const W=canvas.width,H=canvas.height,cx=W/2,cy=H/2,margin=36;
  const threats=[...G.enemyShips,...G.asteroids.filter(a=>a.r>20)];
  if(G.boss)threats.push(G.boss);
  threats.forEach(e=>{
    const ex=wx(e.x),ey=wy(e.y);
    if(ex>-20&&ex<W+20&&ey>-20&&ey<H+20)return;
    const dx=ex-cx,dy=ey-cy,angle=Math.atan2(dy,dx),tx=Math.cos(angle),ty=Math.sin(angle);
    const scale=Math.min((cx-margin)/Math.abs(tx||.001),(cy-margin)/Math.abs(ty||.001));
    const px=cx+tx*scale,py=cy+ty*scale,pulse=0.5+Math.sin(Date.now()/200+e.x)*.5;
    ctx.save();ctx.translate(px,py);ctx.rotate(angle);ctx.globalAlpha=0.5+pulse*0.4;
    ctx.fillStyle=e.colorHex||e.accent||"#ff3355";ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=8;
    ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-6,-6);ctx.lineTo(-6,6);ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;ctx.restore();
  });ctx.globalAlpha=1;
}
//  MINIMAP 
function drawMinimap() {
  const W=canvas.width,H=canvas.height,mw=110,mh=70,mx=W-mw-10,my=H-mh-10,range=W*1.8;
  ctx.globalAlpha=0.75;ctx.fillStyle="rgba(0,4,18,0.85)";ctx.strokeStyle="rgba(0,245,255,0.25)";ctx.lineWidth=1;
  // Draw rounded rect manually (roundRect not available on all Android WebView versions)
  const r=6;ctx.beginPath();ctx.moveTo(mx+r,my);ctx.lineTo(mx+mw-r,my);ctx.arcTo(mx+mw,my,mx+mw,my+r,r);ctx.lineTo(mx+mw,my+mh-r);ctx.arcTo(mx+mw,my+mh,mx+mw-r,my+mh,r);ctx.lineTo(mx+r,my+mh);ctx.arcTo(mx,my+mh,mx,my+mh-r,r);ctx.lineTo(mx,my+r);ctx.arcTo(mx,my,mx+r,my,r);ctx.closePath();ctx.fill();ctx.stroke();
  const toMM=(wx2,wy2)=>({x:mx+mw/2+(wx2-G.ship.x)/range*mw,y:my+mh/2+(wy2-G.ship.y)/range*mh});
  const inMM=(p)=>p.x>mx&&p.x<mx+mw&&p.y>my&&p.y<my+mh;
  ctx.fillStyle="rgba(180,120,60,0.7)";G.asteroids.forEach(a=>{const p=toMM(a.x,a.y);if(inMM(p)){ctx.beginPath();ctx.arc(p.x,p.y,1.5,0,Math.PI*2);ctx.fill();}});
  ctx.fillStyle="#ff3355";G.enemyShips.forEach(e=>{const p=toMM(e.x,e.y);if(inMM(p)){ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,Math.PI*2);ctx.fill();}});
  if(G.boss){const p=toMM(G.boss.x,G.boss.y);if(inMM(p)){ctx.fillStyle=G.boss.colorHex;ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();}}
  ctx.fillStyle="#00ff88";G.powerups.forEach(p2=>{const p=toMM(p2.x,p2.y);if(inMM(p)){ctx.beginPath();ctx.arc(p.x,p.y,2,0,Math.PI*2);ctx.fill();}});
  const color=SKIN_COLORS[window.selectedSkin||0];ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=6;
  ctx.beginPath();ctx.arc(mx+mw/2,my+mh/2,3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1;
}
//  ASTEROID HP BARS 
function drawAsteroidHP(a) {
  if(a.maxHp<=1)return;
  const x=wx(a.x),y=wy(a.y),bw=a.r*2,bh=4,bx=x-bw/2,by=y-a.r-10;
  ctx.fillStyle="rgba(0,0,0,0.5)";ctx.fillRect(bx,by,bw,bh);
  const pct=a.hp/a.maxHp;ctx.fillStyle=pct>.6?"#00ff88":pct>.3?"#ffd60a":"#ff2244";ctx.fillRect(bx,by,bw*pct,bh);
}
function drawHUD() {
  const W=canvas.width, H=canvas.height, cx=W/2;
  // combo
  if(G.combo>2){const col=G.combo>=6?"#ff006e":"#ffd60a";ctx.font=`bold ${14+G.combo*2}px Orbitron,monospace`;ctx.fillStyle=col;ctx.textAlign="center";ctx.shadowColor=col;ctx.shadowBlur=16;ctx.globalAlpha=.8;ctx.fillText(` COMBO x${G.combo}`,cx,84);ctx.globalAlpha=1;ctx.shadowBlur=0;}
  // active effects
  const fx=[];
  if(G.rapidFire)fx.push({l:` RAPID ${(G.rapidTimer/60).toFixed(0)}s`,c:"#ff6400"});
  if(G.slowTime) fx.push({l:`T SLOW ${(G.slowTimer/60).toFixed(0)}s`,c:"#b400ff"});
  if(G.magnet)   fx.push({l:` MAGNET ${(G.magnetTimer/60).toFixed(0)}s`,c:"#ffaa00"});
  fx.forEach((e,i)=>{ctx.font="bold 11px Orbitron,monospace";ctx.fillStyle=e.c;ctx.textAlign="left";ctx.shadowColor=e.c;ctx.shadowBlur=7;ctx.fillText(e.l,14,84+i*22);});
  ctx.shadowBlur=0; ctx.textAlign="center";
  // slow vignette
  if(G.slowTime){const vg=ctx.createRadialGradient(cx,H/2,H*.3,cx,H/2,H*.85);vg.addColorStop(0,"transparent");vg.addColorStop(1,"rgba(80,0,160,.13)");ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);}
  // low shield vignette  pulsing red edge
  if(G.shield<30&&!G.invincible){
    const pulse=0.5+Math.sin(Date.now()/120)*0.5;
    const vg=ctx.createRadialGradient(cx,H/2,H*.4,cx,H/2,H*.9);
    vg.addColorStop(0,"transparent");
    vg.addColorStop(1,`rgba(255,0,60,${0.12+pulse*0.1})`);
    ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
  }
  // boss bar
  if(G.boss){const b=G.boss,bw=Math.min(W*.6,380),bx=cx-bw/2,by=H-44;
    ctx.fillStyle="rgba(0,0,0,.7)";ctx.fillRect(bx-2,by-18,bw+4,34);
    // health bar gradient
    const hpPct=b.hp/b.maxHp;
    const hg=ctx.createLinearGradient(bx,0,bx+bw,0);
    if(b.enraged){hg.addColorStop(0,"#ff0000");hg.addColorStop(1,"#ff4400");}
    else{hg.addColorStop(0,b.colorHex);hg.addColorStop(1,b.colorHex+"88");}
    ctx.fillStyle=hg;ctx.fillRect(bx,by-14,hpPct*bw,24);
    // enraged pulse
    if(b.enraged){ctx.strokeStyle=`rgba(255,0,0,${0.4+Math.sin(Date.now()/80)*0.4})`;ctx.lineWidth=2;ctx.strokeRect(bx,by-14,hpPct*bw,24);}
    ctx.font="bold 11px Orbitron,monospace";ctx.fillStyle="#fff";ctx.textAlign="center";
    ctx.fillText(` ${b.name}  ${b.hp}/${b.maxHp}${b.enraged?"  ENRAGED":""}`,cx,by+4);
  }
  // wave counter
  ctx.font="10px Orbitron,monospace"; ctx.fillStyle="rgba(0,245,255,.2)"; ctx.textAlign="right"; ctx.fillText(`WAVE ${Math.floor(G.frame/300)+1}`,W-10,80); ctx.textAlign="center";
  // flash
  if(G.flashA>0&&G.flashCol){ctx.fillStyle=G.flashCol;ctx.globalAlpha=G.flashA;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
  // invincibility indicator
  if(G.invincible&&Math.floor(Date.now()/200)%2===0){
    ctx.font="bold 12px Orbitron,monospace";ctx.fillStyle="#00f5ff";ctx.textAlign="center";
    ctx.shadowColor="#00f5ff";ctx.shadowBlur=10;ctx.globalAlpha=0.7;
    ctx.fillText("INVINCIBLE",cx,H-70);ctx.globalAlpha=1;ctx.shadowBlur=0;
  }
}

// ─── MAIN GAME LOOP ───────────────────────────────────────────────────────────

// Called every animation frame via requestAnimationFrame.
// Handles: spawning, timers, movement, collision, drawing, and level-up checks.
function gameLoop() {
  if(!G.running) return;
  if(!canvasReady()) {
    return;
  }
  
  G.frameId = requestAnimationFrame(gameLoop);
  if(G.paused) return;

  G.frame++;
  if (G.frame % 30 === 0) updateMissionPanel();
  const lc=getLvl(), sp=G.slowTime?.35:1;
  const W=canvas.width, H=canvas.height;

  // spawn
  if(!G.bossActive&&G.frame%lc.spawnRate===0) spawnAsteroid();
  else if(G.bossActive&&G.frame%(lc.spawnRate*2)===0) spawnAsteroid(true);
  if(G.frame%Math.max(48,128-G.level*12)===0&&G.enemyShips.length<(G.bossActive?3:6)) spawnEnemy();
  if(G.frame%220===0) spawnPU();

  // timers
  if(G.rapidFire){G.rapidTimer--;if(G.rapidTimer<=0){G.rapidFire=false;updateAmmoHUD();}}
  if(G.slowTime){G.slowTimer--;if(G.slowTimer<=0)G.slowTime=false;}
  if(G.magnet){G.magnetTimer--;if(G.magnetTimer<=0)G.magnet=false;}
  if(G.invincible){G.invTimer--;if(G.invTimer<=0)G.invincible=false;}
  if(G.shootCD>0) G.shootCD--;

  // fire
  if(G.keys.fire&&(window.NS?.autofire!==false||G.keys.firePulse)){fireShot();G.keys.firePulse=false;}

  // ship movement -- natural, responsive, input-driven rotation
  const sens    = window.NS?.sensitivity || 5;
  const speedBonus = (window.NS && window.NS.shipSpeedBonus) ? window.NS.shipSpeedBonus : 0;
  const accel   = 0.9  + sens * 0.10 + speedBonus * 0.08;
  const maxSpd  = 9    + sens * 0.55 + speedBonus * 0.6;
  const friction = 0.88;

  // Track which direction the player is actively pressing
  var inputX = 0, inputY = 0;
  if(G.keys.left)  inputX -= 1;
  if(G.keys.right) inputX += 1;
  if(G.keys.up)    inputY -= 1;
  if(G.keys.down)  inputY += 1;

  // Apply acceleration in pressed direction
  if(G.keys.left)  G.ship.vx -= accel;
  if(G.keys.right) G.ship.vx += accel;
  if(G.keys.up)   { G.ship.vy -= accel; sfx.thrust(); }
  if(G.keys.down)  G.ship.vy += accel;

  // Friction when no input on that axis
  if(!G.keys.left  && !G.keys.right) G.ship.vx *= friction;
  if(!G.keys.up    && !G.keys.down)  G.ship.vy *= friction;

  const spd = Math.hypot(G.ship.vx, G.ship.vy);
  if(spd > maxSpd){ G.ship.vx *= maxSpd/spd; G.ship.vy *= maxSpd/spd; }
  if(Math.abs(G.ship.vx) < 0.04) G.ship.vx = 0;
  if(Math.abs(G.ship.vy) < 0.04) G.ship.vy = 0;

  // Rotation: face the direction the player is PRESSING (input-driven)
  // This feels natural -- ship points where you push, not where it drifts
  if(inputX !== 0 || inputY !== 0) {
    // Target angle = direction of input
    const tgt  = Math.atan2(inputY, inputX);
    let   diff = tgt - G.ship.angle;
    while(diff >  Math.PI) diff -= Math.PI * 2;
    while(diff < -Math.PI) diff += Math.PI * 2;
    // Smooth turn: fast enough to feel responsive, slow enough to look natural
    // 0.12 = snappy but not instant; feels like a real spacecraft banking
    G.ship.angle += diff * 0.12;
  }
  // When no input, ship holds its current angle (doesn't drift-rotate)

  // Move -- infinite world, no clamping
  G.ship.x += G.ship.vx * sp;
  G.ship.y += G.ship.vy * sp;

  // camera lerp toward ship
  G.camX += (G.ship.x - W/2 - G.camX) * 0.1;
  G.camY += (G.ship.y - H/2 - G.camY) * 0.1;

  // shake
  if(G.shake.active){G.shake.timer--;G.shake.intensity*=.85;if(G.shake.timer<=0)G.shake.active=false;else{G.camX+=(Math.random()-.5)*G.shake.intensity*2;G.camY+=(Math.random()-.5)*G.shake.intensity*2;}}

  // flash decay
  if(G.flashA>0) G.flashA-=.04;

  // thrust trail
  if((G.keys.up||G.keys.down||G.keys.left||G.keys.right)&&G.frame%2===0) spawnThrustParticle();

  // speed lines
  updateSpeedLines();

  // combo decay  reset after 3 seconds of no kill
  if(G.combo>1){G.comboDecay++;if(G.comboDecay>180){G.combo=1;G.comboDecay=0;updateComboHUD();}}
  else G.comboDecay=0;

  // shield regen  +1 every 4 seconds when not hit
  if(G.shield<100&&!G.invincible){G.shieldRegen++;if(G.shieldRegen>=240){G.shield=Math.min(100,G.shield+1);G.shieldRegen=0;updateShieldBar();}}
  else if(G.invincible) G.shieldRegen=0;

  // move asteroids
  for(let i=G.asteroids.length-1;i>=0;i--){const a=G.asteroids[i];a.x+=a.vx*sp;a.y+=a.vy*sp;a.rot+=a.rs;if(Math.hypot(a.x-G.ship.x,a.y-G.ship.y)>W*2.5)G.asteroids.splice(i,1);}

  // move enemies
  for(let i=G.enemyShips.length-1;i>=0;i--){
    const e=G.enemyShips[i]; e.bank+=.045; e.vx+=Math.sin(e.bank*.8)*.075;
    e.x+=e.vx*sp; e.y+=e.vy*sp; e.shootCd--;
    const ex=wx(e.x),ey=wy(e.y);
    if(e.shootCd<=0&&ex>0&&ex<W&&ey>0&&ey<H){fireEnemyBolt(e);sfx.enemyShoot();e.shootCd=e.shootInterval;}
    if(Math.hypot(e.x-G.ship.x,e.y-G.ship.y)>W*2.5) G.enemyShips.splice(i,1);
  }

  // move player bullets  straight, fast, no homing
  for(let i=G.bullets.length-1;i>=0;i--){
    const b=G.bullets[i];
    b.x+=b.vx;
    b.y+=b.vy;
    // Remove if off screen (bullets are fast so use screen bounds)
    const bx=wx(b.x), by=wy(b.y);
    if(bx<-40||bx>canvas.width+40||by<-40||by>canvas.height+40) G.bullets.splice(i,1);
  }

  // move enemy/boss bullets
  for(let i=G.enemyBullets.length-1;i>=0;i--){const b=G.enemyBullets[i];b.x+=b.vx*sp;b.y+=b.vy*sp;if(Math.hypot(b.x-G.ship.x,b.y-G.ship.y)>W*1.5)G.enemyBullets.splice(i,1);}
  for(let i=G.bossBullets.length-1;i>=0;i--){const b=G.bossBullets[i];b.x+=b.vx*sp;b.y+=b.vy*sp;if(Math.hypot(b.x-G.ship.x,b.y-G.ship.y)>W*1.5)G.bossBullets.splice(i,1);}

  // move powerups
  G.powerups.forEach(p=>{p.x+=p.vx;p.y+=p.vy;});

  // boss
  if(G.boss) updateBoss();

  // collisions
  collide();

  // level up
  checkLevelUp();

  // passive score + playtime
  if(G.frame%60===0){addScore(G.level*G.mult);G.surviveSec++;const d=window.loadData&&loadData();window.saveData&&saveData({totalSeconds:(d.totalSeconds||0)+1});}
  if(G.frame%600===0&&G.score>0){const d=window.loadData&&loadData();window.saveData&&saveData({bestScore:Math.max(d.bestScore||0,G.score),bestLevel:Math.max(d.bestLevel||1,G.level),lastRun:{score:G.score,level:G.level,time:G.surviveSec,asteroids:G.asteroidsKilled,maxCombo:G.maxCombo}});window.refreshMenuStats&&refreshMenuStats();}

  // particles
  for(let i=G.particles.length-1;i>=0;i--){
    const p=G.particles[i];
    p.x+=p.vx; p.y+=p.vy;
    // Gravity only on debris/fire, not ring/smoke
    if(p.type!=="ring"&&p.type!=="smoke") p.vy+=0.04;
    // Drag on fire particles
    if(p.type==="fire"){ p.vx*=0.96; p.vy*=0.96; }
    p.life-=p.decay;
    if(p.life<=0) G.particles.splice(i,1);
  }

  //  RENDER 
  ctx.save();
  drawBg();
  drawStars();
  G.asteroids.forEach(drawAsteroid);
  G.enemyShips.forEach(drawEnemy);
  G.powerups.forEach(drawPU);
  G.bullets.forEach(drawBullet);
  G.enemyBullets.forEach(drawEnemyBullet);
  G.bossBullets.forEach(b=>{const x=wx(b.x),y=wy(b.y);ctx.fillStyle=b.color||"#ff4400";ctx.shadowColor=b.color||"#ff4400";ctx.shadowBlur=14;ctx.beginPath();ctx.arc(x,y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;});
  if(G.boss) drawBoss();
  drawSpeedLines();
  drawThrustTrail();
  drawShip();
  drawParticles();
  drawHitMarkers();
  G.asteroids.forEach(drawAsteroidHP);
  drawDangerPings();
  drawMinimap();
  drawHUD();
  ctx.restore();
}

//  END GAME 
function endGame() {
  G.running=false; stopMusic(); cancelAnimationFrame(G.frameId);
  const time=G.surviveSec, best=window.getBestScore?getBestScore():0, isNew=G.score>best;
  if(G.score>0&&window.addScoreEntry) addScoreEntry(G.score,G.level,time);
  const d=window.loadData&&loadData();
  window.saveData&&saveData({
    maxTime:Math.max(d.maxTime||0,time),
    maxCombo:Math.max(d.maxCombo||0,G.maxCombo),
    totalAst:(d.totalAst||0)+G.asteroidsKilled,
    totalPU:(d.totalPU||0)+G.puCollected,
    bossKills:(d.bossKills||0)+G.bossKills,
    // Save weapon and reward data
    coins: G.coins || 0,
    experience: G.experience || 0,
    weaponsUnlocked: G.weaponsUnlocked || ["basic"],
    lastRun:{score:G.score,level:G.level,time,asteroids:G.asteroidsKilled,maxCombo:G.maxCombo}
  });
  window.checkAchievements&&checkAchievements();
  document.getElementById("mobileControls")?.classList.remove("visible");
  // Play game over sound
  if(window.NS?.sfx!==false){
    try{
      const c=getAudio();
      [400,320,240,180].forEach((f,i)=>{
        osc(f,"sawtooth",0.4,0.15,i*0.12,f*0.5);
      });
      noise(0.5,0.3,0.1,400);
    }catch(e){}
  }
  window.showGameOver&&showGameOver({score:G.score,level:G.level,time,asteroids:G.asteroidsKilled,maxCombo:G.maxCombo,isNewBest:isNew});
}

// ─── COUNTDOWN ───────────────────────────────────────────────────────────────

// Show the 3-2-1 countdown overlay before the game loop starts.
// Calls `cb` when the countdown reaches zero.
// If the overlay elements are missing, fires the callback immediately.
function runCountdown(cb) {
  const ov  = document.getElementById("overlayCountdown");
  const num = document.getElementById("countdownNum");
  // If overlay elements are missing, just fire the callback immediately
  if (!ov || !num) { cb(); return; }
  let n = 3;
  ov.classList.remove("hidden");
  num.textContent = n;
  const id = setInterval(() => {
    n--;
    if (n <= 0) {
      clearInterval(id);
      ov.classList.add("hidden");
      cb();
      return;
    }
    num.textContent = n;
    num.style.animation = "none";
    void num.offsetWidth;
    num.style.animation = "countPop .9s cubic-bezier(.22,1,.36,1)";
  }, 900);
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

// Entry point called by style.js's launchGame().
// Wraps _startGameInner in a try/catch so any crash is logged and the
// player is returned to the menu rather than seeing a frozen screen.
function startGame(forceLevel) {
  try {
    _startGameInner(forceLevel);
  } catch(err) {
    console.error("startGame crashed:", err);
    // Try to at least show the game screen so the user isn't stuck
    if (typeof window.showScreen === "function") window.showScreen("menu");
  }
}

// The real game initialisation logic, separated from startGame() so the
// try/catch wrapper above can catch any error without nesting issues.
function _startGameInner(forceLevel) {
  // Initialize canvas first
  if (!initCanvas()) {
    console.error("Game canvas not found!");
    return;
  }

  initCanvasEvents();
  resizeCanvas();

  const startLv = forceLevel || window._startLevel || 1;

  if (G.frameId) cancelAnimationFrame(G.frameId);
  stopMusic();

  // Apply ship stat bonuses from selected ship
  if (window.applyShipStats) window.applyShipStats(window.selectedSkin || 0);
  var shipShield = 100 + (window.NS && window.NS.shipShieldBonus ? window.NS.shipShieldBonus : 0);

  // Load saved weapon and reward data
  const savedData = window.loadData ? window.loadData() : {};
  const savedCoins   = savedData.coins   || 0;
  const savedXP      = savedData.experience || 0;
  const savedWeapons = savedData.weaponsUnlocked || ["basic"];

  Object.assign(G, {
    running:false, paused:false,
    score:0, level:startLv, lives:3, shield:Math.max(50, shipShield),
    combo:1, maxCombo:1, asteroidsKilled:0,
    surviveSec:0, frame:0, mult:1,
    rapidFire:false, rapidTimer:0,
    slowTime:false,  slowTimer:0,
    magnet:false, magnetTimer:0,
    bossActive:false, bossSpawned:false,
    invincible:false, invTimer:0,
    shootCD:0, puCollected:0, bossKills:0,
    coins: savedCoins,
    experience: savedXP,
    weaponsUnlocked: savedWeapons,
    weaponType: "basic",
    ship:{x:canvas.width/2, y:canvas.height*.65, vx:0, vy:0, angle:-Math.PI/2},
    asteroids:[], bullets:[], bossBullets:[],
    enemyShips:[], enemyBullets:[],
    powerups:[], particles:[],
    boss:null,
    thrustTrail:[], hitMarkers:[], dangerPings:[], speedLines:[],
    comboDecay:0, shieldRegen:0,
    keys:{left:false,right:false,up:false,down:false,fire:false,firePulse:false},
    shake:{active:false,timer:0,intensity:0},
    camX:0, camY:0,
    flashCol:null, flashA:0, frameId:null,
  });

  initStars();

  // Apply reward perks from shop
  if (window.getActivePerk) {
    if (window.getActivePerk("shield_boost"))     { G.shield = 150; }
    if (window.getActivePerk("extra_life"))       { G.lives = 4; }
    if (window.getActivePerk("rapid_start"))      { G.rapidFire = true; G.rapidTimer = 600; }
    if (window.getActivePerk("magnet_perk"))      { G.magnet = true; G.magnetTimer = 99999; }
    if (window.getActivePerk("invincible_start")) { G.invincible = true; G.invTimer = 300; }
    if (window.getActivePerk("score_boost"))      { G.mult = 1.5; }
    if (window.getActivePerk("nova_start")) {
      G.powerups.push({x:G.ship.x+60,y:G.ship.y,vy:0,vx:0,r:14,angle:0,
        type:"nova",colorHex:"#00ffcc",icon:"N",label:"NOVA BOMB",w:5});
    }
  }

  updateLevelHUD(); updateLivesHUD(); updateShieldBar(); updateComboHUD(); updateMissionPanel(); updateWeaponHUD(); updateRewardHUD();

  var scoreEl = document.getElementById("gnScore");
  if (scoreEl) scoreEl.textContent = "0";
  var ammoEl = document.getElementById("gnAmmo");
  if (ammoEl) ammoEl.textContent = "";

  const bonusStat = document.getElementById("bonusStat");
  if (bonusStat) { bonusStat.classList.add("d-none"); bonusStat.classList.remove("d-flex"); }

  ["overlayPause","overlayLevelUp","overlayBoss","overlayCountdown"].forEach(id => {
    var el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });

  const pb = document.getElementById("gnPause");
  if (pb) pb.innerHTML = '<i class="fas fa-pause"></i>';

  // Switch to game screen
  if (typeof window.showScreen === "function") {
    window.showScreen("game");
  }

  startMusic();

  // Save games-played count
  if (window.loadData && window.saveData) {
    const d = window.loadData();
    window.saveData({ gamesPlayed: (d.gamesPlayed || 0) + 1 });
  }

  runCountdown(() => {
    G.running = true;
    G.frameId = requestAnimationFrame(gameLoop);
    const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    if (window.NS?.mobile || isTouch) {
      var mc = document.getElementById("mobileControls");
      if (mc) mc.classList.add("visible");
    }
  });
}
window.startGame=startGame;

function togglePause() {
  G.paused = !G.paused;
  var op = document.getElementById("overlayPause");
  if (op) op.classList.toggle("hidden", !G.paused);
  const pb = document.getElementById("gnPause");
  if (pb) pb.innerHTML = G.paused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
  if (G.paused) stopMusic(); else startMusic();
}
window.togglePause=togglePause;

function quitGame() {
  G.running=false; G.paused=false; stopMusic(); cancelAnimationFrame(G.frameId);
  document.getElementById("overlayPause")?.classList.add("hidden");
  document.getElementById("mobileControls")?.classList.remove("visible");
  window.showScreen("menu");
}
window.quitGame=quitGame;

//  KEYBOARD 
document.addEventListener("keydown",e=>{
  if(e.key==="ArrowLeft" ||e.key==="a") G.keys.left=true;
  if(e.key==="ArrowRight"||e.key==="d") G.keys.right=true;
  if(e.key==="ArrowUp"   ||e.key==="w") G.keys.up=true;
  if(e.key==="ArrowDown" ||e.key==="s") G.keys.down=true;
  if(e.key===" "){G.keys.fire=true;G.keys.firePulse=true;e.preventDefault();}
  if(e.key==="p"||e.key==="P"){if(G.running)togglePause();}
  if(e.key==="m"||e.key==="M") document.getElementById("gnMute")?.click();
  if((e.key==="r"||e.key==="R")&&!G.running) window.launchGame&&launchGame();
  if(e.key==="Escape"&&G.running) quitGame();
  if((e.key==="q"||e.key==="Q")&&G.running&&window.cycleWeapon) window.cycleWeapon(); // Cycle weapons with Q
  if((e.key==="e"||e.key==="E")&&G.running&&window.showWeaponSelect) window.showWeaponSelect(); // Open weapon select with E
  
  // Number keys for weapon selection
  if(G.running && e.key >= "1" && e.key <= "5") {
    const weaponIndex = parseInt(e.key) - 1;
    const weapons = ["basic", "plasma", "spread", "laser", "missile"];
    const weaponId = weapons[weaponIndex];
    if(weaponId && G.weaponsUnlocked.includes(weaponId)) {
      G.weaponType = weaponId;
      updateWeaponHUD();
      showToastMsg(`${WEAPON_DEFS[weaponId].name} selected!`);
    }
  }
  
  if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key)) e.preventDefault();
});
document.addEventListener("keyup",e=>{
  if(e.key==="ArrowLeft" ||e.key==="a") G.keys.left=false;
  if(e.key==="ArrowRight"||e.key==="d") G.keys.right=false;
  if(e.key==="ArrowUp"   ||e.key==="w") G.keys.up=false;
  if(e.key==="ArrowDown" ||e.key==="s") G.keys.down=false;
  if(e.key===" ") G.keys.fire=false;
});

// canvas click/touch to fire - with safety checks
function initCanvasEvents() {
  if (!canvas) return;
  
  canvas.addEventListener("mousedown",()=>{if(G.running&&!G.paused){G.keys.fire=true;G.keys.firePulse=true;}});
  canvas.addEventListener("mouseup",()=>G.keys.fire=false);
  canvas.addEventListener("touchstart",(e)=>{if(e.target===canvas&&G.running&&!G.paused){G.keys.fire=true;G.keys.firePulse=true;}},{passive:true});
  canvas.addEventListener("touchend",(e)=>{if(e.target===canvas)G.keys.fire=false;});
}

// Initialize canvas events when canvas is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCanvasEvents);
} else {
  initCanvasEvents();
}

//  VIRTUAL JOYSTICK (Dream League Soccer style) 
(function() {
  var zone    = null;
  var knob    = null;
  var base    = null;
  var active  = false;
  var touchId = null;
  var baseX   = 0;
  var baseY   = 0;
  var maxR    = 50; // max knob travel radius in px
  var deadzone = 0.18; // ignore tiny movements

  function initJoystick() {
    zone = document.getElementById("joystickZone");
    knob = document.getElementById("joystickKnob");
    base = document.getElementById("joystickBase");
    if (!zone || !knob) return;

    zone.addEventListener("touchstart", onStart, {passive:false});
    zone.addEventListener("touchmove",  onMove,  {passive:false});
    zone.addEventListener("touchend",   onEnd,   {passive:false});
    zone.addEventListener("touchcancel",onEnd,   {passive:false});
  }

  function onStart(e) {
    e.preventDefault();
    if (active) return;
    var t = e.changedTouches[0];
    touchId = t.identifier;
    active  = true;
    var rect = base.getBoundingClientRect();
    baseX = rect.left + rect.width  / 2;
    baseY = rect.top  + rect.height / 2;
    knob.classList.add("active");
    updateJoystick(t.clientX, t.clientY);
  }

  function onMove(e) {
    e.preventDefault();
    if (!active) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId) {
        updateJoystick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        break;
      }
    }
  }

  function onEnd(e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId) {
        active  = false;
        touchId = null;
        // Reset knob to center
        knob.style.transform = "translate(0px, 0px)";
        knob.classList.remove("active");
        // Release all movement keys
        G.keys.left  = false;
        G.keys.right = false;
        G.keys.up    = false;
        G.keys.down  = false;
        break;
      }
    }
  }

  function updateJoystick(cx, cy) {
    var dx = cx - baseX;
    var dy = cy - baseY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var angle = Math.atan2(dy, dx);

    // Clamp knob within circle
    var clampedDist = Math.min(dist, maxR);
    var kx = Math.cos(angle) * clampedDist;
    var ky = Math.sin(angle) * clampedDist;
    knob.style.transform = "translate(" + kx + "px, " + ky + "px)";

    // Normalise -1 to 1
    var nx = dx / maxR;
    var ny = dy / maxR;
    if (nx >  1) nx =  1;
    if (nx < -1) nx = -1;
    if (ny >  1) ny =  1;
    if (ny < -1) ny = -1;

    // Apply deadzone
    G.keys.left  = nx < -deadzone;
    G.keys.right = nx >  deadzone;
    G.keys.up    = ny < -deadzone;
    G.keys.down  = ny >  deadzone;
  }

  // Bind fire button
  function bindFireBtn() {
    var fire = document.getElementById("mcFire");
    if (!fire) return;
    var press = function() {
      G.keys.fire = true;
      G.keys.firePulse = true;
      fire.classList.add("pressed");
    };
    var release = function() {
      G.keys.fire = false;
      fire.classList.remove("pressed");
    };
    fire.addEventListener("touchstart",  press,   {passive:true});
    fire.addEventListener("touchend",    release, {passive:true});
    fire.addEventListener("touchcancel", release, {passive:true});
    fire.addEventListener("mousedown",   press);
    fire.addEventListener("mouseup",     release);
    fire.addEventListener("mouseleave",  release);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", function() {
      initJoystick();
      bindFireBtn();
    });
  } else {
    initJoystick();
    bindFireBtn();
  }
})();

// auto-detect touch
(function(){if(("ontouchstart" in window)||navigator.maxTouchPoints>0){window.NS=window.NS||{};window.NS.mobile=true;}})();

console.log("=== game.js loading completed ===");

