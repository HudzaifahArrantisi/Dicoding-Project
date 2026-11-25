interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  GRAPH_LOCAL_API?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json(
        {
          ok: true,
          service: "daisuki-graph",
          time: new Date().toISOString(),
        },
        {
          headers: {
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
    const response = await env.ASSETS.fetch(request);
    if (env.GRAPH_LOCAL_API !== "true") return response;

    const headers = new Headers(response.headers);
    const policy = headers.get("Content-Security-Policy");
    if (policy) {
      headers.set(
        "Content-Security-Policy",
        policy.replace(
          /connect-src\s+([^;]*)/,
          (_directive, sources: string) =>
            `connect-src ${sources} http://localhost:3001 http://127.0.0.1:3001`,
        ),
      );
    }
    return new Response(response.body, { status: response.status, headers });
  },
};
