# Database migrations

Run migrations in ascending numeric order against the existing PostgreSQL database.

- New database: run `database/schema.sql`; it creates the tables and applies the current character RLS policy.
- Existing database: after the original schema is present, run `001_character_rls.sql`.
- Migration 001 is idempotent: it enables and forces RLS, then replaces the named policy.

Character queries must go through the authenticated API. The API sets the transaction-local `app.user_id` before each character query. Never expose `DATABASE_URL` to browser code. Use a database role without superuser or `BYPASSRLS` privileges.
