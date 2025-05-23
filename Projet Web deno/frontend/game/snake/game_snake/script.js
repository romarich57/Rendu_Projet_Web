/***********************************
 *        PARAMÈTRES DE NIVEAU
 ***********************************/
let countdownInProgress = false;

const levelSettings = [
  { level: 1,  grid: 10, unlockScore:   5, bombChance: 0.00, speed: 240 },
  { level: 2,  grid: 11, unlockScore:  10, bombChance: 0.00, speed: 220 },
  { level: 3,  grid: 12, unlockScore:  15, bombChance: 0.00, speed: 200 },
  { level: 4,  grid: 13, unlockScore:  20, bombChance: 0.00, speed: 190 },
  { level: 5,  grid: 14, unlockScore:  25, bombChance: 0.00, speed: 180 },
  { level: 6,  grid: 15, unlockScore:  30, bombChance: 0.00, speed: 170 },
  { level: 7,  grid: 16, unlockScore:  35, bombChance: 0.00, speed: 160 },
  { level: 8,  grid: 17, unlockScore:  40, bombChance: 0.00, speed: 150 },
  { level: 9,  grid: 18, unlockScore:  45, bombChance: 0.00, speed: 140 },
  { level: 10, grid: 20, unlockScore:  50, bombChance: 0.00, speed: 130 },
  { level: 11, grid: 20, unlockScore:  60, bombChance: 0.02, speed: 120 },
  { level: 12, grid: 20, unlockScore:  70, bombChance: 0.03, speed: 110 },
  { level: 13, grid: 20, unlockScore:  80, bombChance: 0.04, speed: 100 },
  { level: 14, grid: 20, unlockScore:  90, bombChance: 0.05, speed:  90 },
  { level: 15, grid: 20, unlockScore: 100, bombChance: 0.06, speed:  80 },
  { level: 16, grid: 20, unlockScore: 110, bombChance: 0.07, speed:  70 },
  { level: 17, grid: 20, unlockScore: 120, bombChance: 0.08, speed:  60 },
  { level: 18, grid: 20, unlockScore: 130, bombChance: 0.09, speed:  50 },
  { level: 19, grid: 20, unlockScore: 140, bombChance: 0.10, speed:  40 },
  { level: 20, grid: 20, unlockScore: 9999, bombChance: 0.12, speed:  30 }
];

const BOMB = 3;
// ─── Sauvegarde & suivi du temps ─────────────────────────────────────────
let startTime = null;
// /path/to/script.js

// /mnt/data/script.js

// 1) Base URL de l’API (à ajuster au port réel de votre back-end)
const API_BASE = "https://api.rom-space-game.realdev.cloud/api/snake";

// 2) Récupérer le niveau max depuis l’API
async function chargerNiveauMax() {
  try {
    const token = localStorage.getItem("token"); // récupérer le token
    const res = await fetch(`${API_BASE}/getMaxNiveau`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` // ajout de l'en-tête d'autorisation
      }
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`GET /getMaxNiveau ▶ ${res.status}`, errText);
      throw new Error(`Serveur a répondu ${res.status}`);
    }
    const { maxNiveau } = await res.json();
    return maxNiveau;
  } catch (err) {
    if (err instanceof TypeError) {
      console.error("Impossible de joindre le serveur :", err.message);
      alert("Le serveur n'est pas joignable : vérifiez qu'il tourne bien.");
    } else {
      console.error("Erreur lors du chargement du niveau max :", err);
    }
    throw err;
  }
}




// Modification de chargerNiveauMax() pour centraliser l’URL et tester res.ok
async function saveScore(score) {
  try {
    const res = await fetch(`${API_BASE}/saveScore`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ score }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("POST /saveScore ▶", res.status, errText);
      throw new Error(`Échec enregistrement (${res.status})`);
    }
    const data = await res.json();
    console.log("Score enregistré avec succès :", data);
  } catch (err) {
    console.error("Erreur lors de l'enregistrement du score :", err);
    // Afficher un message utilisateur si besoin
  }
}



// Remplacer toutes les définitions de saveScore() par la suivante :
async function saveScore(score, temps) {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/saveScore`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ score, niveau: currentLevel, temps })
    });
    if (!res.ok) {
      console.error("POST /saveScore ▶", res.status, await res.text());
      throw new Error(`Failed to save score (${res.status})`);
    }
    console.log("Score enregistré avec succès");
  } catch (err) {
    console.error("Erreur lors de l'enregistrement du score", err);
  }
}
// ──────────────────────────────────────────────────────────────────────────


// Récupère le niveau dans l’URL
let urlParams    = new URLSearchParams(window.location.search);
let currentLevel = parseInt(urlParams.get("level")) || 1;
if (currentLevel < 1 || currentLevel > levelSettings.length) {
  currentLevel = 1;
}

// Variables dynamiques de niveau
let GRID_SQUARE_ROOT, bombChance, gameSpeed;
function updateLevelSettings() {
  const s = levelSettings[currentLevel - 1];
  GRID_SQUARE_ROOT = s.grid;
  bombChance       = s.bombChance;
  gameSpeed        = s.speed;
}
updateLevelSettings();

// Constantes de direction (recalculées dans init)
let UP, DOWN, LEFT, RIGHT;
const EMPTY = 0, SNAKE = 1, FRUIT = 2;

// Éléments globaux
let grid       = document.getElementById("my_grid");
let tiles      = [];
let snake;
let playing    = false;
let score      = 0;
let gameInterval = null;

// Node et Snake
class Node {
  constructor(value) {
    this.value = value;
    this.next  = null;
  }
}
class Snake {
  constructor() {
    this.head      = null;
    this.tail      = null;
    this.direction = 0;
    this.length    = 0;
  }
  eat(idx) {
    const n = new Node(idx);
    if (!this.head) {
      this.head = this.tail = n;
    } else {
      this.head.next = n;
      this.head      = n;
    }
    this.length++;
    tiles[idx].nature = SNAKE;
    updateSnakeDisplay();
  }
}

// Rotation & affichage du serpent
function getRotationFromVector(dx, dy) {
  if (dx===1&&dy===0)   return 0;
  if (dx===-1&&dy===0)  return 180;
  if (dx===0&&dy===1)   return 90;
  if (dx===0&&dy===-1)  return -90;
  return 0;
}
function getRotationFromNodes(n1,n2) {
  const r1=Math.floor(n1.value/GRID_SQUARE_ROOT),
        c1=n1.value%GRID_SQUARE_ROOT;
  const r2=Math.floor(n2.value/GRID_SQUARE_ROOT),
        c2=n2.value%GRID_SQUARE_ROOT;
  return getRotationFromVector(c2-c1,r2-r1);
}
function getRotationForDirection(d) {
  if (d===RIGHT) return   0;
  if (d===DOWN)  return  90;
  if (d===LEFT)  return 180;
  if (d===UP)    return -90;
  return 0;
}
function updateSnakeDisplay(){
  let node=snake.tail, prev=null;
  while(node){
    tiles[node.value].classList.remove(
      "snake-head","snake-body","snake-tail","snake-body-corner"
    );
    let angle=0;
    if(node===snake.head){
      tiles[node.value].classList.add("snake-head");
      angle=getRotationForDirection(snake.direction);
    }
    else if(node===snake.tail){
      tiles[node.value].classList.add("snake-tail");
      if(node.next) angle=getRotationFromNodes(node,node.next);
    }
    else{
      const nextN = node.next;
      const aPrev = getRotationFromNodes(prev,node);
      const aNext = getRotationFromNodes(node,nextN);
      if(aPrev!==aNext){
        tiles[node.value].classList.add("snake-body-corner");
        angle = aPrev + 90;
      } else {
        tiles[node.value].classList.add("snake-body");
        angle = aNext;
      }
    }
    tiles[node.value].style.transform = `rotate(${angle}deg)`;
    prev=node;
    node=node.next;
  }
}

// Utilitaires
function get_random_index(){
  const max = GRID_SQUARE_ROOT*GRID_SQUARE_ROOT;
  let idx = Math.floor(Math.random()*max);
  while(tiles[idx].nature!==EMPTY){
    idx = (idx+1)%max;
  }
  return idx;
}
function get_next_tile_for_head(){
  return tiles[snake.head.value + snake.direction];
}
function will_hit_wall(){
  const idx = snake.head.value,
        mod = idx % GRID_SQUARE_ROOT;
  if(idx < GRID_SQUARE_ROOT    && snake.direction===UP)    return true;
  if(idx >= GRID_SQUARE_ROOT*(GRID_SQUARE_ROOT-1) && snake.direction===DOWN)  return true;
  if(mod===0                  && snake.direction===LEFT)  return true;
  if(mod===GRID_SQUARE_ROOT-1 && snake.direction===RIGHT) return true;
  return false;
}
function spawnFruit(){
  const f = get_random_index();
  tiles[f].nature = FRUIT;
  tiles[f].classList.add("fruit");
}
function spawnBomb(){
  const b = get_random_index();
  tiles[b].nature = BOMB;
  tiles[b].classList.add("bomb");
}

// Passage de niveau
function checkLevelUp() {
  const settings = levelSettings[currentLevel - 1];
  if (currentLevel < levelSettings.length && score >= settings.unlockScore) {
    // on passe au level supérieur
    currentLevel++;
    updateLevelSettings();

    // ON AFFICHE L'OVERLAY level up (sans relancer tout de suite)
    stopGame();
    playing = false;
    const overlay = document.getElementById("levelUpOverlay");
    const numEl   = document.getElementById("levelUpNumber");
    if (overlay && numEl) {
      numEl.textContent = currentLevel;
      overlay.classList.remove("hidden");
    }
  }
}
// Enregistrement du niveau débloqué dans localStorage
localStorage.setItem("snakeUnlockedLevel", currentLevel);



// (Re)initialisation
function init(){
  updateLevelSettings();
  UP    = -GRID_SQUARE_ROOT;
  DOWN  =  GRID_SQUARE_ROOT;
  LEFT  = -1;
  RIGHT =  1;

  // Masquer le popup s’il existe
  const popup = document.getElementById("gameOverPopup");
  if(popup) popup.classList.add("hidden");

  stopGame();
  playing = false;
  score   = 0;
  updateScore();

  grid.innerHTML = "";
  tiles = [];
  grid.style.gridTemplateColumns = `repeat(${GRID_SQUARE_ROOT},1fr)`;
  grid.style.gridTemplateRows    = `repeat(${GRID_SQUARE_ROOT},1fr)`;

  snake = new Snake();
  for(let i=0; i<GRID_SQUARE_ROOT*GRID_SQUARE_ROOT; i++){
    const div = document.createElement("div");
    div.className    = "tile";
    div.nature       = EMPTY;
    div.indexInTiles = i;
    tiles.push(div);
    grid.appendChild(div);
  }

  const mid    = Math.floor(GRID_SQUARE_ROOT/2),
        center = mid*GRID_SQUARE_ROOT + mid;
  if(center-1>=0) snake.eat(center-1);
  snake.eat(center);
  snake.direction = RIGHT;

  spawnFruit();
}

// Boucle de jeu
function moveSnake(){
  const oldTail = snake.tail,
        newTail = oldTail.next;
  tiles[oldTail.value].nature = EMPTY;
  tiles[oldTail.value].classList.remove("snake-head","snake-body","snake-tail");

  const newHeadIndex = snake.head.value + snake.direction;
  const newNode      = new Node(newHeadIndex);
  snake.head.next    = newNode;
  snake.head         = newNode;
  snake.tail         = newTail;

  tiles[newHeadIndex].nature = SNAKE;
  updateSnakeDisplay();
}

function move(){
  if(!playing) return;
  if(will_hit_wall()){
    endGame("Vous avez percuté un mur !");
    return;
  }
  const nextTile = get_next_tile_for_head();
  if(nextTile.nature===BOMB){
    endGame("Vous avez touché une bombe !");
    return;
  }
  if(nextTile.nature===SNAKE){
    endGame("Vous vous êtes mordu !");
    return;
  }
  if(nextTile.nature===FRUIT){
    nextTile.classList.remove("fruit");
    snake.eat(nextTile.indexInTiles);
    score++;
    updateScore();
    spawnFruit();
    checkLevelUp();
  } else {
    moveSnake();
  }
  if(Math.random()<bombChance){
    spawnBomb();
  }
}

// Start / Stop
function startGame(){
  if(gameInterval) return;
  gameInterval = setInterval(move, gameSpeed);
}
function stopGame(){
  if(gameInterval){
    clearInterval(gameInterval);
    gameInterval = null;
  }
}

// Fin de partie
function endGame(message) {
  // stoppe le jeu
  playing = false;
  stopGame();

  // Calcul et envoi du score
  const tempsEcoule = startTime
    ? Math.floor((Date.now() - startTime) / 1000)
    : 0;
  // mise à jour de l'appel de saveScore pour inclure le temps
  saveScore(score, tempsEcoule);

  // affiche overlay Game Over
  const overlay = document.getElementById("gameOverOverlay");
  if (overlay) {
    // facultatif : si tu veux afficher message différent, insère ici
    // overlay.querySelector("h1").textContent = message;
    overlay.classList.remove("hidden");
  }
}


// Score & affichage niveau
function updateScore(){
  document.getElementById("scoreValue").textContent = score;
  const lvlEl = document.getElementById("levelValue");
  if(lvlEl) lvlEl.textContent = currentLevel;
}

// Gestion des touches
window.addEventListener("keydown", function(ev) {
  if (ev.defaultPrevented) return;
  let newDir = null;
  switch (ev.key) {
    case "ArrowDown":  newDir = DOWN;  break;
    case "ArrowUp":    newDir = UP;    break;
    case "ArrowLeft":  newDir = LEFT;  break;
    case "ArrowRight": newDir = RIGHT; break;

    case " ":
      if (!playing && !countdownInProgress) {
        showCountdown(5);
      }
      ev.preventDefault();
      return;

    default:
      return;
  }

  if (newDir + snake.direction !== 0) {
    snake.direction = newDir;
  }
  ev.preventDefault();
}, true);


/**
 * Met en pause ou relance le jeu
 */
function togglePause() {
  // on inverse le flag
  playing = !playing;

  if (playing) {
    startGame();
  } else {
    stopGame();
  }
}
/**
 * Affiche un décompte de `duration` secondes, puis lance la partie.
 */
function showCountdown(duration = 5) {
  if (countdownInProgress) return;
  countdownInProgress = true;

  const overlay   = document.getElementById("countdownOverlay");
  const numberEl  = document.getElementById("countdownNumber");
  let counter     = duration;

  overlay.classList.remove("hidden");
  numberEl.textContent = counter;

  const timer = setInterval(() => {
    counter--;
    if (counter > 0) {
      numberEl.textContent = counter;
    } else {
      clearInterval(timer);
      overlay.classList.add("hidden");
      countdownInProgress = false;
      // Démarrage du chrono
      startTime = Date.now();
      // Lancement réel du jeu
      playing = true;
      startGame();
    }
  }, 1000);
}

// Boutons de l'overlay Game Over
document.getElementById("replayBtn").addEventListener("click", () => {
  const overlay = document.getElementById("gameOverOverlay");
  overlay.classList.add("hidden");
  init();           // relance la partie
});

document.getElementById("quitBtn").addEventListener("click", () => {
  window.location.href = "../home_page/home.html";  // retourne au menu
});
// Actions des boutons de l'overlay Level UP
document.getElementById("nextLevelBtn").addEventListener("click", () => {
  const overlay = document.getElementById("levelUpOverlay");
  overlay.classList.add("hidden");
  init();            // reconstruit la grille + settings du nouveau niveau
  playing = true;
  startGame();       // lance immédiatement
});

document.getElementById("quitLevelBtn").addEventListener("click", () => {
  window.location.href = "../home_page/home.html";
});



(async () => {
  // 1) On récupère le dernier niveau débloqué
  const maxNiveau = await chargerNiveauMax();

  // 2) On lit le ?level= dans l'URL, sinon on prend maxNiveau
  const params = new URLSearchParams(window.location.search);
  const requested = parseInt(params.get("level"), 10);
  if (isNaN(requested)) {
    currentLevel = maxNiveau;
  } else {
    currentLevel = Math.min(Math.max(requested, 1), maxNiveau);
  }

  // 3) On applique et on lance le jeu
  updateLevelSettings();
  init();
  showCountdown(5);
})();



