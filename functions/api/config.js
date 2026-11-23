// GET /api/config — public, non-secret settings the pages need.
export function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    slackClientId: env.SLACK_CLIENT_ID || "",
    slackReady: Boolean(env.SLACK_SIGNING_SECRET && env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET),
    cloud: Boolean(env.SL_DATA),
  }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
