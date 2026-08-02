export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export type UserRole = "reviewer" | "admin";

export type CandidateStatus = "new" | "reviewed" | "hired" | "rejected" | "archived";

export interface User {
  id: number;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Score {
  id: number;
  candidate_id: number;
  category: string;
  score: number;
  note: string | null;
  reviewer_id: number;
  reviewer_email: string | null;
  created_at: string;
}

export interface ScorePayload {
  category: string;
  score: number;
  note?: string | null;
}

export interface CandidateSummary {
  id: number;
  name: string;
  email: string;
  role_applied: string;
  status: CandidateStatus;
  skills: string[];
  created_at: string;
}

export interface CandidateDetail extends CandidateSummary {
  internal_notes: string | null;
  ai_summary: string | null;
  ai_summary_generated_at: string | null;
  updated_at: string;
  scores: Score[];
}

export interface CandidateListResponse {
  items: CandidateSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface CandidateOptions {
  roles: string[];
  skills: string[];
  statuses: CandidateStatus[];
}

export interface CandidateCreatePayload {
  name: string;
  email: string;
  role_applied: string;
  skills: string[];
}

export interface CandidateUpdatePayload {
  name?: string;
  email?: string;
  role_applied?: string;
  status?: CandidateStatus;
  skills?: string[];
  internal_notes?: string | null;
}

export interface CandidateListFilters {
  status?: string;
  role_applied?: string;
  skill?: string;
  keyword?: string;
  page?: number;
  page_size?: number;
}

export interface SummaryOut {
  ai_summary: string;
}

export interface Message {
  detail: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  // Auth is carried by an httpOnly cookie the backend sets on login, never
  // touched by JS — credentials:"include" sends it automatically on every
  // request instead of attaching a Bearer header from localStorage.
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include" });

  if (res.status === 401) {
    // The cookie is missing/expired server-side even though localStorage
    // still thinks we're logged in (e.g. token expired, or cleared out of
    // band). Drop the stale local session and bounce to login instead of
    // leaving the user stuck looking at a raw error on the current page.
    clearSession();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // no JSON body
    }
    throw new Error(detail);
  }

  if (res.status === 204) return null as T;
  return res.json();
}

export const api = {
  register: (email: string, password: string) =>
    request<User>("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<Message>("/auth/logout", { method: "POST" }),
  me: () => request<User>("/auth/me"),

  getCandidateOptions: () => request<CandidateOptions>("/candidates/options"),
  listCandidates: (params: CandidateListFilters) => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== "" && v != null) as [string, string][]
      )
    );
    return request<CandidateListResponse>(`/candidates?${query.toString()}`);
  },
  createCandidate: (payload: CandidateCreatePayload) =>
    request<CandidateDetail>("/candidates", { method: "POST", body: JSON.stringify(payload) }),
  getCandidate: (id: number | string) => request<CandidateDetail>(`/candidates/${id}`),
  updateCandidate: (id: number | string, payload: CandidateUpdatePayload) =>
    request<CandidateDetail>(`/candidates/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  archiveCandidate: (id: number | string) =>
    request<Message>(`/candidates/${id}`, { method: "DELETE" }),
  generateSummary: (id: number | string) =>
    request<SummaryOut>(`/candidates/${id}/summary`, { method: "POST" }),
  submitScore: (id: number | string, payload: ScorePayload) =>
    request<Score>(`/candidates/${id}/scores`, { method: "POST", body: JSON.stringify(payload) }),
};

// The access token itself lives only in an httpOnly cookie set by the
// backend — JS never sees it. localStorage here only mirrors the
// non-sensitive `user` object (email/role) so the UI can render
// synchronously without waiting on a network round-trip, plus a plain
// "was logged in" flag for client-side route guarding. The cookie is what
// actually authorizes requests; this flag is just a UI hint.

export function saveSession(user: User): void {
  localStorage.setItem("authed", "1");
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem("authed");
  localStorage.removeItem("user");
}

export function getSession(): { isAuthed: boolean; user: User | null } {
  const rawUser = localStorage.getItem("user");
  return { isAuthed: localStorage.getItem("authed") === "1", user: rawUser ? JSON.parse(rawUser) : null };
}
