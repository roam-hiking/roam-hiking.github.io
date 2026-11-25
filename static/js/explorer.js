// index.html (Alpine hikes): the two route explorers (MapLibre 3D map, elevation profile, synced videos).
// ---------- Hike media: route explorer / flyover / photos ----------
function syncHikeMedia() {
  document.querySelectorAll(".hike").forEach(h => {
    const on = h._near;  // both hikes show; each loads its map only when it comes near the screen
    const panel = [...h.querySelectorAll("[data-hv-panel]")].find(p => !p.hidden);
    const v = h.querySelector(".flyover video");
    if (v) (on && panel === v.parentElement && hikesVisible) ? v.play().catch(() => {}) : v.pause();
    const ex = h.querySelector(".explorer");
    if (on && panel === ex && hikesVisible) initExplorer(ex);
    if (ex && ex._map) setTimeout(() => ex._map.resize(), 50);
  });
}
document.querySelectorAll(".hike-media").forEach(m => m.querySelectorAll("[data-hv]").forEach(b => b.addEventListener("click", () => {
  m.querySelectorAll("[data-hv]").forEach(x => x.setAttribute("aria-pressed", x === b));
  m.querySelectorAll("[data-hv-panel]").forEach(p => p.hidden = p.dataset.hvPanel !== b.dataset.hv);
  syncHikeMedia();
})));
const hikesVisible = true;
document.querySelectorAll(".hike").forEach(h => new IntersectionObserver(([e]) => { h._near = e.isIntersecting; syncHikeMedia(); }, { rootMargin: "300px 0px" }).observe(h));

// Route explorer: robot's GNSS track on swisstopo imagery + linked elevation profile
async function initExplorer(el) {
  if (el._init || typeof maplibregl === "undefined") return; el._init = true;
  const data = await (await fetch(el.dataset.route)).json();
  const P = data.points, ll = P.map(p => [p[0], p[1]]), total = P[P.length - 1][3], N = P.length;
  // Gradient (%) per point over a ~60 m window, for steepness colouring and section stats
  const grade = P.map((p, i) => { let a = i, b = i; while (a > 0 && p[3] - P[a][3] < 30) a--; while (b < N - 1 && P[b][3] - p[3] < 30) b++;
    const dd = P[b][3] - P[a][3]; return dd > 0 ? (P[b][2] - P[a][2]) / dd * 100 : 0; });
  const gradeColor = g => coolwarm(Math.min(Math.abs(g), 40) / 40);

  // 3D map: satellite imagery draped over terrain, tilted like Google Earth
  const tiles = (url, attribution, maxzoom = 19) => ({ type: "raster", tiles: [url], tileSize: 256, maxzoom, attribution });
  const wmts = (layer, fmt) => `https://wmts.geo.admin.ch/1.0.0/${layer}/default/current/3857/{z}/{x}/{y}.${fmt}`;
  const lineFC = pts => ({ type: "Feature", geometry: { type: "LineString", coordinates: pts.map(q => [q[1], q[0]]) } });
  const map = new maplibregl.Map({
    container: el.querySelector(".rx-map"), attributionControl: { compact: true }, cooperativeGestures: true, maxPitch: 75,
    ...(window.I18N_MAPLIBRE ? { locale: I18N_MAPLIBRE } : {}),   // map control tooltips and hints on /ja/
    style: { version: 8, sources: {
        sat: tiles("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", "Imagery © Esri, Maxar, Earthstar Geographics"),
        swiss: tiles(wmts("ch.swisstopo.swissimage", "jpeg"), "© swisstopo", 20),
        topo: tiles(wmts("ch.swisstopo.pixelkarte-farbe", "jpeg"), "© swisstopo", 18),
        dem: { type: "raster-dem", tiles: ["https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 15, encoding: "terrarium", attribution: "Terrain: Mapzen / AWS Terrain Tiles" } },
      layers: [{ id: "base", type: "raster", source: "sat" }],
      terrain: { source: "dem", exaggeration: 1.25 }, // keep in sync with EXAG
      sky: { "sky-color": "#9cc7ec", "horizon-color": "#e8eef2", "fog-color": "#dfe7ec", "sky-horizon-blend": .6, "horizon-fog-blend": .6, "fog-ground-blend": .85 } }
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
  el._map = map;
  new ResizeObserver(() => map.resize()).observe(map.getContainer());   // the map stretches with the column beside it
  await new Promise(r => map.once("load", r));
  el.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");   // credits collapsed behind the (i) button
  // Base imagery switch
  const baseBar = document.createElement("div"); baseBar.className = "rx-base";
  baseBar.innerHTML = [["sat", "Satellite"], ["swiss", "Swiss aerial"], ["topo", "Topo map"]].map(([k, n], i) => `<button data-base="${k}" aria-pressed="${!i}">${T(n)}</button>`).join("") + `<button data-tilt aria-pressed="true">3D</button><button data-follow aria-pressed="true" title="${T("Keep the camera on the robot while the video plays")}">${T("Follow")}</button>`;
  el.querySelector(".rx-map").append(baseBar);
  baseBar.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-follow")) { setFollow(b.getAttribute("aria-pressed") !== "true"); return; }
    if (b.hasAttribute("data-tilt")) { const on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", on); map.setTerrain(on ? { source: "dem", exaggeration: EXAG } : null); overview(800); return; }
    baseBar.querySelectorAll("[data-base]").forEach(x => x.setAttribute("aria-pressed", x === b));
    // Swap the one imagery layer's source (hiding raster layers under 3D terrain trips a MapLibre bug)
    map.removeLayer("base"); map.addLayer({ id: "base", type: "raster", source: b.dataset.base }, "route-casing");
  });

  map.addSource("route", { type: "geojson", data: lineFC(ll) });
  map.addSource("done", { type: "geojson", data: lineFC(ll.slice(0, 1)) });
  map.addSource("sel", { type: "geojson", data: lineFC([]) });
  map.addSource("steep", { type: "geojson", data: { type: "FeatureCollection", features: ll.slice(1).map((q, i) => ({ ...lineFC([ll[i], q]), properties: { c: gradeColor(grade[i]) } })) } });
  const lw = w => ["interpolate", ["linear"], ["zoom"], 11, w * .8, 16, w * 1.6];
  // White trail on a soft ink shadow; the walked part in ANYmal red (the page accent)
  map.addLayer({ id: "route-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#0f1e26", "line-width": lw(8), "line-opacity": .45, "line-blur": 2 } });
  map.addLayer({ id: "route-base", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": lw(3.5) } });
  map.addLayer({ id: "route-steep", type: "line", source: "steep", layout: { "line-cap": "round", visibility: "none" }, paint: { "line-color": ["get", "c"], "line-width": lw(4) } });
  map.addLayer({ id: "route-done", type: "line", source: "done", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#d9332b", "line-width": lw(4.5) } });
  map.addLayer({ id: "route-sel", type: "line", source: "sel", layout: { "line-cap": "round" }, paint: { "line-color": "#7fd1c7", "line-width": lw(12), "line-opacity": .5 } });
  map.addLayer({ id: "route-hit", type: "line", source: "route", paint: { "line-color": "#000", "line-width": 22, "line-opacity": 0 } });
  const domMarker = (html, lat, lon, opts = {}) => { const d = document.createElement("div"); d.innerHTML = html; return new maplibregl.Marker({ element: d.firstElementChild, ...opts }).setLngLat([lon, lat]).addTo(map); };
  domMarker(`<span class="rx-end">${T("Start")}</span>`, ...ll[0], { anchor: "bottom", offset: [0, -10] });
  domMarker(`<span class="rx-end">${T("Finish")}</span>`, ...ll[N - 1], { anchor: "bottom", offset: [0, -10] });
  const pin = domMarker('<div class="rx-pin"></div>', ...ll[0]);
  const pinEl = pin.getElement(); pinEl.style.zIndex = 5;
  // Camera that looks along the route, from its start toward its end
  // One smooth move of center, zoom, bearing, pitch and ground height together (easeTo would ignore the height and
  // snap it first). Far jumps rise and come back down, like a short flight, so it reads as moving, not cutting.
  let tw = 0;
  const busy = () => tw !== 0 || map.isMoving();
  // Keep the camera out of the mountainside: in steep valleys a close, tilted view can put it inside the terrain
  // (the whole map then smears). Tilt down, then back off, until it is 80 m above the ground under it.
  const clearCam = () => {
    if (!map.getTerrain() || !map.transform.getCameraLngLat) return;
    for (let k = 0; k < 14; k++) {
      const g = map.queryTerrainElevation(map.transform.getCameraLngLat());
      if (g == null || map.transform.getCameraAltitude() > g + 80) return;
      const p = map.getPitch(); map.jumpTo(p > 24 ? { pitch: p - 6 } : { zoom: map.getZoom() - .3 });
    }
  };
  const cam = (o, duration = 0) => {
    cancelAnimationFrame(tw); tw = 0;
    if (!duration || matchMedia("(prefers-reduced-motion: reduce)").matches) { map.jumpTo(o); clearCam(); return; }
    const c0 = map.getCenter(), z0 = map.getZoom(), b0 = map.getBearing(), p0 = map.getPitch(), e0 = map.getCenterElevation ? map.getCenterElevation() : 0;
    const c1 = o.center ? maplibregl.LngLat.convert(o.center) : c0, z1 = o.zoom ?? z0, p1 = o.pitch ?? p0, e1 = o.elevation ?? e0;
    const db = (((o.bearing ?? b0) - b0) % 360 + 540) % 360 - 180;
    const hop = Math.min(2, Math.max(0, Math.log2(c0.distanceTo(c1) / 700) * .8)), T = duration * (1 + hop * .4), t0 = performance.now();
    const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    const step = now => { const t = Math.min(1, (now - t0) / T), k = ease(t);
      map.jumpTo({ center: [c0.lng + (c1.lng - c0.lng) * k, c0.lat + (c1.lat - c0.lat) * k], zoom: z0 + (z1 - z0) * k - hop * Math.sin(Math.PI * k),
                   bearing: b0 + db * k, pitch: p0 + (p1 - p0) * k, elevation: e0 + (e1 - e0) * k });
      clearCam();
      tw = t < 1 ? requestAnimationFrame(step) : 0; };
    tw = requestAnimationFrame(step);
  };
  const EXAG = 1.25, zMid = P.reduce((a, p) => a + p[2], 0) / N;
  const bounds = ll.reduce((b, q) => b.extend([q[1], q[0]]), new maplibregl.LngLatBounds([ll[0][1], ll[0][0]], [ll[0][1], ll[0][0]]));
  const heading = Math.atan2((ll[N - 1][1] - ll[0][1]) * Math.cos(ll[0][0] * Math.PI / 180), ll[N - 1][0] - ll[0][0]) * 180 / Math.PI;
  const overview = (duration = 0) => { const c = map.cameraForBounds(bounds, { padding: 40, bearing: heading }); if (!c) return;
    const tilt = baseBar.querySelector("[data-tilt]").getAttribute("aria-pressed") === "true";
    // Give the camera the ground height explicitly: in the Alps the trail sits 2-3 km up, and without it the tilted view looks into a hillside
    cam({ ...c, zoom: c.zoom + (tilt ? .75 : 0), bearing: heading, pitch: tilt ? 50 : 0, elevation: tilt ? zMid * EXAG : 0 }, duration); };
  overview();
  // Again once the terrain tiles are in, so the ground height sticks. Once that view has loaded too, force a fresh
  // render: the first tilted frame can keep stale terrain (blank on Seealpsee, stretched walls on Zermatt) until resized.
  map.once("idle", () => { overview(); map.once("idle", () => map.resize()); });
  const fitAll = () => overview(1200);

  // Clicking the route jumps the robot there
  const nearest = latlng => { let bi = 0, bd = Infinity; ll.forEach((q, i) => { const d = (q[0] - latlng.lat) ** 2 + ((q[1] - latlng.lng) * .7) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; };
  map.on("click", "route-hit", e => { stop(); setIdx(nearest(e.lngLat), true); });
  map.on("mouseenter", "route-hit", () => map.getCanvas().style.cursor = "pointer"); map.on("mouseleave", "route-hit", () => map.getCanvas().style.cursor = "");

  // Colour by progress or steepness
  let colorMode = "progress";
  el.querySelectorAll("[data-color]").forEach(b => b.addEventListener("click", () => {
    colorMode = b.dataset.color; el.querySelectorAll("[data-color]").forEach(x => x.setAttribute("aria-pressed", x === b));
    el.querySelector(".rx-legend").hidden = colorMode !== "grade";
    const g = colorMode === "grade";
    map.setLayoutProperty("route-steep", "visibility", g ? "visible" : "none");
    ["route-base", "route-done"].forEach(id => map.setLayoutProperty(id, "visibility", g ? "none" : "visible"));
    draw();
  }));

  // Logged VLM answers along the route: what the robot saw there and how it scored it
  let vlm = [], vlmCur = -1;
  const vlmBox = el.querySelector(".rx-vlm");
  if (el.dataset.vlm && vlmBox) {
    try { vlm = (await (await fetch(el.dataset.vlm)).json()).moments; } catch (e) { vlm = []; }
    const dir = el.dataset.vlm.replace(/data\/(\w+)-vlm\.json$/, "img/vlm/$1/");
    vlm.forEach(m => { const n = String(m.n).padStart(3, "0"); m.cam = `${dir}${n}-cam.jpg`; m.risk = `${dir}${n}-risk.jpg`; });
    map.addSource("vlm", { type: "geojson", data: { type: "FeatureCollection", features: vlm.map((m, k) => ({ type: "Feature", id: k, properties: {}, geometry: { type: "Point", coordinates: [ll[m.i][1], ll[m.i][0]] } })) } });
    const on = ["boolean", ["feature-state", "on"], false];
    map.addLayer({ id: "vlm-dots", type: "circle", source: "vlm", paint: { "circle-radius": ["case", on, 8, ["interpolate", ["linear"], ["zoom"], 11, 3, 15, 5]], "circle-color": ["case", on, "#7fd1c7", "#1f7f8c"],
      "circle-stroke-color": "#ffffff", "circle-stroke-width": ["case", on, 3, 1.5], "circle-pitch-alignment": "map" } }, "route-hit");
    map.on("click", "vlm-dots", e => { stop(); setIdx(vlm[e.features[0].id].i, true); });
    map.on("mouseenter", "vlm-dots", () => map.getCanvas().style.cursor = "pointer"); map.on("mouseleave", "vlm-dots", () => map.getCanvas().style.cursor = "");
    vlmBox.hidden = !vlm.length;
    vlmBox.querySelector(".rx-vlm-n").textContent = T("{0} logged answers on this route", vlm.length);
  }
  // Crossfade: the new picture loads behind the current one, then fades in over it
  const xfade = (slot, src) => { const [a, b] = slot.querySelectorAll("img"), front = a.classList.contains("on") ? a : b, back = front === a ? b : a;
    if (front.getAttribute("src") === src) return;
    back.onload = () => { back.classList.add("on"); front.classList.remove("on"); }; back.src = src; back.alt = slot.dataset.alt; };
  const nice = s => s.replace(/_/g, " "), lbl = s => window.I18N_LABELS ? LB(s) : nice(s);   // display name (Japanese on /ja/)
  function showVlm(i) {
    if (!vlm.length) return;
    let k = 0; for (let j = 0; j < vlm.length && vlm[j].i <= i; j++) k = j;
    if (k === vlmCur) return;
    if (vlmCur >= 0) map.setFeatureState({ source: "vlm", id: vlmCur }, { on: false });
    vlmCur = k; map.setFeatureState({ source: "vlm", id: k }, { on: true });
    const m = vlm[k];
    xfade(vlmBox.querySelector(".rx-vlm-cam"), m.cam); xfade(vlmBox.querySelector(".rx-vlm-risk"), m.risk);
    const body = vlmBox.querySelector(".rx-vlm-body"); body.classList.add("fade");
    clearTimeout(body._t); body._t = setTimeout(() => {
      vlmBox.querySelector(".rx-vlm-km").textContent = T("km {0} · answer {1} of {2}", m.km.toFixed(2), k + 1, vlm.length);
      // Headline from the answer's own scores: what it avoids (risk 0.8+) and what it keeps to (preferred)
      const avoid = m.labels.filter(l => l[1] >= .8).map(l => lbl(l[0])), keep = m.labels.filter(l => l[3] >= .8).map(l => lbl(l[0]));
      vlmBox.querySelector(".rx-vlm-head").innerHTML = (avoid.length ? `<span class="no">${T("Avoids")}</span> ${avoid.slice(0, 3).join(T(", "))}` : "")
        + (avoid.length && keep.length ? " · " : "") + (keep.length ? `<span class="go">${T("keeps to")}</span> ${keep.slice(0, 2).join(T(", "))}` : "");
      vlmBox.querySelector(".rx-vlm-txt").textContent = T(m.text);
      vlmBox.querySelector(".rx-vlm-labels").innerHTML = [...m.labels].sort((a, b) => a[1] - b[1]).map(([l, r, st]) =>
        `<div class="rx-vl"><span class="l" title="${nice(l)}">${lbl(l)}${st < .5 ? ` <i title="${T("not steppable")}">${T("no step")}</i>` : ""}</span><span class="bar"><b style="width:${Math.max(4, r * 100)}%;background:${coolwarm(r)}"></b></span><span class="v">${r.toFixed(1)}</span></div>`).join("");
      body.classList.remove("fade");
    }, 160);
  }

  // Photo pins
  let photos = [];
  if (el.dataset.photos) {
    photos = await (await fetch(el.dataset.photos)).json();
    const pinEls = [];
    const pinVis = () => { const on = map.getZoom() >= 13.2; pinEls.forEach(e => e.style.visibility = on ? "visible" : "hidden"); };
    map.on("zoomend", pinVis);
    photos.forEach(ph => {
      ph.i = nearest({ lat: ph.lat, lng: ph.lon });
      const m = domMarker(`<div class="rx-photo" style="background-image:url(${ROOT}static/img/pins/${ph.id}_t.jpg)"></div>`, ph.lat, ph.lon);
      const cap = T(ph.caption);
      const pop = new maplibregl.Popup({ offset: 18, maxWidth: "260px", className: "rx-popup" }).setHTML(`<div class="pop"><img src="${ROOT}static/img/pins/${ph.id}.jpg" alt="${cap}" data-full="${ROOT}static/img/pins/${ph.id}.jpg"><div>${cap}<small>km ${ph.km.toFixed(1)}${ph.approx ? T(" (approx.)") : ""} · ${ph.by === "Fig. 3B" ? T("from Fig. 3B") : ph.by.includes("video") ? T("frame from the {0}", T(ph.by)) : T("photo: {0}", ph.by)}</small></div></div>`);
      m.setPopup(pop);
      pop.on("open", () => { const img = pop.getElement().querySelector("img[data-full]"); if (img) img.onclick = () => { lbImg.src = img.dataset.full; lbImg.alt = img.alt; lbCap.textContent = img.alt; lb.classList.add("open"); }; });
      m.getElement().addEventListener("click", () => { stop(); setIdx(ph.i, false); });
      pinEls.push(m.getElement());
    });
    pinVis();
  }

  // Elevation profile: hover/drag to scrub, drag horizontally to select a section
  const svg = el.querySelector(".rx-prof"), H = 130, m = { l: 44, r: 10, t: 8, b: 20 };
  const zs = P.map(p => p[2]), zmin = Math.min(...zs), zmax = Math.max(...zs);
  const pad = Math.max(10, (zmax - zmin) * .08), y0 = Math.floor((zmin - pad) / 10) * 10, y1 = Math.ceil((zmax + pad) / 10) * 10;
  let idx = 0, sel = null, covers = [];
  const gid = "g" + Math.random().toString(36).slice(2, 7);
  function draw() {
    const w = svg.clientWidth || 600, X = d => m.l + d / total * (w - m.l - m.r), Y = z => m.t + (1 - (z - y0) / (y1 - y0)) * (H - m.t - m.b);
    svg.setAttribute("viewBox", `0 0 ${w} ${H}`);
    const span = y1 - y0, step = span > 600 ? 500 : span > 200 ? 100 : span > 60 ? 20 : 10;
    let g = "", ax = "";
    for (let z = Math.ceil(y0 / step) * step; z <= y1; z += step) { g += `<line x1="${m.l}" x2="${w - m.r}" y1="${Y(z)}" y2="${Y(z)}"/>`; ax += `<text x="${m.l - 6}" y="${Y(z) + 3.5}" text-anchor="end">${z}</text>`; }
    const kmStep = total > 5000 ? 2000 : 500;
    for (let d = 0; d <= total; d += kmStep) ax += `<text x="${X(d)}" y="${H - 5}" text-anchor="middle">${(d / 1000).toFixed(kmStep < 1000 ? 1 : 0)} km</text>`;
    const pts = P.map((p, i) => `${X(p[3]).toFixed(1)},${Y(p[2]).toFixed(1)}`);
    const path = "M" + pts.join("L"), area = path + `L${X(total)},${H - m.b}L${m.l},${H - m.b}Z`;
    let line = `<path class="line" d="${path}"/>`;
    if (colorMode === "grade") line = P.slice(1).map((p, i) => `<path d="M${pts[i]}L${pts[i + 1]}" stroke="${gradeColor(grade[i])}" stroke-width="2.5" fill="none"/>`).join("");
    const dpath = colorMode === "grade" ? "" : `<path class="done" d="M${pts.slice(0, idx + 1).join("L")}"/>`;
    const c = P[idx];
    const coverRect = (pipOn && covers.length ? covers : []).map(c => `<rect class="cover" x="${X(P[c[0]][3])}" y="${m.t}" width="${Math.max(2, X(P[c[1]][3]) - X(P[c[0]][3]))}" height="${H - m.t - m.b}"/>`).join("");
    const brush = sel ? `<rect class="brush" x="${X(P[Math.min(...sel)][3])}" y="${m.t}" width="${Math.abs(X(P[sel[1]][3]) - X(P[sel[0]][3]))}" height="${H - m.t - m.b}"/>` : "";
    const ticks = photos.map(ph => `<rect class="ptick" x="${X(P[ph.i][3]) - 1}" y="${H - m.b - 6}" width="2" height="6"/>`).join("")
      + vlm.map((v, k) => `<rect class="vtick${k === vlmCur ? " on" : ""}" x="${X(P[v.i][3]) - .75}" y="${m.t}" width="1.5" height="${k === vlmCur ? 8 : 5}"/>`).join("");
    svg.innerHTML = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd1c7" stop-opacity=".35"/><stop offset="1" stop-color="#7fd1c7" stop-opacity="0"/></linearGradient></defs>
      <g class="grid">${g}</g>${coverRect}<path d="${area}" fill="url(#${gid})"/>${line}${dpath}${brush}${ticks}
      <g class="ax">${ax}</g><line class="cross" x1="${X(c[3])}" x2="${X(c[3])}" y1="${m.t}" y2="${H - m.b}"/><circle class="dot" cx="${X(c[3])}" cy="${Y(c[2])}" r="5"/>`;
  }
  const inView = q => { const p = map.project([q[1], q[0]]), c = map.getContainer(); return p.x > c.clientWidth * .2 && p.x < c.clientWidth * .8 && p.y > c.clientHeight * .25 && p.y < c.clientHeight * .85; };
  function setIdx(i, follow, fromVideo) {
    idx = Math.max(0, Math.min(N - 1, i));
    pin.setLngLat([ll[idx][1], ll[idx][0]]); map.getSource("done").setData(lineFC(ll.slice(0, idx + 1)));
    if (follow && !inView(ll[idx]) && !busy()) cam({ center: [ll[idx][1], ll[idx][0]], elevation: map.getTerrain() ? P[idx][2] * EXAG : 0 }, 700);
    el.querySelector(".rx-read").innerHTML = `<b>${(P[idx][3] / 1000).toFixed(2)} km</b> · <b>${Math.round(P[idx][2])} m</b> · ${T("grade")} <b>${Math.round(grade[idx])}%</b>`;
    if (!fromVideo) seekVideoTo(idx);
    showVlm(idx); syncCompanion(idx, !!(vid && !vid.paused()));
    draw();
  }
  // Section stats (Tobler's hiking function for a walking-time estimate)
  function showSel() {
    const box = el.querySelector(".rx-sel");
    if (!sel || Math.abs(sel[1] - sel[0]) < 3) { box.hidden = true; map.getSource("sel").setData(lineFC([])); return; }
    const a = Math.min(...sel), b = Math.max(...sel); let up = 0, dn = 0, mx = 0, hrs = 0;
    for (let i = a; i < b; i++) { const dz = P[i + 1][2] - P[i][2], dd = P[i + 1][3] - P[i][3];
      dz > 0 ? up += dz : dn -= dz; mx = Math.max(mx, Math.abs(grade[i]));
      if (dd > 0) hrs += dd / 1000 / (6 * Math.exp(-3.5 * Math.abs(dz / dd + .05))); }
    map.getSource("sel").setData(lineFC(ll.slice(a, b + 1)));
    box.hidden = false;
    box.innerHTML = `<div><span>${T("Distance")}</span><b>${((P[b][3] - P[a][3]) / 1000).toFixed(2)} km</b></div><div><span>${T("Ascent")}</span><b>${Math.round(up)} m</b></div>
      <div><span>${T("Descent")}</span><b>${Math.round(dn)} m</b></div><div><span>${T("Steepest")}</span><b>${Math.round(mx)}%</b></div><div><span>${T("Hiker time")}</span><b>${T("{0} h {1} min", Math.floor(hrs), Math.round(hrs % 1 * 60))}</b></div>
      <div class="x">${T("Walking time for a person, from Tobler's hiking function. Ascent and descent are read from the terrain model along the robot's GPS track.")}</div>`;
  }
  const toIdx = e => { const r = svg.getBoundingClientRect(), x = e.clientX - r.left;
    const d = (x - m.l) / (r.width - m.l - m.r) * total; let k = 0; while (k < N - 1 && P[k][3] < d) k++; return k; };
  let down = null;
  svg.addEventListener("pointerdown", e => { down = { x: e.clientX, i: toIdx(e) }; svg.setPointerCapture(e.pointerId); stop(); });
  svg.addEventListener("pointermove", e => {
    if (down && Math.abs(e.clientX - down.x) > 8) { sel = [down.i, toIdx(e)]; showSel(); draw(); return; }
    if (e.pointerType === "mouse" && !down) setIdx(toIdx(e), false);
  });
  svg.addEventListener("pointerup", e => {
    if (down && Math.abs(e.clientX - down.x) <= 8) { sel = null; showSel(); setIdx(toIdx(e), true); }
    down = null;
  });

  // Replay: with a video, play it from here (or from the start) and let the map follow the footage;
  // without one, walk the marker along the route in ~18 s
  const btn = el.querySelector(".rx-play"); let raf = 0;
  function syncBtn() { const on = !!raf || !!(vid && !vid.paused()); if (vid && vid.paused()) syncCompanion(idx, false); btn.setAttribute("aria-pressed", on); btn.querySelector("span").textContent = T(on ? "Pause" : "Replay the hike"); }
  function stop() { cancelAnimationFrame(raf); raf = 0; syncBtn(); }
  btn.addEventListener("click", () => {
    if (raf) return stop();
    if (vid && active) {
      if (!vid.paused()) { vid.pause(); return setTimeout(syncBtn, 50); }
      if (idx >= N - 1 || idx === 0) vid.seek(active.start || 0); else { const r = tm.reduce((b, x) => Math.abs(x.i - idx) < Math.abs(b.i - idx) ? x : b, tm[0]); vid.seek(r.t); }
      vid.play(); return setTimeout(syncBtn, 300);
    }
    btn.setAttribute("aria-pressed", true); btn.querySelector("span").textContent = T("Pause");
    let start = null; const from = idx >= N - 1 ? 0 : idx, dur = 18000 * (1 - from / N);
    if (from === 0) cam({ center: [ll[0][1], ll[0][0]], elevation: map.getTerrain() ? P[0][2] * EXAG : 0, zoom: Math.max(map.getZoom(), 14.5), bearing: heading }, 1000);
    const tick = t => { start ??= t; const k = Math.min(1, (t - start) / dur); setIdx(Math.round(from + k * (N - 1 - from)), true);
      if (k < 1) raf = requestAnimationFrame(tick); else { stop(); fitAll(); } };
    raf = requestAnimationFrame(tick);
  });

  // Fullscreen
  el.querySelector(".rx-full").addEventListener("click", () => {
    document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.();
  });
  document.addEventListener("fullscreenchange", () => setTimeout(() => { map.resize(); draw(); }, 100));

  // Videos synced both ways with the map (video time <-> position on the route).
  // Each source plays its local file, or its YouTube upload once SITE.youtube[source.yt] is set.
  let vid = null, tm = null, pipOn = false, active = null, approx = false;
  const pip = el.querySelector(".rx-pip"), noteEl = pip && pip.querySelector(".rx-pip-note");
  function seekVideoTo(i) {
    if (!vid || !tm || !pipOn || !vid.paused()) return;
    let best = null, bd = Infinity; tm.forEach(r => { const d = Math.abs(r.i - i); if (d < bd) { bd = d; best = r; } });
    if (best && bd < 15) { vid.seek(best.t); noteEl.textContent = noteEl.dataset.base; }
    else noteEl.textContent = T("No footage at this point");
  }
  // Video time -> fractional route index (between two GPS points), or null where the footage jumps
  function routePos(t) {
    if (!tm) return null;
    let k = 0; while (k < tm.length - 1 && tm[k + 1].t <= t) k++;
    const a = tm[k], b = tm[Math.min(k + 1, tm.length - 1)], f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
    return Math.abs(b.i - a.i) < 40 ? a.i + (b.i - a.i) * f : null;
  }
  const at = k => { const i = Math.min(N - 2, Math.floor(k)), f = k - i, a = P[i], b = P[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; };
  // Direction of travel at k, over ~50 m so single GPS wobbles don't swing the camera
  const travelBearing = k => { const i = Math.round(k); let a = i, b = i;
    while (a > 0 && P[i][3] - P[a][3] < 25) a--; while (b < N - 1 && P[b][3] - P[i][3] < 25) b++;
    return Math.atan2((ll[b][1] - ll[a][1]) * Math.cos(ll[a][0] * Math.PI / 180), ll[b][0] - ll[a][0]) * 180 / Math.PI; };
  function onVideoTime(t) {   // discrete update (seeking while paused)
    const k = routePos(t); if (k === null) return;
    setIdx(Math.round(k), true, true); const q = at(k); pin.setLngLat([q[1], q[0]]);
  }
  // While the video plays: every frame, place the pin from the video clock and let the camera glide after it
  let follow = true, glide = 0, camBear = null;
  function setFollow(on) {
    follow = on; baseBar.querySelector("[data-follow]").setAttribute("aria-pressed", on);
    if (on && vid && !vid.paused()) startGlide(true);
  }
  // Pressing on the map hands the camera back to the viewer (the per-frame follow would cancel their drag otherwise)
  map.getCanvasContainer().addEventListener("pointerdown", () => { cancelAnimationFrame(tw); tw = 0; if (follow && vid && !vid.paused()) setFollow(false); });
  function startGlide(closeUp) {
    cancelAnimationFrame(glide); camBear = map.getBearing();
    if (closeUp && follow && map.getZoom() < 14.8) {
      const k = routePos(vid.time()) ?? idx, q = at(k), tilt = !!map.getTerrain();
      camBear = travelBearing(k);
      cam({ center: [q[1], q[0]], elevation: tilt ? q[2] * EXAG : 0, zoom: 15.6, pitch: tilt ? 58 : 0, bearing: camBear }, 900);
    }
    const step = () => {
      if (!vid || vid.paused()) { glide = 0; return; }
      const k = routePos(vid.time());
      if (k !== null) {
        const q = at(k); pin.setLngLat([q[1], q[0]]);
        if (Math.round(k) !== idx) setIdx(Math.round(k), false, true);
        if (follow && !busy()) {
          const c = map.getCenter(), a = .12;   // ease toward the robot each frame
          let d = travelBearing(k) - camBear; d = ((d + 540) % 360) - 180; camBear += d * .04;
          map.jumpTo({ center: [c.lng + (q[1] - c.lng) * a, c.lat + (q[0] - c.lat) * a], bearing: camBear, elevation: map.getTerrain() ? q[2] * EXAG : 0 }); clearCam();
        }
      }
      glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  }
  // `start` skips the seconds before the mission begins (the robot is standing still there).
  // `rate` makes both cameras replay the hike in the same time.
  function localPlayer(src, poster, start = 0, rate = 1) {
    pip.querySelector(".rx-yt")?.remove();
    const v = pip.querySelector("video"); v.hidden = false; v.poster = poster; v.src = start ? `${src}#t=${start}` : src; v.controls = true; v._start = start;
    v.defaultPlaybackRate = v.playbackRate = rate;
    if (!v._bound) {
      v.addEventListener("timeupdate", () => { if (v.currentTime < v._start - .05) v.currentTime = v._start; if (vid && vid.kind === "local" && v.paused) onVideoTime(v.currentTime); });
      v.addEventListener("play", () => { if (vid && vid.kind === "local") { stop(); startGlide(true); } });
      ["play", "pause", "ended"].forEach(ev => v.addEventListener(ev, () => syncBtn()));
      v._bound = true; }
    return { kind: "local", play: () => v.play().catch(() => {}), pause: () => v.pause(), paused: () => v.paused, time: () => v.currentTime, seek: t => v.currentTime = Math.max(t, start), destroy: () => { v.pause(); } };
  }
  function ytPlayer(id, auto, start = 0, rate = 1) {
    pip.querySelector("video").hidden = true; pip.querySelector("video").pause();
    pip.querySelector(".rx-yt")?.remove();
    const host = document.createElement("div"); host.className = "rx-yt"; pip.prepend(host);
    let yt = null, ready = false, timer = 0;
    const make = () => { yt = new YT.Player(host, { videoId: id, playerVars: { rel: 0, playsinline: 1, mute: 1, start: Math.ceil(start) }, events: { onReady: () => { ready = true; yt.setPlaybackRate(rate); if (auto) yt.playVideo(); } } });
      let was = false;
      timer = setInterval(() => { const on = ready && yt.getPlayerState() === 1; if (on && !was) startGlide(true); if (on !== was) syncBtn(); was = on; }, 250); };
    if (window.YT && YT.Player) make(); else {
      const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { prev && prev(); make(); };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) { const sc = document.createElement("script"); sc.src = "https://www.youtube.com/iframe_api"; document.head.append(sc); }
    }
    return { kind: "yt", play: () => ready && yt.playVideo(), pause: () => ready && yt.pauseVideo(), paused: () => !ready || yt.getPlayerState() !== 1, time: () => ready ? yt.getCurrentTime() : 0,
             seek: t => ready && yt.seekTo(t, true), destroy: () => { clearInterval(timer); ready && yt.destroy(); } };
  }
  const sources = el.dataset.videos ? JSON.parse(el.dataset.videos) : [];
  const camIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3z"/></svg>';
  for (const src of sources) {
    try {
      const j = await (await fetch(src.timemap)).json();
      src.tm = j.map.map(r => ({ t: r[0], i: nearest({ lat: r[1], lng: r[2] }) }));
      src.approx = !!j.approx; src.matched = !!j.matched; src.speed = j.speed || 10; src.covers = [];
      src.tm.forEach((r, k) => { if (!k || Math.abs(r.i - src.tm[k - 1].i) > 40) src.covers.push([r.i, r.i]); else { const c = src.covers[src.covers.length - 1]; c[0] = Math.min(c[0], r.i); c[1] = Math.max(c[1], r.i); } });
      const btn = document.createElement("button"); btn.className = "rx-icon"; btn.setAttribute("aria-pressed", "false"); btn.innerHTML = camIcon + `<span>${src.label}</span>`;
      btn.title = T("Play “{0}” synced with the map", src.label);
      el.querySelector(".rx-vids").append(btn); src.btn = btn;
      btn.addEventListener("click", () => choose(src, true));
    } catch (e) { /* source without timemap: skip */ }
  }
  // Both cameras replay the hike in the same time: the longer clip plays faster
  const timed = sources.filter(o => o.tm);
  timed.forEach(o => o.span = o.tm[o.tm.length - 1].t - Math.max(o.start || 0, o.tm[0].t));
  const span = Math.min(...timed.map(o => o.span));
  timed.forEach(o => o.rate = Math.round(o.span / span * 100) / 100);
  const timeAt = (tm, i) => tm.reduce((b, x) => Math.abs(x.i - i) < Math.abs(b.i - i) ? x : b, tm[0]).t;
  function choose(src, play) {
    if (active === src) { if (play) vid.play(); return; }
    const was = !!vid && !vid.paused();
    if (vid) { vid.destroy(); vid = null; }
    sources.forEach(o => o.btn && o.btn.setAttribute("aria-pressed", o === src));
    active = src; tm = src.tm; covers = src.covers; pipOn = true;
    noteEl.dataset.base = noteEl.textContent = src.approx ? T("{0} · position approximate", src.label) : src.matched ? T("{0} · image-matched to GPS", src.label) : T("{0} · {1}× · GPS-synced", src.label, Math.round(src.speed * src.rate));
    // Switching cameras keeps the place on the route
    const here = idx > 0 && idx < N - 1 ? timeAt(src.tm, idx) : null;
    const ytId = (window.SITE && SITE.youtube && SITE.youtube[src.yt]) || "";
    vid = ytId ? ytPlayer(ytId, play || was, Math.max(here ?? 0, src.start || 0), src.rate) : localPlayer(src.src, src.poster, src.start, src.rate);
    if (!ytId && here !== null) vid.seek(here);
    if (play || was) { stop(); vid.play(); }
    setCompanion(); draw();
  }
  // The other camera plays alongside, small, at the same place on the route; clicking it swaps the two
  var comp = pip && pip.querySelector(".rx-comp"), compV = comp && comp.querySelector("video"), other = null;   // var: setIdx can run before this line
  function setCompanion() {
    if (!comp) return;
    other = timed.find(o => o !== active && !(window.SITE && SITE.youtube && SITE.youtube[o.yt])) || null;
    comp.hidden = !other || !vid || vid.kind !== "local";
    if (comp.hidden) return;
    if (compV.dataset.src !== other.src) { compV.dataset.src = other.src; compV.src = other.src; compV.poster = other.poster; }
    comp.querySelector("span").textContent = other.label;
    syncCompanion(idx, !vid.paused());
  }
  // Video time of `o` at route index i, between two of its anchors (null where that camera has no footage)
  function timeOn(o, i) {
    for (let k = 1; k < o.tm.length; k++) { const a = o.tm[k - 1], b = o.tm[k];
      if (Math.abs(b.i - a.i) < 40 && Math.min(a.i, b.i) <= i && i <= Math.max(a.i, b.i)) return b.i === a.i ? a.t : a.t + (b.t - a.t) * (i - a.i) / (b.i - a.i); }
    return null;
  }
  function syncCompanion(i, playing) {
    if (!comp || comp.hidden || !other) return;
    const target = timeOn(other, i);
    comp.classList.toggle("off", target === null);
    if (target === null) { compV.pause(); return; }
    const drift = compV.currentTime - target;
    if (!playing || Math.abs(drift) > 2.5) { if (Math.abs(drift) > .3) compV.currentTime = target; }
    // small drift: nudge the speed instead of seeking, so it does not stutter
    compV.playbackRate = Math.max(.25, other.rate * (playing ? 1 - Math.max(-.3, Math.min(.3, drift / 4)) : 1));
    if (playing && compV.paused) compV.play().catch(() => {});
    if (!playing && !compV.paused) compV.pause();
  }
  comp && comp.addEventListener("click", e => { e.stopPropagation(); if (other) choose(other, !!(vid && !vid.paused())); });
  const first = sources.find(o => o.tm);
  if (first) choose(first, false); else pip && (pip.parentElement.hidden = true);
  addEventListener("resize", draw);
  setIdx(0);
}

