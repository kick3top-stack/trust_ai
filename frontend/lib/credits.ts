const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const TOKEN_KEY = "trustai_token";

export const DEFAULT_CREDIT_RATE = 0.01;

export interface BillingConfig {
  credit_rate: number;
  tokens_per_credit: number;
  min_credits: number;
}

let cachedConfig: BillingConfig | null = null;

export function estimatePromptTokens(prompt: string): number {
  const text = prompt.trim();
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function computeCreditCost(totalTokens: number, rate = DEFAULT_CREDIT_RATE): number {
  if (totalTokens <= 0) return 1;
  return Math.max(1, Math.ceil(totalTokens * rate));
}

export function estimateGenerationCost(
  prompt: string,
  maxTokens: number,
  rate = DEFAULT_CREDIT_RATE,
): number {
  return computeCreditCost(estimatePromptTokens(prompt) + Math.max(0, maxTokens), rate);
}

export async function fetchBillingConfig(): Promise<BillingConfig> {
  if (cachedConfig) return cachedConfig;
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/billing/config`, { headers });
  if (!res.ok) throw new Error("Failed to load billing config");
  cachedConfig = await res.json();
  return cachedConfig!;
}

export function formatCreditRule(config: BillingConfig): string {
  return `1 credit per ${config.tokens_per_credit} tokens (rounded up), minimum ${config.min_credits} credit`;
}
