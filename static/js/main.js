// index.html: gallery, labs, scroll movie, sliders.
// ---------- Gallery (tiles cropped from Fig. 2) ----------
const envs = [
  ["b","Below the Matterhorn","nature","big"],["a","Lakeside trail with cows","nature",""],["c","Steep rocky slope","nature",""],
  ["o","Danger sign","challenge","wide"],["d","Muddy mountain path","nature",""],["e","Alpine meadow","nature","wide"],
  ["f","Forest","nature",""],["m","Smoke","challenge","big"],["g","Grass","nature",""],["h","University campus","urban",""],
  ["l","Indoor stairs","indoor",""],["i","Village road","urban",""],["j","Indoor atrium","indoor",""],
  ["n","Train tracks","challenge","wide"],["k","Building entrance","indoor",""]
];
const g = document.getElementById("gallery");
g.innerHTML = envs.map(([id, label, cat, size]) =>
  `<div class="tile ${size}" data-cat="${cat}" data-lb data-src="static/img/env-hi/${id}.jpg" data-cap="Fig. 2${id.toUpperCase()}. ${label}">
     <img src="static/img/env-hi/${id}.jpg" alt="${label}" loading="lazy">
     <div class="lbl"><span>${label}</span><small>${cat}</small></div></div>`).join("");
document.querySelectorAll(".chip[data-f]").forEach(chip => chip.addEventListener("click", () => {
  document.querySelectorAll(".chip[data-f]").forEach(c => c.setAttribute("aria-pressed", c === chip));
  const f = chip.dataset.f;
  g.querySelectorAll(".tile").forEach(t => t.classList.toggle("dim", f !== "all" && t.dataset.cat !== f));
}));

// ---------- Indoor -> urban -> nature: the VLM's labels over the run, synced with the clip ----------
{
  const box = document.querySelector("#in-out .io-tl");
  if (box) fetch(box.dataset.src).then(r => r.json()).then(D => {
    const v = document.querySelector("#in-out video"), A = D.answers, R = D.rows, dur = D.duration;
    const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
    const risk = r => `rgb(${r < .5 ? mix([59, 76, 192], [221, 221, 221], r * 2) : mix([221, 221, 221], [180, 4, 38], r * 2 - 1)})`;
    const L = 122, W = 900, ch = 13, T = 18, H = T + R.length * ch + 4, X = t => L + t / dur * (W - L - 4);
    let cells = "";
    A.forEach((a, k) => { const x0 = X(a.t), x1 = k + 1 < A.length ? X(A[k + 1].t) : X(dur);
      R.forEach((n, j) => { if (n in a.l) cells += `<rect x="${x0.toFixed(1)}" y="${T + j * ch}" width="${Math.max(1, x1 - x0 - .6).toFixed(1)}" height="${ch - 2}" rx="1.5" fill="${risk(a.l[n])}"/>`; }); });
    const names = R.map((n, j) => `<text x="${L - 6}" y="${T + j * ch + 9}" text-anchor="end">${n}</text>`).join("");
    const ph = D.phases.map(([t, n]) => { const end = t > dur * .9;   // a label near the right edge hangs to the left of its line
      return `<g class="ph"><line x1="${X(t)}" x2="${X(t)}" y1="2" y2="${H}"/><text x="${X(t) + (end ? -4 : 4)}" y="12" text-anchor="${end ? "end" : "start"}">${n}</text></g>`; }).join("");
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${ph}${names}${cells}<line class="head" x1="${L}" x2="${L}" y1="${T - 3}" y2="${H}"/></svg>`;
    const svg = box.querySelector("svg"), head = svg.querySelector(".head"), when = document.querySelector("#in-out .io-when"), chips = document.querySelector("#in-out .io-chips");
    let cur = -1;
    const show = t => {
      head.setAttribute("x1", X(t)); head.setAttribute("x2", X(t));
      let k = 0; while (k + 1 < A.length && A[k + 1].t <= t) k++;
      if (k === cur) return; cur = k;
      const prev = k ? A[k - 1].l : {}, l = Object.entries(A[k].l).sort((a, b) => a[1] - b[1]);
      when.textContent = `answer ${k + 1} of ${A.length}`;
      chips.innerHTML = l.map(([n, r]) => `<span class="io-chip${n in prev ? "" : " new"}"><i style="background:${risk(r)}"></i>${n} ${r.toFixed(1)}</span>`).join("");
    };
    v.addEventListener("timeupdate", () => show(v.currentTime));
    svg.addEventListener("click", e => { const r = svg.getBoundingClientRect(), t = ((e.clientX - r.left) / r.width * W - L) / (W - L - 4) * dur;
      if (t >= 0) { v.currentTime = Math.min(dur - .1, t); show(v.currentTime); v.play().catch(() => {}); } });
    show(0);
  });
}

// ---------- Locomotion training clip: plays only while on screen ----------
document.querySelectorAll(".loco-train video").forEach(v => new IntersectionObserver(([e]) => {
  if (e.isIntersecting) { if (v.preload === "none") v.preload = "auto"; v.play().catch(() => {}); } else v.pause(); }, { threshold: .35 }).observe(v));

// ---------- Hike highlight cards: play while on screen; the button scrolls to that hike's map ----------
document.querySelectorAll(".hl video, .xp-demo video").forEach(v => {
    new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: .25 }).observe(v);
    v.addEventListener("click", () => { if (v.paused) v.play().catch(() => {}); });  // if the phone blocks autoplay, a tap starts it
    v.addEventListener("error", () => { if (!v._retried) { v._retried = true; v.load(); } });
  });
document.querySelectorAll("[data-hike-go]").forEach(b => b.addEventListener("click", () => {
  document.getElementById("hike-" + b.dataset.hikeGo).scrollIntoView({ behavior: "smooth", block: "start" });
}));

// ---------- Movie 1 (YouTube, only once an ID is set) ----------
// Long videos live on YouTube. Show a poster; load the player only on click.
document.querySelectorAll(".yt").forEach(el => {
  const id = el.dataset.youtube;
  const play = () => el.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="${el.dataset.title}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  if (el.dataset.loop) {  // a muted highlight plays by itself; the full movie is one click away
    el.innerHTML = `<video ${el.closest(".scrub") ? 'preload="none"' : `autoplay loop preload="metadata" src="${el.dataset.loop}"`} muted playsinline poster="${el.dataset.loopPoster}" aria-label="Highlight from ${el.dataset.title}"></video>
      <button class="full" ${id ? "" : "disabled"}><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>${id ? el.dataset.label : "Full movie on YouTube soon"}</button>`;
    if (id) el.querySelector(".full").addEventListener("click", play);
    const track = el.closest(".scrub");
    if (track) {  // scroll play: the scroll position through the tall track sets the video time
      // Only the method part of the clip is shown; each part gets its own title.
      const PARTS = [[0, "The robot sends a camera image and a question"], [6.5, "The VLM answers: what it sees, how risky each thing is"],
        [13.5, "Each label is found in the image"], [23, "The scores are painted in: a risk image"], [27.5, "And an image of where it prefers to walk"],
        [34, "Both go onto the 3D terrain map"], [47, "The robot walks where the map says go"]], END = 62;  // seconds; the clip is exactly the method part
      const v = el.querySelector("video"), pin = track.querySelector(".scrub-pin"), bar = track.querySelector(".scrub-bar");
      const tn = track.querySelector(".scrub-title .n"), tt = track.querySelector(".scrub-title .t");
      bar.innerHTML = PARTS.map((q, k) => `<span style="--w:${(PARTS[k + 1] ? PARTS[k + 1][0] : END) - q[0]}"><i></i></span>`).join("");
      const segs = [...bar.querySelectorAll("i")];
      let target = 0, raf = 0, cur = -1;
      const tick = () => { raf = 0; if (!v.isConnected) return;
        if (v.readyState && !v.seeking && Math.abs(v.currentTime - target) > .03) v.currentTime = target;
        if (!v.readyState || v.seeking || Math.abs(v.currentTime - target) > .03) raf = requestAnimationFrame(tick); };
      const onScroll = () => { const r = track.getBoundingClientRect(), span = r.height - pin.offsetHeight;
        const p = Math.min(1, Math.max(0, (parseFloat(getComputedStyle(pin).top) - r.top) / span));
        target = p * (END - .1);
        let k = PARTS.length - 1; while (k && PARTS[k][0] > target) k--;
        segs.forEach((sg, n) => { const a = PARTS[n][0], b = PARTS[n + 1] ? PARTS[n + 1][0] : END; sg.style.width = Math.min(1, Math.max(0, (target - a) / (b - a))) * 100 + "%"; });
        if (k !== cur) { cur = k; tn.textContent = `${k + 1} / ${PARTS.length}`; tt.textContent = PARTS[k][1]; }
        if (!raf) raf = requestAnimationFrame(tick); };
      addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", onScroll);
      v.addEventListener("loadedmetadata", onScroll); onScroll();
      // Phones do not buffer a paused video, so seeking shows nothing. Download the whole clip first
      // (it is small), then wake the decoder with a muted play/pause.
      const hint = track.querySelector(".scrub-hint"), ready = hint.textContent,
        file = innerWidth <= 760 && el.dataset.loopSmall || el.dataset.loop;  // phones get the 3 MB version
      new IntersectionObserver(async ([e], o) => { if (!e.isIntersecting) return; o.disconnect();
        try {
          const res = await fetch(file), total = +res.headers.get("Content-Length") || 0, rd = res.body.getReader(), chunks = [];
          for (let got = 0;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); got += value.length;
            hint.textContent = total ? `Loading ${Math.round(got / total * 100)}%` : "Loading…"; }
          v.src = URL.createObjectURL(new Blob(chunks, { type: "video/mp4" }));
        } catch (err) { v.src = file; }
        v.load(); try { await v.play(); v.pause(); } catch (err) {}
        hint.textContent = ready; onScroll();
      }, { rootMargin: "6000px 0px" }).observe(track);
    }
    return;
  }
  el.innerHTML = `<img class="yt-poster" src="${el.dataset.poster}" alt="" loading="lazy">
    <button class="ph" ${id ? "" : "disabled"} aria-label="${id ? "Play " + el.dataset.title : el.dataset.title + " (coming soon on YouTube)"}">
      <span><span class="play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>${id ? el.dataset.label : el.dataset.title + " · on YouTube soon"}</span></button>`;
  if (id) el.querySelector(".ph").addEventListener("click", play);
});

// ---------- Before/after sliders ----------
// Risk sliders at the top: sweep once when they come into view, so it is clear they move
document.querySelectorAll(".glance").forEach(g => {
  new IntersectionObserver(([e], o) => { if (!e.isIntersecting) return; o.disconnect();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now(), cs = [...g.children];
    (function step(t) { let live = false;
      cs.forEach((c, k) => { const u = Math.min(1, Math.max(0, (t - t0 - k * 90) / 1300)); if (u < 1) live = true;
        const x = 50 + 42 * Math.sin(u * Math.PI * 2) * (1 - u); c.style.setProperty("--x", x + "%"); c.querySelector("input").value = x; });
      if (live) requestAnimationFrame(step); })(t0);
  }, { threshold: .35 }).observe(g); });
document.querySelectorAll(".cmp input").forEach(r => r.addEventListener("input", () => r.parentElement.style.setProperty("--x", r.value + "%")));

// ---------- 01: the core idea on real frames (onboard camera + ROAM maps, logged VLM values) ----------
{
  const W = "static/img/why/";
  // resp: the VLM's own words where a response was logged (shortened), otherwise a plain description
  const SCENES = [
    { g: "Seealpsee", t: "Cows on the trail", cam: "core-lake-cows-cam", map: "core-lake-cows-risk", val: "risk",
      resp: "“There are people and animals (cows) present on or near the trail, which are considered high-risk obstacles that the robot should avoid.”",
      labels: [["gravel_path", .1], ["grass", .5], ["animals", 1], ["trees", 1]] },
    { t: "Alpine huts", cam: "core-huts-cam", map: "core-huts-risk", val: "risk",
      resp: "“There are buildings adjacent to the path […]. These are considered high-risk and unsteppable.”",
      labels: [["gravel_path", .1], ["rocky_ground", .3], ["grass", .5], ["buildings", 1]] },
    { g: "Zermatt", t: "Beside the railway", cam: "core-zermatt-rail-cam", map: "core-zermatt-rail-risk", val: "risk",
      resp: "“A gravel path alongside railroad tracks. It prioritizes the gravel path while avoiding the railroad tracks and dense vegetation.”",
      labels: [["gravel_path", .075], ["vegetation", .5], ["railroad_tracks", 1], ["trees", 1]] },
    { t: "Chalet and Matterhorn", cam: "core-zermatt-chalet-cam", map: "core-zermatt-chalet-risk", val: "risk",
      resp: "“The gravel path is a stable surface for the robot to navigate and should be considered the primary route.”",
      labels: [["gravel_path", 0], ["slope", .3], ["grass", .5], ["building", 1]] },
    { t: "Forest trail", cam: "core-zermatt-forest-cam", map: "core-zermatt-forest-risk", val: "risk",
      resp: "“There are shadows of people in the first image, indicating their presence. They are considered high-risk obstacles.”",
      labels: [["gravel_path", .2], ["dirt_path", .3], ["vegetation", .5], ["trees", 1]] }
  ];
  // coolwarm ends, as in the map overlays: blue = go, red = avoid
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const cw = v => { const c = v < .5 ? mix([59, 76, 192], [221, 221, 221], v * 2) : mix([221, 221, 221], [180, 4, 38], v * 2 - 2 + 1); return `background:rgb(${c});color:${Math.abs(v - .5) > .25 ? "#fff" : "#222"}`; };
  const core = document.getElementById("core"), chips = core.querySelector(".core-chips"), vis = core.querySelector(".core-vis");
  chips.innerHTML = SCENES.map((s, i) => `${s.g ? `<span class="grp">${s.g}</span>` : ""}<button role="tab" data-i="${i}" aria-selected="false">${s.t}</button>`).join("");
  let x = 35, raf = 0;
  function pick(i, sweep = true) {
    const s = SCENES[i];
    chips.querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", +b.dataset.i === i));
    vis.innerHTML = `<div class="cmp" style="--x:${x}%"><img src="${W}${s.map}.jpg" alt="${s.val} map for the scene: blue is go, red is avoid"><img class="top" src="${W}${s.cam}.jpg" alt="Robot front camera: ${s.t}"><span class="tagl">camera</span><span class="tagr">${s.val}</span><div class="bar"><div class="knob">&lsaquo;&rsaquo;</div></div><input type="range" min="0" max="100" value="${x}" aria-label="Slide between the camera image and the ${s.val} map"></div><div class="cw-legend">go <i></i> avoid</div>`;
    const cmp = vis.querySelector(".cmp"), rng = cmp.querySelector("input"), set = v => { x = v; rng.value = v; cmp.style.setProperty("--x", v + "%"); };
    rng.addEventListener("input", () => { cancelAnimationFrame(raf); set(+rng.value); });
    // sweep from the full camera image to the map, so both are seen once
    cancelAnimationFrame(raf);
    if (sweep && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t0 = performance.now(); set(100);
      const step = t => { const k = Math.min(1, Math.max(0, (t - t0 - 500) / 1100)), e = 1 - Math.pow(1 - k, 3); set(100 - 65 * e); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }
    core.querySelector(".core-resp").textContent = s.resp;
    core.querySelector(".core-labels").innerHTML = s.labels.map(([n, v]) => `<div class="l"><span>${n}</span><em>${s.val}</em><b style="${cw(s.val === "risk" ? v : 1 - v)}">${v.toFixed(1)}</b></div>`).join("");
  }
  chips.addEventListener("click", e => { const b = e.target.closest("button"); if (b) pick(+b.dataset.i); });
  pick(0, false);
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); pick(0); } }, { threshold: .5 }).observe(vis);
}

// ---------- Hero video: pause when off screen ----------
const hv = hero.querySelector("video");
new IntersectionObserver(([e]) => { if (e.isIntersecting) hv.play().catch(() => {}); else hv.pause(); }).observe(hero);

// ---------- Lab 1: Hönggerberg course (Fig. 4) ----------
const V = "static/video/exp/";
const METHODS = { roam: ["ROAM", "#ff6b5f"], geometry: ["Geometry-only", "#5b8def"], vint: ["ViNT", "#4fc3d9"] };
const TRAPS = [
  { id: "bushes", title: "Wrong path: bushes", desc: "The global path is offset into a flower bed.", runs: {
    roam: [1, "Stays on the road", "The global path points into the bushes. ROAM's map marks them as risky, so it keeps to the paved road."],
    geometry: [0, "Walks into the bushes", "It follows the global path into the flower bed and needs an intervention."],
    vint: [1, "Stays on the road", "ViNT steers by recorded goal images, not the offset global path, so this trap does not apply to it. At the same spot of its run it keeps to the asphalt."] } },
  { id: "grass", title: "Wrong path: grass", desc: "The global path cuts across a meadow.", runs: {
    roam: [1, "Stays on the gravel", "Grass is walkable but not preferred, so ROAM follows the gravel path instead of the shortcut."],
    geometry: [0, "Goes into the grass", "Grass is flat, so to a geometry map it looks as good as the path."],
    vint: [0, "Leaves the path", "ViNT steers by recorded goal images, not the offset global path. At the same spot of its run it leaves the gravel for the concrete slab and walks to the edge of the pit."] } },
  { id: "mannequin", title: "Person on the path", desc: "A mannequin lies across the road.", runs: {
    roam: [1, "Walks around it", "The VLM labels a person, which gets the highest risk, so the robot gives it room."],
    geometry: [0, "Walks over it", "A body lying flat is low enough to step over, so geometry alone sees no obstacle."],
    vint: [0, "Runs into it", "The learned navigation baseline circles around and makes contact with the mannequin."] } },
  { id: "signs", title: "Construction zone", desc: "“DANGER: road work ahead”, then “END road work”.", runs: {
    roam: [1, "Reads the signs and detours", "After the first sign, the path turns red in the risk map and the robot walks on the grass. At the end sign, it returns to the path."],
    geometry: [0, "Ignores the signs", "It stays on the closed path and walks through the barrier tape."],
    vint: [0, "Needs interventions", "It tangles in the barrier tape and wanders into tall grass, so an operator has to step in."] } }
];
const course = document.getElementById("course");
const trapList = course.querySelector(".traps"), methodBar = course.querySelector(".methods"),
      screens = course.querySelector(".screens"), verdict = course.querySelector(".verdict"), extra = course.querySelector(".extra");
let trap = 3, method = "roam", view = "one";  // open on the construction zone
trapList.innerHTML = TRAPS.map((t, i) => `<li><button role="tab" aria-selected="${i === 0}" data-i="${i}"><span class="n">0${i + 1}</span><b>${t.title}</b><span>${t.desc}</span></button></li>`).join("");
methodBar.innerHTML = Object.entries(METHODS).map(([k, [n, c]]) => `<button data-m="${k}" style="--c:${c}" aria-pressed="${k === "roam"}"><i></i>${n}</button>`).join("");
const dots = (n, cls) => `<span class="dots">${Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? cls : ""}"></i>`).join("")}</span>`;
function renderCourse() {
  const t = TRAPS[trap];

  trapList.querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", +b.dataset.i === trap));
  methodBar.querySelectorAll("button").forEach(b => {
    b.title = t.runs[b.dataset.m] ? "" : "Not tested on this trap";
    b.setAttribute("aria-pressed", view === "one" && b.dataset.m === method);
  });
  const shown = view === "one" ? [method] : Object.keys(METHODS);
  const NONE = "ViNT was only tested on the person and construction traps (Fig. 4B–C). Fig. 4A compares ROAM with geometry-only.";
  screens.className = "screens n" + shown.length;
  screens.innerHTML = shown.map(m => {
    const [name, c] = METHODS[m];
    if (!t.runs[m]) return `<div class="screen none" style="--c:${c}"><div><b>${name}</b>Not tested on this trap.</div></div>`;
    const [ok, head] = t.runs[m];
    return `<div class="screen" style="--c:${c}"><video src="${V}hg-${t.id}-${m}.mp4" poster="${V}poster/hg-${t.id}-${m}.jpg" muted loop playsinline autoplay controls preload="auto"></video>
      <div class="who"><i></i>${name}</div><div class="res ${ok ? "ok" : "bad"}"><span class="ic">${ok ? "✓" : "✕"}</span><span class="nm">${name}</span>${head}</div></div>`;
  }).join("");
  const [ok, head, body] = t.runs[method] || [null, "Not tested on this trap", NONE];
  verdict.innerHTML = ok === null ? `<span class="ic" style="background:var(--night);color:var(--snow-dim)">–</span><div><b>${head}</b><span>${body}</span></div>` : `<span class="ic" style="background:${ok ? "var(--glacier)" : "var(--red-soft)"};color:${ok ? "var(--night)" : "#fff"}">${ok ? "✓" : "✕"}</span><div><b>${head}</b><span>${body}</span></div>`;
  extra.innerHTML = t.id === "mannequin" ? `<div class="trials">
      <span class="h">10 trials each</span><span class="h">Reached the goal</span><span class="h">Collided</span>
      <b style="color:${METHODS.roam[1]}">ROAM</b><span class="dots-wrap">${dots(10, "y")}<span>10/10</span></span><span class="dots-wrap">${dots(0, "x")}<span>0/10</span></span>
      <b style="color:${METHODS.geometry[1]}">Geometry-only</b><span class="dots-wrap">${dots(10, "y")}<span>10/10</span></span><span class="dots-wrap">${dots(10, "x")}<span>10/10</span></span>
      <b style="color:${METHODS.vint[1]}">ViNT</b><span class="dots-wrap">${dots(6, "y")}<span>6/10</span></span><span class="dots-wrap"><span>–</span></span>
      <span class="trials-note">From fig. S4. With the mannequin in random postures, ROAM still reached the goal 10/10 times, with 3 slight hits on thin parts of the mannequin.</span></div>`
    : t.id === "signs" && method === "roam" && view === "one" ? `
      <p class="quote"><small>VLM, before the sign</small>“Gravel path: the primary <em>navigable surface</em> … Grass: considered <em>mid-risk</em> due to unevenness.”</p>
      <p class="quote"><small>VLM, after reading it</small>“Based on the warning sign, <em>the gravel path ahead is not safe</em> for navigation due to road work. The robot should consider the grassy areas as an alternative route.”</p>` : "";
  screens.querySelectorAll("video").forEach(v => { v.play().catch(() => {}); });
}
trapList.addEventListener("click", e => { const b = e.target.closest("button"); if (b) { trap = +b.dataset.i; renderCourse(); } });
methodBar.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return;
  method = b.dataset.m; view = "one"; course.querySelectorAll("[data-view]").forEach(x => x.setAttribute("aria-pressed", x.dataset.view === "one")); renderCourse(); });
course.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => {
  view = b.dataset.view; course.querySelectorAll("[data-view]").forEach(x => x.setAttribute("aria-pressed", x === b)); renderCourse();
}));

// ---------- Lab 2: same terrain, different sign (Fig. 5A) ----------
// Values copied from the VLM responses logged on the robot (and Fig. 5A for the cans).
const CANS = { id: "cans", title: "Exploding cans", sub: "warning sign on the wall", video: "cans-roam", plain: true,
    note: "Third-person view with the steppable map (top left) and elevation map (bottom left) burned in.",
    key: ["scattered_cans", "warning_sign"],
    labels: [["warning_sign", 1, 0, 0], ["scattered_cans", .7, 0, 0], ["dirt_ground", .3, 1, 0], ["person", 1, 0, 0], ["wall", 1, 0, 0]],
    take: "The sign turns harmless-looking cans into <b>no-step zones</b>. The robot places its feet between them." };
const CONDS = [
  { id: "pallet-no-sign", title: "No sign", sub: "pallets on grass", video: "pallet-no-sign",
    note: "Onboard front camera. The four views are the same moment, kept in sync.",
    key: ["wooden_path", "grass"],
    labels: [["wooden_path", 0, 1, 1], ["grass", .5, 1, .5], ["gravel", .3, 1, .3], ["asphalt", .2, 1, .7], ["concrete_cylinder", 1, 0, 0], ["people", 1, 0, 0], ["building_structure", 1, 0, 0]],
    take: "With no sign, the wooden path is the <b>safest, preferred</b> route and grass is mid-risk." },
  { id: "pallet-sign-on-pallet", title: "Sign on the pallets", sub: "“do not step here”", video: "pallet-sign-on-pallet",
    note: "Onboard front camera. The four views are the same moment, kept in sync.",
    key: ["wooden_boardwalk", "pallets", "grass"],
    labels: [["wooden_boardwalk", 1, 0, 0], ["pallets", 1, 0, 0], ["danger_sign", 1, 0, 0], ["grass", .1, 1, 1], ["upward_slope", .25, 1, .55], ["concrete_barrier", 1, 0, 0]],
    take: "One sign flips the scene: the pallets become <b>not steppable</b> and grass becomes the preferred ground." },
  { id: "pallet-signs-on-grass", title: "Signs on the grass", sub: "“danger: mines”", video: "pallet-signs-on-grass",
    note: "Onboard front camera. The four views are the same moment, kept in sync.",
    key: ["grass", "wooden_boardwalk", "mine_warning_sign"],
    labels: [["grass", 1, 0, 0], ["mine_warning_sign", 1, 0, 0], ["wooden_boardwalk", 0, 1, 1], ["gravel_ground", .28, 1, .5], ["paved_area", .05, 1, .9], ["concrete_barrier", 1, 0, 0], ["human_obstacle", 1, 0, 0]],
    take: "Now the grass is the danger: <b>risk 1.0, not steppable</b>. The boardwalk is the only way through." }
];
const pal = document.getElementById("pallets");
const condBar = pal.querySelector(".conds"), mos = pal.querySelector(".mosaic"), mv2 = mos.querySelector("video"),
      layerBar = pal.querySelector(".layers"), qLbl = pal.querySelector(".q-lbl"), rows = pal.querySelector(".vp-rows");
const LAYER_NAMES = { cam: "", risk: "risk", step: "steppable", pref: "preferred area", all: "" };
let cond = 1, layer = "all";
condBar.innerHTML = CONDS.map((c, i) => `<button role="tab" data-i="${i}" aria-selected="false"><img src="${V}poster/${c.video}.jpg" alt=""><span><b>${c.title}</b><span>${c.sub}</span></span></button>`).join("");
function renderPal(reload) {
  const c = CONDS[cond];
  condBar.querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", +b.dataset.i === cond));
  mos.classList.toggle("plain", !!c.plain);
  layerBar.classList.toggle("off", !!c.plain); pal.querySelector(".scale").classList.toggle("off", !!c.plain || layer === "cam");
  mos.dataset.layer = c.plain ? "cam" : layer;
  layerBar.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.layer === layer));
  qLbl.textContent = c.plain ? "" : LAYER_NAMES[layer];
  if (reload) { mv2.poster = `${V}poster/${c.video}.jpg`; mv2.src = `${V}${c.video}.mp4`; mv2.play().catch(() => {}); }
  pal.querySelector(".cond-note").textContent = c.note;
  rows.innerHTML = c.labels.map(([l, r, s, p]) => `<div class="vp-row ${c.key.includes(l) ? "key" : ""}"><span class="l" title="${l}">${l}</span>
    <span class="v"><i style="width:${Math.max(r, .04) * 100}%;background:${ramp(r)}"></i><b>${r}</b></span>
    <span class="v"><i style="width:${Math.max(s, .04) * 100}%;background:${ramp(s, true)}"></i><b>${s}</b></span>
    <span class="v"><i style="width:${Math.max(p, .04) * 100}%;background:${ramp(p, true)}"></i><b>${p}</b></span></div>`).join("");
  pal.querySelector(".vp-take").innerHTML = c.take;
}
document.querySelector("#cans .cans-rows").innerHTML = CANS.labels.map(([l, r, s, p]) => `<div class="vp-row ${CANS.key.includes(l) ? "key" : ""}"><span class="l" title="${l}">${l}</span>
    <span class="v"><i style="width:${Math.max(r, .04) * 100}%;background:${ramp(r)}"></i><b>${r}</b></span>
    <span class="v"><i style="width:${Math.max(s, .04) * 100}%;background:${ramp(s, true)}"></i><b>${s}</b></span>
    <span class="v"><i style="width:${Math.max(p, .04) * 100}%;background:${ramp(p, true)}"></i><b>${p}</b></span></div>`).join("");
condBar.addEventListener("click", e => { const b = e.target.closest("button"); if (b) { cond = +b.dataset.i; renderPal(true); } });
layerBar.addEventListener("click", e => { const b = e.target.closest("button"); if (b) { layer = b.dataset.layer; renderPal(false); } });

// Load lab videos only when the labs come into view; pause them when they leave
let labsReady = false;
new IntersectionObserver(es => es.forEach(e => {
  const vids = e.target.querySelectorAll("video");
  if (e.isIntersecting) {
    if (!labsReady) { labsReady = true; renderCourse(); renderPal(true); }
    vids.forEach(v => v.play().catch(() => {}));
  } else vids.forEach(v => v.pause());
}), { threshold: .15 }).observe(course);
new IntersectionObserver(es => es.forEach(e => {
  if (!labsReady) { labsReady = true; renderCourse(); renderPal(true); }
  e.target.querySelectorAll("video").forEach(v => e.isIntersecting ? v.play().catch(() => {}) : v.pause());
}), { threshold: .15 }).observe(pal);

// ---------- 02: think / ground / walk, one Zermatt frame through the pipeline ----------
{
  const H = "static/img/how/";
  const LABELS = [["gravel_path", .2, 1, 1], ["trail", .1, 1, 1], ["grass", .4, 1, 0], ["slope", .3, 1, 0], ["rocks", .5, 1, 0],
    ["dense_vegetation", .5, 1, 0], ["snow_patches", .7, 1, 0], ["people", 1, 0, 0], ["fence", 1, 0, 0], ["cable_car_pylon", 1, 0, 0]];
  const cell = (v, inv) => `<td><i style="background:${coolwarm(inv ? 1 - v : v)}"></i>${v.toFixed(1)}</td>`;
  const slider = (layer, alt) => `<div class="cmp" style="--x:50%"><img src="${H}${layer}.jpg" alt="${alt}"><img class="top" src="${H}cam.jpg" alt="The robot's front camera">
    <span class="tagl">camera</span><span class="tagr">${layer === "pref" ? "preferred" : layer === "step" ? "steppable" : "risk"}</span>
    <div class="bar"><div class="knob">&lsaquo;&rsaquo;</div></div><input type="range" min="0" max="100" value="50" aria-label="Slide between the camera image and the map"></div>`;
  const STAGES = [
    { t: "Cameras", hz: "onboard", p: "0.5s", k: "01 · sense", h: "The robot looks ahead",
      txt: "ANYmal carries wide-angle RGB cameras, depth cameras and a LiDAR. This is one frame from the <b>front camera</b> on the way down from the Matterhorn.",
      vis: () => `<img src="${H}cam.jpg" alt="Front camera: gravel path heading toward the Matterhorn, grass on both sides"><div class="row2"><div><p class="lbl">the robot and its sensors</p><img src="${H}hardware.jpg" alt="ANYmal with labelled 4G modem, GNSS antenna, LiDAR, wide-angle, HDR and depth cameras"></div><div><p class="lbl">the same moment, from outside</p><img src="${H}scene.jpg" alt="Third-person view of the robot on the trail with the risk map drawn on the ground"></div></div>` },
    { t: "VLM analysis", hz: "0.1 Hz", p: "10s", slow: true, k: "02 · think (slow)", h: "The VLM reads the scene",
      txt: "Every ten seconds or so, the VLM gets the camera images, a short description of the robot and its own notes from the last few answers. It names everything it sees and gives each label a <b>risk</b>, whether it is <b>steppable</b>, and whether it is a <b>preferred</b> place to walk. It never outputs coordinates or speeds.",
      vis: () => `<div class="fx-chat"><div class="q"><small>prompt (shortened)</small>I give you an image taken by an onboard camera of a robot. Please analyze the image and identify potential hazards and safe paths. […] Assign a risk, steppable and preferred value to each label.</div>
        <div class="a"><small>answer, as logged on the robot</small>The robot is navigating a mountainous terrain with a clear gravel path […]. The robot should continue to follow the gravel path, which is the preferred area for navigation, and avoid people.</div></div>
        <table class="fx-tbl"><tr><th>label</th><th>risk</th><th>steppable</th><th>preferred</th></tr>${LABELS.map(([l, r, st, pr]) => `<tr><td>${l}</td>${cell(r)}${cell(st, true)}${cell(pr, true)}</tr>`).join("")}</table>` },
    { t: "Segmentation", hz: "6 Hz", p: ".17s", k: "03 · paint (fast)", h: "Labels become dense maps",
      txt: "An open-vocabulary segmentation model finds each label in every new camera frame, much faster than the VLM runs. Fusing the per-label heatmaps with the VLM's values gives three images: <b>risk</b>, <b>steppable</b> and <b>preferred</b>. Drag the line to compare one with the camera. Blue means go, red means avoid.",
      vis: () => `<div class="fx-heat"><figure><img src="${H}heat-gravel.jpg" alt="Heatmap for the label gravel_path"><figcaption>heatmap: gravel_path (bright = found here)</figcaption></figure><figure><img src="${H}heat-grass.jpg" alt="Heatmap for the label grass"><figcaption>heatmap: grass</figcaption></figure></div>
        <div class="fx-layers" role="group" aria-label="Fused map"><button data-l="risk" aria-pressed="true">Risk</button><button data-l="step" aria-pressed="false">Steppable</button><button data-l="pref" aria-pressed="false">Preferred</button></div>
        <div class="fx-slot">${slider("risk", "Risk image")}</div><div class="cw-legend">go <i></i> avoid</div>` },
    { t: "Elevation map", hz: "20 Hz", p: ".05s", k: "04 · map", h: "Projected onto the terrain",
      txt: "The three images are projected onto the robot's <b>elevation map</b>, built from LiDAR and depth cameras. The locomotion policy reads the steppable layer. The navigation policy reads risk and preferred: unpreferred ground is lifted as a <b>virtual height</b>, so the path looks like a valley to walk along.",
      vis: () => `<img src="${H}elev-pref.jpg" alt="3D elevation map with the robot on it: the gravel path is low and blue, the grass on both sides rises as red spikes"><div class="row2"><div><p class="lbl">for locomotion: steppable</p><img src="${H}elev-loco-fig.jpg" alt="Steppable layer on the elevation map"></div><div><p class="lbl">for navigation: risk</p><img src="${H}elev-risk-fig.jpg" alt="Risk layer on the elevation map"><p class="lbl" style="margin-top:8px">for navigation: preferred</p><img src="${H}elev-pref-fig.jpg" alt="Preferred layer on the elevation map"></div></div>` },
    { t: "Navigation policy", hz: "10 Hz", p: ".1s", k: "05 · steer", h: "An RL policy picks the way",
      txt: "Trained in simulation to reach goals over terrain with <b>randomly generated risk scans</b>, so it never needs photo-real scenes. On the robot it reads the real risk layer and sends a velocity command toward the next waypoint of the global path.",
      vis: () => `<div class="row2"><div><p class="lbl">training in simulation (Isaac)</p><video src="static/video/exp/nav-training-montage.mp4" poster="static/video/exp/poster/nav-training-montage.jpg" muted loop playsinline autoplay preload="metadata" aria-label="Simulation: the robot walks over random blocks and stairs with a grid of risk samples around it, blue safe and red risky"></video></div><div><p class="lbl">on the robot</p><img src="${H}nav-deploy.jpg" alt="Deployment: samples from the risk layer around the robot, raised where it is unpreferred"></div></div>` },
    { t: "Locomotion policy", hz: "50 Hz", p: ".02s", k: "06 · walk", h: "Another RL policy moves the legs",
      txt: "Follows the velocity command and chooses footholds. It was trained on <b>random steppable scans</b> in simulation and, on the robot, reads the steppable layer, so it keeps its feet off ground the VLM called unsafe. It sends joint commands 50 times a second, while the VLM is still thinking about the next frame.",
      vis: () => `<div class="row2"><div><p class="lbl">training in simulation (RaiSim)</p><video src="static/video/exp/loco-training.mp4" poster="static/video/exp/poster/loco-training.jpg" muted loop playsinline autoplay preload="metadata" aria-label="Simulation: the robot learns to keep its feet off red non-steppable samples on rough terrain"></video></div><div><p class="lbl">on the robot: exploding cans</p><video src="static/video/exp/cans-roam.mp4" poster="static/video/exp/poster/cans-roam.jpg" muted loop playsinline autoplay preload="metadata" aria-label="The real robot steps between cans marked unsteppable after reading a warning sign"></video></div></div>` }
  ];
  const fx = document.getElementById("fx"), flow = fx.querySelector(".mx-cols"), vis = fx.querySelector(".fx-vis");
  const th = f => `<span class="mx-th"><img src="${H}${f}.jpg" alt=""></span>`;
  const THUMBS = [th("cam"), `<span class="mx-th tbl">${[["gravel_path", .2], ["grass", .4], ["rocks", .5], ["people", 1]].map(([l, v]) => `<span>${l}<i style="background:${coolwarm(v)}"></i></span>`).join("")}</span>`,
    `<span class="mx-th duo">${["heat-gravel", "risk"].map(f => `<img src="${H}${f}.jpg" alt="">`).join("")}</span>`, th("elev-pref"), th("nav-deploy"), th("loco-deploy")];
  const ONE = ["One frame from the front camera.", "Names what is in view and scores it.", "Finds each label as a heatmap, then paints in its risk.", "Puts the scores on the 3D terrain.", "Steers toward the goal, around risk.", "Places each foot on steppable ground."];
  const COLS = [["think", "Think", "0.1 Hz · one answer every 10 s", "A vision-language model says <b>what</b> is in view and how risky it is."],
    ["ground", "Ground", "6 to 20 Hz", "Segmentation and mapping turn those words into <b>where</b>, on the terrain."],
    ["walk", "Walk", "10 to 50 Hz", "Two RL policies trained in simulation read the map and <b>move</b>."]];
  const card = i => `<button class="mx-card" role="tab" data-i="${i}" aria-selected="false">${THUMBS[i]}<span><span class="t">${STAGES[i].t}</span><span class="o">${ONE[i]}</span><span class="hz">${STAGES[i].hz}</span></span></button>`;
  flow.innerHTML = COLS.map(([c, t, hz, d], k) => `<div class="mx-col ${c}"><div class="mx-head"><b>${t}</b><span>${hz}</span><p>${d}</p></div>${card(2 * k)}${card(2 * k + 1)}</div>`).join("");
  const SHORT = ["Camera", "VLM", "Segment", "Map", "Navigate", "Walk"], pipe = fx.querySelector(".pipe");
  pipe.innerHTML = COLS.map(([c, t, hz]) => `<div class="g ${c}">${t}<small>${hz.split(" · ")[0]}</small></div>`).join("") +
    STAGES.map((s, i) => `<button class="${COLS[i >> 1][0]}" data-i="${i}" aria-selected="false" aria-label="${s.t}">${THUMBS[i]}<b>${SHORT[i]}</b><small>${s.hz}</small></button>`).join("");
  pipe.insertAdjacentHTML("afterend", `<p class="pipe-cap">Tap a step to see it on a real frame.</p>`);
  let cur = -1;
  const bindCmp = root => root.querySelectorAll(".cmp input").forEach(r => r.addEventListener("input", () => r.parentElement.style.setProperty("--x", r.value + "%")));
  function show(i) {
    cur = (i + STAGES.length) % STAGES.length; const st = STAGES[cur];
    fx.querySelectorAll(".mx-cols button, .pipe button").forEach(b => b.setAttribute("aria-selected", +b.dataset.i === cur));
    fx.querySelector(".fx-k").textContent = st.k; fx.querySelector(".fx-txt h3").textContent = st.h; fx.querySelector(".fx-txt p").innerHTML = st.txt;
    fx.querySelector(".fx-next").innerHTML = cur === STAGES.length - 1 ? "Back to the start &#8635;" : "Next stage &rarr;";
    vis.innerHTML = st.vis(); bindCmp(vis);
    vis.querySelectorAll(".fx-layers button").forEach(b => b.addEventListener("click", () => {
      vis.querySelectorAll(".fx-layers button").forEach(x => x.setAttribute("aria-pressed", x === b));
      const x = vis.querySelector(".cmp").style.getPropertyValue("--x") || "50%";
      vis.querySelector(".fx-slot").innerHTML = slider(b.dataset.l, b.textContent + " image");
      const c = vis.querySelector(".cmp"); c.style.setProperty("--x", x); c.querySelector("input").value = parseFloat(x); bindCmp(vis);
    }));
  }
  // Auto tour: while the figure is on screen, step through the stages until the reader takes over
  const DWELL = 7000, tourBtn = fx.querySelector(".fx-tour");
  let tour = !matchMedia("(prefers-reduced-motion: reduce)").matches, onScreen = false, tourT = 0;
  fx.style.setProperty("--dwell", DWELL + "ms");
  function arm() {
    clearTimeout(tourT); fx.classList.toggle("touring", tour && onScreen);
    tourBtn.setAttribute("aria-pressed", tour); tourBtn.innerHTML = tour ? "&#10073;&#10073; Pause tour" : "&#9654; Play tour";
    if (tour && onScreen) tourT = setTimeout(() => { show(cur + 1); arm(); }, DWELL);
  }
  const takeOver = () => { if (tour) { tour = false; arm(); } };
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; arm(); }, { rootMargin: "-30% 0px -30% 0px" }).observe(fx);   // on screen = crossing the middle of the viewport (the figure is taller than a phone screen)
  tourBtn.addEventListener("click", () => { tour = !tour; if (tour) show(cur + 1); arm(); });
  fx.querySelector(".fx-panel").addEventListener("pointerdown", e => { if (!e.target.closest(".fx-tour")) takeOver(); });
  const onPick = e => { const b = e.target.closest("button"); if (!b) return; takeOver(); show(+b.dataset.i);
    // On a phone the detail panel sits below all six cards, so bring it into view.
    if (matchMedia("(max-width: 760px)").matches) fx.querySelector(".fx-panel").scrollIntoView({ behavior: "smooth", block: "start" }); };
  flow.addEventListener("click", onPick); pipe.addEventListener("click", onPick);
  fx.querySelector(".fx-next").addEventListener("click", () => show(cur + 1));
  fx.querySelector(".fx-prev").addEventListener("click", () => show(cur - 1));
  show(0); arm();
}

// Shared: VLM label rows (label, risk, steppable, preferred)
const labelRows = (labels, key) => labels.map(([l, r, s, p]) => `<div class="vp-row ${key.includes(l) ? "key" : ""}"><span class="l" title="${l}">${l}</span>
    <span class="v"><i style="width:${Math.max(r, .04) * 100}%;background:${ramp(r)}"></i><b>${r}</b></span>
    <span class="v"><i style="width:${Math.max(s, .04) * 100}%;background:${ramp(s, true)}"></i><b>${s}</b></span>
    <span class="v"><i style="width:${Math.max(p, .04) * 100}%;background:${ramp(p, true)}"></i><b>${p}</b></span></div>`).join("");

// ---------- Lab 3: local navigation (Fig. 5B) ----------
// Labels from the VLM responses logged on the robot during these runs.
const ROUTES = [
  { id: "route", title: "Mixed route", sub: "paved road, gravel, grass", thumb: "nav-route-roam",
    views: [["compare", "ROAM vs geometry"], ["roam", "ROAM"], ["geometry", "Geometry-only"]],
    note: "Third-person view, sped up 8×. Same start and goal for both runs.",
    key: ["gravel_path", "grassy_area"],
    labels: [["gravel_path", 0, 1, 1], ["grassy_area", .5, 1, 0], ["slope", .3, 1, 0], ["wooden_fence", 1, 0, 0], ["tree", 1, 0, 0], ["person", 1, 0, 0]],
    take: "Paths are <b>preferred</b>, grass is walkable but not preferred. So ROAM follows the road, while geometry-only cuts straight across the lawn and squeezes past buildings." },
  { id: "rail", title: "Next to a railroad", sub: "gravel beside the tracks", thumb: "nav-rail-roam",
    views: [["all", "All four"], ["cam", "Camera"], ["risk", "Risk"], ["step", "Steppable"], ["pref", "Preferred"]],
    mosaic: "nav-rail-roam", range: [9.5, 46.2], note: "ROAM's onboard front camera, sped up 2×.", labels: [], key: [],
    take: "The tracks light up red in the risk map, so ROAM walks the gravel beside them. In the same spot, the geometry-only planner <b>got stuck on the tracks</b> (Fig. 5B)." },
  { id: "snow", title: "Snowy passage", sub: "cleared strip vs snow", thumb: "nav-snow-third",
    views: [["all", "All four"], ["outside", "Outside"], ["cam", "Camera"], ["risk", "Risk"], ["step", "Steppable"], ["pref", "Preferred"]],
    mosaic: "nav-snow-roam", range: [0, 13.2], outside: "nav-snow-third", note: "ROAM's onboard camera walking up the passage to the top, and the same walk from outside.",
    key: ["cleared_path", "snow_covered_ground"],
    labels: [["cleared_path", .2, 1, 1], ["snow_covered_ground", .3, 1, 0], ["wet_ground", .4, 1, 0], ["metal_barrier", 1, 0, 0], ["concrete_wall", 1, 0, 0], ["metal_railing", 1, 0, 0]],
    take: "Snow is walkable, but the <b>cleared strip is preferred</b>. ROAM keeps to it, as a person would." }
];
const navLab = document.getElementById("routes");
const navTabs = navLab.querySelector(".nav-tabs"), navLayers = navLab.querySelector(".nav-layers"), navStage = navLab.querySelector(".nav-stage");
let route = 0, navView = "compare";
navTabs.innerHTML = ROUTES.map((r, i) => `<button role="tab" data-i="${i}" aria-selected="false"><img src="${V}poster/${r.thumb}.jpg" alt=""><span><b>${r.title}</b><span>${r.sub}</span></span></button>`).join("");
function renderNav(reload) {
  const r = ROUTES[route];
  if (!r.views.some(v => v[0] === navView)) navView = r.views[0][0];
  navTabs.querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", +b.dataset.i === route));
  navLayers.innerHTML = r.views.map(([k, n]) => `<button data-v="${k}" aria-pressed="${k === navView}">${n}</button>`).join("");
  const isMosaic = ["cam", "risk", "step", "pref", "all"].includes(navView);
  navLab.querySelector(".nav-scale").classList.toggle("off", !isMosaic || navView === "cam");
  if (r.id === "route") {
    const shown = navView === "compare" ? ["roam", "geometry"] : [navView];
    navStage.innerHTML = `<div class="duo-v" style="${shown.length === 1 ? "grid-template-columns:1fr" : ""}">${shown.map(m => {
      const [name, c] = METHODS[m];
      return `<div class="screen" style="--c:${c}"><video src="${V}nav-route-${m}.mp4" poster="${V}poster/nav-route-${m}.jpg" muted loop playsinline autoplay controls preload="auto"></video>
        <div class="who"><i></i>${name}</div><div class="res ${m === "roam" ? "ok" : "bad"}"><span class="ic">${m === "roam" ? "✓" : "✕"}</span>${m === "roam" ? "Stays on the road" : "Cuts across the grass"}</div></div>`; }).join("")}</div>
      ${shown.length > 1 ? '<button class="play-both">Restart both together</button>' : ""}`;
    const pb = navStage.querySelector(".play-both");
    if (pb) pb.onclick = () => navStage.querySelectorAll("video").forEach(v => { v.currentTime = 0; v.play().catch(() => {}); });
  } else if (navView === "outside") {
    navStage.innerHTML = `<div class="outside"><video src="${V}${r.outside}.mp4" poster="${V}poster/${r.outside}.jpg" muted loop playsinline autoplay controls preload="auto"></video></div>`;
  } else {
    let m = navStage.querySelector(".mosaic");
    if (!m || reload || m.dataset.src !== r.mosaic) {
      navStage.innerHTML = `<div class="mosaic" data-src="${r.mosaic}"><video src="${V}${r.mosaic}.mp4#t=${r.range[0]}" poster="${V}poster/${r.mosaic}.jpg" muted loop playsinline autoplay preload="auto"></video><div class="q-lbl"></div><div class="quad"><span>camera</span><span>risk</span><span>steppable</span><span>preferred</span></div></div>`;
      m = navStage.querySelector(".mosaic");
      // Play only the part in r.range: skip the wait at the start, stop before the clip moves on
      const mv = m.querySelector("video"), [t0, t1] = r.range;
      mv.addEventListener("loadedmetadata", () => { mv.currentTime = t0; }, { once: true });
      mv.addEventListener("timeupdate", () => { if (mv.currentTime >= t1 || mv.currentTime < t0 - .3) mv.currentTime = t0; });
    }
    m.dataset.layer = navView; m.querySelector(".q-lbl").textContent = LAYER_NAMES[navView];
  }
  // If the browser refuses autoplay (e.g. low-power mode on a phone), give the video controls so a tap starts it
  navStage.querySelectorAll("video").forEach(v => v.play().catch(() => { v.controls = true; }));
  navLab.querySelector(".nav-note").textContent = r.note;
  navLab.querySelector(".nav-map").classList.toggle("off", r.id !== "route");
  navLab.querySelector(".nav-legend").classList.toggle("off", !r.labels.length);
  navLab.querySelector(".nav-rows").innerHTML = labelRows(r.labels, r.key);
  navLab.querySelector(".nav-take").innerHTML = (r.labels.length ? "" : "<span style='font-size:12.5px'>No VLM responses were logged for this run.</span><br>") + r.take;
}
navTabs.addEventListener("click", e => { const b = e.target.closest("button"); if (b) { route = +b.dataset.i; renderNav(true); } });
navLayers.addEventListener("click", e => { const b = e.target.closest("button"); if (b) { navView = b.dataset.v; renderNav(false); } });
let navReady = false;
new IntersectionObserver(([e]) => {
  if (e.isIntersecting && !navReady) { navReady = true; renderNav(true); }
  navLab.querySelectorAll("video").forEach(v => e.isIntersecting ? v.play().catch(() => {}) : v.pause());
}, { threshold: .15 }).observe(navLab);

// ---------- Lab 4: exploration stepper (Fig. 5C) ----------
const STEPS = [
  ["a", "Blocked", "A cart and barrier tape block the gravel path that the global plan follows."],
  ["b", "Alternative route", "Instead of stopping, ROAM takes another path that runs alongside."],
  ["c", "Shortcut", "It cuts through a short stretch of grass toward the original route."],
  ["d", "Back on track", "It rejoins the global path beyond the obstacle and carries on."]
];
// Times (s) in the 4x clip where each step starts, from the third-person camera C0333
const EX_T = [2.5, 9, 33.5, 42.5];
const ex = document.getElementById("explorer"), exSteps = ex.querySelector(".ex-steps"), exVid = ex.querySelector(".ex-video"), exText = ex.querySelector(".ex-text");
let step = -1;
exSteps.innerHTML = STEPS.map(([k, t], i) => `<button role="tab" data-i="${i}" aria-selected="${i === 0}"><b>${k}</b>${t}<span class="bar"></span></button>`).join("");
function showStep(i) {
  if (i === step) return; step = i;
  exSteps.querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", +b.dataset.i === step));
  exText.innerHTML = `<b>${STEPS[step][0]}. ${STEPS[step][1]}.</b> ${STEPS[step][2]}`;
}
exVid.addEventListener("timeupdate", () => {
  const t = exVid.currentTime; let k = 0; while (k < EX_T.length - 1 && t >= EX_T[k + 1]) k++; showStep(k);
  exSteps.querySelectorAll(".bar").forEach((bar, i) => { const a = EX_T[i], b = EX_T[i + 1] ?? exVid.duration; bar.style.width = (i < k ? 100 : i > k ? 0 : Math.min(100, (t - a) / (b - a) * 100)) + "%"; });
});
exSteps.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; const i = +b.dataset.i; showStep(i); exVid.currentTime = EX_T[i]; exVid.play().catch(() => {}); });
new IntersectionObserver(([e]) => { if (e.isIntersecting) { if (exVid.preload === "none") exVid.preload = "auto"; exVid.play().catch(() => {}); } else exVid.pause(); }, { threshold: .4 }).observe(ex);
showStep(0);

// ---------- Copy BibTeX ----------
document.getElementById("copy").addEventListener("click", async e => {
  try { await navigator.clipboard.writeText(document.getElementById("bib").textContent); e.target.textContent = "Copied"; }
  catch { e.target.textContent = "Select and copy"; }
  setTimeout(() => e.target.textContent = "Copy", 1800);
});
