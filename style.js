/* =============================================================================
   NOVA STRIKE � style.js
   UI shell: screen switching, menus, data storage, toast messages,
   ship drawing, leaderboard, achievements, rewards shop, settings.
   This file runs BEFORE game.js and sets up everything the player
   sees outside of the actual gameplay canvas.
============================================================================= */
"use strict";

// --- CONSTANTS ---------------------------------------------------------------

// Key used to store all game data in the browser's localStorage
const LS_KEY = "novastrike_v1";

// Fake leaderboard pilots shown alongside the real player's scores.
// Dates are calculated relative to "now" so they always look recent.
const DEMO_PILOTS = [
  { pilot: "ORION-7", score: 8840, level: 5, time: 420, date: Date.now() - 864e5 * 6 },
  { pilot: "VEX-NULL", score: 7220, level: 5, time: 380, date: Date.now() - 864e5 * 4 },
  { pilot: "KIRA-X", score: 6100, level: 4, time: 290, date: Date.now() - 864e5 * 2 },
  { pilot: "UNIT Vector", score: 4950, level: 4, time: 256, date: Date.now() - 864e5 },
  { pilot: "Ghostline", score: 3310, level: 3, time: 198, date: Date.now() - 36e5 },
  { pilot: "NOVA-ACE", score: 5680, level: 4, time: 312, date: Date.now() - 864e5 * 3 },
  { pilot: "STAR-WOLF", score: 4200, level: 3, time: 245, date: Date.now() - 864e5 * 1 },
  { pilot: "VOID-HUNTER", score: 3850, level: 3, time: 198, date: Date.now() - 12e5 },
  { pilot: "PLASMA-KING", score: 2940, level: 2, time: 156, date: Date.now() - 6e5 },
  { pilot: "ROCKET-GIRL", score: 2150, level: 2, time: 134, date: Date.now() - 3e5 },
  { pilot: "LASER-BEAM", score: 1890, level: 2, time: 98, date: Date.now() - 2e5 },
  { pilot: "COMET-TAIL", score: 1650, level: 1, time: 87, date: Date.now() - 1e5 },
];

// All 18 achievement definitions.
// Each entry has a unique id (checked against saved data), a display title,
// a description shown in the Achievements screen, and a Font Awesome icon class.
const ACH_META = [
  { id: "first_launch", title: "First Launch", desc: "Finish booting the hangar � play once.", icon: "fa-rocket" },
  { id: "score_500", title: "Hot Shot", desc: "Score 500+ in a single sortie.", icon: "fa-star" },
  { id: "score_1500", title: "Ace", desc: "Reach 1,500 career best.", icon: "fa-medal" },
  { id: "score_3000", title: "Legend", desc: "Reach 3,000 career best.", icon: "fa-crown" },
  { id: "ast_100", title: "Rock Breaker", desc: "Destroy 100 asteroids total.", icon: "fa-meteor" },
  { id: "ast_500", title: "Demolition", desc: "Destroy 500 asteroids total.", icon: "fa-fire" },
  { id: "pu_25", title: "Collector", desc: "Grab 25 power-ups total.", icon: "fa-bolt" },
  { id: "combo_5", title: "Chain Gun", desc: "Hit combo x5 or higher.", icon: "fa-crosshairs" },
  { id: "survive_120", title: "Endurance", desc: "Survive 2+ minutes in one run.", icon: "fa-clock" },
  { id: "boss1", title: "Titan Down", desc: "Defeat a sector boss.", icon: "fa-skull" },
  { id: "level_5", title: "Omega Clear", desc: "Reach level 5 in a run.", icon: "fa-layer-group" },
  { id: "games_10", title: "Veteran", desc: "Play 10 games.", icon: "fa-gamepad" },
  { id: "coins_1000", title: "Wealthy Pilot", desc: "Accumulate 1,000 coins.", icon: "fa-coins" },
  { id: "weapons_5", title: "Arsenal Master", desc: "Unlock 5 different weapons.", icon: "fa-rocket" },
  { id: "perfect_run", title: "Untouchable", desc: "Complete a level without taking damage.", icon: "fa-shield-alt" },
  { id: "speed_demon", title: "Speed Demon", desc: "Destroy 50 asteroids in 30 seconds.", icon: "fa-tachometer-alt" },
  { id: "coin_collector", title: "Coin Collector", desc: "Collect 100 coins in a single game.", icon: "fa-hand-holding-usd" },
  { id: "multi_boss", title: "Boss Hunter", desc: "Defeat 5 bosses total.", icon: "fa-crosshairs" },
];

// One colour per ship skin slot � used for engine glow and HUD tinting
const SKIN_PALETTE = ["#00aaff", "#ff2244", "#b400ff", "#ffd60a"];

// Global scale multiplier for the player ship sprite.
// Increase this to make the ship larger on screen without touching game logic.
const PLAYER_SHIP_VISUAL_SCALE = 1.0;

// --- DATA PERSISTENCE --------------------------------------------------------

// Load game data from localStorage.
// On first run, seeds the player with starter coins, a first achievement,
// and a sample score so the leaderboard and stats screens are never empty.
function loadData() {
  try {
    const data = localStorage.getItem(LS_KEY);
    const parsed = data ? JSON.parse(data) : {};
    
    // Initialize new players with some starting resources
    if (!parsed.initialized) {
      parsed.coins = parsed.coins || 200; // More starting coins
      parsed.gamesPlayed = parsed.gamesPlayed || 1; // Start with 1 game to unlock first achievement
      parsed.bestScore = parsed.bestScore || 150; // Small starting score
      parsed.bestLevel = parsed.bestLevel || 1;
      parsed.totalAst = parsed.totalAst || 25; // Some asteroids destroyed
      parsed.totalPU = parsed.totalPU || 5; // Some power-ups collected
      parsed.maxCombo = parsed.maxCombo || 3; // Small combo achieved
      parsed.bossKills = parsed.bossKills || 0;
      parsed.totalSeconds = parsed.totalSeconds || 45; // 45 seconds played
      parsed.maxTime = parsed.maxTime || 45;
      parsed.achievements = parsed.achievements || {};
      parsed.ownedRewards = parsed.ownedRewards || {};
      parsed.weaponsUnlocked = parsed.weaponsUnlocked || ["basic"];
      parsed.ownedUpgrades = parsed.ownedUpgrades || {};
      parsed.scores = parsed.scores || [
        { score: 150, level: 1, time: 45, date: Date.now() - 3600000 } // 1 hour ago
      ];
      
      // Award some initial achievements
      parsed.achievements.first_launch = Date.now();
      
      parsed.initialized = true;
      
      // Save the initialized data
      localStorage.setItem(LS_KEY, JSON.stringify(parsed));
    }
    
    return parsed;
  } catch (e) {
    console.error("Error loading data:", e);
    return {
      coins: 200,
      gamesPlayed: 1,
      bestScore: 150,
      bestLevel: 1,
      totalAst: 25,
      totalPU: 5,
      maxCombo: 3,
      bossKills: 0,
      totalSeconds: 45,
      maxTime: 45,
      achievements: { first_launch: Date.now() },
      ownedRewards: {},
      weaponsUnlocked: ["basic"],
      ownedUpgrades: {},
      scores: [{ score: 150, level: 1, time: 45, date: Date.now() - 3600000 }],
      initialized: true
    };
  }
}

// Merge a partial update object into the saved data and write it back.
// Only the keys present in `updates` are changed; everything else is kept.
function saveData(updates) {
  try {
    const current = loadData();
    const merged = { ...current, ...updates };
    localStorage.setItem(LS_KEY, JSON.stringify(merged));
  } catch (e) {
    console.error("Error saving data:", e);
  }
}

// Build the global window.NS settings object from saved data.
// Called once at startup so every part of the game can read NS.music,
// NS.difficulty, NS.volume, etc. without touching localStorage directly.
function hydrateNS() {
  const saved = loadData();
  window.NS = {
    // Audio settings
    music: saved.music !== false,
    sfx: saved.sfx !== false,
    volume: saved.volume || 7,
    
    // Gameplay settings
    autofire: saved.autofire !== false,
    hitmarkers: saved.hitmarkers !== false,
    particles: saved.particles !== false,
    difficulty: saved.difficulty || "normal",
    sensitivity: saved.sensitivity || 5,
    
    // Visual settings
    scanlines: saved.scanlines !== false,
    shake: saved.shake !== false,
    mobile: saved.mobile || false,
    
    // Ship bonuses (set by applyShipStats)
    shipSpeedBonus: 0,
    shipShieldBonus: 0,
    shipFireBonus: 0,
  };
  
  // Set selected skin
  window.selectedSkin = saved.selectedSkin || 0;
}

// Write the current window.NS settings back to localStorage.
// Called whenever the player changes a setting in the Settings screen.
function persistNS() {
  if (!window.NS) return;
  
  saveData({
    music: window.NS.music,
    sfx: window.NS.sfx,
    volume: window.NS.volume,
    autofire: window.NS.autofire,
    hitmarkers: window.NS.hitmarkers,
    particles: window.NS.particles,
    difficulty: window.NS.difficulty,
    sensitivity: window.NS.sensitivity,
    scanlines: window.NS.scanlines,
    shake: window.NS.shake,
    mobile: window.NS.mobile,
    selectedSkin: window.selectedSkin,
  });
}

// --- UTILITY HELPERS ---------------------------------------------------------

// Show a brief pop-up message at the bottom of the screen.
// Automatically disappears after `duration` milliseconds.
function showToast(message, duration = 3000) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  
  toast.textContent = message;
  toast.classList.add("show");
  
  setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}

// Utility functions

// Convert a raw second count into a human-readable string like "2m 34s"
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

// Convert total seconds into a compact playtime string like "1h 23m"
function formatPlaytime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return "0m";
}

// Return a rank letter (S/A/B/C/D/F) and description for a given score.
// Used on the Game Over screen and leaderboard badges.
function rankForScore(score) {
  if (score >= 8000) return { letter: "S", desc: "LEGENDARY" };
  if (score >= 5000) return { letter: "A", desc: "OUTSTANDING" };
  if (score >= 2500) return { letter: "B", desc: "SOLID" };
  if (score >= 1000) return { letter: "C", desc: "DECENT" };
  if (score >= 400)  return { letter: "D", desc: "ROOKIE" };
  return { letter: "F", desc: "TRAINEE" };
}

// --- SHIP IMAGE LOADING -------------------------------------------------------

// Pre-load all ship PNG files at startup.
var _shipImgs = [];
var _shipImgsLoaded = [];
(function(){
  var srcs = ["ship1.png", "ship3.png", "fighter.png", "ship4.png"];
  for (var i = 0; i < srcs.length; i++) {
    (function(idx, src){
      var img = new Image();
      _shipImgsLoaded[idx] = false;
      img.onload = function() {
        _shipImgsLoaded[idx] = true;
        setTimeout(function() {
          if (typeof drawSkinPreviews === 'function') { drawSkinPreviews(); }
        }, 200);
        setTimeout(function() {
          if (typeof drawSkinPreviews === 'function') { drawSkinPreviews(); }
        }, 1000);
      };
      img.onerror = function() {
        _shipImgsLoaded[idx] = false;
        console.error("Failed to load ship image:", src);
      };
      img.src = src;
      _shipImgs[idx] = img;
    })(i, srcs[i]);
  }
})();

// Return the ship image for the currently selected skin.
// Returns null if the image hasn't finished loading yet (fallback vector is used instead).
function getShipImg() {
  var idx = window.selectedSkin || 0;
  return (_shipImgsLoaded[idx] && _shipImgs[idx] && _shipImgs[idx].complete && _shipImgs[idx].naturalWidth > 0)
    ? _shipImgs[idx] : null;
}

// Return the ship image for a specific skin ID (used in preview tiles).
function getShipImgById(skinId) {
  var idx = skinId || 0;
  return (_shipImgsLoaded[idx] && _shipImgs[idx] && _shipImgs[idx].complete && _shipImgs[idx].naturalWidth > 0)
    ? _shipImgs[idx] : null;
}

// Draw the player's ship on any canvas context at position (x, y).
// `t` is the current time in seconds � used to create a gentle hover animation.
// `angle` rotates the sprite to match the ship's heading.
// Falls back to a simple polygon if the PNG hasn't loaded yet.
function drawShipOnCtx(ctx, x, y, color, t, angle) {
  var S = PLAYER_SHIP_VISUAL_SCALE;
  ctx.save();
  ctx.translate(x, y);
  ctx.translate(0, Math.sin(t * 2.4) * 2.5);
  if (angle !== undefined) ctx.rotate(angle + Math.PI / 2);
  var img = getShipImg();
  if (img) {
    // Increased size for better visibility and clarity
    var size = 120 * S; // Increased from 70 to 120
    var half = size / 2;
    // Enhanced engine glow effect
    ctx.shadowColor = color; 
    ctx.shadowBlur = 28; // Increased glow
    ctx.globalAlpha = 0.35; // Slightly more visible glow
    ctx.fillStyle = color;
    ctx.beginPath(); 
    ctx.arc(0, half*0.3, half*0.32, 0, Math.PI*2); // Larger engine glow
    ctx.fill();
    ctx.globalAlpha = 1; 
    ctx.shadowBlur = 0;
    // Draw ship with crisp rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -half, -half, size, size);
  } else {
    // Fallback vector ship - also increased size
    ctx.scale(S * 1.8, S * 1.8); // Increased scale
    ctx.fillStyle = color; 
    ctx.shadowColor = color; 
    ctx.shadowBlur = 18; // Increased glow
    ctx.beginPath(); 
    ctx.moveTo(0,-22); ctx.lineTo(16,14); ctx.lineTo(8,18);
    ctx.lineTo(0,12); ctx.lineTo(-8,18); ctx.lineTo(-16,14); 
    ctx.closePath(); 
    ctx.fill();
    ctx.shadowBlur = 0; 
    ctx.fillStyle = "#fff"; 
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); 
    ctx.moveTo(0,-10); ctx.lineTo(6,8); ctx.lineTo(0,3); ctx.lineTo(-6,8); 
    ctx.closePath(); 
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// Draw a smaller ship preview for the Settings skin-selection grid.
// Uses a specific skinId so each tile shows the correct ship image.
function drawShipPreviewOnCtx(ctx, x, y, color, t, angle, skinId) {
  var S = PLAYER_SHIP_VISUAL_SCALE;
  ctx.save();
  ctx.translate(x, y);
  ctx.translate(0, Math.sin(t * 2.4) * 1.5); // Reduced movement for previews
  if (angle !== undefined) ctx.rotate(angle + Math.PI / 2);
  
  // Get the specific ship image for this skin ID
  var img = getShipImgById(skinId);
  console.log("Drawing ship preview for skinId", skinId, "- image found:", !!img);
  
  if (img) {
    // Smaller size for previews
    var size = 60 * S;
    var half = size / 2;
    // Engine glow effect
    ctx.shadowColor = color; 
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = color;
    ctx.beginPath(); 
    ctx.arc(0, half*0.3, half*0.25, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1; 
    ctx.shadowBlur = 0;
    // Draw ship with crisp rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -half, -half, size, size);
  } else {
    console.log("No image found for skinId", skinId, "- drawing fallback vector ship");
    // Fallback vector ship for previews - make each one slightly different
    ctx.scale(S * 1.2, S * 1.2);
    ctx.fillStyle = color; 
    ctx.shadowColor = color; 
    ctx.shadowBlur = 8;
    ctx.beginPath(); 
    
    // Different shapes for different ships
    if (skinId === 0) {
      // NOVA - classic triangle
      ctx.moveTo(0,-18); ctx.lineTo(12,10); ctx.lineTo(6,14);
      ctx.lineTo(0,8); ctx.lineTo(-6,14); ctx.lineTo(-12,10); 
    } else if (skinId === 1) {
      // CRIMSON - sleek arrow
      ctx.moveTo(0,-20); ctx.lineTo(8,12); ctx.lineTo(4,16);
      ctx.lineTo(0,6); ctx.lineTo(-4,16); ctx.lineTo(-8,12); 
    } else if (skinId === 2) {
      // PHANTOM - heavy/wide
      ctx.moveTo(0,-16); ctx.lineTo(14,8); ctx.lineTo(8,16);
      ctx.lineTo(0,10); ctx.lineTo(-8,16); ctx.lineTo(-14,8); 
    } else {
      // SPECTRE - angular
      ctx.moveTo(0,-18); ctx.lineTo(10,6); ctx.lineTo(12,12);
      ctx.lineTo(0,4); ctx.lineTo(-12,12); ctx.lineTo(-10,6); 
    }
    
    ctx.closePath(); 
    ctx.fill();
    ctx.shadowBlur = 0; 
    ctx.fillStyle = "#fff"; 
    ctx.globalAlpha = 0.4;
    ctx.beginPath(); 
    ctx.moveTo(0,-8); ctx.lineTo(5,6); ctx.lineTo(0,2); ctx.lineTo(-5,6); 
    ctx.closePath(); 
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
window.drawShipOnCtx = drawShipOnCtx;
window.drawShipPreviewOnCtx = drawShipPreviewOnCtx;

// --- SCREEN ROUTING ----------------------------------------------------------

// Maps short screen names (e.g. "menu") to their HTML element IDs.
// showScreen() uses this table so callers never need to know the full ID.
var SCREEN_IDS = {
  splash: "screen-splash",
  multiplayer: "screen-multiplayer",
  menu: "screen-menu",
  levels: "screen-levels",
  shop: "screen-shop",
  howtoplay: "screen-howtoplay",
  leaderboard: "screen-leaderboard",
  achievements: "screen-achievements",
  settings: "screen-settings",
  credits: "screen-credits",
  game: "screen-game",
  gameover: "screen-gameover",
  login:    "screen-login",
  signup:   "screen-signup",
  profile:  "screen-profile",
  rewards:  "screen-rewards",
};

// Switch the visible screen to `name` (e.g. "menu", "game", "rewards").
// Hides every other .ns-screen, shows the target, manages the navbar/footer
// visibility, and calls the screen's own init function (e.g. renderLeaderboard).
function showScreen(name) {
  if (!name) name = "menu";

  var id = SCREEN_IDS[name] || ("screen-" + name);

  // Use only CSS classes � no inline style overrides
  var screens = document.querySelectorAll(".ns-screen");
  for (var i = 0; i < screens.length; i++) {
    screens[i].style.display = "";
    screens[i].classList.add("hidden");
    screens[i].classList.remove("active");
  }

  var target = document.getElementById(id);
  if (!target) {
    console.error("showScreen: not found:", id);
    if (name !== "menu") return showScreen("menu");
    return false;
  }
  target.style.display = "";
  target.classList.remove("hidden");
  target.classList.add("active");

  // Nav bar
  var nav = document.getElementById("mainNav");
  if (nav) {
    var hideNav = (name === "splash" || name === "game");
    nav.classList.toggle("hidden", hideNav);
    nav.style.display = "";
  }

  // Footer
  var foot = document.getElementById("mainFooter");
  if (foot) {
    var hideFoot = (name === "splash" || name === "game" || name === "gameover");
    foot.classList.toggle("hidden", hideFoot);
    foot.style.display = "";
  }

  // In-game HUD
  var gnav = document.getElementById("gameNav");
  if (gnav) {
    gnav.classList.toggle("hidden", name !== "game");
    gnav.style.display = "";
  }

  // Mobile joystick
  var mc = document.getElementById("mobileControls");
  if (mc && name !== "game") mc.classList.remove("visible");

  // Screen-specific init
  try { if (name === "menu")         { window._startLevel = 1; refreshMenuStats(); } }         catch(e) { console.error("menu init:", e); }
  try { if (name === "leaderboard")  { renderLeaderboard(); } }                                 catch(e) { console.error("leaderboard init:", e); }
  try { if (name === "multiplayer")  { mpInitScreen(); } }                                      catch(e) { console.error("multiplayer init:", e); }
  try { if (name === "achievements") { renderAchievements(); } }                                catch(e) { console.error("achievements init:", e); }
  try { if (name === "shop")         { initShopScreen(); } }                                    catch(e) { console.error("shop init:", e); }
  try { if (name === "settings")     { syncSettingsUI(); updateSkinLockState(); drawSkinPreviews(); setTimeout(drawSkinPreviews, 500); } } catch(e) { console.error("settings init:", e); }
  try { if (name === "profile")      { refreshProfileScreen(); } }                              catch(e) { console.error("profile init:", e); }
  try { if (name === "rewards")      { renderRewardsScreen(); } }                               catch(e) { console.error("rewards init:", e); }

  // Active nav link
  var links = document.querySelectorAll(".ns-link");
  for (var j = 0; j < links.length; j++) {
    links[j].classList.toggle("active", links[j].getAttribute("data-target") === name);
  }

  return true;
}
window.showScreen = showScreen;

// --- GAME LAUNCH -------------------------------------------------------------

// Start a new game at the given level (defaults to 1 if omitted).
// Stops any game already running, then delegates to game.js's startGame().
function launchGame(forceLevel) {
  
  if (forceLevel != null) window._startLevel = forceLevel;
  if (window._startLevel == null) window._startLevel = 1;
  
  console.log("Starting level:", window._startLevel);

  // Stop any existing game
  if (window.G && window.G.running) {
    console.log("Stopping existing game");
    window.G.running = false;
    window.G.paused = false;
    cancelAnimationFrame(window.G.frameId);
    if (window.stopMusic) window.stopMusic();
    var op = document.getElementById("overlayPause");
    if (op) op.classList.add("hidden");
    var mc = document.getElementById("mobileControls");
    if (mc) mc.classList.remove("visible");
    var pb = document.getElementById("gnPause");
    if (pb) pb.innerHTML = '<i class="fas fa-pause"></i>';
  }

  console.log("Checking if startGame function exists...");
  console.log("typeof window.startGame:", typeof window.startGame);
  
  if (typeof window.startGame === 'function') {
    console.log("Calling window.startGame...");
    try {
      window.startGame(window._startLevel);
      console.log("startGame completed successfully");
    } catch (error) {
      console.error("Error in startGame:", error);
      showToast("Error starting game: " + error.message);
    }
  } else {
    console.error("window.startGame is not a function:", typeof window.startGame);
    
    // Check if game.js is loaded
    if (typeof window.G === 'undefined') {
      console.error("Game engine (window.G) not found - game.js may not be loaded");
      showToast("Game engine not loaded. Please refresh the page.");
    } else {
      console.error("startGame function not found but G exists");
      showToast("Game initialization error. Please refresh the page.");
    }
  }
}
window.launchGame = launchGame;

// --- GAME CONTROL FUNCTIONS --------------------------------------------------

// Return to the main menu. If a game is running, quit it first.
function quitToMenu() {
  if (window.G && window.G.running) window.quitGame();
  else showScreen("menu");
}
window.quitToMenu = quitToMenu;

// Restart the current level after confirmation.
// Stops the running game, resets state, and calls startGame() again.
function confirmRestart() {
  if (!window.G || !window.G.running) return;
  if (!confirm("Restart mission?")) return;
  var lv = window.G.level;
  window.G.running = false;
  window.G.paused = false;
  cancelAnimationFrame(window.G.frameId);
  if (window.stopMusic) window.stopMusic();
  var op = document.getElementById("overlayPause");
  if (op) op.classList.add("hidden");
  var mc = document.getElementById("mobileControls");
  if (mc) mc.classList.remove("visible");
  var pb = document.getElementById("gnPause");
  if (pb) pb.innerHTML = '<i class="fas fa-pause"></i>';
  window._startLevel = lv;
  window.startGame(lv);
}
window.confirmRestart = confirmRestart;

// Toggle music and sound effects on/off.
// Updates the in-game mute button icon and the Settings screen toggles.
function toggleMute() {
  var on = !window.NS.music;
  window.NS.music = on;
  window.NS.sfx = on;
  var btn = document.getElementById("gnMute");
  if (btn) btn.innerHTML = on ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-mute"></i>';
  if (!on && window.stopMusic) window.stopMusic();
  persistNS();
  var tm = document.getElementById("t-music");
  var ts = document.getElementById("t-sfx");
  if (tm) tm.classList.toggle("on", on);
  if (ts) ts.classList.toggle("on", on);
}
window.toggleMute = toggleMute;

// Toggle a single setting on/off when the player clicks a toggle switch.
// The element's ID maps to a key in window.NS (e.g. "t-music" ? NS.music).
function toggleSetting(el) {
  el.classList.toggle("on");
  var on = el.classList.contains("on");
  var map = {
    "t-music": "music",
    "t-sfx": "sfx",
    "t-autofire": "autofire",
    "t-hitmarkers": "hitmarkers",
    "t-particles": "particles",
    "t-scanlines": "scanlines",
    "t-shake": "shake",
    "t-mobile": "mobile"
  };
  var key = map[el.id];
  if (key) window.NS[key] = on;
  applyScanlines();
  persistNS();
}
window.toggleSetting = toggleSetting;

// Wipe all saved data and reload the page (fresh start).
function resetAllData() {
  if (!confirm("Delete all saved stats and settings on this device?")) return;
  localStorage.removeItem(LS_KEY);
  location.reload();
}
window.resetAllData = resetAllData;

// --- SCORE & STATS -----------------------------------------------------------

// Return the player's all-time best score.
function getBestScore() {
  return loadData().bestScore || 0;
}
window.getBestScore = getBestScore;

// Add a new score entry to the player's history.
// Also updates bestScore and bestLevel if this run beat the old records.
function addScoreEntry(score, level, timeSec) {
  const d = loadData();
  const rows = d.scores || [];
  rows.unshift({ score, level, time: timeSec, date: Date.now() });
  saveData({
    scores: rows.slice(0, 80),
    bestScore: Math.max(d.bestScore || 0, score),
    bestLevel: Math.max(d.bestLevel || 1, level),
  });
}
window.addScoreEntry = addScoreEntry;

// --- GAME OVER SCREEN --------------------------------------------------------

// Called by game.js when the player dies or quits.
// Displays final stats, rank, coins earned, and any special badges.
function showGameOver(o) {
  window._startLevel = o.level;
  var best = getBestScore();
  var rank = rankForScore(o.score);
  var perf = Math.min(100, Math.round((o.score / Math.max(1, best)) * 50 + (o.time / 4)));

  // Award coins for this run
  var coinsEarned = coinsForRun(o.score, o.level, o.time);
  var totalCoins = addCoins(coinsEarned);

  // Check for reward bonuses earned this run
  var rewardsBadges = [];
  if (o.isNewBest) rewardsBadges.push({ icon: "fa-star", text: "NEW BEST!" });
  if (o.maxCombo >= 5) rewardsBadges.push({ icon: "fa-fire", text: "COMBO x" + o.maxCombo });
  if (o.level >= 3) rewardsBadges.push({ icon: "fa-layer-group", text: "LEVEL " + o.level });
  if (coinsEarned >= 50) rewardsBadges.push({ icon: "fa-coins", text: "+" + coinsEarned + " COINS" });

  // Update DOM
  var el = function(id) { return document.getElementById(id); };
  if (el("goScore"))    el("goScore").textContent    = o.score.toLocaleString();
  if (el("goBest"))     el("goBest").textContent     = Math.max(best, o.score).toLocaleString();
  if (el("goLevel"))    el("goLevel").textContent    = o.level;
  if (el("goTime"))     el("goTime").textContent     = formatDuration(o.time);
  if (el("goAst"))      el("goAst").textContent      = o.asteroids;
  if (el("goCombo"))    el("goCombo").textContent    = "x" + o.maxCombo;
  if (el("goRankLetter")) el("goRankLetter").textContent = rank.letter;
  if (el("goRankDesc"))   el("goRankDesc").textContent   = rank.desc;
  if (el("goPerfPct"))    el("goPerfPct").textContent    = perf + "%";
  if (el("goPerfFill"))   el("goPerfFill").style.width   = perf + "%";
  if (el("goCoins"))      el("goCoins").textContent      = "+" + coinsEarned;
  if (el("goTotalCoins")) el("goTotalCoins").textContent = totalCoins.toLocaleString();

  // Dynamic title
  var titleEl = el("goTitle"), iconEl = el("goIcon"), subEl = el("goSub");
  if (titleEl && iconEl && subEl) {
    if (rank.letter === "S") {
      iconEl.textContent = "[S]"; titleEl.textContent = "LEGENDARY RUN";
      subEl.textContent = "You are the apex predator of the void.";
    } else if (rank.letter === "A") {
      iconEl.textContent = "[A]"; titleEl.textContent = "OUTSTANDING";
      subEl.textContent = "Elite performance, commander.";
    } else if (rank.letter === "B") {
      iconEl.textContent = "[B]"; titleEl.textContent = "SOLID SORTIE";
      subEl.textContent = "Good run. Push harder next time.";
    } else if (rank.letter === "C") {
      iconEl.textContent = "[C]"; titleEl.textContent = "SHIP DESTROYED";
      subEl.textContent = "The void claims another pilot...";
    } else {
      iconEl.textContent = "[F]"; titleEl.textContent = "MISSION FAILED";
      subEl.textContent = "Survive longer -- shield discipline matters.";
    }
  }

  // New best banner
  var nb = el("newBestBanner");
  if (nb) nb.classList.toggle("hidden", !o.isNewBest);

  // Rewards earned block
  var rb = el("goRewardsBlock");
  var rl = el("goRewardsList");
  if (rb && rl) {
    if (rewardsBadges.length > 0) {
      rb.classList.remove("hidden");
      var html = "";
      for (var i = 0; i < rewardsBadges.length; i++) {
        html += '<div class="go-reward-badge"><i class="fas ' + rewardsBadges[i].icon + '"></i>' + rewardsBadges[i].text + '</div>';
      }
      rl.innerHTML = html;
    } else {
      rb.classList.add("hidden");
    }
  }

  showScreen("gameover");
}
window.showGameOver = showGameOver;

// --- ACHIEVEMENTS ------------------------------------------------------------

// Mark a single achievement as unlocked (by its id string).
// Does nothing if already unlocked. Shows a toast and refreshes the nav badges.
function unlockAch(id) {
  const d = loadData();
  const cur = { ...(d.achievements || {}) };
  if (cur[id]) return;
  cur[id] = Date.now();
  saveData({ achievements: cur });
  showToast("Achievement unlocked!");
  
  // Update navigation rewards
  if (typeof updateNavRewards === 'function') {
    updateNavRewards();
  }
}
window.unlockAch = unlockAch;

// Check all achievement conditions against the current saved data.
// Unlocks any that are newly met and shows a popup for each one.
// Returns true if at least one new achievement was unlocked.
function checkAchievements() {
  var d = loadData();
  var lr = d.lastRun || {};
  var cur = d.achievements || {};
  var newAchievements = [];
  
  function mark(id) { 
    if (!cur[id]) {
      cur[id] = Date.now();
      newAchievements.push(id);
    }
  }

  // Check all achievements
  if ((d.gamesPlayed || 0) >= 1)  mark("first_launch");
  if ((d.bestScore || 0) >= 500 || (lr.score || 0) >= 500) mark("score_500");
  if ((d.bestScore || 0) >= 1500) mark("score_1500");
  if ((d.bestScore || 0) >= 3000) mark("score_3000");
  if ((d.totalAst  || 0) >= 100)  mark("ast_100");
  if ((d.totalAst  || 0) >= 500)  mark("ast_500");
  if ((d.totalPU   || 0) >= 25)   mark("pu_25");
  if ((d.maxCombo  || 0) >= 5)    mark("combo_5");
  if ((d.maxTime   || 0) >= 120)  mark("survive_120");
  if ((d.bossKills || 0) >= 1)    mark("boss1");
  if ((d.bossKills || 0) >= 5)    mark("multi_boss");
  if ((lr.level || 0) >= 5 || (d.bestLevel || 0) >= 5) mark("level_5");
  if ((d.gamesPlayed || 0) >= 10) mark("games_10");
  if ((d.coins || 0) >= 1000) mark("coins_1000");
  if ((d.weaponsUnlocked || ["basic"]).length >= 5) mark("weapons_5");

  saveData({ achievements: cur });
  
  // Show popups for new achievements
  newAchievements.forEach(achId => {
    const ach = ACH_META.find(a => a.id === achId);
    if (ach) {
      setTimeout(() => {
        showRewardPopup(
          `ACHIEVEMENT UNLOCKED!`,
          `${ach.title}: ${ach.desc}`,
          `fas ${ach.icon}`,
          "#ffd700"
        );
      }, newAchievements.indexOf(achId) * 1000); // Stagger popups
    }
  });
  
  return newAchievements.length > 0;
}
window.checkAchievements = checkAchievements;

// --- MENU & NAV UPDATES ------------------------------------------------------

// Refresh the stat pills on the main menu (best score, level, games played, playtime).
// Also updates the reward badges in the navigation bar.
function refreshMenuStats() {
  var d = loadData();
  var ids = ["menuBest","menuBestLv","menuGames","menuTime","navBest"];
  var vals = [
    (d.bestScore || 0).toLocaleString(),
    String(d.bestLevel || 1),
    String(d.gamesPlayed || 0),
    formatPlaytime(d.totalSeconds || 0),
    (d.bestScore || 0).toLocaleString()
  ];
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (el) el.textContent = vals[i];
  }
  
  // Update navigation reward indicators
  updateNavRewards();
}

// Update the three small reward badges next to the "Rewards" nav link:
// coins count, XP count, and achievements unlocked / total.
function updateNavRewards() {
  try {
    var d = loadData();

    var coinsEl = document.getElementById('navCoins');
    var xpEl    = document.getElementById('navXP');
    var achEl   = document.getElementById('navAchievements');

    function setAndPop(el, newVal) {
      if (!el) return;
      if (el.textContent !== String(newVal)) {
        el.textContent = newVal;
        var pill = el.closest('.ns-res-pill');
        if (pill) {
          pill.classList.remove('pop');
          void pill.offsetWidth; // reflow to restart animation
          pill.classList.add('pop');
          setTimeout(function() { pill.classList.remove('pop'); }, 400);
        }
      }
    }

    setAndPop(coinsEl, (d.coins || 0).toLocaleString());
    setAndPop(xpEl,    (d.experience || 0).toLocaleString());

    if (achEl) {
      var achCount = Object.keys(d.achievements || {}).length;
      var totalAch = ACH_META ? ACH_META.length : 18;
      setAndPop(achEl, achCount + '/' + totalAch);
    }
  } catch (e) {
    console.error("updateNavRewards:", e);
  }
}
window.updateNavRewards = updateNavRewards;

// --- LEADERBOARD -------------------------------------------------------------

// Combine the player's own score history with the demo pilot entries,
// then sort everything by score descending. Used by renderLeaderboard().
function mergedLeaders() {
  var d = loadData();
  var mine = [];
  var scores = d.scores || [];
  for (var i = 0; i < scores.length; i++) {
    mine.push({
      pilot: "YOU",
      score: scores[i].score,
      level: scores[i].level,
      time: scores[i].time,
      date: scores[i].date,
      isUser: true
    });
  }
  var demo = [];
  for (var j = 0; j < DEMO_PILOTS.length; j++) {
    var dp = DEMO_PILOTS[j];
    demo.push({
      pilot: dp.pilot,
      score: dp.score,
      level: dp.level,
      time: dp.time,
      date: dp.date,
      isUser: false
    });
  }
  var all = mine.concat(demo);
  all.sort(function(a, b) { return b.score - a.score; });
  return all;
}

// Build the leaderboard screen: podium (top 3), all-time table,
// today's table, and the player's personal history table.
function renderLeaderboard() {
  
  const all = mergedLeaders();
  console.log("Total leaderboard entries:", all.length);
  
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const today = all.filter((r) => r.date >= startOfDay.getTime());
  console.log("Today's entries:", today.length);

  const podium = document.getElementById("podiumRow");
  if (podium) {
    console.log("Rendering podium...");
    podium.innerHTML = "";
    const top = all.slice(0, 3);
    const order = [1, 0, 2];
    const cls = ["r2", "r1", "r3"];
    const medals = ["??", "??", "??"];
    const positions = ["2ND", "1ST", "3RD"];
    order.forEach((idx, ordi) => {
      const r = top[idx];
      if (!r) return;
      const div = document.createElement("div");
      div.className = "podium-block";
      const crown = ordi === 1 ? `<div class="podium-crown">??</div>` : "";
      div.innerHTML =
        `<div class="podium-avatar ${cls[ordi]}">${crown}${medals[ordi]}</div>` +
        `<div class="podium-name">${r.pilot}</div>` +
        `<div class="podium-score">${r.score.toLocaleString()}</div>` +
        `<div class="podium-pos">${positions[ordi]}</div>` +
        `<div class="podium-bar ${cls[ordi]}"></div>`;
      podium.appendChild(div);
    });
    console.log("Podium rendered with", top.length, "entries");
  }

  const rankNumHtml = (i) => {
    if (i === 0) return `<span class="lb-rank-num gold">1</span>`;
    if (i === 1) return `<span class="lb-rank-num silver">2</span>`;
    if (i === 2) return `<span class="lb-rank-num bronze">3</span>`;
    return `<span class="lb-rank-num plain">${i + 1}</span>`;
  };
  const pilotHtml = (r) => {
    const you = r.isUser ? `<span class="lb-pilot-you-tag">YOU</span>` : "";
    return `<span class="lb-pilot${r.isUser ? " is-you" : ""}">${r.pilot}${you}</span>`;
  };
  const rankBadge = (r) => {
    const letters = ["S","A","B","C","D","F"];
    const thresholds = [8000,5000,2500,1000,400,0];
    const score = (r ? r.score : 0) ?? 0;
    let letter = "F";
    for (let t = 0; t < thresholds.length; t++) { if (score >= thresholds[t]) { letter = letters[t]; break; } }
    return `<span class="lb-rank-badge">${letter}</span>`;
  };

  const fill = (bodyId, rows, cols) => {
    const tb = document.getElementById(bodyId);
    if (!tb) {
      console.error("Table body not found:", bodyId);
      return;
    }
    console.log("Filling table", bodyId, "with", rows.length, "rows");
    tb.innerHTML = "";
    rows.slice(0, 12).forEach((r, i) => {
      const tr = document.createElement("tr");
      if (i < 3) tr.classList.add(`rank-${i + 1}`);
      const rk = rankForScore(r.score);
      if (cols === "all")
        tr.innerHTML = `<td>${rankNumHtml(i)}</td><td>${pilotHtml(r)}</td><td><span class="lb-score">${r.score.toLocaleString()}</span></td><td>${r.level}</td><td>${formatDuration(r.time)}</td><td><span class="lb-rank-badge">${rk.letter}</span></td>`;
      else if (cols === "today")
        tr.innerHTML = `<td>${rankNumHtml(i)}</td><td>${pilotHtml(r)}</td><td><span class="lb-score">${r.score.toLocaleString()}</span></td><td>${r.level}</td><td><span class="lb-rank-badge">${rankForScore(r.score).letter}</span></td>`;
      else
        tr.innerHTML = `<td>${rankNumHtml(i)}</td><td><span class="lb-score">${r.score.toLocaleString()}</span></td><td>${r.level}</td><td>${formatDuration(r.time)}</td><td>${new Date(r.date).toLocaleDateString()}</td>`;
      tb.appendChild(tr);
    });
  };

  fill("lbTableBody", all, "all");
  fill("lbTodayBody", today.length ? today : all.slice(0, 6), "today");
  const d = loadData();
  fill("lbMineBody", d.scores || [], "mine");
  
  console.log("Leaderboard rendering complete");
}

// Build the achievements grid: progress bar at the top, then one card
// per achievement showing its icon, name, description, and locked/unlocked state.
function renderAchievements() {
  
  var d = loadData();
  var got = d.achievements || {};
  var n = 0;
  for (var k = 0; k < ACH_META.length; k++) { if (got[ACH_META[k].id]) n++; }
  
  console.log("Player has", n, "out of", ACH_META.length, "achievements");
  console.log("Achievement data:", got);
  console.log("ACH_META available:", !!ACH_META, "length:", ACH_META ? ACH_META.length : 0);
  
  var achCount = document.getElementById("achCount");
  if (achCount) {
    achCount.textContent = n + " / " + ACH_META.length;
    console.log("Updated achievement count display");
  } else {
    console.error("achCount element not found!");
  }
  
  var achFill = document.getElementById("achFill");
  if (achFill) {
    achFill.style.width = (100 * n / ACH_META.length) + "%";
    console.log("Updated achievement progress bar");
  } else {
    console.error("achFill element not found!");
  }

  var grid = document.getElementById("achGrid");
  if (!grid) {
    console.error("Achievement grid element not found!");
    // Try alternate selectors
    grid = document.querySelector("#achGrid, .ach-grid, [id*='ach'][id*='grid']");
    if (grid) {
      console.log("Found achievement grid with alternate selector:", grid.id || grid.className);
    } else {
      console.error("Could not find achievement grid element at all!");
      return;
    }
  }
  
  console.log("Found achievement grid, clearing and populating...");
  grid.innerHTML = "";
  
  // Ensure we have achievement metadata
  if (!ACH_META || ACH_META.length === 0) {
    console.error("No ACH_META available!");
    grid.innerHTML = '<div class="col-12"><div class="alert alert-warning">No achievements available. Please refresh the page.</div></div>';
    return;
  }
  
  for (var i = 0; i < ACH_META.length; i++) {
    var a = ACH_META[i];
    var ok = !!got[a.id];
    
    console.log("Processing achievement:", a.title, "- unlocked:", ok);
    
    var col = document.createElement("div");
    col.className = "col-md-6 col-xl-4";
    col.innerHTML =
      '<div class="ach-card ' + (ok ? "unlocked" : "locked") + '">' +
      '<div class="ach-ico-wrap"><i class="fas ' + a.icon + '"></i></div>' +
      '<div><div class="ach-name">' + a.title + '</div>' +
      '<div class="ach-desc">' + a.desc + '</div>' +
      '<span class="ach-status ' + (ok ? "unlocked" : "locked") + '">' + (ok ? "UNLOCKED" : "LOCKED") + '</span>' +
      '</div></div>';
    grid.appendChild(col);
  }
  
  console.log("Added", ACH_META.length, "achievement items to grid");
  console.log("Achievements screen rendering complete");
}

// --- SETTINGS SCREEN ---------------------------------------------------------

// Read the current window.NS values and update every toggle, slider,
// and dropdown in the Settings screen to match.
function syncSettingsUI() {
  var n = window.NS;
  var d = loadData();
  var toggleIds = ["t-music","t-sfx","t-autofire","t-hitmarkers","t-particles","t-scanlines","t-shake","t-mobile"];
  var toggleVals = [n.music, n.sfx, n.autofire, n.hitmarkers, n.particles, n.scanlines, n.shake, n.mobile];
  
  for (var i = 0; i < toggleIds.length; i++) {
    var el = document.getElementById(toggleIds[i]);
    if (el) el.classList.toggle("on", toggleVals[i]);
  }
  
  var volEl = document.getElementById("s-volume");
  if (volEl) volEl.value = n.volume;
  var volVal = document.getElementById("volumeVal");
  if (volVal) volVal.textContent = n.volume;
  
  var senEl = document.getElementById("s-sensitivity");
  if (senEl) senEl.value = n.sensitivity;
  var senVal = document.getElementById("sensitivityVal");
  if (senVal) senVal.textContent = n.sensitivity;
  
  var diffEl = document.getElementById("s-difficulty");
  if (diffEl) diffEl.value = n.difficulty;
  
  var themeEl = document.getElementById("s-theme");
  if (themeEl) themeEl.value = d.theme || "space";
  
  var totalTimeEl = document.getElementById("totalPlayTime");
  if (totalTimeEl) totalTimeEl.textContent = formatPlaytime(d.totalSeconds || 0);
}

function updateSkinLockState() {
  // All skins are unlocked by default for now
  var cards = document.querySelectorAll(".ship-select-card, .skin-tile");
  for (var i = 0; i < cards.length; i++) {
    cards[i].classList.remove("locked");
  }
}

function drawSkinPreviews() {
  console.log("=== Drawing Skin Previews ===");
  var canvases = document.querySelectorAll(".skin-canvas");
  console.log("Found skin canvases:", canvases.length);
  
  for (var i = 0; i < canvases.length; i++) {
    var canvas = canvases[i];
    var skinId = parseInt(canvas.getAttribute("data-skin")) || 0;
    var ctx = canvas.getContext("2d");
    var color = SKIN_PALETTE[skinId] || "#00aaff";
    
    console.log("Drawing preview for skin", skinId, "with color", color);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw ship preview
    if (typeof drawShipPreviewOnCtx === 'function') {
      drawShipPreviewOnCtx(ctx, canvas.width / 2, canvas.height / 2, color, Date.now() / 1000, -Math.PI/2, skinId);
    } else {
      // Fallback drawing
      ctx.fillStyle = color;
      ctx.fillRect(canvas.width/2 - 15, canvas.height/2 - 20, 30, 40);
    }
  }
}

window.syncSettingsUI = syncSettingsUI;
window.updateSkinLockState = updateSkinLockState;
window.drawSkinPreviews = drawSkinPreviews;

// Show or hide the CRT scanline overlay based on the current setting.
function applyScanlines() {
  const el = document.getElementById("scanlines");
  if (el) el.style.display = window.NS && window.NS.scanlines ? "block" : "none";
}

// Set up click handling for the ship-selection grid in Settings.
// Clicking a card updates window.selectedSkin and applies that ship's stat bonuses.
function initSkinGrid() {
  var grid = document.getElementById("skinGrid");
  if (!grid) return;
  grid.addEventListener("click", function(e) {
    var card = e.target;
    while (card && !card.classList.contains("ship-select-card") && !card.classList.contains("skin-tile")) {
      card = card.parentElement;
    }
    if (!card) return;
    var id = +card.getAttribute("data-skin");
    window.selectedSkin = id;
    // Update active state
    var cards = grid.querySelectorAll(".ship-select-card, .skin-tile");
    for (var i = 0; i < cards.length; i++) cards[i].classList.remove("active");
    card.classList.add("active");
    persistNS();
    // Apply ship stat bonuses
    applyShipStats(id);
  });
  // Set initial active state
  var initId = window.selectedSkin || 0;
  var initCards = grid.querySelectorAll(".ship-select-card, .skin-tile");
  for (var j = 0; j < initCards.length; j++) {
    initCards[j].classList.toggle("active", +initCards[j].getAttribute("data-skin") === initId);
  }
}

// Apply the speed, shield, and fire-rate bonuses for the chosen ship skin.
// Writes the bonuses into window.NS so game.js can read them at game start.
function applyShipStats(skinId) {
  var bonuses = [
    {speed:0,  shield:0,   fireRate:0},   // NOVA (ship1.png) - Balanced fighter
    {speed:2,  shield:-20, fireRate:1},   // CRIMSON (ship3.png) - Fast interceptor
    {speed:-1, shield:30,  fireRate:0},   // PHANTOM (fighter.png) - Heavy armor
    {speed:1,  shield:-10, fireRate:2},   // SPECTRE (ship4.png) - Rapid fire specialist
  ];
  window.NS = window.NS || {};
  var b = bonuses[skinId] || bonuses[0];
  window.NS.shipSpeedBonus  = b.speed;
  window.NS.shipShieldBonus = b.shield;
  window.NS.shipFireBonus   = b.fireRate;
  
  console.log('Applied ship stats for ship', skinId, ':', b);
}
window.applyShipStats = applyShipStats;

// Wire up the volume slider, sensitivity slider, and difficulty dropdown
// so changes are saved to localStorage immediately.
function bindSettingsInputs() {
  var volEl = document.getElementById("s-volume");
  if (volEl) {
    volEl.addEventListener("input", function(e) {
      window.NS.volume = +e.target.value;
      var valEl = document.getElementById("volumeVal");
      if (valEl) valEl.textContent = e.target.value;
      persistNS();
    });
  }
  var senEl = document.getElementById("s-sensitivity");
  if (senEl) {
    senEl.addEventListener("input", function(e) {
      window.NS.sensitivity = +e.target.value;
      var valEl = document.getElementById("sensitivityVal");
      if (valEl) valEl.textContent = e.target.value;
      persistNS();
    });
  }
  var diffEl = document.getElementById("s-difficulty");
  if (diffEl) {
    diffEl.addEventListener("change", function(e) {
      window.NS.difficulty = e.target.value;
      persistNS();
    });
  }
}

function initNav() {
  console.log("=== Initializing Navigation System ===");
  
  // Track touch start position to distinguish scroll from tap
  var _touchStartX = 0;
  var _touchStartY = 0;
  var _touchMoved  = false;

  function handleNav(target) {
    console.log("Navigation triggered for target:", target);
    
    // Close Bootstrap navbar collapse on mobile after clicking link
    var navCollapse = document.getElementById("nsNavLinks");
    if (navCollapse && navCollapse.classList.contains("show")) {
      navCollapse.classList.remove("show");
      var toggler = document.querySelector(".navbar-toggler");
      if (toggler) toggler.setAttribute("aria-expanded", "false");
    }
    
    // Call showScreen with the target
    if (typeof window.showScreen === 'function') {
      window.showScreen(target);
    } else {
      console.error("showScreen function not available");
    }
  }

  function getTarget(el) {
    for (var i = 0; i < 6; i++) {
      if (!el) return null;
      var t = el.getAttribute && el.getAttribute("data-target");
      if (t) {
        console.log("Found data-target:", t, "on element:", el.tagName);
        return t;
      }
      el = el.parentElement;
    }
    return null;
  }

  // Record where touch started
  document.addEventListener("touchstart", function(e) {
    _touchStartX = e.touches[0].clientX;
    _touchStartY = e.touches[0].clientY;
    _touchMoved  = false;
  }, { passive: true });

  // If finger moved more than 8px it's a scroll, not a tap
  document.addEventListener("touchmove", function(e) {
    var dx = Math.abs(e.touches[0].clientX - _touchStartX);
    var dy = Math.abs(e.touches[0].clientY - _touchStartY);
    if (dx > 8 || dy > 8) _touchMoved = true;
  }, { passive: true });

  // Only navigate on touchend if the finger did NOT scroll
  document.addEventListener("touchend", function(e) {
    if (_touchMoved) return;
    var target = getTarget(e.target);
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    handleNav(target);
  }, false);

  // Enhanced click handler for desktop / mouse
  document.addEventListener("click", function(e) {
    console.log("Click detected on:", e.target.tagName, e.target.className);
    
    var target = getTarget(e.target);
    if (!target) {
      // Check for specific navigation elements that might not have data-target
      var element = e.target;
      
      // Check if it's a navigation link
      if (element.classList.contains('ns-link') || element.closest('.ns-link')) {
        var linkEl = element.classList.contains('ns-link') ? element : element.closest('.ns-link');
        target = linkEl.getAttribute('data-target');
        console.log("Found ns-link with target:", target);
      }
      
      // Check if it's a dropdown item
      if (element.classList.contains('ns-dd-item') || element.closest('.ns-dd-item')) {
        var ddEl = element.classList.contains('ns-dd-item') ? element : element.closest('.ns-dd-item');
        target = ddEl.getAttribute('data-target');
        console.log("Found dropdown item with target:", target);
      }
      
      if (!target) return;
    }
    
    console.log("Navigation click for target:", target);
    e.preventDefault();
    e.stopPropagation();
    handleNav(target);
  }, false);
  
  console.log("Navigation system initialized");
}

function initBgCanvas() {
  var c = document.getElementById("bgCanvas");
  if (!c) return;
  var ctx2 = c.getContext("2d");
  var stars = [];
  function resize() {
    c.width = innerWidth;
    c.height = innerHeight;
    stars = [];
    for (var i = 0; i < 160; i++) {
      stars.push({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        s: 0.2 + Math.random() * 1.4,
        v: 0.1 + Math.random() * 0.45,
        a: 0.08 + Math.random() * 0.35,
        tw: 0.3 + Math.random() * 2.5,
        to: Math.random() * Math.PI * 2
      });
    }
  }
  resize();
  window.addEventListener("resize", resize);
  function loop(t) {
    var ts = t / 1000;
    ctx2.fillStyle = "#050520";
    ctx2.fillRect(0, 0, c.width, c.height);
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      st.y += st.v;
      if (st.y > c.height) { st.y = 0; st.x = Math.random() * c.width; }
      var twinkle = st.a * (0.65 + 0.35 * Math.sin(ts * st.tw + st.to));
      ctx2.fillStyle = "rgba(200,230,255," + twinkle + ")";
      ctx2.beginPath();
      ctx2.arc(st.x, st.y, st.s, 0, Math.PI * 2);
      ctx2.fill();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function initCursor() {
  var cur = document.getElementById("cursor");
  if (!cur) return;
  window.addEventListener("mousemove", function(e) {
    cur.style.left = e.clientX + "px";
    cur.style.top = e.clientY + "px";
  });
}

function initSplash() {
  console.log("=== initSplash called - OVERRIDING TO SKIP ===");
  
  // Don't do any loading animation - just transition immediately
  setTimeout(function() {
    console.log("initSplash: Immediate transition to menu");
    
    // Use the aggressive showScreen method
    if (typeof window.showScreen === 'function') {
      window.showScreen("menu");
    } else {
      // Manual fallback
      var splash = document.getElementById("screen-splash");
      var menu = document.getElementById("screen-menu");
      
      if (splash && menu) {
        splash.style.display = "none";
        splash.classList.add("hidden");
        menu.style.display = "flex";
        menu.classList.remove("hidden");
        menu.classList.add("active");
      }
    }
  }, 100);
  
  // Also set up skip buttons immediately
  var skipBtns = document.querySelectorAll('[onclick*="showScreen"], #splashSkip');
  for (var i = 0; i < skipBtns.length; i++) {
    skipBtns[i].addEventListener("click", function() {
      console.log("Skip button clicked");
      window.showScreen("menu");
    });
  }
}

function initMenuShipLoop() {
  var sc = document.getElementById("menuShipCanvas");
  if (!sc) return;
  var mctx = sc.getContext("2d");
  var t0 = 0;
  function loop(t) {
    if (!t0) t0 = t;
    var a = (t - t0) / 1000;
    var menuEl = document.getElementById("screen-menu");
    // check active class instead of style.display (showScreen uses CSS classes)
    if (menuEl && menuEl.classList.contains("active")) {
      mctx.clearRect(0, 0, sc.width, sc.height);
      var col = SKIN_PALETTE[window.selectedSkin || 0];
      drawShipOnCtx(mctx, sc.width / 2, sc.height * 0.48 + Math.sin(a * 1.2) * 10, col, a);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function initLevelPreviews() {
  var colors = ["#00ffff", "#ffee00", "#ff7700", "#ff2d78", "#cc00ff"];
  var canvases = document.querySelectorAll(".lv-canvas");
  for (var ci = 0; ci < canvases.length; ci++) {
    (function(cv) {
      var lv = +cv.getAttribute("data-level") - 1;
      var col = colors[lv] || colors[0];
      var lctx = cv.getContext("2d");
      var rocks = [];
      function reset() {
        rocks = [];
        for (var i = 0; i < 6 + lv * 2; i++) {
          rocks.push({
            x: Math.random() * cv.width,
            y: Math.random() * cv.height,
            r: 6 + Math.random() * 14,
            vy: 0.5 + Math.random() * (1 + lv * 0.4)
          });
        }
      }
      reset();
      function loop() {
        if (!cv.isConnected) return;
        var g = lctx.createLinearGradient(0, 0, 0, cv.height);
        g.addColorStop(0, "#050520");
        g.addColorStop(1, "#0a0a35");
        lctx.fillStyle = g;
        lctx.fillRect(0, 0, cv.width, cv.height);
        lctx.strokeStyle = col + "44";
        lctx.lineWidth = 1;
        lctx.strokeRect(0.5, 0.5, cv.width - 1, cv.height - 1);
        for (var i = 0; i < rocks.length; i++) {
          var rock = rocks[i];
          rock.y += rock.vy;
          if (rock.y > cv.height + rock.r) { rock.y = -rock.r; rock.x = Math.random() * cv.width; }
          lctx.fillStyle = col + "55";
          lctx.beginPath();
          lctx.arc(rock.x, rock.y, rock.r, 0, Math.PI * 2);
          lctx.fill();
        }
        requestAnimationFrame(loop);
      }
      loop();
    })(canvases[ci]);
  }
}

hydrateNS();

document.addEventListener("DOMContentLoaded", function() {
  console.log("=== DOM Content Loaded ===");
  console.log("Available functions:");
  console.log("- launchGame:", typeof window.launchGame);
  console.log("- startGame:", typeof window.startGame);
  console.log("- showScreen:", typeof window.showScreen);
  console.log("- loadData:", typeof window.loadData);
  console.log("- saveData:", typeof window.saveData);
  
  // Initialize player data and check for first-time setup
  const data = loadData();
  if (!data.welcomeShown) {
    // First time player - give them some starting resources and show welcome
    setTimeout(() => {
      showRewardPopup(
        "WELCOME TO NOVA STRIKE!",
        "You've been awarded 100 starting coins. Visit the shop to upgrade your arsenal!",
        "fas fa-rocket",
        "#00ff88"
      );
      
      // Award first launch achievement
      checkAchievements();
    }, 2000);
    
    saveData({ welcomeShown: true });
  }
  
  // Verify splash screen elements exist
  var splash = document.getElementById("screen-splash");
  var loaderFill = document.getElementById("loaderFill");
  var loaderPct = document.getElementById("loaderPct");
  
  console.log("Splash screen elements check:");
  console.log("- splash screen:", !!splash);
  console.log("- loader fill:", !!loaderFill);
  console.log("- loader pct:", !!loaderPct);
  
  // Emergency fallback if splash gets stuck
  setTimeout(function() {
    var splash = document.getElementById("screen-splash");
    if (splash && !splash.classList.contains("hidden")) {
      console.log("Emergency fallback: splash still visible after 8 seconds, forcing menu");
      showScreen("menu");
    }
  }, 8000);
  
  // Add direct event handlers for navigation buttons that might not be working
  setTimeout(function() {
    console.log("=== Adding direct navigation handlers ===");
    
    // Find all navigation links and add direct handlers
    var navLinks = document.querySelectorAll('[data-target]');
    console.log("Found navigation elements with data-target:", navLinks.length);
    
    for (var i = 0; i < navLinks.length; i++) {
      var link = navLinks[i];
      var target = link.getAttribute('data-target');
      
      if (target) {
        console.log("Adding handler for:", target, "on", link.tagName);
        
        // Remove any existing onclick handlers that might conflict
        link.removeAttribute('onclick');
        
        // Add new click handler
        (function(targetScreen) {
          link.addEventListener('click', function(e) {
            console.log("Direct handler triggered for:", targetScreen);
            e.preventDefault();
            e.stopPropagation();
            
            if (typeof window.showScreen === 'function') {
              window.showScreen(targetScreen);
            } else {
              console.error("showScreen not available");
            }
          });
        })(target);
      }
    }
    
    // Special handlers for specific problematic buttons
    var howToPlayBtn = document.querySelector('[data-target="howtoplay"]');
    var levelSelectBtn = document.querySelector('[data-target="levels"]');
    
    if (howToPlayBtn) {
      console.log("Adding special handler for How to Play button");
      howToPlayBtn.addEventListener('click', function(e) {
        console.log("How to Play button clicked");
        e.preventDefault();
        window.showScreen('howtoplay');
      });
    }
    
    if (levelSelectBtn) {
      console.log("Adding special handler for Level Select button");
      levelSelectBtn.addEventListener('click', function(e) {
        console.log("Level Select button clicked");
        e.preventDefault();
        window.showScreen('levels');
      });
    }
    
    // Also check for buttons with onclick attributes that call showScreen
    var onclickBtns = document.querySelectorAll('[onclick*="showScreen"]');
    console.log("Found buttons with showScreen onclick:", onclickBtns.length);
    
    for (var j = 0; j < onclickBtns.length; j++) {
      var btn = onclickBtns[j];
      var onclick = btn.getAttribute('onclick');
      console.log("Button onclick:", onclick);
      
      // Extract the screen name from onclick
      var match = onclick.match(/showScreen\(['"]([^'"]+)['"]\)/);
      if (match) {
        var screenName = match[1];
        console.log("Adding backup handler for onclick button:", screenName);
        
        (function(screen) {
          btn.addEventListener('click', function(e) {
            console.log("Backup onclick handler for:", screen);
            // Don't prevent default here as onclick should work
            if (typeof window.showScreen === 'function') {
              window.showScreen(screen);
            }
          });
        })(screenName);
      }
    }
    
  }, 1000);
  
  initNav();
  initBgCanvas();
  initCursor();
  initSplash();
  initMenuShipLoop();
  initLevelPreviews();
  initSkinGrid();
  bindSettingsInputs();
  applyScanlines();
  refreshMenuStats();
  updateNavPilot();
  loadSavedTheme();

  // Real-time data updates every 3 seconds
  setInterval(function() {
    try { refreshMenuStats(); } catch(e) { console.error("refreshMenuStats error:", e); }
    try { updateNavRewards(); } catch(e) { console.error("updateNavRewards error:", e); }
    // Update profile if visible
    var profileEl = document.getElementById("screen-profile");
    if (profileEl && profileEl.style.display !== "none") {
      try { refreshProfileScreen(); } catch(e) { console.error("refreshProfileScreen error:", e); }
    }
    // Update leaderboard if visible
    var lbEl = document.getElementById("screen-leaderboard");
    if (lbEl && lbEl.style.display !== "none") {
      try { renderLeaderboard(); } catch(e) { console.error("renderLeaderboard error:", e); }
    }
  }, 3000);

  // Always go to menu after splash for better user experience
  window._afterSplash = "menu";
});

// Test function to directly show game screen
window.testShowGameScreen = function() {
  console.log("=== Testing direct screen switch ===");
  
  // Get all screens
  var screens = document.querySelectorAll(".ns-screen");
  console.log("Found screens:", screens.length);
  
  // Hide all screens
  for (var i = 0; i < screens.length; i++) {
    screens[i].classList.add("hidden");
    screens[i].classList.remove("active");
    console.log("Hidden screen:", screens[i].id);
  }
  
  // Show game screen
  var gameScreen = document.getElementById("screen-game");
  if (gameScreen) {
    console.log("Found game screen, showing it");
    gameScreen.classList.remove("hidden");
    gameScreen.classList.add("active");
    console.log("Game screen classes:", gameScreen.className);
    
    // Also show game nav
    var gameNav = document.getElementById("gameNav");
    if (gameNav) {
      gameNav.classList.remove("hidden");
      console.log("Game nav shown");
    }
    
    return true;
  } else {
    console.error("Game screen not found!");
    return false;
  }
};

// Test function to force menu screen
window.forceMenuScreen = function() {
  console.log("=== Forcing menu screen ===");
  showScreen("menu");
};

// Test function to check splash screen state
window.checkSplashState = function() {
  var splash = document.getElementById("screen-splash");
  var fill = document.getElementById("loaderFill");
  var pct = document.getElementById("loaderPct");
  
  console.log("=== Splash Screen State ===");
  console.log("Splash element:", !!splash);
  console.log("Splash hidden:", splash ? splash.classList.contains("hidden") : "N/A");
  console.log("Splash classes:", splash ? splash.className : "N/A");
  console.log("Loader fill:", !!fill);
  console.log("Loader width:", fill ? fill.style.width : "N/A");
  console.log("Loader pct:", !!pct);
  console.log("Loader pct text:", pct ? pct.textContent : "N/A");
  
  return {
    splash: !!splash,
    hidden: splash ? splash.classList.contains("hidden") : null,
    fill: fill ? fill.style.width : null,
    pct: pct ? pct.textContent : null
  };
};

window.showToast = showToast;
window.loadData = loadData;
window.saveData = saveData;
window.hydrateNS = hydrateNS;
window.persistNS = persistNS;

/* 
   AUTH  Login / Signup / Guest / Profile
 */

function getAuthUser() {
  try { return JSON.parse(localStorage.getItem("ns_user")) || null; } catch(e) { return null; }
}
function setAuthUser(u) {
  localStorage.setItem("ns_user", JSON.stringify(u));
}
function clearAuthUser() {
  localStorage.removeItem("ns_user");
}

function doLogin() {
  var name = document.getElementById("loginName").value.trim();
  var pass = document.getElementById("loginPass").value;
  var err  = document.getElementById("loginError");
  if (!name || !pass) { err.classList.remove("hidden"); err.textContent = "Enter callsign and password"; return; }
  // Load stored users
  var users = {};
  try { users = JSON.parse(localStorage.getItem("ns_users")) || {}; } catch(e) {}
  if (!users[name] || users[name].pass !== pass) {
    err.classList.remove("hidden"); err.textContent = "Invalid callsign or password"; return;
  }
  err.classList.add("hidden");
  setAuthUser({ name: name, joined: users[name].joined, isGuest: false });
  updateNavPilot();
  showScreen("menu");
  showToast("Welcome back, " + name + "!");
}
window.doLogin = doLogin;

function doSignup() {
  var name  = document.getElementById("signupName").value.trim();
  var pass  = document.getElementById("signupPass").value;
  var pass2 = document.getElementById("signupPass2").value;
  var err   = document.getElementById("signupError");
  if (!name) { err.classList.remove("hidden"); err.textContent = "Enter a callsign"; return; }
  if (pass.length < 4) { err.classList.remove("hidden"); err.textContent = "Password must be 4+ characters"; return; }
  if (pass !== pass2) { err.classList.remove("hidden"); err.textContent = "Passwords do not match"; return; }
  var users = {};
  try { users = JSON.parse(localStorage.getItem("ns_users")) || {}; } catch(e) {}
  if (users[name]) { err.classList.remove("hidden"); err.textContent = "Callsign already taken"; return; }
  err.classList.add("hidden");
  users[name] = { pass: pass, joined: Date.now() };
  localStorage.setItem("ns_users", JSON.stringify(users));
  setAuthUser({ name: name, joined: Date.now(), isGuest: false });
  updateNavPilot();
  showScreen("menu");
  showToast("Pilot " + name + " registered!");
}
window.doSignup = doSignup;

function doGuest() {
  setAuthUser({ name: "GUEST", joined: Date.now(), isGuest: true });
  updateNavPilot();
  showScreen("menu");
}
window.doGuest = doGuest;

function doLogout() {
  clearAuthUser();
  updateNavPilot();
  showScreen("login");
}
window.doLogout = doLogout;

function updateNavPilot() {
  var u = getAuthUser();
  var el = document.getElementById("navPilotName");
  if (el) el.textContent = u ? u.name : "Login";
}

function refreshProfileScreen() {
  var u = getAuthUser();
  var d = loadData();

  // Pilot info
  var nameEl = document.getElementById("profileName");
  if (nameEl) nameEl.textContent = u ? u.name : "GUEST";
  var tagEl = document.getElementById("profileTag");
  if (tagEl) tagEl.textContent = u && !u.isGuest ? "REGISTERED PILOT" : "GUEST PILOT";
  var joinedEl = document.getElementById("profileJoined");
  if (joinedEl && u) {
    var days = Math.floor((Date.now() - u.joined) / 86400000);
    joinedEl.textContent = days === 0 ? "Playing since today" : "Playing for " + days + " day" + (days > 1 ? "s" : "");
  }

  // Stats
  function setEl(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }
  setEl("psBestScore", (d.bestScore || 0).toLocaleString());
  setEl("psBestLevel", String(d.bestLevel || 1));
  setEl("psGames",     String(d.gamesPlayed || 0));
  setEl("psPlaytime",  formatPlaytime(d.totalSeconds || 0));
  setEl("psAsteroids", (d.totalAst || 0).toLocaleString());
  setEl("psMaxCombo",  "x" + (d.maxCombo || 1));
  setEl("psBossKills", String(d.bossKills || 0));
  setEl("psPowerups",  String(d.totalPU || 0));

  // Coins
  var coinsEl = document.getElementById("profileCoins");
  if (coinsEl) coinsEl.textContent = (d.coins || 0).toLocaleString();

  // Active perks in profile
  var perksEl = document.getElementById("psActivePerks");
  if (perksEl) {
    var owned = d.ownedRewards || {};
    var html = "";
    for (var key in owned) {
      for (var j = 0; j < REWARD_ITEMS.length; j++) {
        if (REWARD_ITEMS[j].id === key) {
          html += '<div class="reward-active-pill"><i class="fas ' + REWARD_ITEMS[j].icon + '"></i>' + REWARD_ITEMS[j].name + '</div>';
          break;
        }
      }
    }
    perksEl.innerHTML = html || '<div style="color:rgba(255,255,255,0.3);font-size:0.75rem">No active perks yet.</div>';
  }
  // Rank
  var rk = rankForScore(d.bestScore || 0);
  setEl("profileRankBadge", rk.letter);
  setEl("profileRankRing",  rk.letter);
  setEl("profileRankDesc",  rk.desc);
  var rankPct = Math.min(100, Math.round((d.bestScore || 0) / 80));
  var rb = document.getElementById("psRankBar");
  if (rb) rb.style.width = rankPct + "%";
  setEl("psRankVal", rk.letter);

  // Achievements
  var got = d.achievements || {};
  var achN = 0;
  for (var k in got) { if (got[k]) achN++; }
  var achPct = Math.round(achN / ACH_META.length * 100);
  var ab = document.getElementById("psAchBar");
  if (ab) ab.style.width = achPct + "%";
  setEl("psAchVal", achN + "/" + ACH_META.length);

  // Recent runs
  var rr = document.getElementById("psRecentRuns");
  if (rr) {
    var scores = (d.scores || []).slice(0, 5);
    if (scores.length === 0) {
      rr.innerHTML = '<div style="color:rgba(200,230,255,0.3);font-size:.78rem;text-align:center;padding:12px">No sorties yet  launch your first mission!</div>';
    } else {
      var html = "";
      for (var i = 0; i < scores.length; i++) {
        var s = scores[i];
        var rkl = rankForScore(s.score).letter;
        html += '<div class="recent-run">' +
          '<span class="rr-rank">' + rkl + '</span>' +
          '<span class="rr-score">' + s.score.toLocaleString() + '</span>' +
          '<span class="rr-level">LVL ' + s.level + '</span>' +
          '<span class="rr-time">' + formatDuration(s.time) + '</span>' +
          '</div>';
      }
      rr.innerHTML = html;
    }
  }
}
window.refreshProfileScreen = refreshProfileScreen;

/* ================================================================
   THEME SYSTEM
================================================================ */
var THEMES = {
  space: { bg0:"#0a0a2e", bg1:"#12124a", cyan:"#0088ff", pink:"#ff0066", gold:"#ffaa00", panel:"rgba(255,255,255,0.10)" },
  neon:  { bg0:"#0d0020", bg1:"#1a0035", cyan:"#ff00ff", pink:"#00ffff", gold:"#ffff00", panel:"rgba(255,0,255,0.08)" },
  fire:  { bg0:"#1a0000", bg1:"#2a0800", cyan:"#ff6600", pink:"#ff0000", gold:"#ffcc00", panel:"rgba(255,100,0,0.10)" },
  ice:   { bg0:"#001a2e", bg1:"#002a44", cyan:"#00ffee", pink:"#0088ff", gold:"#aaddff", panel:"rgba(0,255,238,0.08)" },
  gold:  { bg0:"#1a1000", bg1:"#2a1a00", cyan:"#ffaa00", pink:"#ff6600", gold:"#ffffff", panel:"rgba(255,170,0,0.10)" },
  light: { bg0:"#e8f0ff", bg1:"#d0e4ff", cyan:"#0055cc", pink:"#cc0044", gold:"#886600", panel:"rgba(0,0,0,0.08)" }
};

function applyTheme(name) {
  var t = THEMES[name] || THEMES.space;
  var root = document.documentElement;
  root.style.setProperty("--bg0",   t.bg0);
  root.style.setProperty("--bg1",   t.bg1);
  root.style.setProperty("--cyan",  t.cyan);
  root.style.setProperty("--pink",  t.pink);
  root.style.setProperty("--gold",  t.gold);
  root.style.setProperty("--panel", t.panel);
  // Update body background
  document.body.style.background = t.bg0;
  // Save preference
  saveData({ theme: name });
  // Update select and dots
  var sel = document.getElementById("s-theme");
  if (sel) sel.value = name;
  var dots = document.querySelectorAll(".theme-dot");
  for (var i = 0; i < dots.length; i++) {
    dots[i].classList.toggle("active", dots[i].getAttribute("data-theme") === name);
  }
}
window.applyTheme = applyTheme;

function loadSavedTheme() {
  var d = loadData();
  if (d.theme) applyTheme(d.theme);
}

/* ================================================================
   REWARDS SYSTEM
   - Coins earned per game based on score
   - Shop items with restrictions (level/score requirements)
   - Perks apply to next game session
================================================================ */

// --- REWARDS SHOP ------------------------------------------------------------
// Players spend coins earned during gameplay to buy perks, weapons, and upgrades.
// Each item has unlock requirements (games played, score, level, boss kills)
// that must be met before the Buy button becomes active.

var REWARD_ITEMS = [
  // Basic perks
  {
    id: "shield_boost",
    name: "SHIELD BOOST",
    desc: "Start each game with 150% shield instead of 100%.",
    icon: "fa-shield-alt",
    cost: 150,
    type: "perk",
    restriction: "Requires 1 completed game.",
    minGames: 1
  },
  {
    id: "double_coins",
    name: "COIN MAGNET",
    desc: "Earn 2x coins from every game for 5 runs.",
    icon: "fa-coins",
    cost: 200,
    type: "consumable",
    uses: 5,
    restriction: "Requires score 500+.",
    minScore: 500
  },
  {
    id: "rapid_start",
    name: "HOT START",
    desc: "Begin every game with Rapid Fire already active.",
    icon: "fa-fire",
    cost: 300,
    type: "perk",
    restriction: "Requires level 2 reached.",
    minLevel: 2
  },
  {
    id: "extra_life",
    name: "EXTRA LIFE",
    desc: "Start with 4 lives instead of 3.",
    icon: "fa-heart",
    cost: 250,
    type: "perk",
    restriction: "Requires 5 games played.",
    minGames: 5
  },
  // Weapon upgrades
  {
    id: "plasma_cannon",
    name: "PLASMA CANNON",
    desc: "Unlock dual plasma bolts with 2x damage.",
    icon: "fa-bolt",
    cost: 400,
    type: "weapon",
    restriction: "Requires level 3 reached.",
    minLevel: 3
  },
  {
    id: "laser_beam",
    name: "FOCUSED LASER",
    desc: "High-damage concentrated beam weapon.",
    icon: "fa-laser-pointer",
    cost: 600,
    type: "weapon",
    restriction: "Requires score 1500+.",
    minScore: 1500
  },
  {
    id: "homing_missiles",
    name: "HOMING MISSILES",
    desc: "Devastating guided missiles that track enemies.",
    icon: "fa-rocket",
    cost: 800,
    type: "weapon",
    restriction: "Requires boss defeated.",
    minBoss: 1
  },
  {
    id: "spread_shot",
    name: "SPREAD SHOT",
    desc: "Wide-area coverage with 5 simultaneous shots.",
    icon: "fa-expand-arrows-alt",
    cost: 500,
    type: "weapon",
    restriction: "Requires level 4 reached.",
    minLevel: 4
  },
  // Enhanced upgrades
  {
    id: "weapon_damage",
    name: "DAMAGE AMPLIFIER",
    desc: "Increase all weapon damage by 50%.",
    icon: "fa-crosshairs",
    cost: 750,
    type: "upgrade",
    restriction: "Requires 10 games played.",
    minGames: 10
  },
  {
    id: "fire_rate",
    name: "RAPID FIRE CORE",
    desc: "Permanently increase fire rate by 30%.",
    icon: "fa-tachometer-alt",
    cost: 650,
    type: "upgrade",
    restriction: "Requires score 2000+.",
    minScore: 2000
  },
  {
    id: "auto_repair",
    name: "AUTO REPAIR",
    desc: "Slowly regenerate shield over time.",
    icon: "fa-wrench",
    cost: 900,
    type: "upgrade",
    restriction: "Requires 15 games played.",
    minGames: 15
  },
  {
    id: "coin_multiplier",
    name: "COIN MULTIPLIER",
    desc: "Earn 3x coins from all sources permanently.",
    icon: "fa-coins",
    cost: 1200,
    type: "upgrade",
    restriction: "Requires score 3000+.",
    minScore: 3000
  },
  // New premium items
  {
    id: "nova_bomb_start",
    name: "NOVA STARTER",
    desc: "Begin each game with a Nova Bomb ready.",
    icon: "fa-bomb",
    cost: 450,
    type: "perk",
    restriction: "Requires 8 games played.",
    minGames: 8
  },
  {
    id: "shield_regen",
    name: "SHIELD REGENERATOR",
    desc: "Shield slowly regenerates during gameplay.",
    icon: "fa-heart-pulse",
    cost: 850,
    type: "upgrade",
    restriction: "Requires score 2500+.",
    minScore: 2500
  },
  {
    id: "magnet_field",
    name: "MAGNETIC FIELD",
    desc: "Automatically attract nearby power-ups and coins.",
    icon: "fa-magnet",
    cost: 550,
    type: "perk",
    restriction: "Requires 12 games played.",
    minGames: 12
  },
  {
    id: "score_multiplier",
    name: "SCORE BOOSTER",
    desc: "Earn 2x points from all sources.",
    icon: "fa-star",
    cost: 1000,
    type: "upgrade",
    restriction: "Requires level 5 reached.",
    minLevel: 5
  }
];

function getCoins() {
  return loadData().coins || 0;
}

function addCoins(amount) {
  var d = loadData();
  var mult = getActivePerk("double_coins") ? 2 : 1;
  var total = (d.coins || 0) + Math.round(amount * mult);
  saveData({ coins: total });
  return total;
}

function getOwnedRewards() {
  return loadData().ownedRewards || {};
}

function getActivePerk(id) {
  var owned = getOwnedRewards();
  return !!owned[id];
}

function isRewardUnlocked(item) {
  var d = loadData();
  if (item.minGames && (d.gamesPlayed || 0) < item.minGames) return false;
  if (item.minScore && (d.bestScore || 0) < item.minScore) return false;
  if (item.minLevel && (d.bestLevel || 1) < item.minLevel) return false;
  if (item.minBoss  && (d.bossKills || 0) < item.minBoss)  return false;
  return true;
}

// Process a reward purchase: check requirements, deduct coins, save ownership.
// Shows a toast on success or failure and re-renders the rewards screen.
function buyReward(id) {
  var item = null;
  for (var i = 0; i < REWARD_ITEMS.length; i++) {
    if (REWARD_ITEMS[i].id === id) { item = REWARD_ITEMS[i]; break; }
  }
  if (!item) return;

  if (!isRewardUnlocked(item)) {
    showToast("Requirement not met: " + item.restriction);
    return;
  }

  var coins = getCoins();
  if (coins < item.cost) {
    showToast("Not enough coins! Need " + item.cost + ", have " + coins);
    return;
  }

  var owned = getOwnedRewards();
  if (owned[id]) {
    showToast(item.name + " already owned!");
    return;
  }

  // Deduct coins and grant reward
  var d = loadData();
  owned[id] = { purchasedAt: Date.now(), uses: item.uses || -1 };
  saveData({ coins: coins - item.cost, ownedRewards: owned });
  showToast("Purchased: " + item.name + "!");
  renderRewardsScreen();
  
  // Update navigation rewards
  if (typeof updateNavRewards === 'function') {
    updateNavRewards();
  }
}
window.buyReward = buyReward;

function useRewardCharge(id) {
  var owned = getOwnedRewards();
  if (!owned[id]) return;
  if (owned[id].uses > 0) {
    owned[id].uses--;
    if (owned[id].uses <= 0) delete owned[id];
    saveData({ ownedRewards: owned });
  }
}

// Calculate how many coins the player earns for a completed run.
// Formula: 1 coin per 10 score points + level bonus + survival time bonus.
function coinsForRun(score, level, time) {
  var base = Math.floor(score / 10);
  var lvlBonus = level * 5;
  var timeBonus = Math.floor(time / 30) * 2;
  return Math.max(1, base + lvlBonus + timeBonus);
}

// Build the rewards shop screen: coin balance, item grid (owned/locked/buyable),
// and the "Active Perks" list at the bottom.
function renderRewardsScreen() {
  
  var d = loadData();
  var coins = d.coins || 0;
  var owned = d.ownedRewards || {};

  console.log("Player coins:", coins);
  console.log("Owned rewards:", owned);
  console.log("Available reward items:", REWARD_ITEMS.length);

  // Update balance
  var balEl = document.getElementById("rewardCoins");
  if (balEl) {
    balEl.textContent = coins.toLocaleString();
    console.log("Updated coin balance display");
  } else {
    console.error("rewardCoins element not found!");
  }

  // Render grid
  var grid = document.getElementById("rewardGrid");
  if (!grid) {
    console.error("Reward grid element not found!");
    // Try to find it with different selectors
    grid = document.querySelector("#rewardGrid, .reward-grid, [id*='reward']");
    if (grid) {
      console.log("Found reward grid with alternate selector:", grid.id || grid.className);
    } else {
      console.error("Could not find reward grid element at all!");
      return;
    }
  }
  
  console.log("Found reward grid, clearing and populating...");
  grid.innerHTML = "";

  // Ensure we have reward items
  if (!REWARD_ITEMS || REWARD_ITEMS.length === 0) {
    console.error("No REWARD_ITEMS available!");
    grid.innerHTML = '<div class="col-12"><div class="alert alert-warning">No rewards available. Please refresh the page.</div></div>';
    return;
  }

  for (var i = 0; i < REWARD_ITEMS.length; i++) {
    var item = REWARD_ITEMS[i];
    var isOwned = !!owned[item.id];
    var unlocked = isRewardUnlocked(item);
    var canAfford = coins >= item.cost;

    console.log("Processing reward:", item.name, "- owned:", isOwned, "unlocked:", unlocked, "canAfford:", canAfford);

    var col = document.createElement("div");
    col.className = "col-6 col-md-4 col-lg-3";

    var usesLeft = isOwned && owned[item.id] && owned[item.id].uses > 0 ? " (" + owned[item.id].uses + " left)" : "";
    var ownedTag = isOwned ? '<div class="reward-owned-tag">OWNED' + usesLeft + '</div>' : "";
    var lockNote = !unlocked ? '<div style="font-size:0.6rem;color:rgba(255,100,100,0.7);margin-top:2px">' + item.restriction + '</div>' : "";

    var btnHtml;
    if (isOwned) {
      btnHtml = '<button class="reward-buy-btn owned-btn" disabled>ACTIVE</button>';
    } else if (!unlocked) {
      btnHtml = '<button class="reward-buy-btn locked-btn" disabled>LOCKED</button>';
    } else if (!canAfford) {
      btnHtml = '<button class="reward-buy-btn" disabled>NEED ' + item.cost + ' COINS</button>';
    } else {
      btnHtml = '<button class="reward-buy-btn" onclick="buyReward(\'' + item.id + '\')">BUY FOR ' + item.cost + ' COINS</button>';
    }

    col.innerHTML =
      '<div class="reward-card' + (isOwned ? " owned" : "") + (!unlocked ? " locked" : "") + '">' +
      ownedTag +
      '<div class="reward-card-icon"><i class="fas ' + item.icon + '"></i></div>' +
      '<div class="reward-card-name">' + item.name + '</div>' +
      '<div class="reward-card-desc">' + item.desc + '</div>' +
      lockNote +
      '<div class="reward-card-cost' + (item.cost === 0 ? " free" : "") + '"><i class="fas fa-coins"></i> ' + item.cost + '</div>' +
      btnHtml +
      '</div>';
    grid.appendChild(col);
  }

  console.log("Added", REWARD_ITEMS.length, "reward items to grid");

  // Active perks list
  var activeEl = document.getElementById("activePerks");
  if (activeEl) {
    var html = "";
    var activeCount = 0;
    for (var key in owned) {
      for (var j = 0; j < REWARD_ITEMS.length; j++) {
        if (REWARD_ITEMS[j].id === key) {
          html += '<div class="reward-active-pill"><i class="fas ' + REWARD_ITEMS[j].icon + '"></i> ' + REWARD_ITEMS[j].name + '</div>';
          activeCount++;
          break;
        }
      }
    }
    if (activeCount === 0) {
      html = '<div style="color:rgba(200,230,255,0.3);font-size:0.78rem;text-align:center;padding:20px;">No active perks. Buy rewards to unlock perks!</div>';
    }
    activeEl.innerHTML = html;
    console.log("Updated active perks display - found", activeCount, "active perks");
  } else {
    console.error("activePerks element not found!");
  }
  
  console.log("Rewards screen rendering complete");
}
window.renderRewardsScreen = renderRewardsScreen;

/* 
   WEAPON SHOP SYSTEM
   Purchase weapons and upgrades with coins
 */

// Add missing profile functions
function refreshProfileScreen() {
  console.log("=== Refreshing Profile Screen ===");
  
  var d = loadData();
  
  // Update pilot name if element exists
  var pilotNameEl = document.getElementById("profilePilotName");
  if (pilotNameEl) {
    pilotNameEl.textContent = d.callsign || "ANONYMOUS";
  }
  
  // Update stats if elements exist
  var statsElements = {
    "profileBestScore": (d.bestScore || 0).toLocaleString(),
    "profileBestLevel": String(d.bestLevel || 1),
    "profileGamesPlayed": String(d.gamesPlayed || 0),
    "profileTotalTime": formatPlaytime(d.totalSeconds || 0),
    "profileCoins": (d.coins || 0).toLocaleString(),
    "profileAchievements": Object.keys(d.achievements || {}).length + " / " + ACH_META.length
  };
  
  for (var id in statsElements) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = statsElements[id];
    }
  }
  
  console.log("Profile screen refreshed");
}

function updateNavPilot() {
  var d = loadData();
  var navPilotEl = document.getElementById("navPilotName");
  if (navPilotEl) {
    navPilotEl.textContent = d.callsign || "Profile";
  }
}

window.refreshProfileScreen = refreshProfileScreen;
window.updateNavPilot = updateNavPilot;

// Test function to verify reward system
window.testRewardSystem = function() {
  console.log("=== Testing Reward System ===");
  
  // Check if REWARD_ITEMS exists
  console.log("REWARD_ITEMS available:", !!REWARD_ITEMS);
  console.log("REWARD_ITEMS length:", REWARD_ITEMS ? REWARD_ITEMS.length : 0);
  
  // Check if ACH_META exists
  console.log("ACH_META available:", !!ACH_META);
  console.log("ACH_META length:", ACH_META ? ACH_META.length : 0);
  
  // Check current player data
  const data = loadData();
  console.log("Player data:", {
    coins: data.coins,
    achievements: Object.keys(data.achievements || {}).length,
    ownedRewards: Object.keys(data.ownedRewards || {}).length,
    gamesPlayed: data.gamesPlayed,
    bestScore: data.bestScore
  });
  
  // Test adding some coins
  const newCoins = (data.coins || 0) + 100;
  saveData({ coins: newCoins });
  console.log("Added 100 coins, new total:", newCoins);
  
  // Test rendering screens
  try {
    renderRewardsScreen();
    console.log("Rewards screen rendered successfully");
  } catch (e) {
    console.error("Error rendering rewards screen:", e);
  }
  
  try {
    renderAchievements();
    console.log("Achievements screen rendered successfully");
  } catch (e) {
    console.error("Error rendering achievements screen:", e);
  }
  
  try {
    initShopScreen();
    console.log("Shop screen initialized successfully");
  } catch (e) {
    console.error("Error initializing shop screen:", e);
  }
  
  console.log("Reward system test complete");
};

function initShopScreen() {
  console.log("=== Initializing Shop Screen ===");
  
  try {
    updateShopCurrency();
    console.log("Shop currency updated");
  } catch (e) {
    console.error("Error updating shop currency:", e);
  }
  
  try {
    renderWeaponShop();
    console.log("Weapon shop rendered");
  } catch (e) {
    console.error("Error rendering weapon shop:", e);
  }
  
  try {
    renderUpgradeShop();
    console.log("Upgrade shop rendered");
  } catch (e) {
    console.error("Error rendering upgrade shop:", e);
  }
  
  console.log("Shop screen initialization complete");
}

function updateShopCurrency() {
  // Get current game state or saved data
  const gameData = window.G || {};
  const savedData = loadData();
  
  const coins = gameData.coins || savedData.coins || 0;
  const xp = gameData.experience || savedData.experience || 0;
  const weaponsUnlocked = gameData.weaponsUnlocked || savedData.weaponsUnlocked || ["basic"];
  
  const coinsEl = document.getElementById("shopCoins");
  const xpEl = document.getElementById("shopXP");
  const weaponsEl = document.getElementById("shopWeapons");
  
  if (coinsEl) coinsEl.textContent = coins.toLocaleString();
  if (xpEl) xpEl.textContent = xp.toLocaleString();
  if (weaponsEl) weaponsEl.textContent = weaponsUnlocked.length;
}

function renderWeaponShop() {
  const grid = document.getElementById("weaponShopGrid");
  if (!grid) return;
  
  const gameData = window.G || {};
  const savedData = loadData();
  const coins = gameData.coins || savedData.coins || 0;
  const xp = gameData.experience || savedData.experience || 0;
  const weaponsUnlocked = gameData.weaponsUnlocked || savedData.weaponsUnlocked || ["basic"];
  const gamesPlayed = savedData.gamesPlayed || 0;
  const bestScore = savedData.bestScore || 0;
  const bestLevel = savedData.bestLevel || 1;
  const bossKills = savedData.bossKills || 0;
  
  // Define weapon definitions if not available
  const WEAPON_DEFS = window.WEAPON_DEFS || {
    basic: { name: "Basic Laser", damage: 1, description: "Standard ship weapon", cost: 0 },
    plasma: { name: "Plasma Cannon", damage: 2, description: "Dual plasma bolts with 2x damage", cost: 400 },
    spread: { name: "Spread Shot", damage: 1.5, description: "Wide area coverage with multiple shots", cost: 300 },
    laser: { name: "Focused Laser", damage: 3, description: "High-damage concentrated beam", cost: 600 },
    missile: { name: "Homing Missiles", damage: 4, description: "Devastating guided missiles", cost: 800 },
    railgun: { name: "Rail Gun", damage: 5, description: "Piercing shots that go through multiple enemies", cost: 1000 },
    nova: { name: "Nova Blaster", damage: 3.5, description: "Explosive rounds with area damage", cost: 750 },
    pulse: { name: "Pulse Rifle", damage: 2.5, description: "Rapid-fire energy bursts", cost: 550 },
    ion: { name: "Ion Cannon", damage: 4.5, description: "Disables enemy shields and systems", cost: 900 },
    quantum: { name: "Quantum Disruptor", damage: 6, description: "Ultimate weapon with reality-bending power", cost: 1500 }
  };
  
  // Enhanced weapon definitions with restrictions
  const weapons = [
    {
      id: "basic", 
      ...WEAPON_DEFS.basic, 
      cost: 0, 
      unlocked: true,
      purchasable: false,
      restriction: "Default weapon"
    },
    {
      id: "plasma", 
      ...WEAPON_DEFS.plasma, 
      unlocked: weaponsUnlocked.includes("plasma"),
      purchasable: gamesPlayed >= 2 && bestScore >= 300,
      restriction: "Requires: 2 games played + 300 best score"
    },
    {
      id: "spread", 
      ...WEAPON_DEFS.spread, 
      unlocked: weaponsUnlocked.includes("spread"),
      purchasable: bestLevel >= 2,
      restriction: "Requires: Reach level 2"
    },
    {
      id: "pulse", 
      ...WEAPON_DEFS.pulse, 
      unlocked: weaponsUnlocked.includes("pulse"),
      purchasable: gamesPlayed >= 5 && bestScore >= 800,
      restriction: "Requires: 5 games played + 800 best score"
    },
    {
      id: "laser", 
      ...WEAPON_DEFS.laser, 
      unlocked: weaponsUnlocked.includes("laser"),
      purchasable: bestScore >= 1200,
      restriction: "Requires: 1200 best score"
    },
    {
      id: "nova", 
      ...WEAPON_DEFS.nova, 
      unlocked: weaponsUnlocked.includes("nova"),
      purchasable: bestLevel >= 3 && bossKills >= 1,
      restriction: "Requires: Level 3 + defeat 1 boss"
    },
    {
      id: "missile", 
      ...WEAPON_DEFS.missile, 
      unlocked: weaponsUnlocked.includes("missile"),
      purchasable: bossKills >= 2,
      restriction: "Requires: Defeat 2 bosses"
    },
    {
      id: "ion", 
      ...WEAPON_DEFS.ion, 
      unlocked: weaponsUnlocked.includes("ion"),
      purchasable: bestScore >= 2500 && bestLevel >= 4,
      restriction: "Requires: 2500 best score + level 4"
    },
    {
      id: "railgun", 
      ...WEAPON_DEFS.railgun, 
      unlocked: weaponsUnlocked.includes("railgun"),
      purchasable: gamesPlayed >= 15 && bossKills >= 3,
      restriction: "Requires: 15 games + defeat 3 bosses"
    },
    {
      id: "quantum", 
      ...WEAPON_DEFS.quantum, 
      unlocked: weaponsUnlocked.includes("quantum"),
      purchasable: bestScore >= 5000 && bestLevel >= 5 && bossKills >= 5,
      restriction: "Requires: 5000 score + level 5 + defeat 5 bosses"
    }
  ];
  
  grid.innerHTML = "";
  
  weapons.forEach(weapon => {
    const canAfford = coins >= weapon.cost;
    const isOwned = weapon.unlocked;
    const canPurchase = weapon.purchasable && !isOwned;
    
    const col = document.createElement("div");
    col.className = "col-md-6 col-lg-4";
    
    let buttonHtml;
    let statusClass = "";
    
    if (weapon.cost === 0) {
      buttonHtml = '<button class="shop-btn owned" disabled>DEFAULT</button>';
      statusClass = "owned";
    } else if (isOwned) {
      buttonHtml = `<button class="shop-btn owned" onclick="selectWeapon('${weapon.id}')" title="Click to equip">OWNED - CLICK TO EQUIP</button>`;
      statusClass = "owned";
    } else if (!weapon.purchasable) {
      buttonHtml = `<button class="shop-btn locked" disabled>LOCKED</button>`;
      statusClass = "locked";
    } else if (!canAfford) {
      buttonHtml = `<button class="shop-btn" disabled>NEED ${weapon.cost} <i class="fas fa-coins"></i></button>`;
      statusClass = "locked";
    } else {
      buttonHtml = `<button class="shop-btn" onclick="purchaseWeapon('${weapon.id}', ${weapon.cost})">BUY FOR ${weapon.cost} <i class="fas fa-coins"></i></button>`;
    }
    
    col.innerHTML = `
      <div class="shop-item ${statusClass}">
        <div class="si-header">
          <div class="si-name">${weapon.name}</div>
          <div class="si-damage">DMG: ${weapon.damage}x</div>
        </div>
        <div class="si-desc">${weapon.description}</div>
        <div class="si-restriction">${weapon.restriction}</div>
        <div class="si-cost">
          ${weapon.cost === 0 ? '<i class="fas fa-gift"></i> FREE' : 
            `<i class="fas fa-coins"></i> ${weapon.cost}`}
        </div>
        ${buttonHtml}
      </div>
    `;
    
    grid.appendChild(col);
  });
}

function renderUpgradeShop() {
  const grid = document.getElementById("upgradeShopGrid");
  if (!grid) return;
  
  const gameData = window.G || {};
  const savedData = loadData();
  const coins = gameData.coins || savedData.coins || 0;
  const ownedUpgrades = savedData.ownedUpgrades || {};
  const gamesPlayed = savedData.gamesPlayed || 0;
  const bestScore = savedData.bestScore || 0;
  const bossKills = savedData.bossKills || 0;
  
  const upgrades = [
    {
      id: "damage_boost", 
      name: "Damage Amplifier", 
      cost: 750, 
      description: "+50% weapon damage", 
      icon: "fa-crosshairs",
      purchasable: gamesPlayed >= 10,
      restriction: "Requires: 10 games played"
    },
    {
      id: "fire_rate", 
      name: "Rapid Fire Core", 
      cost: 650, 
      description: "+30% fire rate", 
      icon: "fa-tachometer-alt",
      purchasable: bestScore >= 2000,
      restriction: "Requires: 2000 best score"
    },
    {
      id: "auto_repair", 
      name: "Auto Repair", 
      cost: 900, 
      description: "Shield regeneration", 
      icon: "fa-wrench",
      purchasable: gamesPlayed >= 15,
      restriction: "Requires: 15 games played"
    },
    {
      id: "coin_multiplier", 
      name: "Coin Multiplier", 
      cost: 1200, 
      description: "3x coin earnings", 
      icon: "fa-coins",
      purchasable: bossKills >= 3,
      restriction: "Requires: Defeat 3 bosses"
    }
  ];
  
  grid.innerHTML = "";
  
  upgrades.forEach(upgrade => {
    const canAfford = coins >= upgrade.cost;
    const isOwned = !!ownedUpgrades[upgrade.id];
    const canPurchase = upgrade.purchasable && !isOwned;
    
    const col = document.createElement("div");
    col.className = "col-md-6 col-lg-4";
    
    let buttonHtml;
    let statusClass = "";
    
    if (isOwned) {
      buttonHtml = '<button class="shop-btn owned" disabled>OWNED & ACTIVE</button>';
      statusClass = "owned";
    } else if (!upgrade.purchasable) {
      buttonHtml = '<button class="shop-btn locked" disabled>LOCKED</button>';
      statusClass = "locked";
    } else if (!canAfford) {
      buttonHtml = `<button class="shop-btn" disabled>NEED ${upgrade.cost} <i class="fas fa-coins"></i></button>`;
      statusClass = "locked";
    } else {
      buttonHtml = `<button class="shop-btn" onclick="purchaseUpgrade('${upgrade.id}', ${upgrade.cost})">BUY FOR ${upgrade.cost} <i class="fas fa-coins"></i></button>`;
    }
    
    col.innerHTML = `
      <div class="shop-item ${statusClass}">
        <div class="si-header">
          <div class="si-icon"><i class="fas ${upgrade.icon}"></i></div>
          <div class="si-name">${upgrade.name}</div>
        </div>
        <div class="si-desc">${upgrade.description}</div>
        <div class="si-restriction">${upgrade.restriction}</div>
        <div class="si-cost">
          <i class="fas fa-coins"></i> ${upgrade.cost}
        </div>
        ${buttonHtml}
      </div>
    `;
    
    grid.appendChild(col);
  });
}

function purchaseWeapon(weaponId, cost) {
  const gameData = window.G || {};
  const savedData = loadData();
  const currentCoins = gameData.coins || savedData.coins || 0;
  
  if (currentCoins < cost) {
    showToast("Not enough coins!");
    return;
  }
  
  // Check if already unlocked
  const weaponsUnlocked = gameData.weaponsUnlocked || savedData.weaponsUnlocked || ["basic"];
  if (weaponsUnlocked.includes(weaponId)) {
    showToast("Weapon already unlocked!");
    return;
  }
  
  // Deduct coins
  const newCoins = currentCoins - cost;
  if (window.G) window.G.coins = newCoins;
  
  // Add weapon to unlocked list
  const newWeaponsUnlocked = [...weaponsUnlocked, weaponId];
  if (window.G) window.G.weaponsUnlocked = newWeaponsUnlocked;
  
  // Save to localStorage
  saveData({
    coins: newCoins,
    weaponsUnlocked: newWeaponsUnlocked
  });
  
  // Get weapon name from definitions
  const WEAPON_DEFS = window.WEAPON_DEFS || {
    basic: { name: "Basic Laser" },
    plasma: { name: "Plasma Cannon" },
    spread: { name: "Spread Shot" },
    laser: { name: "Focused Laser" },
    missile: { name: "Homing Missiles" }
  };
  
  const weaponName = WEAPON_DEFS[weaponId] ? WEAPON_DEFS[weaponId].name : weaponId.toUpperCase();
  showToast(`${weaponName} purchased!`);
  
  // Show Dream League Soccer style reward popup
  showRewardPopup(
    `${weaponName.toUpperCase()} UNLOCKED!`,
    "New weapon available in your arsenal!",
    "fas fa-rocket",
    "#00ff88"
  );
  
  // Refresh shop display
  initShopScreen();
}

function purchaseUpgrade(upgradeId, cost) {
  const gameData = window.G || {};
  const savedData = loadData();
  const currentCoins = gameData.coins || savedData.coins || 0;
  
  if (currentCoins < cost) {
    showToast("Not enough coins!");
    return;
  }
  
  // Deduct coins
  const newCoins = currentCoins - cost;
  if (window.G) window.G.coins = newCoins;
  
  // Add upgrade to owned list
  const ownedUpgrades = savedData.ownedUpgrades || {};
  ownedUpgrades[upgradeId] = { purchasedAt: Date.now() };
  
  // Save to localStorage
  saveData({
    coins: newCoins,
    ownedUpgrades: ownedUpgrades
  });
  
  const upgradeName = upgradeId.replace('_', ' ').toUpperCase();
  showToast(`${upgradeName} purchased!`);
  
  // Show Dream League Soccer style reward popup
  showRewardPopup(
    `${upgradeName} ACTIVATED!`,
    "Upgrade permanently applied to your ship!",
    "fas fa-cog",
    "#ffd700"
  );
  
  // Refresh shop display
  initShopScreen();
}

// Dream League Soccer style reward popup
function showRewardPopup(title, description, icon, color = "#ffd700") {
  // Remove any existing popup
  const existingPopup = document.querySelector('.reward-popup');
  if (existingPopup) {
    existingPopup.remove();
  }
  
  const popup = document.createElement("div");
  popup.className = "reward-popup";
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.8);
    background: linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,60,0.95));
    border: 3px solid ${color};
    border-radius: 16px;
    padding: 30px 25px;
    z-index: 10000;
    text-align: center;
    min-width: 300px;
    max-width: 90vw;
    box-shadow: 0 0 30px ${color}80, inset 0 0 20px rgba(255,255,255,0.1);
    animation: rewardPopupShow 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  `;
  
  popup.innerHTML = `
    <div style="font-size: 3rem; color: ${color}; margin-bottom: 15px; text-shadow: 0 0 20px ${color};">
      <i class="${icon}"></i>
    </div>
    <div style="font-family: 'Orbitron', monospace; font-size: 1.2rem; font-weight: 900; color: #ffffff; margin-bottom: 8px; text-shadow: 0 0 10px #ffffff;">
      ${title}
    </div>
    <div style="font-size: 0.9rem; color: rgba(255,255,255,0.8); line-height: 1.4; margin-bottom: 20px;">
      ${description}
    </div>
    <button onclick="this.parentElement.remove()" style="
      background: linear-gradient(135deg, ${color}, ${color}cc);
      border: none;
      color: #000;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      font-family: 'Orbitron', monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
      transition: all 0.2s;
    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
      AWESOME!
    </button>
  `;
  
  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes rewardPopupShow {
      0% { 
        transform: translate(-50%, -50%) scale(0.5);
        opacity: 0;
      }
      50% {
        transform: translate(-50%, -50%) scale(1.1);
      }
      100% { 
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(popup);
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    if (popup.parentElement) {
      popup.style.animation = 'rewardPopupShow 0.3s reverse';
      setTimeout(() => popup.remove(), 300);
    }
  }, 4000);
}

window.initShopScreen = initShopScreen;
window.purchaseWeapon = purchaseWeapon;
window.purchaseUpgrade = purchaseUpgrade;
window.showRewardPopup = showRewardPopup;

// Weapon selection system
function selectWeapon(weaponId) {
  const savedData = loadData();
  const weaponsUnlocked = savedData.weaponsUnlocked || ["basic"];
  
  if (weaponsUnlocked.includes(weaponId)) {
    if (window.G) {
      window.G.weaponType = weaponId;
      if (typeof updateWeaponHUD === 'function') {
        updateWeaponHUD();
      }
    }
    
    // Save selected weapon
    saveData({ selectedWeapon: weaponId });
    
    const WEAPON_DEFS = window.WEAPON_DEFS || {
      basic: { name: "Basic Laser" },
      plasma: { name: "Plasma Cannon" },
      spread: { name: "Spread Shot" },
      laser: { name: "Focused Laser" },
      missile: { name: "Homing Missiles" }
    };
    
    const weaponName = WEAPON_DEFS[weaponId] ? WEAPON_DEFS[weaponId].name : weaponId.toUpperCase();
    showToast(`${weaponName} selected!`);
    
    // Refresh shop to update UI
    initShopScreen();
  } else {
    showToast("Weapon not unlocked!");
  }
}

function cycleWeapon() {
  if (!window.G || !window.G.weaponsUnlocked) return;
  
  const unlocked = window.G.weaponsUnlocked;
  const current = window.G.weaponType || "basic";
  const currentIndex = unlocked.indexOf(current);
  const nextIndex = (currentIndex + 1) % unlocked.length;
  const nextWeapon = unlocked[nextIndex];
  
  selectWeapon(nextWeapon);
}

window.selectWeapon = selectWeapon;
window.cycleWeapon = cycleWeapon;

function showWeaponSelect() {
  if (!G.running || G.paused) return;
  
  G.paused = true;
  const overlay = document.getElementById("overlayWeaponSelect");
  const grid = document.getElementById("weaponSelectGrid");
  
  if (!overlay || !grid) return;
  
  // Populate weapon grid
  grid.innerHTML = "";
  const weapons = ["basic", "plasma", "spread", "laser", "missile"];
  
  weapons.forEach((weaponId, index) => {
    const weapon = WEAPON_DEFS[weaponId];
    const isUnlocked = G.weaponsUnlocked.includes(weaponId);
    const isActive = G.weaponType === weaponId;
    
    const weaponEl = document.createElement("div");
    weaponEl.className = `ws-weapon ${isActive ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}`;
    
    if (isUnlocked) {
      weaponEl.onclick = () => selectWeaponFromOverlay(weaponId);
    }
    
    weaponEl.innerHTML = `
      <div class="ws-weapon-key">${index + 1}</div>
      <div class="ws-weapon-name">${weapon.name}</div>
      <div class="ws-weapon-damage">DMG: ${weapon.damage}x</div>
    `;
    
    grid.appendChild(weaponEl);
  });
  
  overlay.classList.remove("hidden");
}

function hideWeaponSelect() {
  const overlay = document.getElementById("overlayWeaponSelect");
  if (overlay) overlay.classList.add("hidden");
  G.paused = false;
}

function selectWeaponFromOverlay(weaponId) {
  if (G.weaponsUnlocked.includes(weaponId)) {
    G.weaponType = weaponId;
    updateWeaponHUD();
    showToastMsg(`${WEAPON_DEFS[weaponId].name} selected!`);
    hideWeaponSelect();
  }
}

window.showWeaponSelect = showWeaponSelect;
window.hideWeaponSelect = hideWeaponSelect;
window.selectWeaponFromOverlay = selectWeaponFromOverlay;

/* 
   NOVA STRIKE  Multiplayer (simulated lobby)
   Real WebSocket integration point ready.
   Replace mpWS with your actual server URL.
 */

const MP = {
  connected: false,
  searching: false,
  inLobby: false,
  callsign: "",
  roomCode: "",
  filter: "all",
  ws: null,
  pingInterval: null,
  searchTimeout: null,
  demoRooms: [
    { id: "r1", name: "ALPHA SQUADRON", mode: "deathmatch", players: 2, max: 4, ping: 42 },
    { id: "r2", name: "VOID HUNTERS",   mode: "survival",   players: 3, max: 4, ping: 78 },
    { id: "r3", name: "SCORE CHASERS",  mode: "score",      players: 1, max: 6, ping: 55 },
    { id: "r4", name: "NOVA TEAM",      mode: "coop",       players: 4, max: 4, ping: 31 },
    { id: "r5", name: "DARK MATTER",    mode: "deathmatch", players: 2, max: 8, ping: 90 },
    { id: "r6", name: "OMEGA SQUAD",    mode: "survival",   players: 1, max: 4, ping: 62 },
  ],
};

function mpInitScreen() {
  // Populate callsign from saved data
  const d = loadData();
  const cs = document.getElementById("mpCallsign");
  if (cs && !cs.value) cs.value = d.callsign || "PILOT-" + Math.floor(Math.random() * 9000 + 1000);
  MP.callsign = (cs ? cs.value : "") || "PILOT";

  // Stats
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("mpMyBest",  (d.bestScore  || 0).toLocaleString());
  set("mpMyLevel", String(d.bestLevel || 1));
  set("mpMyGames", String(d.gamesPlayed || 0));

  // Ship preview
  const sc = document.getElementById("mpShipCanvas");
  if (sc) {
    const ctx = sc.getContext("2d");
    ctx.clearRect(0, 0, sc.width, sc.height);
    drawShipOnCtx(ctx, sc.width / 2, sc.height / 2 + 4, SKIN_PALETTE[window.selectedSkin || 0], Date.now() / 1000);
  }

  // Mode tile click
  document.querySelectorAll(".mp-mode-tile").forEach(tile => {
    tile.addEventListener("click", () => {
      document.querySelectorAll(".mp-mode-tile").forEach(t => t.classList.remove("active"));
      tile.classList.add("active");
    });
  });

  mpRenderRooms();
}

function mpUpdateCallsign(val) {
  MP.callsign = val.trim() || "PILOT";
  saveData({ callsign: MP.callsign });
}

function mpSetStatus(state, label) {
  const dot = document.getElementById("mpStatusDot");
  const lbl = document.getElementById("mpStatusLabel");
  if (dot) { dot.className = "mp-status-dot " + (state || ""); }
  if (lbl) lbl.textContent = label || "";
}

function mpConnect() {
  if (MP.connected) { mpDisconnect(); return; }
  mpSetStatus("searching", "CONNECTING TO NOVA NETWORK...");
  const btn = document.getElementById("mpConnectBtn");
  if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>CONNECTING';

  // Simulate connection (replace with real WebSocket)
  setTimeout(() => {
    MP.connected = true;
    mpSetStatus("online", "CONNECTED  NOVA NETWORK");
    if (btn) btn.innerHTML = '<i class="fas fa-times me-1"></i>DISCONNECT';
    const ping = document.getElementById("mpPing");
    const pingVal = document.getElementById("mpPingVal");
    if (ping) ping.classList.remove("hidden");
    if (pingVal) pingVal.textContent = String(28 + Math.floor(Math.random() * 40));
    document.getElementById("mpRoomCount").textContent = MP.demoRooms.length + " online";
    mpRenderRooms();
    showToast("Connected to NOVA Network!");
  }, 1200);
}

function mpDisconnect() {
  MP.connected = false;
  mpSetStatus("", "OFFLINE  NOT CONNECTED");
  const btn = document.getElementById("mpConnectBtn");
  if (btn) btn.innerHTML = '<i class="fas fa-plug me-1"></i>CONNECT';
  const ping = document.getElementById("mpPing");
  if (ping) ping.classList.add("hidden");
  document.getElementById("mpRoomCount").textContent = "0 online";
  mpRenderRooms();
}

function mpGetSelectedMode() {
  const checked = document.querySelector('input[name="mpMode"]:checked');
  return checked ? checked.value : "deathmatch";
}

function mpQuickMatch() {
  if (!MP.connected) { showToast("Connect to NOVA Network first!"); return; }
  const mode = mpGetSelectedMode();
  MP.searching = true;
  document.getElementById("mpMatchmaking").classList.remove("hidden");
  document.getElementById("mpMmSub").textContent = "Searching for " + mode.toUpperCase() + " opponents...";

  // Animate slots filling in
  const names = ["ORION-7", "VEX-NULL", "KIRA-X"];
  const delays = [1200, 2200, 3100];
  names.forEach((name, i) => {
    setTimeout(() => {
      if (!MP.searching) return;
      const slot = document.getElementById("mpMmSlot" + (i + 1));
      if (slot) {
        slot.classList.add("filled");
        slot.innerHTML = `<i class="fas fa-rocket" style="color:var(--cyan)"></i><span>${name}</span>`;
      }
      if (i === names.length - 1) {
        document.getElementById("mpMmSub").textContent = "Match found! Launching...";
        setTimeout(() => {
          if (!MP.searching) return;
          mpCancelSearch();
          mpOpenLobby("QUICK-" + mode.toUpperCase(), mpGenerateCode(), mode);
        }, 900);
      }
    }, delays[i]);
  });
}

function mpCancelSearch() {
  MP.searching = false;
  document.getElementById("mpMatchmaking").classList.add("hidden");
  // Reset slots
  for (let i = 1; i <= 3; i++) {
    const slot = document.getElementById("mpMmSlot" + i);
    if (slot) { slot.classList.remove("filled"); slot.innerHTML = `<i class="fas fa-question"></i><span>???</span>`; }
  }
}

function mpGenerateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function mpCreateRoom() {
  if (!MP.connected) { showToast("Connect to NOVA Network first!"); return; }
  const name = (document.getElementById("mpRoomName") ? document.getElementById("mpRoomName").value : "").trim() || (MP.callsign + "'S ROOM");
  const code = mpGenerateCode();
  mpOpenLobby(name, code, mpGetSelectedMode());
}

function mpJoinByCode() {
  if (!MP.connected) { showToast("Connect to NOVA Network first!"); return; }
  const code = (document.getElementById("mpJoinCode") ? document.getElementById("mpJoinCode").value : "").trim().toUpperCase();
  if (!code || code.length < 4) { showToast("Enter a valid room code!"); return; }
  mpOpenLobby("ROOM " + code, code, "deathmatch");
}

function mpJoinRoom(roomId) {
  if (!MP.connected) { showToast("Connect to NOVA Network first!"); return; }
  const room = MP.demoRooms.find(r => r.id === roomId);
  if (!room) return;
  mpOpenLobby(room.name, mpGenerateCode(), room.mode);
}

function mpOpenLobby(name, code, mode) {
  MP.inLobby = true;
  MP.roomCode = code;
  document.getElementById("mpRoomLobby").classList.remove("hidden");
  document.getElementById("mpLobbyRoomName").textContent = name;
  document.getElementById("mpLobbyCode").textContent = code;

  // Populate lobby slots
  const demoPlayers = [
    { name: MP.callsign, score: loadData().bestScore || 0, ready: true,  host: true,  you: true  },
    { name: "ORION-7",   score: 8840,                      ready: true,  host: false, you: false },
    { name: "VEX-NULL",  score: 7220,                      ready: false, host: false, you: false },
    { name: null,        score: 0,                         ready: false, host: false, you: false },
  ];
  const container = document.getElementById("mpLobbyPlayers");
  if (container) {
    container.innerHTML = "";
    demoPlayers.forEach(p => {
      const div = document.createElement("div");
      div.className = "mp-lobby-slot" + (p.host ? " host" : "") + (!p.name ? " empty" : "");
      if (p.name) {
        div.innerHTML =
          `<div class="mp-lobby-avatar">${p.you ? "" : ""}</div>` +
          `<div class="flex-fill"><div class="mp-lobby-name">${p.name}${p.host ? " " : ""}</div>` +
          `<div class="mp-lobby-meta">Best: ${p.score.toLocaleString()}</div></div>` +
          `<span class="mp-lobby-ready ${p.ready ? "yes" : "no"}">${p.ready ? "READY" : "WAIT"}</span>`;
      } else {
        div.innerHTML = `<div class="mp-lobby-avatar" style="opacity:.3"><i class="fas fa-user-plus"></i></div><div class="mp-lobby-meta" style="color:rgba(200,230,255,.2)">Waiting...</div>`;
      }
      container.appendChild(div);
    });
  }

  // Add system chat message
  mpAddChatMsg(null, `Room "${name}" created. Code: ${code}`, true);
  mpAddChatMsg(null, `${MP.callsign} joined the room.`, true);
  mpAddChatMsg(null, "ORION-7 joined the room.", true);
  mpAddChatMsg(null, "VEX-NULL joined the room.", true);

  // Scroll to lobby
  document.getElementById("mpRoomLobby").scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("Joined room: " + code);
}

function mpLeaveLobby() {
  MP.inLobby = false;
  document.getElementById("mpRoomLobby").classList.add("hidden");
  document.getElementById("mpChatLog").innerHTML = "";
  showToast("Left the room.");
}

function mpCopyCode() {
  if (!MP.roomCode) return;
  navigator.clipboard && navigator.clipboard.writeText(MP.roomCode).then(() => showToast("Code copied: " + MP.roomCode));
}

function mpStartMatch() {
  showToast("Launching multiplayer match... (connect a server to enable)");
  // Hook your real game start here: e.g. window.startMultiplayerGame(MP.roomCode)
}

function mpSendChat() {
  const input = document.getElementById("mpChatInput");
  const msg = (input ? input.value.trim() : "");
  if (!msg) return;
  mpAddChatMsg(MP.callsign, msg, false);
  input.value = "";
}

function mpAddChatMsg(author, text, isSystem) {
  const log = document.getElementById("mpChatLog");
  if (!log) return;
  const div = document.createElement("div");
  div.className = "mp-chat-msg" + (isSystem ? " system" : "");
  div.innerHTML = isSystem
    ? ` ${text}`
    : `<span class="mp-chat-author">${author}</span>${text}`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function mpSetFilter(btn, filter) {
  MP.filter = filter;
  document.querySelectorAll(".mp-filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  mpRenderRooms();
}

function mpRefreshRooms() {
  if (!MP.connected) { showToast("Connect first!"); return; }
  showToast("Scanning for rooms...");
  setTimeout(mpRenderRooms, 600);
}

function mpRenderRooms() {
  const list = document.getElementById("mpRoomList");
  const empty = document.getElementById("mpEmptyRooms");
  if (!list) return;

  const rooms = MP.connected
    ? MP.demoRooms.filter(r => MP.filter === "all" || r.mode === MP.filter)
    : [];

  if (!rooms.length) {
    list.innerHTML = "";
    if (empty) { empty.style.display = ""; list.appendChild(empty); }
    return;
  }
  if (empty) empty.style.display = "none";

  list.innerHTML = "";
  rooms.forEach(r => {
    const full = r.players >= r.max;
    const div = document.createElement("div");
    div.className = "mp-room-item";
    div.innerHTML =
      `<div class="flex-fill">` +
        `<div class="mp-room-name">${r.name}</div>` +
        `<div class="mp-room-meta"><i class="fas fa-signal me-1"></i>${r.ping}ms &nbsp;.&nbsp; ` +
        `<span class="mp-room-mode ${r.mode}">${r.mode.toUpperCase()}</span></div>` +
      `</div>` +
      `<span class="mp-room-slots">${r.players}/${r.max} <i class="fas fa-user ms-1"></i></span>` +
      `<button class="ns-btn ${full ? "ns-btn-ghost" : "ns-btn-secondary"} ns-btn-sm mp-room-join" ` +
        `${full ? "disabled" : `onclick="mpJoinRoom('${r.id}')"`}>` +
        `${full ? "FULL" : "JOIN"}</button>`;
    list.appendChild(div);
  });
}

window.mpConnect       = mpConnect;
window.mpQuickMatch    = mpQuickMatch;
window.mpCancelSearch  = mpCancelSearch;
window.mpCreateRoom    = mpCreateRoom;
window.mpJoinByCode    = mpJoinByCode;
window.mpJoinRoom      = mpJoinRoom;
window.mpLeaveLobby    = mpLeaveLobby;
window.mpCopyCode      = mpCopyCode;
window.mpStartMatch    = mpStartMatch;
window.mpSendChat      = mpSendChat;
window.mpSetFilter     = mpSetFilter;
window.mpRefreshRooms  = mpRefreshRooms;
window.mpUpdateCallsign = mpUpdateCallsign;
window.mpInitScreen    = mpInitScreen;











