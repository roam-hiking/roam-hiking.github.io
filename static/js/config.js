// ============================================================
//  SITE SETTINGS: the only place to edit at publication.
//  Empty values keep the "soon" placeholders.
// ============================================================
// Language: ja/index.html loads static/js/ja.js (window.I18N) first and sets <html data-root="../">.
// On the English page I18N is undefined, so T() returns its English text unchanged and ROOT is "".
window.ROOT = document.documentElement.dataset.root || "";
window.LB = s => (window.I18N_LABELS && I18N_LABELS[s]) || s;   // VLM label token -> display name
window.T = (s, ...a) => { const t = (window.I18N && I18N[s]) || s; return a.length ? t.replace(/\{(\d)\}/g, (_, i) => a[i]) : t; };
window.SITE = {
  youtube: { movie1: "xcqVpbgklD4", seealpsee: "wrbAq2HXE8E", zermattOnboard: "", zermattBehind: "", seealpseeBehind: "", seealpseeOnboard: "" },   // YouTube video IDs, e.g. "dQw4w9WgXcQ"
  links: { paper: "static/paper/roam-paper.pdf", arxiv: "https://arxiv.org/abs/2611.25215", supplementary: "" },   // authors' version (same build as the arXiv upload); swap for the arXiv URL once it is up
  published: true                                 // true hides the embargo bar (the noindex <meta> is gone from both pages)
};
document.querySelectorAll("[data-yt-key]").forEach(el => el.dataset.youtube = SITE.youtube[el.dataset.ytKey] || "");
document.querySelectorAll("[data-link]").forEach(a => {
  const url = SITE.links[a.dataset.link]; if (!url) return;
  a.href = /^[a-z]+:/i.test(url) ? url : ROOT + url; a.classList.remove("disabled"); a.removeAttribute("aria-disabled"); a.target = "_blank"; a.rel = "noopener";
  a.hidden = false;
  a.lastChild.textContent = a.dataset.link === "paper" ? T(/\.pdf$/i.test(url) ? "Paper (PDF)" : "Paper") : a.dataset.link === "arxiv" ? "arXiv" : T("Supplementary");
});
// "Watch" opens Movie 1 on YouTube once its ID is set; until then it scrolls to the highlight
const watch = document.querySelector("[data-watch]");
if (watch && SITE.youtube.movie1) { watch.href = "https://www.youtube.com/watch?v=" + SITE.youtube.movie1; watch.target = "_blank"; watch.rel = "noopener"; }
if (SITE.published) document.querySelector(".draft-bar")?.remove();
