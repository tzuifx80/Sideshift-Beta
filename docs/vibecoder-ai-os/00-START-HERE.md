# VibeCoder AI OS Max — Start Here

This package is a complete operating system for coding with Codex, native GPT‑5.6 models, free external models, LiteLLM, MCP, subagents, skills, tests, and persistent project context.

It is deliberately **not** an installer that overwrites your current setup. Earlier attempts showed why automatic installers are risky: provider IDs change, external models differ in tool support, and a model can pass a text test while failing Codex MCP tool schemas.

Use the files in this order:

1. Read `01-MASTER-GUIDE.md`.
2. Read `02-MODEL-FLEET-AND-ROUTING.md`.
3. Configure or verify profiles using `03-SETUP-GUIDE-WINDOWS.md`.
4. Copy and customize the templates under `templates/`.
5. Run the diagnostics under `router/`.
6. Use the prompt library and workflow playbooks for real tasks.
7. Keep your existing `lean` profile until every replacement route is verified.

## The central design

- **Sol:** rare, difficult, ambiguous, high-value judgment.
- **Terra:** everyday native implementation and tool-heavy work.
- **Luna:** clear, repeatable, high-volume native work.
- **Gemini:** large-context, multimodal, and potentially MCP-heavy external work.
- **GLM:** complex free implementation without incompatible MCP namespaces.
- **DeepSeek:** root-cause debugging and independent review.
- **MiniMax:** full-stack, mobile, and multimodal implementation.
- **Nemotron:** long-horizon planning and second opinion.
- **Kimi:** creative product, game, UX, and marketing work.
- **Overflow models:** quota and outage resilience, not automatic first choice.

## Non-negotiable truth

No local router can perfectly read your subscription allowance or know that every provider is healthy forever. Use `/usage daily` and `/usage weekly`, update the local usage file, and run model health tests after provider or configuration changes.

The best system is not “the most models in one fallback list.” It is:

1. the best compatible model for the current stage,
2. a different model family for independent review,
3. persistent repository instructions,
4. strong testing and release gates,
5. controlled use of expensive native reasoning.
