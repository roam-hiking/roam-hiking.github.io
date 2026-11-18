// Shared by index.html and expeditions.html: lightbox, scroll reveal, nav, colour ramp.
// ---------- Lightbox with prev/next over all zoomable images ----------
const lb = document.getElementById("lb"), lbImg = lb.querySelector("img"), lbCap = lb.querySelector(".lbcap");
const items = () => [...document.querySelectorAll("[data-lb]")].filter(el => !el.classList.contains("dim"));
let cur = 0;
const srcOf = el => el.dataset.src || el.querySelector("img").src;
const capOf = el => el.dataset.cap || (el.nextElementSibling && el.nextElementSibling.tagName === "FIGCAPTION" ? el.nextElementSibling.textContent : el.querySelector("img").alt);
function show(i) { const list = items(); cur = (i + list.length) % list.length; const el = list[cur]; lbImg.src = srcOf(el); lbImg.alt = el.querySelector("img").alt; lbCap.textContent = capOf(el); }
document.addEventListener("click", e => {
  const el = e.target.closest("[data-lb]");
  if (el && !lb.contains(el)) { show(items().indexOf(el)); lb.classList.add("open"); document.body.style.overflow = "hidden"; }
});
const close = () => { lb.classList.remove("open"); document.body.style.overflow = ""; };
lb.querySelector(".x").onclick = close;
lb.querySelector(".prev").onclick = e => { e.stopPropagation(); show(cur - 1); };
lb.querySelector(".next").onclick = e => { e.stopPropagation(); show(cur + 1); };
lb.addEventListener("click", e => { if (e.target === lb) close(); });
document.addEventListener("keydown", e => {
  if (!lb.classList.contains("open")) return;
  if (e.key === "Escape") close(); if (e.key === "ArrowLeft") show(cur - 1); if (e.key === "ArrowRight") show(cur + 1);
});

// ---------- Reveal on scroll ----------
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12, rootMargin: "0px 0px -40px 0px" });
document.querySelectorAll(".rv").forEach(el => io.observe(el));

// ---------- Nav: show after hero, progress bar, active link ----------
const nav = document.getElementById("nav"), bar = document.getElementById("progress"), hero = document.querySelector(".hero");
const links = [...nav.querySelectorAll("ul a")], secs = links.map(a => document.querySelector(a.getAttribute("href")));
function onScroll() {
  const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
  nav.classList.toggle("show", y > (hero ? hero.offsetHeight : 0) - 80);
  bar.style.width = (h > 0 ? y / h * 100 : 0) + "%";
  let on = -1; secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * .4) on = i; });
  links.forEach((a, i) => a.classList.toggle("on", i === on));
}
addEventListener("scroll", onScroll, { passive: true }); onScroll();


// Diverging blue (go) to red (avoid), matching the risk overlays in the videos
// matplotlib "coolwarm", as in the paper's risk images (blue = low, red = high)
const COOLWARM = [[58, 76, 192], [141, 175, 253], [221, 220, 219], [243, 152, 121], [179, 3, 38]];
const coolwarm = x => { x = Math.max(0, Math.min(1, x)) * (COOLWARM.length - 1); const k = Math.min(Math.floor(x), COOLWARM.length - 2), t = x - k;
  return `rgb(${COOLWARM[k].map((c, j) => Math.round(c + (COOLWARM[k + 1][j] - c) * t)).join(",")})`; };
const ramp = (v, invert) => coolwarm(invert ? 1 - v : v);
