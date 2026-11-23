(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const origin = location.origin;
  let code = "";
  try { code = localStorage.getItem("scopeledger.workspace.v1") || ""; } catch { /* storage unavailable */ }

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    for (const k of kids) if (k != null) n.append(typeof k === "string" ? document.createTextNode(k) : k);
    return n;
  };

  document.querySelectorAll(".site-url").forEach((s) => { s.textContent = origin; });

  // Workspace status
  const status = $("ws-status");
  if (code) {
    status.append(
      el("p", {}, "Signed in on this device with workspace code ", el("code", {}, code), ". Every person who shares chats needs this code in their Shortcut or app."),
    );
    $("ios-url").textContent = `${origin}/api/inbox?source=iphone&ws=${code}`;
  } else {
    status.append(el("p", {}, "Sign in to your agency workspace in the app first, then come back to this page. Your personal sharing address will appear below."),
      el("a", { class: "btn sm", href: "/app.html" }, "Open the app and sign in"));
  }

  // Slack manifest, filled with this site's address
  $("manifest").textContent = [
    "display_information:",
    "  name: Scope Ledger",
    "  description: Send client messages to your Scope Ledger inbox.",
    '  background_color: "#172033"',
    "features:",
    "  bot_user:",
    "    display_name: Scope Ledger",
    "    always_online: false",
    "  shortcuts:",
    "    - name: Send to Scope Ledger",
    "      type: message",
    "      callback_id: send_to_scope_ledger",
    "      description: Check this request against the client's package",
    "oauth_config:",
    "  redirect_urls:",
    `    - ${origin}/api/slack-oauth`,
    "  scopes:",
    "    bot:",
    "      - commands",
    "settings:",
    "  interactivity:",
    "    is_enabled: true",
    `    request_url: ${origin}/api/slack`,
    "  org_deploy_enabled: false",
    "  socket_mode_enabled: false",
    "  token_rotation_enabled: false",
  ].join("\n");

  // Slack: agency instructions depend on whether the owner has set the app up
  const slack = $("slack-agency");
  fetch("/api/config").then((r) => r.json()).then((cfg) => {
    if (cfg.slackReady && cfg.slackClientId) {
      const url = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(cfg.slackClientId)}&scope=commands&redirect_uri=${encodeURIComponent(origin + "/api/slack-oauth")}`;
      slack.append(
        el("ol", { class: "steps-list" },
          el("li", {}, "Add the app to your agency's Slack: ", el("a", { class: "btn xs", href: url }, "Add to Slack")),
          el("li", {}, "On any client message, open the ⋯ menu › ", el("b", {}, "Send to Scope Ledger"), ". The first time, Slack replies with a link: open it while signed in to Scope Ledger to connect your workspace."),
          el("li", {}, "From then on, every message you send appears in your Scope Ledger inbox.")));
    } else {
      slack.append(el("p", {}, "The Slack app isn't set up on this site yet. The site owner can follow the steps below once; after that, every agency can add it with one click."));
    }
  }).catch(() => slack.append(el("p", {}, "Couldn't load the Slack settings. Reload the page to try again.")));

  // Result of "Add to Slack"
  const notice = $("notice");
  const q = new URLSearchParams(location.search).get("slack");
  const msg = {
    installed: "Scope Ledger was added to your Slack. Use “Send to Scope Ledger” on any message; the first time, Slack will give you a link to connect your workspace.",
    cancelled: "Slack installation was cancelled.",
    failed: "Slack couldn't finish the installation. Try “Add to Slack” again.",
    not_configured: "The Slack app isn't fully configured on this site yet.",
  }[q];
  if (msg) { notice.textContent = msg; notice.className = q === "installed" ? "alert info" : "alert"; notice.hidden = false; }

  // Copy buttons
  document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    const text = $(b.dataset.copy).textContent;
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement("textarea"); t.value = text; document.body.append(t); t.select(); document.execCommand("copy"); t.remove();
    }
    const old = b.textContent; b.textContent = "Copied"; setTimeout(() => { b.textContent = old; }, 2000);
  }));

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
})();
