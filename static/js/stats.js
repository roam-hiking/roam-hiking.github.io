// Visitor stats (GoatCounter, cookieless). Dashboard: https://roam-hiking.goatcounter.com
// count.js already skips localhost/file previews, so local testing is not counted.
// Clicks on outbound links (paper DOI, arXiv, code, YouTube, ...) and the PDF are logged as events.
document.addEventListener("click", function (e) {
  var a = e.target.closest && e.target.closest("a[href]");
  if (!a || !window.goatcounter || !window.goatcounter.count) return;
  var u = new URL(a.href, location.href);
  var out = u.host !== location.host, pdf = /\.pdf$/i.test(u.pathname);
  if (!out && !pdf) return;
  window.goatcounter.count({
    path: (out ? "out: " + u.host + u.pathname : "file: " + u.pathname),
    title: (a.textContent || "").trim().slice(0, 80),
    event: true,
  });
}, true);
