---
name: database-safe-change
description: Use for Supabase schema, migration, RLS, RPC, trigger, ownership, or authorization changes.
---

1. Identify actors, data, allowed actions, and denied actions.
2. Inspect migrations, schema, policies, functions, triggers, and clients.
3. Never rewrite applied history.
4. Create a new ordered migration.
5. Use default deny and server-enforced ownership.
6. Review RPC authorization, search path, and inputs.
7. Preserve compatibility or document migration requirements.
8. Test as two users/contexts and attempt denied access directly.
9. Run exact repository database verification.
10. Report security evidence and remaining deployment/manual checks.
