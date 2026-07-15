---
name: backend-secure-change
description: Use for server, Supabase, RLS, RPC, auth, persistence, or migration work.
---
1. Identify actors, trust boundaries, allowed and denied actions.
2. Inspect schema, migrations, policies, RPCs, clients, validation, and tests.
3. Never rewrite applied migrations.
4. Enforce authorization server-side and default deny.
5. Preserve repository-adapter parity and recovery semantics.
6. Test two users, denied access, races, expiry, retries, and refresh where relevant.
7. Run database/integration/security checks and inspect final diff.
