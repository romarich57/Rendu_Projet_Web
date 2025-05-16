// script.js

// ——————————————————————————————
// 🔧 Paramètres et variables globales
// ——————————————————————————————
const API_BASE = "http://localhost:3000";   // ← URL de votre API Deno
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
let pieceEl = null;     // DOM <div class="piece">
// Ghost piece
let ghostEl = null;


const NEXT_COUNT = 5;
let nextQueue = [];


// ——————————————————————————————
// 🎮 Étape 1 : Initialisation de la grille
// ——————————————————————————————
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
 * Génère la pieceActive à partir de nextQueue,
 * alimente nextQueue avec une pièce random, et met à jour l’affichage.
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
function cloneRandomTetromino() {
  const idx = Math.floor(Math.random() * tetrominos.length);
  const tmpl = tetrominos[idx];
  return {
    name: tmpl.name,
    bloc: tmpl.bloc,
    shape: tmpl.shape.map(row => [...row])
  };
}

function initNextQueue() {
  nextQueue = [];
  for (let i = 0; i < NEXT_COUNT; i++) {
    nextQueue.push(cloneRandomTetromino());
  }
  afficherNextQueue();
}

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

function updatePieceDOM(pos, rotationDeg = 0) {
  gsap.set(pieceEl, {
    x: pos.x * tileSize,
    y: pos.y * tileSize,
    rotation: rotationDeg,
    transformOrigin: 'center center'
  });
}
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

// Crée l’ombre de la pièce
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

// Positionne l’ombre
function updateGhostDOM(pos) {
  const step = tileSize + gridGap;
  gsap.set(ghostEl, {
    x: pos.x * step,
    y: pos.y * step,
    rotation: 0
  });
}

// Calcule la position finale et met à jour l’ombre
function updateGhost() {
  if (!pieceActive) return;
  createGhostDOM(pieceActive);
  let gpos = { ...position };
  while (isDispo(pieceActive, { x: gpos.x, y: gpos.y + 1 })) {
    gpos.y++;
  }
  updateGhostDOM(gpos);
}





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
// — gravity() —
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
// Remplace intégralement ta fonction deplacerPiece
// ——————————————————————————————
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
// Remplace intégralement ta fonction rotatePiece
// ——————————————————————————————
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
// — hardDrop() —
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
// ——————————————————————————————
// 🎮 Étape 6 : suppression de lignes avec flash animé
// ——————————————————————————————
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

function startGravity() {
  if (intervalGravite) clearInterval(intervalGravite);
  const vitesse = vitesses[Math.min(niveau, vitesses.length - 1)];
  intervalGravite = setInterval(gravity, vitesse);
}

function formatTemps(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function startTimer() {
  intervalTemps = setInterval(() => {
    secondesEcoulees++;
    document.getElementById("time-value").textContent =
      formatTemps(secondesEcoulees);
  }, 1000);
}
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
// ——————————————————————————————
// 🎮 Game Over + son
// Remplace ta fonction afficherGameOver
// ——————————————————————————————
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
        const res = await fetch(`${API_BASE}/api/score/tetris`, {
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
 * Réinitialise totalement la partie sans reloader la page.
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

