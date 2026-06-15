const backendUrl = process.env.TRUSTAI_BACKEND_URL || "http://127.0.0.1:8000";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const body = await req.text();

  const res = await fetch(`${backendUrl}/api/v1/generate-demo/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
    },
    body,
  });

  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
