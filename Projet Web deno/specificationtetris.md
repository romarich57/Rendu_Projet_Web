
Spécification tetris



Nom : initGrille
Rôle : Initialise la matrice grille et crée les cellules DOM.
Préconditions : ROWS, COLS et gameBoard définis.
Postconditions : grille devient une matrice ROWS×COLS de zéros et autant de <div class="cell"> sont ajoutés à gameBoard. 

Nom : generateTetromino
Rôle : Extrait pieceActive de nextQueue, en ajoute une nouvelle et met à jour l’affichage.
Préconditions : nextQueue non vide et fonctions cloneRandomTetromino, afficherNextQueue, createPieceDOM disponibles.
Postconditions : pieceActive mis à jour, nouvelle pièce ajoutée à la queue et DOM rafraîchi. 

Nom : cloneRandomTetromino
Rôle : Retourne une copie profonde aléatoire d’un tétrimino.
Préconditions : Tableau tetrominos non vide.
Postconditions : Renvoie { name, bloc, shape } sans modifier l’original. 

Nom : initNextQueue
Rôle : Remplit nextQueue de NEXT_COUNT pièces aléatoires et l’affiche.
Préconditions : NEXT_COUNT défini et cloneRandomTetromino/afficherNextQueue fonctionnels.
Postconditions : nextQueue contient NEXT_COUNT pièces et DOM mis à jour. 

Nom : afficherNextQueue
Rôle : Dessine dans le DOM les nextQueue tétriminos à venir.
Préconditions : nextQueue, tileSize, gridGap, et #next-container définis.
Postconditions : #next-container contient une carte par tétrimino à la bonne position. 

Nom : afficherNextPiece
Rôle : Affiche un unique tétrimino dans #next-container.
Préconditions : Objet tetromino valide et DOM prêt.
Postconditions : Conteneur vidé puis rempli d’une seule pièce stylée. 

Nom : updatePieceDOM
Rôle : Positionne et pivote pieceEl selon pos et rotationDeg.
Préconditions : pieceEl, pos, tileSize et GSAP disponibles.
Postconditions : pieceEl animé aux coordonnées calculées. 

Nom : createPieceDOM
Rôle : Crée/insère pieceEl dans le plateau et lance updateGhost().
Préconditions : piece, gameBoard, tileSize, gridGap, position et updateGhost définis.
Postconditions : Ancien pieceEl remplacé et ombre recalculée. 

Nom : createGhostDOM
Rôle : Génère l’élément DOM fantôme (ghostEl) de la pièce active.
Préconditions : piece, gameBoard, tileSize et gridGap définis.
Postconditions : Ancien ghostEl remplacé par un nouveau stylé. 

Nom : updateGhostDOM
Rôle : Déplace ghostEl à la position calculée sans rotation.
Préconditions : ghostEl, pos, tileSize, gridGap et GSAP disponibles.
Postconditions : ghostEl animé aux nouvelles coordonnées. 

Nom : updateGhost
Rôle : Calcule la chute maximale de l’ombre et met à jour son DOM.
Préconditions : pieceActive, position et isDispo définis ; fonctions ghost disponibles.
Postconditions : Ombre repositionnée à l’emplacement le plus bas valide. 

Nom : effacerPiece
Rôle : Réinitialise le backgroundImage des cellules couvertes par une pièce.
Préconditions : piece, pos, #game-board .cell et grille définis.
Postconditions : Les cellules affectées voient leur image enlevée. 

Nom : isDispo
Rôle : Vérifie collision et sortie de grille pour placer piece en pos.
Préconditions : piece.shape, pos, grille, ROWS, COLS définis.
Postconditions : Retourne true si placement valide, sinon false. 

Nom : fixerPiece
Rôle : Intègre piece dans grille en écrivant son bloc.
Préconditions : piece, pos, grille, ROWS, COLS définis.
Postconditions : Cases de grille mises à jour avec l’identifiant de bloc. 

Nom : gravity
Rôle : Fait tomber ou fixe la pièce et gère la suite (lignes, Game Over).
Préconditions : Toutes fonctions utilitaires (isDispo, fixerPiece…) et variables (tileSize, vitesses, niveau) disponibles.
Postconditions : Pièce déplacée ou fixée, nouvelles lignes et pièces générées, Game Over si nécessaire. 

Nom : deplacerPiece
Rôle : Déplace horizontalement la pièce et joue le son si valide.
Préconditions : dir = ±1, position, isDispo, sMove définis.
Postconditions : position.x et DOM mis à jour, ombre recalculée, retourne booléen. 

Nom : rotatePiece
Rôle : Pivote la pièce de 90° horaire si l’emplacement est libre, son inclus.
Préconditions : pieceActive.shape, position, isDispo, sRotate disponibles.
Postconditions : Forme pivotée intégrée ou rollback si collision, DOM mis à jour. 

Nom : hardDrop
Rôle : Fait chuter la pièce jusqu’en bas, la fixe et procède comme gravity.
Préconditions : Fonctions utilitaires (isDispo, fixerPiece…) et variables (position, prochainePiece) disponibles.
Postconditions : Pièce positionnée en bas, grille rafraîchie, nouvelle pièce, Game Over possible. 

Nom : viderLignesCompletes
Rôle : Supprime les lignes pleines, met à jour score/niveau et relance gravité.
Préconditions : grille, totalLignes, score, niveau, vitesses et fonctions UI/gravité définies.
Postconditions : Lignes flashées et retirées, score/niveau incrementés, UI rafraîchie. 

Nom : reafficherGrille
Rôle : Applique ou retire l’image de chaque cellule selon grille.
Préconditions : grille, #game-board .cell et images existantes.
Postconditions : DOM synchronisé avec l’état de grille. 

Nom : startGravity
Rôle : Démarre/relance un intervalle appelant gravity() selon niveau.
Préconditions : vitesses, gravity et niveau définis.
Postconditions : Ancien intervalle annulé, nouveau planifié. 

Nom : formatTemps
Rôle : Convertit un entier de secondes en "MM:SS".
Préconditions : sec entier ≥ 0.
Postconditions : Chaîne formatée renvoyée. 

Nom : startTimer
Rôle : Lance un intervalle incrémentant secondesEcoulees et met à jour le chrono DOM.
Préconditions : secondesEcoulees, formatTemps, #time-value définis.
Postconditions : intervalTemps planifié pour mise à jour chaque seconde. 

Nom : togglePause
Rôle : Bascule la pause, arrête/reprend intervalles et affiche/masque l’overlay.
Préconditions : isPaused, intervalGravite, intervalTemps et startGravity, startTimer disponibles ; #pause-overlay présent.
Postconditions : isPaused inversé et intervalles/overlay adaptés. 

Nom : afficherGameOver
Rôle : Stoppe le jeu, affiche le modal, joue le son, envoie le score et configure les boutons.
Préconditions : Intervalles, score, API_URL, sGameOver, #overlay, restartGame, localStorage accessibles.
Postconditions : Jeu arrêté, modal visible, requête POST envoyée, handlers “Rejouer/Quitter” attachés. 

Nom : restartGame
Rôle : Réinitialise tout l’état pour une nouvelle partie sans recharger la page.
Préconditions : Variables d’état et fonctions d’initialisation (initGrille, initNextQueue…) définies.
Postconditions : État et UI remis à zéro, grille recréée, première pièce affichée, intervalles relancés