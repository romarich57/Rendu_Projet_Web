import { serve } from "https://deno.land/std@0.201.0/http/server.ts";

console.log("➡️ Redirection HTTP→HTTPS sur http://localhost:3000");
await serve((req) => {
  const url = new URL(req.url);
  url.port = "8443";
  url.protocol = "https:";
  return Response.redirect(url.toString(), 302);
}, { port: 3000 });
