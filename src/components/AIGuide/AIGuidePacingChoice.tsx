import { useAIGuide } from '../../hooks/useAIGuide'

type PacingOption = {
  mode: 'auto-tour' | 'qa-mode' | 'focus-mode'
  title: string
  description: string
  icon: string
}

const OPTIONS: PacingOption[] = [
  {
    mode: 'auto-tour',
    title: 'Guided Tour',
    description: "I'll walk you through the key signals step by step. Sit back and learn.",
    icon: '🎯',
  },
  {
    mode: 'qa-mode',
    title: 'Ask Questions',
    description: "You drive. Ask me anything about what you're seeing.",
    icon: '💬',
  },
  {
    mode: 'focus-mode',
    title: 'Explorer Mode',
    description: "Browse freely. I'm here when you need me.",
    icon: '🔍',
  },
]

export function AIGuidePacingChoice() {
  const { setPacingMode, startJourney } = useAIGuide()

  const handleSelect = (mode: 'auto-tour' | 'qa-mode' | 'focus-mode') => {
    setPacingMode(mode)
    startJourney()
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12">
      <h2 className="text-2xl font-semibold text-white mb-3">
        How would you like to explore?
      </h2>
      <p className="text-gray-400 text-sm mb-8 text-center max-w-md">
        Choose how you want to interact with the AI Guide
      </p>

      <div className="space-y-4 w-full max-w-lg">
        {OPTIONS.map((option) => (
          <button
            key={option.mode}
            onClick={() => handleSelect(option.mode)}
            className="
              w-full p-6 rounded-xl
              bg-gray-800 border border-gray-700
              hover:border-cyan-500 hover:bg-gray-750
              transition-all duration-200
              text-left group
            "
          >
            <div className="flex items-start gap-4">
              <span className="text-4xl" aria-hidden="true">
                {option.icon}
              </span>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                  {option.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {option.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
