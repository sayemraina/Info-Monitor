import { useState } from 'react'
import { useAIGuide } from '../../hooks/useAIGuide'
import { AIGuideModeSwither } from './AIGuideModeSwither'
import { IsolatedCluster } from './IsolatedCluster'
import { IsolatedTimelineEvent } from './IsolatedTimelineEvent'
import type { Cluster, NarrativeEvent } from '../../types'

export function AIGuideQueryMode() {
  const {
    switchMode,
    briefingMode,
    messages,
    sendMessage,
    focusedComponent,
    isStreaming,
  } = useAIGuide()
  const [inputValue, setInputValue] = useState('')

  const handleSend = async () => {
    if (!inputValue.trim() || isStreaming) return
    await sendMessage(inputValue)
    setInputValue('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Format timestamp for log entries
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  // Decide layout: modal (no component) or split (with component)
  const useSplitLayout = focusedComponent !== null

  if (useSplitLayout) {
    // Split layout: component on left, chat on right (like auto-sequence)
    return (
      <div className="fixed inset-0 flex">
        {/* Left: Component (70%) */}
        <div className="relative w-[70%] bg-black flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/20 pointer-events-none" />

          <div className="relative z-10">
            {focusedComponent.type === 'cluster' && (
              <IsolatedCluster
                cluster={focusedComponent.data as Cluster}
                topicName={focusedComponent.topicName}
              />
            )}
            {focusedComponent.type === 'event' && (
              <IsolatedTimelineEvent
                event={focusedComponent.data as NarrativeEvent}
                topicName={focusedComponent.topicName}
              />
            )}
          </div>
        </div>

        {/* Right: Chat panel - Zone B style */}
        <div
          className="relative w-[30%] flex flex-col rounded-lg"
          style={{
            backgroundColor: '#0F1923',
            border: '1px solid rgba(148,163,184,0.06)',
            margin: '8px',
          }}
        >
          <QueryPanel
            switchMode={switchMode}
            briefingMode={briefingMode}
            messages={messages}
            inputValue={inputValue}
            setInputValue={setInputValue}
            handleSend={handleSend}
            handleKeyPress={handleKeyPress}
            isStreaming={isStreaming}
            formatTime={formatTime}
          />
        </div>
      </div>
    )
  }

  // Modal layout: centered panel
  return (
    <div className="fixed inset-0 flex items-center justify-center px-8">
      <div
        className="rounded-lg w-full max-w-2xl max-h-[70vh] flex flex-col"
        style={{
          backgroundColor: '#0F1923',
          border: '1px solid rgba(148,163,184,0.06)',
        }}
      >
        <QueryPanel
          switchMode={switchMode}
          briefingMode={briefingMode}
          messages={messages}
          inputValue={inputValue}
          setInputValue={setInputValue}
          handleSend={handleSend}
          handleKeyPress={handleKeyPress}
          isStreaming={isStreaming}
          formatTime={formatTime}
        />
      </div>
    </div>
  )
}

// Shared panel component for both layouts
function QueryPanel({
  switchMode,
  briefingMode,
  messages,
  inputValue,
  setInputValue,
  handleSend,
  handleKeyPress,
  isStreaming,
  formatTime,
}: {
  switchMode: (mode: any) => void
  briefingMode: any
  messages: any[]
  inputValue: string
  setInputValue: (value: string) => void
  handleSend: () => void
  handleKeyPress: (e: React.KeyboardEvent) => void
  isStreaming: boolean
  formatTime: (date: Date) => string
}) {
  return (
    <>
      {/* Mode switcher */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid rgba(148,163,184,0.06)',
        }}
      >
        <AIGuideModeSwither currentMode={briefingMode} onSwitch={switchMode} />
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-3" style={{ padding: '12px' }}>
        <div style={{ marginBottom: '8px' }}>
          <span
            className="font-mono uppercase"
            style={{
              fontSize: '9px',
              color: '#64748B',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            Query Log
          </span>
        </div>

        {messages.length === 0 ? (
          <p style={{ fontSize: '11px', color: '#94A3B8', lineHeight: '1.5' }}>
            Ask me anything about the signals you're seeing.
          </p>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div className="flex items-start gap-2" style={{ marginBottom: '4px' }}>
                  <span
                    className="font-mono"
                    style={{ fontSize: '9px', color: '#64748B' }}
                  >
                    [{formatTime(new Date())}]
                  </span>
                  <span
                    className="font-mono uppercase"
                    style={{
                      fontSize: '9px',
                      color: msg.role === 'user' ? '#3B82F6' : msg.isError ? '#EF4444' : '#F59E0B',
                      fontWeight: 600,
                    }}
                  >
                    {msg.role === 'user' ? 'USER:' : msg.isError ? 'ERROR:' : 'ANALYST:'}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: msg.isError ? '#EF4444' : '#CBD5E1',
                    lineHeight: '1.5',
                    marginLeft: '80px',
                    fontStyle: msg.isError ? 'italic' : 'normal',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isStreaming && (
              <div className="flex items-center gap-2" style={{ marginLeft: '80px' }}>
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#F59E0B',
                    boxShadow: '0 0 6px rgba(245,158,11,0.6)',
                  }}
                />
                <span
                  className="font-mono uppercase"
                  style={{ fontSize: '9px', color: '#F59E0B' }}
                >
                  Processing query...
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input area */}
      <div
        style={{
          borderTop: '1px solid rgba(148,163,184,0.06)',
          padding: '12px',
        }}
      >
        <div style={{ marginBottom: '8px' }}>
          <span
            className="font-mono uppercase"
            style={{
              fontSize: '9px',
              color: '#64748B',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            Query:
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask about signals, patterns, or specific components..."
            disabled={isStreaming}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '11px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(148,163,184,0.15)',
              borderRadius: '4px',
              color: '#F1F5F9',
              transition: 'all 200ms ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(6,182,212,0.4)'
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(148,163,184,0.15)'
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isStreaming}
            className="font-mono uppercase"
            style={{
              padding: '8px 16px',
              fontSize: '9px',
              background: '#F59E0B',
              border: 'none',
              borderRadius: '4px',
              color: '#0F1923',
              cursor: !inputValue.trim() || isStreaming ? 'not-allowed' : 'pointer',
              opacity: !inputValue.trim() || isStreaming ? 0.4 : 1,
              transition: 'all 200ms ease',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
            onMouseEnter={(e) => {
              if (inputValue.trim() && !isStreaming) {
                e.currentTarget.style.background = 'rgba(245,158,11,0.9)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#F59E0B'
            }}
          >
            Send
          </button>
        </div>

        {/* Switch mode options */}
        <div className="flex gap-2" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(148,163,184,0.06)' }}>
          <button
            onClick={() => switchMode('auto-sequence')}
            className="font-mono uppercase flex-1"
            style={{
              fontSize: '9px',
              padding: '8px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(148,163,184,0.15)',
              color: '#94A3B8',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 200ms ease',
              letterSpacing: '0.05em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.color = '#CBD5E1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
              e.currentTarget.style.color = '#94A3B8'
            }}
          >
            → Auto-Sequence
          </button>
          <button
            onClick={() => switchMode('ambient')}
            className="font-mono uppercase flex-1"
            style={{
              fontSize: '9px',
              padding: '8px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(148,163,184,0.15)',
              color: '#94A3B8',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 200ms ease',
              letterSpacing: '0.05em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.color = '#CBD5E1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
              e.currentTarget.style.color = '#94A3B8'
            }}
          >
            → Ambient
          </button>
        </div>
      </div>
    </>
  )
}
