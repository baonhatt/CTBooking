export default {
  async fetch(request: Request, env: any) {
    const origin = request.headers.get("Origin") || "";
    const allowed = new Set([
      "https://cinesphere.com.vn",
      "https://www.cinesphere.com.vn",
      "https://cinema-pages.pages.dev",
    ]);
    const allowOrigin = origin && allowed.has(origin) ? origin : "https://cinesphere.com.vn";
    const cors = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers":
        request.headers.get("Access-Control-Request-Headers") ||
        "Content-Type,Authorization,Accept,Origin,Referer",
      "Access-Control-Expose-Headers": "Content-Type,Authorization",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
    } as Record<string, string>;
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404, headers: cors });
    }
    const upstreamBase = String((env && env.UPSTREAM_BASE) || "");
    const target = `${upstreamBase}${url.pathname}${url.search}`;
    const isBodyAllowed = !["GET", "HEAD"].includes(request.method.toUpperCase());
    const body = isBodyAllowed ? await request.clone().arrayBuffer() : undefined;
    const proxied = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body,
      redirect: "follow",
    });
    const headers = new Headers(proxied.headers);
    headers.set("Access-Control-Allow-Origin", cors["Access-Control-Allow-Origin"]);
    headers.set("Access-Control-Allow-Credentials", cors["Access-Control-Allow-Credentials"]);
    headers.set("Access-Control-Allow-Methods", cors["Access-Control-Allow-Methods"]);
    headers.set("Access-Control-Allow-Headers", cors["Access-Control-Allow-Headers"]);
    headers.set("Access-Control-Expose-Headers", cors["Access-Control-Expose-Headers"]);
    headers.set("Vary", cors["Vary"]);
    headers.set("Referrer-Policy", cors["Referrer-Policy"]);
    headers.set("Cross-Origin-Opener-Policy", cors["Cross-Origin-Opener-Policy"]);
    headers.set("Cross-Origin-Embedder-Policy", cors["Cross-Origin-Embedder-Policy"]);
    return new Response(proxied.body, { status: proxied.status, headers });
  },
};
