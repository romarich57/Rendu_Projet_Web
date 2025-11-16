// handlers.ts
import { hash, compare } from "https://deno.land/x/bcrypt@v0.2.2/mod.ts";
import jwt from "npm:jsonwebtoken";
import { Context } from "https://deno.land/x/oak@v12.5.0/mod.ts";
import pool from "./db.ts";
import {
  envoyerEmailActivation,
  envoyerEmailChangeEmail,
  envoyerEmailResetPassword,
} from "./mail.ts";
import {
  checkBruteForce,
  establishAdminSession,
  registerFailedAttempt,
  resetAttempts,
} from "./middlewares.ts";
import {
  activateUserById,
  deleteUserById,
  getUserScores as getUserScoresFromDb
} from './db.ts';
import { JWT_SECRET } from "./config.ts";

// Regex email RFC5322
const emailRegex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

const FRONTEND_BASE_URL = (Deno.env.get("FRONTEND_URL") ?? Deno.env.get("SERVER_URL") ?? "http://localhost:3000").replace(/\/$/, "");
const RESET_BASE_URL = (Deno.env.get("RESET_URL") ?? `${FRONTEND_BASE_URL}/auth/reset/reset_password.html`).replace(/\/$/, "");
const ACTIVATION_BASE_URL = (Deno.env.get("ACTIVATION_URL") ?? `${FRONTEND_BASE_URL}/activation`).replace(/\/$/, "");
const FORCE_HTTPS = (Deno.env.get("FORCE_HTTPS") ?? "").toLowerCase() === "true";
const COOKIE_SECURE = (
  Deno.env.get("COOKIE_SECURE") ??
  (FORCE_HTTPS ? "true" : "false")
).toLowerCase() === "true";

/**
 * Role: Enregistre un nouvel utilisateur dans la base de données avec validation des données
 * Préconditions: 
 *   - body contient tous les champs obligatoires (nom, prenom, username, email, password, city, country, languages, birthdate)
 *   - email respecte le format RFC5322
 *   - JWT_SECRET est défini dans les variables d'environnement
 * Postconditions:
 *   - Si succès: utilisateur créé avec is_active=false, email d'activation envoyé, tentatives échouées réinitialisées
 *   - Si échec: tentative échouée enregistrée, erreur retournée avec statut approprié
 */
// --- REGISTER ---
export async function registerUser(body: any, ip: string): Promise<Response> {
  const {
    nom,
    prenom,
    username,
    email,
    password,
    city,
    country,
    languages,
    birthdate,
  } = body;
  const idKey = email || username || "unknown";

  /*
  if (!checkBruteForce(ip, idKey)) {
    return json({ success: false, message: "Trop de tentatives." }, 429);
  }

   */
  if (!nom || !prenom || !username || !email || !password ||
      !city || !country || !languages || !birthdate) {
    registerFailedAttempt(ip, idKey);
    return json({ success: false, message: "Champs manquants." }, 400);
  }
  if (!emailRegex.test(email)) {
    registerFailedAttempt(ip, idKey);
    return json({ success: false, message: "Email invalide." }, 400);
  }

  console.log("AZERTYUIOP")
  try {
    const client = await pool.connect();
    try {
      // Génération du hash (10 rondes par défaut)
      const hashed = await hash(password);
      console.log("Hashed password:", hashed);
      const res = await client.queryObject<{ id: number }>(`
        INSERT INTO users (
          nom, prenom, username, email, password, is_active,
          city, country, languages, birthdate, registration_ip
        ) VALUES (
          $1,$2,$3,$4,$5,false,$6,$7,$8,$9,$10
        ) RETURNING id
      `, [
        nom, prenom, username, email, hashed,
        city, country, languages, birthdate, ip
      ]);
      const userId = res.rows[0].id;
      console.log("User ID:", userId);
      const token = jwt.sign({ userId, for: "activation" }, JWT_SECRET, {
        expiresIn: "24h",
      });
      const activationSeparator = ACTIVATION_BASE_URL.includes("?") ? "&" : "?";
      const link = `${ACTIVATION_BASE_URL}${activationSeparator}token=${encodeURIComponent(token)}`;
      await envoyerEmailActivation(email, link);
      resetAttempts(ip, idKey);
      return json({
        success: true,
        message: "Vérifiez vos mails pour activer le compte.",
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    if (err.message.includes("users_email_key")) {
      registerFailedAttempt(ip, idKey);
      return json({
        success: false,
        message: "Email déjà utilisé.",
      }, 400);
    }
    registerFailedAttempt(ip, idKey);
    return json({ success: false, message: err.message }, 400);
  }
}

/**
 * Role: Génère et envoie un lien de réinitialisation de mot de passe par email
 * Préconditions:
 *   - body contient un email valide
 *   - JWT_SECRET est défini
 * Postconditions:
 *   - Si l'email existe: token JWT généré et lien envoyé par email
 *   - Toujours retourne un message de succès (sécurité par obscurité)
 */
// --- FORGOT PASSWORD ---
export async function forgotPassword(body: any): Promise<Response> {
  const { email } = body;
  try {
    let userId: number | null = null;
    const client = await pool.connect();
    try {
      const res = await client.queryObject<{ id: number }>(
        "SELECT id FROM users WHERE email=$1",
        [email],
      );
      if (res.rows.length) userId = res.rows[0].id;
    } finally {
      client.release();
    }
    if (userId) {
      const token = jwt.sign({ userId, for: "resetPwd" }, JWT_SECRET, {
        expiresIn: "1h",
      });
      const separator = RESET_BASE_URL.includes("?") ? "&" : "?";
      const link = `${RESET_BASE_URL}${separator}token=${encodeURIComponent(token)}`;
      await envoyerEmailResetPassword(email, link);
    }
    return json({
      success: true,
      message:
        "Si l'email existe, un lien de réinit. a été envoyé.",
    });
  } catch {
    return json({ success: false, message: "Erreur serveur." }, 500);
  }
}

/**
 * Role: Réinitialise le mot de passe d'un utilisateur avec un token valide
 * Préconditions:
 *   - token JWT valide avec for="resetPwd"
 *   - newPassword fourni
 *   - Token non expiré
 * Postconditions:
 *   - Si succès: mot de passe hashé et mis à jour en base
 *   - Si échec: erreur retournée (token invalide/expiré ou erreur SQL)
 */
// --- RESET PASSWORD ---
export async function resetPassword(body: any): Promise<Response> {
  const { token, newPassword } = body;
  if (!token || !newPassword) {
    return json({ success: false, message: "Données manquantes." }, 400);
  }
  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return json({ success: false, message: "Lien invalide ou expiré." }, 400);
  }
  if (decoded.for !== "resetPwd") {
    return json({ success: false, message: "Token invalide." }, 400);
  }
  // Hash du nouveau mot de passe
  const hashed = await hash(newPassword);
  try {
    const client = await pool.connect();
    try {
      await client.queryObject(
        "UPDATE users SET password=$1 WHERE id=$2",
        [hashed, decoded.userId],
      );
    } finally {
      client.release();
    }
    return json({ success: true, message: "Mot de passe réinitialisé." });
  } catch {
    return json({ success: false, message: "Erreur SQL." }, 500);
  }
}

/**
 * Role: Authentifie un utilisateur et crée une session
 * Préconditions:
 *   - identifier (email ou username) et password fournis
 *   - Utilisateur existe et est actif
 *   - Protection contre le brute force activée
 * Postconditions:
 *   - Si succès: session créée, JWT généré, cookie sessionId défini, tentatives réinitialisées
 *   - Si échec: tentative échouée enregistrée, erreur retournée
 */
// --- LOGIN ---
export async function loginUser(body: any, ip: string): Promise<Response> {
  const { identifier, password } = body;
  if (!identifier || !password) {
    return json({ success: false, message: "Champs manquants." }, 400);
  }
  if (!checkBruteForce(ip, identifier)) {
    return json({ success: false, message: "Trop de tentatives." }, 429);
  }

  try {
    // 1) Vérification des identifiants
    const client1 = await pool.connect();
    let userRecord;
    try {
      const res = await client1.queryObject<{
        id: number;
        username: string;
        password: string;
        is_active: boolean;
      }>(
        "SELECT id, username, password, is_active FROM users WHERE email=$1 OR username=$1",
        [identifier],
      );
      if (res.rows.length === 0) {
        registerFailedAttempt(ip, identifier);
        return json({ success: false, message: "Identifiants invalides." }, 401);
      }
      userRecord = res.rows[0];
    } finally {
      client1.release();
    }

    const match = await compare(password, userRecord.password);
    if (!match) {
      registerFailedAttempt(ip, identifier);
      return json({ success: false, message: "Mot de passe invalide." }, 401);
    }
    if (!userRecord.is_active) {
      registerFailedAttempt(ip, identifier);
      return json({ success: false, message: "Compte non activé." }, 403);
    }

    resetAttempts(ip, identifier);

    // 2) Création de la session
    const sessionId = crypto.randomUUID();
    const client2 = await pool.connect();
    try {
      await client2.queryObject(
        "INSERT INTO sessions (id, user_id) VALUES ($1, $2)",
        [sessionId, userRecord.id],
      );
    } finally {
      client2.release();
    }

    // 3) Réponse avec cookie HTTP-only et JWT si besoin ( on utilise le jwt et on stocke dans le localstorage)
    const token = jwt.sign(
      { userId: userRecord.id, username: userRecord.username },
      JWT_SECRET,
      { expiresIn: "2h" }
    );
    const cookieParts = [
      `sessionId=${sessionId}`,
      "HttpOnly",
      "Path=/",
      "SameSite=Lax",
      "Max-Age=7200",
    ];
    if (COOKIE_SECURE) {
      cookieParts.push("Secure");
    }
    return new Response(JSON.stringify({ success: true, token, userId: userRecord.id }), {
      status: 200,
      headers: {
        "Set-Cookie": cookieParts.join("; "),
        "Content-Type": "application/json",
      },
    });

  } catch (err: any) {
    registerFailedAttempt(ip, identifier);
    return json({ success: false, message: err.message }, 500);
  }
}

/**
 * Role: Active un compte utilisateur via un token d'activation
 * Préconditions:
 *   - token JWT valide avec for="activation"
 *   - Token non expiré
 *   - Utilisateur existe en base
 * Postconditions:
 *   - Si succès: is_active=true pour l'utilisateur
 *   - Si échec: message d'erreur retourné
 */
// --- ACTIVATION ---
export async function activateAccount(token: string): Promise<Response> {
  let decoded: any;
  try {
    console.log("[activation] Vérification du token…");
    decoded = jwt.verify(token, JWT_SECRET);
    console.log("[activation] Token décodé:", decoded);
  } catch (err) {
    console.error(
      "[activation] Erreur JWT:",
      (err as Error)?.name,
      "-",
      (err as Error)?.message,
    );
    return new Response("Lien d'activation invalide ou expiré.", { status: 400 });
  }
  if (decoded.for !== "activation") {
    console.warn("[activation] Payload inattendu:", decoded);
    return new Response("Token invalide.", { status: 400 });
  }
  try {
    console.log("[activation] Activation utilisateur id:", decoded.userId);
    const client = await pool.connect();
    try {
      await client.queryObject(
        "UPDATE users SET is_active=true WHERE id=$1",
        [decoded.userId],
      );
    } finally {
      client.release();
    }
    return new Response(
      "Compte activé ! Vous pouvez vous connecter.",
      { status: 200 },
    );
  } catch (err) {
    console.error("[activation] Erreur SQL:", err);
    return new Response("Erreur serveur.", { status: 500 });
  }
}

/**
 * Role: Met à jour les ratings ELO des joueurs après une partie
 * Préconditions:
 *   - winner et loser sont des usernames valides existant en base
 *   - Utilisateurs ont un rating ELO initial
 * Postconditions:
 *   - Gagnant: ELO +30
 *   - Perdant: ELO -30 (minimum 0)
 *   - Logs des changements générés
 */
// --- UPDATE ELO ---
export async function updateElo(winner: string, loser: string): Promise<Response> {
  console.log(`[ELO] Updating ratings: Winner=${winner}, Loser=${loser}`);

  try {
    const client = await pool.connect();
    try {
      // Log ELO pre-update
      const preUpdate = await client.queryObject(
        "SELECT username, elo FROM users WHERE username IN ($1, $2)",
        [winner, loser],
      );
      console.log("[ELO] Pre-update:", preUpdate.rows);

      // Update winner +30
      const winnerResult = await client.queryObject(
        "UPDATE users SET elo = elo + 30 WHERE username = $1 RETURNING username, elo",
        [winner],
      );

      // Update loser -30 (with floor of 0)
      const loserResult = await client.queryObject(
        "UPDATE users SET elo = GREATEST(0, elo - 30) WHERE username = $1 RETURNING username, elo",
        [loser],
      );

      console.log("[ELO] Post-update winner:", winnerResult.rows);
      console.log("[ELO] Post-update loser:", loserResult.rows);

      return json({
        success: true,
        message: "ELO updated successfully",
        winner: winnerResult.rows[0],
        loser: loserResult.rows[0]
      }, 200);
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("[ELO] Update error:", err);
    return json({ success: false, error: err.message }, 500);
  }
}

/**
 * Role: Récupère le classement des 10 meilleurs joueurs par ELO
 * Préconditions:
 *   - Table users existe avec colonnes id, username, elo
 * Postconditions:
 *   - Retourne un tableau JSON trié par ELO décroissant (max 10 entrées)
 */
// --- GET LEADERBOARD TOP 10 ---
export async function getLeaderboard(): Promise<Response> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.queryObject<{
        id: string;
        username: string;
        elo: number;
      }>(`
        SELECT id, username, elo
          FROM users
         ORDER BY elo DESC
         LIMIT 10
      `);
      // renvoie status 200 et JSON [{ id, username, elo }, …]
      return json(res.rows, 200);
    } finally {
      client.release();
    }
  } catch (err: any) {
    return json({ success: false, error: err.message }, 500);
  }
}

/**
 * Role: Enregistre un score Tetris pour un utilisateur
 * Préconditions:
 *   - userId valide (utilisateur existant)
 *   - score est un nombre
 *   - Table tetris_scores existe
 * Postconditions:
 *   - Score inséré dans tetris_scores avec timestamp
 *   - Réponse JSON de succès ou d'erreur
 */
export async function saveTetrisScore(
  userId: number,
  score: number
): Promise<Response> {
  try {
    const client = await pool.connect();
    try {
      await client.queryObject(
        `INSERT INTO tetris_scores (user_id, score) VALUES ($1, $2)`,
        [userId, score],
      );
    } finally {
      client.release();
    }
    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

/**
 * Role: Récupère le classement Tetris des 10 meilleurs scores
 * Préconditions:
 *   - Tables users et tetris_scores existent
 *   - Relations correctes entre les tables
 * Postconditions:
 *   - Retourne les 10 meilleurs scores Tetris groupés par utilisateur
 */
export async function getTetrisLeaderboard(): Promise<Response> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.queryObject<{
        username: string;
        best_score: number;
      }>(`
        SELECT u.username,
               MAX(s.score) AS best_score
          FROM users u
          JOIN tetris_scores s ON s.user_id = u.id
         GROUP BY u.username
         ORDER BY best_score DESC
         LIMIT 10
      `);
      return new Response(
        JSON.stringify(res.rows),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    } finally {
      client.release();
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

/**
 * Role: Enregistre un score SpacePiouPiou pour l'utilisateur authentifié
 * Préconditions:
 *   - Utilisateur authentifié (userId dans ctx.state)
 *   - Payload valide avec score, level, xp, wave, duration (tous numbers)
 *   - Table space_scores existe
 * Postconditions:
 *   - Score inséré avec timestamp et user_id
 *   - Réponse 201 si succès, 400/401/500 si erreur
 */
// --- Enregistrement du score SpacePiouPiou ---
export async function saveSpaceScore(ctx: Context): Promise<Response> {
  // 1) Récupérer userId injecté par authMiddleware
  const userId = ctx.state.userId as number;
  if (!userId) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  // 2) Extraire et valider les champs attendus
  const { score, level, xp, wave, duration } = await ctx.request.body({ type: "json" }).value;
  if (
    typeof score !== "number" ||
    typeof level !== "number" ||
    typeof xp !== "number" ||
    typeof wave !== "number" ||
    typeof duration !== "number"
  ) {
    return json({ success: false, error: "Invalid payload" }, 400);
  }

  const client = await pool.connect();
  try {
    await client.queryObject(`
      INSERT INTO space_scores (
        user_id, score, level, xp, wave, duration, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [userId, score, level, xp, wave, duration]);
  } catch (err) {
    console.error("saveSpaceScore error:", err);
    return json({ success: false, error: "Database error" }, 500);
  } finally {
    client.release();
  }

  return json({ success: true }, 201);
}

/**
 * Role: Enregistre des données de télémétrie SpacePiouPiou
 * Préconditions:
 *   - Utilisateur authentifié (userId dans ctx.state)
 *   - Payload valide avec event, wave, score, combo, lives
 *   - Table space_telemetry existe
 * Postconditions:
 *   - Données de télémétrie insérées avec timestamp
 *   - Réponse 201 si succès, 400/401/500 si erreur
 */
// --- Enregistrement de la télémétrie SpacePiouPiou ---
export async function saveSpaceTelemetry(ctx: Context): Promise<Response> {
  const userId = ctx.state.userId as number;
  if (!userId) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  const { event, wave, score, combo, lives } = await ctx.request.body({ type: "json" }).value;
  if (
    typeof event !== "string" ||
    typeof wave !== "number" ||
    typeof score !== "number" ||
    typeof combo !== "number" ||
    typeof lives !== "number"
  ) {
    return json({ success: false, error: "Invalid payload" }, 400);
  }

  const client = await pool.connect();
  try {
    await client.queryObject(`
      INSERT INTO space_telemetry (
        user_id, event, wave, score, combo, lives, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [userId, event, wave, score, combo, lives]);
  } catch (err) {
    console.error("saveSpaceTelemetry error:", err);
    return json({ success: false, error: "Database error" }, 500);
  } finally {
    client.release();
  }

  return json({ success: true }, 201);
}

/**
 * Role: Récupère le classement SpacePiouPiou (100 meilleurs scores)
 * Préconditions:
 *   - Tables space_scores et users existent
 *   - Relations correctes entre les tables
 * Postconditions:
 *   - Retourne les 100 meilleurs scores triés par score DESC, wave DESC, date ASC
 */
// --- Leaderboard SpacePiouPiou ---
export async function getSpaceLeaderboard(ctx: Context): Promise<Response> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.queryObject<{
        username: string;
        score: number;
        level: number;
        xp: number;
        wave: number;
        created_at: string;
      }>(`
        SELECT u.username, s.score, s.level, s.xp, s.wave, s.created_at
        FROM space_scores s
        JOIN users u ON u.id = s.user_id
       ORDER BY s.score DESC, s.wave DESC, s.created_at ASC
       LIMIT 100
      `);
      return json(res.rows);
    } catch (err) {
      console.error("getSpaceLeaderboard error:", err);
      return json({ success: false, error: "Database error" }, 500);
    } finally {
      client.release();
    }
  } catch (err: any) {
    return json({ success: false, error: err.message }, 500);
  }
}

/**
 * Role: Récupère le top 10 des scores SpacePiouPiou
 * Préconditions:
 *   - Tables space_scores et users existent
 *   - Relations correctes entre les tables
 * Postconditions:
 *   - Retourne le top 10 avec player, score, xp, level, wave
 *   - Réponse 200 avec données ou 500 si erreur
 */
// ────────────────────────────────────────────────────────────────────
//  TOP 10 – par score
// ────────────────────────────────────────────────────────────────────
export const getTopScores = async (ctx: Context) => {
  try {
    const client = await pool.connect();
    try {
      const res = await client.queryObject<{
        player: string;
        score:  number;
        xp:     number;
        level:  number;
        wave:   number;
      }>(`
        SELECT u.username AS player,
               s.score    AS score,
               s.xp,
               s.level,
               s.wave
        FROM   space_scores s
        JOIN   users        u ON u.id = s.user_id
        ORDER  BY s.score DESC
        LIMIT  10
      `);
      ctx.response.status = 200;
      ctx.response.body   = res.rows;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    ctx.throw(500, "Erreur interne");
  }
};

/**
 * Role: Récupère le top 10 des joueurs par XP cumulé SpacePiouPiou
 * Préconditions:
 *   - Tables space_scores et users existent
 *   - Relations correctes entre les tables
 * Postconditions:
 *   - Retourne le top 10 avec player et XP total (somme)
 *   - Réponse 200 avec données ou 500 si erreur
 */
// ────────────────────────────────────────────────────────────────────
//  TOP 10 – par XP cumulé
// ────────────────────────────────────────────────────────────────────
export const getTopXp = async (ctx: Context) => {
  try {
    const client = await pool.connect();
    try {
      const res = await client.queryObject<{ player: string; xp: number }>(`
        SELECT u.username     AS player,
               SUM(s.xp)::int AS xp
        FROM   space_scores s
        JOIN   users        u ON u.id = s.user_id
        GROUP  BY u.username
        ORDER  BY xp DESC
        LIMIT  10
      `);
      ctx.response.status = 200;
      ctx.response.body   = res.rows;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    ctx.throw(500, "Erreur interne");
  }
};

/**
 * Role: Enregistre un score Snake avec gestion des niveaux
 * Préconditions:
 *   - Utilisateur authentifié (userId dans ctx.state)
 *   - Payload valide avec niveau, score, temps (numbers)
 *   - Table score_snake existe avec contrainte unique (user_id, niveau)
 * Postconditions:
 *   - Score inséré ou mis à jour si meilleur score pour ce niveau
 *   - Username récupéré automatiquement si non fourni
 *   - Réponse 201 si succès, 400/401/500 si erreur
 */
// --- Enregistrement d'une partie de Snake ---
export async function saveSnakeScore(ctx: Context): Promise<Response> {
  // 1) Récupérer l’ID utilisateur injecté par authMiddleware
  const userId = ctx.state.userId as number;
  if (!userId) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  // 2) Extraire et valider les champs (username est optionnel)
  const { username, niveau, score, temps } = await ctx.request.body({ type: "json" }).value;
  if (
    typeof niveau !== "number" ||
    typeof score !== "number" ||
    typeof temps !== "number"
  ) {
    return json({ success: false, error: "Invalid payload" }, 400);
  }

  // 3) Si le username n'est pas fourni, on le récupère via l'id utilisateur
  let finalUsername = username;
  if (!finalUsername) {
    const clientForUser = await pool.connect();
    try {
      const res = await clientForUser.queryObject<{ username: string }>(
        "SELECT username FROM users WHERE id = $1",
        [userId]
      );
      finalUsername = res.rows.length > 0 ? res.rows[0].username : "unknown";
    } catch {
      finalUsername = "unknown";
    } finally {
      clientForUser.release();
    }
  }

  // 4) Enregistrer en base avec mise à jour en cas de conflit sur (user_id, niveau)
  const client = await pool.connect();
  try {
    await client.queryObject(
      `INSERT INTO score_snake (user_id, username, niveau, score, temps, date_partie)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, niveau)
         DO UPDATE SET score = EXCLUDED.score,
                       temps = EXCLUDED.temps,
                       date_partie = NOW()`,
      [userId, finalUsername, niveau, score, temps]
    );
  } catch (err: any) {
    console.error("saveSnakeScore error:", err);
    return json({ success: false, error: "Database error" }, 500);
  } finally {
    client.release();
  }

  // 5) Réponse au client
  return json({ success: true }, 201);
}

/**
 * Role: Récupère le niveau maximum débloqué par l'utilisateur authentifié
 * Préconditions:
 *   - Utilisateur authentifié (userId dans ctx.state)
 *   - Table score_snake existe
 * Postconditions:
 *   - Retourne le niveau max ou 1 par défaut si aucun score
 *   - Réponse 200 avec maxNiveau ou 401/500 si erreur
 */
// ─── Récupération du niveau max débloqué pour Snake ─────────────────────────
export async function getMaxNiveau(ctx: Context): Promise<Response> {
  // On récupère l’ID authentifié depuis authMiddleware
  const userId = ctx.state.userId as number;
  if (!userId) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  const client = await pool.connect();
  try {
    const result = await client.queryObject<{ max_niveau: number }>(
      `SELECT MAX(niveau) AS max_niveau FROM score_snake WHERE user_id = $1`,
      [userId]
    );
    const maxNiveau = result.rows[0].max_niveau || 1;
    return json({ maxNiveau }, 200);
  } catch (err) {
    console.error("getMaxNiveau error:", err);
    return json({ success: false, error: "Database error" }, 500);
  } finally {
    client.release();
  }
}

/**
 * Role: Récupère le classement Snake (top 10 par niveau max puis score)
 * Préconditions:
 *   - Tables score_snake et users existent
 *   - Relations correctes entre les tables
 * Postconditions:
 *   - Retourne le top 10 avec username, max_niveau, score
 *   - Tri par niveau max DESC puis score DESC
 *   - Réponse 200 avec données ou 500 si erreur
 */
// ─── Leaderboard Snake – Top 10 par niveau max puis score ─────────────────
export async function getSnakeLeaderboard(ctx: Context): Promise<Response> {
  // 1) Connexion
  const client = await pool.connect();
  try {
    // 2) Sous-requêtes pour max niveau puis meilleur score à ce niveau
    const result = await client.queryObject<{
      username:  string;
      max_niveau: number;
      score:      number;
    }>(`
      WITH max_level AS (
        SELECT user_id, MAX(niveau) AS max_niveau
          FROM score_snake
         GROUP BY user_id
      ), best_scores AS (
        SELECT s.user_id,
               ml.max_niveau,
               MAX(s.score) AS score
          FROM score_snake s
          JOIN max_level ml
            ON s.user_id = ml.user_id
           AND s.niveau  = ml.max_niveau
         GROUP BY s.user_id, ml.max_niveau
      )
      SELECT u.username,
             bs.max_niveau,
             bs.score
        FROM best_scores bs
        JOIN users u ON u.id = bs.user_id
       ORDER BY bs.max_niveau DESC, bs.score DESC
       LIMIT 10;
    `);
    return json(result.rows, 200);
  } catch (err) {
    console.error("getSnakeLeaderboard error:", err);
    return json({ success: false, error: "Database error" }, 500);
  } finally {
    client.release();
  }
}

/**
 * Role: Récupère le profil utilisateur (informations personnelles)
 * Préconditions:
 *   - Utilisateur authentifié (userId dans ctx.state)
 *   - Utilisateur existe en base
 * Postconditions:
 *   - Retourne username, email, country, city, languages, birthdate, avatar
 *   - Réponse 200 avec données, 401 si non auth, 404 si utilisateur introuvable
 */
export async function getUserProfile(ctx: Context): Promise<Response> {
  const userId = ctx.state.userId as number;
  if (!userId) return json({ error: "Unauthorized" }, 401);

  const client = await pool.connect();
  try {
    const { rows } = await client.queryObject<{
      username: string;
      email:    string;
      country:  string | null;
      city:     string | null;
      languages:string | null;
      birthdate: string | null;
      avatar:   string | null;
    }>(
      `SELECT username,email,country,city,languages,
              TO_CHAR(birthdate,'YYYY-MM-DD') AS birthdate,
              avatar
         FROM users WHERE id=$1`,
      [userId],
    );
    if (rows.length === 0) return json({ error: "Not found" }, 404);
    return json(rows[0], 200);
  } finally {
    client.release();
  }
}

/**
 * Role: Met à jour le profil utilisateur avec validation
 * Préconditions:
 *   - Utilisateur authentifié (userId dans ctx.state)
 *   - Données optionnelles dans body (username, email, country, city, languages, birthdate, avatar)
 *   - Email valide si fourni
 * Postconditions:
 *   - Profil mis à jour avec les données fournies
 *   - Si changement d'email: compte désactivé et email de confirmation envoyé
 *   - Réponse 200 avec message de succès ou 400/401 si erreur
 */
export async function updateUserProfile(
  ctx: Context,
  body: {
    username?: string;
    email?:    string;
    country?:  string;
    city?:     string;
    languages?:string;
    birthdate?:string;
    avatar?:   string;
  },
): Promise<Response> {
  const userId = ctx.state.userId as number;
  if (!userId) return json({ error: "Unauthorized" }, 401);

  // Validation rapide
  const { username, email, country, city, languages, birthdate, avatar } = body;
  if (
    (username && (username.length<3||username.length>50)) ||
    (email    && !emailRegex.test(email)) ||
    (country  && country.length>100) ||
    (city     && city.length>100) ||
    (languages&& languages.length>100)
  ) return json({ error: "Invalid data" }, 400);

  const client = await pool.connect();
  try {
    // Si changement d'email, désactive en attendant confirmation
    let deactivate = false;
    const { rows: curr } = await client.queryObject<{ email:string }>(
      "SELECT email FROM users WHERE id=$1",
      [userId],
    );
    const oldEmail = curr[0]?.email;
    if (email && email!==oldEmail) {
      deactivate = true;
      const token = jwt.sign(
        { userId, for:"email-change", newEmail:email },
        JWT_SECRET,
        { expiresIn:"24h" },
      );
      const activationSeparator = ACTIVATION_BASE_URL.includes("?") ? "&" : "?";
      const link = `${ACTIVATION_BASE_URL}${activationSeparator}token=${encodeURIComponent(token)}`;
      await envoyerEmailChangeEmail(email, link);
    }
    // Mise à jour
    await client.queryObject(
      `UPDATE users SET
         username  = COALESCE($1,username),
         email     = COALESCE($2,email),
         country   = COALESCE($3,country),
         city      = COALESCE($4,city),
         languages = COALESCE($5,languages),
         birthdate = COALESCE($6,birthdate),
         avatar    = COALESCE($7,avatar),
         is_active = CASE WHEN $8 THEN false ELSE is_active END
       WHERE id=$9`,
      [
        username, email, country, city,
        languages, birthdate, avatar,
        deactivate, userId,
      ],
    );
    return json({
      success: true,
      message: deactivate
        ? "Veuillez confirmer votre nouvelle adresse mail."
        : "Profil mis à jour."
    }, 200);
  } finally {
    client.release();
  }
}

/**
 * Role: Récupère l'historique des scores d'un utilisateur pour un jeu donné
 * Préconditions:
 *   - Utilisateur authentifié (userId dans ctx.state)
 *   - Paramètre game valide (snake, tetris, space, war)
 * Postconditions:
 *   - Retourne tableau de {date, score} trié par date DESC
 *   - Réponse 200 avec données ou 400/401 si erreur
 */
export async function getUserScores(ctx: Context): Promise<Response> {
  const userId = ctx.state.userId as number;
  if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

  const game = ctx.request.url.searchParams.get("game");
  if (!game) return jsonResponse({ error: "Paramètre game manquant" }, 400);

  let sql = "";
  switch (game) {
    case "snake":
      sql = `
        SELECT date_partie AS date, score
          FROM score_snake
         WHERE user_id = $1
         ORDER BY date_partie DESC
      `;
      break;
    case "tetris":
      sql = `
        SELECT created_at::TEXT AS date, score
          FROM tetris_scores
         WHERE user_id = $1
         ORDER BY created_at DESC
      `;
      break;
    case "space":
      sql = `
        SELECT created_at::TEXT AS date, score
          FROM space_scores
         WHERE user_id = $1
         ORDER BY created_at DESC
      `;
      break;
    case "war":
      sql = `
        SELECT created_at::TEXT AS date, score
          FROM guerre_scores
         WHERE user_id = $1
         ORDER BY created_at DESC
      `;
      break;
    default:
      return jsonResponse({ error: "Jeu inconnu" }, 400);
  }

  const client = await pool.connect();
  try {
    const result = await client.queryObject<{ date: string; score: number }>(
      sql,
      [userId],
    );
    return jsonResponse(result.rows, 200);
  } finally {
    client.release();
  }
}

/**
 * Role: Récupère le meilleur score d'un utilisateur pour un jeu donné
 * Préconditions:
 *   - Utilisateur authentifié (userId dans ctx.state)
 *   - Paramètre game valide (snake, tetris, space, war)
 * Postconditions:
 *   - Retourne {date, score} du meilleur score
 *   - Si aucun score: {score: 0, date: null}
 *   - Réponse 200 avec données ou 400/401 si erreur
 */
export async function getUserBestScores(
  ctx: Context,
): Promise<Response> {
  const userId = ctx.state.userId as number;
  if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

  const game = ctx.request.url.searchParams.get("game");
  if (!game) return jsonResponse({ error: "Paramètre game manquant" }, 400);

  let sql = "";
  switch (game) {
    case "snake":
      sql = `
        SELECT MAX(score) AS score,
               MIN(date_partie) FILTER (WHERE score = MAX(score)) AS date
          FROM score_snake
         WHERE user_id = $1
      `;
      break;
    case "tetris":
      sql = `
        SELECT MAX(score) AS score,
               MIN(created_at)::TEXT FILTER (WHERE score = MAX(score)) AS date
          FROM tetris_scores
         WHERE user_id = $1
      `;
      break;
    case "space":
      sql = `
        SELECT MAX(score) AS score,
               MIN(created_at)::TEXT FILTER (WHERE score = MAX(score)) AS date
          FROM space_scores
         WHERE user_id = $1
      `;
      break;
    case "war":
      sql = `
        SELECT MAX(score) AS score,
               MIN(created_at)::TEXT FILTER (WHERE score = MAX(score)) AS date
          FROM guerre_scores
         WHERE user_id = $1
      `;
      break;
    default:
      return jsonResponse({ error: "Jeu inconnu" }, 400);
  }

  const client = await pool.connect();
  try {
    const result = await client.queryObject<{ date: string; score: number }>(
      sql,
      [userId],
    );
    // Si jamais aucun score, renvoyer { score: 0, date: null }
    const row = result.rows[0] || { score: 0, date: null };
    return jsonResponse(row, 200);
  } finally {
    client.release();
  }
}

/**
 * Role: Authentifie un administrateur
 * Préconditions:
 *   - ADMIN_USER et ADMIN_PASS définis dans les variables d'environnement
 *   - Payload contient username et password
 * Postconditions:
 *   - Si succès: tentatives réinitialisées, réponse 200
 *   - Si échec: tentative échouée enregistrée, réponse 401
 */
export async function loginAdmin(ctx: Context) {
  const { username, password } = await ctx.request.body({ type: "json" }).value;
  const ip = ctx.request.ip;
  const ADMIN_USER = Deno.env.get("ADMIN_USER");
  const ADMIN_PASS = Deno.env.get("ADMIN_PASS");
  // échec
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    // log éventuel, incrément bruteforce
    registerFailedAttempt(ip, username);
    ctx.response.status = 401;
    ctx.response.body   = { error: "Identifiant ou mot de passe invalide" };
    return;
  }
  // succès
  resetAttempts(ip, username);
  await establishAdminSession(ctx, username);
  ctx.response.status = 200;
  ctx.response.body   = { message: "Connecté en tant qu'admin" };
}

/**
 * Role: Récupère la liste de tous les utilisateurs (admin)
 * Préconditions:
 *   - Accès administrateur vérifié
 *   - Table users existe
 * Postconditions:
 *   - Retourne tous les utilisateurs avec id, username, email, verified
 *   - Triés par id
 *   - Réponse 200 avec données ou 500 si erreur
 */
/** GET /api/admin/users */
export async function getAllUsersHandler(ctx: Context) {
  // Utiliser la fonction importée depuis db.ts au lieu d'appeler getAllUsers directement
  const client = await pool.connect();
  try {
    const result = await client.queryObject(`
      SELECT id, username, email, is_active as verified
      FROM users
      ORDER BY id
    `);
    ctx.response.body = result.rows;
  } catch (error) {
    console.error("Error fetching users:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to retrieve users" };
  } finally {
    client.release();
  }
}

/**
 * Role: Active un utilisateur spécifique (admin)
 * Préconditions:
 *   - Accès administrateur vérifié
 *   - ID utilisateur valide dans params
 *   - Fonction activateUserById disponible
 * Postconditions:
 *   - Utilisateur activé en base
 *   - Réponse 204 (no content)
 */
/** PUT /api/admin/users/:id/activate */
export async function activateUserHandler(ctx: Context) {
  const params = (ctx as any).params as Record<string, string> | undefined;
  const id = Number(params?.id);
  if (!Number.isFinite(id)) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Identifiant invalide" };
    return;
  }
  await activateUserById(id);
  ctx.response.status = 204;
}

/**
 * Role: Supprime un utilisateur spécifique (admin)
 * Préconditions:
 *   - Accès administrateur vérifié
 *   - ID utilisateur valide dans params
 *   - Fonction deleteUserById disponible
 * Postconditions:
 *   - Utilisateur supprimé de la base
 *   - Réponse 204 (no content)
 */
/** DELETE /api/admin/users/:id */
export async function deleteUserHandler(ctx: Context) {
  const params = (ctx as any).params as Record<string, string> | undefined;
  const id = Number(params?.id);
  if (!Number.isFinite(id)) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Identifiant invalide" };
    return;
  }
  await deleteUserById(id);
  ctx.response.status = 204;
}

/**
 * Role: Récupère les scores d'un utilisateur spécifique (admin)
 * Préconditions:
 *   - Accès administrateur vérifié
 *   - ID utilisateur valide dans params
 *   - Fonction getUserScoresFromDb disponible
 * Postconditions:
 *   - Retourne tous les scores de l'utilisateur
 *   - Réponse avec données des scores
 */
/** GET /api/admin/users/:id/scores */
export async function getUserScoresHandler(ctx: Context) {
  const params = (ctx as any).params as Record<string, string> | undefined;
  const id = Number(params?.id);
  if (!Number.isFinite(id)) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Identifiant invalide" };
    return;
  }
  const scores = await getUserScoresFromDb(id);
  ctx.response.body = scores;
}

/** helper pour renvoyer du JSON */
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Helper pour renvoyer du JSON
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
