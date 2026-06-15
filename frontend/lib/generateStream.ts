import { API_BASE, apiHeaders, ApiConnectionError, type GenerateDemoResponse, type GenerationParams } from "@/lib/api";

export interface GenerateDemoStreamHandlers {
  onToken: (text: string) => void;
  onDone: (result: GenerateDemoResponse) => void;
  onError: (message: string) => void;
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    if (line.startsWith("data: ")) data += line.slice(6);
  }
  if (!data) return null;
  return { event, data };
}

export async function generateDemoStream(
  prompt: string,
  parameters: GenerationParams,
  handlers: GenerateDemoStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}/generate-demo/stream`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ prompt, parameters }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Generation failed");
  }
  if (!res.body) {
    throw new ApiConnectionError();
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const parsed = parseSseBlock(block.trim());
      if (!parsed) continue;
      try {
        const payload = JSON.parse(parsed.data);
        if (parsed.event === "token" && payload.text) {
          handlers.onToken(String(payload.text));
        } else if (parsed.event === "done") {
          handlers.onDone(payload as GenerateDemoResponse);
        } else if (parsed.event === "error") {
          handlers.onError(String(payload.detail || "Generation failed"));
        }
      } catch {
        // ignore malformed SSE chunks
      }
    }
  }
}
