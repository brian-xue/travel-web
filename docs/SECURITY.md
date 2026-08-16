# travel-web Security Guide

## Authentication and authorization

Viewer mode does not require a password and can read published or cached data. Editor and admin sessions use password hashes configured in Worker secrets. Editor can manage content and road monitors; admin-only operations include deleting trips, application import/export, and administrative controls.

The Worker checks the session cookie, expiry, user record, role, and CSRF token before mutations. Failed checks return the normal API error envelope without implementation stack traces.

## Cookies, CSRF, and CORS

The session cookie is HttpOnly and uses Secure for HTTPS requests. Local loopback development avoids Secure for HTTP. Credentialed mutations require the session's CSRF token in `X-CSRF-Token`.

The Worker allows only explicitly configured origins for credentialed CORS. Never use `Access-Control-Allow-Origin: *` with this cookie-based application. Production Pages origins must be added deliberately to the Worker allow-list.

## Secrets and API keys

Keep `SESSION_SECRET`, `EDITOR_PASSWORD_HASH`, `AUTH_PASSWORD_HASH`, and `MAPTILER_API_KEY` in Worker secret storage. `.dev.vars.example` contains placeholders only. `VITE_API_BASE_URL` is a public build-time URL, not a secret.

The MapTiler key is used by the Worker for map styles and forward geocoding. Restrict it in the MapTiler console with Allowed HTTP origins for actual production and required local origins. Run `npm run check:secrets` before release and inspect Git diffs, generated assets, CI logs, and deployment configuration.

## Road-source SSRF protection

Road monitor URLs are administrator-configured and untrusted. `worker/roads/adapters/safe-fetch.ts` requires HTTPS, rejects credentials and non-standard ports, blocks localhost/internal/loopback/private/link-local/metadata host patterns, disables redirects, applies a timeout, limits response size, sends an identifiable User-Agent, and never executes remote JavaScript.

This is a hostname/pattern boundary, not a substitute for a network egress policy. Add a domain allow-list when the deployment requires a narrower source set. Re-check destinations if redirect support is ever added.

## Parsing, output, and logs

Generic JSON uses configured field paths and status maps; it never executes configured code. RSS parsing extracts limited title/description text. HTML parsing strips scripts and markup, keeps a short excerpt, and stores a content hash and compact payload. The UI renders status and excerpts as text, not remote HTML.

Unknown or contradictory content becomes `manual_review_required`; it must not be guessed as open. Failed checks become `fetch_failed` and remain visibly stale. Do not place session tokens, password hashes, API keys, cookies, raw pages, or sensitive metadata in logs or audit records.

## External access and incidents

External road sources must be public, approved for automated access, reasonably rate limited, and limited to D1-configured URLs. The system is not a crawler and does not bypass CAPTCHA, robots/access controls, or terms of service.

For an exposed secret, rotate it at the provider first, revoke the old value, inspect GitHub/Cloudflare/Worker logs, record the incident, and redeploy only after the secret scan is clean. For suspicious source behavior, pause the monitor and remove the URL until the access policy is reviewed.
