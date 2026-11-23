# Scope Ledger

Scope Ledger helps small social media and marketing agencies stop giving away "one small thing". The account manager drops in the week's client conversation (a WhatsApp export, an email or Slack thread); Scope Ledger finds every request, checks each one against the client's package and this month's usage, updates the counters, and adds extras to a monthly ledger that becomes a priced add-on proposal. Clients change nothing.

## What's in the box

```
public/                 static site, no build step
  index.html            landing page (problem, how it works, calculator, pricing, FAQ)
  app.html, app.js      the product
  connect.html, .js     setup pages for iPhone Shortcut, Android app and Slack
  privacy.html
  manifest.webmanifest, sw.js, icon-*.png   installable app + Android share target
functions/              Cloudflare Pages Functions
  api/scan.js           POST  whole-conversation triage (Claude)
  api/analyze.js        POST  single-request check (Claude)
  api/rewrite.js        POST  warmer / firmer / shorter reply (Claude)
  api/workspace.js      GET/PUT/POST  agency workspaces (KV): sync clients, counters, ledger, inbox
  api/inbox.js          POST  receive shared chats (iPhone Shortcut, Android, app); .txt and .zip exports
  api/slack.js          POST  Slack message shortcut "Send to Scope Ledger"
  api/slack-link.js     POST  connect a Slack workspace to an agency workspace
  api/slack-oauth.js    GET   "Add to Slack" install for any agency
  api/config.js         GET   public settings for the pages
  api/health.js         GET   setup check, runs a real test analysis
  share-target.js       POST  Android share fallback
lib/core.js             prompts, schemas, validation, Anthropic client with retry and model fallback
lib/store.js            workspaces, inbox, ZIP reading, masking
```

## Cloudflare settings

Pages project connected to this repository. Build command: empty. Build output directory: `public`.

Bindings (Settings › Bindings):
- KV namespace, variable name `SL_DATA` (required for workspaces, inbox and Slack)

Variables and Secrets (Production), then redeploy:
| Name | Type | Required | Purpose |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | Secret | yes | Live AI |
| `LIVE_ACCESS_CODE` | Secret | yes | Admin code: creates agency workspaces and unlocks live AI without a workspace |
| `ANTHROPIC_MODEL` | Variable | no | Defaults to `claude-sonnet-5-5`; falls back to `claude-haiku-5-5` if the name is rejected |
| `SLACK_SIGNING_SECRET`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | Secret | for Slack | From the Slack app (see /connect.html) |
| `DEMO_MODE` | Variable | no | `true` forces simulation for everyone |

Check everything at `/api/health?code=YOUR_LIVE_ACCESS_CODE`.

## Access model

- Visitors without a code get clearly labelled simulations (no AI cost).
- The owner (admin code) creates one workspace per agency in the app and sends the agency its code (`SL-XXXX-XXXX-XXXX`) or a sign-in link (`/app.html?ws=CODE`). The workspace code is the agency's sign-in and unlocks live AI.

## Safety and reliability

- API key only on the server. Model output is forced through a JSON tool schema, validated on the server and retried once if invalid; invalid output is never shown.
- Every quote is checked against the user's own text; unverified quotes are flagged.
- User text is delimited as data; instructions inside it are ignored by the prompts.
- Phone numbers and emails are masked before analysis and before anything is stored. Inbox items expire after 30 days. Logs contain status codes only.
- Workspace sync merges per client by last update, with tombstones for deletions, so two colleagues editing different clients never overwrite each other.

## Tests run before delivery

28 API checks (workspaces, merge, inbox JSON/multipart/.txt/.zip, masking, Slack signature, timestamp, linking, health) and browser suites on desktop and mobile (scan, ledger, proposal, single checks, tone rewrites, two-device sync, inbox scan, Slack linking, Android share handoff, Connect page), all against a simulated Anthropic API.
