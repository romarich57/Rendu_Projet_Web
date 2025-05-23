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


// 1) Base URL de l’API (à ajuster au port réel de votre back-end)
const API_BASE = "https://api.rom-space-game.realdev.cloud/api/snake";


// 2) Récupérer le niveau max depuis l’API
/**
 * Rôle : Récupère le niveau maximum débloqué depuis le serveur via l’API.
 * Préconditions : Un token d’authentification valide doit être présent dans localStorage sous la clé "token".
 * Postconditions : Retourne une Promise résolue avec la valeur maxNiveau récupérée, ou lève une erreur si la requête échoue.
 */


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




/**
 * Rôle : Envoie le score, le niveau courant et le temps de jeu écoulé au serveur pour sauvegarde.
 * Préconditions : 
 *   - Un token d'authentification valide doit être présent dans localStorage sous la clé "token".
 *   - Les variables `score`, `currentLevel` et `temps` doivent être initialisées et valides.
 * Postconditions : 
 *   - Si la requête réussit, le serveur enregistre les données et un message de confirmation est loggé.
 *   - En cas d’échec, une erreur est loggée et levée.
 */



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


/**
 * Rôle : Met à jour les paramètres de niveau (taille de la grille, chance de bombe et vitesse) selon currentLevel.
 * Préconditions : currentLevel défini et compris entre 1 et levelSettings.length ; levelSettings initialisé.
 * Postconditions : GRID_SQUARE_ROOT, bombChance et gameSpeed sont définis selon les réglages du niveau courant.
 */

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

/**
 * Rôle : Calcule l'angle de rotation en degrés pour orienter le serpent selon le vecteur de déplacement.
 * Préconditions : dx et dy forment un vecteur unitaire sur les axes (dx,dy ∈ {1,0,-1} et |dx|+|dy|=1).
 * Postconditions : Retourne 0, 90, 180 ou -90 selon la direction ; 0 par défaut si le vecteur n’est pas reconnu.
 */
function getRotationFromVector(dx, dy) {
  if (dx===1&&dy===0)   return 0;
  if (dx===-1&&dy===0)  return 180;
  if (dx===0&&dy===1)   return 90;
  if (dx===0&&dy===-1)  return -90;
  return 0;
}

/**
 * Rôle : Détermine l’angle de rotation pour orienter le segment du serpent entre deux nœuds.
 * Préconditions : 
 *   - n1 et n2 sont des instances de Node avec une propriété `value` valide (0 ≤ value < GRID_SQUARE_ROOT²).
 *   - GRID_SQUARE_ROOT est initialisé.
 * Postconditions : Retourne l’angle (0, 90, 180 ou 270) obtenu via getRotationFromVector(c2-c1, r2-r1).
 */
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



/**
 * Rôle : Met à jour l’affichage des tuiles du serpent : classes CSS et rotations pour la tête, le corps (droit ou coin) et la queue.
 * Préconditions : 
 *   - `snake` initialisé avec `head`, `tail`, `direction` et `length`.
 *   - `tiles` est un tableau de tuiles (div) de la grille, chacune avec `nature`, `classList` et `style`.
 *   - Fonctions utilitaires `getRotationForDirection` et `getRotationFromNodes` disponibles.
 * Postconditions : 
 *   - Chaque tuile occupée par le serpent reçoit la classe appropriée (`snake-head`, `snake-body`, `snake-tail`, coin CW/CCW) et sa rotation CSS.
 */

function updateSnakeDisplay(){
  let node = snake.tail,
      prev = null;

  while(node){
    // 1) on reset tous les états
    tiles[node.value].classList.remove(
      "snake-head",
      "snake-body",
      "snake-tail",
      "snake-body-corner-cw",
      "snake-body-corner-ccw"
    );

    let angle = 0;

    // 2) la tête
    if(node === snake.head){
      tiles[node.value].classList.add("snake-head");
      angle = getRotationForDirection(snake.direction);
    }
    // 3) la queue
    else if(node === snake.tail){
      tiles[node.value].classList.add("snake-tail");
      if(node.next){
        angle = getRotationFromNodes(node, node.next);
      }
    }
    // 4) le corps (droit ou coin)
    else {
      const nextN = node.next,
            aPrev = getRotationFromNodes(prev, node),   // 0,90,180,270
            aNext = getRotationFromNodes(node, nextN);

      if(aPrev !== aNext){
        // ── coin ──
        const delta = (aNext - aPrev + 360) % 360;    // 90 ou 270

        if(delta === 90){
          // virage horaire
          tiles[node.value].classList.add("snake-body-corner-cw");
          angle = (aPrev + 90) % 360;
        } else {
          // virage anti-horaire
          tiles[node.value].classList.add("snake-body-corner-ccw");
          angle = (aPrev - 270) % 360;
        }
      }
      else {
        // ── segment droit ──
        tiles[node.value].classList.add("snake-body");
        angle = aNext;
      }
    }

    // 5) applique la rotation
    tiles[node.value].style.transform = `rotate(${angle}deg)`;

    prev = node;
    node = node.next;
  }
}





/**
 * Rôle : Sélectionne aléatoirement un index de tuile vide dans la grille.
 * Préconditions : 
 *   - `GRID_SQUARE_ROOT` initialisé pour définir la taille de la grille.
 *   - `tiles` est un tableau de tuiles avec leur propriété `nature` définie.
 *   - La constante `EMPTY` correspond à l’état vide d’une tuile.
 * Postconditions : 
 *   - Retourne un entier `idx` tel que `tiles[idx].nature === EMPTY`.
 */
function get_random_index(){
  const max = GRID_SQUARE_ROOT*GRID_SQUARE_ROOT;
  let idx = Math.floor(Math.random()*max);
  while(tiles[idx].nature!==EMPTY){
    idx = (idx+1)%max;
  }
  return idx;
}

/**
 * Rôle : Retourne la tuile se trouvant devant la tête du serpent selon sa direction actuelle.
 * Préconditions : 
 *   - `snake.head.value` contient l’index de la case où se trouve la tête.
 *   - `snake.direction` est défini comme l’un des décalages UP, DOWN, LEFT ou RIGHT.
 *   - `tiles` est un tableau de tuiles couvrant intégralement la grille.
 * Postconditions : 
 *   - Renvoie l’élément du tableau `tiles` correspondant à la prochaine position de la tête.
 */

function get_next_tile_for_head(){
  return tiles[snake.head.value + snake.direction];
}

/**
 * Rôle : Détermine si la tête du serpent va heurter un mur à la prochaine case selon sa direction.
 * Préconditions : 
 *   - `snake.head.value` contient l’index de la tuile de la tête.
 *   - `snake.direction` défini comme UP, DOWN, LEFT ou RIGHT.
 *   - `GRID_SQUARE_ROOT` initialise la largeur/hauteur de la grille.
 * Postconditions : 
 *   - Retourne `true` si la tête se trouve au bord et avance vers l’extérieur de la grille, `false` sinon.
 */
function will_hit_wall(){
  const idx = snake.head.value,
        mod = idx % GRID_SQUARE_ROOT;
  if(idx < GRID_SQUARE_ROOT    && snake.direction===UP)    return true;
  if(idx >= GRID_SQUARE_ROOT*(GRID_SQUARE_ROOT-1) && snake.direction===DOWN)  return true;
  if(mod===0                  && snake.direction===LEFT)  return true;
  if(mod===GRID_SQUARE_ROOT-1 && snake.direction===RIGHT) return true;
  return false;
}


/**
 * Rôle : Place un fruit sur une tuile vide sélectionnée aléatoirement.
 * Préconditions : 
 *   - `GRID_SQUARE_ROOT` et `tiles` initialisés.
 *   - Au moins une tuile a `nature === EMPTY`.
 *   - La constante `FRUIT` définie.
 * Postconditions : 
 *   - Une tuile vide voit sa propriété `nature` passée à `FRUIT`.
 *   - La classe CSS `"fruit"` est ajoutée à cette tuile.
 */
function spawnFruit(){
  const f = get_random_index();
  tiles[f].nature = FRUIT;
  tiles[f].classList.add("fruit");
}

/**
 * Rôle : Place une bombe sur une tuile vide sélectionnée aléatoirement.
 * Préconditions : 
 *   - `GRID_SQUARE_ROOT` et `tiles` initialisés.
 *   - Au moins une tuile a `nature === EMPTY`.
 *   - La constante `BOMB` définie.
 * Postconditions : 
 *   - Une tuile vide voit sa propriété `nature` passée à `BOMB`.
 *   - La classe CSS `"bomb"` est ajoutée à cette tuile.
 */

function spawnBomb(){
  const b = get_random_index();
  tiles[b].nature = BOMB;
  tiles[b].classList.add("bomb");
}



/**
 * Rôle : Vérifie si le score atteint le seuil pour passer au niveau suivant et, le cas échéant, incrémente le niveau, met à jour ses paramètres, stoppe le jeu et affiche l’overlay de montée de niveau.
 * Préconditions : 
 *   - `currentLevel` défini et `levelSettings` initialisé.
 *   - `score` mis à jour.
 *   - Fonctions `updateLevelSettings()` et `stopGame()` disponibles.
 * Postconditions : 
 *   - Si `score ≥ unlockScore` du niveau courant et qu’un niveau supérieur existe :
 *       • `currentLevel` incrémenté  
 *       • Appel à `updateLevelSettings()`  
 *       • Jeu stoppé (`stopGame()` + `playing = false`)  
 *       • Overlay de niveau supérieur affiché avec le nouveau numéro de niveau  
 */

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



/**
 * Rôle : (Re)initialise complètement l’état du jeu : paramètres de niveau, directions, grille, serpent, score et placement du fruit.
 * Préconditions : 
 *   - `currentLevel` défini et `updateLevelSettings()` déjà appelé au moins une fois.
 *   - Élément `grid` existant dans le DOM avec un style CSS grid.
 *   - Les constantes `UP`, `DOWN`, `LEFT`, `RIGHT`, `EMPTY` et la classe `Snake` sont disponibles.
 * Postconditions : 
 *   - Paramètres de direction et de niveau à jour.
 *   - Pop-up « game over » masqué.
 *   - Jeu stoppé (`playing = false`, aucune intervalle en cours).
 *   - `score` remis à zéro et affichage mis à jour.
 *   - Grille vidée, recreusée avec exactement `GRID_SQUARE_ROOT²` tuiles vides.
 *   - Serpent créé au centre de la grille avec deux premiers segments.
 *   - Un fruit spawné aléatoirement sur une tuile vide.
 */

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

/**
 * Rôle : Avance le serpent d’un pas : libère l’ancienne queue, ajoute une nouvelle tête et met à jour l’affichage.
 * Préconditions : 
 *   - `snake` initialisé avec des `head` et `tail` valides et `tiles` défini.
 *   - La constante `SNAKE` et la classe `Node` disponibles.
 * Postconditions : 
 *   - L’ancienne tuile de queue voit sa nature repassée à `EMPTY` et ses classes CSS de serpent retirées.
 *   - Un nouveau nœud tête est créé à l’index `oldHead + direction` et lié à la liste.
 *   - `snake.head` et `snake.tail` mis à jour.
 *   - La nouvelle tuile de tête voit sa nature passée à `SNAKE`.
 *   - Appel à `updateSnakeDisplay()` pour refléter ces changements visuels.
 */

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

/**
 * Rôle : Gère un cycle de jeu en déplaçant le serpent ou en traitant les collisions et consommations.
 * Préconditions :
 *   - `playing === true`
 *   - `snake.head`, `snake.direction`, `tiles` et constantes `UP`, `DOWN`, `LEFT`, `RIGHT`, `FRUIT`, `BOMB`, `SNAKE` sont initialisés.
 *   - Fonctions utilitaires `will_hit_wall()`, `endGame()`, `get_next_tile_for_head()`, `moveSnake()`, `spawnFruit()`, `spawnBomb()`, `updateScore()`, `checkLevelUp()` disponibles.
 * Postconditions :
 *   - Si collision mur, bombe ou corps : `endGame()` appelé avec le message approprié et le jeu s’arrête.
 *   - Si fruit : tuile fruit retirée, appel à `snake.eat()`, `score` incrémenté, `updateScore()`, `spawnFruit()`, `checkLevelUp()`.
 *   - Sinon : `moveSnake()` pour avancer normalement.
 *   - Après tout mouvement, possibilité de `spawnBomb()` selon `bombChance`.
 */

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

/**
 * Rôle : Démarre la boucle de jeu en programmant des appels répétés à la fonction de déplacement.
 * Préconditions : 
 *   - `gameInterval` défini (peut être `null` si aucune boucle n’est en cours).
 *   - Les variables `move` (fonction) et `gameSpeed` (intervalle en millisecondes) sont initialisées.
 * Postconditions : 
 *   - Si aucune boucle n’était active (`gameInterval` falsy), `gameInterval` reçoit l’identifiant du nouvel intervalle.
 *   - La fonction `move` sera appelée toutes les `gameSpeed` millisecondes.
 */

function startGame(){
  if(gameInterval) return;
  gameInterval = setInterval(move, gameSpeed);
}

/**
 * Rôle : Arrête la boucle de jeu en annulant l’intervalle courant.
 * Préconditions : 
 *   - `gameInterval` contient l’identifiant d’un intervalle actif ou est `null`.
 * Postconditions : 
 *   - Si un intervalle existait, il est effacé (`clearInterval`) et `gameInterval` remis à `null`.
 */

function stopGame(){
  if(gameInterval){
    clearInterval(gameInterval);
    gameInterval = null;
  }
}


/**
 * Rôle : Termine la partie en stoppant le jeu, enregistrant le score et en affichant l’écran de fin.
 * Préconditions : 
 *   - `playing === true` ou en cours de partie.
 *   - `startTime` a été initialisé au lancement du jeu.
 *   - Les fonctions `stopGame()` et `saveScore()` sont disponibles.
 *   - Un élément DOM avec l’ID `"gameOverOverlay"` existe pour l’affichage.
 * Postconditions : 
 *   - `playing` passe à `false` et la boucle de jeu est annulée.
 *   - Le score et le temps écoulé sont envoyés au serveur via `saveScore()`.
 *   - L’overlay Game Over est rendu visible (`classList.remove("hidden")`).
 */

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
    overlay.classList.remove("hidden");
  }
}


/**
 * Rôle : Met à jour l’affichage du score et du niveau dans les éléments DOM dédiés.
 * Préconditions : 
 *   - Les variables `score` et `currentLevel` sont définies et à jour.
 *   - L’élément avec l’ID `"scoreValue"` existe dans le DOM.
 *   - L’élément avec l’ID `"levelValue"` peut exister dans le DOM.
 * Postconditions : 
 *   - Le texte de `"scoreValue"` reflète la valeur de `score`.
 *   - Si présent, le texte de `"levelValue"` reflète la valeur de `currentLevel`.
 */


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
 * Rôle : Met en pause ou relance le jeu en basculant le flag de jeu actif et gérant la boucle de jeu.
 * Préconditions : 
 *   - La variable `playing` est définie et de type booléen.
 *   - Les fonctions `startGame()` et `stopGame()` sont disponibles.
 * Postconditions : 
 *   - `playing` inversé (true ⇄ false).
 *   - Si `playing` devient true, la boucle de jeu est démarrée.
 *   - Si `playing` devient false, la boucle de jeu est arrêtée.
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
 * Rôle : Affiche un compte à rebours de `duration` secondes avant de lancer réellement la partie.
 * Préconditions : 
 *   - `duration` est un entier strictement positif.
 *   - `countdownInProgress` est défini et à `false`.
 *   - Les éléments DOM avec les IDs `"countdownOverlay"` et `"countdownNumber"` existent.
 *   - Les variables `startTime`, `playing` et la fonction `startGame()` sont disponibles.
 * Postconditions : 
 *   - `countdownInProgress` passe à `true` pendant le décompte, puis revient à `false`.
 *   - L’overlay de décompte est masqué une fois terminé.
 *   - `startTime` est assigné à la date/heure de fin du décompte.
 *   - `playing` passe à `true` et la boucle de jeu démarre (`startGame()` est appelé).
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



