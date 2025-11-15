// routes.ts
import { Router, Context } from "https://deno.land/x/oak@v12.5.0/mod.ts";

// Handlers
import {
  registerUser,
  forgotPassword,
  resetPassword,
  loginUser,
  activateAccount,
  updateElo,
  getLeaderboard,
  saveTetrisScore,
  getTetrisLeaderboard,
  saveSpaceScore,
  saveSpaceTelemetry,
  getSpaceLeaderboard,
  getTopScores,
  getTopXp,
  saveSnakeScore,
  getMaxNiveau,
  getSnakeLeaderboard,
  getUserProfile,
  updateUserProfile,
  getUserScores,
  getUserBestScores,
  loginAdmin,
  getUserScoresHandler,
  getAllUsersHandler,
  activateUserHandler,
  deleteUserHandler
} from "./handlers.ts";


// Middleware
import { applyCorsHeaders, authAdmin, authMiddleware } from "./middlewares.ts";

const router = new Router();

// ─── 1) RÉPONSE AUX PRÉ-VOLS CORS  ───────────────────────
// routes.ts
router.options("/(.*)", (ctx) => {
  applyCorsHeaders(ctx.response.headers, ctx.request.headers.get("Origin"));
  ctx.response.status = 204;
});


// ─── 2) Auth / registration ────────────────────────────────────────
// POST /api/register
router.post("/api/register", async (ctx: Context) => {
  const body = await ctx.request.body({ type: "json" }).value;
  console.log(body);
  const ip   = ctx.request.ip;
  const resp = await registerUser(body, ip);
  await applyResponse(ctx, resp);
  try { ctx.response.body = await resp.json(); }
  catch { ctx.response.body = await resp.text(); }
});

// POST /api/forgot-password
router.post("/api/forgot-password", async (ctx: Context) => {
  const body = await ctx.request.body({ type: "json" }).value;
  const resp = await forgotPassword(body);
  await applyResponse(ctx, resp);
  ctx.response.body = await resp.json();
});

// POST /api/reset-password
router.post("/api/reset-password", async (ctx: Context) => {
  const body = await ctx.request.body({ type: "json" }).value;
  const resp = await resetPassword(body);
  await applyResponse(ctx, resp);
  ctx.response.body = await resp.json();
});

// POST /api/login
router.post("/api/login", async (ctx: Context) => {
  const body = await ctx.request.body({ type: "json" }).value;
  const ip   = ctx.request.ip;
  const resp = await loginUser(body, ip);
  await applyResponse(ctx, resp);
  ctx.response.body = await resp.json();
});

async function activationHandler(ctx: Context) {
  const token = ctx.request.url.searchParams.get("token")!;
  const resp  = await activateAccount(token);
  await applyResponse(ctx, resp);
  ctx.response.body = await resp.text();
}

router.get("/activation", activationHandler);
router.get("/api/activation", activationHandler);

// ─── 3) ELO & général leaderboard ─────────────────────────────────
// POST /api/update-elo
router.post("/api/update-elo", async (ctx: Context) => {
  const { winner, loser } = await ctx.request.body({ type: "json" }).value;
  const resp = await updateElo(winner, loser);
  await applyResponse(ctx, resp);
  ctx.response.type = "application/json";
  ctx.response.body = resp.body;
});

// GET /api/leaderboard
router.get("/api/leaderboard", async (ctx: Context) => {
  const resp = await getLeaderboard();
  await applyResponse(ctx, resp);
  try { ctx.response.body = await resp.json(); }
  catch { ctx.response.body = await resp.text(); }
});

// ─── 4) TETRIS ─────────────────────────────────────────────────────
// POST /api/score/tetris
router.post("/api/score/tetris", authMiddleware, async (ctx: Context) => {
  const { userId, score } = await ctx.request.body({ type: "json" }).value;
  const resp = await saveTetrisScore(userId, score);
  await applyResponse(ctx, resp);
  ctx.response.body = await resp.json();
});

// GET /api/leaderboard/tetris
router.get("/api/leaderboard/tetris", async (ctx: Context) => {
  const resp = await getTetrisLeaderboard();
  await applyResponse(ctx, resp);
  try { ctx.response.body = await resp.json(); }
  catch { ctx.response.body = await resp.text(); }
});

// ─── 5) SPACE PIOUPIOU ─────────────────────────────────────────────
// POST /api/score/space
router.post("/api/score/space", authMiddleware, async (ctx: Context) => {
  const resp = await saveSpaceScore(ctx);
  await applyResponse(ctx, resp);
  try { ctx.response.body = await resp.json(); }
  catch { ctx.response.body = await resp.text(); }
});

// POST /api/telemetry/space
router.post("/api/telemetry/space", authMiddleware, async (ctx: Context) => {
  const resp = await saveSpaceTelemetry(ctx);
  await applyResponse(ctx, resp);
  try { ctx.response.body = await resp.json(); }
  catch { ctx.response.body = await resp.text(); }
});

// GET /api/leaderboard/space
router.get("/api/leaderboard/space", async (ctx: Context) => {
  const resp = await getSpaceLeaderboard(ctx);
  await applyResponse(ctx, resp);
  try { ctx.response.body = await resp.json(); }
  catch { ctx.response.body = await resp.text(); }
});

// ─── 6) LEADERBOARD SPACEPIOUPIOU (Top Scores & Top XP) ───────────
router.get("/api/scores/top",    authMiddleware, getTopScores);
router.get("/api/scores/top-xp", authMiddleware, getTopXp);

// ─── SNAKE ───────────────────────────────────────────────────────────
// POST /api/snake/saveScore
router.post(
  "/api/snake/saveScore",
  authMiddleware,
  async (ctx: Context) => {
    const resp = await saveSnakeScore(ctx);
    await applyResponse(ctx, resp);
    try {
      ctx.response.body = await resp.json();
    } catch {
      ctx.response.body = await resp.text();
    }
  }
);
// ─── SNAKE – Récupération du niveau max ───────────────────────────────────
// GET /api/snake/getMaxNiveau/:userId
router.get(
  "/api/snake/getMaxNiveau",
  authMiddleware,
  async (ctx: Context) => {
    const resp = await getMaxNiveau(ctx);
    await applyResponse(ctx, resp);
    try {
      ctx.response.body = await resp.json();
    } catch {
      ctx.response.body = await resp.text();
    }
  }
);
// ─── SNAKE – Leaderboard Top 10 (par niveau max puis score) ───────────
router.get(
  "/api/snake/leaderboard",
  async (ctx: Context) => {  
    const resp = await getSnakeLeaderboard(ctx);
    await applyResponse(ctx, resp);
    try {
      ctx.response.body = await resp.json();
    } catch {
      ctx.response.body = await resp.text();
    }
  }
);

// ←–––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––→
//  PROFIL UTILISATEUR
// ←–––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––→

router
  // Récupérer le profil (injecte ctx.state.userId via authMiddleware)
  .get(
    "/api/user/profile",
    authMiddleware,
    async (ctx) => {
      const resp = await getUserProfile(ctx);
      await applyResponse(ctx, resp); // <-- Utilise applyResponse pour copier les headers
      ctx.response.body = await resp.json();
    },
  )

  // Mettre à jour le profil
  .put(
    "/api/user/profile",
    authMiddleware,
    async (ctx) => {
      const body = await ctx.request.body({ type: "json" }).value;
      const resp = await updateUserProfile(ctx, body);
      await applyResponse(ctx, resp); 
      ctx.response.body = await resp.json();
    },
  );

  router.get(
    "/api/user/scores",
    authMiddleware,
    async (ctx) => {
      const resp = await getUserScores(ctx);
      await applyResponse(ctx, resp);
      ctx.response.body = await resp.json();
    },
  )

  // Meilleur score
  router.get(
    "/api/user/best-scores",
    authMiddleware,
    async (ctx) => {
      const resp = await getUserBestScores(ctx);
      await applyResponse(ctx, resp);
      ctx.response.body = await resp.json();
    },
  )

// ─── Helper pour copier status & headers d’un fetch Response Oak ───
async function applyResponse(ctx: Context, resp: globalThis.Response) {
  ctx.response.status = resp.status;
  resp.headers.forEach((value, key) => {
    ctx.response.headers.set(key, value);
  });
}



router.post("/api/admin/login", loginAdmin);

router
  .get("/api/admin/users",            authAdmin, getAllUsersHandler)
  .put("/api/admin/users/:id/activate", authAdmin, activateUserHandler)
  .delete("/api/admin/users/:id",       authAdmin, deleteUserHandler)
  .get("/api/admin/users/:id/scores",   authAdmin, getUserScoresHandler);


export default router;
