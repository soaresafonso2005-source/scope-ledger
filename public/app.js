(() => {
  "use strict";

  // Must match PRESETS in lib/core.js
  const SCOPE =
    "Monthly social media package: 12 posts per month on Instagram and LinkedIn (static images and carousels), copywriting included, two rounds of revisions per post, monthly content calendar approved by the client in the first week of each month.";
  const PRESETS = {
    tiktok: { scope: SCOPE, request: "Hi! Could you also create four vertical videos for TikTok by Friday? We'd like to start testing the channel this month." },
    carousel: { scope: SCOPE, request: "Quick one: could next Tuesday's Instagram post be a carousel about our new spring collection instead of the single image we planned?" },
    launch: { scope: SCOPE, request: "For the launch we'd love a few more posts than usual and a more premium look overall. Also, could someone keep an eye on comments during launch weekend?" },
  };
  const STORIES_REQUEST = "Hi team! Could you squeeze in 3 more Instagram stories this week to promote our new seasonal blend?";
  const LIMITS = { scope: [20, 4000], req: [10, 2000] };

  // ---------- saved clients (kept in this browser) ----------
  const STORE = "scopeledger.clients.v1";
  const SEED = [
    { id: "lumen", name: "Lumen Skincare", validUntil: "2027-03-31",
      terms: "Instagram and LinkedIn: static images and carousels, copywriting included, two rounds of revisions per post, monthly content calendar approved by the client in the first week of each month.",
      items: [{ name: "Instagram and LinkedIn posts", limit: 12, used: 9 }] },
    { id: "atlas", name: "Atlas Coffee Roasters", validUntil: "2027-06-30",
      terms: "Instagram management: stories and reels, copywriting included, one round of revisions per piece, content approved weekly on Mondays. Community management on weekdays, 09:00 to 18:00.",
      items: [{ name: "Instagram stories", limit: 50, used: 50 }, { name: "Instagram reels", limit: 8, used: 5 }],
      ledger: [{ id: "seed1", month: new Date().toISOString().slice(0, 7), date: new Date().toISOString().slice(0, 10), ask: "Extra reel for the coffee festival", quote: "Could you do one more reel for the festival on Saturday?", dimension: "quantity", price: 120 }] },
    { id: "harbour", name: "Harbour Studio Hotel", validUntil: "2026-10-31",
      terms: "LinkedIn only: company page posts written and designed by the agency, one round of revisions per post.",
      items: [{ name: "LinkedIn posts", limit: 6, used: 0 }] },
  ];
  const clone = (x) => JSON.parse(JSON.stringify(x));
  // Storage: this browser (local mode) or the agency's cloud workspace (signed in).
  const WS_STORE = "scopeledger.workspace.v1";
  const WS_CACHE = "scopeledger.wsclients.v1";
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
  const ws = { code: lsGet(WS_STORE) || "", name: lsGet("scopeledger.wsname.v1") || "", inbox: [], state: "local" };
  function loadClients() {
    const raw = lsGet(ws.code ? WS_CACHE : STORE);
    if (raw) { try { const v = JSON.parse(raw); if (Array.isArray(v)) return v; } catch { /* corrupted */ } }
    return ws.code ? [] : clone(SEED);
  }
  // Canonical form, identical to the server's cleanClient (used to detect changes).
  function canon(c) {
    const str = (v, m) => (typeof v === "string" ? v.slice(0, m) : "");
    const num = (v) => (Number.isFinite(+v) && +v >= 0 ? Math.min(Math.round(+v), 99999) : 0);
    return {
      id: str(c.id, 40), name: str(c.name, 80) || "Untitled client", validUntil: /^\d{4}-\d{2}-\d{2}$/.test(c.validUntil || "") ? c.validUntil : "",
      terms: str(c.terms, 2500), match: str(c.match, 300),
      items: (c.items || []).slice(0, 12).map((i) => ({ name: str(i.name, 120), limit: num(i.limit), used: num(i.used) })),
      ledger: (c.ledger || []).slice(-300).map((e) => ({ id: str(e.id, 40), month: /^\d{4}-\d{2}$/.test(e.month || "") ? e.month : "", date: /^\d{4}-\d{2}-\d{2}$/.test(e.date || "") ? e.date : "", asked: str(e.asked, 40), ask: str(e.ask, 200), quote: str(e.quote, 300), dimension: str(e.dimension, 20), price: Number.isFinite(e.price) && e.price >= 0 ? Math.min(e.price, 1e7) : null })),
    };
  }
  const sig = (c) => JSON.stringify(canon(c));
  let snapshot = new Map();
  function saveClients() {
    if (ws.code) for (const c of clients) if (snapshot.get(c.id) !== sig(c)) c.updatedAt = Date.now();
    lsSet(ws.code ? WS_CACHE : STORE, JSON.stringify(clients));
    if (ws.code) scheduleSync();
  }
  let clients = loadClients();
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (d) => { try { return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; } };
  const isExpired = (c) => Boolean(c.validUntil) && c.validUntil < today();
  function compose(c) {
    const lines = [`Client: ${c.name}`];
    if (c.validUntil) lines.push(isExpired(c) ? `Package status: EXPIRED on ${c.validUntil}. No renewal recorded.` : `Package valid until: ${c.validUntil}`);
    lines.push(`Agreed scope: ${c.terms.trim()}`);
    const items = c.items.filter((i) => i.name.trim());
    if (items.length) {
      lines.push("Monthly allowances and usage this month:");
      for (const i of items) lines.push(`- ${i.name.trim()}: ${i.limit} per month, ${i.used} used, ${Math.max(0, i.limit - i.used)} remaining`);
    }
    return lines.join("\n");
  }
  PRESETS.stories = { scope: compose(SEED[1]), request: STORIES_REQUEST, client: "atlas" };
  const VERDICT = { included: "Included", ambiguous: "Ambiguous", likely_out_of_scope: "Likely out of scope" };
  const ACTION = { confirm: "go ahead", clarify: "ask before acting", propose_change: "propose a change" };
  const STEPS = ["Reading what you agreed", "Splitting the request into separate asks", "Checking channels, formats, volume, revisions and timing", "Drafting your reply"];

  const $ = (id) => document.getElementById(id);
  const scope = $("scope"), req = $("req"), lang = $("lang"), code = $("code");
  const go = $("go"), alertBox = $("alert"), out = $("out");
  const chips = [...document.querySelectorAll(".chip")];
  let preset = null, busy = false, stepTimer = null, last = null, mode = "scan";

  // ---------- tiny DOM helper: text only, never HTML ----------
  function h(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(typeof k === "string" ? document.createTextNode(k) : k);
    return n;
  }

  // ---------- form ----------
  function setPreset(id) {
    preset = id;
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.preset === id)));
    if (id) {
      const p = PRESETS[id];
      if (p.client) {
        let c = clients.find((x) => x.id === p.client);
        if (!c) { c = clone(SEED.find((x) => x.id === p.client)); clients.push(c); saveClients(); fillClientSelect(); }
        selectClient(c.id, false);
        scope.value = compose(c);
      } else {
        selectClient("", false);
        scope.value = p.scope;
      }
      req.value = p.request;
      syncPreset();
    }
    count(); clearErrors();
  }
  function syncPreset() {
    if (preset && (scope.value.trim() !== PRESETS[preset].scope || req.value.trim() !== PRESETS[preset].request)) {
      preset = null;
      chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
    }
  }
  function count() {
    for (const [key, el] of [["scope", scope], ["req", req]]) {
      const [min, max] = LIMITS[key], n = el.value.trim().length, c = $(key + "-count");
      c.textContent = `${n.toLocaleString("en-GB")} / ${max.toLocaleString("en-GB")}`;
      c.classList.toggle("bad", n > max || (n > 0 && n < min));
    }
  }
  function clearErrors() { $("scope-err").textContent = ""; $("req-err").textContent = ""; scope.removeAttribute("aria-invalid"); req.removeAttribute("aria-invalid"); }
  function validate() {
    clearErrors();
    let first = null;
    for (const [key, el, name] of [["scope", scope, "What you agreed"], ["req", req, "What the client asked"]]) {
      const [min, max] = LIMITS[key], n = el.value.trim().length;
      let msg = "";
      if (!n) msg = `Add ${name.toLowerCase()} to run the check.`;
      else if (n < min) msg = `Add a bit more detail (at least ${min} characters).`;
      else if (n > max) msg = `This is ${n - max} characters over the ${max} limit. Shorten it to the relevant part.`;
      if (msg) { $(key + "-err").textContent = msg; el.setAttribute("aria-invalid", "true"); first = first || el; }
    }
    if (first) first.focus();
    return !first;
  }

  // ---------- states ----------
  function showLoading(steps = STEPS) {
    let i = 0;
    const items = steps.map((s) => h("li", {}, h("span", { class: "dot", "aria-hidden": "true" }), s));
    out.replaceChildren(h("div", { class: "loading" }, h("ol", {}, items)));
    const tick = () => {
      items.forEach((li, j) => { li.className = j < i ? "done" : j === i ? "on" : ""; });
      if (i < items.length - 1) i++;
    };
    tick();
    stepTimer = setInterval(tick, 1800);
  }
  function stopLoading() { clearInterval(stepTimer); stepTimer = null; }
  function setBusy(on) { busy = on; go.disabled = on; go.textContent = on ? (mode === "scan" ? "Scanning…" : "Checking…") : (mode === "scan" ? "Scan this chat" : "Check this request"); }

  function showAlert(message, offerSimulation) {
    alertBox.className = "alert";
    alertBox.replaceChildren(h("p", {}, message));
    if (offerSimulation) alertBox.append(h("p", {}, h("button", { type: "button", class: "btn xs", onclick: () => (mode === "scan" ? runScan(true) : run(true)) }, "View the simulated example")));
    alertBox.hidden = false;
  }

  async function post(url, payload) {
    if (ws.code && /^\/api\/(analyze|scan|rewrite)$/.test(url)) payload = { ...payload, workspace: ws.code };
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    return { ok: res.ok, data };
  }

  // ---------- main action ----------
  async function run(simulation = false) {
    if (busy) return;
    alertBox.hidden = true;
    syncPreset();
    if (simulation && !preset) setPreset("tiktok");
    if (!simulation && !validate()) return;
    setBusy(true);
    showLoading();
    try {
      const { ok, data } = await post("/api/analyze", {
        scopeText: scope.value.trim(), requestText: req.value.trim(), lang: lang.value,
        accessCode: code.value.trim() || undefined, preset: preset || undefined, demo: simulation || undefined,
      });
      stopLoading();
      if (!ok || !data || !data.result) {
        restoreEmpty();
        showAlert((data && data.error && data.error.message) || "Something went wrong on our side. You can still view the simulated example.", !data || data.offer_mock !== false);
        return;
      }
      last = { ...data, scopeText: scope.value.trim() };
      render({ ...data, custom: data.mode === "mock" && preset !== data.preset });
    } catch {
      stopLoading();
      restoreEmpty();
      showAlert("We couldn't reach Scope Ledger. Check your connection and try again, or view the simulated example.", true);
    } finally {
      setBusy(false);
    }
  }

  function restoreEmpty() {
    out.replaceChildren(h("div", { class: "empty" }, h("span", { class: "pen" }, "No result yet"), "Fix the issue on the left and run the check again."));
  }

  // ---------- result ----------
  function render({ mode, mock_reason, custom, result: r }) {
    const live = mode === "live";
    const head = h("div", { class: "r-head" },
      h("div", { class: "r-top" },
        h("span", { class: `stamp ${r.classification}` }, VERDICT[r.classification]),
        h("span", { class: live ? "mode live" : "mode" }, live ? "Live AI" : "Simulation")),
      h("h2", { class: "r-summary", tabindex: "-1", id: "r-title" }, r.summary),
      h("p", { class: "r-meta" }, `Confidence: ${r.confidence}. Next step: ${ACTION[r.recommended_action]}.`),
      !live && h("p", { class: "r-sim" },
        custom
          ? "Live AI needs an access code, so this is the prepared result for the “TikTok videos” example, not an analysis of your text. Enter your access code and run the check again."
          : mock_reason === "no_access_code"
            ? "This is the prepared result for this example. Enter your access code to analyse your own texts with live AI."
            : "This is the prepared result for this example, not a live analysis.")
    );

    const reasons = h("ul", { class: "reasons" }, r.reasons.map((x) => {
      let quote;
      if (x.evidence === "missing") quote = h("p", { class: "quote" }, h("span", { class: "absent" }, "not in the agreed scope"));
      else quote = h("p", { class: "quote" },
        h("span", { class: "from" }, x.source === "request" ? "Request" : x.source === "scope" ? "Scope" : "Quote"),
        h("mark", {}, x.evidence),
        x.verified === false ? h("span", { class: "warn" }, "  Not found word for word in your text, so check it.") : null);
      return h("li", {}, h("span", { class: "dim" }, x.dimension || "other"), h("div", {}, h("p", { class: "claim" }, x.claim), quote));
    }));

    const blocks = [h("div", { class: "r-block" }, h("h3", {}, "Why"), reasons)];
    if (r.unknowns.length) blocks.push(h("div", { class: "r-block" }, h("h3", {}, "Confirm before you commit"), h("ul", { class: "r-list" }, r.unknowns.map((u) => h("li", {}, u)))));

    blocks.push(replyBlock(r.client_reply, live));

    if (r.change_proposal.length) {
      const text = r.change_proposal.map((c) => `- ${c.item}${c.detail ? `: ${c.detail}` : ""}`).join("\n");
      const st = h("span", { class: "status", role: "status" });
      blocks.push(h("div", { class: "r-block" },
        h("h3", {}, "Change to propose"),
        h("ul", { class: "r-list" }, r.change_proposal.map((c) => h("li", {}, h("b", {}, c.item), c.detail ? `: ${c.detail}` : ""))),
        h("div", { class: "reply-tools" },
          h("button", { type: "button", class: "btn ghost xs", onclick: () => copyText(text, st, "List copied") }, "Copy as list"),
          getClient() && h("button", { type: "button", class: "btn ghost xs", onclick: (e) => {
            const c = getClient(); if (!c) return;
            r.change_proposal.forEach((x) => addExtra(c, { ask: x.item + (x.detail ? `: ${x.detail}` : ""), quote: req.value.trim().slice(0, 160), dimension: "other" }));
            e.currentTarget.disabled = true; st.style.color = ""; st.textContent = `Added to ${c.name}'s extras`;
          } }, "Add to extras ledger"),
          st)));
    }
    if (r.internal_note) blocks.push(h("div", { class: "r-block" }, h("h3", {}, "Note for your team"), h("p", { style: "margin:0" }, r.internal_note)));

    const card = h("article", { class: "result" }, head, ...blocks,
      h("div", { class: "r-foot" }, "AI-assisted reading of the text you pasted. Check the full agreement before replying. Nothing is sent automatically."));
    out.replaceChildren(card);
    const title = $("r-title");
    if (matchMedia("(max-width: 980px)").matches) card.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    title.focus({ preventScroll: true });
  }


  // ---------- reply block (shared) ----------
  function replyBlock(text, live) {
    const box = h("textarea", { class: "reply-box", id: "reply", "aria-label": "Suggested reply, editable" });
    box.value = text;
    const status = h("span", { class: "status", role: "status" });
    let undoValue = null;
    const undo = h("button", { type: "button", class: "btn ghost xs", hidden: true, onclick: () => { box.value = undoValue; undo.hidden = true; status.textContent = "Previous version restored"; } }, "Undo");
    const toneBtn = (tone, label) => h("button", {
      type: "button", class: "btn ghost xs", disabled: !live, "data-tone": tone,
      title: live ? `Rewrite the reply ${label.toLowerCase()}` : "Available with live AI",
      onclick: async (e) => {
        const all = e.currentTarget.parentElement.querySelectorAll("button[data-tone]");
        all.forEach((b) => (b.disabled = true));
        status.style.color = "var(--graphite)"; status.textContent = "Rewriting…";
        try {
          const { ok, data } = await post("/api/rewrite", { draft: box.value, tone, scopeText: last ? last.scopeText : "", accessCode: code.value.trim() || undefined });
          if (ok && data && data.client_reply) { undoValue = box.value; box.value = data.client_reply; undo.hidden = false; status.style.color = ""; status.textContent = `Rewritten ${label.toLowerCase()}`; }
          else { status.style.color = "var(--out)"; status.textContent = (data && data.error && data.error.message) || "Couldn't rewrite. Try again."; }
        } catch { status.style.color = "var(--out)"; status.textContent = "Couldn't reach Scope Ledger. Try again."; }
        all.forEach((b) => (b.disabled = false));
      },
    }, label);
    const copy = h("button", { type: "button", class: "btn xs", onclick: () => copyText(box.value, status, "Reply copied") }, "Copy reply");
    return h("div", { class: "r-block" },
      h("h3", {}, "Suggested reply"),
      box,
      h("div", { class: "reply-tools" }, toneBtn("warmer", "Warmer"), toneBtn("firmer", "Firmer"), toneBtn("shorter", "Shorter"), undo, h("span", { class: "spacer" }), copy),
      h("div", { style: "margin-top:8px" }, status),
      !live && h("p", { class: "hint", style: "margin:6px 0 0" }, "Tone rewrites work with live AI."));
  }

  async function copyText(text, status, done) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const t = h("textarea", { style: "position:fixed;opacity:0" }); t.value = text; document.body.append(t); t.select();
      try { document.execCommand("copy"); } finally { t.remove(); }
    }
    status.style.color = ""; status.textContent = done;
    setTimeout(() => { if (status.textContent === done) status.textContent = ""; }, 2500);
  }


  // ---------- saved clients UI ----------
  const clientSel = $("client"), clientInfo = $("client-info"), editor = $("client-editor");
  let currentClient = "";

  function fillClientSelect() {
    clientSel.replaceChildren(
      h("option", { value: "" }, "No saved client (paste the scope)"),
      ...clients.map((c) => h("option", { value: c.id }, c.name + (isExpired(c) ? " (expired)" : "")))
    );
    clientSel.value = currentClient;
  }

  function selectClient(id, updateScope = true) {
    currentClient = clients.some((c) => c.id === id) ? id : "";
    clientSel.value = currentClient;
    $("edit-client").disabled = !currentClient;
    editor.hidden = true;
    renderClientInfo();
    if (updateScope && currentClient) { scope.value = compose(getClient()); count(); syncPreset(); }
  }
  const getClient = () => clients.find((c) => c.id === currentClient);

  function refreshScopeFromClient() {
    const c = getClient();
    if (!c) return;
    scope.value = compose(c); count(); syncPreset();
  }

  function renderClientInfo() {
    const c = getClient();
    if (!c) { clientInfo.replaceChildren(); return; }
    const expired = isExpired(c);
    const meters = c.items.filter((i) => i.name.trim()).map((i, idx) => {
      const pct = i.limit > 0 ? Math.min(100, Math.round((i.used / i.limit) * 100)) : 0;
      const state = i.used >= i.limit ? "full" : pct >= 80 ? "near" : "";
      const bump = (d) => { i.used = Math.max(0, i.used + d); saveClients(); renderClientInfo(); refreshScopeFromClient(); };
      return h("div", { class: "meter" },
        h("span", { class: "m-name" }, i.name),
        h("div", { class: "steppers" },
          h("button", { type: "button", class: "step-btn", "aria-label": `One less ${i.name} used`, onclick: () => bump(-1) }, "−"),
          h("button", { type: "button", class: "step-btn", "aria-label": `One more ${i.name} used`, onclick: () => bump(1) }, "+")),
        h("div", { class: "bar", "aria-hidden": "true" }, h("span", { class: state, style: `width:${pct}%` })),
        h("span", { class: "m-count" + (state === "full" ? " full" : "") }, `${i.used} of ${i.limit} used this month`));
    });
    const status = h("span", { class: "status", role: "status" });
    clientInfo.replaceChildren(h("div", { class: "cinfo" },
      h("p", { class: "validity" + (expired ? " expired" : "") },
        c.validUntil ? (expired ? `Package expired on ${fmtDate(c.validUntil)}. Renew it before taking on new work.` : `Package valid until ${fmtDate(c.validUntil)}`) : "No end date set"),
      ...meters,
      h("div", { class: "cinfo-actions" },
        h("button", { type: "button", class: "btn ghost xs", onclick: () => renderLedger() }, (() => { const m = monthExtras(c); const t = m.reduce((s2, e) => s2 + (typeof e.price === "number" ? e.price : 0), 0); return `Extras this month: ${m.length}${t ? `, ${eur(t)}` : ""}`; })()),
        h("button", { type: "button", class: "link-btn", onclick: () => {
          c.items.forEach((i) => (i.used = 0)); saveClients(); renderClientInfo(); refreshScopeFromClient();
          clientInfo.querySelector(".status").textContent = "Counters reset for the new month";
        } }, "Start a new month"),
        h("button", { type: "button", class: "link-btn", onclick: () => {
          clients = clients.filter((x) => !SEED.some((sd) => sd.id === x.id)).concat(clone(SEED)); saveClients(); fillClientSelect(); selectClient(c.id && SEED.some((sd) => sd.id === c.id) ? c.id : "lumen");
        } }, "Reset example clients"),
        status)));
  }

  function openEditor(isNew) {
    const c = isNew ? { id: "c" + Date.now().toString(36), name: "", validUntil: "", terms: "", items: [{ name: "", limit: 10, used: 0 }] } : clone(getClient());
    const name = h("input", { id: "ce-name", type: "text", value: c.name, placeholder: "e.g. Lumen Skincare" });
    const until = h("input", { id: "ce-until", type: "date", value: c.validUntil || "" });
    const terms = h("textarea", { id: "ce-terms", placeholder: "Channels, formats, revision rounds, approvals, what is not included…" });
    const match = h("input", { id: "ce-match", type: "text", value: c.match || "", placeholder: "e.g. Lumen, Marta, #client-lumen" });
    terms.value = c.terms;
    const rows = h("div", {});
    const err = h("p", { class: "err", role: "alert" });
    function addRow(it) {
      const n = h("input", { type: "text", value: it.name, placeholder: "e.g. Instagram stories", "aria-label": "Deliverable" });
      const l = h("input", { type: "number", min: "0", max: "9999", value: String(it.limit), "aria-label": "Monthly limit" });
      const u = h("input", { type: "number", min: "0", max: "9999", value: String(it.used), "aria-label": "Used this month" });
      const row = h("div", { class: "item-row" }, n, l, u, h("button", { type: "button", class: "rm", "aria-label": "Remove deliverable", onclick: () => row.remove() }, "×"));
      rows.append(row);
    }
    c.items.forEach(addRow);
    const save = () => {
      const items = [...rows.querySelectorAll(".item-row")].map((r) => {
        const [n, l, u] = r.querySelectorAll("input");
        return { name: n.value.trim(), limit: Math.max(0, parseInt(l.value, 10) || 0), used: Math.max(0, parseInt(u.value, 10) || 0) };
      }).filter((i) => i.name);
      if (!name.value.trim()) { err.textContent = "Give the client a name."; name.focus(); return; }
      if (terms.value.trim().length < 10 && !items.length) { err.textContent = "Describe the package or add at least one deliverable."; terms.focus(); return; }
      const updated = { id: c.id, name: name.value.trim().slice(0, 80), validUntil: until.value, terms: terms.value.trim().slice(0, 2500), match: match.value.trim().slice(0, 300), items: items.slice(0, 12), ledger: c.ledger || [], updatedAt: Date.now() };
      const at = clients.findIndex((x) => x.id === c.id);
      if (at >= 0) clients[at] = updated; else clients.push(updated);
      saveClients(); fillClientSelect(); selectClient(updated.id);
    };
    editor.replaceChildren(h("div", { class: "editor" },
      h("div", { class: "two" },
        h("div", { class: "field" }, h("label", { for: "ce-name" }, "Client name"), name),
        h("div", { class: "field" }, h("label", { for: "ce-until" }, "Package valid until"), until)),
      h("div", { class: "field" }, h("label", { for: "ce-terms" }, "What the package includes"), terms),
      h("div", { class: "field" }, h("label", { for: "ce-match" }, "Recognise this client by"), h("p", { class: "hint" }, "Names, WhatsApp group names or Slack channels, separated by commas. Used to match shared chats to this client."), match),
      h("p", { style: "font-weight:600; margin:0 0 6px" }, "Monthly allowances"),
      h("div", { class: "items-head", "aria-hidden": "true" }, h("span", {}, "Deliverable"), h("span", {}, "Limit"), h("span", {}, "Used"), h("span", {})),
      rows,
      h("button", { type: "button", class: "link-btn", onclick: () => addRow({ name: "", limit: 10, used: 0 }) }, "Add a deliverable"),
      err,
      h("div", { class: "editor-actions" },
        h("button", { type: "button", class: "btn xs", onclick: save }, isNew ? "Save client" : "Save changes"),
        h("button", { type: "button", class: "btn ghost xs", onclick: () => { editor.hidden = true; } }, "Cancel"),
        h("span", { class: "spacer" }),
        !isNew && h("button", { type: "button", class: "link-btn danger", onclick: (e) => {
          const b = e.currentTarget;
          if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Select again to delete"; return; }
          clients = clients.filter((x) => x.id !== c.id); saveClients(); currentClient = ""; fillClientSelect(); selectClient("");
        } }, "Delete client"))));
    editor.hidden = false;
    name.focus();
  }

  clientSel.addEventListener("change", () => selectClient(clientSel.value));
  $("edit-client").addEventListener("click", () => getClient() && openEditor(false));
  $("new-client").addEventListener("click", () => openEditor(true));
  fillClientSelect();

  // ---------- extras ledger ----------
  const thisMonth = () => new Date().toISOString().slice(0, 7);
  const monthName = (m) => { try { return new Date(m + "-15T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" }); } catch { return m; } };
  const eur = (n) => "€" + (Math.round(n * 100) / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  function monthExtras(c) { return (c.ledger || []).filter((e) => e.month === thisMonth()); }
  function addExtra(c, { ask, quote = "", dimension = "other", date = "" }) {
    c.ledger = c.ledger || [];
    c.ledger.push({ id: "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), month: thisMonth(), date: today(), asked: date, ask: String(ask).slice(0, 200), quote: String(quote).slice(0, 300), dimension, price: null });
    saveClients(); renderClientInfo();
  }

  function proposalText(c, items) {
    const lines = items.map((e) => `- ${e.ask}: ${typeof e.price === "number" ? eur(e.price) : "to be quoted"}`);
    const priced = items.filter((e) => typeof e.price === "number");
    const total = priced.reduce((sum, e) => sum + e.price, 0);
    return [
      "Hi,",
      "",
      `Here is a short summary of the additional requests from ${monthName(thisMonth())} that go beyond your current package:`,
      "",
      ...lines,
      "",
      priced.length ? `Total: ${eur(total)} (excl. VAT)${priced.length < items.length ? ", plus the items still to be quoted" : ""}` : "We'll confirm the prices for these items.",
      "",
      "Would you like us to invoice these as a one-off add-on, or shall we look at an updated monthly package that covers this kind of request from next month? Happy to talk it through.",
    ].join("\n");
  }

  function renderLedger() {
    const c = getClient();
    if (!c) return;
    alertBox.hidden = true;
    const items = monthExtras(c);
    const totalEl = h("span", {});
    const recalc = () => { totalEl.textContent = eur(items.reduce((s2, e) => s2 + (typeof e.price === "number" ? e.price : 0), 0)); };
    const rows = items.map((e) => {
      const input = h("input", { type: "number", min: "0", step: "5", inputmode: "decimal", "aria-label": `Price for ${e.ask}`, placeholder: "€", value: typeof e.price === "number" ? String(e.price) : "" });
      input.addEventListener("input", () => { const v = parseFloat(input.value); e.price = Number.isFinite(v) && v >= 0 ? v : null; saveClients(); recalc(); });
      const tr = h("tr", {},
        h("td", { style: "white-space:nowrap" }, fmtDate(e.date)),
        h("td", {}, e.ask, e.quote ? h("span", { class: "q" }, `“${e.quote}”`) : null),
        h("td", { class: "cost" }, input),
        h("td", {}, h("button", { type: "button", class: "rm link-btn", "aria-label": `Remove ${e.ask}`, onclick: () => { c.ledger = c.ledger.filter((x) => x.id !== e.id); saveClients(); renderClientInfo(); renderLedger(); } }, "Remove")));
      return tr;
    });
    recalc();
    const propBox = h("textarea", { class: "reply-box", "aria-label": "Add-on proposal, editable", hidden: true, style: "min-height:300px" });
    const st = h("span", { class: "status", role: "status" });
    const copyBtn = h("button", { type: "button", class: "btn xs", hidden: true, onclick: () => copyText(propBox.value, st, "Proposal copied") }, "Copy proposal");
    const draftBtn = h("button", { type: "button", class: "btn ghost xs", disabled: !items.length, onclick: () => { propBox.value = proposalText(c, items); propBox.hidden = false; copyBtn.hidden = false; propBox.focus(); } }, "Draft the add-on proposal");
    const card = h("article", { class: "result" },
      h("div", { class: "r-head" },
        h("div", { class: "r-top" }, h("span", { class: "mode" }, "Extras ledger")),
        h("h2", { class: "r-summary", tabindex: "-1", id: "r-title" }, `${c.name}: ${items.length} extra${items.length === 1 ? "" : "s"} in ${monthName(thisMonth())}`),
        h("p", { class: "r-meta" }, "Put a price on each extra, then send the client one add-on proposal for the month.")),
      h("div", { class: "r-block" },
        items.length
          ? h("table", { class: "ledger-table" }, h("thead", {}, h("tr", {}, h("th", {}, "Logged"), h("th", {}, "Extra"), h("th", {}, "Price"), h("th", {}, ""))), h("tbody", {}, rows))
          : h("p", { style: "margin:0" }, "No extras logged this month yet. Scan a chat or check a request, then add the extras here."),
        items.length ? h("div", { class: "ledger-total" }, h("span", {}, "Total this month"), totalEl) : null),
      h("div", { class: "r-block" }, h("h3", {}, "Add-on proposal"), h("div", { class: "reply-tools", style: "margin:0 0 10px" }, draftBtn, copyBtn, st), propBox),
      h("div", { class: "r-foot" }, "The ledger is kept in this browser. Prices are yours to set; nothing is sent automatically."));
    out.replaceChildren(card);
    $("r-title").focus({ preventScroll: true });
    if (matchMedia("(max-width: 980px)").matches) card.scrollIntoView({ block: "start" });
  }

  // ---------- chat scan ----------
  const chat = $("chat");
  const CHAT_MAX = 30000;
  const SCAN_STEPS = ["Reading the client's file", "Finding every request in the chat", "Checking each one against the package and usage", "Drafting your reply"];
  const SCAN_EXAMPLE = [
    "[11/11/2026, 09:14:02] Marta (Lumen): Morning! Loved last week's carousel",
    "[11/11/2026, 09:15:40] Marta (Lumen): Could we add two more posts this month for the Black Friday promo?",
    "[11/11/2026, 09:31:12] Rita (Agency): Hi Marta! Let me check the plan and come back to you today.",
    "[12/11/2026, 14:02:55] João (Lumen): Hi all, João from the e-commerce team here. Can you also make a TikTok version of the Black Friday video?",
    "[12/11/2026, 14:05:10] Marta (Lumen): And could Thursday's LinkedIn post get a new headline? Third version, sorry",
    "[13/11/2026, 10:20:33] Rita (Agency): Thursday's LinkedIn draft is ready for review.",
    "[13/11/2026, 18:47:01] Marta (Lumen): Also, can someone reply to comments on the giveaway post over the weekend?",
    "[14/11/2026, 08:12:09] Marta (Lumen): Approved Friday's post, thanks!",
  ].join("\n");

  function chatCount() {
    const n = chat.value.length, c = $("chat-count");
    c.textContent = n > CHAT_MAX ? `${n.toLocaleString("en-GB")} characters, the most recent ${CHAT_MAX.toLocaleString("en-GB")} will be read` : `${n.toLocaleString("en-GB")} / ${CHAT_MAX.toLocaleString("en-GB")}`;
    c.classList.remove("bad");
  }
  function prepareChat(text) {
    let t = String(text).replace(/\r\n?/g, "\n").replace(/[‎‏‪-‮]/g, "");
    t = t.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]").replace(/\+?\d[\d ().-]{7,}\d/g, "[phone]");
    if (t.length > CHAT_MAX) { t = t.slice(-CHAT_MAX); const nl = t.indexOf("\n"); if (nl > -1 && nl < 400) t = t.slice(nl + 1); }
    return t.trim();
  }
  function loadScanExample() {
    let c = clients.find((x) => x.id === "lumen");
    if (!c) { c = clone(SEED[0]); clients.unshift(c); saveClients(); fillClientSelect(); }
    selectClient("lumen");
    chat.value = SCAN_EXAMPLE; chatCount(); $("chat-err").textContent = "";
  }
  const isScanExample = () => currentClient === "lumen" && chat.value.trim() === SCAN_EXAMPLE && scope.value.trim() === compose(SEED[0]);

  async function readZip(buf) {
    const dv = new DataView(buf), dec = new TextDecoder();
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("zip");
    const total = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true), best = null;
    for (let n = 0; n < total; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nl));
      if (/\.txt$/i.test(name) && !/^__MACOSX/.test(name) && (!best || /_chat\.txt$/i.test(name))) best = { method, size, off };
      p += 46 + nl + el + cl;
    }
    if (!best) throw new Error("notxt");
    const start = best.off + 30 + dv.getUint16(best.off + 26, true) + dv.getUint16(best.off + 28, true);
    const data = new Uint8Array(buf, start, best.size);
    if (best.method === 0) return dec.decode(data);
    if (best.method === 8 && typeof DecompressionStream === "function") return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
    throw new Error("method");
  }
  async function loadChatFile(file) {
    const err = $("chat-err");
    err.textContent = "";
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) { err.textContent = "This file is too large. Export the chat without media and try again."; return; }
    try {
      const isZip = /\.zip$/i.test(file.name) || /zip/.test(file.type);
      const text = isZip ? await readZip(await file.arrayBuffer()) : await file.text();
      chat.value = text.replace(/\r\n?/g, "\n"); chatCount();
      $("chat-note").textContent = `Loaded ${file.name}. Phone numbers and email addresses are hidden before analysis${chat.value.length > CHAT_MAX ? "; only the most recent messages will be read" : ""}.`;
    } catch {
      err.textContent = "We couldn't read this file. Export the chat again with “Without media”, or paste the messages instead.";
    }
  }

  async function runScan(simulation = false) {
    if (busy) return;
    alertBox.hidden = true;
    if (simulation && !isScanExample()) loadScanExample();
    const errChat = $("chat-err");
    clearErrors(); errChat.textContent = "";
    if (!simulation) {
      if (scope.value.trim().length < LIMITS.scope[0]) { $("scope-err").textContent = "Pick a saved client above, or describe what you agreed."; scope.setAttribute("aria-invalid", "true"); scope.focus(); return; }
      if (scope.value.trim().length > LIMITS.scope[1]) { $("scope-err").textContent = `Shorten this to ${LIMITS.scope[1]} characters.`; scope.focus(); return; }
      if (chat.value.trim().length < 20) { errChat.textContent = "Drop a chat export or paste the conversation to scan."; chat.focus(); return; }
    }
    const example = isScanExample();
    setBusy(true);
    showLoading(SCAN_STEPS);
    try {
      const { ok, data } = await post("/api/scan", {
        scopeText: scope.value.trim(), chatText: prepareChat(chat.value), lang: lang.value,
        accessCode: code.value.trim() || undefined, demo: simulation || undefined,
      });
      stopLoading();
      if (!ok || !data || !data.result) {
        restoreEmpty();
        showAlert((data && data.error && data.error.message) || "Something went wrong on our side. You can still view the simulated example.", !data || data.offer_mock !== false);
        return;
      }
      last = { ...data, scopeText: scope.value.trim() };
      renderScan({ ...data, custom: data.mode === "mock" && !example });
      if (scanningInboxId && data.mode === "live" && ws.code) { ws.inbox = ws.inbox.filter((x) => x.id !== scanningInboxId); pendingInboxDeletes.push(scanningInboxId); scheduleSync(); }
      scanningInboxId = null;
    } catch {
      stopLoading();
      restoreEmpty();
      showAlert("We couldn't reach Scope Ledger. Check your connection and try again, or view the simulated example.", true);
    } finally {
      setBusy(false);
    }
  }

  function renderScan({ mode: m, mock_reason, custom, result: r }) {
    const live = m === "live";
    const c = getClient();
    const nIn = r.requests.filter((x) => x.classification === "included").length;
    const nOut = r.requests.filter((x) => x.classification === "likely_out_of_scope").length;
    const nAmb = r.requests.filter((x) => x.classification === "ambiguous").length;
    const findItem = (name) => c && name ? c.items.find((i) => i.name.trim().toLowerCase() === name.trim().toLowerCase()) : null;

    const actionsFor = (x) => {
      const box = h("div", { class: "req-actions" });
      const done = (txt, extra) => box.replaceChildren(h("span", { class: "done-note" + (extra ? " extra" : "") }, txt));
      const doIt = () => {
        if (x._done) return;
        x._done = true;
        if (x.classification === "included") {
          const it = findItem(x.allowance_item);
          if (it && x.units > 0) {
            it.used += x.units; saveClients(); renderClientInfo(); refreshScopeFromClient();
            done(`Logged: ${it.name} now ${it.used} of ${it.limit} used`);
          } else done("Marked as included");
        } else {
          if (!getClient()) { x._done = false; return; }
          addExtra(getClient(), { ask: x.ask, quote: x.quote, dimension: x.dimension, date: x.date });
          done("Added to this month's extras", true);
        }
      };
      x._apply = doIt;
      const it = findItem(x.allowance_item);
      if (x.classification === "included") {
        box.append(h("button", { type: "button", class: "btn xs", onclick: doIt }, it && x.units > 0 ? `Log ${x.units} ${it.name} as used` : "Mark as included"));
      } else {
        box.append(h("button", { type: "button", class: "btn xs", disabled: !c, title: c ? "" : "Pick a saved client to keep a ledger", onclick: doIt }, x.classification === "ambiguous" ? "Log as extra if confirmed" : "Add to extras"));
      }
      box.append(h("button", { type: "button", class: "btn ghost xs", onclick: () => { x._done = true; done("Dismissed"); box.firstChild.classList.remove("extra"); box.firstChild.style.color = "var(--graphite)"; } }, "Dismiss"));
      return box;
    };

    const list = r.requests.length
      ? h("ol", { class: "reqs" }, r.requests.map((x) => h("li", { class: "req" },
          h("div", { class: "req-top" },
            h("span", { class: `pill ${x.classification}` }, VERDICT[x.classification]),
            h("span", { class: "req-ask" }, x.ask),
            h("span", { class: "req-meta" }, [x.sender, x.date].filter(Boolean).join(", "))),
          x.quote ? h("p", { class: "quote" }, h("mark", {}, x.quote), x.verified === false ? h("span", { class: "warn" }, "  Not found word for word in the chat, so check it.") : null) : null,
          h("p", { class: "req-reason" }, x.reason),
          actionsFor(x))))
      : h("p", { style: "margin:0" }, "No client requests found in this conversation.");

    const applyAll = h("button", { type: "button", class: "btn xs", disabled: !c || !r.requests.length, title: c ? "" : "Pick a saved client first", onclick: (e) => {
      r.requests.forEach((x) => { if (x._apply && !x._done && x.classification !== "ambiguous") x._apply(); });
      e.currentTarget.disabled = true; e.currentTarget.textContent = "Applied";
    } }, "Apply all suggestions");

    const head = h("div", { class: "r-head" },
      h("div", { class: "r-top" }, h("span", { class: live ? "mode live" : "mode" }, live ? "Live AI" : "Simulation"), c ? h("span", { class: "mode" }, c.name) : null),
      h("h2", { class: "r-summary", tabindex: "-1", id: "r-title" }, r.summary || `${r.requests.length} requests found`),
      h("div", { class: "scan-counts" },
        h("span", { class: "pill included" }, `${nIn} included`),
        h("span", { class: "pill likely_out_of_scope" }, `${nOut} likely extra`),
        h("span", { class: "pill ambiguous" }, `${nAmb} to clarify`)),
      h("div", { class: "reply-tools" }, applyAll, h("span", { class: "hint", style: "margin:0" }, "Logs included work and adds clear extras to the ledger. Items to clarify stay for you to decide.")),
      !live && h("p", { class: "r-sim" },
        custom
          ? "Live AI needs an access code, so this is the prepared result for the example chat, not an analysis of your conversation. Enter your access code and scan again."
          : mock_reason === "no_access_code"
            ? "This is the prepared result for the example chat. Enter your access code to scan your own conversations with live AI."
            : "This is the prepared result for the example chat, not a live analysis."));

    const blocks = [h("div", { class: "r-block" }, h("h3", {}, "Requests found"), list), replyBlock(r.client_reply, live)];
    if (r.internal_note) blocks.push(h("div", { class: "r-block" }, h("h3", {}, "Note for your team"), h("p", { style: "margin:0" }, r.internal_note)));
    const card = h("article", { class: "result" }, head, ...blocks,
      h("div", { class: "r-foot" }, "AI-assisted reading of the conversation you provided. Confirm each item before logging it. Nothing is sent automatically."));
    out.replaceChildren(card);
    if (matchMedia("(max-width: 980px)").matches) card.scrollIntoView({ block: "start" });
    $("r-title").focus({ preventScroll: true });
  }

  // ---------- mode tabs ----------
  function setMode(m) {
    mode = m;
    $("tab-scan").setAttribute("aria-selected", String(m === "scan"));
    $("tab-check").setAttribute("aria-selected", String(m === "check"));
    $("scan-fields").hidden = m !== "scan";
    $("check-fields").hidden = m !== "check";
    $("check-presets").hidden = m !== "check";
    setBusy(false);
    syncPreset();
    const empty = $("empty");
    if (empty) empty.lastChild.textContent = m === "scan" ? "Pick a client, drop in the week's chat, then select “Scan this chat”." : "Pick an example or paste your own texts, then select “Check this request”.";
  }
  $("tab-scan").addEventListener("click", () => setMode("scan"));
  $("tab-check").addEventListener("click", () => setMode("check"));
  $("load-chat-example").addEventListener("click", loadScanExample);
  $("chat-file").addEventListener("change", (e) => loadChatFile(e.target.files[0]));
  const drop = $("drop");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("over")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); loadChatFile(e.dataTransfer.files[0]); });
  chat.addEventListener("input", chatCount);

  // ---------- agency workspace (cloud) ----------
  const wsbar = $("wsbar");
  let syncTimer = null, syncing = false, pendingInboxDeletes = [], afterSignIn = null;

  function info(message) {
    alertBox.replaceChildren(h("p", {}, message));
    alertBox.className = "alert info";
    alertBox.hidden = false;
  }
  const showError = (m) => { alertBox.className = "alert"; showAlert(m, false); };

  async function wsFetch(method, body) {
    const res = await fetch("/api/workspace", { method, headers: { "content-type": "application/json", "x-workspace": ws.code }, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await res.json(); } catch { /* not json */ }
    return { ok: res.ok, status: res.status, data };
  }

  function applyServer(data) {
    ws.name = data.name || ws.name;
    lsSet("scopeledger.wsname.v1", ws.name);
    ws.inbox = Array.isArray(data.inbox) ? data.inbox : [];
    const byId = new Map(clients.map((c) => [c.id, c]));
    const next = [];
    let changed = false;
    for (const sc of data.clients || []) {
      const lc = byId.get(sc.id);
      if (!lc) { next.push(sc); changed = true; continue; }
      const dirty = snapshot.get(lc.id) !== sig(lc);
      if (sig(lc) !== sig(sc) && !(dirty && (lc.updatedAt || 0) > (sc.updatedAt || 0))) {
        Object.keys(lc).forEach((k) => delete lc[k]); Object.assign(lc, sc); changed = true;
      }
      next.push(lc);
    }
    for (const lc of clients) if (!(data.clients || []).some((sc) => sc.id === lc.id)) {
      if (!snapshot.has(lc.id)) next.push(lc); else changed = true; // keep unsynced new clients; drop ones deleted elsewhere
    }
    clients = next;
    snapshot = new Map((data.clients || []).map((c) => [c.id, sig(c)]));
    lsSet(WS_CACHE, JSON.stringify(clients));
    if (changed) {
      if (!clients.some((c) => c.id === currentClient)) currentClient = clients[0] ? clients[0].id : "";
      fillClientSelect(); renderClientInfo();
      if (currentClient && editor.hidden) { scope.value = compose(getClient()); count(); }
    }
    renderWsBar();
    if (!editor.hidden) return;
    if (out.querySelector(".inbox-card")) renderInbox();
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    ws.state = "saving"; renderWsBar();
    syncTimer = setTimeout(doSync, 1000);
  }
  async function doSync() {
    if (!ws.code) return;
    if (syncing) { scheduleSync(); return; }
    const upserts = clients.filter((c) => snapshot.get(c.id) !== sig(c));
    const deletes = [...snapshot.keys()].filter((id) => !clients.some((c) => c.id === id));
    const inboxDeletes = pendingInboxDeletes.splice(0);
    if (!upserts.length && !deletes.length && !inboxDeletes.length) { ws.state = "synced"; renderWsBar(); return; }
    syncing = true;
    try {
      const r = await wsFetch("PUT", { upserts, deletes, inboxDeletes });
      if (r.ok && r.data) { ws.state = "synced"; applyServer(r.data); }
      else if (r.status === 401) { signOut("Your workspace code is no longer valid. Sign in again."); }
      else throw new Error("sync");
    } catch {
      pendingInboxDeletes.push(...inboxDeletes);
      ws.state = "offline"; renderWsBar();
      syncTimer = setTimeout(doSync, 10000);
    } finally { syncing = false; }
  }
  async function pull() {
    if (!ws.code || syncing) return;
    if (clients.some((c) => snapshot.get(c.id) !== sig(c))) return doSync();
    try {
      const r = await wsFetch("GET");
      if (r.ok && r.data) { ws.state = "synced"; applyServer(r.data); }
      else if (r.status === 401) signOut("Your workspace code is no longer valid. Sign in again.");
    } catch { ws.state = "offline"; renderWsBar(); }
  }

  async function signIn(codeValue) {
    const codeTry = String(codeValue || "").trim().toUpperCase();
    const res = await fetch("/api/workspace", { headers: { "x-workspace": codeTry } });
    let data = null; try { data = await res.json(); } catch { /* not json */ }
    if (!res.ok || !data || !Array.isArray(data.clients)) return (data && data.error && data.error.message) || "We couldn't reach your workspace. Try again.";
    const localClients = clients;
    ws.code = codeTry; lsSet(WS_STORE, codeTry);
    clients = []; snapshot = new Map();
    applyServer(data);
    ws.state = "synced";
    if (!data.clients.length && localClients.length) ws.offerCopy = localClients;
    currentClient = clients[0] ? clients[0].id : "";
    fillClientSelect(); selectClient(currentClient);
    $("code-field").hidden = true;
    renderWsBar();
    if (afterSignIn) { const f = afterSignIn; afterSignIn = null; f(); }
    return null;
  }
  function signOut(message) {
    ws.code = ""; ws.name = ""; ws.inbox = []; ws.state = "local"; ws.offerCopy = null;
    lsSet(WS_STORE, null); lsSet(WS_CACHE, null); lsSet("scopeledger.wsname.v1", null);
    snapshot = new Map(); clients = loadClients();
    currentClient = ""; fillClientSelect(); selectClient(clients[0] ? clients[0].id : "");
    $("code-field").hidden = false;
    renderWsBar();
    if (message) showError(message);
  }

  function renderWsBar() {
    if (!wsbar) return;
    if (ws.code) {
      const label = { saving: "Saving…", synced: "Synced", offline: "Offline, will retry", local: "" }[ws.state] || "Synced";
      const n = ws.inbox.length;
      wsbar.replaceChildren(
        h("div", { class: "ws-row" },
          h("div", {}, h("span", { class: "ws-name" }, ws.name || "Your workspace"), h("span", { class: "ws-state" + (ws.state === "offline" ? " bad" : "") }, label)),
          h("div", { class: "ws-actions" },
            h("button", { type: "button", class: "btn xs" + (n ? "" : " ghost"), onclick: () => { pull(); renderInbox(); } }, n ? `Inbox (${n})` : "Inbox"),
            h("a", { class: "btn ghost xs", href: "/connect.html" }, "Connect"),
            h("button", { type: "button", class: "link-btn", onclick: () => signOut() }, "Sign out"))),
        ws.offerCopy ? h("p", { class: "hint", style: "margin:10px 0 0" }, "This workspace has no clients yet. ",
          h("button", { type: "button", class: "link-btn", onclick: () => {
            const now = Date.now();
            clients = ws.offerCopy.map((c) => ({ ...clone(c), updatedAt: now })); ws.offerCopy = null;
            currentClient = clients[0] ? clients[0].id : ""; fillClientSelect(); selectClient(currentClient); saveClients();
          } }, `Copy the ${ws.offerCopy.length} clients from this browser`)) : "");
      return;
    }
    const codeIn = h("input", { type: "text", id: "ws-code", placeholder: "SL-XXXX-XXXX-XXXX", autocomplete: "off", "aria-label": "Workspace code", spellcheck: "false" });
    const err = h("p", { class: "err", role: "alert" });
    const doSignIn = async () => { err.textContent = ""; const e = await signIn(codeIn.value); if (e) err.textContent = e; };
    codeIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSignIn(); } });
    const createBox = h("div", { class: "ws-create", hidden: true });
    const nameIn = h("input", { type: "text", placeholder: "Agency name", "aria-label": "Agency name" });
    const adminIn = h("input", { type: "password", placeholder: "Admin access code", "aria-label": "Admin access code", autocomplete: "off" });
    const copyLocal = h("input", { type: "checkbox", id: "ws-copy" });
    const createErr = h("p", { class: "err", role: "alert" });
    const created = h("div", {});
    createBox.append(
      h("div", { class: "two" }, nameIn, adminIn),
      h("label", { class: "check" }, copyLocal, " Start with the clients in this browser"),
      h("button", { type: "button", class: "btn xs", onclick: async () => {
        createErr.textContent = "";
        try {
          const res = await fetch("/api/workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", name: nameIn.value, adminCode: adminIn.value || code.value, clients: copyLocal.checked ? clients : [] }) });
          const data = await res.json();
          if (!res.ok) { createErr.textContent = (data.error && data.error.message) || "Couldn't create the workspace."; return; }
          const st = h("span", { class: "status", role: "status" });
          created.replaceChildren(h("div", { class: "ws-created" },
            h("p", { style: "margin:0 0 6px" }, `Workspace “${data.name}” created. Give this code to the agency; it's their sign-in and their AI access:`),
            h("p", { class: "ws-code-big" }, data.code),
            h("div", { class: "reply-tools", style: "margin:0" },
              h("button", { type: "button", class: "btn ghost xs", onclick: () => copyText(`${location.origin}/app.html?ws=${data.code}`, st, "Sign-in link copied") }, "Copy sign-in link"),
              h("button", { type: "button", class: "btn xs", onclick: () => signIn(data.code) }, "Sign in to it"), st)));
        } catch { createErr.textContent = "Couldn't reach the server. Try again."; }
      } }, "Create workspace"), createErr, created);
    wsbar.replaceChildren(
      h("p", { class: "ws-local" }, h("b", {}, "Working in this browser. "), "Sign in to your agency workspace to sync clients across devices and colleagues, and to receive messages from WhatsApp and Slack."),
      h("div", { class: "ws-signin" }, codeIn, h("button", { type: "button", class: "btn xs", onclick: doSignIn }, "Sign in")),
      err,
      h("button", { type: "button", class: "link-btn", onclick: () => { createBox.hidden = !createBox.hidden; } }, "Create a workspace for an agency (admin)"),
      createBox);
  }

  // ---------- inbox ----------
  const SOURCE = { iphone: "iPhone", android: "Android", slack: "Slack", app: "Scope Ledger", share: "Shared" };
  function matchClient(text, title) {
    const hay = `${title || ""}\n${String(text || "").slice(0, 4000)}`.toLowerCase();
    let best = null, bestScore = 0;
    for (const c of clients) {
      const words = [c.name, ...String(c.match || "").split(",")].map((w) => w.trim().toLowerCase()).filter((w) => w.length >= 3);
      let score = 0;
      for (const w of words) { const parts = hay.split(w).length - 1; score += parts * (title && title.toLowerCase().includes(w) ? 3 : 1); }
      if (score > bestScore) { best = c; bestScore = score; }
    }
    return best;
  }
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : fmtDate(new Date(t).toISOString().slice(0, 10)); };
  let scanningInboxId = null;

  function openShared(text, title, inboxId) {
    setMode("scan");
    chat.value = text; chatCount();
    const m = matchClient(text, title);
    if (m) selectClient(m.id);
    scanningInboxId = inboxId || null;
    if (!getClient()) { info("Conversation loaded. Pick the client it belongs to, then select “Scan this chat”."); $("client").focus(); return false; }
    info(`Conversation loaded${m ? ` and matched to ${m.name}` : ""}. Check the client, then select “Scan this chat”.`);
    return true;
  }

  function renderInbox() {
    alertBox.hidden = true;
    const items = ws.inbox || [];
    const list = items.length ? h("ul", { class: "reqs" }, items.map((it) => {
      const m = matchClient(it.text, it.title);
      const preview = it.text.length > 280 ? it.text.slice(0, 280) + "…" : it.text;
      return h("li", { class: "req" },
        h("div", { class: "req-top" },
          h("span", { class: "pill ambiguous" }, SOURCE[it.source] || "Shared"),
          h("span", { class: "req-ask" }, it.title || "Conversation"),
          h("span", { class: "req-meta" }, ago(it.at))),
        h("p", { class: "inbox-preview" }, preview),
        h("p", { class: "req-meta", style: "margin:0 0 10px" }, m ? `Looks like: ${m.name}` : "No client matched yet"),
        h("div", { class: "req-actions" },
          h("button", { type: "button", class: "btn xs", onclick: () => { if (openShared(it.text, it.title, it.id)) runScan(false); } }, m ? `Scan for ${m.name}` : "Open to scan"),
          h("button", { type: "button", class: "btn ghost xs", onclick: () => { ws.inbox = ws.inbox.filter((x) => x.id !== it.id); pendingInboxDeletes.push(it.id); scheduleSync(); renderInbox(); renderWsBar(); } }, "Delete")));
    })) : h("p", { style: "margin:0" }, "Nothing here yet. Send conversations from WhatsApp on your phone or from Slack, and they'll appear here. See Connect for the one-time setup.");
    const card = h("article", { class: "result inbox-card" },
      h("div", { class: "r-head" },
        h("div", { class: "r-top" }, h("span", { class: "mode" }, "Inbox")),
        h("h2", { class: "r-summary", tabindex: "-1", id: "r-title" }, items.length ? `${items.length} conversation${items.length === 1 ? "" : "s"} waiting` : "Your inbox is empty"),
        h("p", { class: "r-meta" }, "Conversations shared from WhatsApp or Slack. Scanned items leave the inbox; everything else is removed after 30 days.")),
      h("div", { class: "r-block" }, list),
      h("div", { class: "r-foot" }, h("a", { href: "/connect.html" }, "Set up WhatsApp and Slack sharing")));
    out.replaceChildren(card);
    $("r-title").focus({ preventScroll: true });
  }

  // ---------- incoming links: shared chats and Slack connection ----------
  async function handleIncoming(params) {
    if (params.get("shared") === "1" && "caches" in window) {
      try {
        const cache = await caches.open("sl-share");
        const fileRes = await cache.match("/shared-file");
        const textRes = await cache.match("/shared-text");
        if (fileRes) {
          const name = decodeURIComponent(fileRes.headers.get("x-name") || "shared.txt");
          await loadChatFile(new File([await fileRes.blob()], name));
          openShared(chat.value, name);
        } else if (textRes) { const t = await textRes.text(); if (t.trim()) openShared(t, ""); }
        await cache.delete("/shared-file"); await cache.delete("/shared-text");
      } catch { showError("We couldn't open what was shared. Try sharing again, or use “Choose export file”."); }
    }
    if (params.get("shared_text")) openShared(params.get("shared_text"), "");
    if (params.get("shared") === "missing") info("Open Scope Ledger from your home screen once, then share the chat again. You can also use “Choose export file”.");
    const token = params.get("slack_link");
    if (token) {
      const link = async () => {
        const r = await fetch("/api/slack-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, workspace: ws.code }) });
        let d = null; try { d = await r.json(); } catch { /* ignore */ }
        if (r.ok) { info(`Slack connected to ${ws.name || "your workspace"}. Messages you send with “Send to Scope Ledger” will appear in your inbox.`); pull(); }
        else showError((d && d.error && d.error.message) || "We couldn't connect Slack. Use the Slack shortcut again to get a new link.");
      };
      if (ws.code) await link(); else { afterSignIn = link; info("Sign in to your agency workspace (top left) to finish connecting Slack."); }
    }
    const clean = new URL(location.href);
    ["shared", "shared_text", "slack_link", "ws"].forEach((k) => clean.searchParams.delete(k));
    history.replaceState(null, "", clean.pathname + clean.search + clean.hash);
  }

  // ---------- wire up ----------
  $("form").addEventListener("submit", (e) => { e.preventDefault(); if (mode === "scan") runScan(false); else run(false); });
  chips.forEach((c) => c.addEventListener("click", () => setPreset(c.dataset.preset)));
  [scope, req].forEach((el) => el.addEventListener("input", () => { count(); syncPreset(); }));

  const params = new URLSearchParams(location.search);
  if (params.get("code")) code.value = params.get("code");
  if (params.get("lang") && [...lang.options].some((o) => o.value === params.get("lang"))) lang.value = params.get("lang");
  setPreset(PRESETS[params.get("example")] ? params.get("example") : "tiktok");
  if (ws.code) {
    $("code-field").hidden = true;
    snapshot = new Map(clients.map((c) => [c.id, sig(c)]));
    currentClient = ""; fillClientSelect(); selectClient(clients[0] ? clients[0].id : "");
    setMode(params.get("mode") === "check" ? "check" : "scan");
    renderWsBar(); pull().then(() => { if (location.hash === "#inbox") renderInbox(); });
  } else {
    if (params.get("mode") === "check" || PRESETS[params.get("example")]) setMode("check");
    else { loadScanExample(); setMode("scan"); }
    renderWsBar();
  }
  if (params.get("ws") && !ws.code) signIn(params.get("ws")).then((e) => { if (e) showError(e); });
  handleIncoming(params);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pull(); });
  setInterval(() => { if (document.visibilityState === "visible") pull(); }, 60000);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
})();
