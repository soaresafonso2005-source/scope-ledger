// POST /api/inbox — sends a conversation to an agency's Scope Ledger inbox.
// Used by the iPhone Shortcut, the Android share target and the app itself.
// Accepts JSON {workspace, text, source, from, title} or multipart form fields: workspace, text, file, source, title.
// The workspace code can also be given as ?ws=CODE or header x-workspace.
import { json, fail } from "../../lib/core.js";
import { hasKV, wsKey, loadWs, saveWs, addToInbox, bytesToText } from "../../lib/store.js";

function reply(request, status, message, extra = {}) {
  const wantsJson = (request.headers.get("accept") || "").includes("application/json") || (request.headers.get("content-type") || "").includes("application/json");
  if (wantsJson) return json({ ok: status < 400, message, ...extra }, status);
  return new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

export async function onRequestPost({ request, env }) {
  if (!hasKV(env)) return reply(request, 503, "Scope Ledger cloud workspaces aren't set up on this site yet.");
  const url = new URL(request.url);
  const ct = request.headers.get("content-type") || "";
  if (Number(request.headers.get("content-length") || 0) > 25 * 1024 * 1024) return reply(request, 413, "This file is too large. Export the chat without media.");

  let code = request.headers.get("x-workspace") || url.searchParams.get("ws") || "";
  let text = "", source = url.searchParams.get("source") || "", title = "", from = "";
  try {
    if (ct.includes("application/json")) {
      const body = await request.json();
      code = body.workspace || code; text = typeof body.text === "string" ? body.text : "";
      source = body.source || source; title = body.title || ""; from = body.from || "";
    } else if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      code = form.get("workspace") || code;
      source = form.get("source") || source; title = form.get("title") || "";
      const parts = [...form.getAll("text"), ...form.getAll("file")];
      for (const part of parts) {
        if (typeof part === "string") text += (text ? "\n" : "") + part;
        else if (part && typeof part.arrayBuffer === "function") {
          if (!title && part.name) title = part.name;
          text += (text ? "\n" : "") + (await bytesToText(await part.arrayBuffer()));
        }
      }
    } else {
      const buf = await request.arrayBuffer();
      text = await bytesToText(buf);
    }
  } catch {
    return reply(request, 400, "Scope Ledger couldn't read what was shared. Try exporting the chat “Without media”.");
  }

  const key = await wsKey(String(code));
  if (!key) return reply(request, 401, "Add your Scope Ledger workspace code to the shortcut.");
  const ws = await loadWs(env, key);
  if (!ws) return reply(request, 401, "No Scope Ledger workspace matches that code.");
  if (!text || text.trim().length < 2) return reply(request, 400, "Nothing to send: share some messages or a chat export.");

  const item = addToInbox(ws, { text, source: String(source || "share"), title: String(title || ""), from: String(from || "") });
  await saveWs(env, key, ws);
  const lines = item.text.split("\n").filter((l) => l.trim()).length;
  return reply(request, 200, `Sent to your Scope Ledger inbox (${lines} line${lines === 1 ? "" : "s"}). Open Scope Ledger to scan it.`, { id: item.id });
}

export function onRequest() {
  return new Response("Use POST.", { status: 405, headers: { allow: "POST" } });
}
