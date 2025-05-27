// middlewares.ts

import { Context, Middleware } from "https://deno.land/x/oak@v12.5.0/mod.ts";
import jwt from "npm:jsonwebtoken";
import pool from "./db.ts";

// CORS
const ORIGIN = Deno.env.get("CORS_URL");
const CORS_HEADERS: Record<string,string> = {
  "Access-Control-Allow-Origin":      ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers":     "Content-Type, Authorization",
  "Access-Control-Allow-Methods":     "GET, POST, PUT, DELETE, OPTIONS",
};
export const corsMiddleware: Middleware = async (ctx, next) => {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    ctx.response.headers.set(key, value);
  }
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204;
    return;
  }
  await next();
};

// Content-Security-Policy
const CSP_HEADER =
  "default-src 'self'; " +
  "style-src 'self' https://www.gstatic.com; " +
  "script-src 'self';";
export const cspMiddleware: Middleware = async (ctx, next) => {
  ctx.response.headers.set("Content-Security-Policy", CSP_HEADER);
  await next();
};

//  Helper pour parser un JSON body 
export async function parseJsonBody(request: Request): Promise<any> {
  if (
    request.method !== "GET" &&
    request.headers.get("Content-Type")?.includes("application/json")
  ) {
    try {
      return await request.json();
    } catch {
      // corps JSON invalide → on retournera un objet vide
    }
  }
  return {};
}

// Récupère l’IP client
export function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for") ?? "unknown";
}

//  Brute-force protection helpers
interface AttemptData { count: number; blockedUntil: number; }
const loginAttempts: Record<string, AttemptData> = {};

export function checkBruteForce(ip: string, identifier: string): boolean {
  const key = `${ip}:${identifier}`.toLowerCase();
  if (!loginAttempts[key]) {
    loginAttempts[key] = { count: 0, blockedUntil: 0 };
  }
  return Date.now() >= loginAttempts[key].blockedUntil;
}

export function registerFailedAttempt(ip: string, identifier: string) {
  const key = `${ip}:${identifier}`.toLowerCase();
  const entry = loginAttempts[key] ||= { count: 0, blockedUntil: 0 };
  entry.count++;
  if (entry.count >= 5) {
    entry.blockedUntil = Date.now() + 15 * 60_000; // 15 minutes
  }
}

export function resetAttempts(ip: string, identifier: string) {
  const key = `${ip}:${identifier}`.toLowerCase();
  loginAttempts[key] = { count: 0, blockedUntil: 0 };
}

// 🔑 Vérification JWT + extraction payload
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;
export function verifyJWT(request: Request): any {
  const header = request.headers.get("Authorization") ?? "";
  const token  = header.replace(/^Bearer\s+/, "");
  if (!token) {
    const err = new Error("Missing Authorization");
    (err as any).status = 401;
    throw err;
  }
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    const err = new Error("Invalid or expired token");
    (err as any).status = 401;
    throw err;
  }
}

//  Rate‐limiter pour /api/admin/login (3 essais / 5 min)
const attempts = new Map<string, { count: number; first: number }>();

export const adminRateLimiter: Middleware = async (ctx, next) => {
  if (ctx.request.url.pathname === "/api/admin/login") {
    const ip = ctx.request.ip;
    const now = Date.now();
    const entry = attempts.get(ip) || { count: 0, first: now };
    if (now - entry.first > 5 * 60_000) {
      entry.count = 0;
      entry.first = now;
    }
    entry.count++;
    attempts.set(ip, entry);
    if (entry.count > 3) {
      ctx.response.status = 429;
      ctx.response.body   = { error: "Trop de tentatives, réessayez dans 5 minutes." };
      return;
    }
  }
  await next();
};


//  Middleware d’authentification Oak
export const authMiddleware: Middleware = async (ctx: Context, next) => {
  try {
    // Try JWT from Authorization header
    const authHeader = ctx.request.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/, "");
    if (token) {
      const payload = jwt.verify(token, JWT_SECRET);
      ctx.state.userId = (payload as any).userId;
    } else {
      // Fallback to session cookie
      const sessionId = await ctx.cookies.get("sessionId");
      if (!sessionId) {
        const err = new Error("Unauthorized");
        (err as any).status = 401;
        throw err;
      }
      const client = await pool.connect();
      try {
        const res = await client.queryObject<{ user_id: number }>(
          "SELECT user_id FROM sessions WHERE id=$1",
          [sessionId]
        );
        if (res.rows.length === 0) {
          const err = new Error("Invalid session");
          (err as any).status = 401;
          throw err;
        }
        ctx.state.userId = res.rows[0].user_id;
      } finally {
        client.release();
      }
    }
    await next();
  } catch (err) {
    ctx.response.status = (err as any).status || 401;
    ctx.response.body = { error: err.message };
  }
};
