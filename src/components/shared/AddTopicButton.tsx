import { useState, useEffect, useRef } from 'react'
import { api, serverMode } from '../../api/client'
import type { JobStatus } from '../../api/client'

interface AddTopicButtonProps {
  onTopicAdded: (topicId: string) => void
  refetchTopics: () => void
}

const STEPS: { key: JobStatus['step']; label: string }[] = [
  { key: 'ingest',   label: 'Ingest'   },
  { key: 'extract',  label: 'Extract'  },
  { key: 'embed',    label: 'Embed'    },
  { key: 'cluster',  label: 'Cluster'  },
  { key: 'metrics',  label: 'Metrics'  },
]

const STEP_ORDER: Record<string, number> = {
  ingest: 0, extract: 1, embed: 2, cluster: 3, metrics: 4, done: 5,
}

export function AddTopicButton({ onTopicAdded, refetchTopics }: AddTopicButtonProps) {
  const [open, setOpen] = useState(false)
  const [topicId, setTopicId] = useState('')
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [useSynthetic, setUseSynthetic] = useState(false)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup on unmount — must be before any conditional returns (Rules of Hooks)
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  // Only render in server mode
  if (!serverMode) return null

  const resetForm = () => {
    setTopicId('')
    setName('')
    setQuery('')
    setUseSynthetic(false)
    setJobStatus(null)
    setSubmitError(null)
    setSubmitting(false)
    if (pollRef.current) clearInterval(pollRef.current)
  }

  const closeModal = () => {
    resetForm()
    setOpen(false)
  }

  const handleSubmit = async (syntheticOverride?: boolean) => {
    setSubmitError(null)
    setSubmitting(true)
    const synthetic = syntheticOverride ?? useSynthetic

    try {
      const res = await api.postIngest({
        topic_id: topicId.trim().toLowerCase(),
        name: name.trim(),
        query: query.trim(),
        use_synthetic: synthetic,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: 'Unknown error' }))
        setSubmitError(data.detail ?? 'Request failed')
        setSubmitting(false)
        return
      }
      const { job_id } = await res.json()
      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await api.getJobStatus(job_id)
          if (!statusRes.ok) return
          const status: JobStatus = await statusRes.json()
          setJobStatus(status)
          if (status.status === 'complete') {
            if (pollRef.current) clearInterval(pollRef.current)
            refetchTopics()
            setTimeout(() => {
              onTopicAdded(status.topic_id)
              closeModal()
            }, 800)
          } else if (status.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current)
            setSubmitting(false)
          }
        } catch {
          // Network hiccup — keep polling
        }
      }, 2000)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Request failed')
      setSubmitting(false)
    }
  }

  const currentStepIdx = jobStatus ? (STEP_ORDER[jobStatus.step] ?? 0) : -1
  const isRunning = submitting && jobStatus?.status !== 'failed'

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors cursor-pointer"
        style={{
          border: '1px solid var(--color-border)',
          color: 'var(--color-cyan)',
          backgroundColor: 'transparent',
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(6,182,212,0.08)' }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        <span style={{ fontSize: '14px', lineHeight: 1 }}>＋</span>
        <span>Add Topic</span>
      </button>

      {/* Modal backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div
            className="w-full max-w-md rounded-lg p-5 shadow-2xl"
            style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Add New Topic
              </h2>
              <button
                onClick={closeModal}
                className="text-xs px-1 cursor-pointer"
                style={{ color: 'var(--color-text-muted)' }}
                disabled={isRunning}
              >
                ✕
              </button>
            </div>

            {/* Form — hidden once job starts */}
            {!jobStatus && !isRunning && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Topic ID (slug)
                  </label>
                  <input
                    type="text"
                    value={topicId}
                    onChange={e => setTopicId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="e.g. crypto-regulation"
                    className="w-full h-8 px-3 rounded text-xs border outline-none focus:border-cyan-500"
                    style={{
                      backgroundColor: 'var(--color-bg-primary)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Cryptocurrency Regulation"
                    className="w-full h-8 px-3 rounded text-xs border outline-none focus:border-cyan-500"
                    style={{
                      backgroundColor: 'var(--color-bg-primary)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Search Query
                  </label>
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="e.g. crypto bitcoin regulation SEC policy"
                    className="w-full h-8 px-3 rounded text-xs border outline-none focus:border-cyan-500"
                    style={{
                      backgroundColor: 'var(--color-bg-primary)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>

                {/* Synthetic toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useSynthetic}
                    onChange={e => setUseSynthetic(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                    Use modeled data (no API keys required)
                  </span>
                </label>

                {submitError && (
                  <p className="text-[10px] px-2 py-1.5 rounded" style={{ color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.08)' }}>
                    {submitError}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={closeModal}
                    className="flex-1 h-8 rounded text-xs cursor-pointer"
                    style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSubmit()}
                    disabled={!topicId.trim() || !name.trim() || !query.trim()}
                    className="flex-1 h-8 rounded text-xs font-medium transition-opacity cursor-pointer disabled:opacity-40"
                    style={{ backgroundColor: 'var(--color-cyan)', color: '#0A0E17' }}
                  >
                    Start Pipeline
                  </button>
                </div>
              </div>
            )}

            {/* Progress view — shown while job is running or complete */}
            {(isRunning || jobStatus) && (
              <div className="space-y-4">
                {/* Step indicators */}
                <div className="flex justify-between">
                  {STEPS.map((step, i) => {
                    const done = currentStepIdx > i
                    const active = currentStepIdx === i && jobStatus?.status !== 'failed'
                    const failed = jobStatus?.status === 'failed' && currentStepIdx === i
                    return (
                      <div key={step.key} className="flex flex-col items-center gap-1">
                        <div
                          className="w-2.5 h-2.5 rounded-full transition-all"
                          style={{
                            backgroundColor: failed ? '#EF4444' : done ? 'var(--color-cyan)' : active ? '#F59E0B' : 'var(--color-border)',
                            boxShadow: active ? '0 0 6px #F59E0B' : done ? '0 0 4px var(--color-cyan)' : 'none',
                          }}
                        />
                        <span
                          className="text-[9px]"
                          style={{ color: done || active ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}
                        >
                          {step.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${jobStatus?.progress_pct ?? 2}%`,
                      backgroundColor: jobStatus?.status === 'failed' ? '#EF4444' : 'var(--color-cyan)',
                    }}
                  />
                </div>

                {/* Status text */}
                <p className="text-xs text-center" style={{ color: 'var(--color-text-secondary)' }}>
                  {jobStatus?.status === 'complete'
                    ? '✓ Complete — loading topic...'
                    : jobStatus?.status === 'failed'
                      ? '✗ Pipeline failed'
                      : `Running ${jobStatus?.step ?? 'pipeline'}...`}
                </p>

                {/* Error detail + synthetic fallback */}
                {jobStatus?.status === 'failed' && (
                  <div className="space-y-2">
                    {jobStatus.error && (
                      <p
                        className="text-[9px] font-mono px-2 py-1.5 rounded overflow-auto max-h-20"
                        style={{ color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.08)' }}
                      >
                        {jobStatus.error}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={closeModal}
                        className="flex-1 h-7 rounded text-xs cursor-pointer"
                        style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          setJobStatus(null)
                          setSubmitting(false)
                          handleSubmit(true)
                        }}
                        className="flex-1 h-7 rounded text-xs cursor-pointer"
                        style={{ border: '1px solid #F59E0B', color: '#F59E0B' }}
                      >
                        Retry with modeled data
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
