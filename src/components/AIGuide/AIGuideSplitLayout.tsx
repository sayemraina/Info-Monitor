import { useState } from 'react'
import { useAIGuide } from '../../hooks/useAIGuide'
import { IsolatedCluster } from './IsolatedCluster'
import { IsolatedTimelineEvent } from './IsolatedTimelineEvent'
import type { Cluster, NarrativeEvent } from '../../types'

export function AIGuideSplitLayout() {
  const {
    exitJourney,
    messages,
    sendMessage,
    focusedComponent,
    pacingMode,
    tourPaused,
    pauseTour,
    resumeTour,
    nextStep,
    currentStepIndex,
    tourSteps,
    isStreaming,
  } = useAIGuide()
  const [inputValue, setInputValue] = useState('')

  const handleSend = async () => {
    if (!inputValue.trim()) return
    await sendMessage(inputValue)
    setInputValue('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex">
      {/* Black background isolation */}
      <div className="absolute inset-0 bg-black" />

      {/* Left side: Component being taught (70%) */}
      <div className="relative w-[70%] flex items-center justify-center">
        {/* Vignette spotlight effect (20% dim around edges) */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/20 pointer-events-none" />

        {focusedComponent ? (
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
            {focusedComponent.type === 'claim' && (
              <div className="text-gray-400 text-center">
                <p className="text-sm">Claim isolation coming in Phase 5</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-500 text-center">
            <p className="text-sm">No component selected</p>
          </div>
        )}
      </div>

      {/* Right side: Chat (30%) */}
      <div className="relative w-[30%] bg-gray-900 border-l border-gray-800 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">AI Guide</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {pacingMode === 'auto-tour'
                ? 'Guided Tour'
                : pacingMode === 'qa-mode'
                  ? 'Ask Questions'
                  : 'Explorer Mode'}
            </p>
          </div>
          <button
            onClick={exitJourney}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Exit AI Guide"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <p className="text-gray-400 text-sm">
              {pacingMode === 'auto-tour'
                ? "I'll guide you through the key signals. Let's begin..."
                : pacingMode === 'qa-mode'
                  ? 'Ask me anything about this topic.'
                  : "Browse around. I'm here when you need me."}
            </p>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`
                      max-w-[85%] px-4 py-2 rounded-lg text-sm
                      ${
                        msg.role === 'user'
                          ? 'bg-cyan-600 text-white'
                          : msg.isError
                            ? 'bg-red-900/50 text-red-200 border border-red-700'
                            : 'bg-gray-800 text-gray-100'
                      }
                    `}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 text-gray-400 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                    <span>Thinking</span>
                    <span className="flex gap-1">
                      <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Input area (only show for qa-mode and focus-mode) */}
        {(pacingMode === 'qa-mode' || pacingMode === 'focus-mode') && (
          <div className="p-4 border-t border-gray-800 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="
                  flex-1 px-4 py-2 rounded-lg text-sm
                  bg-gray-800 border border-gray-700
                  text-white placeholder-gray-500
                  focus:outline-none focus:border-cyan-500
                  transition-colors
                "
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isStreaming}
                className="
                  px-4 py-2 rounded-lg
                  bg-cyan-600 hover:bg-cyan-700
                  disabled:bg-gray-700 disabled:text-gray-500
                  text-white font-medium text-sm
                  transition-colors
                "
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* Auto-tour controls */}
        {pacingMode === 'auto-tour' && (
          <div className="p-4 border-t border-gray-800 shrink-0">
            {/* Progress indicator */}
            {tourSteps.length > 0 && (
              <div className="mb-3 text-center">
                <span className="text-xs text-gray-500">
                  Step {currentStepIndex + 1} of {tourSteps.length}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              {tourPaused ? (
                <button
                  onClick={resumeTour}
                  className="
                    flex-1 px-4 py-2 rounded-lg
                    bg-green-600 hover:bg-green-700
                    text-white text-sm font-medium
                    transition-colors
                  "
                >
                  Resume Tour
                </button>
              ) : (
                <button
                  onClick={pauseTour}
                  className="
                    flex-1 px-4 py-2 rounded-lg
                    bg-gray-800 hover:bg-gray-700
                    text-white text-sm font-medium
                    transition-colors
                  "
                >
                  Pause
                </button>
              )}
              <button
                onClick={nextStep}
                disabled={currentStepIndex >= tourSteps.length - 1}
                className="
                  flex-1 px-4 py-2 rounded-lg
                  bg-cyan-600 hover:bg-cyan-700
                  disabled:bg-gray-700 disabled:text-gray-500
                  text-white text-sm font-medium
                  transition-colors
                "
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
