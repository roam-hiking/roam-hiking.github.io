// Review mode. serve.py injects this into the local preview only; the published page never loads it.
// Tap "Comment", tap the part of the page you mean, write a note. Notes go to review-comments.json.
(() => {
  const css = `
  .rvw-fab { position: fixed; right: 14px; bottom: 14px; z-index: 9000; display: flex; gap: 8px; font: 600 14px Inter, system-ui, sans-serif; }
  .rvw-fab button { border: 0; border-radius: 999px; padding: 11px 16px; background: #f5c542; color: #1a1a1a; font: inherit; box-shadow: 0 4px 18px rgba(0,0,0,.45); cursor: pointer; }
  .rvw-fab .rvw-count { background: #1d2622; color: #fff; border: 1px solid rgba(255,255,255,.25); }
  .rvw-on .rvw-add { background: #e5484d; color: #fff; }
  .rvw-hint { position: fixed; left: 50%; top: 64px; transform: translateX(-50%); z-index: 9000; background: #e5484d; color: #fff; padding: 8px 14px; border-radius: 999px; font: 600 13px Inter, system-ui, sans-serif; box-shadow: 0 4px 18px rgba(0,0,0,.45); pointer-events: none; }
  .rvw-on, .rvw-on * { cursor: crosshair !important; }
  .rvw-target { outline: 3px solid #f5c542 !important; outline-offset: 2px; }
  .rvw-pin { position: absolute; z-index: 8000; width: 24px; height: 24px; margin: -18px 0 0 -12px; border-radius: 50% 50% 50% 4px; border: 2px solid #1a1a1a; background: #f5c542; color: #1a1a1a; font: 700 12px/20px Inter, system-ui, sans-serif; text-align: center; padding: 0; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.5); }
  .rvw-pin.done { background: #7fd1a5; opacity: .75; }
  .rvw-sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 9100; max-height: 72vh; overflow: auto; background: #151c19; color: #f2f2ee; border-top: 1px solid rgba(255,255,255,.2); border-radius: 16px 16px 0 0; padding: 16px 16px 20px; font: 14px/1.5 Inter, system-ui, sans-serif; box-shadow: 0 -10px 40px rgba(0,0,0,.6); }
  .rvw-sheet > div { max-width: 720px; margin: 0 auto; }
  .rvw-sheet h4 { margin: 0 0 4px; font: 600 15px Inter, system-ui, sans-serif; }
  .rvw-sheet .rvw-where { color: #a9b3ad; font-size: 12.5px; margin: 0 0 10px; overflow-wrap: anywhere; }
  .rvw-sheet textarea { width: 100%; min-height: 96px; box-sizing: border-box; border-radius: 10px; border: 1px solid rgba(255,255,255,.25); background: #0e1311; color: #fff; padding: 10px; font: 16px/1.45 Inter, system-ui, sans-serif; }
  .rvw-row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
  .rvw-sheet button { border: 1px solid rgba(255,255,255,.25); border-radius: 999px; background: transparent; color: #fff; padding: 8px 14px; font: 600 13px Inter, system-ui, sans-serif; cursor: pointer; }
  .rvw-sheet button.rvw-main { background: #f5c542; border-color: #f5c542; color: #1a1a1a; }
  .rvw-item { border-top: 1px solid rgba(255,255,255,.12); padding: 10px 0; }
  .rvw-item.done p { text-decoration: line-through; opacity: .6; }
  .rvw-item p { margin: 0 0 4px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .rvw-item small { color: #a9b3ad; }
  .rvw-item .rvw-row { justify-content: flex-start; margin-top: 6px; }
  .rvw-item .rvw-row button { padding: 5px 11px; font-size: 12px; }`;
  document.head.append(Object.assign(document.createElement("style"), { textContent: css }));

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const mine = e => e.closest && e.closest(".rvw-fab, .rvw-sheet, .rvw-pin, .rvw-hint");
  const api = (path, body) => fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}).then(r => r.json());

  let items = [], picking = false, target = null, sheet = null;
  const fab = el("div", "rvw-fab", `<button class="rvw-count" hidden></button><button class="rvw-add">Comment</button>`);
  const hint = el("div", "rvw-hint", "Tap the part you want to comment on"); hint.hidden = true;
  const pins = el("div", "rvw-pins");
  document.body.append(pins, hint, fab);
  const addBtn = fab.querySelector(".rvw-add"), countBtn = fab.querySelector(".rvw-count");

  // A selector that survives a reload: nearest id, then tag:nth-of-type steps down to the element.
  function selectorOf(e) {
    const parts = [];
    while (e && e.nodeType === 1 && e !== document.body) {
      if (e.id) { parts.unshift("#" + CSS.escape(e.id)); break; }
      const same = [...e.parentElement.children].filter(c => c.tagName === e.tagName);
      parts.unshift(e.tagName.toLowerCase() + (same.length > 1 ? `:nth-of-type(${same.indexOf(e) + 1})` : ""));
      e = e.parentElement;
    }
    return parts.join(" > ");
  }
  const sectionOf = e => { const s = e.closest("section[id], header[id], footer[id]"); const h = s && s.querySelector("h1, h2"); return s ? (h ? h.textContent.trim().slice(0, 60) : "#" + s.id) : "top of page"; };
  const snippetOf = e => (e.getAttribute("alt") || e.getAttribute("aria-label") || e.textContent || e.tagName).trim().replace(/\s+/g, " ").slice(0, 90);

  function setPicking(on) {
    picking = on; hint.hidden = !on;
    document.documentElement.classList.toggle("rvw-on", on);
    addBtn.textContent = on ? "Cancel" : "Comment";
    if (!on && target && !sheet) { target.classList.remove("rvw-target"); target = null; }
  }
  function closeSheet() { sheet && sheet.remove(); sheet = null; if (target) { target.classList.remove("rvw-target"); target = null; } }

  function compose(e) {
    closeSheet(); target = e; e.classList.add("rvw-target");
    sheet = el("div", "rvw-sheet", `<div><h4>New comment</h4><p class="rvw-where">${esc(sectionOf(e))} · “${esc(snippetOf(e))}”</p>
      <textarea placeholder="What should change here?"></textarea>
      <div class="rvw-row"><button class="rvw-cancel">Cancel</button><button class="rvw-main">Save comment</button></div></div>`);
    document.body.append(sheet);
    const ta = sheet.querySelector("textarea"); ta.focus();
    sheet.querySelector(".rvw-cancel").onclick = closeSheet;
    sheet.querySelector(".rvw-main").onclick = async () => {
      const text = ta.value.trim(); if (!text) return ta.focus();
      const body = { text, selector: selectorOf(e), section: sectionOf(e), snippet: snippetOf(e), width: innerWidth };
      try { items = await api("/__comments", body); closeSheet(); render(); }
      catch (err) { alert("Could not save the comment. Is the preview server running?"); }
    };
  }

  function list() {
    closeSheet();
    sheet = el("div", "rvw-sheet", `<div><h4>${items.length} comment${items.length === 1 ? "" : "s"}</h4>` + items.map(c =>
      `<div class="rvw-item${c.done ? " done" : ""}" data-id="${c.id}"><p><b>${c.id}.</b> ${esc(c.text)}</p><small>${esc(c.section)} · “${esc(c.snippet)}” · ${esc(c.time)}</small>
       <div class="rvw-row"><button data-a="go">Show</button><button data-a="done">${c.done ? "Reopen" : "Mark done"}</button><button data-a="del">Delete</button></div></div>`).join("") +
      `<div class="rvw-row"><button class="rvw-cancel">Close</button></div></div>`);
    document.body.append(sheet);
    sheet.querySelector(".rvw-cancel").onclick = closeSheet;
    sheet.addEventListener("click", async ev => {
      const b = ev.target.closest("button[data-a]"); if (!b) return;
      const id = +b.closest(".rvw-item").dataset.id, c = items.find(x => x.id === id);
      if (b.dataset.a === "go") { closeSheet(); jump(c); return; }
      if (b.dataset.a === "del" && !confirm(`Delete comment ${id}?`)) return;
      items = await api(b.dataset.a === "del" ? "/__comments/delete" : "/__comments/done", { id, done: !c.done });
      render(); if (items.length) list(); else closeSheet();
    });
  }
  const find = c => { try { return document.querySelector(c.selector); } catch (e) { return null; } };
  function jump(c) {
    const e = find(c); if (!e) return alert("That part of the page is not there any more.");
    e.scrollIntoView({ behavior: "smooth", block: "center" });
    e.classList.add("rvw-target"); setTimeout(() => e.classList.remove("rvw-target"), 2200);
  }

  function place() {
    for (const pin of pins.children) {
      const e = find(items.find(c => c.id === +pin.dataset.id) || {}), r = e && e.getBoundingClientRect();
      pin.hidden = !r || (!r.width && !r.height);
      if (!pin.hidden) { pin.style.left = Math.max(10, r.left + scrollX) + "px"; pin.style.top = (r.top + scrollY) + "px"; }
    }
  }
  function render() {
    pins.innerHTML = items.map(c => `<button class="rvw-pin${c.done ? " done" : ""}" data-id="${c.id}" title="${esc(c.text)}">${c.id}</button>`).join("");
    countBtn.hidden = !items.length; countBtn.textContent = `${items.filter(c => !c.done).length} open`;
    place();
  }

  addBtn.onclick = () => { closeSheet(); setPicking(!picking); };
  countBtn.onclick = () => { setPicking(false); sheet ? closeSheet() : list(); };
  pins.addEventListener("click", ev => { const p = ev.target.closest(".rvw-pin"); if (p) { setPicking(false); list(); sheet.querySelector(`[data-id="${p.dataset.id}"]`)?.scrollIntoView({ block: "center" }); } });
  // While picking, the page's own buttons, links and videos must not react.
  for (const type of ["click", "pointerdown", "mousedown", "touchstart"]) {
    document.addEventListener(type, ev => {
      if (!picking || mine(ev.target)) return;
      ev.stopPropagation(); if (ev.cancelable && type !== "touchstart") ev.preventDefault();
      if (type === "click") { const t = ev.target; setPicking(false); compose(t); }
    }, { capture: true, passive: false });
  }
  addEventListener("keydown", ev => { if (ev.key === "Escape") { setPicking(false); closeSheet(); } });
  addEventListener("resize", place); setInterval(place, 1200);
  api("/__comments").then(j => { items = j; render(); }).catch(() => fab.remove());
})();
