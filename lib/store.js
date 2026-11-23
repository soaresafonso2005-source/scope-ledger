// Scope Ledger — agency workspaces, inbox and helpers.
// Storage: one Cloudflare KV namespace bound to the Pages project as SL_DATA.

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CHAT_MAX = 30000;
const INBOX_MAX = 100;
const INBOX_DAYS = 30;

export const hasKV = (env) => Boolean(env && env.SL_DATA && typeof env.SL_DATA.get === "function");

export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
  return `SL-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export function normCode(code) {
  return typeof code === "string" ? code.trim().toUpperCase().replace(/\s+/g, "") : "";
}

export async function sha(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function wsKey(code) {
  const c = normCode(code);
  if (!/^SL-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/.test(c)) return null;
  return "ws:" + (await sha(c));
}

export async function loadWs(env, key) {
  if (!hasKV(env) || !key) return null;
  const raw = await env.SL_DATA.get(key);
  if (!raw) return null;
  try {
    const ws = JSON.parse(raw);
    ws.clients = ws.clients && typeof ws.clients === "object" ? ws.clients : {};
    ws.tombstones = ws.tombstones && typeof ws.tombstones === "object" ? ws.tombstones : {};
    ws.inbox = Array.isArray(ws.inbox) ? ws.inbox : [];
    return ws;
  } catch {
    return null;
  }
}

export async function saveWs(env, key, ws) {
  ws.updatedAt = Date.now();
  const cutoff = Date.now() - INBOX_DAYS * 864e5;
  ws.inbox = ws.inbox.filter((i) => i.at > cutoff).slice(-INBOX_MAX);
  for (const [id, t] of Object.entries(ws.tombstones)) if (t < Date.now() - 90 * 864e5) delete ws.tombstones[id];
  await env.SL_DATA.put(key, JSON.stringify(ws));
}

// Returns the workspace key for a code, or null.
export async function workspaceFromCode(env, code) {
  if (!hasKV(env)) return null;
  const key = await wsKey(code);
  if (!key) return null;
  const exists = await env.SL_DATA.get(key);
  return exists ? key : null;
}

// ---------- client sanitising ----------
const s = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const n = (v) => (Number.isFinite(+v) && +v >= 0 ? Math.min(Math.round(+v), 99999) : 0);

export function cleanClient(c) {
  if (!c || typeof c !== "object" || typeof c.id !== "string" || !c.id) return null;
  return {
    id: s(c.id, 40),
    name: s(c.name, 80) || "Untitled client",
    validUntil: /^\d{4}-\d{2}-\d{2}$/.test(c.validUntil || "") ? c.validUntil : "",
    terms: s(c.terms, 2500),
    match: s(c.match, 300),
    items: (Array.isArray(c.items) ? c.items : []).slice(0, 12).map((i) => ({ name: s(i && i.name, 120), limit: n(i && i.limit), used: n(i && i.used) })),
    ledger: (Array.isArray(c.ledger) ? c.ledger : []).slice(-300).map((e) => ({
      id: s(e && e.id, 40),
      month: /^\d{4}-\d{2}$/.test((e && e.month) || "") ? e.month : "",
      date: /^\d{4}-\d{2}-\d{2}$/.test((e && e.date) || "") ? e.date : "",
      asked: s(e && e.asked, 40),
      ask: s(e && e.ask, 200),
      quote: s(e && e.quote, 300),
      dimension: s(e && e.dimension, 20),
      price: e && Number.isFinite(e.price) && e.price >= 0 ? Math.min(e.price, 1e7) : null,
    })),
    updatedAt: Number.isFinite(+c.updatedAt) && +c.updatedAt > 0 ? Math.min(Math.round(+c.updatedAt), Date.now() + 864e5) : Date.now(),
  };
}

export function publicWs(ws) {
  return {
    name: ws.name,
    clients: Object.values(ws.clients).sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    inbox: ws.inbox.slice().reverse(),
    updatedAt: ws.updatedAt,
  };
}

// ---------- text helpers ----------
export function maskAndTrim(text) {
  let t = String(text || "").replace(/\r\n?/g, "\n").replace(/[‎‏‪-‮]/g, "");
  t = t.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]").replace(/\+?\d[\d ().-]{7,}\d/g, "[phone]");
  if (t.length > CHAT_MAX) {
    t = t.slice(-CHAT_MAX);
    const nl = t.indexOf("\n");
    if (nl > -1 && nl < 400) t = t.slice(nl + 1);
  }
  return t.trim();
}

// Reads the first .txt (preferring _chat.txt) from a ZIP archive.
export async function readZipText(buf) {
  const dv = new DataView(buf);
  const dec = new TextDecoder();
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip");
  const total = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  let best = null;
  for (let k = 0; k < total; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nl));
    if (/\.txt$/i.test(name) && !/^__MACOSX/.test(name) && (!best || /_chat\.txt$/i.test(name))) best = { method, size, off };
    p += 46 + nl + el + cl;
  }
  if (!best) throw new Error("no text file in zip");
  const start = best.off + 30 + dv.getUint16(best.off + 26, true) + dv.getUint16(best.off + 28, true);
  const data = new Uint8Array(buf, start, best.size);
  if (best.method === 0) return dec.decode(data);
  if (best.method === 8) {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(stream).text();
  }
  throw new Error("unsupported compression");
}

export async function bytesToText(buf) {
  const head = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
  if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) return readZipText(buf);
  return new TextDecoder().decode(buf);
}

export function addToInbox(ws, { text, source, from = "", title = "" }) {
  const item = {
    id: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    at: Date.now(),
    source: s(source, 20) || "share",
    from: s(from, 80),
    title: s(title, 120),
    text: maskAndTrim(text),
  };
  ws.inbox.push(item);
  return item;
}
