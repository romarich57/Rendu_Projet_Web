Spécifications des fonctions du jeu snake

Nom : chargerNiveauMax
Rôle : Récupère le niveau maximum débloqué depuis le serveur via l’API.
Préconditions : Le serveur API doit être accessible et renvoyer un JSON valide.
Postconditions : Retourne une Promise résolue avec un entier représentant le niveau max, ou rejette en cas d’erreur.

Nom : saveScore
Rôle : Envoie le score, le niveau courant et le temps de jeu écoulé au serveur pour sauvegarde.
Préconditions : Les variables score, currentLevel et elapsedTime doivent être définies et numériques.
Postconditions : Retourne une Promise résolue lorsque les données ont été reçues par le serveur, ou rejette si l’envoi échoue.

Nom : updateLevelSettings
Rôle : Met à jour les paramètres de niveau (taille de la grille, chance de bombe et vitesse) selon currentLevel.
Préconditions : currentLevel doit être un entier valide et les configurations de niveaux doivent exister.
Postconditions : Les variables de configuration du jeu sont modifiées en fonction du niveau.

Nom : constructor (Node)
Rôle : Initialise un nœud du serpent avec une valeur et un pointeur next à null.
Préconditions : La classe Node doit être appelée avec un argument de valeur.
Postconditions : Un nouvel objet Node est créé avec les propriétés value et next initialisées.

Nom : constructor (Snake)
Rôle : Initialise un serpent vide avec head, tail, direction et length à zéro.
Préconditions : La classe Snake doit être instanciée sans paramètre.
Postconditions : Un nouvel objet Snake est créé avec l’état initial prêt pour démarrer le jeu.

Nom : eat
Rôle : Ajoute un nouveau segment au serpent à l’index donné et met à jour son affichage.
Préconditions : snake doit être défini et index doit être un entier valide dans la liste des nœuds.
Postconditions : Le serpent s’allonge de 1, la longueur est incrémentée et l’affichage du DOM est mis à jour.

Nom : getRotationFromVector
Rôle : Calcule l’angle de rotation en degrés pour orienter le serpent selon un vecteur de déplacement.
Préconditions : L’argument vector doit être un objet contenant des propriétés numériques x et y.
Postconditions : Retourne un nombre correspondant à l’angle en degrés.

Nom : getRotationFromNodes
Rôle : Détermine l’angle de rotation pour orienter le segment du serpent entre deux nœuds.
Préconditions : Les nœuds prevNode et currentNode doivent avoir des coordonnées définies.
Postconditions : Renvoie l’angle de rotation approprié en degrés.

Nom : getRotationForDirection
Rôle : Retourne l’angle de rotation pour la tête du serpent selon sa direction (droite, bas, gauche, haut).
Préconditions : La variable direction doit être une chaîne parmi les valeurs autorisées.
Postconditions : Renvoie un entier correspondant à l’angle choisi.

Nom : updateSnakeDisplay
Rôle : Met à jour l’affichage visuel de toutes les tuiles occupées par le serpent, en ajustant classes CSS et rotations.
Préconditions : Le tableau snake doit contenir au moins un nœud et les éléments DOM correspondants doivent exister.
Postconditions : Le DOM reflète l’état actuel du serpent à l’écran.

Nom : get_random_index
Rôle : Sélectionne un index aléatoire d’une tuile vide dans la grille.
Préconditions : La liste emptyTiles doit être non vide et contenir des indices valides.
Postconditions : Retourne un entier correspondant à un index valide de tuile vide.

Nom : get_next_tile_for_head
Rôle : Retourne la tuile devant la tête du serpent selon sa direction actuelle.
Préconditions : head doit être défini avec ses coordonnées et direction valide.
Postconditions : Renvoie une référence à l’élément DOM de la prochaine tuile.

Nom : will_hit_wall
Rôle : Détermine si la tête du serpent heurterait un mur au prochain déplacement.
Préconditions : La position de la tête et la taille de la grille doivent être définies.
Postconditions : Renvoie true si collision prévue, sinon false.

Nom : spawnFruit
Rôle : Place un fruit sur une tuile vide aléatoire et ajoute la classe CSS "fruit".
Préconditions : Il doit exister au moins une tuile vide.
Postconditions : Une nouvelle classe "fruit" est appliquée à un élément DOM.

Nom : spawnBomb
Rôle : Place une bombe sur une tuile vide aléatoire et ajoute la classe CSS "bomb".
Préconditions : Il doit exister au moins une tuile vide et le niveau doit autoriser des bombes.
Postconditions : Une nouvelle classe "bomb" est appliquée à un élément DOM.

Nom : checkLevelUp
Rôle : Vérifie si le score atteint le seuil pour passer au niveau suivant, incrémente level, arrête le jeu et affiche l’overlay.
Préconditions : score doit être défini et le seuil de niveau connu.
Postconditions : Si seuil atteint, level incrémenté, la boucle de jeu stoppée et overlay affiché.

Nom : init
Rôle : (Re)initialise entièrement l’état du jeu : grille, serpent, score et placement du fruit.
Préconditions : Les éléments du DOM doivent être présents et configurés.
Postconditions : L’état interne du jeu est réinitialisé et prêt à démarrer.

Nom : moveSnake
Rôle : Avance le serpent d’un pas en supprimant l’ancienne queue et en ajoutant une nouvelle tête.
Préconditions : Le serpent doit être initialisé et head, tail valides.
Postconditions : La structure de données du serpent est mise à jour.

Nom : move
Rôle : Gère un cycle de jeu en traitant déplacement, collisions, consommation de fruits et possibles bombes.
Préconditions : Le jeu doit être en cours (playing === true) et les fonctions utilitaires disponibles.
Postconditions : Met à jour position serpent, score, spawn objets et peut déclencher endGame().

Nom : startGame
Rôle : Démarre la boucle de jeu en programmant des appels répétés à move selon la vitesse.
Préconditions : init() doit avoir été appelé et la variable speed définie.
Postconditions : Un intervalle est établi et le jeu progresse automatiquement.

Nom : stopGame
Rôle : Arrête la boucle de jeu en annulant l’intervalle actif.
Préconditions : Un intervalle doit être en cours.
Postconditions : L’intervalle est supprimé et playing devient false.

Nom : endGame
Rôle : Termine la partie, enregistre le score, affiche l’écran de fin et arrête le jeu.
Préconditions : playing doit être true et score disponible.
Postconditions : Score sauvegardé, overlay Game Over visible et boucle stoppée.

Nom : updateScore
Rôle : Met à jour l’affichage du score et, si présent, du niveau dans le DOM.
Préconditions : Les éléments DOM pour le score doivent exister.
Postconditions : Le score (et niveau) affiché est synchronisé avec les variables.

Nom : fonction
Rôle : Gère l’événement keydown : change la direction du serpent ou lance le compte à rebours si espace.
Préconditions : Le gestionnaire d’événements est attaché à document.
Postconditions : La direction du serpent ou l’état de jeu est mis à jour selon la touche pressée.

Nom : togglePause
Rôle : Met en pause ou relance le jeu en inversant le flag playing et en démarrant ou arrêtant la boucle.
Préconditions : playing doit être un booléen indiquant l’état actuel du jeu.
Postconditions : Le jeu est soit arrêté soit redémarré, selon l’état précédent.

Nom : showCountdown
Rôle : Affiche un compte à rebours avant de lancer le jeu, démarre le chrono et la boucle de jeu.
Préconditions : L’overlay de compte à rebours doit exister dans le DOM.
Postconditions : Le compte à rebours visible diminue et, à zéro, startGame() est appelé.