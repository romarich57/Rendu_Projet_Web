Système d'Authentification et de Connexion (connexion admin : login:romaric et mdp:35)

Mon projet implémente un système d'authentification et différentes interfaces utilisateur. 

Architecture Backend
Composants principaux:

- handlers.ts : Contient les fonctions qui gèrent l'authentification, l'inscription  la récupération de mots de passe ainsi que pour toutes les récupérations de scores.

- middlewares.ts : Implémente la validation des tokens JWT et la protection des routes

- routes.ts : Définit les endpoints API pour l'authentification
- mail.ts : Gère l'envoi d'emails pour la récupération de mots de passe,l'activation de compte utilisateurs.

Sécurité:

- Stockage des mots de passe hachés avec bcrypt
- Génération et validation de tokens JWT
- Protection contre les attaques par force brute via rate limiting (Connexion admin , pour celle dans le login mis en commentaire lors du déploiement du site )
- HTTPS 
- Pour se connecter aux portailles administrateurs aller dans compteutilisateur(en haut à droite) , cliquez sur administrateur.La connexion est unique ( mdp et identifant).Ces données sont stockées dans le .env.Pour se connecter : login : romaric , mdr:35.
-Vérification des adresses-mails (envoie de mail de vérification) , possibilité de reset son password.
- CSP

Architecture Frontend :

- Interfaces utilisateur

- Interface de connexion (/frontend/auth/login/) : Formulaire standard email/mot de passe

- Interface d'inscription (/frontend/auth/register/) : Création de compte utilisateur

- Récupération de mot de passe (/frontend/auth/forgot/) : Permet de demander une réinitialisation

- Réinitialisation de mot de passe (/frontend/auth/reset/) : Définition d'un nouveau mot de passe

- Connexion administrateur (/frontend/admin/login/) : Interface séparée pour les administrateurs

- Gestion de compte (/frontend/compteutilisateur/) : Permet aux utilisateurs de gérer leur profil(modifier des donnés comme le pseudo) .

Flux d'authentification:

- Inscription : L'utilisateur s'inscrit via le formulaire d'inscription
- Connexion : L'utilisateur saisit ses identifiants et reçoit un token JWT (cookie-http-only)
- Stockage : Le token est stocké dans le localStorage du navigateur
- Autorisation : Le token est envoyé avec chaque requête API dans l'en-tête Authorization
- Validation : Le middleware serveur vérifie la validité du token
- Accès : L'utilisateur accède aux ressources protégées selon son niveau d'autorisation
- Déconnexion : Le token est supprimé du localStorage

Fonctionnalités supplémentaires :

- Accès administrateur : Interface d'administration protégée avec des droits spécifiques
- Réinitialisation de mot de passe : Système en deux étapes avec envoi d'email
- Gestion de profil utilisateur : Possibilité de modifier ses informations et préférences

Présentation du jeu avec les Websokcet

Guerre des Vaisseaux est un jeu multijoueur en temps réel qui s’appuie entièrement sur un canal WebSocket persistent entre chaque client et le serveur pour offrir une expérience fluide et synchronisée. Dès qu’un joueur clique sur « Commencer le jeu », son navigateur ouvre une connexion WebSocket, reçoit un identifiant unique et attend qu’un adversaire rejoigne la même « salle ».

Lorsqu’un second joueur se connecte, le serveur associe automatiquement les deux participants, initialise l’état de la partie (positions de vaisseaux, vies, projectiles…) et démarre une boucle de mise à jour à 30 images par seconde. À chaque itération, le serveur calcule les mouvements, gère les tirs et détecte les collisions, puis envoie l’état de jeu complet à chaque client. De leur côté, les joueurs émettent en continu des messages (« move », « shoot », « join ») pour faire bouger leur vaisseau ou tirer, qui sont traités immédiatement sur le serveur.

Ce choix des WebSockets est justifié par la nécessité de faible latence (chaque milliseconde compte dans un duel spatial), de communication bidirectionnelle sans surcharge de headers HTTP, et de maintien d’une connexion unique qui simplifie la détection de déconnexion ou d’inactivité. Le résultat est un affrontement réactif, où chaque commande est immédiatement répercutée pour les deux joueurs, garantissant un gameplay compétitif et immersif.

## Déploiement Docker / VPS

L’application est maintenant découpée en trois conteneurs : frontend (port 8000), backend Deno (port 6000) et PostgreSQL (port 5000 exposé depuis le port 5432 interne). La composition se trouve dans `docker-compose.yml` et s’appuie sur les Dockerfiles `Dockerfile.frontend` et `Dockerfile.backend`.

### 1. Préparer les variables d’environnement

```
cp docker.env.example docker.env
```

Éditez `docker.env` afin d’y mettre :
- les identifiants SMTP pour l’envoi des e-mails ;
- les identifiants d’amorçage admin (`ADMIN_USER`, `ADMIN_PASS`) ;
- les secrets (`JWT_SECRET`, `COOKIE_SECURE`, etc.) ;
- les identifiants Postgres (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`);
- les URLs publiques pointant vers votre VPS (`SERVER_URL`, `FRONTEND_URL`, `WS_URL`, `CORS_URLS`).

### 2. Construire et lancer la stack

```
docker compose --env-file docker.env up -d --build
```

- Frontend statique : http://localhost:8000
- API / WebSocket backend : http://localhost:6000
- PostgreSQL : port 5000 (redirigé vers 5432 dans le conteneur) pour un accès éventuel depuis votre poste via `psql`.

La base stocke ses données dans le volume `db-data` (persiste entre les redémarrages).

### 3. Opérations courantes

- Voir les logs : `docker compose logs -f backend` (ou `frontend` / `db`).
- Arrêter les services : `docker compose down`.
- Rebuild après modifications : `docker compose --env-file docker.env up -d --build`.
- Sauvegarder la base : `docker compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql`.

### 4. Mise en production sur VPS

- Exposez uniquement le frontend (port 8000) et l’API (port 6000) via un pare-feu ou un reverse-proxy (Caddy, Nginx, Traefik). Postgres doit rester privé, le port 5000 ne devrait être ouvert que si nécessaire.
- Pointez vos DNS (ex : `app.example.com`, `api.example.com`) vers votre VPS et mettez à jour `SERVER_URL`, `FRONTEND_URL`, `CORS_URLS` et `WS_URL` en conséquence dans `docker.env`.
- Pour des certificats HTTPS, placez un reverse-proxy (Traefik, Caddy, Nginx) devant les deux services ou utilisez une stack type `docker compose -f docker-compose.yml -f docker-compose.prod.yml` intégrant le proxy.
