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
}

export interface InsightsResult {
  pipeline_result: PipelineResult
  commentary: string
}

async function handle<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    let detail = resp.statusText || `HTTP ${resp.status}`
    try {
      const body = await resp.json()
      detail = body.detail ?? detail
    } catch {
      // response wasn't JSON — keep the status text
    }
    throw new Error(detail)
  }
  return resp.json() as Promise<T>
}

export async function login(email: string, password: string): Promise<string> {
  const resp = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const data = await handle<{ session: { access_token: string } | null }>(resp)
  if (!data.session) {
    throw new Error(
      "Login succeeded but no session was issued — the account may still need email confirmation.",
    )
  }
  return data.session.access_token
}

export async function runPipeline(token: string): Promise<PipelineResult> {
  const resp = await fetch(`${API_BASE}/api/pipeline/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  })
  return handle<PipelineResult>(resp)
}

export async function getInsights(
  token: string,
  question?: string,
): Promise<InsightsResult> {
  const resp = await fetch(`${API_BASE}/api/insights`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(question ? { question } : {}),
  })
  return handle<InsightsResult>(resp)
}
