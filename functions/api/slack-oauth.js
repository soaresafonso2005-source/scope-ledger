// GET /api/slack-oauth — completes "Add to Slack" so any agency can install the Scope Ledger Slack app.
// Needs SLACK_CLIENT_ID and SLACK_CLIENT_SECRET (Slack app > Basic Information).
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const back = (q) => Response.redirect(`${url.origin}/connect.html?${q}`, 302);
  if (url.searchParams.get("error")) return back("slack=cancelled");
  const code = url.searchParams.get("code");
  if (!code || !env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) return back("slack=not_configured");
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env.SLACK_CLIENT_ID, client_secret: env.SLACK_CLIENT_SECRET, redirect_uri: `${url.origin}/api/slack-oauth` }),
  });
  let data = {};
  try { data = await res.json(); } catch { /* ignore */ }
  console.log(JSON.stringify({ route: "slack-oauth", ok: Boolean(data.ok) }));
  return back(data.ok ? "slack=installed" : "slack=failed");
}
