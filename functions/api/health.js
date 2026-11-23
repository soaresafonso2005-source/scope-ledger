// GET /api/health?code=YOURCODE — checks that live AI is configured and reachable.
// Never returns the key. Use it once after deploying.
import { PRIMARY_MODEL, PRESETS, json, callClaude, callValidated, buildAnalysisPayload, validateAnalysis } from "../../lib/core.js";
import { hasKV } from "../../lib/store.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const report = {
    site: "ok",
    api_key_set: Boolean(env.ANTHROPIC_API_KEY),
    access_code_set: Boolean(env.LIVE_ACCESS_CODE),
    demo_mode_forced: String(env.DEMO_MODE || "").toLowerCase() === "true",
    model: (env.ANTHROPIC_MODEL || PRIMARY_MODEL).trim(),
    cloud_workspaces: hasKV(env) ? "on" : "off — add the SL_DATA KV binding and redeploy",
    slack: env.SLACK_SIGNING_SECRET ? "configured" : "not configured (optional)",
  };
  if (!report.api_key_set) return json({ ...report, live_ai: "off — add ANTHROPIC_API_KEY and redeploy" });
  if (env.LIVE_ACCESS_CODE && url.searchParams.get("code") !== env.LIVE_ACCESS_CODE)
    return json({ ...report, live_ai: "not tested — add ?code=YOURCODE to the address" });

  const out = await callClaude(env, { max_tokens: 5, messages: [{ role: "user", content: "Reply with OK." }] });
  if (out.status === 200) {
    // Full check: run a real structured analysis end to end.
    const p = PRESETS.tiktok;
    const full = await callValidated(env, buildAnalysisPayload(p.scope, p.request, "en"), "report_triage", (r) => validateAnalysis(r, p.scope, p.request));
    const verdict = full.result ? full.result.classification : null;
    return json({ ...report, live_ai: full.result ? "working" : "connected, but the test analysis failed — try again in a minute", model_used: out.data && out.data.model, test_analysis: verdict ? `TikTok example classified as ${verdict}` : null });
  }
  const hint =
    out.status === 401 ? "the API key is wrong — create a new key and paste it again" :
    out.status === 400 ? "request rejected — usually no credit balance; check Billing in the Claude Console" :
    out.status === 429 ? "rate limited — wait a minute" :
    "provider unavailable — try again shortly";
  return json({ ...report, live_ai: "error", provider_status: out.status, provider_message: out.data && out.data.error ? out.data.error.message : null, hint }, 200);
}
