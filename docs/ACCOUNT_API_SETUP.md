# Aetheria RPG — account API setup

The game keeps its offline browser save and now also includes an in-game **Conta / Nuvem** panel. Cloud accounts are an optional extra; they do not disable local saves.

## Database

1. Create a PostgreSQL database (Neon is supported).
2. Run the complete `database/schema.sql` migration in its SQL console.
3. Configure `DATABASE_URL` and `JWT_SECRET` in the hosting environment. Generate the secret with:
   ```sh
   openssl rand -base64 48
   ```
   Use at least 32 random bytes and a different secret per environment.

## Deploying the API with the Node server

The repository includes a Node HTTP server that serves the game and routes `/api/*` requests to the same account handlers.

For a Render **Web Service**:
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Environment variables: `DATABASE_URL`, `JWT_SECRET`

A Render **Static Site** cannot execute these API handlers. If the existing Render service is a Static Site, it must remain the frontend while the API is deployed as a Node Web Service or on Vercel. Do not expect `/api` to work on a static-only host.

## API endpoints

- `POST /api/auth/register` — JSON `{ "email": "...", "password": "at least 10 characters" }`
- `POST /api/auth/login` — returns a 12-hour bearer token.
- `GET /api/characters` — authenticated character list.
- `PUT /api/characters` — creates/updates a character in slots 0–5.

Passwords use scrypt hashes; SQL values are parameterized; the API validates race, class, level, position, vitals and save size.

## In-game usage

Open **☁️ Conta / Nuvem** from the start screen, create an account or log in, then choose **Salvar na nuvem**. **Restaurar selecionado** replaces the current local save with the selected cloud save after confirmation. The local save remains available when offline.

The API returns HTTP 503 until the database migration and environment variables are configured. No credentials or database secrets are stored in the repository.
