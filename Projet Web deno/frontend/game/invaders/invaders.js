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


/**
 * Role : Calcule la difficulté du jeu pour une vague donnée en ajustant l’intervalle de déplacement des monstres et la probabilité de tir.
 * Préconditions : 
 *   - La variable globale `wave` (entier ≥ 1) est passée en argument.
 *   - Les constantes `GRID_WIDTH`, `GRID_HEIGHT` ne sont pas requises ici.
 *   - Les variables globales `level` et `shootProb` existent (ce dernier sera mis à jour).
 *   - Les bornes `maxI = 500` et `minI = 100` sont implicites dans la fonction.
 * Postconditions : 
 *   - La variable `shootProb` est mise à la nouvelle valeur calculée (entre 0.05 et 0.20 selon la formule).
 *   - La fonction retourne un objet `{ moveInterval }` où `moveInterval` est compris entre `minI` et `maxI` selon la vague.
 */


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


/**
 * Role : Met à jour l’affichage du niveau, de la progression de l’XP et de la vague dans l’interface utilisateur.
 * Préconditions : 
 *   - Les variables globales `level`, `xp`, `wave` et le tableau `levelThresholds` sont définis.
 *   - Les éléments DOM `#levelBadge`, `#xpFill` et `#wave` existent.
 * Postconditions : 
 *   - Le texte de `#levelBadge` est mis à la valeur actuelle de `level`.
 *   - La largeur de `#xpFill` est ajustée au pourcentage d’XP entre le palier précédent et le suivant.
 *   - Le texte de `#wave` est mis à la valeur actuelle de `wave`.
 */

function updateLevelUI() {
  document.getElementById('levelBadge').textContent = level;
  const prev = levelThresholds[level - 1] || 0;
  const next = levelThresholds[level];
  const pct = Math.min(100, ((xp - prev) / (next - prev)) * 100);
  document.getElementById('xpFill').style.width = pct + '%';
  document.getElementById('wave').textContent = wave;

}

/**
 * Role : Met à jour l’affichage des vies restantes sous forme d’icônes cœur dans l’interface.
 * Préconditions : 
 *   - La variable globale `lives` est un entier ≥ 0 indiquant le nombre de vies restantes.
 *   - L’élément DOM référencé par `livesContainer` existe et peut être vidé et ré-emplissé.
 * Postconditions : 
 *   - `livesContainer` est vidé de tout contenu.
 *   - Pour chaque vie (de 1 à `lives`), une balise `<img>` avec `src="/shared/vie.png"`, `alt="Vie"` et la classe `heart` est ajoutée à `livesContainer`.
 */

function updateLivesUI() {
  livesContainer.innerHTML = '';
  for (let i = 0; i < lives; i++) {
    const img = document.createElement('img');
    img.src = '/shared/vie.png';     
    img.alt = 'Vie';
    img.classList.add('heart');
    livesContainer.appendChild(img);
  }
}


// Appelle au démarrage et à chaque changement de vies
updateLivesUI();


/**
 * Role : Vérifie si le joueur a franchi un palier de niveau en comparant l’XP accumulé aux seuils, et déclenche l’animation de montée de niveau.
 * Préconditions : 
 *   - La variable globale `xp` (nombre total d’XP) est définie.
 *   - La variable globale `level` (niveau courant) est définie.
 *   - Le tableau global `levelThresholds` contient les valeurs de seuil pour chaque niveau.
 *   - L’élément `document.body` est disponible pour appliquer la classe d’animation.
 * Postconditions : 
 *   - Tant que `xp` atteint ou dépasse `levelThresholds[level]`, `level` est incrémenté de 1.
 *   - À chaque incrément de `level`, la classe CSS `"level-up"` est ajoutée au corps du document pendant 500 ms pour l’animation.
 */

function checkLevelUp() {
  while (levelThresholds[level] !== undefined && xp >= levelThresholds[level]) {
    level++;
    document.body.classList.add('level-up');
    setTimeout(() => document.body.classList.remove('level-up'), 500);
    
  }
}


/**
 * Role : Ajoute une quantité d’XP au joueur, vérifie les montées de niveau et met à jour l’interface de niveau.
 * Préconditions : 
 *   - L’argument `amount` est un nombre positif ou nul.
 *   - Les variables globales `xp`, `level` et le tableau `levelThresholds` sont définis.
 *   - Les fonctions `checkLevelUp()` et `updateLevelUI()` sont disponibles.
 * Postconditions : 
 *   - La variable globale `xp` est augmentée de `amount`.
 *   - `checkLevelUp()` est appelée pour ajuster `level` si nécessaire.
 *   - `updateLevelUI()` est appelée pour refléter les changements de niveau et d’XP dans l’interface.
 */

function addXp(amount) {
  xp += amount;
  checkLevelUp();
  updateLevelUI();
}

/**
 * Role : Génère un nuage de particules d’explosion à la position donnée, en initialisant leur vecteur de mouvement, durée de vie et couleur.
 * Préconditions : 
 *   - Les variables globales `particles` (tableau) et `explCanvas`/`explCtx` sont définies.
 *   - Les arguments `x` et `y` sont des coordonnées valides (numériques) à l’intérieur du canvas.
 *   - L’argument optionnel `color` est une chaîne CSS valide.
 * Postconditions : 
 *   - `particles` est enrichi de 20 nouveaux objets particule comportant `x`, `y`, `vx`, `vy`, `life` et `color`.
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



/**
 * Role : Met à jour et dessine toutes les particules d’explosion à l’écran, en filtrant celles dont la durée de vie est expirée.
 * Préconditions : 
 *   - Le contexte `explCtx` du canvas d’explosion est initialisé.
 *   - Le tableau global `particles` contient des objets particule avec `x`, `y`, `vx`, `vy`, `life`, `color`.
 * Postconditions : 
 *   - Le canvas est nettoyé puis chaque particule vivante est dessinée (carré 4×4), ses coordonnées mises à jour, et sa `life` décrémentée.
 *   - Les particules dont `life <= 0` sont retirées de `particles`.
 *   - Une nouvelle frame est programmée via `requestAnimationFrame(updateExplosions)`.
 */

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
 * Role : Tente de faire apparaître un power-up aléatoire sur la grille, dans une case libre, en respectant la limite de un power-up à la fois.
 * Préconditions :
 *   - Le tableau global `powerupsOnGrid` et la constante `maxPowerups` sont définis.
 *   - Le tableau `powerupTypes` contient les types possibles de power-ups.
 *   - La fonction `getTile(col, row)` renvoie un élément DOM tile et ses classes reflètent son occupation.
 * Postconditions :
 *   - Si `powerupsOnGrid.length < maxPowerups` et que la probabilité est favorable, un objet `{col,row,type}` est ajouté à `powerupsOnGrid`.
 *   - La tuile correspondante reçoit la classe `powerup` et son `backgroundImage` est défini selon le type (URL `/assets/images/{type}.png`).
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
 * Role : Applique l’effet du power-up collecté selon son type, en activant les capacités spéciales et en gérant leur durée ou nombre d’utilisations.
 * Préconditions : 
 *   - L’argument `type` est une chaîne correspondant à un élément de `powerupTypes` (parmi 'triple', 'shield', 'speed').
 *   - Les variables globales `tripleActive`, `tripleShotsRemaining`, `shieldActive`, `speedActive`, `shootCooldown` et `defaultShootCooldown` sont définies.
 *   - La fonction `createShieldBar()` et la fonction `setTimeout()` sont disponibles pour la gestion de la durée.
 * Postconditions : 
 *   - Pour `type === 'triple'` : `tripleActive` passe à `true` et `tripleShotsRemaining` est initialisé à 5.
 *   - Pour `type === 'shield'` : `shieldActive` passe à `true` et la barre de bouclier est créée via `createShieldBar()`.
 *   - Pour `type === 'speed'` : si `speedActive` était `false`, `speedActive` passe à `true`, `shootCooldown` est réduit à la moitié de `defaultShootCooldown`, et après 15 000 ms les valeurs reviennent à la normale (`shootCooldown = defaultShootCooldown`, `speedActive = false`).
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
 * Role : Active un power-up stocké, le retire de l’inventaire et déclenche son effet avec feedback sonore.
 * Préconditions : 
 *   - L’argument `type` est une chaîne correspondant à un power-up présent dans le tableau global `powerups`.
 *   - Le tableau global `powerups` et la fonction `updatePowerupsUI()` sont définis.
 *   - L’élément audio `activatePowerUp` existe dans le DOM pour le son d’activation.
 * Postconditions : 
 *   - `type` est retiré du tableau `powerups`.
 *   - L’UI des power-ups est mise à jour via `updatePowerupsUI()`.
 *   - Le son d’activation est joué.
 *   - La fonction `applyPowerupEffect(type)` est appelée pour appliquer l’effet correspondant.
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
 * Role : Crée et positionne visuellement la barre de bouclier au-dessus du vaisseau, si elle n’existe pas déjà.
 * Préconditions : 
 *   - La variable globale `shieldActive` a été mise à `true`.
 *   - L’élément DOM `document.body` est disponible pour y appendre la barre.
 *   - La fonction `updateShieldBarPosition()` est définie pour ajuster la position.
 * Postconditions : 
 *   - Si aucune barre de bouclier n’existait (`#shieldBar` absent), un `<div>` avec id `shieldBar` et un enfant `shieldFill` sont ajoutés au body.
 *   - La classe `shield-bar` et `shield-bar-fill` sont appliquées, avec la largeur initiale à 100%.
 *   - `updateShieldBarPosition()` est appelée pour aligner la barre au-dessus du vaisseau.
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
 * Role : Positionne la barre de bouclier au-dessus du vaisseau ennemi le plus récemment touché.
 * Préconditions : 
 *   - La variable globale `killerCol` et `killerRow` indiquant la colonne et la ligne cibles sont définies.
 *   - La fonction `getTile(col, row)` retourne un élément DOM valide pour la tuile spécifiée.
 *   - L’élément DOM `#shieldBar` existe dans le document.
 * Postconditions : 
 *   - La propriété `style.left` et `style.top` de `#shieldBar` sont ajustées pour centrer la barre au-dessus de la tuile cible, à 4 px au-dessus de celle-ci.
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
 * Role : Initialise la grille de jeu en créant dynamiquement toutes les tuiles et en les stockant pour référence ultérieure.
 * Préconditions : 
 *   - Les constantes `GRID_WIDTH`, `GRID_HEIGHT` et `TILE_SIZE` sont définies.
 *   - L’élément DOM identifié par `grid` existe et peut être vidé.
 *   - La variable globale `tiles` est déclarée.
 * Postconditions : 
 *   - `tiles` est réinitialisé en tableau vide puis rempli d’éléments `<div class="tile">` row-major.
 *   - Chaque tuile a ses propriétés `row` et `col` définies, ses dimensions fixées à `TILE_SIZE`, et est ajoutée au DOM sous `grid`.
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
 * Role : Retourne l’élément DOM correspondant à la tuile située aux coordonnées données.
 * Préconditions : 
 *   - Le tableau global `tiles` contient des éléments `<div>` en ordre row-major.
 *   - La constante `GRID_WIDTH` (nombre de colonnes) est définie.
 *   - Les indices `col` et `row` sont valides (0 ≤ col < GRID_WIDTH, 0 ≤ row < GRID_HEIGHT).
 * Postconditions : 
 *   - Renvoie la tuile à l’index `row * GRID_WIDTH + col` dans `tiles`.
 */

function getTile(col, row) {
  return tiles[row * GRID_WIDTH + col];
}


/**
 * Role : Initialise les boss pour la vague actuelle en plaçant un ou plusieurs ennemis spéciaux et en créant leur barre de vie.
 * Préconditions : 
 *   - La variable globale `wave` (numéro de la vague) est définie.
 *   - Les variables globales `monsters` (tableau), `nextBossId` (compteur) et `GRID_WIDTH` sont initialisées.
 *   - Les fonctions `getTile(col,row)` et l’accès au `document.body` sont disponibles.
 * Postconditions : 
 *   - `monsters` est enrichi d’un objet boss par tranche de 5 vagues, avec propriétés `{ col, row, isBoss: true, hp, id }`.
 *   - Si un boss est créé :
 *       • La classe `boss` est ajoutée à la tuile correspondante.
 *       • Un `<div class="boss-hp-bar">` et son remplissage `<div class="boss-hp-fill">` sont ajoutés au DOM, avec `data-boss-id` pour le suivi.
 */

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
 * Role : Initialise la formation des monstres pour la vague en cours en remplissant le tableau `monsters` et en ajoutant la classe CSS `monster` à chaque tuile correspondante.
 * Préconditions :
 *   - Les constantes `monsterRows` et `monsterCols` sont définies (nombre de lignes et de colonnes de monstres).
 *   - Les variables globales `monsters` (tableau) et `grid`/`tiles` (DOM et liste de tuiles) sont initialisées.
 *   - La fonction `getTile(col, row)` est disponible pour récupérer chaque tuile DOM.
 * Postconditions :
 *   - `monsters` est réinitialisé puis rempli d’objets `{ col, row }` pour chaque position de monstre.
 *   - Chaque tuile correspondante reçoit la classe `monster` pour l’affichage.
 */

function initMonsters() {
  monsters = [];                
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
 * Role : Lance ou relance les boucles de déplacement des monstres et des tirs de monstres selon la difficulté actuelle.
 * Préconditions :
 *   - La variable globale `wave` indique la vague en cours.
 *   - Les constantes `BULLET_INTERVAL` et les variables `moveTimer` et `bulletTimer` existent.
 *   - Les fonctions `getDifficulty(wave)` (retourne `{ moveInterval }`), `moveMonsters()` et `moveMonsterBullets()` sont définies.
 * Postconditions :
 *   - Si un intervalle existant était en place pour `moveTimer` ou `bulletTimer`, il est d’abord arrêté.
 *   - Un nouvel intervalle est créé et stocké dans `moveTimer`, appelant `moveMonsters()` toutes les `moveInterval` ms.
 *   - Un nouvel intervalle est créé et stocké dans `bulletTimer`, appelant `moveMonsterBullets()` toutes les `BULLET_INTERVAL` ms.
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


/**
 * Role : Réinitialise complètement l’état du jeu pour démarrer une nouvelle partie sans recharger la page.
 * Préconditions :
 *   - Les variables globales `wave`, `xp`, `level`, `lives`, `score`, `monsters`, `playerBullets`, `monsterBullets` existent.
 *   - Les fonctions `updateLevelUI()`, `updateLivesUI()`, `updateWaveBar()`, `addTiles()`, `initMonsters()`, `getTile()`, `updateShieldBarPosition()`, `startGameLoops()` et les éléments DOM `game-over-overlay`, `#powerups .slot`, `scoreSpan`, `livesContainer` sont disponibles.
 * Postconditions :
 *   - L’overlay de Game Over est masqué.
 *   - `wave`, `xp`, `level` et `lives` sont remis à leurs valeurs initiales (1, 0, 1, 3) et l’UI correspondante est mise à jour.
 *   - Le tableau `powerups` est vidé et les slots UI sont réinitialisés.
 *   - `score` est remis à 0 et l’affichage mis à jour.
 *   - Les tableaux `monsters`, `playerBullets`, `monsterBullets` sont vidés.
 *   - La grille est reconstruite (`addTiles()`), les monstres réinitialisés (`initMonsters()`), et le curseur du joueur positionné.
 *   - Les boucles de jeu (monstres et tirs) sont relancées via `startGameLoops()` et `gameRunning` passe à `true`.
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
 * Role : Détermine la ligne la plus basse occupée par un monstre dans une colonne donnée.
 * Préconditions : 
 *   - La variable globale `monsters` est un tableau d’objets monstre avec propriétés `col` et `row`.
 *   - L’argument `col` est un entier valide (0 ≤ col < GRID_WIDTH).
 * Postconditions : 
 *   - Retourne l’indice de la ligne (`row`) maximal parmi les monstres dont `m.col === col`, ou -1 si aucun monstre n’est présent dans cette colonne.
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
 * Role : Gère le déplacement en formation des monstres, l’actualisation de leurs sprites, la gestion des collisions de bord, ainsi que le tir aléatoire et l’apparition de power-ups.
 * Préconditions : 
 *   - La variable globale `gameRunning` est booléenne.
 *   - Les variables `monsters`, `monsterDirection`, `GRID_WIDTH`, `GRID_HEIGHT`, `shootProb` et `bulletTimer` sont définies.
 *   - Les fonctions `getTile(col,row)`, `getDifficulty(wave)`, `monsterShoot()` et `spawnPowerup()` sont disponibles.
 * Postconditions : 
 *   - Si `gameRunning` est `false`, la fonction retourne immédiatement sans rien modifier.
 *   - Les classes CSS `monster` et `boss` sont retirées de toutes les anciennes positions.
 *   - Chaque monstre est déplacé horizontalement ou, s’il atteint un bord, tous les monstres descendent d’une ligne et inversent `monsterDirection`.
 *   - Les classes CSS `monster` ou `boss` sont réappliquées aux nouvelles positions.
 *   - Les barres de vie des boss sont repositionnées au-dessus de chaque boss.
 *   - Selon `shootProb`, un tir de monstre est déclenché, et `spawnPowerup()` est appelé pour générer un power-up éventuel.
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
 * Role : Déplace les projectiles du joueur vers le haut, gère les collisions avec power-ups, monstres et bords, met à jour le score, l’XP, le combo et déclenche la fin de vague.
 * Préconditions :
 *   - La variable globale `gameRunning` est un booléen indiquant si le jeu est actif.
 *   - Le tableau global `playerBullets` contient des objets `{ col, row }`.
 *   - Les constantes `GRID_HEIGHT` et les fonctions `getTile(col,row)`, `addXp()`, `spawnExplosion()`, `updatePowerupsUI()`, `updateLivesUI()` sont disponibles.
 *   - Les variables globales `monsters`, `powerupsOnGrid`, `powerups`, `combo`, `maxCombo`, `score`, `scoreSpan`, `comboDisplay`, `comboCountSpan`, `wave` sont définies.
 * Postconditions :
 *   - Chaque balle est effacée de son ancienne tuile, déplacée d’une ligne vers le haut et dessinée ou supprimée si hors-grille.
 *   - En cas de collision avec un power-up : le power-up est collecté, ajouté à l’inventaire, son UI mise à jour, et la balle supprimée.
 *   - En cas de collision avec un monstre ou un boss : gère la réduction de PV, la suppression ou le clignotement du boss, joue les sons appropriés, met à jour le score, l’XP et le combo, affiche l’animation d’explosion et rafraîchit l’UI.
 *   - Si tous les monstres sont tués : joue la fin de vague, incrémente la vague, met à jour les barres et niveaux, et réinitialise la formation des monstres ou initie un boss.
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



/**
 * Role : Met à jour visuellement la barre de progression de la vague en affichant jusqu’à 10 pastilles, dont le nombre rempli reflète la progression dans le cycle de vagues.
 * Préconditions :
 *   - La variable globale `wave` est définie (entier ≥ 1).
 *   - L’élément DOM `#waveBar` existe.
 * Postconditions :
 *   - Le conteneur `#waveBar` est vidé puis rempli de 10 `<div class="step">` ou `<div class="step filled">` selon `(wave % 10)`.
 */

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
 * Role : Met à jour visuellement les emplacements de power-ups récupérés en remplissant chaque slot avec l’icône correspondante et une animation temporaire.
 * Préconditions : 
 *   - Le tableau global `powerups` liste les types de power-ups actuellement en inventaire.
 *   - L’élément DOM `#powerups .slot` contient autant d’éléments `.slot` que de slots disponibles.
 * Postconditions : 
 *   - Chaque slot est d’abord réinitialisé (`class='slot'`, pas d’image de fond).
 *   - Pour les `n = powerups.length` premiers slots, la classe `active` et `boost-shake` est ajoutée, et leur `backgroundImage` positionne l’icône du power-up.
 *   - L’animation `boost-shake` est automatiquement retirée après 400 ms.
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
 * Role : Fait descendre les projectiles tirés par les monstres, gère leurs collisions avec le joueur, les bords et les monstres, et met à jour l’état de jeu (vies, score, bouclier).
 * Préconditions : 
 *   - La variable globale `gameRunning` indique si le jeu est toujours actif.
 *   - Le tableau global `monsterBullets` contient des objets `{ col, row }`.
 *   - Les fonctions `getTile(col,row)`, `updateLivesUI()`, `updatePowerupsUI()`, `lowestMonsterRowInCol()` et `gameOver()` sont disponibles.
 *   - Les variables globales `lives`, `shieldActive`, `powerups` et `score` sont définies.
 * Postconditions : 
 *   - Chaque balle est effacée de son ancienne tuile, déplacée d’une ligne vers le bas, puis :  
 *     • Si elle touche le joueur (`killerCol`, `killerRow`), applique blindage ou enlève une vie, met à jour l’UI et déclenche `gameOver()` si `lives` tombe à 0.  
 *     • Sinon, si elle est sous le dernier monstre de sa colonne, elle est dessinée (classe `monster_bullet`), sinon supprimée hors-grille.  
 *   - Les tableaux et l’état global sont mis à jour en conséquence.
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
 * Role : Gère le tir du joueur : crée un ou plusieurs projectiles, applique le cooldown et joue le son.
 * Préconditions :
 *   - `gameRunning` est vrai et `canShoot` est `true`.
 *   - Les variables globales `killerCol`, `killerRow`, `playerBullets`, `tripleActive`, `tripleShotsRemaining`, `shootCooldown`, `defaultShootCooldown` existent.
 *   - Les fonctions `getTile(col, row)` et `updatePowerupsUI()` sont disponibles.
 * Postconditions :
 *   - `canShoot` passe à `false` puis rétabli après `shootCooldown` ms.
 *   - Un son de tir est joué.
 *   - Si `tripleActive`, jusqu’à trois balles sont ajoutées et `tripleShotsRemaining` décrémente, sinon une seule.
 *   - Chaque nouvelle balle est ajoutée à `playerBullets` et dessinée si en grille.
 */

function playerShoot() {
  if (!gameRunning || !canShoot) return;        // on ne tire que si autorisé

  canShoot = false;                             // verrouillage immédiat
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
 * Role : Sélectionne un monstre (ou boss) aléatoire pour tirer, génère un ou plusieurs projectiles, ajuste dynamiquement le cooldown des tirs monstres et joue le son.
 * Préconditions :
 *   - `monsters` est un tableau des entités vivantes (incluant boss marqués par `isBoss`).
 *   - `BULLET_INTERVAL`, `bulletTimer`, `wave`, `level` sont définis.
 *   - Les fonctions `getTile(col, row)` et `lowestMonsterRowInCol(col)` sont disponibles.
 * Postconditions :
 *   - Un son de tir de monstre est joué.
 *   - Entre 1 et 1+floor(wave/10) balles sont créées à la position du monstre tirant et ajoutées à `monsterBullets`.
 *   - Un nouvel intervalle `bulletTimer` est recalculé pour accélérer les tirs selon le niveau.
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
 * Role : Gère la fin de la partie : joue le son Game Over, affiche l’écran de fin, envoie les statistiques et bloque le jeu.
 * Préconditions :
 *   - `gameRunning` est en cours.
 *   - Les éléments DOM `#game-over-overlay`, `#final-score`, `#final-wave`, `#final-level` existent.
 *   - Les fonctions `sendSpaceTelemetry(data)` et `sendSpaceScore()` sont disponibles.
 * Postconditions :
 *   - Un son de fin de partie est joué.
 *   - `gameRunning` passe à `false`.
 *   - L’overlay de Game Over est affiché.
 *   - Les scores finaux (score, wave, level) sont injectés dans l’overlay.
 *   - Les appels asynchrones de télémétrie et d’envoi de score sont déclenchés.
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
 * Role : Envoie au serveur le score final du joueur avec durée, vague, niveau et XP.
 * Préconditions :
 *   - `token` JWT est présent dans `localStorage`.
 *   - Les variables globales `API_URL`, `score`, `level`, `xp`, `wave`, `startTime` sont définies.
 * Postconditions :
 *   - Une requête POST est faite vers `${API_URL}/api/score/space` avec le payload JSON.
 *   - En cas d’erreur réseau ou réponse non OK, un message est logué.
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
 * Role : Envoie au serveur des données de télémétrie en cours de partie (vague, score, combo, vies).
 * Préconditions :
 *   - `token` JWT est présent dans `localStorage`.
 *   - `API_URL` et la fonction `fetch` sont disponibles.
 * Postconditions :
 *   - Une requête POST est faite vers `${API_URL}/api/telemetry/space` avec les données fournies.
 *   - En cas d’erreur, un message est logué.
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


/**
 * Au clic sur "Commencer le jeu"
 */
startButton.addEventListener('click', () => {
  // Masquer l'écran de démarrage
  startScreen.style.display = 'none';
  // Lancer le jeu
  gameRunning = true;
  resetGame();
  render();  
  gameLoop(); 
});

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
 * Role : Vérifie la présence d’un token JWT dans le stockage local et redirige vers la page de login si aucun token n’est trouvé.
 * Préconditions : 
 *   - `localStorage` est accessible et peut contenir une clé `"token"`.
 *   - La propriété `window.location.href` peut être modifiée pour effectuer la redirection.
 * Postconditions : 
 *   - Si `localStorage.getItem("token")` renvoie une valeur falsy, l’utilisateur est redirigé vers `/auth/login/login.html`.
 *   - Sinon, aucun changement de page n’a lieu.
 */

function checkAuth() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/auth/login/login.html";
  }
}
