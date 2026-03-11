interface InsufficientDataProps {
  message?: string
  detail?: string
}

/**
 * Honest fallback for metrics or panels that can't be computed.
 * Uses spec-compliant language: "Low contestation detected" not "No results",
 * "Estimated" not stated as fact, etc.
 */
export function InsufficientData({
  message = 'Insufficient data',
  detail,
}: InsufficientDataProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-1 py-3">
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {message}
      </p>
      {detail && (
        <p className="text-[10px] text-center max-w-[180px]" style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}>
          {detail}
        </p>
      )}
    </div>
  )
}
