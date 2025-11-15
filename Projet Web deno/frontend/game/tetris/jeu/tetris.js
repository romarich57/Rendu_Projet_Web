// script.js

// ——————————————————————————————
// 🔧 Paramètres et variables globales
// ——————————————————————————————
const API_DEFAULT = "https://api.rom-space-game.realdev.cloud";
const API_URL = (() => {
  if (typeof window === 'undefined') {
    return API_DEFAULT;
  }
  const custom = window.__API_BASE__;
  if (typeof custom === 'string' && custom.trim()) {
    return custom.trim().replace(/\/$/, '');
  }
  const { protocol, hostname, port } = window.location;
  const safeProtocol = protocol.startsWith('http') ? protocol : 'http:';
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const portMap = {
      '8000': '6000',
      '5173': '6000',
      '4173': '6000',
      '3000': '3000',
      '3001': '3001',
      '': '6000',
    };
    const targetPort = portMap[port] ?? '6000';
    return `${safeProtocol}//${hostname}:${targetPort}`;
  }
  return API_DEFAULT;
})();
const ROWS = 20;
const COLS = 10;
const gameBoard = document.getElementById("game-board");
const sMove      = document.getElementById('audio-move');
const sRotate    = document.getElementById('audio-rotate');
const sLine      = document.getElementById('audio-line');
const sGameOver  = document.getElementById('audio-gameover');
const sBgm       = document.getElementById('bgm');
let bgmOn        = true;
let isPaused = false;

const vitesses = [
  500, 450, 400, 350, 300,
  260, 220, 200, 180, 160,
  140, 120, 100,  90,  80,
   70,  60,  50,  40,  30
];


let grille = [];
let totalLignes = 0;
let score = 0;
let niveau = 0;
let intervalGravite = null;
let secondesEcoulees = 0;
let intervalTemps = null;

let tileSize, gridGap;
let prochainePiece = null;
let pieceActive = null;
let position = { x: 3, y: 0 };
let pieceEl = null;     
// Ghost piece
let ghostEl = null;


const NEXT_COUNT = 5;
let nextQueue = [];


// ——————————————————————————————
// 🎮 Étape 1 : Initialisation de la grille
// ——————————————————————————————

/**
 * Role : Initialise la grille de jeu en construisant la structure logique et son rendu visuel dans le DOM.
 * Préconditions : 
 *   - La constante ROWS et COLS sont définies.
 *   - La variable globale `grille` existe (tableau vide ou non initialisé).
 *   - L’élément DOM identifié par `gameBoard` est présent dans la page.
 * Postconditions : 
 *   - La variable globale `grille` est initialisée en tant que matrice ROWS×COLS remplie de 0.
 *   - ROWS×COLS éléments `<div>` avec la classe `cell` sont ajoutés à `gameBoard`.
 */


function initGrille() {
  for (let row = 0; row < ROWS; row++) {
    grille[row] = [];
    for (let col = 0; col < COLS; col++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      gameBoard.appendChild(cell);
      grille[row][col] = 0;
    }
  }
}


// ——————————————————————————————
// 🎮 Étape 2 : Tetriminos + zone NEXT
// ——————————————————————————————
const tetrominos = [
  { name: "I", shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], bloc: 1 },
  { name: "O", shape: [[1,1],[1,1]], bloc: 2 },
  { name: "T", shape: [[0,1,0],[1,1,1],[0,0,0]], bloc: 3 },
  { name: "L", shape: [[0,0,1],[1,1,1],[0,0,0]], bloc: 4 },
  { name: "J", shape: [[1,0,0],[1,1,1],[0,0,0]], bloc: 5 },
  { name: "S", shape: [[0,1,1],[1,1,0],[0,0,0]], bloc: 6 },
  { name: "Z", shape: [[1,1,0],[0,1,1],[0,0,0]], bloc: 7 }
];

// ——————————————————————————————
// 🎮 Génération d’une nouvelle pièce (clonage de shape)
// ——————————————————————————————

/**
 * Role : Tire la prochaine pièce à jouer, enrichit la file d’attente et met à jour l’affichage.
 * Préconditions : 
 *   - La file `nextQueue` est initialisée et contient au moins une pièce.
 *   - Les fonctions `cloneRandomTetromino()`, `afficherNextQueue()` et `createPieceDOM()` sont disponibles.
 * Postconditions : 
 *   - La variable globale `pieceActive` reçoit la première pièce de `nextQueue`.
 *   - Une nouvelle pièce aléatoire est ajoutée en fin de `nextQueue`.
 *   - La file d’attente visuelle (NEXT) est réaffichée dans le DOM.
 *   - Le DOM de la pièce active est créé et affiché.
 */

function generateTetromino() {
  // 1) Prend la tête de queue
  pieceActive = nextQueue.shift();

  // 2) Pousse une nouvelle pièce random
  nextQueue.push(cloneRandomTetromino());

  // 3) Ré-affiche la file
  afficherNextQueue();

  // 4) Affiche la pieceActive
  createPieceDOM(pieceActive);
}

/**
 * Role : Crée et retourne une copie indépendante d’un tétrimino choisi aléatoirement.
 * Préconditions : 
 *   - Le tableau global `tetrominos` est défini et non vide.
 * Postconditions : 
 *   - Aucun effet de bord sur `tetrominos`.
 *   - La fonction retourne un objet contenant :
 *       - `name` (chaîne) identique au modèle sélectionné,
 *       - `bloc` (nombre) identique au modèle sélectionné,
 *       - `shape` (matrice) copiée en profondeur pour ne pas modifier l’original.
 */


function cloneRandomTetromino() {
  const idx = Math.floor(Math.random() * tetrominos.length);
  const tmpl = tetrominos[idx];
  return {
    name: tmpl.name,
    bloc: tmpl.bloc,
    shape: tmpl.shape.map(row => [...row])
  };
}

/**
 * Role : Initialise la file des prochaines pièces en y insérant un nombre défini de tétriminos aléatoires, puis met à jour l’affichage.
 * Préconditions : 
 *   - La constante `NEXT_COUNT` (nombre d’éléments dans la file) est définie.
 *   - La fonction `cloneRandomTetromino()` et la fonction `afficherNextQueue()` sont disponibles.
 * Postconditions : 
 *   - La variable globale `nextQueue` contient exactement `NEXT_COUNT` tétriminos copiés aléatoirement.
 *   - La file visuelle des prochaines pièces (NEXT) est rafraîchie dans le DOM via `afficherNextQueue()`.
 */

function initNextQueue() {
  nextQueue = [];
  for (let i = 0; i < NEXT_COUNT; i++) {
    nextQueue.push(cloneRandomTetromino());
  }
  afficherNextQueue();
}

/**
 * Role : Affiche graphiquement dans le DOM la file des tétriminos à venir.
 * Préconditions : 
 *   - La variable globale `nextQueue` contient des objets tétriminos avec `shape` et `bloc`.
 *   - Les variables `tileSize` et `gridGap` (dimensions de tuile et espacement) sont initialisées.
 *   - L’élément DOM `next-container` existe.
 * Postconditions : 
 *   - Le conteneur `next-container` contient une `<div>` par tétrimino de `nextQueue`, chacune repositionnée et stylée selon sa forme.
 */

function afficherNextQueue() {
  const container = document.getElementById("next-container");
  container.innerHTML = "";
  const size = tileSize + gridGap;

  nextQueue.forEach(t => {
    const div = document.createElement("div");
    div.classList.add("next-piece");
    t.shape.forEach((row, y) => {
      row.forEach((v, x) => {
        if (v) {
          const tile = document.createElement("div");
          tile.classList.add("cell");
          tile.style.backgroundImage = `url('../assets/blocks/bloc${t.bloc}.png')`;
          tile.style.position = "absolute";
          tile.style.left = `${x * size}px`;
          tile.style.top  = `${y * size}px`;
          div.appendChild(tile);
        }
      });
    });
    container.appendChild(div);
  });
}

/**
 * Role : Affiche graphiquement un tétrimino donné dans la zone “Next”.
 * Préconditions : 
 *   - Le paramètre `tetromino` est un objet valide issu de `cloneRandomTetromino()`, avec `shape` et `bloc`.
 *   - L’élément DOM `next-container` existe dans la page.
 * Postconditions : 
 *   - Le conteneur `next-container` contient exactement une `<div>` avec la classe `next-piece`.
 *   - Cette `<div>` contient autant de `<div class="cell">` que de cases non nulles dans `tetromino.shape`, positionnées et stylées avec l’image correspondant à `tetromino.bloc`.
 */

function afficherNextPiece(tetromino) {
  const container = document.getElementById("next-container");
  container.innerHTML = "";
  const blocImg = `../assets/blocks/bloc${tetromino.bloc}.png`;
  const div = document.createElement("div");
  div.classList.add("next-piece");

  tetromino.shape.forEach((ligne, y) => {
    ligne.forEach((val, x) => {
      if (val) {
        const tile = document.createElement("div");
        tile.classList.add("cell");
        tile.style.backgroundImage = `url('${blocImg}')`;
        tile.style.position = "absolute";
        tile.style.left = `${x * 32}px`;
        tile.style.top = `${y * 32}px`;
        div.appendChild(tile);
      }
    });
  });

  container.appendChild(div);
}


// ——————————————————————————————
// 🎮 Étapes 3,4,5 : Affichage, gravité, collisions, mouvements
// ——————————————————————————————

/**
 * Role : Met à jour la position et l’orientation visuelle de la pièce active dans le plateau de jeu.
 * Préconditions : 
 *   - La variable globale `pieceEl` référence l’élément DOM de la pièce active.
 *   - L’objet `pos` possède des propriétés numériques `x` et `y` indiquant la position logique.
 *   - La variable `tileSize` (taille d’une tuile en pixels) est initialisée.
 * Postconditions : 
 *   - L’élément DOM `pieceEl` est déplacé aux coordonnées (`pos.x * tileSize`, `pos.y * tileSize`) et pivoté de `rotationDeg` degrés autour de son centre.
 */


function updatePieceDOM(pos, rotationDeg = 0) {
  gsap.set(pieceEl, {
    x: pos.x * tileSize,
    y: pos.y * tileSize,
    rotation: rotationDeg,
    transformOrigin: 'center center'
  });
}


/**
 * Role : Crée et insère dans le plateau de jeu l’élément DOM de la pièce active à partir de ses données logiques et initialise son affichage.
 * Préconditions : 
 *   - L’objet `piece` est un tétrimino valide issu de `cloneRandomTetromino()`, avec propriétés `shape`, `bloc`.
 *   - Les variables globales `pieceEl`, `gameBoard`, `tileSize`, `gridGap` et `position` sont définies.
 *   - La fonction `updateGhost()` est disponible.
 * Postconditions : 
 *   - L’ancien élément DOM de la pièce (`pieceEl`) est supprimé s’il existait.
 *   - Un nouvel élément `<div class="piece">` est créé, positionné et peuplé de ses `<div class="block">` correspondant à `piece.shape`.
 *   - `pieceEl` est positionné aux coordonnées (`position.x`, `position.y`) et orienté à 0°.
 *   - La fonction `updateGhost()` est appelée pour mettre à jour l’aperçu de la chute fantôme.
 */

function createPieceDOM(piece) {
  if (pieceEl) pieceEl.remove();
  pieceEl = document.createElement('div');
  pieceEl.classList.add('piece');
  gameBoard.appendChild(pieceEl);

  const imgUrl = () => `url('../assets/blocks/bloc${piece.bloc}.png')`;
  const step = tileSize + gridGap;

  piece.shape.forEach((row, y) => {
    row.forEach((v, x) => {
      if (v) {
        const b = document.createElement('div');
        b.classList.add('block');
        b.style.backgroundImage = imgUrl();
        b.style.left = `${x * step}px`;
        b.style.top  = `${y * step}px`;
        pieceEl.appendChild(b);
      }
    });
  });

  gsap.set(pieceEl, {
    x: position.x * step,
    y: position.y * step,
    rotation: 0,
    transformOrigin: 'center center'
  });
  updateGhost();

}
/**
 * Role : Crée et insère l’ombre (ghost) de la pièce active dans le plateau de jeu.
 * Préconditions : 
 *   - L’objet `piece` est un tétrimino valide avec propriétés `shape` et `bloc`.
 *   - Les variables globales `ghostEl`, `gameBoard`, `tileSize` et `gridGap` sont définies.
 * Postconditions : 
 *   - L’ancien élément DOM `ghostEl` est supprimé s’il existait.
 *   - Un nouvel élément `<div class="piece ghost">` est créé et ajouté à `gameBoard`.
 *   - Cet élément contient autant de `<div class="block">` que de cellules non nulles dans `piece.shape`, positionnées avec l’image correspondant à `piece.bloc`.
 */


function createGhostDOM(piece) {
  if (ghostEl) ghostEl.remove();
  ghostEl = document.createElement('div');
  ghostEl.classList.add('piece','ghost');
  gameBoard.appendChild(ghostEl);
  const step = tileSize + gridGap;
  piece.shape.forEach((row,y) => {
    row.forEach((v,x) => {
      if (v) {
        const b = document.createElement('div');
        b.classList.add('block');
        b.style.backgroundImage = `url('../assets/blocks/bloc${piece.bloc}.png')`;
        b.style.left = `${x * step}px`;
        b.style.top  = `${y * step}px`;
        ghostEl.appendChild(b);
      }
    });
  });
}

/**
 * Role : Met à jour la position visuelle de l’ombre (ghost) de la pièce active dans le plateau de jeu.
 * Préconditions : 
 *   - La variable globale `ghostEl` référence l’élément DOM de l’ombre.
 *   - L’objet `pos` possède des propriétés numériques `x` et `y`.
 *   - Les variables `tileSize` (taille d’une tuile) et `gridGap` sont initialisées.
 * Postconditions : 
 *   - L’élément DOM `ghostEl` est déplacé aux coordonnées (`pos.x * step`, `pos.y * step`) avec une rotation de 0°.
 */


function updateGhostDOM(pos) {
  const step = tileSize + gridGap;
  gsap.set(ghostEl, {
    x: pos.x * step,
    y: pos.y * step,
    rotation: 0
  });
}

/**
 * Role : Calcule la position de chute de l’ombre (ghost) pour la pièce active et met à jour son affichage.
 * Préconditions : 
 *   - La variable globale `pieceActive` contient la pièce en cours ou est nulle.
 *   - Les variables globales `position` et la fonction `isDispo(piece, pos)` sont définies.
 *   - Les fonctions `createGhostDOM()` et `updateGhostDOM()` sont disponibles.
 * Postconditions : 
 *   - Si `pieceActive` est défini, l’ombre est recréée au-dessus de la pièce active.
 *   - La position de l’ombre (`gpos`) est ajustée vers le bas jusqu’au dernier emplacement valide.
 *   - L’ombre est repositionnée dans le DOM à cette position finale.
 */

function updateGhost() {
  if (!pieceActive) return;
  createGhostDOM(pieceActive);
  let gpos = { ...position };
  while (isDispo(pieceActive, { x: gpos.x, y: gpos.y + 1 })) {
    gpos.y++;
  }
  updateGhostDOM(gpos);
}



/**
 * Role : Efface visuellement une pièce du plateau en retirant l’image de ses cellules aux positions spécifiées.
 * Préconditions : 
 *   - L’objet `piece` est un tétrimino valide avec une matrice `shape`.
 *   - L’objet `pos` contient des propriétés numériques `x` et `y` pour la position de la pièce.
 *   - L’élément DOM `#game-board` existe et contient des éléments `.cell` au nombre de ROWS×COLS.
 * Postconditions : 
 *   - Pour chaque case non nulle de `piece.shape` située dans la grille, la cellule correspondante dans le DOM voit son `backgroundImage` réinitialisé à une chaîne vide.
 */

function effacerPiece(piece, pos) {
  const cells = document.querySelectorAll("#game-board .cell");
  piece.shape.forEach((ligne, y) => {
    ligne.forEach((val, x) => {
      if (val) {
        const row = pos.y + y;
        const col = pos.x + x;
        if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
          const idx = row * COLS + col;
          cells[idx].style.backgroundImage = "";
        }
      }
    });
  });
}

/**
 * Role : Vérifie si une pièce peut être placée ou déplacée à une position donnée sans collision ni sortie de la grille.
 * Préconditions : 
 *   - L’objet `piece` est un tétrimino valide avec une matrice `shape`.
 *   - L’objet `pos` contient des propriétés numériques `x` et `y` pour la position testée.
 *   - La matrice globale `grille` ainsi que les constantes `ROWS` et `COLS` sont définies.
 * Postconditions : 
 *   - Retourne `false` si une case de `piece.shape` sortirait des limites gauche/droite ou bas, ou si elle chevauche une case non vide dans `grille`.
 *   - Retourne `true` si toutes les cases non nulles de `piece.shape` peuvent être placées dans la grille sans chevauchement.
 */

function isDispo(piece, pos) {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const newX = pos.x + x;
        const newY = pos.y + y;
        if (newX < 0 || newX >= COLS || newY >= ROWS) return false;
        if (newY >= 0 && grille[newY][newX] !== 0) return false;
      }
    }
  }
  return true;
}

/**
 * Role : Enregistre la pièce active dans la grille logique en marquant ses cases avec son identifiant de bloc.
 * Préconditions : 
 *   - L’objet `piece` est un tétrimino valide avec une matrice `shape` et un identifiant `bloc`.
 *   - L’objet `pos` contient des propriétés numériques `x` et `y` pour la position de la pièce.
 *   - La matrice globale `grille` ainsi que les constantes `ROWS` et `COLS` sont définies.
 * Postconditions : 
 *   - Pour chaque case non nulle de `piece.shape` située dans les limites de la grille, la valeur correspondante dans `grille` est mise à `piece.bloc`.
 */

function fixerPiece(piece, pos) {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const newX = pos.x + x;
        const newY = pos.y + y;
        if (newY >= 0 && newY < ROWS && newX >= 0 && newX < COLS) {
          grille[newY][newX] = piece.bloc;
        }
      }
    }
  }
}

// ——————————————————————————————
// 🎮 Gravité animée + fixation + affichage grille fixe
// ——————————————————————————————
/**
 * Role : Applique la gravité à la pièce active : la fait tomber d’un cran si possible, sinon la fixe et gère la suite du jeu.
 * Préconditions : 
 *   - La variable globale `pieceActive` représente la pièce en cours.
 *   - La variable `position` indique la position actuelle de la pièce.
 *   - Les fonctions `isDispo()`, `fixerPiece()`, `reafficherGrille()`, `viderLignesCompletes()`, `generateTetromino()`, `createPieceDOM()`, `afficherGameOver()` et `updateGhost()` sont disponibles.
 *   - Les variables `tileSize`, `gridGap`, `vitesses` et `niveau` sont initialisées.
 * Postconditions : 
 *   - Si la case sous la pièce est libre, `position.y` est incrémenté, l’animation GSAP est lancée et l’ombre mise à jour.
 *   - Sinon, la pièce est intégrée à la grille logique, la grille visuelle est rafraîchie, les lignes complètes sont supprimées, une nouvelle pièce devient active, et si son placement initial est impossible, le Game Over est affiché.
 */

function gravity() {
  const nextPos = { x: position.x, y: position.y + 1 };
  const step = tileSize + gridGap;

  if (isDispo(pieceActive, nextPos)) {
    position = nextPos;
    gsap.to(pieceEl, {
      y: position.y * step,
      duration: vitesses[Math.min(niveau,20)]/1000,
      ease: 'none'

    });
    updateGhost();

  } else {
    fixerPiece(pieceActive, position);
    reafficherGrille();
    viderLignesCompletes();
    pieceActive = prochainePiece;
    generateTetromino();
    position = { x:3, y:0 };
    if (!isDispo(pieceActive, position)) {
      afficherGameOver();
      return;
    }
    createPieceDOM(pieceActive);
  }
}
// ——————————————————————————————
// 🎮 Déplacement latéral + son
//  fonction deplacerPiece
// ——————————————————————————————

/**
 * Role : Déplace horizontalement la pièce active d’une case à gauche ou à droite si l’emplacement est libre, en jouant un son de déplacement.
 * Préconditions : 
 *   - L’argument `dir` est un entier (-1 pour gauche, +1 pour droite).
 *   - La variable globale `position` reflète la position actuelle de la pièce.
 *   - Les fonctions `isDispo()` et `updateGhost()` sont disponibles.
 *   - Les variables `tileSize`, `gridGap`, et l’élément sonore `sMove` (optionnel) sont définis.
 * Postconditions : 
 *   - Si le déplacement est possible, `position.x` est mis à jour, l’élément DOM `pieceEl` est animé vers la nouvelle position, l’ombre est actualisée, et la fonction retourne `true`.
 *   - Dans le cas contraire, rien n’est modifié et la fonction retourne `false`.
 */

function deplacerPiece(dir) {
  const nextPos = { x: position.x + dir, y: position.y };
  const step = tileSize + gridGap;
  if (isDispo(pieceActive, nextPos)) {
    // jouer le son de déplacement si il existe
    if (sMove) {
      sMove.currentTime = 0;
      sMove.play();
    }
    position = nextPos;
    gsap.to(pieceEl, {
      x: position.x * step,
      duration: 0.1,
      ease: 'power1.out'
    });
    updateGhost();

    return true;
  }
  return false;
}






// ——————————————————————————————
// 🎮 Rotation + son
// fonction rotatePiece
// ——————————————————————————————

/**
 * Role : Tourne la pièce active de 90° dans le sens horaire et met à jour son affichage si la rotation est valide.
 * Préconditions : 
 *   - La variable globale `pieceActive` contient la pièce en cours avec une matrice `shape`.
 *   - La variable `position` indique la position courante.
 *   - Les fonctions `isDispo()`, `createPieceDOM()`, `updateGhost()` et l’élément sonore `sRotate` (optionnel) sont disponibles.
 * Postconditions : 
 *   - Si la pièce tournée ne génère pas de collision, `pieceActive.shape` passe à la nouvelle matrice pivotée, le son `sRotate` est joué, et le DOM de la pièce et de son ombre sont mis à jour.
 *   - Sinon, la rotation est annulée et `pieceActive.shape` retrouve son état antérieur.
 */

function rotatePiece() {
  // 1) clone de l'ancienne forme pour rollback
  const ancienne = pieceActive.shape.map(row => [...row]);
  // 2) calcule la nouvelle shape pivotée
  const newShape = ancienne[0].map((_, i) =>
    ancienne.map(row => row[i]).reverse()
  );
  pieceActive.shape = newShape;
  // 3) si pas de collision, on applique et on joue le son
  if (isDispo(pieceActive, position)) {
    if (sRotate) {
      sRotate.currentTime = 0;
      sRotate.play();
    }
    createPieceDOM(pieceActive);
    updateGhost();

  } else {
    // rollback sinon
    pieceActive.shape = ancienne;
  }
}






// ——————————————————————————————
// 🎮 Hard Drop (chute instantanée)
// ——————————————————————————————

/**
 * Role : Fait tomber instantanément la pièce active jusqu’à sa position de chute maximale, la fixe, et gère la suite du jeu.
 * Préconditions : 
 *   - La variable globale `pieceActive` représente la pièce en cours.
 *   - La variable `position` indique la position actuelle de la pièce.
 *   - Les fonctions `isDispo()`, `fixerPiece()`, `reafficherGrille()`, `viderLignesCompletes()`, `generateTetromino()`, `createPieceDOM()`, et `afficherGameOver()` sont disponibles.
 *   - Les variables `tileSize`, `gridGap` et `prochainePiece` sont définies.
 * Postconditions : 
 *   - `position.y` est ajustée à la position la plus basse possible sans collision.
 *   - La pièce est animée jusqu’à cette position, fixée dans la grille logique, la grille visuelle est rafraîchie et les lignes complètes sont supprimées.
 *   - Une nouvelle pièce devient active ; si son placement initial est impossible, le Game Over est affiché, sinon elle est insérée dans le DOM.
 */


function hardDrop() {
  const step = tileSize + gridGap;
  while (isDispo(pieceActive, {x:position.x, y:position.y+1})) {
    position.y++;
  }
  gsap.to(pieceEl, {
    y: position.y * step,
    duration: 0.1,
    ease: 'power1.in'
  });
  fixerPiece(pieceActive, position);
  reafficherGrille();
  viderLignesCompletes();
  pieceActive = prochainePiece;
  generateTetromino();
  position = { x:3, y:0 };
  if (!isDispo(pieceActive, position)) {
    afficherGameOver();
    return;
  }
  createPieceDOM(pieceActive);
}



document.addEventListener("keydown", event => {
  // 1) P pour toggler la pause
  if (event.code === "KeyP") {
    event.preventDefault();
    togglePause();
    return;
  }

  // 2) Si on est en pause, on ne traite rien d'autre
  if (isPaused) return;

  // 3) On empêche le scroll pour nos flèches et Espace
  const keysToPrevent = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"];
  if (keysToPrevent.includes(event.code)) {
    event.preventDefault();
  }

  // 4) Et enfin on exécute les mouvements
  switch (event.code) {
    case "ArrowLeft":
      deplacerPiece(-1);
      break;
    case "ArrowRight":
      deplacerPiece(1);
      break;
    case "ArrowDown":
      gravity();
      break;
    case "ArrowUp":
      rotatePiece();
      break;
    case "Space":
      hardDrop();
      break;
  }
});


// ——————————————————————————————
// 🎮 Étape 6+7+8 : lignes, score, niveau, chrono
// ——————————————————————————————

/**
 * Role : Détecte et supprime les lignes complètes de la grille, met à jour le score, le niveau et l’affichage avec une animation flash.
 * Préconditions : 
 *   - La matrice logique `grille` de dimensions `ROWS×COLS` est initialisée.
 *   - Les variables globales `totalLignes`, `score`, `niveau`, `vitesses` et les fonctions `startGravity()`, `reafficherGrille()`, `formatTemps()`, 
 *     ainsi que les éléments DOM `#line-value`, `#score-value`, `#level-value` existent.
 *   - L’élément sonore `sLine` (optionnel) peut être utilisé pour le son de suppression de lignes.
 * Postconditions : 
 *   - Si aucune ligne n’est complète, le plateau reste inchangé.
 *   - Sinon, chaque ligne complète :
 *       1) est surlignée brièvement par l’ajout de la classe `flash` sur ses cellules (animation de 200 ms) ;
 *       2) est retirée de la logique (`grille.splice`) et remplacée en haut par une ligne vide ;
 *       3) incrémente `totalLignes`, calcule et ajoute les points correspondants à `score`, met à jour `niveau` ;
 *       4) redémarre l’intervalle de gravité (`startGravity()`) et rafraîchit l’affichage du score, niveau et lignes ;
 *       5) réaffiche visuellement la grille (`reafficherGrille()`).
 */

function viderLignesCompletes() {
  // 1) On détecte les lignes à supprimer
  const lignes = [];
  for (let y = ROWS - 1; y >= 0; y--) {
    if (grille[y].every(v => v !== 0)) {
      lignes.push(y);
    }
  }
  if (lignes.length === 0) return;

  // 2) On flash les lignes dans la grille
  const cells = document.querySelectorAll("#game-board .cell");
  lignes.forEach(y => {
    for (let x = 0; x < COLS; x++) {
      cells[y * COLS + x].classList.add("flash");
    }
  });
  if (sLine) {
    sLine.currentTime = 0;
    sLine.play();
  }


  // 3) Après 200 ms, on les supprime et on refait la grille
  setTimeout(() => {
    // retirer ces lignes de la logique
    lignes.forEach(y => {
      grille.splice(y, 1);
      grille.unshift(Array(COLS).fill(0));
    });
    // mettre à jour score / niveau / lignes
    const supprimées = lignes.length;
    totalLignes += supprimées;
    const pts = [0,100,250,400,600][supprimées] || 0;
    score += Math.floor(pts * (1 + niveau * 0.1));
    niveau = Math.floor(totalLignes / 5);
    startGravity();

    document.getElementById("line-value").textContent  = totalLignes;
    document.getElementById("score-value").textContent = score;
    document.getElementById("level-value").textContent = niveau;

    // réafficher visuellement la grille
    reafficherGrille();
  }, 200);

}


/**
 * Role : Met à jour visuellement chaque cellule de la grille en appliquant l’image de bloc correspondant à la valeur dans `grille`.
 * Préconditions : 
 *   - La matrice logique `grille` est définie avec des valeurs 0 ou identifiants de blocs.
 *   - L’élément DOM `#game-board` contient exactement `ROWS×COLS` éléments `.cell`, dans l’ordre ligne par ligne.
 *   - Les images `../assets/blocks/bloc{n}.png` existent pour chaque identifiant de bloc n>0.
 * Postconditions : 
 *   - Chaque élément `.cell` voit sa propriété `backgroundImage` mise à `""` si `grille[y][x]===0`, ou à `url('../assets/blocks/bloc{b}.png')` si `grille[y][x]=b>0`.
 */


function reafficherGrille() {
  const cells = document.querySelectorAll("#game-board .cell");
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const idx = y * COLS + x;
      const b = grille[y][x];
      cells[idx].style.backgroundImage = b
        ? `url('../assets/blocks/bloc${b}.png')`
        : "";
    }
  }
}

/**
 * Role : Démarre ou redémarre l’intervalle de gravité selon la vitesse du niveau courant.
 * Préconditions : 
 *   - La variable globale `niveau` est définie et représente le niveau actuel.
 *   - Le tableau `vitesses` contient des durées en millisecondes pour chaque niveau.
 *   - La fonction `gravity()` est disponible.
 *   - La variable `intervalGravite` peut contenir un ID d’intervalle existant.
 * Postconditions : 
 *   - Si `intervalGravite` était défini, l’ancien intervalle est arrêté.
 *   - Un nouvel intervalle est créé et stocké dans `intervalGravite`, appelant `gravity()` à la fréquence déterminée par `vitesses[niveau]`.
 */


function startGravity() {
  if (intervalGravite) clearInterval(intervalGravite);
  const vitesse = vitesses[Math.min(niveau, vitesses.length - 1)];
  intervalGravite = setInterval(gravity, vitesse);
}

/**
 * Role : Formate un nombre de secondes en chaîne "MM:SS".
 * Préconditions : 
 *   - L’argument `sec` est un entier ≥ 0 représentant un nombre de secondes.
 * Postconditions : 
 *   - Retourne une chaîne de deux chiffres pour les minutes et deux chiffres pour les secondes, séparés par ":".
 */

function formatTemps(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Role : Lance le chronomètre du jeu en incrémentant le temps écoulé et en mettant à jour l’affichage chaque seconde.
 * Préconditions : 
 *   - La variable globale `secondesEcoulees` est initialisée à 0 ou un nombre entier.
 *   - La fonction `formatTemps()` est disponible.
 *   - L’élément DOM `#time-value` existe.
 *   - La variable `intervalTemps` peut contenir un ID d’intervalle existant.
 * Postconditions : 
 *   - Un intervalle est créé et stocké dans `intervalTemps`, qui :
 *       • incrémente `secondesEcoulees` de 1 chaque seconde ;
 *       • met à jour le texte de `#time-value` avec le résultat de `formatTemps(secondesEcoulees)`.
 */

function startTimer() {
  intervalTemps = setInterval(() => {
    secondesEcoulees++;
    document.getElementById("time-value").textContent =
      formatTemps(secondesEcoulees);
  }, 1000);
}

/**
 * Role : Bascule l’état de pause du jeu, en stoppant ou en reprenant les intervalles de gravité et de temps, et en affichant ou masquant l’écran de pause.
 * Préconditions : 
 *   - La variable globale `isPaused` existe et est booléenne.
 *   - Les variables `intervalGravite` et `intervalTemps` contiennent les IDs des intervalles en cours.
 *   - Les fonctions `startGravity()` et `startTimer()` sont disponibles.
 *   - L’élément DOM `#pause-overlay` existe pour indiquer visuellement la pause.
 * Postconditions : 
 *   - `isPaused` est inversé.
 *   - Si le jeu passe en pause (`isPaused === true`), les intervalles de gravité et de temps sont stoppés et l’overlay de pause est affiché.
 *   - Si le jeu reprend (`isPaused === false`), l’overlay est masqué et les intervalles sont relancés via `startGravity()` et `startTimer()`.
 */

function togglePause() {
  isPaused = !isPaused;
  const overlay = document.getElementById("pause-overlay");;
  if (isPaused) {
    clearInterval(intervalGravite);
    clearInterval(intervalTemps);
    overlay.style.display = "flex";
  } else {
    overlay.style.display = "none";
    startGravity();
    startTimer();
  }
}

// ——————————————————————————————
// 🎮 Étape 9 : Game Over + Power button
// ——————————————————————————————

/**
 * Role : Gère la fin de partie en stoppant les intervalles, affichant l’écran de Game Over, jouant le son approprié, envoyant le score au serveur et configurant les actions des boutons.
 * Préconditions : 
 *   - Les variables globales `intervalGravite`, `intervalTemps` contiennent les IDs des intervalles en cours.
 *   - L’élément DOM `#overlay` existe pour le modal Game Over.
 *   - La variable `sGameOver` (élément audio optionnel) est définie pour le son de fin de partie.
 *   - Les constantes `API_URL` et la variable `score` sont initialisées.
 *   - Les fonctions `restartGame()` et la propriété `window.location.href` sont disponibles.
 *   - `localStorage` peut contenir `userId` et `token`.
 * Postconditions : 
 *   - Les intervalles de gravité et de temps sont arrêtés.
 *   - Le modal Game Over (`#overlay`) est affiché.
 *   - Le son `sGameOver` est joué si disponible.
 *   - Un appel asynchrone est déclenché pour envoyer `userId` et `score` au serveur via POST avec authentification.
 *   - Les boutons “Rejouer” et “Quitter” reconfigurent respectivement la reprise de la partie (`restartGame()`) et la redirection vers le menu.
 */

function afficherGameOver() {
  clearInterval(intervalGravite);
  clearInterval(intervalTemps);

  // Affiche le modal
  const overlay = document.getElementById("overlay");
  overlay.style.display = "flex";

  // Joue le son
  if (sGameOver) {
    sGameOver.currentTime = 0;
    sGameOver.play();
  }
  // 🚀 ENVOI DU SCORE AU SERVEUR
  (async () => {
    // Récupère l’ID utilisateur
    const userIdStr = localStorage.getItem("userId");
    const userId = userIdStr ? parseInt(userIdStr) : null;
    if (!userId) {
      console.warn("Tetris : impossible d'envoyer le score, userId manquant !");
    } else {
      try {
        const token = localStorage.getItem("token"); // Ajoutez le token
        const res = await fetch(`${API_URL}/api/score/tetris`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`  // En-tête d'authentification ajouté
          },
          body: JSON.stringify({ userId, score })
        });
        if (!res.ok) {
          console.error("Erreur enregistrement score Tetris :", res.status);
        }
      } catch (err) {
        console.error("Erreur réseau lors de l'envoi du score :", err);
      }
    }
  })();

  // Boutons Rejouer / Quitter
  document.getElementById("btn-replay-modal").onclick = () => {
    overlay.style.display = "none";
    restartGame();
  };
  document.getElementById("btn-quit-modal").onclick = () => {
    window.location.href = '/game/tetris/menu/menutetris.html';
  };
}


/**
 * Role : Réinitialise entièrement l’état du jeu pour recommencer une nouvelle partie sans recharger la page.
 * Préconditions : 
 *   - Les variables globales `intervalGravite`, `intervalTemps`, `grille`, `totalLignes`, `score`, `niveau`, `secondesEcoulees`, `position`, `gameBoard` sont définies.
 *   - Les fonctions `initGrille()`, `initNextQueue()`, `cloneRandomTetromino()`, `afficherNextQueue()`, `createPieceDOM()`, `startGravity()`, et `startTimer()` sont disponibles.
 * Postconditions : 
 *   - Tous les intervalles de gravité et de temps sont arrêtés.
 *   - L’état logique est remis à zéro : grille vide, score, niveau, lignes et temps réinitialisés.
 *   - L’UI est remise à l’état initial (temps, score, niveau, lignes à zéro, overlays masqués).
 *   - La grille et la file de prochaines pièces sont recréées.
 *   - La première pièce est extraite de `nextQueue`, affichée en (3,0), et les intervalles de gravité et de timer sont relancés.
 */
function restartGame() {
  // 1) Stoppe tous les timers
  clearInterval(intervalGravite);
  clearInterval(intervalTemps);

  // 2) Réinitialise l’état logique
  grille = [];
  totalLignes = 0;
  score        = 0;
  niveau       = 0;
  secondesEcoulees = 0;

  // **Réinitialise la position de la pièce au sommet de la grille**
  position = { x: 3, y: 0 };

  // 3) Mise à jour UI
  document.getElementById("time-value").textContent  = "00:00";
  document.getElementById("level-value").textContent = "0";
  document.getElementById("line-value").textContent  = "0";
  document.getElementById("score-value").textContent = "0";
  document.getElementById("overlay").style.display     = "none";
  document.getElementById("pause-overlay").style.display = "none";

  // 4) Re-création de la grille et de la file
  gameBoard.innerHTML = "";        // vide le DOM de la grille
  initGrille();                    // recrée les cellules
  initNextQueue();                 // réinitialise nextQueue

  // 5) On prend la première pièce et on génère la suivante
  pieceActive = nextQueue.shift();
  nextQueue.push(cloneRandomTetromino());
  afficherNextQueue();

  // 6) On l’affiche **à la position (3,0)** et on redémarre timer + gravité
  createPieceDOM(pieceActive);
  startGravity();
  startTimer();
}



// ——————————————————————————————
// 🚀 Initialisation du jeu
// ——————————————————————————————
window.addEventListener("DOMContentLoaded", () => {
  // 1) Initialise la grille HTML et la matrice logique
  initGrille();

  // 2) Récupère la taille de tuile et l'écart (grid-gap) AVANT tout affichage
  tileSize = parseInt(
    getComputedStyle(document.documentElement)
      .getPropertyValue('--tile-size')
  );
  gridGap = parseInt(
    getComputedStyle(gameBoard)
      .getPropertyValue('gap')
  );

  // 3) Initialise la file de prochaines pièces (5 éléments)
  initNextQueue();

  // 4) Prend la première pièce de la file et en ajoute une nouvelle à la queue
  pieceActive = nextQueue.shift();
  nextQueue.push(cloneRandomTetromino());

  // 5) Affiche la pieceActive et la file mise à jour
  createPieceDOM(pieceActive);

  // 6) Démarre la gravité et le chrono
  startGravity();
  startTimer();

  document.getElementById("btn-pause")
    .addEventListener("click", togglePause);

  // 7) Bouton power/reload
  document.getElementById('btn-power').addEventListener('click', () => {
    window.location.href = '/game/tetris/menu/menutetris.html';;
  });
  document.getElementById('btn-restart').addEventListener('click', restartGame);
  sBgm.play().catch(err => console.warn("Lecture BGM bloquée :", err));
});
