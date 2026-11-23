// /api/workspace — agency workspaces stored in Cloudflare KV (binding SL_DATA).
//   POST {action:"create", name, adminCode}  -> {code, name}         (admin only: adminCode = LIVE_ACCESS_CODE)
//   GET  (header x-workspace: CODE)           -> workspace data
//   PUT  (header x-workspace: CODE) {upserts, deletes, inboxDeletes} -> merged workspace data
import { json, fail, readJson } from "../../lib/core.js";
import { hasKV, newCode, wsKey, loadWs, saveWs, cleanClient, publicWs, normCode } from "../../lib/store.js";

const noKV = () => fail(503, "storage_off", "Cloud workspaces aren't set up on this site yet. Your data is kept in this browser.");

async function auth(request, env) {
  const code = request.headers.get("x-workspace") || new URL(request.url).searchParams.get("ws") || "";
  const key = await wsKey(code);
  if (!key) return { error: fail(401, "bad_code", "That workspace code isn't valid. Check it and try again.") };
  const ws = await loadWs(env, key);
  if (!ws) return { error: fail(401, "unknown_code", "No workspace matches that code. Check it and try again.") };
  return { key, ws };
}

export async function onRequestGet({ request, env }) {
  if (!hasKV(env)) return noKV();
  const { ws, error } = await auth(request, env);
  if (error) return error;
  return json(publicWs(ws));
}

export async function onRequestPut({ request, env }) {
  if (!hasKV(env)) return noKV();
  const { key, ws, error } = await auth(request, env);
  if (error) return error;
  const { body, error: e2 } = await readJson(request, 1500000);
  if (e2) return e2;

  for (const raw of Array.isArray(body.upserts) ? body.upserts.slice(0, 200) : []) {
    const c = cleanClient(raw);
    if (!c) continue;
    if (ws.tombstones[c.id] && ws.tombstones[c.id] >= c.updatedAt) continue;
    const cur = ws.clients[c.id];
    if (!cur || (cur.updatedAt || 0) <= c.updatedAt) ws.clients[c.id] = c;
  }
  for (const id of Array.isArray(body.deletes) ? body.deletes.slice(0, 200) : []) {
    if (typeof id !== "string") continue;
    delete ws.clients[id];
    ws.tombstones[id] = Date.now();
  }
  if (Array.isArray(body.inboxDeletes) && body.inboxDeletes.length) {
    const del = new Set(body.inboxDeletes.filter((x) => typeof x === "string"));
    ws.inbox = ws.inbox.filter((i) => !del.has(i.id));
  }
  if (Object.keys(ws.clients).length > 300) return fail(413, "too_many", "This workspace has reached 300 clients.");
  await saveWs(env, key, ws);
  return json(publicWs(ws));
}

export async function onRequestPost({ request, env }) {
  if (!hasKV(env)) return noKV();
  const { body, error } = await readJson(request);
  if (error) return error;
  if (body.action !== "create") return fail(400, "bad_action", "Unknown action.");
  if (!env.LIVE_ACCESS_CODE) return fail(403, "no_admin", "Set LIVE_ACCESS_CODE on the server to create workspaces.");
  if (typeof body.adminCode !== "string" || body.adminCode.trim() !== env.LIVE_ACCESS_CODE) return fail(403, "bad_admin", "The admin access code is wrong.");
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : "New agency";
  const code = newCode();
  const key = await wsKey(code);
  const ws = { name, createdAt: Date.now(), clients: {}, tombstones: {}, inbox: [] };
  if (Array.isArray(body.clients)) for (const raw of body.clients.slice(0, 50)) { const c = cleanClient(raw); if (c) ws.clients[c.id] = c; }
  await saveWs(env, key, ws);
  console.log(JSON.stringify({ route: "workspace", event: "created" }));
  return json({ code: normCode(code), name });
}

export function onRequest() {
  return new Response("Method not allowed.", { status: 405, headers: { allow: "GET, PUT, POST" } });
}
