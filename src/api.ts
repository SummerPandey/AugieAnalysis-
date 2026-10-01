/**
 * Client for the real Augustana MMM backend (FastAPI + Supabase).
 * Set VITE_API_URL to point at a deployed backend; defaults to localhost
 * for local development against `uvicorn backend.main:app`.
 */

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

export interface MulticollinearityDiagnostics {
  condition_number?: number
  high_condition_number?: boolean
  vif?: Record<string, number>
  high_vif_features?: Record<string, number>
  warning?: string | null
  note?: string
}

export interface WeeklyPoint {
  date: string
  actual: number
  predicted: number
}

export interface ChannelContributionPoint {
  date: string
  baseline: number
  impressions?: number
  [channel: string]: string | number | undefined
}

export interface PipelineResult {
  rows: number
  date_range: [string, string]
  spend_channels: string[]
  spend_coverage: { weeks_covered: number; total_weeks: number } | null
  features_used: string[]
  selected_ridge_alpha: number
  in_sample_metrics: Record<string, number>
  cross_validation: { per_fold_r2: number[]; mean_r2: number; std_r2: number }
  coefficients: Record<string, number>
  multicollinearity: MulticollinearityDiagnostics
  weekly: WeeklyPoint[]
  channel_contribution_weekly: ChannelContributionPoint[]
}

export interface InsightsResult {
  pipeline_result: PipelineResult
  commentary: string
}

/** The session token was rejected (expired or signed out elsewhere). */
export class AuthError extends Error {
  constructor(message = "Your session has expired. Sign in again to continue.") {
    super(message)
    this.name = "AuthError"
  }
}

/** Turn FastAPI's `detail` (a string, or a list of validation errors) into one sentence. */
function detailText(detail: unknown): string | null {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    const msgs = detail.map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : "")).filter(Boolean)
    return msgs.length ? msgs.join("; ") : null
  }
  return null
}

async function handle<T>(resp: Response, what: string): Promise<T> {
  if (resp.ok) return resp.json() as Promise<T>
  let detail: string | null = null
  try {
    detail = detailText((await resp.json()).detail)
  } catch {
    // not JSON; fall through to the status-based message
  }
  if (resp.status === 401 || resp.status === 403) throw new AuthError()
  if (resp.status === 422) throw new Error(detail ? `The server couldn't use that request: ${detail}.` : "The server couldn't use that request.")
  if (resp.status === 429) throw new Error("Too many requests right now. Wait a minute and try again.")
  if (resp.status === 502 || resp.status === 503 || resp.status === 504)
    throw new Error(`${what} is temporarily unavailable (${resp.status}). Try again in a minute.`)
  if (resp.status >= 500) throw new Error(`${what} hit a server error (${resp.status}). Try again; if it keeps happening, let Summer know.`)
  throw new Error(detail ?? `${what} failed (${resp.status}).`)
}

/** fetch with a timeout and a plain-language network error. */
async function request(url: string, init: RequestInit, timeoutMs: number, what: string): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError")
      throw new Error(`${what} took longer than ${Math.round(timeoutMs / 1000)} seconds. Try again.`)
    throw new Error("Can't reach the Augie Analysis server. Check your connection, or try again in a minute.")
  } finally {
    clearTimeout(timer)
  }
}

export interface LoginResult {
  token: string
  email: string | null
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const resp = await request(
    `${API_BASE}/api/auth/login`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) },
    20_000,
    "Signing in",
  )
  if (resp.status === 400 || resp.status === 401) {
    let detail: string | null = null
    try {
      detail = detailText((await resp.json()).detail)
    } catch {
      // ignore
    }
    throw new Error(detail && !/invalid/i.test(detail) ? detail : "That email and password don't match an account.")
  }
  const data = await handle<{ email: string | null; session: { access_token: string } | null }>(resp, "Signing in")
  if (!data.session) {
    throw new Error("Signed in, but no session was issued. The account may still need its email confirmed.")
  }
  return { token: data.session.access_token, email: data.email }
}

const authed = (token: string) => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` })

export async function runPipeline(token: string): Promise<PipelineResult> {
  const resp = await request(
    `${API_BASE}/api/pipeline/run`,
    { method: "POST", headers: authed(token), body: JSON.stringify({}) },
    90_000,
    "The model run",
  )
  return handle<PipelineResult>(resp, "The model run")
}

export async function getInsights(token: string, question?: string): Promise<InsightsResult> {
  const resp = await request(
    `${API_BASE}/api/insights`,
    { method: "POST", headers: authed(token), body: JSON.stringify(question ? { question } : {}) },
    120_000,
    "The AI readout",
  )
  return handle<InsightsResult>(resp, "The AI readout")
}

export interface ChatTurn {
  role: "user" | "assistant"
  content: string
}

export async function sendChatMessage(message: string, history: ChatTurn[], token?: string | null): Promise<string> {
  const resp = await request(
    `${API_BASE}/api/chat`,
    {
      method: "POST",
      headers: token ? authed(token) : { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    },
    45_000,
    "The assistant",
  )
  const data = await handle<{ reply: string }>(resp, "The assistant")
  return data.reply
}
