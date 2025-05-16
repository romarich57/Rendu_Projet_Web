// =====================
// websocket.ts
// =====================
import jwt from "npm:jsonwebtoken";
import { Game, WSMessage, GameState, Bullet } from "./types.ts";
import pool from "./db.ts";
// URL de l’API pour les appels internes (default localhost:3000)
const API_URL = Deno.env.get("API_URL") ?? "http://localhost:3000";
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;
const windowWidth = 1500;
const SHIP_HEIGHT = 50;
const BULLET_HEIGHT = 50;
const SHIP_OFFSET = 75;
const BULLET_SPEED = 15;
const SHOOT_COOLDOWN = 500; // ms entre tirs

const lastShoot = new Map<WebSocket, number>();
let waitingPlayer: WebSocket | null = null;
const games: Game[] = [];

function safeSend(ws: WebSocket, data: string) {
  if (ws.readyState === WebSocket.OPEN) {
    try { ws.send(data); } catch {}
  }
}

export function handleGuerreWebSocket(ws: WebSocket) {
  ws.onmessage = ({ data }) => {
    if (typeof data !== "string") return;
    let msg: WSMessage;
    try { msg = JSON.parse(data); } catch { return; }
    onMessage(ws, msg);
  };
  ws.onclose = () => onClose(ws);
  ws.onerror = (e) => {
    const err = (e as ErrorEvent).error;
    if (!(err instanceof Error && err.message === "Unexpected EOF")) {
      console.error("WS Error:", e);
    }
  };
}

async function onMessage(ws: WebSocket, msg: WSMessage) {
  switch (msg.type) {
    case "join":
      return handleJoin(ws);
    case "move":
      return updatePosition(ws, msg.position);
    case "shoot":
      return addBullet(ws);
  }
}

async function handleJoin(ws: WebSocket) {
  // On a déjà ws.userId via le middleware
  const userId = (ws as any).userId as number;
  const client = await pool.connect();
  let username: string;
  try {
    const res = await client.queryObject<{ username: string }>(
      "SELECT username FROM users WHERE id=$1",
      [userId],
    );
    if (!res.rows.length) {
      ws.close(1000, "Utilisateur inconnu");
      return;
    }
    username = res.rows[0].username;
  } finally {
    client.release();
  }
  // On attache le vrai username
  (ws as any).username = username;

  // Matchmaking
  if (!waitingPlayer || waitingPlayer.readyState !== WebSocket.OPEN) {
    waitingPlayer = ws;
  } else if (waitingPlayer === ws) {
    // Already waiting; do nothing.
    return;
  } else {
    createGame(waitingPlayer, ws);
    waitingPlayer = null;
  }
}



function createGame(ws1: WebSocket, ws2: WebSocket) {
  const state: GameState = {
    leftY: 250,
    rightY: 250,
    bullets: [],
    livesLeft: 3,
    livesRight: 3,
    names: { left: (ws1 as any).username, right: (ws2 as any).username },
  };
  const game: Game = { left: ws1, right: ws2, state, rematch: null };
  games.push(game);

  [ws1, ws2].forEach((socket, i) =>
    safeSend(socket, JSON.stringify({
      type: "matchFound",
      side: i === 0 ? "left" : "right",
      names: state.names,
    }))
  );

  const intervalId = setInterval(() => {
    if (!games.includes(game)) return clearInterval(intervalId);
    tickGame(game);
  }, 50);

  (game as any).intervalId = intervalId;
}

function updatePosition(ws: WebSocket, pos: number) {
  const game = games.find((g) => g.left === ws || g.right === ws);
  if (!game) return;
  if (game.left === ws) game.state.leftY = pos;
  else game.state.rightY = pos;
  broadcast(game);
}

function addBullet(ws: WebSocket) {
  const now = Date.now();
  if (lastShoot.get(ws) && now - lastShoot.get(ws)! < SHOOT_COOLDOWN) return;
  lastShoot.set(ws, now);

  const game = games.find((g) => g.left === ws || g.right === ws);
  if (!game) return;

  const side = game.left === ws ? "left" : "right";
  const shipY = side === "left" ? game.state.leftY : game.state.rightY;
  const y = shipY + SHIP_HEIGHT / 2 - BULLET_HEIGHT / 2;
  const x = side === "left"
    ? SHIP_OFFSET + BULLET_HEIGHT
    : windowWidth - SHIP_OFFSET - BULLET_HEIGHT;

  game.state.bullets.push({ x, y, side });
  broadcast(game);
}

function tickGame(game: Game) {
  const st = game.state;
  const nextBullets: Bullet[] = [];

  for (const b of st.bullets) {
    // Mise à jour de la position de la balle
    b.x += b.side === "left" ? BULLET_SPEED : -BULLET_SPEED;

    const hitRight = (
      b.side === "left" &&
      b.x >= windowWidth - SHIP_OFFSET &&
      b.y >= st.rightY &&
      b.y <= st.rightY + SHIP_HEIGHT
    );

    const hitLeft = (
      b.side === "right" &&
      b.x <= SHIP_OFFSET &&
      b.y >= st.leftY &&
      b.y <= st.leftY + SHIP_HEIGHT
    );

    if (hitRight) {
      st.livesRight--;
      continue; // la balle disparaît après le hit
    } else if (hitLeft) {
      st.livesLeft--;
      continue; // la balle disparaît après le hit
    } else if (b.x > 0 && b.x < windowWidth) {
      nextBullets.push(b); // balle continue son chemin
    }
    // sinon balle disparait (hors écran)
  }

  st.bullets = nextBullets;

  if (st.livesLeft <= 0 || st.livesRight <= 0) {
    endGame(game);
  } else {
    broadcast(game);
  }
}

async function endGame(game: Game) {
  const winner = game.state.livesLeft <= 0 ? game.state.names.right : game.state.names.left;
  const loser = game.state.livesLeft <= 0 ? game.state.names.left : game.state.names.right;

  [game.left, game.right].forEach((s) =>
    safeSend(s, JSON.stringify({ type: "gameOver", winner }))
  );

  try {
    await fetch(`${API_URL}/api/update-elo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winner, loser }),
    });
  } catch (e) {
    console.error("Erreur update ELO:", e);
  }

  clearInterval((game as any).intervalId);
  games.splice(games.indexOf(game), 1);
}

function broadcast(game: Game) {
  const payload = JSON.stringify({ type: "updateState", state: game.state });
  safeSend(game.left, payload);
  safeSend(game.right, payload);
}

function onClose(ws: WebSocket) {
  if (waitingPlayer === ws) waitingPlayer = null;
  const game = games.find((g) => g.left === ws || g.right === ws);
  if (game) {
    const other = game.left === ws ? game.right : game.left;
    safeSend(other, JSON.stringify({ type: "gameOver", winner: (ws as any).username }));
    clearInterval((game as any).intervalId);
    games.splice(games.indexOf(game), 1);
  }
}
