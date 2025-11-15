// =====================
// guerre_vaisseaux.js
// =====================
const API_DEFAULT = "https://api.rom-space-game.realdev.cloud";
const API_ORIGIN = (() => {
  if (typeof window !== 'undefined') {
    const custom = window.__API_BASE__;
    if (typeof custom === 'string' && custom.trim()) {
      return custom.trim().replace(/\/$/, '');
    }
    const { protocol, hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const safeProtocol = protocol.startsWith('http') ? protocol : 'http:';
      return `${safeProtocol}//${hostname}:3000`;
    }
  }
  return API_DEFAULT;
})();
const API_URL = API_ORIGIN;
const WS_URL = (() => {
  if (API_ORIGIN.startsWith('https://')) {
    return `wss://${API_ORIGIN.slice(8)}/ws/guerre`;
  }
  if (API_ORIGIN.startsWith('http://')) {
    return `ws://${API_ORIGIN.slice(7)}/ws/guerre`;
  }
  return API_ORIGIN.replace(/^http/, 'ws') + '/ws/guerre';
})();
let socket = null;
let userToken;
let username;
let shipLeft, shipRight;
const backgroundEl = document.getElementById("background");



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
const PONG_TIMEOUT  = 20000; 

// Pour annuler proprement la boucle de jeu
let gameLoopId;
let spacePressed = false;
// ── Chemin des images ──
const IMG_PATH = "../../assets/images/";
// ── Pour le chronomètre de recherche ──
let searchTimerInterval;
let searchStartTime;
let relaxTimer;                             

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

/**
 * Role : Initialise l’état du client et l’interface utilisateur, récupère le token, configure les éléments DOM et lance le matchmaking via WebSocket.
 * Préconditions :
 *   - Le DOM est entièrement chargé (`DOMContentLoaded` déclenché).
 *   - Les éléments DOM suivants existent : `#background`, `#shipLeft`, `#shipRight`, `#waiting-overlay`, `#player1-name`, `#player2-name`, `#net-status`, `#search-timer`, `#lives-left`, `#lives-right`, `#cooldown-indicator`, `#gameover-overlay`.
 *   - `localStorage` contient éventuellement un token sous la clé `"token"` et un nom d’utilisateur `"username"`.
 *   - Les variables globales `socket`, `livesLeft`, `livesRight`, `shipLeftTargetY`, `shipRightTargetY`, `shipLeftY`, `shipRightY`, `moveUp`, `moveDown`, `mySide`, `gameLoopId` sont déclarées.
 *   - Les fonctions `startSearchTimer()`, `connectWebSocket()`, `onKeyDown()`, `onKeyUp()`, `gameLoop()` existent.
 * Postconditions :
 *   - Toute connexion WebSocket précédente est fermée.
 *   - L’état de jeu client (vies, positions cibles, contrôles) est réinitialisé.
 *   - `userToken` et `myUsername` sont définis depuis `localStorage`; absence de token redirige vers la page de login.
 *   - Les éléments DOM de vaisseaux et overlay de matchmaking sont affichés ou masqués pour un nouvel appariement.
 *   - Les écouteurs clavier et la boucle de rendu (`requestAnimationFrame(gameLoop)`) sont activés.
 */


function initGuerreVaisseaux() {
  // — 1) Reset état client et fermer WS existante —
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close();
  }
  livesLeft = livesRight = 3;
  shipLeftTargetY = shipRightTargetY = 250;
  shipLeftY = shipRightY = 250;
  moveUp = moveDown = false;
  mySide = null; // Réinitialiser le côté du joueur

  // reset side & names
  mySide = null;
  myName = null;
  opponentName = null;

  // — 2) Récupérer le token & le username à chaque session —
  userToken  = localStorage.getItem("token");
  if (!userToken) {
    window.location.href = "/auth/login/login.html";
    return;
  }
  
  myUsername = localStorage.getItem("username") || "Inconnu";
  username   = myUsername;

  shipLeft = document.getElementById("shipLeft");
  shipRight = document.getElementById("shipRight");
  waitingOverlay = document.getElementById("waiting-overlay");
  player1Name = document.getElementById("player1-name");
  player2Name = document.getElementById("player2-name");
  statusDot = document.getElementById("net-status");
  timerSpan = document.getElementById("search-timer");
  livesLeftContainer = document.getElementById("lives-left");
  livesRightContainer = document.getElementById("lives-right");
  cooldownIndicator = document.getElementById("cooldown-indicator");
  const gameoverOverlay = document.getElementById("gameover-overlay");



  // — 3) Cacher / afficher les bons overlays —
  gameoverOverlay.classList.add("hidden");
  waitingOverlay.style.display = "flex";

  // masquer les vaisseaux en attendant le match
  shipLeft.style.display  = "none";
  shipRight.style.display = "none";

  // — 4) Reset UI des vies —
  prevLivesLeft = prevLivesRight = 3;
  renderLives();

  // — 5) Réinitialiser les noms affichés —
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


/**
 * Role : Établit la connexion WebSocket au serveur de match, gère l’ouverture, la réception, la fermeture et les erreurs, et implémente la logique de reconnexion automatique.
 * Préconditions :
 *   - La variable globale `API_URL` est définie.
 *   - Les variables globales `socket`, `reconnectAttempts`, `MAX_RECONNECT_DELAY`, `pingIntervalId`, `relaxTimer` sont déclarées.
 *   - Les fonctions `updateConnectionStatus(status)`, `showErrorMessage(msg)`, `startSearchTimer()`, `stopSearchTimer()`, `updateEloRatings()`, `cleanup()`, et `showGameOver(winner)` existent.
 * Postconditions :
 *   - Une instance WebSocket est créée et assignée à `socket`.
 *   - À l’ouverture : statut mis à jour, envoi d’un message `join`, puis `joinRelaxed` après 5 s.
 *   - À chaque message : gestion du ping/pong, `matchFound`, `updateState` et `gameOver`.
 *   - À la fermeture ou erreur : statut hors-ligne mis à jour, tentative de reconnexion selon `reconnectAttempts` et délai croissant, ou affichage d’une erreur définitive.
 */


function connectWebSocket() {
  // Éviter les tentatives de connexion multiples simultanées
  let isConnecting = false;
  let reconnectTimeout;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  if (isConnecting) return;

  if (socket && socket.readyState !== WebSocket.CLOSED) {
    try {
      socket.onclose = null;
      socket.close();
    } catch (err) {
      console.log("Erreur lors de la fermeture du WebSocket:", err);
    }
  }

  isConnecting = true;

  try {
    socket = new WebSocket(WS_URL);

    console.log("Connexion WebSocket en cours...");

    socket.onopen = function() {
      console.log('Connexion WebSocket établie');
      reconnectAttempts = 0;
      updateConnectionStatus('online');

      // send join with current username
      socket.send(JSON.stringify({ type: 'join',        name: myUsername }));
      // schedule relaxed matchmaking after 5s
      clearTimeout(relaxTimer);
      relaxTimer = setTimeout(() => {
        socket.send(JSON.stringify({ type: 'joinRelaxed', name: myUsername }));
      }, 5000);

      isConnecting = false;
    };

    socket.onmessage = function(event) {
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

          // Stocker les noms pour ELO à la fin de la partie
          myName = mySide === "left" ? msg.names.left : msg.names.right;
          opponentName = mySide === "left" ? msg.names.right : msg.names.left;

          // Afficher les pseudos du serveur avec les vies initiales
          player1Name.textContent = `${msg.names.left} (3 vies)`;
          player2Name.textContent = `${msg.names.right} (3 vies)`;

          shipLeft.style.display = "block";
          shipRight.style.display = "block";
          waitingOverlay.style.display = "none";
          stopSearchTimer();
          clearTimeout(relaxTimer);
          // Remove reference to the replay button that no longer exists
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

    socket.onclose = function(event) {
      console.log('Connexion WebSocket fermée:', event);
      updateConnectionStatus('offline');
      isConnecting = false;

      // Limiter les tentatives de reconnexion
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Tentative de reconnexion ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} dans ${RECONNECT_DELAY}ms`);
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connectWebSocket, RECONNECT_DELAY);
      } else {
        console.log("Nombre maximal de tentatives de reconnexion atteint");
        showErrorMessage("La connexion au serveur a été perdue. Rafraîchissez la page pour réessayer.");
      }
    };

    socket.onerror = function(error) {
      console.log('WebSocket error :', error);
      updateConnectionStatus('offline');
      isConnecting = false;
      // Ne pas reconnecte ici - laissez onclose s'en occuper
    };

  } catch (error) {
    console.error('Erreur lors de la création du WebSocket:', error);
    updateConnectionStatus('offline');
    isConnecting = false;
  }
}



/**
 * Role : Affiche un message d’erreur de connexion dans un overlay et propose de rafraîchir la page.
 * Préconditions : 
 *   - L’élément DOM `#waiting-overlay` existe ou peut être créé.
 *   - La méthode `window.location.reload()` est utilisable pour recharger la page.
 * Postconditions : 
 *   - Un overlay d’erreur est affiché avec le message fourni et un bouton “Rafraîchir”.
 */


function showErrorMessage(message) {
  const overlay = document.getElementById('waiting-overlay') || document.createElement('div');
  overlay.id = 'waiting-overlay';
  overlay.innerHTML = `
      <h2>Erreur de connexion</h2>
      <p>${message}</p>
      <button onclick="window.location.reload()">Rafraîchir</button>
  `;
  document.body.appendChild(overlay);
}

/**
 * Role : Met à jour l’indicateur visuel de l’état de la connexion réseau (online/offline).
 * Préconditions : 
 *   - Un élément DOM avec la classe `.status-dot` existe.
 *   - La classe CSS `online` et `offline` définissent les styles correspondants.
 * Postconditions : 
 *   - La classe de l’élément `.status-dot` est remplacée par `status-dot ${status}`.
 */


function updateConnectionStatus(status) {
  const statusDot = document.querySelector('.status-dot');
  if (statusDot) {
      statusDot.className = 'status-dot ' + status;
  }
}


/**
 * Role : Envoie un message JSON sécurisé via WebSocket si la connexion est ouverte.
 * Préconditions :
 *   - La variable globale `socket` est une instance WebSocket.
 *   - `socket.readyState === WebSocket.OPEN` indique que la connexion est active.
 * Postconditions :
 *   - Si la connexion est ouverte, le message est sérialisé en JSON et transmis, et la fonction retourne `true`.
 *   - Sinon, aucun envoi n’est effectué et la fonction retourne `false`.
 */

function sendMessage(message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return true;
  }
  return false;
}

// Nettoyage lors de la fermeture de la page
window.addEventListener('beforeunload', () => {
  if (socket) {
      socket.onclose = null; // Prévenir onclose de tenter une reconnexion
      socket.close();
  }
  clearTimeout(reconnectTimeout);
});





/**
 * Role : Nettoie les ressources et listeners lors de la fermeture ou du reset de la partie.
 * Préconditions :
 *   - Les écouteurs clavier (`keydown`, `keyup`) ont été enregistrés.
 *   - Un intervalle ping (`pingIntervalId`) peut être actif.
 *   - La boucle de rendu est lancée via `requestAnimationFrame`, avec identifiant `gameLoopId`.
 *   - La connexion WebSocket `socket` peut être ouverte.
 * Postconditions :
 *   - Les écouteurs clavier sont retirés.
 *   - L’intervalle de ping est arrêté.
 *   - Si la WebSocket est ouverte, elle est fermée proprement.
 *   - La boucle de rendu animée est annulée (`cancelAnimationFrame`).
 */

function cleanup() {
  document.removeEventListener("keydown", onKeyDown);
  document.removeEventListener("keyup",   onKeyUp);
  clearInterval(pingIntervalId);
  if (socket.readyState === WebSocket.OPEN) socket.close();
  cancelAnimationFrame(gameLoopId);
}

/**
 * Role : Démarre un chronomètre de recherche de partie en affichant un compteur de secondes écoulées.
 * Préconditions :
 *   - Les variables globales `searchStartTime` et `searchTimerInterval` peuvent être définies.
 *   - L’élément DOM `timerSpan` (affichage du temps) existe.
 * Postconditions :
 *   - `searchStartTime` est mis à l’horodatage courant.
 *   - Un intervalle est stocké dans `searchTimerInterval`, qui met à jour `timerSpan.textContent` chaque seconde avec le nombre de secondes écoulées depuis `searchStartTime`.
 */

function startSearchTimer() {
  searchStartTime = Date.now();
  timerSpan.textContent = "0";
  searchTimerInterval = setInterval(() => {
    const secs = Math.floor((Date.now() - searchStartTime) / 1000);
    timerSpan.textContent = secs;
  }, 1000);
}


/**
 * Role : Arrête le chronomètre de recherche de partie en cours.
 * Préconditions :
 *   - Un intervalle a été créé et stocké dans `searchTimerInterval`.
 * Postconditions :
 *   - L’intervalle référencé par `searchTimerInterval` est annulé et ne met plus à jour l’affichage du temps.
 */
function stopSearchTimer() {
  clearInterval(searchTimerInterval);
}


/**
 * Role : Met à jour visuellement le nombre de vies restantes pour chaque joueur en affichant une icône cœur par vie.
 * Préconditions : 
 *   - Les variables globales `livesLeft` et `livesRight` sont définies avec un entier ≥ 0.
 *   - Les éléments DOM référencés par `livesLeftContainer` et `livesRightContainer` existent.
 *   - L’image de vie (`"../../shared/vie.png"`) est accessible.
 * Postconditions : 
 *   - `livesLeftContainer` et `livesRightContainer` sont vidés puis remplis d’autant de `<img class="life-heart">` que de vies restantes pour chaque côté.
 */

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



/**
 * Role : Déclenche un effet visuel de flash et de secousse sur le conteneur de jeu pour signaler la perte d’une vie.
 * Préconditions : 
 *   - L’élément DOM `#game-container` existe.
 *   - La constante `IMPACT_DURATION` (durée en ms) est définie.
 *   - Les classes CSS `flash` et `shake` sont définies pour l’animation.
 * Postconditions : 
 *   - Les classes `flash` et `shake` sont ajoutées à `#game-container` puis automatiquement retirées après `IMPACT_DURATION` millisecondes.
 */

function triggerImpact() {
  const container = document.getElementById("game-container");
  container.classList.add("flash", "shake");
  setTimeout(() => {
    container.classList.remove("flash", "shake");
  }, IMPACT_DURATION);
}



/**
 * Role : Gère les événements de touche enfoncée pour contrôler le vaisseau et déclencher le tir.
 * Préconditions :
 *   - Les écouteurs clavier ont été ajoutés pour écouter `keydown`.
 *   - Les variables globales `moveUp`, `moveDown` et `spacePressed` sont définies.
 *   - La fonction `shoot()` et la constante `SHOOT_CLIENT_COOLDOWN` sont disponibles.
 * Postconditions :
 *   - Pour `ArrowUp` et `ArrowDown`, les drapeaux `moveUp` ou `moveDown` passent à `true`.
 *   - Pour `Space`, si aucune balle n’a encore été tirée pendant l’appui (`spacePressed === false`), appelle `shoot()` et met `spacePressed = true` pour empêcher les tirs répétés tant que la touche est maintenue.
 */

function onKeyDown(e) {
  switch (e.code) {
    case "ArrowUp":
      moveUp = true;
      break;
    case "ArrowDown":
      moveDown = true;
      break;
    case "Space":
      if (!spacePressed) {
        shoot();
        spacePressed = true;
      }
      break;
  }
}

/**
 * Role : Gère les événements de touche relâchée pour arrêter le mouvement ou réarmer le tir.
 * Préconditions :
 *   - Les écouteurs clavier ont été ajoutés pour écouter `keyup`.
 *   - Les variables globales `moveUp`, `moveDown` et `spacePressed` sont définies.
 * Postconditions :
 *   - Pour `ArrowUp` et `ArrowDown`, les drapeaux `moveUp` ou `moveDown` passent à `false`.
 *   - Pour `Space`, `spacePressed` passe à `false` pour permettre un nouveau tir au prochain appui.
 */

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

/**
 * Role : Envoie un ordre de tir au serveur via WebSocket, applique un délai de cooldown côté client et affiche l’animation de recul du vaisseau.
 * Préconditions : 
 *   - `socket` est une instance WebSocket ouverte (`readyState === WebSocket.OPEN`).
 *   - La variable globale `mySide` (‘left’ ou ‘right’) est définie.
 *   - Les constantes `SHOOT_CLIENT_COOLDOWN` (ms) et `SHIP_HEIGHT` (px) sont définies.
 *   - Les variables globales `lastClientShoot`, `shipLeft`, `shipRight`, `shipLeftTargetY`, `shipRightTargetY` existent.
 * Postconditions : 
 *   - Si le cooldown n’est pas écoulé, aucun tir n’est envoyé.
 *   - Sinon, `lastClientShoot` est mis à l’horodatage courant, un message `{ type: "shoot", side, y }` est transmis au serveur, et le vaisseau concerné reçoit la classe `ship-fired` brièvement pour l’effet visuel.
 */

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

/**
 * Role : Boucle de rendu principale : met à jour les indicateurs de cooldown, intercepte les mouvements du joueur, interpole les positions des vaisseaux et envoie leurs coordonnées au serveur.
 * Préconditions : 
 *   - Les variables globales `lastClientShoot`, `SHOOT_CLIENT_COOLDOWN`, `moveUp`, `moveDown`, `mySide`, `shipLeftTargetY`, `shipRightTargetY`, `shipLeftY`, `shipRightY`, `MOVE_SPEED`, `INTERPOLATION_FACTOR`, `SHIP_HEIGHT`, `cooldownIndicator` existent.
 *   - La fonction `sendPosition()` est définie et `requestAnimationFrame` est disponible.
 * Postconditions : 
 *   - L’angle et la couleur du cercle de cooldown sont mis à jour via CSS variables.
 *   - Si le joueur déplace son vaisseau, `ship*TargetY` est ajusté et `sendPosition()` est appelé.
 *   - Les positions visuelles `ship*Y` sont interpolées vers `ship*TargetY`.
 *   - Les styles `bottom` des éléments `shipLeft` et `shipRight` sont mis à jour.
 *   - La fonction se réenregistre pour la frame suivante via `requestAnimationFrame`.
 */


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


/**
 * Role : Envoie périodiquement la position verticale du vaisseau au serveur via WebSocket, en appliquant un mécanisme de déduplication et de throttling.
 * Préconditions : 
 *   - La variable globale `mySide` (‘left’ ou ‘right’) est définie.
 *   - `socket` est une instance WebSocket ouverte (readyState === WebSocket.OPEN).
 *   - Les constantes `SHIP_HEIGHT` et `POSITION_SEND_INTERVAL` (intervalle minimum entre envois) sont définies.
 *   - Les variables globales `shipLeftTargetY`, `shipRightTargetY`, `lastSentPos`, `lastSentTime` existent.
 * Postconditions : 
 *   - Si la position calculée (`posTop`) est identique à la dernière envoyée ou si l’intervalle minimum n’est pas écoulé, aucun envoi n’a lieu.
 *   - Sinon, un message JSON `{ type: "move", position: posTop }` est transmis au serveur, et `lastSentPos` et `lastSentTime` sont mis à jour.
 */

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


/**
 * Role : Met à jour l’état du jeu côté client à partir des données reçues du serveur (positions, vies, projectiles).
 * Préconditions : 
 *   - L’argument `state` est un objet provenant du serveur contenant au moins les propriétés `{ leftY, rightY, livesLeft, livesRight, names, bullets }`.
 *   - Les fonctions `getTile(col, row)`, `triggerImpact()`, `renderLives()` et les variables globales `shipLeftTargetY`, `shipRightTargetY`, `livesLeft`, `livesRight`, `prevLivesLeft`, `prevLivesRight`, `player1Name`, `player2Name` existent.
 * Postconditions : 
 *   - Les coordonnées cibles des vaisseaux sont recalculées pour l’interpolation visuelle.
 *   - La détection de perte de vie déclenche `triggerImpact()` et met à jour les compteurs précédents.
 *   - L’affichage des vies est rafraîchi.
 *   - Tous les anciens éléments `.bullet` sont supprimés, puis de nouveaux éléments `<img class="bullet">` sont créés et positionnés pour chaque projectile de `state.bullets`.
 */

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




/**
 * Role : Affiche l’écran de fin de partie avec le nom du gagnant, gère le compte à rebours de redirection et déclenche la mise à jour des classements ELO.
 * Préconditions : 
 *   - La variable globale `waitingOverlay` référence l’overlay de matchmaking et peut être masquée.
 *   - L’élément DOM `#gameover-overlay` et `#gameover-message` existent pour afficher le modal et le message.
 *   - Les variables globales `mySide`, `myUsername`, `opponentName` et `userToken` sont définies.
 *   - La fonction `updateEloRatings(winner, loser)` est disponible.
 * Postconditions : 
 *   - L’overlay de matchmaking est masqué et l’overlay de Game Over est affiché.
 *   - Le message “<winner> a gagné !” est injecté dans `#gameover-message`.
 *   - Les noms du gagnant et du perdant sont déterminés selon `mySide` et passés à `updateEloRatings()`.
 *   - Un compte à rebours de 5 s est lancé, montrant “Redirection vers le menu dans X…” et redirige vers `/game/guerre_menu/guerre_menu.html` une fois écoulé. :contentReference[oaicite:0]{index=0}
 */


function showGameOver(winner) {
  // masquer l'overlay de matchmaking
  waitingOverlay.style.display = "none";

  // afficher l'overlay de fin
  const overlay = document.getElementById("gameover-overlay");
  const msg = document.getElementById("gameover-message");

  // Afficher le message avec le nom du gagnant
  msg.textContent = `${winner} a gagné !`;

  // déterminer la mise à jour de l'ELO avec myUsername
  const playerOnLeft   = mySide === "left";
  const leftPlayerWon  = winner === (playerOnLeft ? myUsername : opponentName);
  const winnerUsername = leftPlayerWon
    ? (playerOnLeft ? myUsername : opponentName)
    : (playerOnLeft ? opponentName : myUsername);
  const loserUsername  = leftPlayerWon
    ? (playerOnLeft ? opponentName : myUsername)
    : (playerOnLeft ? myUsername : opponentName);
  console.log(`Game over! Winner: ${winnerUsername}, Loser: ${loserUsername}`);
  updateEloRatings(winnerUsername, loserUsername);

  overlay.classList.remove("hidden");

  // countdown display
  const countdownEl = document.getElementById("redirect-countdown");
  let timer = 5;
  countdownEl.textContent = `Redirection vers le menu dans ${timer}…`;

  const intervalId = setInterval(() => {
    timer--;
    if (timer > 0) {
      countdownEl.textContent = `Redirection vers le menu dans ${timer}…`;
    } else {
      clearInterval(intervalId);
      window.location.href = "/game/guerre_menu/guerre_menu.html";
    }
  }, 1000);
}





/**
 * Role : Envoie au serveur une requête POST pour mettre à jour les cotes ELO du gagnant et du perdant.
 * Préconditions : 
 *   - Les arguments `winner` et `loser` sont des chaînes de caractères valides (noms d’utilisateurs).
 *   - La constante `API_URL` et la variable `userToken` (JWT) sont définies.
 *   - L’API accepte les POST vers `${API_URL}/api/update-elo` avec en-tête `Authorization: Bearer <token>`.
 * Postconditions : 
 *   - Si la requête réussit (`resp.ok`), le résultat JSON est loggué en console.
 *   - En cas d’erreur (réseau ou réponse non OK), un message d’erreur est loggué en console. :contentReference[oaicite:1]{index=1}
 */

async function updateEloRatings(winner, loser) {
  console.log(`Updating ELO: winner=${winner}, loser=${loser}`);
  try {
    const resp = await fetch(`${API_URL}/api/update-elo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        winner,
        loser
      })
    });

    if (resp.ok) {
      const data = await resp.json();
      console.log('ELO mis à jour avec succès:', data);
    } else {
      console.error('Erreur lors de la mise à jour de l\'ELO:', await resp.text());
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'ELO:', error);
  }
}
