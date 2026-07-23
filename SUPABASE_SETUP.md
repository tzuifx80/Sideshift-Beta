# Supabase setup

1. Create/select the private-beta Supabase project.
2. In **Authentication → Providers**, enable:
   - **Allow new users to sign up**
   - **Email** provider
   - **Email signups**
   - **Email confirmation / OTP**
   - **Anonymous sign-ins**
   - **Manual linking**
3. In **Authentication → Email Templates**, ensure the Magic Link / OTP template contains `{{ .Token }}` for six-digit codes.
4. Configure **Custom SMTP** for production email delivery. CAPTCHA is recommended before public release.
5. Configure browser values:

   ```env
   VITE_DATA_BACKEND=supabase
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

6. Configure server-only values:

   ```env
   DATA_BACKEND=supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=server-only-service-role-key
   ```

7. Apply the versioned migrations and verify that all five are remote:

   ```powershell
   npx supabase db push --yes
   npx supabase migration list
   ```

8. Run `npm run test:supabase` and `npm run test:rls`. The integration creates two anonymous users and checks persistence, RLS, challenge expiry/single-use behavior, report privacy, owner-only deletion, and responder anonymization.
9. Run `npm run test:playwright:supabase` for the isolated two-context browser flow. Never put the service-role key in a `VITE_` variable.

Migrations `0001`–`0004` provide the foundation and challenge/RLS corrections. `0005_private_beta_controls.sql` adds rate-limit buckets, validated report RPCs, safe analytics, and `delete_my_beta_data()`.
