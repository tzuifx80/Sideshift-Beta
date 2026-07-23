import type { AiOpponent } from './types'

export const opponents: AiOpponent[] = [
  { id: 'gemini-analyst', displayName: 'Gemini — The Analyst', family: 'Gemini', description: 'Balanced, evidence-conscious, and careful with uncertainty.', icon: '◌', stylePrompt: 'Use a calm analytical voice. Separate facts, assumptions, and values, and name uncertainty instead of filling gaps.', approvedModelRules: 'Gemini Flash-class or another current Gemini text model.', maxResponseTokens: 260 },
  { id: 'claude-socratic', displayName: 'Claude — The Socratic', family: 'Claude', description: 'Questions assumptions and helps the strongest reasoning surface.', icon: '✦', stylePrompt: 'Use one precise Socratic question to test the hinge of the argument, then answer the latest point directly. Do not become evasive.', approvedModelRules: 'Claude Haiku or current Sonnet-class text model.', maxResponseTokens: 260 },
  { id: 'gpt-logician', displayName: 'GPT — The Logician', family: 'GPT', description: 'Structured, precise, and focused on the argument’s chain.', icon: '⌁', stylePrompt: 'Use a clear but natural structure, identify the logical hinge, and answer the latest point before adding one counterexample.', approvedModelRules: 'Current GPT mini/nano-class or another current GPT text model.', maxResponseTokens: 260 },
  { id: 'deepseek-challenger', displayName: 'DeepSeek — The Challenger', family: 'DeepSeek', description: 'A firm devil’s advocate who keeps the trade-off visible.', icon: '≈', stylePrompt: 'Be firm but respectful. Stress one overlooked trade-off or counterexample and vary your opening so the reply does not sound templated.', approvedModelRules: 'Current DeepSeek general chat model; do not substitute another family.', maxResponseTokens: 260 },
]

export const basicOpponent: AiOpponent = { id: 'sideshift-basic', displayName: 'SideShift Debate', family: 'GPT', description: 'The default debate opponent — reliable on-device with optional online enhancement.', icon: '✦', stylePrompt: 'Keep one main counterpoint visible, acknowledge a genuinely strong point, and avoid repeating a rebuttal that has already been answered.', approvedModelRules: 'SideShift Debate engine.', maxResponseTokens: 180 }

export function getOpponent(id: string): AiOpponent | undefined {
  return id === basicOpponent.id ? basicOpponent : opponents.find(opponent => opponent.id === id)
}
