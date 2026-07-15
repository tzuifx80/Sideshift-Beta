# Supabase Boundary

- Never rewrite an applied migration; create a new ordered migration.
- Treat RLS as default deny.
- Verify policies behaviorally as the affected authenticated users.
- Enforce ownership and authorization server-side.
- Review RPC/function authorization, search path, and input validation.
- Never expose service-role credentials to the client.
- Preserve schema compatibility or provide an explicit migration.
- Test challenge/debate integrity with two users or two browser contexts.
- Run exact repository database checks before completion.
- A policy existing is not proof that it is secure.
