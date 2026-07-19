# travel-web Architecture And Features

## 1. Project Goal

`travel-web` is a personal travel planning website skeleton for authenticated trip planning, weather status, road monitoring, checklists, and notes. This phase intentionally stops at scaffolding, auth/session infrastructure, a settings API, sample UI states, and deployment-ready project structure.

## 2. Tech Stack

- TypeScript
- React 19
- Vite
- React Router
- Cloudflare Workers
- Cloudflare D1
- Wrangler
- Vitest
- ESLint
- Prettier

## 3. Directory Structure

```text
travel-web/
├── src/                  # Frontend app shell, routes, pages, and shared API client
├── worker/               # Cloudflare Worker request handling, auth, repositories, and helpers
├── migrations/           # D1 SQL migrations
├── scripts/              # Utility scripts such as secret scanning
├── tests/                # Frontend, API, and unit tests
├── docs/                 # Architecture documentation
├── .dev.vars.example
├── .env.example
├── README.md
└── wrangler.toml
```

## 4. Frontend Routes

- `/` dashboard
- `/trip`
- `/map`
- `/weather`
- `/roads`
- `/checklists`
- `/notes`
- `/settings`
- `/admin`
- `/login`

Routes are wrapped by `ProtectedRoute`, which allows default viewer-mode access and only uses login for elevated edit sessions.

## 5. Worker Entry And Middleware

- Entry: `worker/index.ts`
- Request context:
  - parses the session cookie
  - hashes the session token with `SESSION_SECRET`
  - loads the session and user records
- Route handlers:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/session`
  - `GET /api/health`
  - `GET /api/settings`
  - `PUT /api/settings`

Responses use a consistent envelope with `ok`, `data`, and `error`.

## 6. D1 Table Structure

- `app_settings`
  - `id`
  - `key`
  - `value_json`
  - `updated_at`
- `users`
  - `id`
  - `display_name`
  - `role`
  - `enabled`
  - `created_at`
  - `updated_at`
- `sessions`
  - `id`
  - `user_id`
  - `token_hash`
  - `csrf_token`
  - `expires_at`
  - `created_at`
  - `last_seen_at`
- `audit_log`
  - `id`
  - `actor_user_id`
  - `action`
  - `entity_type`
  - `entity_id`
  - `metadata_json`
  - `created_at`

All timestamps are stored in UTC ISO 8601 format.

## 7. Authentication Flow

This implementation uses open viewer-mode access plus password-protected elevated roles:

- `EDITOR_PASSWORD_HASH`
- `AUTH_PASSWORD_HASH`

Passwords are verified server-side with PBKDF2-SHA256 hashes in the format `pbkdf2_sha256$iterations$salt$hash`.

Login flow:

1. Unauthenticated requests are treated as viewer-mode access.
2. Client posts an editor or admin password to `/api/auth/login` for elevated access.
3. Worker applies a small in-memory rate limit by IP.
4. Worker matches the password hash to an elevated role.
5. Worker creates a random session token and CSRF token.
6. Worker stores only the hashed session token in D1.
7. Worker returns a `HttpOnly`, `Secure`, `SameSite=Lax` cookie.

Logout deletes the stored session and clears the cookie.

## 8. Authorization Model

- `viewer`: available without a password for read-only access
- `editor`: can sign in and update settings
- `admin`: can sign in, update settings, and is reserved for future admin-only tools

Worker handlers return:

- `401` when not authenticated
- `403` when authenticated but not authorized

## 9. Secret Management

Secrets never live in the repo. Real values belong in:

- local `.dev.vars`
- Cloudflare Dashboard secrets
- `wrangler secret put`

Tracked example files only use placeholder text:

- `.dev.vars.example`
- `.env.example`

`scripts/check-secrets.mjs` provides a lightweight secret scan for obvious mistakes. Git history should also be checked before publishing.

## 10. CSRF Strategy

The Worker uses `SameSite=Lax` cookies plus a required `X-CSRF-Token` header for state-changing endpoints. The token is generated per session and stored server-side. This keeps the implementation simple while adding a server-verifiable second factor for write requests.

## 10.1 Local Development CORS

For local development, `worker/index.ts` handles credentialed CORS before normal route dispatch.

- Allowed origins:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
- `OPTIONS` preflight requests return `204`
- Allowed origins receive `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, and `Vary: Origin`
- The Worker does not use `Access-Control-Allow-Origin: *` because session-based auth uses cookies

## 11. Local Run

1. `npm install`
2. `cp .dev.vars.example .dev.vars`
3. Replace placeholders with generated values
4. `npm run dev`

For local Worker work, use Wrangler with the same `.dev.vars` file and a bound local D1 database. When the frontend is served by Vite on `http://localhost:5173`, the Worker can be served separately on `http://127.0.0.1:8787`.

## 12. Testing

- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run check:secrets`

Included tests cover:

- response envelope helpers
- password/session validation helpers
- role checks
- auth flow success and failure
- viewer-mode session fallback
- protected settings access
- logout
- health check
- frontend login render
- navigation render
- viewer-mode route access
- empty state visibility
- mobile navigation toggle presence

## 13. Deployment

### Create D1

1. `wrangler d1 create travel-web`
2. Copy the database id into `wrangler.toml`

### Apply Migrations

1. `wrangler d1 migrations apply travel-web-db --local`
2. `wrangler d1 migrations apply travel-web-db --remote`

### Configure Secrets

Set each secret with `wrangler secret put`:

- `SESSION_SECRET`
- `AUTH_PASSWORD_HASH`
- `EDITOR_PASSWORD_HASH`
- `MAPTILER_API_KEY`
- `NWS_USER_AGENT`

### Preview And Production

- Use a Cloudflare preview environment for branch validation.
- Promote to production after tests and migration validation pass.

### Rollback

- redeploy the previous Worker version
- restore the previous frontend artifact
- apply a compensating migration if schema changes need reversal

## 14. Implemented Now

- responsive frontend shell and routes
- public viewer mode plus elevated login UI
- Worker auth/session endpoints
- Worker health endpoint
- settings read/update endpoint
- D1 migration and seed users
- audit log writes for login, logout, and settings updates
- tests, linting, formatting, and secret-scan script

## 15. Not Implemented Yet

- real trip CRUD
- map rendering
- weather provider integration
- road monitoring jobs
- checklist persistence
- notes persistence
- admin management tools
- durable distributed rate limiting

## 16. Known Limitations

- frontend currently uses placeholder content for most features
- local rate limiting is in-memory and best-effort
- no live D1 integration test runs inside the unit test suite
- the skeleton expects secrets to be generated externally

## 17. Extension Points

- add new repositories under `worker/db`
- expand routes in `worker/index.ts`
- add feature modules under `src/features`
- replace placeholder pages with D1-backed data flows
- add scheduled jobs under `worker/scheduled`

## 18. Troubleshooting

- If login always fails, verify the password hashes and format in `.dev.vars`.
- If protected APIs return `401`, confirm the session cookie is being sent to the Worker origin.
- If write APIs return `403`, confirm the `X-CSRF-Token` header matches the current session.
- If migrations fail, verify the D1 binding name and database id in `wrangler.toml`.
- If secrets are exposed accidentally, rotate them and scrub Git history before sharing the repository.
