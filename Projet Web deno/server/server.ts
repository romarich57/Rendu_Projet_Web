// server.ts

// -------------------------------------------------------------------
// 0) Chargement des vars d’env (doit venir avant tout appel à Deno.env)
// -------------------------------------------------------------------
import "https://deno.land/x/dotenv@v3.2.0/load.ts";

// -------------------------------------------------------------------
// 1) Imports
// -------------------------------------------------------------------
import { Application, Context, Middleware } from "https://deno.land/x/oak@v12.5.0/mod.ts";
import { send }                 from "https://deno.land/x/oak@v12.5.0/send.ts";
import router                   from "./routes.ts";
import pool, { initDatabase }   from "./db.ts";
import { handleGuerreWebSocket } from "./websocket.ts";
import { hash }                  from "https://deno.land/x/bcrypt@v0.4.0/mod.ts";
import {
  adminRateLimiter,
  applyCorsHeaders,
  corsMiddleware,
  createForceHttpsMiddleware,
  createHstsMiddleware,
} from "./middlewares.ts";
import { Session }               from "https://deno.land/x/oak_sessions@v4.0.0/mod.ts";
// -------------------------------------------------------------------
// 2) Initialisation BDD + seed admin
// -------------------------------------------------------------------
await initDatabase();

// Seed de l’utilisateur admin depuis .env
const ADMIN_USER = Deno.env.get("ADMIN_USER");
const ADMIN_PASS = Deno.env.get("ADMIN_PASS");
if (ADMIN_USER && ADMIN_PASS) {
  // Génération du hash du mot de passe admin
  const pwdHash = await hash(ADMIN_PASS);
  const client = await pool.connect();
  try {
    await client.queryObject(
      `INSERT INTO admin_users (username, password_hash)
         VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [ADMIN_USER, pwdHash]
    );
    console.log("✅ Admin seedé");
  } catch (err) {
    console.error("❌ Échec du seed admin :", err);
  } finally {
    client.release();
  }
}

// -------------------------------------------------------------------
// 3) Création de l’app
// -------------------------------------------------------------------
const app = new Application();
const PORT = parseInt(Deno.env.get("PORT") ?? "3000", 10);
const FORCE_HTTPS = (Deno.env.get("FORCE_HTTPS") ?? "").toLowerCase() === "true";
const ENABLE_HSTS = (
  Deno.env.get("ENABLE_HSTS") ??
  (FORCE_HTTPS ? "true" : "false")
).toLowerCase() === "true";
const HSTS_MAX_AGE = parseInt(Deno.env.get("HSTS_MAX_AGE") ?? "63072000", 10);
const HSTS_INCLUDE_SUBDOMAINS =
  (Deno.env.get("HSTS_INCLUDE_SUBDOMAINS") ?? "true").toLowerCase() === "true";
const HSTS_PRELOAD = (Deno.env.get("HSTS_PRELOAD") ?? "false").toLowerCase() === "true";

const forceHttpsMiddleware = createForceHttpsMiddleware(FORCE_HTTPS);
const hstsMiddleware = createHstsMiddleware(ENABLE_HSTS, {
  maxAge: HSTS_MAX_AGE,
  includeSubDomains: HSTS_INCLUDE_SUBDOMAINS,
  preload: HSTS_PRELOAD,
});

// -------------------------------------------------------------------
// 4) CORS (premier middleware)
// -------------------------------------------------------------------
app.use(forceHttpsMiddleware);
app.use(corsMiddleware);

// -------------------------------------------------------------------
// 5) Gestion globale des erreurs
// -------------------------------------------------------------------
app.use(async (ctx: Context, next) => {
  try {
    await next();
  } catch (err: unknown) {
    console.error("Unhandled error:", err);
    const status = typeof err === "object" && err && "status" in err
      ? Number((err as Record<string, unknown>).status) || 500
      : 500;
    const message = err instanceof Error ? err.message : "Erreur serveur";
    ctx.response.status = status;
    ctx.response.body = { error: message };
    applyCorsHeaders(ctx.response.headers, ctx.request.headers.get("Origin"));
  }
});

// -------------------------------------------------------------------
// 6) Strict-Transport-Security (après gestion des erreurs)
// -------------------------------------------------------------------
app.use(hstsMiddleware);

// -------------------------------------------------------------------
// 7) Redirection racine vers login
// -------------------------------------------------------------------
app.use(async (ctx: Context, next) => {
  if (ctx.request.method === "GET") {
    const path = ctx.request.url.pathname;
    if (path === "/" || path === "/index.html") {
      await send(ctx, "/auth/login/login.html", {
        root: `${Deno.cwd()}/frontend`,
      });
      return;
    }
  }
  await next();
});

// -------------------------------------------------------------------
// 8) Content-Security-Policy
// -------------------------------------------------------------------
app.use((ctx: Context, next) => {
  ctx.response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src  'self'",
      "style-src   'self'",
      "img-src     'self' data:",
      "connect-src 'self' " + Deno.env.get("WS_URL"),
    ].join("; ")
  );
  return next();
});

// -------------------------------------------------------------------
// 9) Service des fichiers statiques
// -------------------------------------------------------------------
app.use(async (ctx: Context, next) => {
  const path = ctx.request.url.pathname;
  if (
    ctx.request.method === "GET" &&
    (
      path.startsWith("/auth/") ||
      path.startsWith("/compteutilisateur/") ||
      path.startsWith("/shared/") ||
      path.startsWith("/assets/")  ||
      path.startsWith("/admin/")   ||
      path === "/favicon.ico"
    )
  ) {
    await send(ctx, path, {
      root:  `${Deno.cwd()}/frontend`,
      index: "index.html",
    });
  } else {
    await next();
  }
});

// -------------------------------------------------------------------
// 10) Sessions (oak_sessions)
// -------------------------------------------------------------------
app.use(Session.initMiddleware() as unknown as Middleware);

// -------------------------------------------------------------------
// 11) WebSocket upgrade (/ws/guerre)
// -------------------------------------------------------------------
app.use(async (ctx: Context, next) => {
  console.log("Request received : " + ctx.request.url.pathname);
  console.log("Headers: " + Array.from(ctx.request.headers.entries()));
  if (ctx.request.url.pathname === "/ws/guerre") {
    if (!ctx.isUpgradable) {
      console.log("WebSocket upgrade required.");
      ctx.response.status = 400;
      ctx.response.body   = "WebSocket upgrade required.";
      return;
    }
    console.log("WebSocket executing upgrade required.");
    const ws = ctx.upgrade();
    console.log("WebSocket upgrade successful.");
    handleGuerreWebSocket(ws);
  } else {
    await next();
  }
});

// -------------------------------------------------------------------
// 12) Rate-limiter admin/login
// -------------------------------------------------------------------
app.use(adminRateLimiter);

// -------------------------------------------------------------------
// 13) Routes API
// -------------------------------------------------------------------
app.use(router.routes());
app.use(router.allowedMethods());

// -------------------------------------------------------------------
// 14) Démarrage du serveur
// -------------------------------------------------------------------
const protocolHint = FORCE_HTTPS ? "https" : "http";
console.log(`🚀 Serveur démarré sur ${protocolHint}://localhost:${PORT}`);
await app.listen({ port: PORT });
