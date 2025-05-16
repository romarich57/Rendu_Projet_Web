// =====================
// guerre_vaisseaux.js
// =====================

const API_URL = "http://localhost:3000";
let socket;
let userToken;
let username;
let shipLeft, shipRight;
const backgroundEl = document.getElementById("background");
// (aucune utilisation en JS, juste s’assurer qu’il existe)


// Positions verticales : target vs current pour interpolation
let shipLeftTargetY = 250;
let shipRightTargetY = 250;
let shipLeftY = 250;
let shipRightY = 250;
let livesLeft = 3;
let livesRight = 3;
let mySide;
const MOVE_SPEED = 5;
const INTERPOLATION_FACTOR = 0.1; // facteur pour le lissage visuel

// Cooldown tir côté client
const SHOOT_CLIENT_COOLDOWN = 500; // ms entre tirs
let lastClientShoot = 0;

// Éléments DOM
let waitingOverlay;
let player1Name;
let player2Name;


// Contrôles fléchés
let moveUp = false;
let moveDown = false;

// === Reconnexion & ping/pong ===
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;      // délai max 30s
let pingIntervalId;
// ── CONSTANTES & ÉTAT GLOBAL ──

// Hauteur (px) de l’image de chaque vaisseau
const SHIP_HEIGHT = 50;

// Pour throttle/dédup position
let lastSentPos = null;
let lastSentTime = 0;
const POSITION_SEND_INTERVAL = 1000 / 30;

// Pour ping/pong WS
let lastPongTime = Date.now();
const PING_INTERVAL = 5000;
const PONG_TIMEOUT  = 20000; // was 10000, increased to 20s to allow for lag

// Pour annuler proprement la boucle de jeu
let gameLoopId;
let spacePressed = false;

// ← ICI : chemin relatif depuis 
//    frontend/game/guerre_vaisseaux/guerre_vaisseaux.js 
//    vers frontend/assets/images/
const IMG_PATH = "../../assets/images/";
// ── Pour le chronomètre de recherche ──
let searchTimerInterval;
let searchStartTime;

// ── Pour mesurer la latence WS ──
let lastPingSentTime;
let statusDot, timerSpan;
// pour afficher les vies graphiquement
let livesLeftContainer, livesRightContainer;
let prevLivesLeft, prevLivesRight;

// pour l’indicateur de cooldown
let cooldownIndicator;

// pour l’animation d’impact
const IMPACT_DURATION = 400; // ms

// Au chargement on démarre directement le jeu
document.addEventListener("DOMContentLoaded", initGuerreVaisseaux);


function initGuerreVaisseaux() {
  // — 1) Reset état client et fermer WS existante —
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close();
  }
  livesLeft = livesRight = 3;
  shipLeftTargetY = shipRightTargetY = 250;
  shipLeftY = shipRightY = 250;
  moveUp = moveDown = false;

  // — 2) Récupérer seulement les éléments qui existent —
  userToken         = localStorage.getItem("token");
  if (!userToken) {
    window.location.href = "/auth/login/login.html";
    return;
  }
  username          = localStorage.getItem("username") || "Inconnu";
  shipLeft          = document.getElementById("shipLeft");
  shipRight         = document.getElementById("shipRight");
  waitingOverlay    = document.getElementById("waiting-overlay");
  player1Name       = document.getElementById("player1-name");
  player2Name       = document.getElementById("player2-name");
  statusDot         = document.getElementById("net-status");
  timerSpan         = document.getElementById("search-timer");
  livesLeftContainer  = document.getElementById("lives-left");
  livesRightContainer = document.getElementById("lives-right");
  cooldownIndicator   = document.getElementById("cooldown-indicator");
  const gameoverOverlay = document.getElementById("gameover-overlay");
  const replayBtn       = document.getElementById("replay-btn");
  const quitBtn         = document.getElementById("quit-btn");

  // — 3) Câbler Rejouer / Quitter —
  replayBtn.removeEventListener("click", onReplay);
  replayBtn.addEventListener("click", onReplay);
  quitBtn.removeEventListener("click", onQuit);
  quitBtn.addEventListener("click", onQuit);

  // — 4) Cacher / afficher les bons overlays —
  gameoverOverlay.classList.add("hidden");
  waitingOverlay.style.display = "flex";

  // masquer les vaisseaux en attendant le match
  shipLeft.style.display  = "none";
  shipRight.style.display = "none";

  // — 5) Reset UI des vies —
  prevLivesLeft = prevLivesRight = 3;
  renderLives();

  // — 5.1) Réinitialiser les noms affichés (évite d'afficher le pseudo du joueur seul)
  player1Name.textContent = "Joueur 1";
  player2Name.textContent = "Joueur 2";

  // — 6) Lancer matchmaking —
  startSearchTimer();
  connectWebSocket();

  // — 7) Touches & boucle de jeu —
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup",   onKeyUp);
  gameLoopId = requestAnimationFrame(gameLoop);
}


// gestion du bouton Rejouer
function onReplay() {
  initGuerreVaisseaux();
}

// gestion du bouton Quitter
function onQuit() {
  window.location.href = "../guerre_menu/guerre_menu.html";
}


function connectWebSocket() {
  const wsUrl = "ws://localhost:3000/ws/guerre";
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log("WebSocket connecté");
    reconnectAttempts = 0;
    lastPongTime = Date.now();
    socket.send(JSON.stringify({ type: "join", token: userToken }));

    pingIntervalId = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        lastPingSentTime = Date.now();
        socket.send(JSON.stringify({ type: "ping" }));
        if (Date.now() - lastPongTime > PONG_TIMEOUT) {
          console.warn("Pong non reçu → reconnexion");
          socket.close();
        }
      }
    }, PING_INTERVAL);
  };

  socket.onmessage = event => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      console.warn("Message WS invalide :", event.data);
      return;
    }

    // Gérer le ping/pong
    if (msg.type === "pong") {
      lastPongTime = Date.now();
      return;
    }
    
    switch (msg.type) {
      // Dans le case "matchFound":
      case "matchFound":
        mySide = msg.side;
        // Afficher les pseudos du serveur avec les vies initiales
        player1Name.textContent = `${msg.names.left} (3 vies)`;
        player2Name.textContent = `${msg.names.right} (3 vies)`;
        
        shipLeft.style.display = "block";
        shipRight.style.display = "block";
        waitingOverlay.style.display = "none";
        stopSearchTimer();
        
        // Réactiver le bouton "Rejouer"
        const replayBtn = document.getElementById("replay-btn");
        if (replayBtn) replayBtn.disabled = false;
        break;
      
        
      case "updateState":
        updateFromServer(msg.state);
        break;
        
      case "gameOver":
        cleanup();
        showGameOver(msg.winner);
        break;
        
      default:
        console.warn("Message WS inconnu :", msg.type);
    }
  };

  socket.onerror = err => console.error("WebSocket error :", err);

  socket.onclose = evt => {
    clearInterval(pingIntervalId);
    console.log("WS fermé (code", evt.code, "):", evt.reason);
    reconnectAttempts++;
    const delay = Math.min(1000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY);
    console.log(`Reconnexion dans ${delay} ms…`);
    setTimeout(connectWebSocket, delay);
  };
}



function cleanup() {
  document.removeEventListener("keydown", onKeyDown);
  document.removeEventListener("keyup",   onKeyUp);
  clearInterval(pingIntervalId);
  if (socket.readyState === WebSocket.OPEN) socket.close();
  cancelAnimationFrame(gameLoopId);
}
function startSearchTimer() {
  searchStartTime = Date.now();
  timerSpan.textContent = "0";
  searchTimerInterval = setInterval(() => {
    const secs = Math.floor((Date.now() - searchStartTime) / 1000);
    timerSpan.textContent = secs;
  }, 1000);
}

function stopSearchTimer() {
  clearInterval(searchTimerInterval);
}
function renderLives() {
  // gauche
  livesLeftContainer.innerHTML = "";
  for (let i = 0; i < livesLeft; i++) {
    const img = document.createElement("img");
    img.src   = "../../shared/vie.png";
    img.classList.add("life-heart");
    livesLeftContainer.appendChild(img);
  }
  // droite
  livesRightContainer.innerHTML = "";
  for (let i = 0; i < livesRight; i++) {
    const img = document.createElement("img");
    img.src   = "../../shared/vie.png";
    img.classList.add("life-heart");
    livesRightContainer.appendChild(img);
  }
}

function triggerImpact() {
  const container = document.getElementById("game-container");
  container.classList.add("flash", "shake");
  setTimeout(() => {
    container.classList.remove("flash", "shake");
  }, IMPACT_DURATION);
}





function onKeyDown(e) {
  switch (e.code) {
    case "ArrowUp":
      moveUp = true;
      break;
    case "ArrowDown":
      moveDown = true;
      break;
    case "Space":
      // si on n’a pas encore tiré pendant cet appui
      if (!spacePressed) {
        shoot();
        spacePressed = true;
      }
      break;
  }
}

function onKeyUp(e) {
  switch (e.code) {
    case "ArrowUp":
      moveUp = false;
      break;
    case "ArrowDown":
      moveDown = false;
      break;
    case "Space":
      // on réarme le tir pour le prochain appui
      spacePressed = false;
      break;
  }
}


function shoot() {
  const now = Date.now();
  if (now - lastClientShoot < SHOOT_CLIENT_COOLDOWN) return;
  lastClientShoot = now;

  if (socket.readyState !== WebSocket.OPEN) return;

  // calculer yTop comme avant…
  const bottomY = mySide === "left" ? shipLeftTargetY : shipRightTargetY;
  const yTop    = window.innerHeight - bottomY - SHIP_HEIGHT;

  socket.send(JSON.stringify({
    type: "shoot",
    side: mySide,
    y: yTop
  }));

  // ← EFFET RECOIL
  const shipEl = mySide === "left" ? shipLeft : shipRight;
  shipEl.classList.add("ship-fired");
  setTimeout(() => shipEl.classList.remove("ship-fired"), 100);
}


function gameLoop() {
  const since = Date.now() - lastClientShoot;
  const frac  = Math.min(since / SHOOT_CLIENT_COOLDOWN, 1);
  const angle = frac * 360;
  cooldownIndicator.style.setProperty("--cd-angle", angle + "deg");
  // couleur verte si prêt, sinon orange
  const color = frac === 1 ? "#4caf50" : "#ff9800";
  cooldownIndicator.style.setProperty("--cd-color", color);
  // Mise à jour de la cible et envoi immédiat
  if (mySide) {
    let moved = false;
    if (moveUp) {
      if (mySide === 'left') shipLeftTargetY = Math.min(shipLeftTargetY + MOVE_SPEED, window.innerHeight - 50);
      else shipRightTargetY = Math.min(shipRightTargetY + MOVE_SPEED, window.innerHeight - 50);
      moved = true;
    }
    if (moveDown) {
      if (mySide === 'left') shipLeftTargetY = Math.max(shipLeftTargetY - MOVE_SPEED, 0);
      else shipRightTargetY = Math.max(shipRightTargetY - MOVE_SPEED, 0);
      moved = true;
    }
    if (moved) sendPosition();
  }

  // Interpolation visuelle (smooth)
  shipLeftY  += (shipLeftTargetY  - shipLeftY)  * INTERPOLATION_FACTOR;
  shipRightY += (shipRightTargetY - shipRightY) * INTERPOLATION_FACTOR;

  shipLeft.style.bottom  = shipLeftY  + "px";
  shipRight.style.bottom = shipRightY + "px";

  gameLoopId = requestAnimationFrame(gameLoop);
}

function sendPosition() {
  if (!mySide || socket.readyState !== WebSocket.OPEN) return;

  // On convertit « bottom » → coordonnée depuis le haut
  const bottomY = mySide === "left" ? shipLeftTargetY : shipRightTargetY;
  const posTop  = window.innerHeight - bottomY - SHIP_HEIGHT;

  const now = Date.now();
  if (posTop === lastSentPos) return;                         // dédup
  if (now - lastSentTime < POSITION_SEND_INTERVAL) return;    // throttle

  socket.send(JSON.stringify({ type: "move", position: posTop }));
  lastSentPos  = posTop;
  lastSentTime = now;
}



function updateFromServer(state) {
  // —– Vaisseaux (inchangé) —–
  shipLeftTargetY  = window.innerHeight - state.leftY  - SHIP_HEIGHT;
  shipRightTargetY = window.innerHeight - state.rightY - SHIP_HEIGHT;
  livesLeft  = state.livesLeft;
  livesRight = state.livesRight;
  player1Name.textContent = `${state.names.left} (${livesLeft} vies)`;
  player2Name.textContent = `${state.names.right} (${livesRight} vies)`;

  // —– Détection d’impact (vie en moins) —–
  if (state.livesLeft < prevLivesLeft) {
    triggerImpact();
    prevLivesLeft = state.livesLeft;
  }
  if (state.livesRight < prevLivesRight) {
    triggerImpact();
    prevLivesRight = state.livesRight;
  }

  // —– Mettre à jour vies et UI —–
  livesLeft  = state.livesLeft;
  livesRight = state.livesRight;
  renderLives();

  // —– Bullets : flush & recréation —–
  const container = document.getElementById("game-container");

  // 1) on retire TOUTES les anciennes balises
  container.querySelectorAll(".bullet").forEach(el => el.remove());

  // 2) on crée UNE balise par balle dans state.bullets
  state.bullets.forEach(b => {
    // optionnel : filtrer hors écran
    if (b.x < 0 || b.x > window.innerWidth || b.y < 0 || b.y > window.innerHeight) return;

    const img = document.createElement("img");
    img.classList.add("bullet");
    img.src = IMG_PATH + (b.side === "left"
      ? "bullet1.png"
      : "bullet_vert1.png"
    );
    img.style.left = `${b.x}px`;
    img.style.top  = `${b.y}px`;
    container.appendChild(img);
  });
}





function showGameOver(winner) {
  // masquer l’overlay de matchmaking
  waitingOverlay.style.display = "none";

  // afficher l’overlay de fin
  const overlay = document.getElementById("gameover-overlay");
  const msg     = document.getElementById("gameover-message");
  msg.textContent = `Le joueur ${winner} a gagné !`;
  overlay.classList.remove("hidden");
}



async function postScore(scoreValue) {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const resp = await fetch(`${API_URL}/api/scores`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ value: scoreValue }),
    });
    const data = await resp.json();
    if (!resp.ok) console.error('Erreur postScore:', data.error);
    else console.log('Score enregistré:', data);
  } catch (err) {
    console.error('Exception postScore:', err);
  }
}

// Nouvelle fonction pour réinitialiser le matchmaking sans recharger la page
// gestion du bouton Rejouer
function onReplay() {
  // 1) Arrêter proprement WS, boucle, intervalles…
  cleanup();
  // 2) Réinitialiser l’état et relancer tout
  initGuerreVaisseaux();
}

