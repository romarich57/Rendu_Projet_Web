// websocket.ts
import jwt from "npm:jsonwebtoken";
import pool from "./db.ts";

// Constants
const API_URL = Deno.env.get("API_URL") ?? "http://localhost:3000";
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;
const windowWidth = 1500;
const SHIP_HEIGHT = 50;
const BULLET_HEIGHT = 50;
const SHIP_OFFSET = 75;
const BULLET_SPEED = 15;
const SHOOT_COOLDOWN = 500; // ms entre tirs

// Structure pour suivre les connexions
interface Player {
  ws: WebSocket;
  name: string | null;
  position: number;
  lives: number;
  lastActivity: number;
}

// État des parties
interface GameState {
  leftY: number;
  rightY: number;
  livesLeft: number;
  livesRight: number;
  bullets: Array<{
    x: number;
    y: number;
    side: 'left' | 'right';
    id: string;
  }>;
  names: {
    left: string;
    right: string;
  };
}

// Map pour stocker les connexions des joueurs
const connections = new Map<string, Player>();
const rooms = new Map<string, Set<string>>();
const gameStates = new Map<string, GameState>();
const MAX_PLAYERS_PER_ROOM = 2;

// Variable to store the heartbeat timer interval
let heartbeatTimerId: number | null = null;

// Fonction pour générer un ID unique
function generateId(): string {
  return crypto.randomUUID();
}

// Safe send wrapper to avoid readyState issues
function safeSend(ws: WebSocket, data: any) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    } catch (error) {
      console.error("[WebSocket] Error sending message:", error);
    }
  }
}

// Fonction qui cherche ou crée une room avec de la place
function findRoomWithSpaceFor(name: string): string | null {
  for (const [roomId, players] of rooms.entries()) {
    if (players.size < MAX_PLAYERS_PER_ROOM) {
      // skip any room where this name already exists
      const names = Array.from(players)
        .map(id => connections.get(id)?.name)
        .filter(n => !!n) as string[];
      if (!names.includes(name)) {
        return roomId;
      }
    }
  }
  return null;
}

// Crée une nouvelle room
function createRoom(): string {
  const roomId = generateId();
  rooms.set(roomId, new Set());
  return roomId;
}

// Ajoute un joueur à une room
function addPlayerToRoom(connectionId: string, roomId: string) {
  const roomPlayers = rooms.get(roomId);
  if (roomPlayers) {
    roomPlayers.add(connectionId);
  }
}

// Retire un joueur d'une room
function removePlayerFromRoom(connectionId: string, roomId: string) {
  const roomPlayers = rooms.get(roomId);
  if (roomPlayers) {
    roomPlayers.delete(connectionId);
    
    // Si la room est vide, on la supprime
    if (roomPlayers.size === 0) {
      rooms.delete(roomId);
      gameStates.delete(roomId);
    }
  }
}

// Trouve la room d'un joueur
function findPlayerRoom(connectionId: string): string | null {
  for (const [roomId, players] of rooms.entries()) {
    if (players.has(connectionId)) {
      return roomId;
    }
  }
  return null;
}

// Envoie un message à tous les joueurs d'une room
function broadcastToRoom(roomId: string, message: any) {
  const roomPlayers = rooms.get(roomId);
  if (!roomPlayers) return;
  
  const messageStr = JSON.stringify(message);
  
  roomPlayers.forEach(playerId => {
    const player = connections.get(playerId);
    if (player && player.ws.readyState === WebSocket.OPEN) {
      try {
        player.ws.send(messageStr);
      } catch (error) {
        console.error(`[WebSocket] Erreur d'envoi à ${playerId}:`, error);
      }
    }
  });
}

// Notifie tous les joueurs de l'état actuel de la room
function notifyRoomState(roomId: string) {
  const roomPlayers = rooms.get(roomId);
  if (!roomPlayers) return;
  
  const playerDetails = Array.from(roomPlayers).map(id => {
    const player = connections.get(id);
    return {
      id,
      name: player?.name || "Anonyme",
      position: player?.position || 0,
      lives: player?.lives || 3
    };
  });
  
  broadcastToRoom(roomId, {
    type: 'roomUpdate',
    players: playerDetails,
    ready: roomPlayers.size === MAX_PLAYERS_PER_ROOM
  });
}

// Start the heartbeat timer
function startHeartbeatTimer() {
  // Only start if not already started
  if (heartbeatTimerId === null) {
    heartbeatTimerId = setInterval(() => {
      const now = Date.now();
      const timeoutThreshold = 30000; // 30 secondes
      
      connections.forEach((player, id) => {
        if (now - player.lastActivity > timeoutThreshold) {
          console.log(`[WebSocket] Timeout pour ${id}`);
          try {
            player.ws.close(1000, "Timeout");
          } catch (error) {
            console.error(`[WebSocket] Erreur lors de la fermeture par timeout:`, error);
          }
          handlePlayerDisconnect(id);
        }
      });
    }, 10000); // Vérifier toutes les 10 secondes
  }
}

// Fonction pour gérer l'arrivée d'un joueur
function handleJoin(connectionId: string, name: string) {
  const player = connections.get(connectionId);
  if (!player) return;
  
  player.name = name;
  console.log(`[WebSocket] Joueur ${name} (${connectionId}) a rejoint`);

  // find a room where no one has this name
  let roomId = findRoomWithSpaceFor(name);
  if (!roomId) {
    roomId = createRoom();
    console.log(`[WebSocket] Nouvelle room créée: ${roomId}`);
  }
  addPlayerToRoom(connectionId, roomId);
  checkRoomAndStartGame(roomId);
}

// Réserve une room quel que soit le nom
function findRoomWithSpace(): string | null {
  for (const [roomId, players] of rooms.entries()) {
    if (players.size < MAX_PLAYERS_PER_ROOM) {
      return roomId;
    }
  }
  return null;
}

// Relaxed join: try maintaining name uniqueness first, only ignore if necessary
function handleJoinRelaxed(connectionId: string, name: string) {
  const player = connections.get(connectionId);
  if (!player) return;
  player.name = name;
  
  // First try with name uniqueness (better experience)
  let roomId = findRoomWithSpaceFor(name);
  
  // If we couldn't find a room respecting name uniqueness,
  // only then fall back to any available room
  if (!roomId) {
    roomId = findRoomWithSpace();
  }
  
  // If still no room, create a new one
  if (!roomId) {
    roomId = createRoom();
  }
  
  addPlayerToRoom(connectionId, roomId);
  checkRoomAndStartGame(roomId);
}

// Fonction pour vérifier si une room est pleine et démarrer le jeu
function checkRoomAndStartGame(roomId: string) {
  const roomPlayers = rooms.get(roomId);
  if (!roomPlayers || roomPlayers.size < MAX_PLAYERS_PER_ROOM) return;
  
  console.log(`[WebSocket] La room ${roomId} est pleine, démarrage du jeu`);
  
  // Convertir l'ensemble en tableau pour pouvoir indexer les joueurs
  const playerIds = Array.from(roomPlayers);
  
  // S'assurer que nous avons bien 2 joueurs distincts
  if (playerIds.length !== 2) {
    console.error("[WebSocket] Nombre incorrect de joueurs pour démarrer la partie");
    return;
  }
  
  const [idLeft, idRight] = playerIds;
  
  // Récupérer les objets Player pour chaque ID avec validation
  const playerLeft = connections.get(idLeft);
  const playerRight = connections.get(idRight);
  
  // Vérifier que les deux objets existent
  if (!playerLeft || !playerRight) {
    console.error("[WebSocket] Un ou plusieurs joueurs manquants");
    
    // Si un des joueurs n'existe pas, nettoyons la room
    rooms.delete(roomId);
    return;
  }
  
  // S'assurer que les noms existent
  const leftName = playerLeft.name || `Joueur ${idLeft.substring(0, 4)}`;
  const rightName = playerRight.name || `Joueur ${idRight.substring(0, 4)}`;
  
  // Change from const to let for variables that need to be reassigned
  let finalLeftName = leftName;
  let finalRightName = rightName;
  
  // Si par une malheureuse coïncidence les noms sont identiques, uniquement dans ce cas ajouter suffixe
  if (leftName === rightName) {
    console.log(`[WebSocket] Noms identiques détectés: ${leftName}, ajout de suffixes`);
    finalLeftName = `${leftName} (1)`;
    finalRightName = `${rightName} (2)`;
  }
  
  console.log(`[WebSocket] Démarrage du jeu entre ${finalLeftName} (gauche) et ${finalRightName} (droite)`);
  
  // Créer l'état initial du jeu
  const gameState: GameState = {
    leftY: 250,
    rightY: 250,
    livesLeft: 3,
    livesRight: 3,
    bullets: [],
    names: {
      left: finalLeftName,
      right: finalRightName
    }
  };
  
  gameStates.set(roomId, gameState);
  safeSend(connections.get(idLeft)!.ws,  { type:"matchFound", side:"left",  names: gameState.names });
  safeSend(connections.get(idRight)!.ws, { type:"matchFound", side:"right", names: gameState.names });
  startGameLoop(roomId);
}

// Boucle de jeu pour mettre à jour et envoyer régulièrement l'état du jeu
function startGameLoop(roomId: string) {
  const gameState = gameStates.get(roomId);
  if (!gameState) return;
  
  const intervalId = setInterval(() => {
    const roomPlayers = rooms.get(roomId);
    // Si la room n'existe plus, arrêter la boucle de jeu
    if (!roomPlayers || roomPlayers.size < MAX_PLAYERS_PER_ROOM) {
      clearInterval(intervalId);
      return;
    }
    
    // Mise à jour des positions des balles, collisions, etc.
    updateGameState(roomId);
    
    // Envoi de l'état du jeu mis à jour aux joueurs
    broadcastGameState(roomId);
    
    // Vérifier si le jeu est terminé
    if (gameState.livesLeft <= 0 || gameState.livesRight <= 0) {
      // Déterminer le gagnant
      const winner = gameState.livesLeft <= 0 ? "right" : "left";
      const winnerName = winner === "left" ? gameState.names.left : gameState.names.right;
      
      // Informer les joueurs de la fin du jeu avec le vrai nom du joueur
      roomPlayers.forEach(playerId => {
        const player = connections.get(playerId);
        if (player) {
          safeSend(player.ws, {
            type: "gameOver",
            winner: winnerName
          });
        }
      });
      
      // Arrêter la boucle de jeu
      clearInterval(intervalId);
      
      // Nettoyer l'état de la partie pour permettre une nouvelle partie
      gameStates.delete(roomId);
    }
  }, 33); // ~30 FPS
}

// Fonction pour mettre à jour l'état du jeu
function updateGameState(roomId: string) {
  const gameState = gameStates.get(roomId);
  if (!gameState) return;
  
  // Mise à jour de la position des balles
  for (let i = gameState.bullets.length - 1; i >= 0; i--) {
    const bullet = gameState.bullets[i];
    
    // Déplacement de la balle
    if (bullet.side === "left") {
      bullet.x += BULLET_SPEED;
    } else {
      bullet.x -= BULLET_SPEED;
    }
    
    // Vérifier si la balle sort de l'écran
    if (bullet.x < 0 || bullet.x > windowWidth) {
      gameState.bullets.splice(i, 1);
      continue;
    }
    
    // Vérifier les collisions avec les vaisseaux
    if (bullet.side === "left" && 
        bullet.x > windowWidth - SHIP_OFFSET - SHIP_HEIGHT &&
        Math.abs(bullet.y - gameState.rightY) < SHIP_HEIGHT) {
      // Collision avec le vaisseau de droite
      gameState.livesRight--;
      gameState.bullets.splice(i, 1);
    } else if (bullet.side === "right" && 
               bullet.x < SHIP_OFFSET + SHIP_HEIGHT &&
               Math.abs(bullet.y - gameState.leftY) < SHIP_HEIGHT) {
      // Collision avec le vaisseau de gauche
      gameState.livesLeft--;
      gameState.bullets.splice(i, 1);
    }
  }
}

// Fonction pour envoyer l'état du jeu aux joueurs
function broadcastGameState(roomId: string) {
  const roomPlayers = rooms.get(roomId);
  const gameState = gameStates.get(roomId);
  if (!roomPlayers || !gameState) return;
  
  roomPlayers.forEach(playerId => {
    const player = connections.get(playerId);
    if (player) {
      safeSend(player.ws, {
        type: "updateState",
        state: gameState
      });
    }
  });
}

// Fonction pour gérer le mouvement d'un joueur
function handleMove(connectionId: string, position: number) {
  const player = connections.get(connectionId);
  if (!player) return;
  
  player.position = position;
  
  // Trouver la room du joueur
  const roomId = findPlayerRoom(connectionId);
  if (!roomId) return;
  
  // Mettre à jour l'état du jeu
  const gameState = gameStates.get(roomId);
  if (!gameState) return;
  
  // Déterminer si le joueur est à gauche ou à droite
  const isLeft = Array.from(rooms.get(roomId) || []).indexOf(connectionId) === 0;
  
  if (isLeft) {
    gameState.leftY = position;
  } else {
    gameState.rightY = position;
  }
}

// Fonction pour gérer un tir
function handleShoot(connectionId: string) {
  const player = connections.get(connectionId);
  if (!player) return;
  
  // Trouver la room du joueur
  const roomId = findPlayerRoom(connectionId);
  if (!roomId) return;
  
  // Mettre à jour l'état du jeu
  const gameState = gameStates.get(roomId);
  if (!gameState) return;
  
  // Déterminer si le joueur est à gauche ou à droite
  const isLeft = Array.from(rooms.get(roomId) || []).indexOf(connectionId) === 0;
  const side = isLeft ? "left" : "right";
  
  // Ajouter une balle
  const bulletX = isLeft ? SHIP_OFFSET + SHIP_HEIGHT : windowWidth - SHIP_OFFSET - SHIP_HEIGHT;
  const bulletY = isLeft ? gameState.leftY : gameState.rightY;
  
  gameState.bullets.push({
    x: bulletX,
    y: bulletY,
    side,
    id: generateId()
  });
}

// Fonction pour gérer la déconnexion d'un joueur
function handlePlayerDisconnect(connectionId: string) {
  const roomId = findPlayerRoom(connectionId);
  if (roomId) {
    // Avant de nettoyer la salle, enregistrons le nom du joueur qui se déconnecte pour debug
    const player = connections.get(connectionId);
    console.log(`[WebSocket] Déconnexion du joueur: ${player?.name || 'inconnu'} (${connectionId})`);
    
    // remove from room
    removePlayerFromRoom(connectionId, roomId);
    // inform remaining
    const remaining = rooms.get(roomId);
    if (remaining && remaining.size > 0) {
      remaining.forEach(pid => {
        const p = connections.get(pid);
        if (p) safeSend(p.ws, { type: "opponentDisconnected" });
      });
    }
    // always delete any gameState for this room
    gameStates.delete(roomId);
  }
  
  // Suppression complète de la connexion
  connections.delete(connectionId);
  console.log(`[WebSocket] Connexion supprimée: ${connectionId}`);
}

// Gestionnaire principal des WebSockets pour le jeu de guerre spatiale
export function handleGuerreWebSocket(ws: WebSocket) {
  const connectionId = generateId();
  
  // Initialiser le joueur avec ses valeurs par défaut
  const player: Player = {
    ws,
    name: null,
    position: 0,
    lives: 3,
    lastActivity: Date.now()
  };
  
  connections.set(connectionId, player);
  
  console.log(`[WebSocket] Nouvelle connexion: ${connectionId}`);
  
  // Envoyer au client son identifiant (seulement une fois que la connexion est établie)
  if (ws.readyState === WebSocket.OPEN) {
    safeSend(ws, {
      type: 'connected',
      id: connectionId
    });
  }

  // Gestionnaire de messages
  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    player.lastActivity = Date.now();
    switch (msg.type) {
      case 'join':
       
        player.name = msg.name || "Joueur " + connectionId.substring(0, 4);
        console.log(`[WebSocket] Joueur rejoint avec le nom: ${player.name}`);
        handleJoin(connectionId, player.name);
        break;
      case 'joinRelaxed':
        // Same fix for relaxed join
        player.name = msg.name || "Joueur " + connectionId.substring(0, 4);
        console.log(`[WebSocket] Joueur (relaxed) rejoint avec le nom: ${player.name}`);
        handleJoinRelaxed(connectionId, player.name);
        break;
      case 'move':
        handleMove(connectionId, msg.position);
        break;
        
      case 'shoot':
        handleShoot(connectionId);
        break;
        
      case 'quit':
        handlePlayerDisconnect(connectionId);
        return ws.close();
        
      // Handle ping messages with a pong response
      case 'ping':
        safeSend(ws, { type:'pong', time:Date.now() });
        break;
        
      default:
        console.log(`[WebSocket] Message inconnu de ${connectionId}:`, msg);
    }
  };

  // Gestionnaire de déconnexion
  ws.onclose = () => {
    console.log(`[WebSocket] Déconnexion: ${connectionId}`);
    handlePlayerDisconnect(connectionId);
  };
  
  // Gestionnaire d'erreurs
  ws.onerror = (error) => {
    console.error(`[WebSocket] Erreur sur la connexion ${connectionId}:`, error);
    try {
      ws.close(); // Fermer proprement la connexion en cas d'erreur
    } catch (e) {
      console.error("Erreur lors de la fermeture du WebSocket:", e);
    }
  };
  
  // Mettre en place un heartbeat pour détecter les connexions zombies
  startHeartbeatTimer();
}


