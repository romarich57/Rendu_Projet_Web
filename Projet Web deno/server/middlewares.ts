// middlewares.ts

import { Context, Middleware } from "https://deno.land/x/oak@v12.5.0/mod.ts";
import jwt from "npm:jsonwebtoken";
import pool from "./db.ts";
import { JWT_SECRET } from "./config.ts";

const ALLOW_HEADERS = "Content-Type, Authorization";
const ALLOW_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
const HTTPS_PROTO_HEADER_KEYS = [
  "x-forwarded-proto",
  "x-forwarded-protocol",
  "x-forwarded-scheme",
];
const HTTPS_FLAG_HEADERS = ["front-end-https"];

function normalizeOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return origin.replace(/\/$/, "");
  }
}

const envOrigins = (Deno.env.get("CORS_URLS") ?? Deno.env.get("CORS_URL") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map(normalizeOrigin);

const DEFAULT_ALLOWED_ORIGINS = [
  "https://rom-space-game.realdev.cloud",
  "https://api.rom-space-game.realdev.cloud",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
].map(normalizeOrigin);

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);
const ALLOWED_ORIGINS = Array.from(new Set([...envOrigins, ...DEFAULT_ALLOWED_ORIGINS]));
const FALLBACK_ORIGIN = ALLOWED_ORIGINS[0] ?? "http://localhost:3000";

function resolveAllowedOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) {
    return FALLBACK_ORIGIN;
  }
  const normalized = normalizeOrigin(requestOrigin);
  if (ALLOWED_ORIGINS.includes(normalized)) {
    return normalized;
  }
  try {
    const url = new URL(requestOrigin);
    if (LOCAL_HOSTNAMES.has(url.hostname)) {
      return `${url.protocol}//${url.host}`;
    }
  } catch {
    // ignore invalid origin values
  }
  return null;
}

function ensureVaryOrigin(headers: Headers) {
  const current = headers.get("Vary");
  if (!current) {
    headers.set("Vary", "Origin");
    return;
  }
  const parts = current.split(/,\s*/);
  if (!parts.includes("Origin")) {
    headers.set("Vary", `${current}, Origin`);
  }
}

export function applyCorsHeaders(headers: Headers, requestOrigin: string | null) {
  const allowedOrigin = resolveAllowedOrigin(requestOrigin);
  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Headers", ALLOW_HEADERS);
  headers.set("Access-Control-Allow-Methods", ALLOW_METHODS);
  ensureVaryOrigin(headers);
}

export function withCORS(response: Response, requestOrigin?: string | null): Response {
  applyCorsHeaders(response.headers, requestOrigin ?? null);
  return response;
}

export const corsMiddleware: Middleware = async (ctx, next) => {
  const origin = ctx.request.headers.get("Origin");
  if (ctx.request.method === "OPTIONS") {
    const allowed = resolveAllowedOrigin(origin);
    if (!allowed) {
      ctx.response.status = 403;
      ctx.response.body = { error: "Origin not allowed" };
      return;
    }
    applyCorsHeaders(ctx.response.headers, origin);
    ctx.response.status = 204;
    return;
  }
  await next();
  applyCorsHeaders(ctx.response.headers, origin);
};

// Content-Security-Policy
const CSP_HEADER =
  "default-src 'self'; " +
  "style-src 'self' 'unsafe-inline' https://www.gstatic.com; " +
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
      // Corps JSON invalide → on retournera un objet vide
    }
  }
  return {};
}

// Récupère l’IP client
export function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for") ?? "unknown";
}

function isForwardedHttps(headers: Headers): boolean {
  for (const key of HTTPS_PROTO_HEADER_KEYS) {
    const value = headers.get(key);
    if (value && value.split(",")[0].trim().toLowerCase() === "https") {
      return true;
    }
  }
  for (const key of HTTPS_FLAG_HEADERS) {
    if ((headers.get(key) ?? "").toLowerCase() === "on") {
      return true;
    }
  }
  return false;
}

function isSecureRequest(ctx: Context): boolean {
  const requestAny = ctx.request as Request & { secure?: boolean };
  if (requestAny.secure === true) {
    return true;
  }
  if (ctx.request.url.protocol === "https:") {
    return true;
  }
  return isForwardedHttps(ctx.request.headers);
}

export function createForceHttpsMiddleware(
  enabled: boolean,
  status = 308,
): Middleware {
  if (!enabled) {
    return async (_ctx, next) => {
      await next();
    };
  }
  return async (ctx, next) => {
    if (isSecureRequest(ctx)) {
      await next();
      return;
    }
    const redirectUrl = new URL(ctx.request.url);
    redirectUrl.protocol = "https:";
    const forwardedHost = ctx.request.headers.get("x-forwarded-host");
    if (forwardedHost) {
      redirectUrl.host = forwardedHost.split(",")[0].trim();
    }
    ctx.response.status = status;
    ctx.response.headers.set("Location", redirectUrl.toString());
  };
}

interface HstsOptions {
  maxAge?: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

export function createHstsMiddleware(
  enabled: boolean,
  options: HstsOptions = {},
): Middleware {
  if (!enabled) {
    return async (_ctx, next) => {
      await next();
    };
  }
  const {
    maxAge = 63_072_000, // 2 ans
    includeSubDomains = true,
    preload = false,
  } = options;
  const directives = [`max-age=${Math.max(0, maxAge)}`];
  if (includeSubDomains) directives.push("includeSubDomains");
  if (preload) directives.push("preload");
  const headerValue = directives.join("; ");
  return async (ctx, next) => {
    try {
      await next();
    } finally {
      if (isSecureRequest(ctx)) {
        ctx.response.headers.set("Strict-Transport-Security", headerValue);
      }
    }
  };
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
export function verifyJWT(request: Request): any {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/, "");
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
      ctx.response.body = { error: "Trop de tentatives, réessayez dans 5 minutes." };
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
  } catch (err: unknown) {
    const status = typeof err === "object" && err && "status" in err
      ? Number((err as Record<string, unknown>).status) || 401
      : 401;
    const message = err instanceof Error ? err.message : "Unauthorized";
    ctx.response.status = status;
    ctx.response.body = { error: message };
  }
};

const ADMIN_SESSION_COOKIE = "adminSessionId";
const ADMIN_SESSION_TTL_MS = 2 * 60 * 60_000;
const adminSessions = new Map<string, { username: string; expiresAt: number }>();

export async function establishAdminSession(ctx: Context, username: string) {
  const token = crypto.randomUUID();
  adminSessions.set(token, { username, expiresAt: Date.now() + ADMIN_SESSION_TTL_MS });
  const secure = ctx.request.secure ?? ctx.request.url.protocol === "https:";
  const expires = new Date(Date.now() + ADMIN_SESSION_TTL_MS);
  await ctx.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires,
  });
}

export const authAdmin: Middleware = async (ctx, next) => {
  const token = await ctx.cookies.get(ADMIN_SESSION_COOKIE);
  if (!token) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Admin session missing" };
    return;
  }
  const session = adminSessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    adminSessions.delete(token);
    ctx.response.status = 401;
    ctx.response.body = { error: "Admin session expired" };
    return;
  }
  session.expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  ctx.state.adminUser = session.username;
  await next();
};
