// ============================================================
//  SITE SETTINGS: the only place to edit at publication.
//  Empty values keep the "soon" placeholders.
// ============================================================
window.SITE = {
  youtube: { movie1: "xcqVpbgklD4", seealpsee: "wrbAq2HXE8E", zermattOnboard: "", zermattBehind: "", seealpseeBehind: "", seealpseeOnboard: "" },   // YouTube video IDs, e.g. "dQw4w9WgXcQ"
  links: { paper: "https://doi.org/10.1126/scirobotics.aee1549", supplementary: "" },   // the paper at Science Robotics; swap for the arXiv URL once it is up if preferred
  published: true                                 // true hides the embargo bar (the noindex <meta> is gone from both pages)
};
document.querySelectorAll("[data-yt-key]").forEach(el => el.dataset.youtube = SITE.youtube[el.dataset.ytKey] || "");
document.querySelectorAll("[data-link]").forEach(a => {
  const url = SITE.links[a.dataset.link]; if (!url) return;
  a.href = url; a.classList.remove("disabled"); a.removeAttribute("aria-disabled"); a.target = "_blank"; a.rel = "noopener";
  a.lastChild.textContent = a.dataset.link === "paper" ? (/\.pdf$/i.test(url) ? "Paper (PDF)" : "Paper") : "Supplementary";
});
// "Watch" opens Movie 1 on YouTube once its ID is set; until then it scrolls to the highlight
const watch = document.querySelector("[data-watch]");
if (watch && SITE.youtube.movie1) { watch.href = "https://www.youtube.com/watch?v=" + SITE.youtube.movie1; watch.target = "_blank"; watch.rel = "noopener"; }
if (SITE.published) document.querySelector(".draft-bar")?.remove();
