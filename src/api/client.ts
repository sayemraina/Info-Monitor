// API client — switches between static file mode and FastAPI server mode
// based on VITE_API_BASE_URL environment variable.
//
// Static mode (demo, no server needed):
//   VITE_API_BASE_URL is unset → BASE = '' → fetches /data/... directly from Vite
//
// Server mode (live topic input):
//   VITE_API_BASE_URL=http://localhost:8000 → BASE = 'http://localhost:8000'
//   FastAPI also serves /data/... so URL paths are identical in both modes.

const BASE: string = import.meta.env.VITE_API_BASE_URL ?? ''

export const serverMode: boolean = Boolean(import.meta.env.VITE_API_BASE_URL)

export interface IngestRequest {
  topic_id: string
  name: string
  query: string
  use_synthetic?: boolean
}

export interface JobStatus {
  job_id: string
  topic_id: string
  status: 'pending' | 'running' | 'complete' | 'failed'
  step: 'ingest' | 'extract' | 'embed' | 'cluster' | 'metrics' | 'done'
  progress_pct: number
  error: string | null
}

export const api = {
  getTopics: (): Promise<Response> =>
    fetch(`${BASE}/data/topics.json`),

  getLandscape: (topicId: string, window: string): Promise<Response> =>
    fetch(`${BASE}/data/metrics/${topicId}/landscape_${window}.json`),

  getClaimDetail: (topicId: string, claimId: string): Promise<Response> =>
    fetch(`${BASE}/data/metrics/${topicId}/claims/${claimId}.json`),

  getCompare: (topicId: string, sliceA: string, sliceB: string, window: string): Promise<Response> =>
    fetch(`${BASE}/data/metrics/${topicId}/compare/${sliceA}_${sliceB}_${window}.json`),

  getTimeline: (topicId: string, window: string): Promise<Response> =>
    fetch(`${BASE}/data/metrics/${topicId}/timeline_${window}.json`),

  // Server-mode only endpoints (Live Topic Input)
  postIngest: (body: IngestRequest): Promise<Response> =>
    fetch(`${BASE}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  getJobStatus: (jobId: string): Promise<Response> =>
    fetch(`${BASE}/api/ingest/${jobId}`),
}
