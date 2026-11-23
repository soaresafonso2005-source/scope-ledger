// POST /api/analyze — checks one client request against the agreed scope.
import {
  LIMITS, LANGUAGES, PRESETS, MOCKS, json, fail, readJson, access, rateLimited,
  callValidated, providerError, buildAnalysisPayload, validateAnalysis,
} from "../../lib/core.js";

export async function onRequestPost({ request, env }) {
  const { body, error } = await readJson(request);
  if (error) return error;

  const scopeText = typeof body.scopeText === "string" ? body.scopeText.trim() : "";
  const requestText = typeof body.requestText === "string" ? body.requestText.trim() : "";
  const lang = typeof body.lang === "string" && LANGUAGES[body.lang] ? body.lang : "en";

  if (scopeText.length < LIMITS.scopeMin || scopeText.length > LIMITS.scopeMax)
    return fail(400, "invalid_scope", `The agreed scope must be between ${LIMITS.scopeMin} and ${LIMITS.scopeMax} characters.`);
  if (requestText.length < LIMITS.requestMin || requestText.length > LIMITS.requestMax)
    return fail(400, "invalid_request", `The client request must be between ${LIMITS.requestMin} and ${LIMITS.requestMax} characters.`);

  const status = body.demo === true ? "requested" : await access(env, body);
  if (status !== "live") {
    const preset = typeof body.preset === "string" && PRESETS[body.preset] ? body.preset : "tiktok";
    return json({ mode: "mock", mock_reason: status, preset, result: MOCKS[preset] });
  }
  if (rateLimited(request)) return fail(429, "rate_limited", "Too many analyses in a short time. Wait a minute and try again.", true);

  const out = await callValidated(env, buildAnalysisPayload(scopeText, requestText, lang), "report_triage", (r) => validateAnalysis(r, scopeText, requestText));
  console.log(JSON.stringify({ route: "analyze", status: out.status, ok: Boolean(out.result) }));
  if (out.status !== 200) return providerError(out.status);
  if (!out.result) return fail(502, "invalid_output", "The AI returned an answer we couldn't verify twice in a row, so we're not showing it. Try again, or view the simulated example.", true);
  return json({ mode: "live", result: out.result });
}

export function onRequest() {
  return new Response("Use POST.", { status: 405, headers: { allow: "POST" } });
}
