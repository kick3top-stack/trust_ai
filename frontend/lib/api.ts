export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const API_DOCS_URL = API_BASE.replace("/api/v1", "/api/v1/docs");

const TOKEN_KEY = "trustai_token";

async function apiFetch(input: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(input, init);
  } catch {
    return null;
  }
}

function apiHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (extra) return { ...headers, ...(extra as Record<string, string>) };
  return headers;
}

export class ApiConnectionError extends Error {
  constructor() {
    super(`Cannot reach backend at ${API_BASE}. Run npm run dev from the project root.`);
    this.name = "ApiConnectionError";
  }
}

export interface GenerationParams {
  temperature: number;
  max_tokens: number;
  top_p: number;
  seed: number;
}

export interface GenerateDemoResponse {
  request_id: string;
  response: string;
  receipt: Record<string, unknown>;
  merkle_proof: Record<string, unknown> | null;
  root_signature: Record<string, unknown> | null;
  batch_id: string;
  receipt_id: string;
}

export interface VerificationChecks {
  receipt_hash_valid: boolean;
  merkle_proof_valid: boolean;
  signature_valid: boolean;
  credit_recorded: boolean;
  model_verified: boolean;
}

export interface VerifyResult {
  valid: boolean;
  checks: VerificationChecks;
  reason?: string | null;
  receipt_hash?: string | null;
  merkle_root?: string | null;
  batch_number?: number | null;
  signed_at?: string | null;
  signing_key_id?: string | null;
}

export interface AdminStats {
  total_generations: number;
  total_receipts: number;
  current_merkle_root: string | null;
  last_signature_at: string | null;
  open_batch_receipt_count: number;
  signed_batch_count: number;
  verification_success_rate: number;
  generations_by_day: Array<{ date: string; count: number }>;
  model_usage: Array<{ model_name: string; count: number; credits: number }>;
  latest_requests: Array<{
    request_id: string;
    created_at: string;
    model_name: string;
    credit_cost: number;
    status: string;
  }>;
}

export async function generateDemo(
  prompt: string,
  parameters: GenerationParams,
): Promise<GenerateDemoResponse> {
  const res = await apiFetch(`${API_BASE}/generate-demo`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ prompt, parameters }),
  });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Generation failed");
  }
  return res.json();
}

export async function verifyReceipt(
  receipt: Record<string, unknown>,
  merkleProof: Record<string, unknown> | null,
  rootSignature: Record<string, unknown> | null,
): Promise<VerifyResult> {
  const res = await apiFetch(`${API_BASE}/verify`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      receipt,
      merkle_proof: merkleProof,
      root_signature: rootSignature,
    }),
  });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Verification request failed");
  }
  return res.json();
}

export async function fetchReceiptByRequest(requestId: string) {
  const res = await apiFetch(`${API_BASE}/receipts/by-request/${requestId}`, {
    headers: apiHeaders(),
  });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) return null;
  return res.json();
}

export async function fetchReceiptById(receiptId: string) {
  const res = await apiFetch(`${API_BASE}/receipts/${receiptId}`, {
    headers: apiHeaders(),
  });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) return null;
  return res.json();
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await apiFetch(`${API_BASE}/admin/stats`, { headers: apiHeaders() });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) {
    if (res.status === 401) throw new Error("Please sign in to continue");
    throw new Error("Failed to load dashboard stats");
  }
  return res.json();
}

export async function fetchPublicKey() {
  const res = await apiFetch(`${API_BASE}/admin/public-key`, { headers: apiHeaders() });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) throw new Error("Failed to load public key");
  return res.json();
}

export function truncateHash(value: string | undefined | null, len = 8): string {
  if (!value) return "—";
  return value.length > len * 2 ? `${value.slice(0, len)}...` : value;
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
