// POST /api/slack — Slack message shortcut "Send to Scope Ledger".
// Slack app setup: see the Connect page (public/connect.html). Needs SLACK_SIGNING_SECRET and the SL_DATA KV binding.
import { hasKV, loadWs, saveWs, addToInbox } from "../../lib/store.js";

const enc = new TextEncoder();

async function validSignature(secret, timestamp, body, signature) {
  if (!secret || !timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 * 5) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`v0:${timestamp}:${body}`));
  const expected = "v0=" + [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

async function say(responseUrl, text) {
  if (!responseUrl || !/^https:\/\/hooks\.slack\.com\//.test(responseUrl)) return;
  await fetch(responseUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ response_type: "ephemeral", text }) });
}

function messageText(m) {
  if (!m) return "";
  const parts = [m.text || ""];
  for (const a of Array.isArray(m.attachments) ? m.attachments : []) parts.push(a.text || a.fallback || "");
  return parts.filter(Boolean).join("\n");
}

export async function onRequestPost({ request, env, waitUntil }) {
  const raw = await request.text();
  const ok = await validSignature(env.SLACK_SIGNING_SECRET, request.headers.get("x-slack-request-timestamp"), raw, request.headers.get("x-slack-signature") || "");
  if (!ok) return new Response("Invalid signature", { status: 401 });

  let payload;
  try { payload = JSON.parse(new URLSearchParams(raw).get("payload") || "{}"); } catch { return new Response("Bad payload", { status: 400 }); }
  if (payload.type !== "message_action") return new Response("", { status: 200 });

  const origin = new URL(request.url).origin;
  const team = payload.team && payload.team.id ? String(payload.team.id) : "";
  const text = messageText(payload.message);
  const from = (payload.message && (payload.message.user_profile && payload.message.user_profile.real_name)) || (payload.user && (payload.user.name || payload.user.username)) || "";
  const channel = payload.channel && payload.channel.name ? `#${payload.channel.name}` : "Slack";

  const work = (async () => {
    if (!hasKV(env)) return say(payload.response_url, "Scope Ledger isn't fully set up yet: cloud workspaces are off on the server.");
    if (!text.trim()) return say(payload.response_url, "That message has no text for Scope Ledger to read.");
    const linkedKey = team ? await env.SL_DATA.get(`slack:${team}`) : null;
    const ws = linkedKey ? await loadWs(env, linkedKey) : null;
    if (ws) {
      addToInbox(ws, { text: from ? `${from}: ${text}` : text, source: "slack", from, title: channel });
      await saveWs(env, linkedKey, ws);
      return say(payload.response_url, `Sent to your Scope Ledger inbox. Open it to check the request: ${origin}/app.html#inbox`);
    }
    const token = crypto.randomUUID().replace(/-/g, "");
    await env.SL_DATA.put(`slacklink:${token}`, JSON.stringify({ team, teamName: (payload.team && payload.team.domain) || "", pending: { text: from ? `${from}: ${text}` : text, from, title: channel } }), { expirationTtl: 3600 });
    return say(payload.response_url, `Connect this Slack workspace to Scope Ledger (one time): open ${origin}/app.html?slack_link=${token} while signed in to your agency workspace. This message will be added to your inbox as soon as you connect.`);
  })().catch((e) => console.log(JSON.stringify({ route: "slack", error: String(e && e.message) })));

  if (typeof waitUntil === "function") waitUntil(work);
  else await work;
  return new Response("", { status: 200 });
}

export function onRequest() {
  return new Response("Use POST.", { status: 405, headers: { allow: "POST" } });
}
