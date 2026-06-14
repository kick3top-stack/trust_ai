import { API_BASE } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

function authHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseAuthError(res: Response): Promise<string> {
  if (res.status === 404) {
    return "Auth API not available. Restart the app: npm run dev";
  }
  const err = await res.json().catch(() => ({}));
  const detail = err.detail;
  if (typeof detail === "string") return detail;
  if (res.status === 401) return "Please sign in to continue";
  return "Request failed";
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await parseAuthError(res));
  return res.json();
}

export async function registerUser(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
  if (!res.ok) throw new Error(await parseAuthError(res));
  return res.json();
}

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseAuthError(res));
  return res.json();
}

export async function updateProfile(
  token: string,
  body: { display_name?: string; password?: string },
): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseAuthError(res));
  return res.json();
}

export async function fetchUsers(token: string): Promise<AuthUser[]> {
  const res = await fetch(`${API_BASE}/users`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseAuthError(res));
  return res.json();
}

export async function adminUpdateUser(
  token: string,
  userId: string,
  body: { role?: string; is_active?: boolean; display_name?: string },
): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseAuthError(res));
  return res.json();
}
