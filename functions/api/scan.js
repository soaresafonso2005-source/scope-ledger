// POST /api/scan — finds every client request in a conversation and triages each against the client's scope.
import {
  LIMITS, LANGUAGES, SCAN_MOCK, json, fail, readJson, access, rateLimited,
  callValidated, providerError, buildScanPayload, validateScan,
} from "../../lib/core.js";
import { maskAndTrim } from "../../lib/store.js";

export async function onRequestPost({ request, env }) {
  const { body, error } = await readJson(request, 48000);
  if (error) return error;

  const scopeText = typeof body.scopeText === "string" ? body.scopeText.trim() : "";
  const chatText = maskAndTrim(typeof body.chatText === "string" ? body.chatText : "");
  const lang = typeof body.lang === "string" && LANGUAGES[body.lang] ? body.lang : "en";

  if (scopeText.length < LIMITS.scopeMin || scopeText.length > LIMITS.scopeMax)
    return fail(400, "invalid_scope", `Pick a saved client or describe the package (between ${LIMITS.scopeMin} and ${LIMITS.scopeMax} characters).`);
  if (chatText.length < LIMITS.chatMin)
    return fail(400, "invalid_chat", "Add the conversation to scan: drop a chat export or paste the messages.");

  const status = body.demo === true ? "requested" : await access(env, body);
  if (status !== "live") return json({ mode: "mock", mock_reason: status, preset: "scan", result: SCAN_MOCK });
  if (rateLimited(request)) return fail(429, "rate_limited", "Too many scans in a short time. Wait a minute and try again.", true);

  const out = await callValidated(env, buildScanPayload(scopeText, chatText, lang), "report_scan", (r) => validateScan(r, scopeText, chatText));
  console.log(JSON.stringify({ route: "scan", status: out.status, ok: Boolean(out.result), found: out.result ? out.result.requests.length : 0 }));
  if (out.status !== 200) return providerError(out.status);
  if (!out.result) return fail(502, "invalid_output", "The AI returned an answer we couldn't verify twice in a row, so we're not showing it. Try again, or view the simulated example.", true);
  return json({ mode: "live", result: out.result });
}

export function onRequest() {
  return new Response("Use POST.", { status: 405, headers: { allow: "POST" } });
}
