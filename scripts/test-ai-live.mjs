const mock = String(process.env.VITE_AI_MOCK || '').toLowerCase() === 'true'

console.log('LIVE_PUTER_AI_MANUAL_CHECKLIST')
console.log(`frontend_mode=${mock ? 'MOCK_AI' : 'LIVE_PUTER_AI'}`)
console.log('1. Start the real-test frontend with VITE_AI_MOCK=false.')
console.log('2. Open Explore, choose a specific take, choose Debate AI, and confirm the motion is unchanged after refresh.')
console.log('3. Click Connect Puter yourself; confirm the browser sign-in flow, Connected status, live model catalogue, and allowance are shown.')
console.log('4. Confirm Gemini Analyst, Claude Socratic, GPT Logician, and DeepSeek Challenger only use compatible live family models.')
console.log('5. Start one short debate, observe streamed chunks, stop once, retry once, and finish the bounded review.')
console.log('6. Confirm no fabricated citations or lived experience, the score explanation expands, and a failed review shows no invented score.')
console.log('7. Repeat once in German and once with dark theme / large text.')
console.log('This is intentionally manual and is not a CI assertion because Puter sign-in is user-triggered.')
