const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

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

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

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

export function saveSession(token: string, user: User): void {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getSession(): { token: string | null; user: User | null } {
  const token = getToken();
  const rawUser = localStorage.getItem("user");
  return { token, user: rawUser ? JSON.parse(rawUser) : null };
}
