// types.ts

// --- Utilisateur ---
export interface User {
    id: number;
    nom: string;
    prenom: string;
    username: string;
    email: string;
    password: string;
    is_active: boolean;
    city: string;
    country: string;
    languages: string;
    birthdate: string;
    registration_ip: string;
  }
  
  // --- Bullet & GameState ---
  export interface Bullet {
    x: number;
    y: number;
    side: "left" | "right";
  }
  
  export interface GameState {
    leftY: number;
    rightY: number;
    bullets: Bullet[];
    livesLeft: number;
    livesRight: number;
    names: { left: string; right: string };
  }
  
  // --- Partie multijoueur ---
  export interface Game {
    rematch: any;
    left: WebSocket;
    right: WebSocket;
    state: GameState;
  }
  export type WSMessage =
  | { type: "join";  token: string }
  | { type: "move";  position: number }
  | { type: "shoot" }
  | { type: "ping" }
  | { type: "pong" };
