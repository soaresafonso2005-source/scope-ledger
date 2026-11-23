// POST /api/slack-link {token, workspace} — connects a Slack workspace to an agency workspace.
import { json, fail, readJson } from "../../lib/core.js";
import { hasKV, wsKey, loadWs, saveWs, addToInbox } from "../../lib/store.js";

export async function onRequestPost({ request, env }) {
  if (!hasKV(env)) return fail(503, "storage_off", "Cloud workspaces aren't set up on this site yet.");
  const { body, error } = await readJson(request);
  if (error) return error;
  const token = typeof body.token === "string" ? body.token.replace(/[^a-f0-9]/gi, "") : "";
  const rawLink = token ? await env.SL_DATA.get(`slacklink:${token}`) : null;
  if (!rawLink) return fail(400, "expired", "This Slack link has expired. Use the Slack shortcut again to get a new one.");
  const key = await wsKey(body.workspace);
  const ws = key ? await loadWs(env, key) : null;
  if (!ws) return fail(401, "unknown_code", "Sign in to your workspace first, then open the Slack link again.");
  const link = JSON.parse(rawLink);
  await env.SL_DATA.put(`slack:${link.team}`, key);
  if (link.pending && link.pending.text) addToInbox(ws, { ...link.pending, source: "slack" });
  await saveWs(env, key, ws);
  await env.SL_DATA.delete(`slacklink:${token}`);
  return json({ ok: true, team: link.teamName || "your Slack workspace" });
}

export function onRequest() {
  return new Response("Use POST.", { status: 405, headers: { allow: "POST" } });
}
