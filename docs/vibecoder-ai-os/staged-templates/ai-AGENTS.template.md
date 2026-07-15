# AI Boundary

- Keep provider-specific behavior behind the provider abstraction.
- Resolve model families through the existing safe resolver.
- Label mock and live behavior honestly.
- Preserve selected takes and debate state during setup, streaming, retry, stop, and refresh.
- Support cancellation, timeout, bounded retry, and visible failure.
- Validate structured outputs before use.
- Allow at most the established bounded repair attempt.
- Minimize data sent to providers and never send secrets.
- Keep prompt construction in the established prompt boundary.
- Test provider resolution, streaming, cancellation, fallback, parsing, repair, persistence, and errors.
- Never present simulated behavior as a real human.
