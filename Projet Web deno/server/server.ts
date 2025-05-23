// server.ts

// -------------------------------------------------------------------
// 0) Chargement des vars d’env (doit venir avant tout appel à Deno.env)
// -------------------------------------------------------------------
import "https://deno.land/x/dotenv@v3.2.0/load.ts";

// -------------------------------------------------------------------
// 1) Imports
// -------------------------------------------------------------------
import { Application, Context } from "https://deno.land/x/oak@v12.5.0/mod.ts";
import { oakCors }              from "https://deno.land/x/cors@v1.2.0/mod.ts";
import { send }                 from "https://deno.land/x/oak@v12.5.0/send.ts";
import router                   from "./routes.ts";
import pool, { initDatabase }   from "./db.ts";
import { handleGuerreWebSocket } from "./websocket.ts";
import { hash }                  from "https://deno.land/x/bcrypt@v0.4.0/mod.ts";
import { adminRateLimiter }      from "./middlewares.ts";
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
const PORT = parseInt(Deno.env.get("PORT") ?? "443", 10);

const CORS_URL = Deno.env.get("CORS_URL") ?? "https://rom-space-game.realdev.cloud";
console.log("Cors URL : " + CORS_URL);
// -------------------------------------------------------------------
// 4) CORS (premier middleware)
// -------------------------------------------------------------------
app.use(oakCors({
  origin:        Deno.env.get("CORS_URL"),
  credentials:   true,
  allowedHeaders:["Content-Type","Authorization"],
  methods:       ["GET","POST","PUT","DELETE","OPTIONS"]
}));

// -------------------------------------------------------------------
// 5) Gestion globale des erreurs
// -------------------------------------------------------------------
app.use(async (ctx: Context, next) => {
  try {
    await next();
  } catch (err) {
    console.error("Unhandled error:", err);
    ctx.response.status = err.status || 500;
    ctx.response.body   = { error: err.message };
    ctx.response.headers.set("Access-Control-Allow-Origin", Deno.env.get("CORS_URL"));
  }
});

// -------------------------------------------------------------------
// 6) Content-Security-Policy
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
// 7) Service des fichiers statiques
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
// 8) Sessions (oak_sessions)
// -------------------------------------------------------------------
app.use(Session.initMiddleware());

// -------------------------------------------------------------------
// 9) WebSocket upgrade (/ws/guerre)
// -------------------------------------------------------------------
app.use(async (ctx: Context, next) => {
  console.log("Request received : " + ctx.request.url.pathname);
  if (ctx.request.url.pathname === "/ws/guerre") {
    if (!ctx.isUpgradable) {
      console.log("WebSocket upgrade required.");
      ctx.response.status = 400;
      ctx.response.body   = "WebSocket upgrade required.";
      return;
    }
    console.log("WebSocket upgrade required.");
    const ws = await ctx.upgrade();
    console.log("WebSocket upgrade successful.");
    handleGuerreWebSocket(ws);
  } else {
    await next();
  }
});

// -------------------------------------------------------------------
// 10) Rate-limiter admin/login
// -------------------------------------------------------------------
app.use(adminRateLimiter);

// -------------------------------------------------------------------
// 11) Routes API
// -------------------------------------------------------------------
app.use(router.routes());
app.use(router.allowedMethods());

// -------------------------------------------------------------------
// 12) Démarrage du serveur
// -------------------------------------------------------------------
console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
await app.listen({ port: PORT });
