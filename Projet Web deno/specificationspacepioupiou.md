Nom : getDifficulty
Rôle : Calcule l’intervalle de déplacement des monstres (moveInterval) et ajuste shootProb selon la vague.
Préconditions : wave entier ≥ 1 et level définis.
Postconditions : shootProb mis à jour et { moveInterval } retourné. 

Nom : updateLevelUI
Rôle : Actualise le badge de niveau, la barre d’XP et l’affichage de la vague.
Préconditions : level, xp, wave, levelThresholds et les éléments DOM #levelBadge, #xpFill, #wave présents.
Postconditions : Texte et largeur des barres mis à jour. 

Nom : updateLivesUI
Rôle : Affiche les icônes de vies restantes.
Préconditions : lives entier ≥ 0 et livesContainer DOM défini.
Postconditions : livesContainer rempli d’autant de <img class="heart"> que de vies. 

Nom : checkLevelUp
Rôle : Incrémente level tant que xp atteint les seuils et déclenche l’animation.
Préconditions : xp, level, levelThresholds définis.
Postconditions : level augmenté et classe "level-up" animée. 

Nom : addXp
Rôle : Ajoute de l’XP, puis vérifie et met à jour l’UI de niveau.
Préconditions : amount ≥ 0, xp, level et fonctions checkLevelUp, updateLevelUI disponibles.
Postconditions : xp incrémenté, checkLevelUp() et updateLevelUI() appelées. 

Nom : spawnExplosion
Rôle : Génère 20 particules à l’emplacement donné pour l’effet d’explosion.
Préconditions : explCtx et particles définis, x,y numériques.
Postconditions : particles enrichi de 20 nouveaux objets particule. 

Nom : updateExplosions
Rôle : Dessine et met à jour toutes les particules, en filtrant les expirées.
Préconditions : explCtx et particles disponibles.
Postconditions : Canvas rafraîchi et requestAnimationFrame relancé. 

Nom : spawnPowerup
Rôle : Tente de placer un power-up aléatoire si la grille n’est pas saturée.
Préconditions : powerupsOnGrid, powerupTypes et getTile définis.
Postconditions : Nouvel objet {col,row,type} ajouté et tuile marquée .powerup si spawn. 

Nom : applyPowerupEffect
Rôle : Active l’effet (triple, shield ou speed) et gère sa durée ou nombre d’usages.
Préconditions : Flags (tripleActive, shieldActive, etc.) et fonctions auxiliaires disponibles.
Postconditions : Variables d’état modifiées et timers setTimeout éventuels démarrés. 

Nom : activatePower
Rôle : Retire un power-up de l’inventaire, joue le son et appelle applyPowerupEffect.
Préconditions : powerups et updatePowerupsUI définis, élément audio activatePowerUp présent.
Postconditions : Type retiré de powerups, UI et son déclenchés, effet appliqué. 

Nom : createShieldBar
Rôle : Ajoute la barre de bouclier au DOM si absente et positionne son remplissage à 100 %.
Préconditions : shieldActive vrai et document.body disponible.
Postconditions : <div id="shieldBar"> créé et updateShieldBarPosition() appelé. 

Nom : updateShieldBarPosition
Rôle : Ajuste la position de la barre de bouclier au-dessus du joueur.
Préconditions : killerCol,killerRow et getTile présents, #shieldBar dans le DOM.
Postconditions : style.left et style.top de #shieldBar mis à jour. 

Nom : addTiles
Rôle : Construit la grille en DOM et remplit le tableau tiles.
Préconditions : GRID_WIDTH,GRID_HEIGHT,TILE_SIZE et grid DOM définis.
Postconditions : tiles rempli et grid contient toutes les <div class="tile">. 

Nom : getTile
Rôle : Retourne la tuile DOM à (col,row) depuis tiles.
Préconditions : tiles et GRID_WIDTH initialisés, indices valides.
Postconditions : La <div> correspondante renvoyée. 

Nom : initBoss
Rôle : Place un ou plusieurs bosses selon la vague, crée leur barre de vie.
Préconditions : wave, GRID_WIDTH, nextBossId et getTile disponibles.
Postconditions : monsters enrichi d’objets boss, classes et barres de vie ajoutées au DOM. 

Nom : initMonsters
Rôle : Remplit monsters en formation et marque chaque tuile .monster.
Préconditions : monsterRows,monsterCols,tiles et getTile définis.
Postconditions : monsters peuplé et classes CSS appliquées. 

Nom : startGameLoops
Rôle : Lance ou relance les intervalles moveMonsters et moveMonsterBullets.
Préconditions : wave, MOVE_INTERVAL, BULLET_INTERVAL et getDifficulty disponibles.
Postconditions : moveTimer et bulletTimer configurés. 

Nom : resetGame
Rôle : Réinitialise tout l’état et l’UI pour une nouvelle partie.
Préconditions : Variables globales d’état et fonctions d’initialisation définies.
Postconditions : Compteurs remis à zéro, grille et entités reconstruites, boucles relancées. 

Nom : lowestMonsterRowInCol
Rôle : Renvoie la ligne la plus basse occupée par un monstre dans une colonne.
Préconditions : monsters tableau d’objets {col,row} défini.
Postconditions : Indice de ligne maximal ou -1 si aucun. 

Nom : moveMonsters
Rôle : Déplace les monstres en formation, gère les bords, tirs et spawn de power-ups.
Préconditions : gameRunning, monsters, monsterDirection, GRID_WIDTH,GRID_HEIGHT, shootProb et fonctions auxiliaires existants.
Postconditions : Positions mises à jour, classes CSS réappliquées, monsterShoot() et spawnPowerup() éventuellement appelés. 

Nom : movePlayerBullets
Rôle : Déplace les balles joueur, gère collisions (power-ups, monstres) et fin de vague.
Préconditions : gameRunning, playerBullets, GRID_HEIGHT et fonctions getTile, addXp, spawnExplosion, updatePowerupsUI, updateLivesUI disponibles.
Postconditions : Balles déplacées ou supprimées, score/XP/combo mis à jour, nouvelle vague initialisée si besoin. 

Nom : updateWaveBar
Rôle : Met à jour visuellement la barre de progression de la vague en 10 pastilles.
Préconditions : wave défini et #waveBar existant.
Postconditions : #waveBar rempli de <div class="step"> correctement filled. 

Nom : updatePowerupsUI
Rôle : Affiche les power-ups en inventaire dans leurs slots avec animation.
Préconditions : powerups tableau et #powerups .slot présents.
Postconditions : Slots mis à jour et animation boost-shake appliquée. 

Nom : moveMonsterBullets
Rôle : Déplace les balles des monstres, gère collision joueur et rebonds.
Préconditions : gameRunning, monsterBullets, GRID_HEIGHT et fonctions getTile, updateLivesUI, lowestMonsterRowInCol, gameOver disponibles.
Postconditions : Balles déplacées/supprimées, vies et bouclier ajustés, gameOver() potentiellement appelé. 

Nom : playerShoot
Rôle : Crée une ou plusieurs balles joueur, applique le cooldown et joue le son.
Préconditions : gameRunning, canShoot, killerCol,killerRow, shootCooldown et getTile définis.
Postconditions : canShoot verrouillé temporairement et playerBullets mis à jour. 

Nom : monsterShoot
Rôle : Choisit un monstre ou boss pour tirer et ajuste dynamiquement l’intervalle de tir.
Préconditions : monsters, BULLET_INTERVAL, wave,level et getTile disponibles.
Postconditions : Nouvelles monsterBullets ajoutées et bulletTimer mis à jour. 

Nom : gameOver
Rôle : Termine la partie : arrête le jeu, affiche l’overlay et envoie télémétrie/score.
Préconditions : gameRunning, éléments DOM #game-over-overlay, #final-score,#final-wave,#final-level et fonctions sendSpaceTelemetry,sendSpaceScore définies.
Postconditions : gameRunning false, overlay visible, appels réseau déclenchés. 

Nom : sendSpaceScore
Rôle : Envoie le score final au serveur avec la durée de jeu.
Préconditions : API_URL, score,level,xp,wave,startTime et token dans localStorage.
Postconditions : Requête POST vers /api/score/space exécutée. 

Nom : sendSpaceTelemetry
Rôle : Envoie des données de télémétrie en cours de partie au serveur.
Préconditions : API_URL, token et fetch disponibles.
Postconditions : Requête POST vers /api/telemetry/space exécutée.