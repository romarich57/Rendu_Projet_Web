// db.ts (Deno — module ESM)

// 1) Charger les variables d’environnement
import { config } from "https://deno.land/x/dotenv@v3.2.0/mod.ts";
config(); // lit automatiquement votre .env

// 2) Importer et configurer le pool PostgreSQL
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const pool = new Pool({
  user:     Deno.env.get("DB_USER")     || "romarich",
  host:     Deno.env.get("DB_HOST")     || "localhost",
  database: Deno.env.get("DB_NAME")     || "space_invaders",
  password: Deno.env.get("DB_PASSWORD") || "Romaric1000",
  port:     parseInt(Deno.env.get("DB_PORT") || "5432", 10),
}, 5, true);

console.log("🔌 Pool Postgres configuré");

// 3) Initialisation des tables au démarrage
export async function initDatabase() {
  const client = await pool.connect();
  try {
    // Table users + colonnes additionnelles
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nom character varying NOT NULL,
        prenom character varying NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        city VARCHAR(100),
        country VARCHAR(100),
        languages VARCHAR(100),
        birthdate DATE,
        registration_ip VARCHAR(45),
        elo INTEGER DEFAULT 1000,
        avatar VARCHAR(255)
      );
    `);

    // Scores génériques
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS scores (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        value INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Historique d’IP
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS user_ips (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        ip_address VARCHAR(45),
        location TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // SpacePiouPiou – scores & télémétrie
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS space_scores (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        level INTEGER NOT NULL,
        xp INTEGER NOT NULL,
        wave INTEGER NOT NULL,
        duration INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS space_telemetry (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        event TEXT NOT NULL,
        wave INTEGER NOT NULL,
        score INTEGER NOT NULL,
        combo INTEGER NOT NULL,
        lives INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tetris – scores
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS tetris_scores (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Snake – scores
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS score_snake (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(50),
        niveau INTEGER NOT NULL,
        score INTEGER NOT NULL,
        temps INTEGER NOT NULL,
        date_partie TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.queryObject(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_score_snake_user_niveau
        ON score_snake(user_id, niveau);
    `);

    // Sessions table for HTTP-only session management
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(36) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Admin users & logs
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS admin_users (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL
      );
    `);
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id SERIAL PRIMARY KEY,
        username TEXT,
        success BOOLEAN,
        ip TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Schéma de la base initialisé");
  } catch (err) {
    console.error("❌ Erreur d'initialisation DB :", err);
    throw err;
  } finally {
    client.release();
  }
}

// Exécution automatique de l’initialisation
await initDatabase();

// 4) Helpers Admin

/** Récupère un user admin (username + hash) */
export async function getAdminUser(username: string) {
  const client = await pool.connect();
  try {
    const result = await client.queryObject<{
      username: string;
      password_hash: string;
    }>(
      `SELECT username, password_hash
         FROM admin_users
        WHERE username = $1`,
      username
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/** Log une tentative de connexion admin */
export async function logAdminAttempt(
  username: string,
  success: unknown,
  ip: string
) {
  const client = await pool.connect();
  try {
    // Coercition stricte en boolean
    const successBool =
      success === true ||
      success === "true" ||
      success === 1 ||
      success === "1";
    await client.queryObject(
      `INSERT INTO admin_logs (username, success, ip)
           VALUES ($1, $2::boolean, $3)`,
      [username, successBool, ip] // <-- Passage des params sous forme de tableau
    );
  } finally {
    client.release();
  }
}
// === Helpers CRUD Utilisateurs & Scores (Admin) ===

/** Récupère tous les utilisateurs */
export async function getAllUsers() {
  const client = await pool.connect();
  try {
    const result = await client.queryObject<{
      id: number;
      username: string;
      email: string;
      is_active: boolean;
    }>(`
      SELECT id, username, email, is_active
        FROM users
      ORDER BY id
    `);
    return result.rows;
  } finally {
    client.release();
  }
}

/** Active un compte par son id */
export async function activateUserById(id: number) {
  const client = await pool.connect();
  try {
    await client.queryObject(
      `UPDATE users SET is_active = true WHERE id = $1`,
      [id],
    );
  } finally {
    client.release();
  }
}

/** Supprime un compte par son id */
export async function deleteUserById(id: number) {
  const client = await pool.connect();
  try {
    await client.queryObject(
      `DELETE FROM users WHERE id = $1`,
      [id],
    );
  } finally {
    client.release();
  }
}

/** Récupère tous les scores d’un utilisateur (snake, tetris, space, generic) */
export async function getUserScores(userId: number) {
  const client = await pool.connect();
  try {
    const result = await client.queryObject<{
      game: string;
      score: number;
    }>(`
      SELECT 'snake'   AS game, score      AS score FROM score_snake   WHERE user_id = $1
      UNION ALL
      SELECT 'tetris'  AS game, score      AS score FROM tetris_scores WHERE user_id = $1
      UNION ALL
      SELECT 'space'   AS game, score      AS score FROM space_scores  WHERE user_id = $1
      UNION ALL
      SELECT 'generic' AS game, value      AS score FROM scores        WHERE user_id = $1
    `, [userId]);
    return result.rows;
  } finally {
    client.release();
  }
}



// 5) Export du pool pour d’autres usages
export default pool;
