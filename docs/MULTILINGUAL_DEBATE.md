# Multilingual debate support

## Debate language model

- Codes: BCP-47 (`DebateLanguageCode`) stored on `AiDebateData.debateLanguageCode` and `DebateSnapshot.language`.
- Modes: `auto` or `explicit`.
- Locking: explicit mode locks at start; auto mode locks after the first substantive user argument.
- Priority after lock: explicit → detected → profile preference → interface locale → English.

## Reliable Core (offline)

Supports authored composition for:

- English
- German
- French
- Spanish
- Italian

For other languages while offline or when every hosted provider fails, the app shows a recoverable state instead of pseudo-translations or silent English fallback.

## Hosted SideShift AI (online)

Supports additional languages on a best-effort basis, including representative coverage for:

Portuguese, Dutch, Polish, Turkish, Romanian, Russian, Ukrainian, Arabic, Urdu, Hindi, Bengali, Persian, Chinese, Japanese, Korean, Indonesian.

Wrong-language responses trigger one bounded repair attempt, then fallback routing. Quota is not consumed twice for the same `requestId`.

## RTL

Arabic, Urdu and Persian debate messages use `dir="auto"` at message and composer level. The application shell remains LTR unless the interface locale itself is RTL.

## Verification

- Deterministic: `npm run verify:debate-quality`
- Reliable Core smoke: `npm run verify:reliable-core`
- Live hosted multilingual quality: requires operator credentials and manual human review; not claimed by mocked tests alone.

## Remaining manual checks

- Physical-device matrix across representative languages and scripts
- Live Groq / Workers AI output review for naturalness
- Long-form code-switching and emoji-heavy edge cases in production network conditions
