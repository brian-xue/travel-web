# travel-web Operations Guide

This guide describes day-to-day operation of the current React/Vite, Cloudflare Worker, and D1 application. Viewer access is public; editor and admin actions require the password-protected session flow.

## Daily checks

1. Open `/api/health` and confirm the Worker returns a successful API envelope.
2. Open `/weather` and check the latest fetch time and stale warning.
3. Open `/roads` and check each monitor's status, last attempt, last success, source link, and stale/error message.
4. Open `/admin/trip` only when trip, day, place, route, or map content needs editing.

Road results are advisory. Always use the official source link for a final travel decision.

## Weather operations

Editor/admin users can use **Refresh Weather** on `/weather`. The Worker fetches configured weather providers server-side and stores snapshots in D1. A failed refresh must remain visible as stale or with a fetch error; old data must not be presented as current.

The existing `weatherRefreshMinutes` setting accepts `30` or `60`. Change it through the settings UI or settings API. It is separate from road-monitor scheduling.

## Road monitoring

Road monitors are configured from `/roads` by an editor or admin. A monitor must use a public official HTTPS URL. Do not add real private trip details to source control or create a monitor for a site that disallows automated access.

Supported parser choices are `manual_only`, `generic_json`, `generic_rss`, and `keyword_html`. Generic JSON accepts `statusPath`, `summaryPath`, `updatedAtPath`, and optional `statusMap` in parser JSON. HTML parsing strips scripts and stores only a short excerpt.

The hourly Worker cron invokes the scheduler. `paused` monitors are skipped, `daily` monitors require at least 24 hours between checks, and `hourly` monitors require at least 60 minutes plus the configured minimum interval. Manual **Check Now** requests also enforce the configured minimum interval.

Use **View Details** to inspect recent snapshots. Use **Confirm Status** only after checking the official page. A confirmation has an optional expiry and can be cleared; it never deletes automatic history.

## Stale and failed data

- `fetch_failed` means the request, source, or parser failed.
- `manual_review_required` means the source did not provide enough evidence to infer a status.
- Stale or failed results show a warning and an official source link.
- Do not change an uncertain result to `open` merely to remove a warning.

Inspect Worker logs and `lastErrorCode`/`lastErrorMessage` when a source fails. Common causes are changed source fields, unsafe URLs, timeouts, response-size limits, redirects, or content restrictions.

## Add or change a monitor

1. Open `/roads` as editor/admin.
2. Select **New Monitor**.
3. Use a fictional or approved label and an official HTTPS source URL.
4. Select the source and parser type.
5. Enter a small parser configuration JSON object.
6. Start with `daily` unless the source is needed near travel time.
7. Save, then use **Check Now** only when the minimum interval allows it.
8. Verify the official link, status, freshness, and history.

If an official source changes its JSON fields, RSS structure, or HTML wording, update parser configuration or adapter tests. Do not add browser automation or bypass access controls.

## Import and export

Only admins can call `/api/admin/export`, `/api/admin/import/preview`, and `/api/admin/import/apply`. Export files use `schemaVersion: 1` and exclude sessions, password hashes, secrets, and Cloudflare configuration. The current import apply path intentionally imports road-monitor configurations and supports `merge` or `replace` for those configurations; it does not overwrite trip or credential data.

Before importing, export a backup, validate the schema version, preview counts, review URLs/parser JSON, apply only after confirmation, and review the audit event.

## Deployment and rollback

```bash
npm run typecheck
npm run test
npm run build
npx wrangler d1 migrations apply travel-web-db --remote
npx wrangler deploy
```

The production D1 migration directory is forward-only. Do not edit an applied migration; add a new numbered migration. Worker versions can be reviewed and rolled back through Wrangler/Cloudflare dashboard procedures. Pages deployment history provides frontend rollback.

## Secrets, backups, and incidents

Worker secrets are managed with `npx wrangler secret put`, never in GitHub or `.env` files. Keep a remote D1 export or Cloudflare-supported backup before destructive maintenance. An application JSON export is not a replacement for a complete D1 backup.

If a secret or API key is exposed, rotate it at the provider, review Worker/GitHub/Cloudflare logs, remove it from the working tree and history according to the repository process, and run `npm run check:secrets` before deployment. If a road source is unstable, pause it and use manual confirmation only after human verification.
