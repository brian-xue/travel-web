# travel-web

`travel-web` is a personal travel planning skeleton built with React, Vite, TypeScript, and a Cloudflare Worker + D1 backend. This phase focuses on project structure, authenticated access, settings management, migrations, tests, and deployment guidance without storing any real itinerary data or secrets.

Viewer mode is available without a password. Editor and admin access use the same password form and require their respective password hash values.

## Quick Start

1. Install dependencies with `npm install`.
2. Copy `.dev.vars.example` to `.dev.vars` and replace placeholder secrets locally.
3. Optionally copy `.env.example` to `.env` if the frontend should target a custom API base URL.
4. Run `npm run dev`.

For split local development, the frontend may run on `http://localhost:5173` while the Worker API runs on `http://127.0.0.1:8787`. The Worker allows credentialed local CORS requests from `http://localhost:5173` and `http://127.0.0.1:5173`.

If `MAPTILER_API_KEY` is configured in `.dev.vars`, both `/map` and `/admin/trip` can render a MapLibre basemap using the Worker-generated MapTiler style URL.
The admin place editor also uses the Worker to proxy MapTiler forward-geocoding searches, so a place name can provide selectable coordinate suggestions without adding a second browser key configuration.

For production, restrict the MapTiler key in the MapTiler console with Allowed HTTP origins. Allow only the deployed Cloudflare domain and the local development origins required by the team.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run format`
- `npm run check:secrets`

## Local Configuration

- Never commit `.dev.vars`, `.env`, or real secret values.
- Use `wrangler secret put` or the Cloudflare Dashboard for deployed secrets.
- Placeholder values only belong in `.dev.vars.example` and `.env.example`.

## Deployment

- Create a D1 database in Cloudflare.
- Run migrations with `wrangler d1 migrations apply`.
- Configure Worker secrets with `wrangler secret put`.
- Build and deploy with Wrangler/Cloudflare Pages according to the architecture doc.

## More Detail

See [docs/ARCHITECTURE_AND_FEATURES.md](/Users/brian/Documents/travel-website/docs/ARCHITECTURE_AND_FEATURES.md) for architecture, auth, API design, testing, deployment, and known limitations.
