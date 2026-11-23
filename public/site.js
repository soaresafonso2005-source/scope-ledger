(() => {
  "use strict";
  const eur = (n) => "€" + Math.round(n).toLocaleString("en-GB");

  // Cost calculator
  const ids = ["req", "hrs", "share", "rate"];
  const inputs = Object.fromEntries(ids.map((k) => [k, document.getElementById("c-" + k)]));
  function calc() {
    if (!inputs.req) return;
    const req = +inputs.req.value, hrs = +inputs.hrs.value, share = +inputs.share.value / 100, rate = +inputs.rate.value;
    document.getElementById("o-req").textContent = req;
    document.getElementById("o-hrs").textContent = hrs;
    document.getElementById("o-share").textContent = Math.round(share * 100) + "%";
    document.getElementById("o-rate").textContent = rate;
    const hours = req * hrs * share;
    const value = hours * rate;
    document.getElementById("c-total").textContent = eur(value);
    document.getElementById("c-hours").textContent = `${hours % 1 ? hours.toFixed(1) : hours} hours of unbilled work`;
    const cover = value > 0 ? value / 19 : 0;
    document.getElementById("c-compare").innerHTML = "";
    const p = document.getElementById("c-compare");
    p.append("Scope Ledger Studio costs ");
    const s = document.createElement("strong"); s.textContent = "€19 a month"; p.append(s);
    p.append(cover >= 1 ? `, about ${Math.max(1, Math.floor(cover))}× less than what you give away.` : ".");
  }
  ids.forEach((k) => inputs[k] && inputs[k].addEventListener("input", calc));
  calc();

  // Billing toggle
  const buttons = document.querySelectorAll(".billing button");
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      const period = b.dataset.period;
      buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      document.querySelectorAll(".price[data-monthly]").forEach((el) => {
        el.firstChild.textContent = "€" + el.dataset[period];
      });
      document.querySelectorAll(".billed[data-monthly]").forEach((el) => {
        el.textContent = el.dataset[period];
      });
    })
  );
})();
