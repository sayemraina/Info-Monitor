import { useEffect, useState } from 'react'
import { useAIGuide } from '../../hooks/useAIGuide'
import { AIGuidePacingChoice } from './AIGuidePacingChoice'

export function AIGuideModal() {
  const { isModalOpen, closeModal, messages, sendMessage, pacingMode, isStreaming } = useAIGuide()
  const [inputValue, setInputValue] = useState('')

  // Close on ESC key
  useEffect(() => {
    if (!isModalOpen) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isModalOpen, closeModal])

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

  if (!isModalOpen) return null

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-lg animate-in fade-in duration-300"
        onClick={closeModal}
      />

      {/* Modal */}
      <div
        className={`
          relative bg-gray-900 rounded-xl border border-gray-800
          shadow-[0_20px_60px_rgba(0,0,0,0.8)]
          animate-in fade-in zoom-in-95 duration-300
          flex flex-col
          origin-bottom-right
          ${pacingMode === null
            ? 'w-[600px] h-[500px]'
            : 'w-[480px] max-h-[60vh]'
          }
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {pacingMode === null ? (
          // Show pacing choice screen
          <AIGuidePacingChoice />
        ) : (
          <>
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
              <h2 className="text-lg font-semibold text-white">AI Guide</h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Close"
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
                  Ask me anything about this topic, or type "help" to see what I can do.
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
                          max-w-[80%] px-4 py-2 rounded-lg
                          ${msg.role === 'user'
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

            {/* Input area */}
            <div className="p-4 border-t border-gray-800 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything..."
                  className="
                    flex-1 px-4 py-2 rounded-lg
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
                    text-white font-medium
                    transition-colors
                  "
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
