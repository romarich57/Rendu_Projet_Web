// Centralized configuration helpers
export const JWT_SECRET = Deno.env.get("JWT_SECRET") ?? "dev-insecure-secret";
