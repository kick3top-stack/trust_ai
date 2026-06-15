import { estimateGenerationCost } from "./credits";
import type { AuthUser } from "./auth";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
export const CREDIT_RATE = 0.01; // fallback; use fetchBillingConfig() for server value

export const API_DOCS_URL = API_BASE.replace("/api/v1", "/api/v1/docs");

const TOKEN_KEY = "trustai_token";

async function apiFetch(input: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(input, init);
  } catch {
    return null;
  }
}

export function apiHeaders(extra?: HeadersInit): HeadersInit {
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
    super("Cannot reach the API. Run npm run dev from the project root.");
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
  credit_cost: number;
  credit_balance: number;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface GenerationSummary {
  prompt_text: string | null;
  response_text: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  credit_cost: number;
  model_name: string;
  created_at: string;
}

export interface ReceiptPackage {
  receipt: Record<string, unknown> | null;
  merkle_proof: Record<string, unknown> | null;
  root_signature: Record<string, unknown> | null;
  receipt_id: string | null;
  batch_id: string | null;
  generation?: GenerationSummary | null;
  response?: string;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  balance_after: number;
  txn_type: string;
  description: string;
  request_id: string | null;
  actor_id: string | null;
  created_at: string;
}

export interface SupportGeneration {
  request_id: string;
  user_id: string | null;
  user_email: string | null;
  user_display_name: string | null;
  created_at: string;
  status: string;
  model_name: string;
  credit_cost: number;
  prompt_tokens: number;
  completion_tokens: number;
  prompt_text: string | null;
  response_text: string | null;
}

export interface Dispute {
  id: string;
  user_id: string;
  user_email: string | null;
  request_id: string;
  reason: string;
  status: string;
  credit_cost: number;
  resolution_note: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface BatchSummary {
  batch_id: string;
  batch_number: number;
  status: string;
  receipt_count: number;
  merkle_root: string | null;
  sealed_at: string | null;
  created_at: string;
  integrity_status?: BatchIntegrityStatus;
}

export type ReceiptIntegrityStatus = "full" | "batch" | "failed" | "pending" | "none";
export type BatchIntegrityStatus = "verified" | "altered" | "pending" | "empty";

export interface ReceiptListItem {
  request_id: string;
  created_at: string;
  model_name: string;
  credit_cost: number;
  status: string;
  integrity_status: ReceiptIntegrityStatus;
  user_id?: string;
  user_email?: string;
  user_display_name?: string;
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
  user_message?: string | null;
  trust_level?: "full" | "batch" | "failed";
  receipt_hash?: string | null;
  merkle_root?: string | null;
  batch_number?: number | null;
  signed_at?: string | null;
  signing_key_id?: string | null;
}

export interface AdminStats {
  scope?: "platform" | "user";
  total_users?: number;
  active_users?: number;
  subject_user_id?: string;
  subject_email?: string;
  subject_display_name?: string;
  subject_role?: string;
  subject_is_active?: boolean;
  total_generations: number;
  total_receipts: number;
  credit_balance?: number;
  viewer_credit_balance?: number;
  credits_spent_7d?: number;
  current_merkle_root: string | null;
  last_signature_at: string | null;
  open_batch_receipt_count: number;
  signed_batch_count: number;
  verification_success_rate: number;
  generations_by_day: Array<{ date: string; count: number; credits: number; tokens?: number }>;
  model_usage: Array<{ model_name: string; count: number; credits: number }>;
  latest_requests: ReceiptListItem[];
  recent_batches?: BatchSummary[];
  user?: AuthUser;
}

export async function fetchReceiptsList(limit = 50): Promise<ReceiptListItem[]> {
  const res = await apiFetch(`${API_BASE}/receipts?limit=${limit}`, { headers: apiHeaders() });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) {
    if (res.status === 401) throw new Error("Please sign in to continue");
    throw new Error("Failed to load receipts");
  }
  const data = await res.json();
  return data.receipts;
}

export function estimateMaxCredits(maxTokens: number, prompt = "", rate = CREDIT_RATE): number {
  return estimateGenerationCost(prompt, maxTokens, rate);
}

export async function fetchCreditStatement(limit = 50): Promise<{
  balance: number;
  transactions: CreditTransaction[];
}> {
  const res = await apiFetch(`${API_BASE}/billing/statement?limit=${limit}`, {
    headers: apiHeaders(),
  });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) throw new Error("Failed to load credit statement");
  return res.json();
}

export async function supportLookup(params: {
  email?: string;
  request_id?: string;
  limit?: number;
}): Promise<{ user: Record<string, unknown> | null; generations: SupportGeneration[] }> {
  const q = new URLSearchParams();
  if (params.email) q.set("email", params.email);
  if (params.request_id) q.set("request_id", params.request_id);
  if (params.limit) q.set("limit", String(params.limit));
  const res = await apiFetch(`${API_BASE}/admin/support/lookup?${q}`, { headers: apiHeaders() });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Lookup failed");
  }
  return res.json();
}

export async function adjustUserCredits(
  token: string,
  userId: string,
  amount: number,
  reason: string,
): Promise<void> {
  const res = await apiFetch(`${API_BASE}/admin/support/users/${userId}/credits`, {
    method: "POST",
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ amount, reason }),
  });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Credit adjustment failed");
  }
}

export async function createDispute(requestId: string, reason: string): Promise<Dispute> {
  const res = await apiFetch(`${API_BASE}/disputes`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ request_id: requestId, reason }),
  });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Could not submit dispute");
  }
  return res.json();
}

export async function fetchSupportDisputes(status?: string): Promise<Dispute[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await apiFetch(`${API_BASE}/admin/support/disputes${q}`, { headers: apiHeaders() });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) throw new Error("Failed to load disputes");
  const data = await res.json();
  return data.disputes;
}

export async function updateDispute(
  disputeId: string,
  status: string,
  resolutionNote?: string,
): Promise<Dispute> {
  const res = await apiFetch(`${API_BASE}/admin/support/disputes/${disputeId}`, {
    method: "PATCH",
    headers: apiHeaders(),
    body: JSON.stringify({ status, resolution_note: resolutionNote || null }),
  });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Update failed");
  }
  return res.json();
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

/** Verify using authoritative receipt data from the server (avoids browser cache issues). */
export async function verifyStoredReceipt(id: string): Promise<VerifyResult> {
  let res = await apiFetch(`${API_BASE}/receipts/${id}/verify`, {
    method: "POST",
    headers: apiHeaders(),
  });
  if (res?.status === 404) {
    res = await apiFetch(`${API_BASE}/receipts/by-request/${id}/verify`, {
      method: "POST",
      headers: apiHeaders(),
    });
  }
  if (!res) throw new ApiConnectionError();
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Verification failed");
  }
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

export async function fetchPlatformStats(): Promise<AdminStats> {
  const res = await apiFetch(`${API_BASE}/admin/platform-stats`, { headers: apiHeaders() });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to load platform stats");
  }
  return res.json();
}

export async function fetchAdminUserStats(userId: string): Promise<AdminStats> {
  const res = await apiFetch(`${API_BASE}/admin/users/${userId}/stats`, {
    headers: apiHeaders(),
  });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = typeof err.detail === "string" ? err.detail : null;
    if (res.status === 404) {
      throw new Error(detail || "User stats API not found. Restart the backend on your VPS.");
    }
    throw new Error(detail || "Failed to load user stats");
  }
  return res.json();
}

export async function fetchPublicKey() {
  const res = await apiFetch(`${API_BASE}/admin/public-key`, { headers: apiHeaders() });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) throw new Error("Failed to load public key");
  return res.json();
}

export async function fetchCurrentBatch() {
  const res = await apiFetch(`${API_BASE}/batches/current`, { headers: apiHeaders() });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) throw new Error("Failed to load current batch");
  return res.json();
}

export async function loadBatchList(): Promise<{ batches: BatchSummary[]; staleBackend?: boolean }> {
  try {
    const data = await fetchBatches();
    return { batches: data.batches };
  } catch {
    // Fallback: stats includes recent_batches on newer backends; current batch always available
    try {
      const stats = await fetchAdminStats();
      if (stats.recent_batches?.length) {
        return { batches: stats.recent_batches };
      }
      const current = await fetchCurrentBatch();
      if (current.batch_id) {
        return {
          batches: [
            {
              batch_id: current.batch_id,
              batch_number: current.batch_number,
              status: current.status,
              receipt_count: current.receipt_count,
              merkle_root: current.merkle_root ?? null,
              sealed_at: null,
              created_at: new Date().toISOString(),
            },
          ],
          staleBackend: true,
        };
      }
    } catch {
      // ignore
    }
    throw new Error("Failed to load batches. Stop the app (Ctrl+C), run npm run free-port, then npm run dev");
  }
}

export async function fetchBatches(): Promise<{ batches: BatchSummary[] }> {
  const res = await apiFetch(`${API_BASE}/batches`, { headers: apiHeaders() });
  if (!res) throw new ApiConnectionError();
  if (res.status === 404) {
    throw new Error("Batches API missing. Restart the app: npm run dev");
  }
  if (!res.ok) throw new Error("Failed to load batches");
  return res.json();
}

export async function fetchBatch(batchId: string) {
  const res = await apiFetch(`${API_BASE}/batches/${batchId}`, { headers: apiHeaders() });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) throw new Error("Failed to load batch");
  return res.json();
}

export async function downloadReceiptPackage(receiptId: string, filename?: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  const res = await apiFetch(`${API_BASE}/receipts/${receiptId}/package`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res) throw new ApiConnectionError();
  if (!res.ok) throw new Error("Failed to download package");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `receipt-${receiptId}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export function truncateHash(value: string | undefined | null, len = 8): string {
  if (!value) return "-";
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
