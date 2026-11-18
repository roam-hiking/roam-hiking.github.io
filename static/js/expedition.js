// expedition.html: the two hikes as a 3D journey driven by the scroll position.
// Real terrain and aerial imagery (tools/bake_terrain.py), the robot's GPS track, and the logged VLM moments
// (tools/build_vlm_moments.py: camera and risk paired by header stamp, hand-picked, none near an intervention).
(async () => {
  const $ = s => document.querySelector(s), clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t), V = (x, y, z) => new THREE.Vector3(x, y, z);
  const EXAG = 1.15;   // a little vertical exaggeration reads better from the air
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Renderer, sky, light ----------
  const canvas = $("#gl"), renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .92;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, 5, 90000);
  const HORIZON = new THREE.Color("#c9dbe6"); scene.fog = new THREE.FogExp2(HORIZON, 0.000034);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80000, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color("#2f6fb0") }, hor: { value: HORIZON }, sun: { value: V(-.5, .35, -.8).normalize() } },
    vertexShader: "varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
    fragmentShader: "uniform vec3 top, hor, sun; varying vec3 d; void main(){ float h = clamp(d.y * 2.2, 0., 1.); vec3 c = mix(hor, top, pow(h, .7));"
      + " float s = max(dot(d, sun), 0.); c += vec3(1., .9, .75) * (pow(s, 400.) * 2. + pow(s, 12.) * .25); gl_FragColor = vec4(c, 1.); }" }));
  scene.add(sky);
  const sunDir = V(-.5, .55, -.65).normalize();
  const sunL = new THREE.DirectionalLight("#fff3e0", 2.1); sunL.position.copy(sunDir).multiplyScalar(10000); scene.add(sunL, sunL.target);
  scene.add(new THREE.HemisphereLight("#cfe3ff", "#5b5040", .55));
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 760 ? 55 : 42;
    // phones: the card covers the lower half, so frame the robot higher up
    w < 760 ? camera.setViewOffset(w, h, 0, h * .2, w, h) : camera.clearViewOffset(); camera.updateProjectionMatrix(); }
  addEventListener("resize", resize); resize();

  // ---------- Loading ----------
  const json = u => fetch(u).then(r => r.json());
  const tex = u => new Promise((ok, no) => new THREE.TextureLoader().load(u, ok, undefined, no));
  const img = u => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u; });
  const HIKES = {
    zermatt: { title: "#t-zermatt", stride: 300, color: "#e3342c" },
    seealpsee: { title: "#t-seealpsee", stride: 110, color: "#e3342c" },
  };
  const OFFSET = { zermatt: V(0, 0, 0), seealpsee: V(60000, 0, 0) };   // two worlds side by side; fog hides one from the other

  async function build(name) {
    const H = HIKES[name], o = OFFSET[name];
    const [meta, route, vlm, him, map, tm] = await Promise.all([json(`static/terrain/${name}/meta.json`), json(`static/data/${name}-route.json`), json(`static/data/${name}-vlm.json`),
      img(`static/terrain/${name}/height.png`), tex(`static/terrain/${name}/image.jpg`), json(`static/data/${name}-behind-timemap.json`).catch(() => null)]);
    const dmaps = await Promise.all((meta.details || []).slice(0, 2).map(d => tex(`static/terrain/${name}/${d.file}`).catch(() => null)));
    // heights from the terrarium-encoded grid
    const [gw, gh] = meta.grid, cv = document.createElement("canvas"); cv.width = gw; cv.height = gh;
    const cx = cv.getContext("2d"); cx.drawImage(him, 0, 0); const px = cx.getImageData(0, 0, gw, gh).data;
    const Z = new Float32Array(gw * gh); for (let k = 0; k < gw * gh; k++) Z[k] = px[4 * k] * 256 + px[4 * k + 1] + px[4 * k + 2] / 256 - 32768;
    const z0 = meta.zmin - 50, W = meta.width_m, D = meta.height_m;
    const [lon0, lat0, lon1, lat1] = meta.bbox;
    const mx = lon => (lon + 180) / 360, my = lat => (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2;
    const uv = (lat, lon) => [(mx(lon) - mx(lon0)) / (mx(lon1) - mx(lon0)), (my(lat) - my(lat1)) / (my(lat0) - my(lat1))];
    const hAt = (u, v) => { const gx = clamp(u, 0, 1) * (gw - 1), gy = clamp(v, 0, 1) * (gh - 1), i = Math.min(gw - 2, gx | 0), j = Math.min(gh - 2, gy | 0), fx = gx - i, fy = gy - j;
      const a = Z[j * gw + i], b = Z[j * gw + i + 1], c = Z[(j + 1) * gw + i], d = Z[(j + 1) * gw + i + 1]; return lerp(lerp(a, b, fx), lerp(c, d, fx), fy); };
    const toXZ = (u, v) => [(u - .5) * W + o.x, (v - .5) * D + o.z];
    H.ground = (x, z) => (hAt((x - o.x) / W + .5, (z - o.z) / D + .5) - z0) * EXAG;   // world height at a world x, z
    H.world = (lat, lon, lift = 0) => { const [u, v] = uv(lat, lon), [x, z] = toXZ(u, v); return V(x, (hAt(u, v) - z0) * EXAG + lift, z); };

    // terrain mesh: the aerial image draped over the grid; the edges fade into the haze
    const pos = new Float32Array(gw * gh * 3), tuv = new Float32Array(gw * gh * 2);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const k = j * gw + i, u = i / (gw - 1), v = j / (gh - 1), [x, z] = toXZ(u, v);
      pos.set([x, (Z[k] - z0) * EXAG, z], 3 * k); tuv.set([u, 1 - v], 2 * k); }
    const idx = new Uint32Array((gw - 1) * (gh - 1) * 6); let n = 0;
    for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) { const a = j * gw + i, b = a + 1, c = a + gw, d = c + 1; idx.set([a, c, b, b, c, d], n); n += 6; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(tuv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    map.encoding = THREE.sRGBEncoding; map.anisotropy = renderer.capabilities.getMaxAnisotropy(); map.minFilter = THREE.LinearMipmapLinearFilter;
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0 });
    // the sharp corridor images around the route (west and east halves), in the terrain's uv:
    // x = west..east, box z/w = their top/bottom in north..south
    const boxes = (meta.details || []).slice(0, 2).map(d => { const [l, t] = uv(d.bbox[3], d.bbox[0]), [r, b] = uv(d.bbox[1], d.bbox[2]); return new THREE.Vector4(l, r, t, b); });
    while (boxes.length < 2) boxes.push(new THREE.Vector4(0, 0, 0, 0));
    dmaps.forEach(t => { if (t) { t.encoding = THREE.sRGBEncoding; t.anisotropy = map.anisotropy; } });
    mat.onBeforeCompile = s => {
      s.uniforms.dm0 = { value: dmaps[0] || null }; s.uniforms.dm1 = { value: dmaps[1] || null }; s.uniforms.db0 = { value: boxes[0] }; s.uniforms.db1 = { value: boxes[1] };
      s.uniforms.has = { value: new THREE.Vector2(dmaps[0] ? 1 : 0, dmaps[1] ? 1 : 0) };
      s.fragmentShader = s.fragmentShader.replace("#include <map_pars_fragment>", "#include <map_pars_fragment>\nuniform sampler2D dm0, dm1; uniform vec4 db0, db1; uniform vec2 has;")
        .replace("#include <map_fragment>", `#include <map_fragment>
        vec2 a0 = vec2((vUv.x - db0.x) / (db0.y - db0.x), 1. - ((1. - vUv.y) - db0.z) / (db0.w - db0.z));
        vec2 a1 = vec2((vUv.x - db1.x) / (db1.y - db1.x), 1. - ((1. - vUv.y) - db1.z) / (db1.w - db1.z));
        float w0 = has.x * smoothstep(0., .04, min(min(a0.x, 1. - a0.x), min(a0.y, 1. - a0.y)));
        float w1 = has.y * smoothstep(0., .04, min(min(a1.x, 1. - a1.x), min(a1.y, 1. - a1.y)));
        if (w0 > 0.) diffuseColor.rgb = mix(diffuseColor.rgb, mapTexelToLinear(texture2D(dm0, a0)).rgb, w0);
        if (w1 > 0.) diffuseColor.rgb = mix(diffuseColor.rgb, mapTexelToLinear(texture2D(dm1, a1)).rgb, w1);
        vec3 lum = vec3(dot(diffuseColor.rgb, vec3(.299,.587,.114))); diffuseColor.rgb = mix(lum, diffuseColor.rgb, 1.22);
        diffuseColor.rgb = (diffuseColor.rgb - .5) * 1.12 + .5; diffuseColor.rgb = max(diffuseColor.rgb, vec3(.035)) * .96 + .02;`)
        .replace("#include <fog_fragment>", `#include <fog_fragment>
        float e = min(min(vUv.x, 1. - vUv.x), min(vUv.y, 1. - vUv.y)); gl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, smoothstep(0., .07, e));`);
    };   // detail images, then a touch more contrast and saturation, and an edge fade into the fog colour
    const terrain = new THREE.Mesh(g, mat); scene.add(terrain);

    // route: positions on the terrain, cumulative distance from the GPS track
    const P = route.points, N = P.length;
    H.pts = P.map(p => H.world(p[0], p[1], 3.5)); H.dist = P.map(p => p[3]); H.total = H.dist[N - 1]; H.alt = P.map(p => p[2]);
    const curve = new THREE.CatmullRomCurve3(H.pts, false, "centripetal", .3);
    const stampS = (geo, T, R) => {   // per-vertex route distance, so the shader compares metres with metres
      const sd = new Float32Array((T + 1) * (R + 1)); let k = 0;
      for (let i = 0; i <= T; i++) { const c = curve.getPointAt(i / T);
        let best = k, bd = Infinity; for (let q = Math.max(0, k - 5); q < Math.min(N, k + 60); q++) { const d = H.pts[q].distanceToSquared(c); if (d < bd) { bd = d; best = q; } }
        k = best; for (let r = 0; r <= R; r++) sd[i * (R + 1) + r] = H.dist[k]; }
      geo.setAttribute("sd", new THREE.BufferAttribute(sd, 1)); return geo; };
    const tube = stampS(new THREE.TubeGeometry(curve, Math.min(4000, N * 3), 1.3, 8, false), Math.min(4000, N * 3), 8);
    // the tube's u runs 0..1 along the curve; map it to metres along the route
    H.routeMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      uniforms: { prog: { value: 0 }, time: { value: 0 }, total: { value: H.total }, widen: { value: 0 } },
      // widen > 0 (map mode): push the tube out along its normals in proportion to the camera distance, so it stays a few pixels wide
      vertexShader: "attribute float sd; uniform float widen; varying vec2 vU; varying float vS; void main(){ vU = uv; vS = sd; vec4 w = modelMatrix * vec4(position, 1.); float d = distance(cameraPosition, w.xyz); gl_Position = projectionMatrix * viewMatrix * vec4(w.xyz + normalize(mat3(modelMatrix) * normal) * widen * d * .0022, 1.); }",
      fragmentShader: `uniform float prog, time, total; varying vec2 vU; varying float vS;
        void main(){ float m = vS, ahead = step(prog, vS);
          vec3 walked = vec3(1., .2, .16) * (1.25 + .35 * sin(m * .05 - time * 6.));
          float dash = .55 + .45 * smoothstep(.35, .65, fract(m / 26. - time * .6));
          vec3 col = mix(walked, vec3(1.) * dash * 1.05, ahead);
          float edge = 1. - pow(abs(vU.y - .5) * 2., 6.);
          float gap = prog > 0. ? smoothstep(3., 12., abs(vS - prog)) : 1.;   // the robot walks out of the line, not inside it
          gl_FragColor = vec4(col, mix(1., .82, ahead) * (.6 + .4 * edge) * gap); }` });
    const rt = new THREE.Mesh(tube, H.routeMat); rt.renderOrder = 2; scene.add(rt);
    // soft glow under the walked part
    H.glowMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { prog: { value: 0 } }, vertexShader: "attribute float sd; varying vec2 vU; varying float vS; varying float vD; void main(){ vU = uv; vS = sd; vec4 w = modelMatrix * vec4(position, 1.); vD = distance(cameraPosition, w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: "uniform float prog; varying vec2 vU; varying float vS; varying float vD; void main(){ float a = (1. - step(prog, vS)) * .22 * (1. - abs(vU.y - .5) * 2.) * smoothstep(180., 420., vD); gl_FragColor = vec4(1., .3, .2, a); }" });
    const glow = new THREE.Mesh(stampS(new THREE.TubeGeometry(curve, Math.min(3000, N * 2), 6, 8, false), Math.min(3000, N * 2), 8), H.glowMat); glow.renderOrder = 1; scene.add(glow);
    H.curve = curve;
    H.at = s => { // position and heading at s metres along the route
      let k = 0, a = 0, b = N - 1; while (b - a > 1) { const m = (a + b) >> 1; H.dist[m] <= s ? a = m : b = m; } k = a;
      const f = H.dist[k + 1] > H.dist[k] ? clamp((s - H.dist[k]) / (H.dist[k + 1] - H.dist[k]), 0, 1) : 0;
      return { p: H.pts[k].clone().lerp(H.pts[Math.min(N - 1, k + 1)], f), k, alt: lerp(H.alt[k], H.alt[Math.min(N - 1, k + 1)], f) };
    };
    H.dir = s => { const a = H.at(Math.max(0, s - 40)).p, b = H.at(Math.min(H.total, s + 40)).p; return b.sub(a).setY(0).normalize(); };

    // logged moments: a beam of light at each, a floating screen that wipes from camera to risk view
    H.moments = vlm.moments.map(m => ({ ...m, s: H.dist[m.i], cam: `static/img/vlm/${name}/${String(m.n).padStart(3, "0")}-cam.jpg`, risk: `static/img/vlm/${name}/${String(m.n).padStart(3, "0")}-risk.jpg` }));
    const beamG = new THREE.CylinderGeometry(.55, .55, 1, 10, 1, true); beamG.translate(0, .5, 0);
    const beamM = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { on: { value: 0 }, time: { value: 0 } },
      vertexShader: "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
      fragmentShader: "uniform float on, time; varying vec2 vU; void main(){ float a = pow(1. - vU.y, 2.2) * (.18 + .72 * on) * (.8 + .2 * sin(time * 3. + vU.y * 20.)); gl_FragColor = vec4(mix(vec3(.5,.82,.78), vec3(.75,1.,.95), on), a); }" });
    const loader = new THREE.TextureLoader();
    H.moments.forEach(m => {
      const base = H.pts[m.i];
      m.beam = new THREE.Mesh(beamG, beamM()); m.beam.position.copy(base); m.beam.scale.set(1, 120, 1); scene.add(m.beam);
      m.screen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
        uniforms: { a: { value: null }, b: { value: null }, wipe: { value: 0 }, op: { value: 0 } },
        vertexShader: "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
        fragmentShader: `uniform sampler2D a, b; uniform float wipe, op; varying vec2 vU;
          void main(){ vec3 c = vU.x < wipe ? texture2D(b, vU).rgb : texture2D(a, vU).rgb; float seam = smoothstep(.006, 0., abs(vU.x - wipe)) * step(.001, wipe) * step(wipe, .999);
            float fr = step(.012, vU.x) * step(vU.x, .988) * step(.018, vU.y) * step(vU.y, .982);
            gl_FragColor = vec4(mix(vec3(1.), c + seam, fr), op); }` }));
      m.screen.renderOrder = 3; scene.add(m.screen); m.screen.visible = false;
      m.load = () => { if (m.loaded) return; m.loaded = true; loader.load(m.cam, t => { t.encoding = THREE.sRGBEncoding; m.screen.material.uniforms.a.value = t; }); loader.load(m.risk, t => { t.encoding = THREE.sRGBEncoding; m.screen.material.uniforms.b.value = t; }); };
    });
    // video time for a route index, from the behind-the-robot timemap (fractional, null where there is no footage)
    if (tm) {
      const near = (lat, lon) => { let bi = 0, bd = Infinity; P.forEach((q, i) => { const d = (q[0] - lat) ** 2 + ((q[1] - lon) * .7) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; };
      const T = tm.map.map(r => ({ t: r[0], i: near(r[1], r[2]) }));
      H.videoAt = i => { for (let k = 1; k < T.length; k++) { const a = T[k - 1], b = T[k]; if (Math.abs(b.i - a.i) < 40 && Math.min(a.i, b.i) <= i && i <= Math.max(a.i, b.i)) return b.i === a.i ? a.t : a.t + (b.t - a.t) * (i - a.i) / (b.i - a.i); } return null; };
      H.video = `static/video/${name}-behind.mp4`;
    }
    H.rc = await json(`static/data/${name}-robotcam.json`).catch(() => null); H.name = name;
    H.center = V(o.x, 0, o.z); H.meta = meta;
    return H;
  }

  // ---------- The robot (ANYmal C, joint nodes J_<leg>_<HAA|HFE|KFE>, body frame +x forward) ----------
  const gltf = await new Promise((ok, no) => new THREE.GLTFLoader().load("static/models/anymal_c.glb", g => ok(g.scene), undefined, no));
  const LEG4 = ["LF", "RF", "LH", "RH"], QSIGN = { HAA: { LF: 1, RF: 1, LH: -1, RH: -1 }, HFE: { LF: 1, RF: -1, LH: 1, RH: -1 }, KFE: { LF: 1, RF: -1, LH: 1, RH: -1 } }, STANDQ = { F: [0, .4, -.8], H: [0, -.4, .8] };
  const robot = new THREE.Group(), body = new THREE.Group(); robot.add(body); body.add(gltf);
  gltf.traverse(o => { if (o.isMesh) { o.material.envMapIntensity = 1; if (o.material.map) o.material.map.encoding = THREE.sRGBEncoding; } });
  const J = {}; LEG4.forEach(l => J[l] = ["HAA", "HFE", "KFE"].map(k => gltf.getObjectByName(`J_${l}_${k}`)));
  const setLeg = (l, a, b, c) => { J[l][0].rotation.x = a * QSIGN.HAA[l]; J[l][1].rotation.x = b * QSIGN.HFE[l]; J[l][2].rotation.x = c * QSIGN.KFE[l]; };
  LEG4.forEach(l => setLeg(l, ...STANDQ[l[1]])); gltf.updateMatrixWorld(true);
  let STAND_H = .5; { const b = new THREE.Box3(); gltf.traverse(o => { if (o.isMesh && /_FOOT__/.test(o.name)) b.expandByObject(o); }); if (isFinite(b.min.y)) STAND_H = -b.min.y; }
  body.position.y = STAND_H;
  const trot = ph => { LEG4.forEach(l => { const p = ph + (l === "LF" || l === "RH" ? 0 : Math.PI), f = l[1] === "F" ? 1 : -1, s = STANDQ[l[1]];
    setLeg(l, s[0], s[1] + Math.cos(p) * .28, s[2] - f * Math.max(0, Math.sin(p)) * .55); }); body.position.y = STAND_H + Math.abs(Math.sin(ph)) * .012; };
  // a soft red disc under the robot so it can be found from far away
  const halo = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
    fragmentShader: "varying vec2 vU; void main(){ float r = length(vU - .5) * 2.; gl_FragColor = vec4(1., .3, .22, smoothstep(1., .2, r) * .55); }" }));
  halo.rotation.x = -Math.PI / 2; robot.add(halo);
  // contact shadow: a soft dark ellipse under the body (and a smaller dark spot under each foot), so the robot stands on the ground
  const shadowMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    vertexShader: "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
    fragmentShader: "uniform float k; varying vec2 vU; void main(){ float r = length(vU - .5) * 2.; gl_FragColor = vec4(0., .01, .02, (1. - smoothstep(0., 1., r)) * k); }",
    uniforms: { k: { value: .62 } } });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1.15, .75, 1); shadow.position.y = .03; shadow.renderOrder = 1; robot.add(shadow);
  const footMat = shadowMat.clone(); footMat.uniforms.k.value = .55;
  const feet = LEG4.map(l => { const f = new THREE.Mesh(new THREE.PlaneGeometry(.16, .16), footMat); f.rotation.x = -Math.PI / 2; f.renderOrder = 1; robot.add(f); return { l, f, node: gltf.getObjectByName(`J_${l}_shank_fixed_${l}_FOOT`) }; });
  const fw = V();
  const footShadows = () => feet.forEach(({ f, node }) => { if (!node) return; node.getWorldPosition(fw); robot.worldToLocal(fw); f.position.set(fw.x, .035, fw.z); });
  scene.add(robot);

  const Z = await build("zermatt");
  const S = await build("seealpsee");
  $("#load").classList.add("done");

  // ---------- The journey: scroll units -> what happens ----------
  // Each hike: travel units (metres / stride) plus a dwell at every featured moment, where the camera swings in close.
  // The other moments are pass-bys: their card and screen come up while the robot walks past (PASS m either side).
  const DWELL = 1.6, INTRO = 3.4, GAP = 2.4, OUTRO = 2.2, PASS = 110;
  function plan(H) { const segs = []; let s0 = 0, u = 0;
    H.moments.filter(m => m.f !== 0).forEach(m => { const d = Math.max(0, m.s - s0); segs.push({ u0: u, u1: u + d / H.stride, s0, s1: m.s }); u += d / H.stride; segs.push({ u0: u, u1: u + DWELL, s0: m.s, s1: m.s, m }); u += DWELL; s0 = m.s; });
    segs.push({ u0: u, u1: u + (H.total - s0) / H.stride, s0, s1: H.total }); u += (H.total - s0) / H.stride; H.segs = segs; H.units = u; }
  plan(Z); plan(S);
  const U = { z0: INTRO, z1: INTRO + Z.units, s0: INTRO + Z.units + GAP }; U.s1 = U.s0 + S.units; U.end = U.s1 + OUTRO;
  const VH = innerHeight * .55;   // pixels of scroll per unit
  $("#track").style.height = (U.end * VH + innerHeight) + "px";

  function stateAt(u) {
    if (u < U.z0) return { phase: "intro", f: u / INTRO, H: Z, s: 0 };
    if (u < U.z1) return { phase: "hike", H: Z, ...walk(Z, u - U.z0) };
    if (u < U.s0) { const f = (u - U.z1) / GAP; return { phase: "gap", f, H: f < .5 ? Z : S, s: f < .5 ? Z.total : 0 }; }
    if (u < U.s1) return { phase: "hike", H: S, ...walk(S, u - U.s0) };
    return { phase: "outro", f: clamp((u - U.s1) / OUTRO, 0, 1), H: S, s: S.total };
  }
  function walk(H, u) {
    const g = H.segs.find(x => u < x.u1) || H.segs[H.segs.length - 1], f = clamp((u - g.u0) / (g.u1 - g.u0 || 1), 0, 1);
    if (g.m) return { s: g.s0, m: g.m, mf: f };
    // ease into and out of each featured moment so the walk slows down as it arrives
    const s = lerp(g.s0, g.s1, f < .5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2);
    const p = H.moments.find(q => q.f === 0 && Math.abs(q.s - s) < PASS);   // walking past one: pf 0 -> 1 across it
    return p ? { s, p, pf: (s - p.s + PASS) / (2 * PASS) } : { s };
  }

  // ---------- Camera ----------
  const introK = f => smooth(clamp((f - .3) / .7, 0, 1));   // intro: hold the whole-route view for the first 30%, then descend
  const camPos = V(0, 9000, 9000), camLook = V(), tmpP = V(), tmpL = V();
  function clearGround(H, p, min = 40) { const g = H.ground(p.x, p.z); if (p.y < g + min) p.y = g + min; return p; }
  function shot(st, t) {
    const H = st.H;
    if (st.phase === "intro") {
      // open on the whole Zermatt route over the whole map (lit red, slowly turning), then fly down to the start while the
      // red line draws back to it, so the walk starts where the line ends
      if (!Z.frame) { const b = new THREE.Box3(); Z.pts.forEach(q => b.expandByPoint(q)); Z.frame = { c: b.getCenter(V()), r: b.getSize(V()).length() * .5 }; }
      const { c, r } = Z.frame, k = introK(st.f), s0 = Z.at(0).p, a = Math.atan2(1.25, -.55) + t * .012, an = -1.95 + .35;
      const ph = clamp(1.6 / camera.aspect, 1, 1.85);   // a portrait screen is narrower: back off until the route fits across
      const far = V(c.x + Math.cos(a) * r * 2 * ph, c.y + r * 1.6 * ph, c.z + Math.sin(a) * r * 2 * ph), near = V(s0.x + Math.cos(an) * 900, s0.y + 500, s0.z + Math.sin(an) * 900);
      // the title sits on the left: look a little left of the route's centre, so the route fills the right of the screen
      const fx = c.x - far.x, fz = c.z - far.z, fl = Math.hypot(fx, fz) || 1, lc = c.clone().add(V(fz / fl, 0, -fx / fl).multiplyScalar(r * (camera.aspect > 1 ? .22 : 0) * (1 - k)));
      far.add(lc.clone().sub(c));
      tmpP.copy(far).lerp(near, k); tmpP.y += Math.sin(Math.PI * k) * r * .15; tmpL.copy(lc).lerp(s0, k);
      return;
    }
    if (st.phase === "outro") {
      // slow orbit high above the whole area, looking at the route; the outro pulls back over Seealpsee
      const c = H === Z ? Z.at(Z.total * .35).p : S.at(S.total * .5).p;
      const f = st.phase === "intro" ? 1 - smooth(clamp(st.f, 0, 1)) : smooth(st.f);
      const ang = (H === Z ? -1.95 : -2.2) + t * .02 + (1 - f) * .35, R = lerp(H === Z ? 900 : 500, H === Z ? 6500 : 3200, f), up = lerp(H === Z ? 500 : 300, H === Z ? 3200 : 1700, f);
      if (st.phase === "intro") { const s0 = Z.at(0).p; c.lerp(s0, 1 - f); }
      tmpP.set(c.x + Math.cos(ang) * R, c.y + up, c.z + Math.sin(ang) * R); tmpL.copy(c);
      return;
    }
    if (st.phase === "gap") { const a = Z.at(Z.total).p, b = S.at(0).p, f = st.f;   // climb out of Zermatt, come down over Seealpsee
      const from = f < .5, P0 = from ? a : b, k = from ? smooth(f * 2) : 1 - smooth((f - .5) * 2);
      const d = from ? Z.dir(Z.total) : S.dir(0);
      tmpP.set(P0.x - d.x * lerp(220, 600, k), P0.y + lerp(140, 2600, k), P0.z - d.z * lerp(220, 600, k)); tmpL.copy(P0).add(V(0, lerp(0, -400, k), 0)); return; }
    // chase: behind and above the robot, looking a little ahead; at a moment, swing round to the side and come in close
    const p = H.at(st.s).p, d = H.dir(st.s), side = V(-d.z, 0, d.x);
    const pk = st.p ? Math.sin(Math.PI * clamp(st.pf, 0, 1)) ** 2 : 0;   // walking past a moment: lean in a little
    const back = 260 - pk * 90, up = 150 - pk * 55;
    tmpP.copy(p).addScaledVector(d, -back).addScaledVector(side, 60).add(V(0, up, 0));
    tmpL.copy(p).addScaledVector(d, 120);
    if (st.m) {
      const m = st.m, k = Math.sin(Math.PI * clamp(st.mf, 0, 1)) ** .7;
      // orbit on the uphill side, so the camera looks out over the valley instead of into a slope a few metres away
      if (m.swing === undefined) { const g = sd => H.ground(p.x + side.x * sd, p.z + side.z * sd); m.swing = g(70) + g(40) >= g(-70) + g(-40) ? 1 : -1; }
      const swing = m.swing;
      // orbit the robot through the stop: from behind its shoulder round to its front
      const ang = swing * lerp(.9, 2.1, smooth(clamp(st.mf, 0, 1)));
      const close = p.clone().addScaledVector(d, -Math.cos(ang) * 82).addScaledVector(side, Math.sin(ang) * 82).add(V(0, 36, 0));
      const lift = Math.max(0, H.ground(close.x, close.z) + 30 - close.y); close.y += lift;
      // aim between the robot and its floating screen (about 40 m up), 40% of the way up: robot in the lower third, screen above,
      // also when the slope lifts the camera
      const h = Math.hypot(close.x - p.x, close.z - p.z), ar = Math.atan2(p.y - close.y, h), as = Math.atan2(p.y + 40 - close.y, h);
      const aimY = close.y + h * Math.tan(ar + .4 * (as - ar)) - p.y;
      tmpP.lerp(close, k); tmpL.lerp(p.clone().add(V(0, aimY, 0)).addScaledVector(side, -swing * 10), k);
    }
    clearGround(H, tmpP, 45);
  }

  // ---------- HUD ----------
  const card = $("#card"), pics = $("#pics"), vid = $("#c-vid");
  let shown = null, wipeT = 0;
  const nice = s => s.replace(/_/g, " ");
  const CW = [[58, 76, 192], [141, 175, 253], [221, 220, 219], [243, 152, 121], [179, 3, 38]];
  const coolwarm = x => { x = clamp(x, 0, 1) * 4; const k = Math.min(3, x | 0), t = x - k; return `rgb(${CW[k].map((c, j) => Math.round(c + (CW[k + 1][j] - c) * t)).join(",")})`; };
  function showMoment(H, m) {
    if (m === shown) return; shown = m;
    if (!m) { card.classList.add("off"); vid.pause(); return; }
    card.classList.remove("off");
    const body = $("#c-body"); body.classList.add("out");
    pics.querySelector(".cam").src = m.cam; pics.querySelector(".risk").src = m.risk; wipeT = performance.now();
    setTimeout(() => {
      $("#c-km").textContent = `km ${m.km.toFixed(2)} · ${H.moments.indexOf(m) + 1} of ${H.moments.length}`;
      const avoid = m.labels.filter(l => l[1] >= .8).map(l => nice(l[0])), keep = m.labels.filter(l => l[3] >= .8).map(l => nice(l[0]));
      $("#c-head").innerHTML = (avoid.length ? `<span class="no">Avoids</span> ${avoid.slice(0, 3).join(", ")}` : "") + (avoid.length && keep.length ? " · " : "") + (keep.length ? `<span class="go">keeps to</span> ${keep.slice(0, 2).join(", ")}` : "");
      $("#c-say").textContent = m.text;
      const L = [...m.labels].sort((a, b) => a[1] - b[1]); const pick = [...L.slice(0, 3), ...L.slice(-3)].filter((x, i, a) => a.indexOf(x) === i);
      $("#c-labs").innerHTML = pick.map(([l, r]) => `<div class="lab"><span>${nice(l)}</span><i><b style="width:${Math.max(5, r * 100)}%;background:${coolwarm(r)}"></b></i></div>`).join("");
      body.classList.remove("out");
    }, 250);
    // the behind-the-robot footage from this point
    const t = H.videoAt && H.videoAt(m.i);
    if (t != null) { const src = H.video; if (!vid.src.endsWith(src)) { vid.preload = "auto"; vid.poster = src.replace(".mp4", "-poster.jpg"); vid.src = src; } const go = () => { vid.currentTime = t; vid.play().catch(() => {}); };
      vid.readyState >= 1 ? go() : vid.addEventListener("loadedmetadata", go, { once: true }); vid.parentElement.hidden = false; }
    else { vid.pause(); vid.parentElement.hidden = true; }
  }
  // elevation profile of the current hike
  const psvg = $("#prof-svg"); let profFor = null;
  function drawProfile(H) {
    profFor = H; const w = psvg.clientWidth || 800, h = 38, zs = H.alt, lo = Math.min(...zs), hi = Math.max(...zs);
    const X = s => s / H.total * w, Y = z => h - 4 - (z - lo) / (hi - lo || 1) * (h - 10);
    const d = H.dist.map((s, i) => `${i ? "L" : "M"}${X(s).toFixed(1)},${Y(zs[i]).toFixed(1)}`).join("");
    psvg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    psvg.innerHTML = `<defs><clipPath id="pc"><rect id="pc-r" x="0" y="0" width="0" height="${h}"/></clipPath></defs>
      <path d="${d}L${w},${h}L0,${h}Z" fill="rgba(255,255,255,.08)"/><path d="${d}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.5"/>
      <path d="${d}" fill="none" stroke="#ff6b5f" stroke-width="2.5" clip-path="url(#pc)"/>
      ${H.moments.map(m => `<circle cx="${X(m.s)}" cy="${Y(zs[m.i])}" r="${m.f === 0 ? 2 : 3.2}" fill="#7fd1c7" stroke="#0b1117" stroke-width="1"/>`).join("")}
      <circle id="pdot" r="5" fill="#e3342c" stroke="#fff" stroke-width="2"/>`;
    psvg.onclick = e => { const r = psvg.getBoundingClientRect(), s = (e.clientX - r.left) / r.width * H.total; jumpTo(H, s); };
  }
  function jumpTo(H, s) { // scroll to the unit where the walk reaches s
    const g = H.segs.find(x => !x.m && s <= x.s1) || H.segs[H.segs.length - 1], f = g.s1 > g.s0 ? (s - g.s0) / (g.s1 - g.s0) : 0;
    const u = (H === Z ? U.z0 : U.s0) + g.u0 + f * (g.u1 - g.u0); stopPlay(); scrollTo({ top: u * VH, behavior: "smooth" });
  }
  document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => { if (mapMode) { mapH = b.dataset.go === "zermatt" ? Z : S; frameRoute(mapH); return; } stopPlay(); scrollTo({ top: (b.dataset.go === "zermatt" ? U.z0 : U.s0) * VH, behavior: "smooth" }); }));

  // ---------- Play: fly the journey by itself (the scroll position follows, so the user can take over any time) ----------
  let playing = false, lastT = 0, speed = 1;
  document.querySelectorAll("[data-sp]").forEach(b => b.addEventListener("click", () => { speed = +b.dataset.sp; document.querySelectorAll("[data-sp]").forEach(x => x.classList.toggle("on", x === b)); }));
  const playBtn = $("#play");
  function stopPlay() { playing = false; playBtn.setAttribute("aria-pressed", "false"); playBtn.querySelector("span").textContent = "Play"; }
  playBtn.addEventListener("click", () => { playing = !playing; playBtn.setAttribute("aria-pressed", playing); playBtn.querySelector("span").textContent = playing ? "Pause" : "Play";
    if (playing && scrollY >= U.end * VH - 5) scrollTo(0, 0); });
  ["wheel", "touchstart", "keydown"].forEach(ev => addEventListener(ev, () => playing && stopPlay(), { passive: true }));

  // ---------- Robot's camera: one frame per few metres along the route, scrubbed to where the robot is ----------
  const rcBox = $("#rcam"), rcV = { cam: $("#rc-cam"), risk: $("#rc-risk") }; let rcKind = "cam", rcFor = null;
  document.querySelectorAll("[data-rc]").forEach(b => b.addEventListener("click", () => { rcKind = b.dataset.rc;
    document.querySelectorAll("[data-rc]").forEach(x => x.classList.toggle("on", x === b)); rcV.cam.hidden = rcKind !== "cam"; rcV.risk.hidden = rcKind !== "risk"; }));
  function robotCam(H, s, on) {
    const rc = H.rc; rcBox.classList.toggle("off", !on || !rc); if (!on || !rc) return;
    if (rcFor !== H) { rcFor = H; ["cam", "risk"].forEach(k => { rcV[k].src = `static/video/${H.name}-robotcam-${k}.mp4`; }); }
    const k = (s - rc.s0) / rc.step_m, none = k < 0 || k > rc.frames - 1 || rc.holes.some(([a, b]) => s >= a && s < b);
    if (none) { rcBox.classList.add("off"); return; }   // no footage on this stretch: the window just fades away
    const v = rcV[rcKind], t = (Math.round(k) + .5) / rc.fps;
    if (v.readyState >= 1 && !v.seeking && Math.abs(v.currentTime - t) > .4 / rc.fps) v.currentTime = t;
  }

  // ---------- Map mode: just the 3D route of one hike, free orbit ----------
  const orbit = new THREE.OrbitControls(camera, canvas); orbit.enabled = false; orbit.enableDamping = true; orbit.dampingFactor = .08;
  orbit.maxPolarAngle = Math.PI * .47; orbit.screenSpacePanning = false;
  let mapMode = false, mapH = Z, savedY = 0;
  function frameRoute(H) {   // look at the whole route from the south-west, tilted
    const b = new THREE.Box3(); H.pts.forEach(p => b.expandByPoint(p)); const c = b.getCenter(V()), r = b.getSize(V()).length() * .5;
    orbit.target.copy(c); camera.position.set(c.x - r * .55, c.y + r * 1.05, c.z + r * 1.25); orbit.minDistance = 60; orbit.maxDistance = r * 6; orbit.update();
  }
  function setMap(on, H) {
    mapMode = on; document.body.classList.toggle("mapmode", on); $("#mapmode").setAttribute("aria-pressed", on); orbit.enabled = on;
    [Z, S].forEach(X => X.routeMat.uniforms.widen.value = on ? 1 : 0);
    if (on) { stopPlay(); savedY = scrollY; mapH = H || (stateAt(uNow).H); frameRoute(mapH); robot.visible = false; showMoment(mapH, null); }
    else { robot.visible = true; scrollTo(0, savedY); camPos.copy(camera.position); }
  }
  $("#mapmode").addEventListener("click", () => setMap(!mapMode));
  addEventListener("keydown", e => { if (e.key === "Escape" && mapMode) setMap(false); });

  // ---------- Frame loop ----------
  let uNow = 0, phase = 0, prevS = 0, prevH = null;
  function frame(now) {
    const dt = Math.min(.05, (now - (lastT || now)) / 1000); lastT = now; const t = now / 1000;
    if (mapMode) {   // whole route lit, beams as landmarks, no story
      orbit.update(); sky.position.copy(camera.position);
      [Z, S].forEach(X => { X.routeMat.uniforms.prog.value = X === mapH ? X.total + 1 : -1; X.routeMat.uniforms.time.value = t; X.routeMat.uniforms.widen.value = 1; X.glowMat.uniforms.prog.value = X === mapH ? X.total + 1 : -1;
        X.moments.forEach(m => { m.screen.visible = false; m.beam.material.uniforms.on.value = .55; m.beam.material.uniforms.time.value = t; m.beam.scale.y = 90; }); });
      document.querySelectorAll("[data-go]").forEach(b => b.classList.toggle("on", (b.dataset.go === "zermatt") === (mapH === Z)));
      renderer.render(scene, camera); requestAnimationFrame(frame); return;
    }
    if (playing) { const st0 = stateAt(scrollY / VH); const v = (st0.m ? .55 : st0.p ? .6 : st0.phase === "hike" ? 1.05 : .7) * (st0.m ? Math.sqrt(speed) : speed); scrollTo(0, scrollY + v * VH * dt); if (scrollY >= U.end * VH - 2) stopPlay(); }
    const target = scrollY / VH; uNow += (target - uNow) * (REDUCED ? 1 : 1 - Math.exp(-dt * 5));   // smoothed, so wheel steps glide
    const st = stateAt(uNow), H = st.H;
    // robot on the route
    const here = H.at(st.s), d = H.dir(st.s);
    robot.position.copy(here.p).add(V(0, -3.5, 0)); robot.rotation.y = Math.atan2(-d.z, d.x);
    if (prevH === H) phase += Math.abs(st.s - prevS) * 2.4; prevS = st.s; prevH = H;
    if (st.m) phase += dt * 1.2;   // marking time at a moment
    trot(phase); footShadows();
    // camera
    shot(st, t); const k = REDUCED ? 1 : 1 - Math.exp(-dt * 3.2);
    camPos.lerp(tmpP, k); camLook.lerp(tmpL, k);
    if (camPos.distanceTo(tmpP) > 20000) { camPos.copy(tmpP); camLook.copy(tmpL); }   // jumping between the two worlds: cut
    clearGround(H, camPos, 30); camera.position.copy(camPos); camera.lookAt(camLook);
    sky.position.copy(camera.position);
    // the robot stays readable from far away, real size close up
    const dist = camera.position.distanceTo(robot.position), sc = clamp(dist * .034, 1, 40); robot.scale.setScalar(sc); halo.scale.setScalar(1.6);
    shadowMat.uniforms.k.value = .62 * clamp((4 - sc) / 2, 0, 1); footMat.uniforms.k.value = .55 * clamp((3 - sc) / 1.5, 0, 1); shadow.visible = sc < 4; feet.forEach(f => f.f.visible = sc < 3);   // only close up
    // route glow
    [Z, S].forEach(X => { const pr = X === H ? (st.phase === "intro" ? X.total * (1 - introK(st.f)) : st.s) : (X === Z && H === S ? X.total + 1 : -1);
      X.routeMat.uniforms.prog.value = pr; X.routeMat.uniforms.time.value = t; X.glowMat.uniforms.prog.value = pr;
      X.routeMat.uniforms.widen.value = X === Z && st.phase === "intro" ? 1 - introK(st.f) : 0; });   // the whole route stays readable from far away
    // moments: beams brighten as the robot nears; the screen rises and wipes to the risk view while it is the current one
    [Z, S].forEach(X => X.moments.forEach(m => {
      const near = X === H ? clamp(1 - Math.abs(m.s - st.s) / 500, 0, 1) : 0, cur = st.m === m || st.p === m;
      const land = X === Z && st.phase === "intro" ? 1 - introK(st.f) : 0;   // opening view: every moment a landmark, as in Map mode
      m.beam.material.uniforms.on.value = lerp(m.beam.material.uniforms.on.value, Math.max(cur ? 1 : near * .5, land * .55), .1); m.beam.material.uniforms.time.value = t;
      m.beam.scale.y = lerp(m.beam.scale.y, cur ? 90 : Math.max(60 + near * 40, land * 90), .1);
      const nxt = X === H ? X.moments.find(q => q.s > st.s + 1 && q.f !== 0) : null;
      const show = X === H && st.phase === "hike" && (cur || (m === nxt && m.s - st.s < 1200));
      if (show) m.load();
      const op = m.screen.material.uniforms.op; op.value = lerp(op.value, show ? (cur ? 1 : .85) : 0, .12); m.screen.visible = op.value > .02 && !!m.screen.material.uniforms.a.value;
      if (m.screen.visible) {
        const dd = camera.position.distanceTo(X.pts[m.i]), sz = clamp(dd * (cur ? .12 : .1), 8, 260);
        m.screen.scale.set(sz, sz, 1); m.screen.position.copy(X.pts[m.i]).add(V(0, (cur ? 34 : 52) + sz * .56, 0)); m.screen.quaternion.copy(camera.quaternion);
        const w = m.screen.material.uniforms.wipe; w.value = cur ? clamp(((st.m ? st.mf : st.pf) - .15) / .5, 0, 1) : Math.max(0, w.value - dt);
        if (!m.screen.material.uniforms.b.value) w.value = 0;
      }
    }));
    // HUD
    showMoment(H, st.phase === "hike" ? st.m || st.p || null : null);
    if (shown) pics.style.setProperty("--wipe", (100 - clamp((now - wipeT - 500) / 1400, 0, 1) * 50) + "%");
    $("#t-intro").classList.toggle("off", !(st.phase === "intro" && st.f < .75));
    $("#t-zermatt").classList.toggle("off", !(H === Z && st.phase === "hike" && st.s < 650 && !st.m));
    $("#t-seealpsee").classList.toggle("off", !(H === S && st.phase === "hike" && st.s < 250 && !st.m));
    $("#end").classList.toggle("off", !(st.phase === "outro" && st.f > .35));
    document.querySelectorAll("[data-go]").forEach(b => b.classList.toggle("on", (b.dataset.go === "zermatt") === (H === Z)));
    $("#veil").style.opacity = st.phase === "gap" ? Math.sin(Math.PI * st.f) ** 3 : 0;
    $("#bar").style.width = clamp(uNow / U.end, 0, 1) * 100 + "%";
    const on = st.phase === "hike"; ["#tele", "#prof"].forEach(s => $(s).style.opacity = on ? 1 : 0);
    robotCam(H, st.s, on);
    if (on) {
      if (profFor !== H) drawProfile(H);
      const k2 = here.k, grade = (() => { const a = H.at(Math.max(0, st.s - 30)), b = H.at(Math.min(H.total, st.s + 30)); return (b.alt - a.alt) / 60 * 100; })();
      $("#v-km").textContent = (st.s / 1000).toFixed(2); $("#v-alt").textContent = Math.round(here.alt).toLocaleString("en"); $("#v-grade").textContent = Math.round(grade) + "%";
      const w = psvg.clientWidth || 800, x = st.s / H.total * w, zs = H.alt, lo = Math.min(...zs), hi = Math.max(...zs), y = 38 - 4 - (zs[k2] - lo) / (hi - lo || 1) * 28;
      const r = psvg.querySelector("#pc-r"), dot = psvg.querySelector("#pdot"); if (r) r.setAttribute("width", x); if (dot) { dot.setAttribute("cx", x); dot.setAttribute("cy", y); }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__xp = { U, VH, Z, S, stateAt, camera, robot, halo, shadow, scene };
})().catch(e => { console.error("expedition failed:", e); const l = document.querySelector("#load"); if (l) l.textContent = "Could not load the 3D view: " + (e && e.message || e); });
