# Aetheria RPG — account API setup

The game currently keeps its legacy offline save in the browser. The new account API adds
server-side accounts and per-account character slots without removing that offline save.

## Required Vercel environment variables

- `DATABASE_URL`: Neon PostgreSQL connection string.
- `JWT_SECRET`: at least 32 random bytes; use a different value per environment.

Generate a secret with:
```sh
openssl rand -base64 48
```

## Database setup

1. Create a PostgreSQL database in Neon (or another provider compatible with Neon serverless).
2. Run the complete `database/schema.sql` migration in its SQL editor.
3. Add `DATABASE_URL` and `JWT_SECRET` to Vercel Project Settings → Environment Variables.
4. Redeploy the project.

## API

- `POST /api/auth/register` — JSON `{ "email": "...", "password": "at least 10 characters" }`
- `POST /api/auth/login` — same JSON shape; returns a 12-hour bearer token.
- `GET /api/characters` — requires `Authorization: Bearer <token>`.
- `PUT /api/characters` — creates/updates a character in slots 0–5.

Character payload uses `name`, `race`, `classId`, `slot`, `level`, `mapId`,
`position`, `vitals`, and optional `data`. The API validates identity, bounds, and payload size.
All SQL values are parameterized. Passwords are stored as scrypt hashes, never plaintext.

## Client

Load `assets/engine/account-client.js` and use `AetheriaAccount.create()`.
The access token is held in sessionStorage for the current browser session. The existing
offline save remains available; this API is an additional cloud-save capability.

## Important operational note

The API will return HTTP 503 until both environment variables are configured and the SQL
migration has been applied. No database account or secret is embedded in the repository.
