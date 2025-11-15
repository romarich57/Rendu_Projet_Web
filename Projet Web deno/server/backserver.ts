// server/backserver.ts

import { handleApi } from "./routes.ts";
import { handleGuerreWebSocket } from "./websocket.ts";
import {
  withCORS,
  parseJsonBody,
  getClientIp,
} from "./middlewares.ts";



export async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const ip = getClientIp(request);

  // 1. Préflight CORS
  if (request.method === "OPTIONS") {
    return withCORS(new Response(null, { status: 204 }), request.headers.get("Origin"));
  }

  // 2. WebSocket /ws/guerre
  if (pathname.startsWith("/ws/guerre")) {
    const { response, socket } = Deno.upgradeWebSocket(request);
    handleGuerreWebSocket(socket);
    return response;
  }

  // 3. API REST & activation
  if (
    pathname.startsWith("/api") ||
    (pathname === "/activation" && request.method === "GET")
  ) {
    const body = await parseJsonBody(request);
    const resp = await handleApi(request, body, ip);
    return withCORS(resp, request.headers.get("Origin"));
  }

  // 4. Toutes les autres routes → 404
  return withCORS(
    new Response("Not Found", {
      status: 404,
    }),
    request.headers.get("Origin"),
  );
}
