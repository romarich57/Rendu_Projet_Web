// script.js

// Paramètres du jeu
const GRID_WIDTH = 40;    // Largeur de la grille (en tuiles)
const GRID_HEIGHT = 20;   // Hauteur de la grille (en tuiles)
const TILE_SIZE = 30;     // Taille de chaque tuile (en px)
const MOVE_INTERVAL = 500;   // Intervalle (ms) pour le déplacement des monstres
const BULLET_INTERVAL = 100; // Intervalle (ms) pour le déplacement des balles
const maxPowerups = 3;
const powerupTypes = ['triple','shield','speed'];
let powerupsOnGrid = [];      // {col,row,type}
let tripleActive = false,
    tripleShotsRemaining = 0;
let shieldActive = false;
let speedActive = false;
let bulletTimer;
let startTime;  // timestamp au démarrage de la partie
const defaultShootCooldown = 300;       // valeur d’origine
let shootCooldown = defaultShootCooldown;
let canShoot = true;                    // verrou de tir



// Sélecteurs HTML
const grid = document.getElementById("my_grid");
const scoreSpan = document.getElementById("score");
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const comboDisplay = document.getElementById('comboOverlay');
const comboCountSpan = document.getElementById('comboCount');
const pauseBtn       = document.getElementById('pauseBtn');
const livesContainer = document.getElementById('lives_container');
//API_URL = "http://localhost:3000"; // URL de l'API
const API_URL = "http://localhost:3000";
const explCanvas = document.getElementById('explosionCanvas');
explCanvas.width = window.innerWidth;
explCanvas.height = window.innerHeight;
const explCtx = explCanvas.getContext('2d');
const deconnexionBtn = document.getElementById("deconnexionBtn");
const pauseOverlay = document.getElementById('pauseOverlay');
const resumeButton = document.getElementById('resume-button');

let tiles = [];            // Tableau contenant toutes les tuiles de la grille
let gameRunning = false;   // Indique si le jeu est en cours

// Variables de jeu
let score = 0;
let lives = 3;
// → Variables de progression
let killerCol = Math.floor(GRID_WIDTH / 2);  // Position X du joueur
let killerRow = GRID_HEIGHT - 1;             // Position Y du joueur
let monsters = [];        // Tableau des monstres
let monsterRows = 4;      // Nombre de rangées de monstres
let monsterCols = 8;      // Nombre de monstres par rangée
let monsterDirection = 1; // Direction horizontale : +1 = droite, -1 = gauche
let playerBullets = [];   // Balles du joueur
let monsterBullets = [];  // Balles des monstres
let combo = 0;
let maxCombo = 0;
let particles = [];
let powerups = [];
// → Progression & niveaux
let wave = 1;
let xp = 0;
let level = 1;
const levelThresholds = Array.from({length: 101}, (_, n) =>
  Math.floor(100 * Math.pow(n, 1.5))
);
// → Difficulté dynamique
let moveTimer;
let shootProb;
let nextBossId = 0;



function getDifficulty(wave) {
  const maxI = 500, minI = 100;
  const moveInterval = Math.max(minI, maxI - (wave-1)*15);
  // Base de tir plus élevée
  const baseShoot = 0.05, maxShoot = 0.20;
  // Ajout de level dans la formule
  shootProb = Math.min(
    maxShoot,
    baseShoot + ((wave-1)*(maxShoot-baseShoot)/49) + level*0.002
  );
  return { moveInterval };
}



function updateLevelUI() {
  document.getElementById('levelBadge').textContent = level;
  const prev = levelThresholds[level - 1] || 0;
  const next = levelThresholds[level];
  const pct = Math.min(100, ((xp - prev) / (next - prev)) * 100);
  document.getElementById('xpFill').style.width = pct + '%';
  document.getElementById('wave').textContent = wave;

}
/**
 * Met à jour l'affichage des vies en cœurs.
 */
function updateLivesUI() {
  livesContainer.innerHTML = '';
  for (let i = 0; i < lives; i++) {
    const img = document.createElement('img');
    img.src = '/shared/vie.png';     // chemin relatif à ton HTML
    img.alt = 'Vie';
    img.classList.add('heart');
    livesContainer.appendChild(img);
  }
}


// Appelle au démarrage et à chaque changement de vies
updateLivesUI();

function checkLevelUp() {
  while (levelThresholds[level] !== undefined && xp >= levelThresholds[level]) {
    level++;
    document.body.classList.add('level-up');
    setTimeout(() => document.body.classList.remove('level-up'), 500);
    // TODO: débloquer ici bonus compétitif
  }
}

function addXp(amount) {
  xp += amount;
  checkLevelUp();
  updateLevelUI();
}
/**
 * Crée N particules à l’écran à la position (x,y)
 */
function spawnExplosion(x, y, color = '#0f0') {
  for (let i = 0; i < 20; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 30 + Math.random() * 20,
      color
    });
  }
}


// Met à jour et dessine les particules
function updateExplosions() {
  explCtx.clearRect(0,0, explCanvas.width, explCanvas.height);
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    explCtx.fillStyle = p.color;
    explCtx.fillRect(p.x, p.y, 4, 4);
    p.x += p.vx; p.y += p.vy;
    p.life--;
  });
  requestAnimationFrame(updateExplosions);
}
updateExplosions();

/**
 * Tente de faire apparaître un power-up au hasard.
 * Ne spawn qu’un seul power-up à la fois (maxPowerups = 1).
 */
function spawnPowerup() {
  if (powerupsOnGrid.length >= 1) return;
  // 0.3% de chance à chaque appel
  if (Math.random() < 0.5) {
    const type = powerupTypes[Math.floor(Math.random()*powerupTypes.length)];
    const col  = Math.floor(Math.random()*GRID_WIDTH);
    const row  = Math.floor(Math.random()*(GRID_HEIGHT-5))+1; // éviter le bas UI
    const tile = getTile(col,row);
    // ne spawn pas sur une tuile occupée
    if (tile.classList.length === 1) {
      powerupsOnGrid.push({col,row,type});
      tile.classList.add('powerup');
      tile.style.backgroundImage = `url("/assets/images/${type}.png")`;
    }
  }
}
/**
 * Active l’effet du power-up pour une durée ou un nombre d’usages.
 */
/**
 * Applique l’effet d’un power-up
 */
function applyPowerupEffect(type) {
  switch (type) {
    case 'triple':
      tripleActive = true;
      tripleShotsRemaining = 5;
      break;
      case 'shield':
      // on active le bouclier et on crée la barre
      shieldActive = true;
      createShieldBar();
      break;
    
    
    case 'speed':
      // n’applique qu’une fois si pas déjà actif
      if (!speedActive) {
        speedActive = true;
        // on divise la cadence de tir par 2
        shootCooldown = defaultShootCooldown / 2;
        // après 15 s on rétablit la cadence normale
        setTimeout(() => {
          shootCooldown = defaultShootCooldown;
          speedActive = false;
        }, 15_000);
      }
      break;
  }
}


/**
 * Active un pouvoir stocké, le supprime du tableau et de l’UI
 */
function activatePower(type) {
  const idx = powerups.indexOf(type);
  if (idx !== -1) {
    powerups.splice(idx, 1);
    updatePowerupsUI();
    const snAct=document.getElementById('activatePowerUp');
    snAct.currentTime = 0;
    snAct.play();
    applyPowerupEffect(type);
  }
}

/**
 * Crée la barre de bouclier au-dessus du vaisseau
 */
function createShieldBar() {
  // n'existe qu'une fois
  if (document.getElementById('shieldBar')) return;
  const bar = document.createElement('div');
  bar.className = 'shield-bar active';
  bar.id = 'shieldBar';
  const fill = document.createElement('div');
  fill.className = 'shield-bar-fill';
  fill.id = 'shieldFill';
  fill.style.width = '100%';
  bar.appendChild(fill);
  document.body.appendChild(bar);
  updateShieldBarPosition();
}

/**
 * Met à jour la position de la barre de bouclier
 */
function updateShieldBarPosition() {
  const bar = document.getElementById('shieldBar');
  if (!bar) return;
  const tile = getTile(killerCol, killerRow);
  const rect = tile.getBoundingClientRect();
  const bw = bar.offsetWidth, bh = bar.offsetHeight;
  bar.style.left = `${rect.left + rect.width/2 - bw/2}px`;
  bar.style.top  = `${rect.top  - bh    - 4}px`;
}





/**
 * Vérification d'authentification : 
 * Si pas de token => redirection vers login.html
 */
function checkAuth() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html";
  }
}
/**
 * Initialisation de la grille (tuiles)
 */
/**
 * Initialisation de la grille (tuiles) en row-major
 */
function addTiles() {
  tiles = [];
  grid.innerHTML = '';
  // On génère d'abord par ligne, puis par colonne
  for (let row = 0; row < GRID_HEIGHT; row++) {
    for (let col = 0; col < GRID_WIDTH; col++) {
      const div = document.createElement('div');
      div.className = 'tile';
      div.style.width = `${TILE_SIZE}px`;
      div.style.height = `${TILE_SIZE}px`;
      // stocke coordonnées sur l'élément si besoin
      div.row = row;
      div.col = col;
      tiles.push(div);
      grid.appendChild(div);
    }
  }
}


/**
 * Récupérer une tuile spécifique (col, row)
 */
function getTile(col, row) {
  return tiles[row * GRID_WIDTH + col];
}
function initBoss() {
  monsters = [];
  const numBosses = Math.floor(wave / 5); // ex: 2 bosses à la vague 10

  for (let i = 0; i < numBosses; i++) {
    const bossId = nextBossId++;
    const col = Math.floor(GRID_WIDTH / 2) + (i - (numBosses - 1) / 2) * 6;
    const row = 2;
    // chaque boss a maintenant son propre hp et id
    const boss = { col, row, isBoss: true, hp: 3, id: bossId };
    monsters.push(boss);

    // on affiche le sprite
    getTile(col, row).classList.add('boss');

    // on crée la barre de vie
    const hpBar = document.createElement('div');
    hpBar.className = 'boss-hp-bar';
    hpBar.dataset.bossId = bossId;

    const fill = document.createElement('div');
    fill.className = 'boss-hp-fill';
    fill.dataset.bossId = bossId;
    fill.style.width = '100%';

    hpBar.appendChild(fill);
    document.body.appendChild(hpBar);
  }
}





/**
 * Initialisation des monstres
 */
function initMonsters() {
  monsters = [];                // vide l’array
  let startRow = 1, startCol = 2;
  for (let r = 0; r < monsterRows; r++) {
    for (let c = 0; c < monsterCols; c++) {
      let col = startCol + c;
      let row = startRow + r;
      monsters.push({col, row});
      let tile = getTile(col, row);
      if (tile) tile.classList.add('monster');
    }
  }
}


/**
 * (Re)lance tous les timers de jeu
 */


function startGameLoops() {
  // monstres
  const { moveInterval } = getDifficulty(wave);
  if (moveTimer) clearInterval(moveTimer);
  moveTimer = setInterval(moveMonsters, moveInterval);

  // balles monstres
  if (bulletTimer) clearInterval(bulletTimer);
  bulletTimer = setInterval(moveMonsterBullets, BULLET_INTERVAL);
}

// Correction de l'erreur sur la ligne 383 : utilisation de la variable correcte
startButton.addEventListener('click', () => {
  startScreen.style.display = 'none';
  gameRunning = true;
  startTime = Date.now();       // ← initialise le timer
  const ambiance = document.getElementById('ambianceLoop'); // corrected ID
  if(ambiance){               // ensure element exists
    ambiance.volume = 0.2;
    ambiance.currentTime = 0;
    ambiance.play();
  } else {
    console.error("Ambiance audio element 'ambianceLoop' not found");
  }
  resetGame();
  render();
  gameLoop();
});

/**
 * Fonction de réinitialisation du jeu 
 */
/**
 * Réinitialisation complète du jeu
 */
function resetGame() {
   // Cacher l’écran Game Over
   document.getElementById('game-over-overlay')
   .classList.add('hidden');
  // 1) Réinitialisation des compteurs
  wave = 1;
  xp = 0;
  level = 1;
  updateLevelUI();
  lives = 3;
  updateLivesUI();

  // 2) Barre de vague & power-ups
  updateWaveBar();
  powerups = [];
  document.querySelectorAll('#powerups .slot').forEach(slot => {
    slot.className = 'slot';
    slot.style.backgroundImage = '';
  });

  // 3) Score
  score = 0;
  scoreSpan.textContent = score;

  // 4) Clean arrays et re-init entities
  monsters = [];
  playerBullets = [];
  monsterBullets = [];

  // 5) Grille & entités
  addTiles();
  initMonsters(wave);
  getTile(killerCol, killerRow).classList.add('killer');

  // 6) Lancement des timers
  gameRunning = true;
  startGameLoops();
}



/**
 * Au clic sur "Commencer le jeu"
 */
startButton.addEventListener('click', () => {
  // Masquer l'écran de démarrage
  startScreen.style.display = 'none';
  // Lancer le jeu
  gameRunning = true;
  resetGame();
  render();   // si vous avez une fonction d'affichage initial
  gameLoop(); // si vous avez une boucle ou un setInterval
});

/**
 * Calcule la ligne la plus basse d'un monstre dans une colonne donnée
 */
function lowestMonsterRowInCol(col) {
  let lowest = -1;
  for (let m of monsters) {
    if (m && m.col === col && m.row > lowest) {
      lowest = m.row;
    }
  }
  return lowest;
}

/**
 * Mouvements des monstres
 */
function moveMonsters() {
  if (!gameRunning) return;

  // 1) Calcul des bornes horizontales
  let minCol = Infinity, maxCol = -Infinity;
  for (let m of monsters) {
    if (m) {
      if (m.col < minCol) minCol = m.col;
      if (m.col > maxCol) maxCol = m.col;
    }
  }

  // 2) On retire toutes les classes visuelles précédentes
  for (let m of monsters) {
    if (m) {
      const tile = getTile(m.col, m.row);
      tile.classList.remove('monster', 'boss');
    }
  }

  // 3) Mouvement : bord → descente + inversion ou translation
  if ((monsterDirection > 0 && maxCol >= GRID_WIDTH - 1) ||
      (monsterDirection < 0 && minCol <= 0)) {
    for (let m of monsters) {
      if (m) m.row++;
    }
    monsterDirection = -monsterDirection;
  } else {
    for (let m of monsters) {
      if (m) m.col += monsterDirection;
    }
  }

// Ré-afficher sprites + vérifier gameOver
    monsters.forEach(m => {
      if (!m) return;
      const tile = getTile(m.col, m.row);
      tile.classList.add(m.isBoss ? 'boss' : 'monster');
    });
  
    // ** Repositionner TOUTES les barres de vie de boss **
    monsters.forEach(m => {
      if (!m.isBoss) return;
      const bar = document.querySelector(`.boss-hp-bar[data-boss-id="${m.id}"]`);
      if (!bar) return;
      const tile = getTile(m.col, m.row);
      const rect = tile.getBoundingClientRect();
      const bw = bar.offsetWidth, bh = bar.offsetHeight;
      bar.style.left = `${rect.left + rect.width/2 - bw/2}px`;
      bar.style.top  = `${rect.top  - bh  - 4}px`;
    });
  
    // tir aléatoire
    if (Math.random() < shootProb) monsterShoot();
    spawnPowerup();
  }



/**
 * Déplacement des balles du joueur
 */

function movePlayerBullets() {
  if (!gameRunning) return;

  for (let i = 0; i < playerBullets.length; i++) {
    let b = playerBullets[i];

    // 1) Effacer l’ancienne balle si visible
    if (b.row >= 0 && b.row < GRID_HEIGHT) {
      const oldTile = getTile(b.col, b.row);
      oldTile && oldTile.classList.remove('bullet');
    }

    // 2) Déplacer la balle vers le haut
    b.row--;

    // 3) Si hors-grille → suppression
    if (b.row < 0) {
      combo = 0;
      playerBullets.splice(i, 1);
      i--;
      continue;
    }

    // 4) Tuile cible
    const tile = getTile(b.col, b.row);
    if (!tile) {
      // coordonnée impossible
      playerBullets.splice(i, 1);
      i--;
      continue;
    }

    // 5) Collision Power-up ?
    if (tile.classList.contains('powerup')) {
      const sndPickup = document.getElementById('pickupPowerUp');
      if (sndPickup) {
        sndPickup.currentTime = 0;
        sndPickup.play();
      } else {
        console.error("Audio element 'pickupPowerUp' not found");
      }
      // on récupère le power-up sans activer l’effet immédiatement
      const idx = powerupsOnGrid.findIndex(p => p.col === b.col && p.row === b.row);
      const pu  = powerupsOnGrid.splice(idx, 1)[0];
      tile.classList.remove('powerup');
      tile.style.backgroundImage = '';

      powerups.push(pu.type);
      updatePowerupsUI();
      playerBullets.splice(i, 1);
      i--;
      continue;
    }

    // 6) Collision Monstre / Boss ?
    const hitIndex = monsters.findIndex(m => m && m.col === b.col && m.row === b.row);
    if (hitIndex !== -1) {
      const monster = monsters[hitIndex];
      playerBullets.splice(i, 1);
      i--;

      // ——— Boss à plusieurs PV ———
      if (monster.isBoss) {
        const sndBoss = document.getElementById('explosionBoss');
        if (sndBoss) {
          sndBoss.currentTime = 0;
          sndBoss.play();
        } else {
          console.error("Audio element 'explosionBoss' not found");
        }
      } else {
        const sndMonster = document.getElementById('explosionMonstre');
        if (sndMonster) {
          sndMonster.currentTime = 0;
          sndMonster.play();
        } else {
          console.error("Audio element 'explosionMonster' not found");
        }
      }

      // gestion des PV et feedback visuel
      monster.hp--;
      const bar  = document.querySelector(`.boss-hp-bar[data-boss-id="${monster.id}"]`);
      const fill = bar && bar.querySelector(`.boss-hp-fill[data-boss-id="${monster.id}"]`);
      if (fill) {
        fill.style.width = `${(monster.hp / 3) * 100}%`;
        bar.classList.toggle('critical', monster.hp <= 1);
      }
      if (monster.hp > 0) {
        const t = getTile(monster.col, monster.row);
        t.classList.add('flash');
        setTimeout(() => t.classList.remove('flash'), 150);
        const r = t.getBoundingClientRect();
        spawnExplosion(r.left + r.width/2, r.top + r.height/2, '#f00');
        document.body.classList.add('shake','flash');
        setTimeout(() => document.body.classList.remove('shake','flash'), 300);
        return; // ne pas tuer le boss tant que hp>0
      }

      // mort du monstre / boss
      bar && bar.remove();
      tile.classList.remove('monster','boss');
      tile.classList.add('explosion-flash');
      setTimeout(() => tile.classList.remove('explosion-flash'), 200);
      monsters[hitIndex] = null;

      // score, xp, combo
      score += monster.isBoss ? 100 : 10;
      addXp(monster.isBoss ? 20 : 5);
      scoreSpan.textContent = score;
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      comboCountSpan.textContent = combo;
      comboDisplay.classList.add('show');
      setTimeout(() => comboDisplay.classList.remove('show'), 400);

      continue;
    }

    // 7) Sinon, redessiner la balle
    tile.classList.add('bullet');
  }

  // 8) Fin de vague ?
  monsters = monsters.filter(m => m != null);
  if (monsters.length === 0) {
    const sndEOW = document.getElementById('gameOver');
    if (sndEOW) {
      // repositionne le son (ajuste selon ton besoin)
      sndEOW.currentTime = 10;
      sndEOW.play();
    } else {
      console.error("Audio element 'gameOver' not found");
    }

    addXp(20 + wave * 2);
    sendSpaceTelemetry({ event: "end_of_wave", wave, score, combo: maxCombo, lives });
    sendSpaceScore();
    wave++;
    document.getElementById('waveText').textContent = wave;
    updateLevelUI();
    updateWaveBar();
    clearInterval(moveTimer);
    moveTimer = setInterval(moveMonsters, getDifficulty(wave).moveInterval);
    (wave % 5 === 0) ? initBoss() : initMonsters();
  }
}





function updateWaveBar() {
  const bar = document.getElementById('waveBar');
  bar.innerHTML = '';
  const total = 10; // nombre de pastilles par cycle
  for (let i = 1; i <= total; i++) {
    const step = document.createElement('div');
    step.className = 'step' + (i <= (wave % total || total) ? ' filled' : '');
    bar.appendChild(step);
  }
}
/**
 * Met à jour l’affichage des slots power-ups selon le tableau powerups[]
 */
function updatePowerupsUI() {
  const slots = document.querySelectorAll('#powerups .slot');
  slots.forEach((slot, idx) => {
    slot.className = 'slot';           // reset classes
    slot.style.backgroundImage = '';
    if (idx < powerups.length) {
      const type = powerups[idx];      // ex. "shield", "triple"
      slot.classList.add('active','boost-shake');
      slot.style.backgroundImage = `url("/assets/images/${type}.png")`;
      // retire l’animation après un cycle
      setTimeout(() => slot.classList.remove('boost-shake'), 400);
    }
  });
}


/**
 * Déplacement des balles des monstres
 */
function moveMonsterBullets() {
  if (!gameRunning) return;

  for (let i = 0; i < monsterBullets.length; i++) {
    let mb = monsterBullets[i];
    if (mb.row >= 0 && mb.row < GRID_HEIGHT) {
      getTile(mb.col, mb.row).classList.remove('monster_bullet');
    }

    mb.row++; // la balle descend
    if (mb.row > GRID_HEIGHT - 1) {
      monsterBullets.splice(i, 1);
      i--;
      continue;
    }
    if (mb.col===killerCol && mb.row===killerRow) {
      monsterBullets.splice(i,1); i--;
      if (shieldActive) {
        // bouclier absorbe le coup
        shieldActive = false;
        // supprime la barre de bouclier
        const bar = document.getElementById('shieldBar');
        if (bar) bar.remove();
        // retire le powerup stocké
        const idx = powerups.indexOf('shield');
        if (idx!==-1) { powerups.splice(idx,1); updatePowerupsUI(); }
      } else {
        // dégâts habituels
        lives--;
        updateLivesUI();
        score = Math.max(0, score-5);
        scoreSpan.textContent = score;
        combo = 0;
        if (lives <= 0) { gameOver(); }
      }
    }
    else {
      let lowest = lowestMonsterRowInCol(mb.col);
      if (lowest === -1 || mb.row > lowest) {
        getTile(mb.col, mb.row).classList.add('monster_bullet');
      }
    }
  }
}

/**
 * Le joueur tire
 */
function playerShoot() {
  if (!gameRunning || !canShoot) return;        // on ne tire que si autorisé

  canShoot = false;                             // verrouillage immédiate
  setTimeout(() => { canShoot = true; }, shootCooldown);
  const sndPlayer=document.getElementById('playerShoot');
  sndPlayer.currentTime = 0;
  sndPlayer.play();

  // triple shot si actif
  if (tripleActive && tripleShotsRemaining > 0) {
    [killerCol - 1, killerCol, killerCol + 1].forEach(c => {
      if (c >= 0 && c < GRID_WIDTH) {
        const newB = { col: c, row: killerRow - 1 };
        playerBullets.push(newB);
        if (newB.row >= 0) getTile(c, newB.row).classList.add('bullet');
      }
    });
    tripleShotsRemaining--;
    if (tripleShotsRemaining === 0) tripleActive = false;
  } else {
    // tir normal
    const newBullet = { col: killerCol, row: killerRow - 1 };
    playerBullets.push(newBullet);
    if (newBullet.row >= 0) {
      getTile(newBullet.col, newBullet.row).classList.add('bullet');
    }
  }
}



/**
 * Les monstres tirent
 */
function monsterShoot() {
  const living = monsters.filter(m => m);
  if (!living.length) return;
  const sndMonster=document.getElementById('monsterShoot');
  sndMonster.currentTime = 0;
  sndMonster.play();

  // on priorise le boss 80% du temps
  const boss   = living.find(m => m.isBoss);
  const shooter = boss && Math.random()<0.8 ? boss
    : living[Math.floor(Math.random()*living.length)];

  // nombre de projectiles = 1 + floor(wave/10)
  const count = 1 + Math.floor(wave/10);
  for (let i = 0; i < count; i++) {
    const newB = { col: shooter.col, row: shooter.row + 1 };
    monsterBullets.push(newB);
    if (newB.row < GRID_HEIGHT && newB.row > lowestMonsterRowInCol(newB.col)) {
      getTile(newB.col, newB.row).classList.add('monster_bullet');
    }
  }

  // ** Ajustement dynamique de la vitesse de déplacement des balles **
  // On recalcule un BULLET_INTERVAL plus rapide selon level
  const base = 100; // valeur initiale
  const minInt = 30; // intervalle mini
  const interval = Math.max(minInt, base - level*5);
  clearInterval(bulletTimer);
  bulletTimer = setInterval(moveMonsterBullets, interval);
}



/**
 * Gestion du clavier
 */
// === remplacement du document.addEventListener('keydown', ...) ===
document.addEventListener('keydown', function(e) {
  if (!gameRunning) return;
  // on efface l'ancien curseur
  getTile(killerCol, killerRow).classList.remove('killer');

  // déplacements et shoots
  if (e.code === 'ArrowLeft') {
    if (killerCol > 0) killerCol--;
  } else if (e.code === 'ArrowRight') {
    if (killerCol < GRID_WIDTH - 1) killerCol++;
  } else if (e.code === 'Space') {
    playerShoot();
  }

  // activation des pouvoirs par touche lettre (layout-indépendant)
  else if (e.key.toLowerCase() === 'e') {
    activatePower('shield');
  } else if (e.key.toLowerCase() === 'd') {
    activatePower('triple');
  } else if (e.key.toLowerCase() === 'z') {
    activatePower('speed');
  }

  // on remet le curseur du joueur
  getTile(killerCol, killerRow).classList.add('killer');
  updateShieldBarPosition();
});


/**
 * Fin du jeu
 */
/**
 * Fin de partie
 */
function gameOver() {
  const sndgo=document.getElementById('gameOver');
  sndgo.currentTime = 0;
  sndgo.play();
  gameRunning = false;
  document.getElementById('game-over-overlay').classList.remove('hidden');

  // Affiche les stats dans l'overlay (facultatif)
  document.getElementById('final-score').textContent = score;
  document.getElementById('final-wave').textContent = wave;
  document.getElementById('final-level').textContent = level;

  sendSpaceTelemetry({
    event: "game_over",
    wave,
    score,
    combo: maxCombo,
    lives: 0
  });
  sendSpaceScore();  // ← ici aussi, sans arguments
}




/**
 * Envoi du score (si tu as un endpoint /api/scores)
 */
/**
 * Envoie du score final de SpacePiouPiou
 * POST /api/score/space
 */
async function sendSpaceScore() {
  const token = localStorage.getItem("token");
  if (!token) return;
  try {
    const duration = Math.floor((Date.now() - startTime) / 1000); // secondes
    const payload = { score, level, xp, wave, duration };
    const resp = await fetch(`${API_URL}/api/score/space`, {
      credentials: "include",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      console.error("Erreur envoi espace score:", resp.status);
    }
  } catch (err) {
    console.error("sendSpaceScore exception:", err);
  }
}


/**
 * Envoie des données de télémétrie (wave, score, combo, lives)
 */
/**
 * Envoie des données de télémétrie SpacePiouPiou
 * POST /api/telemetry/space
 */
async function sendSpaceTelemetry(data) {
  const token = localStorage.getItem("token");
  if (!token) return;
  try {
    const resp = await fetch(`${API_URL}/api/telemetry/space`, {
      credentials: "include",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(data)
    });
    if (!resp.ok) {
      console.error("Erreur envoi télémétrie space:", resp.status);
    }
  } catch (err) {
    console.error("sendSpaceTelemetry exception:", err);
  }
}




/**
 * Boucle principale du jeu (si tu veux un requestAnimationFrame)
 * Ici, tu utilises setInterval pour moveMonsters etc., donc tu peux laisser gameLoop vide.
 */
function gameLoop() {
  // Si tu veux un rafraîchissement plus fin, tu peux mettre un requestAnimationFrame ici
}

/**
 * render() : affichage initial si besoin
 */
function render() {
  // Eventuel affichage initial
}

// Initialisation
checkAuth();     // Vérifie qu’on est authentifié
addTiles();      // Crée toutes les tuiles
initMonsters();  // Place les monstres initiaux
getTile(killerCol, killerRow).classList.add('killer');

deconnexionBtn.addEventListener('click', () => {
  gameRunning = false;
  window.location.href = "/menu/menu.html";
});
pauseBtn.addEventListener('click', () => {
  gameRunning = !gameRunning;
  const ambiance = document.getElementById('ambianceloop');
  if (!gameRunning) ambiance.pause();
  else ambiance.play();

  if (!gameRunning) {
    // on met en pause
    pauseOverlay.classList.remove('hidden');
  } else {
    // on reprend
    pauseOverlay.classList.add('hidden');
  }
});
resumeButton.addEventListener('click', () => {
  gameRunning = true;
  pauseOverlay.classList.add('hidden');
});

// Bouton “Rejouer” sur overlay Game Over
document.getElementById('retry-button')
        .addEventListener('click', () => {
  resetGame();
});



// setInterval pour bouger monstres et balles

const diff0 = getDifficulty(wave);
moveTimer = setInterval(moveMonsters, diff0.moveInterval);
setInterval(movePlayerBullets, BULLET_INTERVAL);
setInterval(moveMonsterBullets, BULLET_INTERVAL);
;
window.addEventListener('resize', () => {
  explCanvas.width  = window.innerWidth;
  explCanvas.height = window.innerHeight;
});
