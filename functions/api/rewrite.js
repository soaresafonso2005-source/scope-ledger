// POST /api/rewrite — rewrites the client reply in another tone (live AI only).
import { LIMITS, TONES, json, fail, readJson, access, rateLimited, callValidated, providerError, buildRewritePayload } from "../../lib/core.js";

export async function onRequestPost({ request, env }) {
  const { body, error } = await readJson(request, 16000);
  if (error) return error;

  const draft = typeof body.draft === "string" ? body.draft.trim() : "";
  const scopeText = typeof body.scopeText === "string" ? body.scopeText.trim().slice(0, LIMITS.scopeMax) : "";
  const tone = typeof body.tone === "string" && TONES[body.tone] ? body.tone : null;

  if (!tone) return fail(400, "invalid_tone", "Choose warmer, firmer or shorter.");
  if (draft.length < 10 || draft.length > LIMITS.replyMax) return fail(400, "invalid_draft", `The reply must be between 10 and ${LIMITS.replyMax} characters.`);
  if ((await access(env, body)) !== "live") return fail(403, "live_only", "Tone rewrites need live AI. Sign in to your workspace or enter an access code.");
  if (rateLimited(request)) return fail(429, "rate_limited", "Too many requests in a short time. Wait a minute and try again.");

  const out = await callValidated(env, buildRewritePayload(draft, tone, scopeText), "rewrite_reply",
    (r) => (r && typeof r.client_reply === "string" && r.client_reply.trim().length >= 10 && r.client_reply.length <= LIMITS.replyMax ? r.client_reply.trim() : null));
  console.log(JSON.stringify({ route: "rewrite", status: out.status, ok: Boolean(out.result) }));
  if (out.status !== 200) return providerError(out.status);
  if (!out.result) return fail(502, "invalid_output", "The rewrite couldn't be verified. Try again.");
  return json({ client_reply: out.result });
}

export function onRequest() {
  return new Response("Use POST.", { status: 405, headers: { allow: "POST" } });
}
