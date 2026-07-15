# Non-Negotiable Vibe-Coding Rules

## Repository safety

1. Begin meaningful work with `git status --short`.
2. Preserve user changes.
3. Never reset, checkout, clean, or overwrite unrelated work.
4. Do not silently broaden scope.
5. Do not mix a feature with unrelated refactoring.
6. Inspect the final diff.
7. Do not claim tests passed unless they were executed successfully.

## Evidence

8. Separate confirmed facts, hypotheses, and pending checks.
9. Confirm commands against package scripts or repository configuration.
10. Confirm architecture against code, not old documentation alone.
11. Reproduce bugs or state the strongest available evidence.
12. Never fix only the first visible symptom without tracing causality.
13. Include exact failures and concise relevant logs.

## Implementation

14. Define observable acceptance criteria.
15. Map affected user flows, state, persistence, backend, tests, and platforms.
16. Implement the smallest complete solution.
17. Reuse shared logic instead of duplicating it.
18. Add regression tests when behavior changes.
19. Prefer targeted tests before full suites.
20. Avoid new dependencies unless they solve a proven problem.

## Product honesty

21. Never present mock AI as live.
22. Never present simulated opponents as humans.
23. Never claim matchmaking exists when it does not.
24. Show unavailable behavior honestly.
25. Preserve user-selected state through setup, refresh, retries, and navigation.
26. Do not hide provider failures behind a misleading success state.

## Security and privacy

27. Never expose secrets.
28. Never send sensitive repository data to external providers without deliberate approval.
29. Never use service-role credentials client-side.
30. RLS must be behaviorally tested.
31. Applied migrations are immutable.
32. Validate ownership and authorization server-side.
33. Avoid logging private user or AI input data.
34. Treat external model output as untrusted.

## UI and accessibility

35. Support keyboard navigation and visible focus.
36. Provide loading, empty, offline, unavailable, and error states.
37. Use semantic tokens and existing design systems.
38. Verify responsive behavior on actual viewport sizes.
39. Avoid motion that ignores reduced-motion preferences.
40. Confirm destructive actions.

## AI systems

41. Keep provider code behind an abstraction.
42. Bound retries and repairs.
43. Support cancellation and timeout.
44. Validate structured outputs.
45. Minimize data sent to providers.
46. Keep fallback behavior semantically honest.
47. Preserve debate/draft/take state.

## Database

48. Create new migrations instead of rewriting history.
49. Default deny with RLS.
50. Test as two real users/contexts where ownership matters.
51. Review RPC authorization and search path.
52. Separate client convenience from security enforcement.

## Mobile/PWA

53. Do not edit generated Android output when source config owns the change.
54. Verify pause/resume, back, deep links, browser, share, and persistence.
55. Separate web, emulator, and physical-device evidence.
56. Verify service-worker update and recovery behavior.

## Model routing

57. Text success is not tool success.
58. Shell success is not MCP success.
59. Disable incompatible MCP namespaces.
60. Do not fake context metadata.
61. Do not treat benchmark rank as reliability.
62. Do not allow one model to implement and approve a high-risk change.
63. Do not use random free routing for critical work.
64. Preserve native usage for high-leverage decisions.

## Completion

65. Update checkpoint/status documents.
66. Report manual checks separately.
67. Document known limitations.
68. Leave one exact next action.
69. Declare READY only when evidence supports it.
70. Prefer honest partial completion over invented certainty.
