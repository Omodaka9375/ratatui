// auto.ts — the zero-JavaScript layer.
//
// Annotate your HTML:
//   data-edit="headline"            → inline-editable text
//   data-edit-list="services"       → editable collection
//   data-edit-input="brandHue"      → bound control
//
// Include once:
//   <script type="module" src="…/src/auto.ts" data-ratatui-cms
import { knob, derive as computed, bind, editable, editableImg, editableVideo, list, draft, mode, scope, localAdapter, restAdapter, githubAdapter, cfAdapter, pinataAdapter, mountInspector, } from "./index.js";
const CSS = `
  .edit-only { display: none; }
  body[data-mode-editing="on"] .edit-only { display: revert; }
  .is-editable { outline: 2px dashed rgba(120,120,255,.55); outline-offset: 3px;
    border-radius: 2px; cursor: text; }
  .is-editable:focus { outline-style: solid; }
  .rui-cms-bar {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 9990;
    display: flex; align-items: center; gap: 8px; padding: 6px 12px;
    background: rgba(14,14,20,.92); backdrop-filter: blur(12px) saturate(1.5);
    color: #c8c8d4; font: 11px/1 ui-monospace, monospace;
    border-top: 1px solid rgba(255,255,255,.06);
    box-shadow: 0 -2px 20px rgba(0,0,0,.3);
  }
  .rui-cms-bar .grow { flex: 1; }
  .rui-cms-bar button {
    background: rgba(255,255,255,.06); color: #c8c8d4;
    border: 1px solid rgba(255,255,255,.08); border-radius: 6px;
    padding: 4px 10px; font: inherit; cursor: pointer;
    transition: all .15s;
  }
  .rui-cms-bar button:hover:not(:disabled) {
    background: rgba(255,255,255,.12); color: #fff;
  }
  .rui-cms-bar button:disabled { opacity: .25; cursor: not-allowed; }
  .rui-cms-bar .b-edit {
    background: rgba(99,102,241,.15); color: #a5b4fc;
    border-color: rgba(99,102,241,.25);
  }
  .rui-cms-bar .b-edit:hover { background: rgba(99,102,241,.3); color: #c7d2fe; }
  .rui-cms-bar .b-edit.active {
    background: rgba(99,102,241,.25); color: #e0e7ff;
    border-color: rgba(99,102,241,.4);
  }
  .rui-cms-bar .b-publish {
    background: rgba(16,185,129,.12); color: #6ee7b7;
    border-color: rgba(16,185,129,.2);
  }
  .rui-cms-bar .b-publish:hover:not(:disabled) {
    background: rgba(16,185,129,.25); color: #a7f3d0;
  }
  .rui-cms-status { font-size: 11px; }
  .rui-cms-status.dirty { color: #fbbf24; }
  .rui-cms-del { background: none; border: none; color: #b66; cursor: pointer;
    font-size: 15px; margin-left: 6px; padding: 2px 6px; border-radius: 4px;
    transition: background .15s; }
  .rui-cms-del:hover { background: rgba(187,102,102,.15); }
  .rui-cms-add {
    margin-top: 10px; padding: 5px 14px; border-radius: 6px;
    background: rgba(99,102,241,.1); color: #a5b4fc;
    border: 1px dashed rgba(99,102,241,.3); cursor: pointer;
    font: 11px/1 ui-monospace, monospace; transition: all .15s;
  }
  .rui-cms-add:hover { background: rgba(99,102,241,.2); border-style: solid; color: #c7d2fe; }
  [data-edit-input] { transition: opacity .2s; }
  [data-edit-input].rui-locked { opacity: .4; pointer-events: none; }
  .rui-cms-bar .b-token { display: inline-flex; align-items: center; gap: 6px; }
  .rui-cms-bar .b-token-input {
    background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
    color: #c8c8d4; border-radius: 6px; padding: 4px 8px; font: inherit; width: 150px;
  }
  .rui-cms-bar .b-token-input:focus { outline: none; border-color: rgba(99,102,241,.5); }
  .rui-cms-bar .b-token.flash .b-token-input { border-color: #fbbf24; box-shadow: 0 0 0 2px rgba(251,191,36,.25); }
  .rui-editable-media {
    outline: 2px dashed rgba(120,120,255,.55); outline-offset: 3px;
    border-radius: 4px; cursor: pointer; position: relative;
  }
  .rui-editable-media::after {
    content: '✎'; position: absolute; top: 6px; right: 6px;
    background: rgba(0,0,0,.7); color: #fff; font-size: 12px;
    padding: 2px 6px; border-radius: 4px; pointer-events: none;
  }
  .rui-editable-media:hover { outline-style: solid; }
`;
const ce = (e) => {
    try {
        e.el.contentEditable = e.on ? "plaintext-only" : "false";
    }
    catch {
        e.el.contentEditable = e.on ? "true" : "false";
    }
};
function resolveAdapter(opts, getStoredToken) {
    // Tokens come only from this browser's localStorage (entered via the CMS bar)
    // or a programmatic TokenSource getter passed to autocms(). They are never
    // read from HTML attributes. Resolved lazily per request.
    const ghToken = opts.ghToken || getStoredToken;
    const token = opts.token || getStoredToken;
    switch (opts.adapter) {
        case "github":
            if (!opts.ghOwner || !opts.ghRepo)
                throw new Error("[RatatUI CMS] github adapter requires data-gh-owner and data-gh-repo");
            return githubAdapter({
                owner: opts.ghOwner, repo: opts.ghRepo, path: opts.ghPath,
                token: ghToken, branch: opts.ghBranch,
            });
        case "cf":
            if (!opts.endpoint)
                throw new Error("[RatatUI CMS] cf adapter requires data-endpoint (Worker URL)");
            return cfAdapter(opts.endpoint, { token });
        case "ipfs":
        case "pinata":
            if (!opts.pinataName && !opts.name)
                throw new Error("[RatatUI CMS] pinata adapter requires data-pinata-name");
            return pinataAdapter({
                name: opts.pinataName || opts.name,
                jwt: token,
                gateway: opts.gateway,
            });
        case "rest":
            if (!opts.endpoint)
                throw new Error("[RatatUI CMS] rest adapter requires data-endpoint");
            return restAdapter(opts.endpoint, { token });
        default:
            if (opts.endpoint)
                return restAdapter(opts.endpoint, { token });
            return localAdapter(opts.storageKey);
    }
}
// ── DOM scanners (extracted from autocms) ──────────────────────────────────
function scanEditableText(signals, snap, isEditing, sc) {
    document.querySelectorAll("[data-edit]").forEach((el) => {
        const name = el.dataset.edit;
        if (!name)
            return;
        signals[name] = knob((snap?.[name] ?? el.textContent.trim()), name);
        sc.add(editable(el, signals[name], isEditing));
    });
}
function scanEditableImg(signals, snap, isEditing, sc) {
    document.querySelectorAll("[data-edit-img]").forEach((el) => {
        const name = el.dataset.editImg;
        if (!name)
            return;
        const defaultSrc = el.src || el.dataset.src || "";
        signals[name] = knob((snap?.[name] ?? defaultSrc), name);
        sc.add(editableImg(el, signals[name], isEditing));
    });
}
function scanEditableVideo(signals, snap, isEditing, sc) {
    document.querySelectorAll("[data-edit-video]").forEach((el) => {
        const name = el.dataset.editVideo;
        if (!name)
            return;
        const defaultSrc = el.src || el.dataset.src || "";
        signals[name] = knob((snap?.[name] ?? defaultSrc), name);
        sc.add(editableVideo(el, signals[name], isEditing));
    });
}
function scanEditableInput(signals, snap, editing, isEditing, sc) {
    // Inputs are locked for visitors and live in edit mode — the admin sets the value,
    // publishes it, and it loads for everyone.
    document.querySelectorAll("[data-edit-input]").forEach((input) => {
        const el = input;
        const name = el.dataset.editInput;
        if (!name)
            return;
        const cssVar = el.dataset.cssVar || null;
        const isNum = el.type === "range" || el.type === "number";
        const def = isNum ? parseFloat(el.value) || 0 : el.value;
        const s = (signals[name] = knob(snap?.[name] ?? def, name));
        const onInput = (e) => {
            if (editing.get() !== "on")
                return; // locked for visitors
            s.set(isNum ? parseFloat(e.target.value) || 0 : e.target.value);
        };
        el.addEventListener("input", onInput);
        sc.add(() => el.removeEventListener("input", onInput));
        sc.add(bind([s], (v) => v, (v) => {
            if (el.value !== String(v))
                el.value = String(v);
            if (cssVar)
                document.documentElement.style.setProperty(cssVar, String(v));
        }, `ui:${name}`));
        // Visually + functionally locked unless editing
        sc.add(bind([isEditing], (e) => e, (on) => {
            el.classList.toggle("rui-locked", !on);
        }, `lock:${name}`));
    });
}
function scanEditableAttr(signals, snap, sc) {
    document.querySelectorAll("[data-edit-attr]").forEach((el) => {
        el.dataset.editAttr.split(";").forEach((pair) => {
            const [attr, name] = pair.split(":").map((s) => s.trim());
            if (!attr || !name)
                return;
            const s = (signals[name] =
                signals[name] ?? knob(snap?.[name] ?? el.getAttribute(attr) ?? "", name));
            sc.add(bind([s], (v) => v, (v) => {
                if (el.getAttribute(attr) !== v)
                    el.setAttribute(attr, v);
            }, `attr:${name}→${attr}`));
        });
    });
}
function scanEditableList(signals, snap, isEditing, sc) {
    document.querySelectorAll("[data-edit-list]").forEach((container) => {
        const name = container.dataset.editList;
        if (!name)
            return;
        const existing = [...container.children].filter((c) => c.tagName !== "TEMPLATE");
        const tpl = [...container.children].find((c) => c.tagName === "TEMPLATE");
        const prototype = tpl ? tpl.content.firstElementChild : existing[0]?.cloneNode(true);
        if (!prototype)
            return console.warn(`[RatatUI CMS] list "${name}" has no items or template.`);
        const fieldsOf = (el) => {
            const o = {};
            el.querySelectorAll("[data-field]").forEach((f) => {
                const fieldEl = f;
                o[fieldEl.dataset.field] = fieldEl.dataset.type === "number"
                    ? parseFloat(fieldEl.textContent || "0") || 0 : fieldEl.textContent?.trim() || "";
            });
            return o;
        };
        const initial = snap?.[name] ?? existing.map((el, i) => ({ id: i + 1, ...fieldsOf(el) }));
        existing.forEach((el) => el.remove());
        const s = (signals[name] = knob(initial, name));
        sc.add(list(container, s, (item, row) => {
            const node = prototype.cloneNode(true);
            node.querySelectorAll("[data-field]").forEach((f) => {
                const fieldEl = f;
                const fname = fieldEl.dataset.field;
                const isNum = fieldEl.dataset.type === "number";
                row.bind([item], (t) => t[fname], (v) => {
                    if (fieldEl.textContent !== String(v))
                        fieldEl.textContent = String(v);
                }, `${name}.${fname}`);
                row.bind([isEditing], (e) => e, (on) => {
                    ce({ el: fieldEl, on });
                    fieldEl.classList.toggle("is-editable", on);
                }, `${name}.${fname}:mode`);
                const onFieldInput = () => {
                    const v = isNum ? parseFloat(fieldEl.textContent || "0") || 0 : fieldEl.textContent;
                    s.update((a) => a.map((t) => t.id === item.get().id ? { ...t, [fname]: v } : t));
                };
                fieldEl.addEventListener("input", onFieldInput);
                row.add(() => fieldEl.removeEventListener("input", onFieldInput));
            });
            const del = document.createElement("button");
            del.className = "rui-cms-del edit-only";
            del.textContent = "×";
            del.title = "Remove";
            const onDel = () => s.update((a) => a.filter((t) => t.id !== item.get().id));
            del.addEventListener("click", onDel);
            row.add(() => del.removeEventListener("click", onDel));
            node.appendChild(del);
            return node;
        }, { key: (t) => t.id, label: name }));
        const add = document.createElement("button");
        add.className = "rui-cms-add edit-only";
        add.textContent = "+ Add";
        add.addEventListener("click", () => {
            const blank = {};
            prototype.querySelectorAll("[data-field]").forEach((f) => {
                const fieldEl = f;
                blank[fieldEl.dataset.field] = fieldEl.dataset.type === "number" ? 0 : "New " + (fieldEl.dataset.field || "");
            });
            s.update((a) => [...a, { id: Date.now(), ...blank }]);
        });
        container.after(add);
        sc.add(() => add.remove());
    });
}
function buildCmsBar(editing, site, tokenCtl) {
    const disposers = [];
    const on = (el, event, fn) => {
        el.addEventListener(event, fn);
        disposers.push(() => el.removeEventListener(event, fn));
    };
    const bar = document.createElement("div");
    bar.className = "rui-cms-bar";
    const btnEdit = document.createElement("button");
    btnEdit.className = "b-edit";
    bar.appendChild(btnEdit);
    const grow = document.createElement("span");
    grow.className = "grow";
    bar.appendChild(grow);
    // ── token entry (remote adapters only) ──
    // The token lives only in this browser's localStorage — never in the HTML —
    // and is sent solely on load/publish requests for the configured backend.
    let tokenSpan = null;
    let tokenInput = null;
    if (tokenCtl) {
        tokenSpan = document.createElement("span");
        tokenSpan.className = "b-token";
        tokenInput = document.createElement("input");
        tokenInput.type = "password";
        tokenInput.className = "b-token-input";
        tokenInput.placeholder = "access token";
        tokenInput.autocomplete = "off";
        const saveBtn = document.createElement("button");
        saveBtn.textContent = "Save key";
        const stateBtn = document.createElement("button");
        const renderToken = () => {
            const has = tokenCtl.hasToken();
            tokenInput.style.display = has ? "none" : "";
            saveBtn.style.display = has ? "none" : "";
            stateBtn.style.display = has ? "" : "none";
            stateBtn.textContent = "🔑 key saved";
            stateBtn.title = "Token is stored only in this browser. Click to replace it.";
        };
        const store = () => {
            const v = tokenInput.value.trim();
            if (!v)
                return;
            try {
                localStorage.setItem(tokenCtl.tokenKey, v);
            }
            catch { /* storage unavailable */ }
            tokenInput.value = "";
            tokenSpan.classList.remove("flash");
            renderToken();
        };
        on(saveBtn, "click", store);
        on(tokenInput, "keydown", (e) => { if (e.key === "Enter")
            store(); });
        on(stateBtn, "click", () => {
            try {
                localStorage.removeItem(tokenCtl.tokenKey);
            }
            catch { /* storage unavailable */ }
            renderToken();
            tokenInput.focus();
        });
        tokenSpan.append(tokenInput, saveBtn, stateBtn);
        renderToken();
        bar.appendChild(tokenSpan);
    }
    const statusSpan = document.createElement("span");
    statusSpan.className = "rui-cms-status";
    bar.appendChild(statusSpan);
    const conflictSpan = document.createElement("span");
    conflictSpan.className = "b-conflict";
    conflictSpan.hidden = true;
    const btnTheirs = document.createElement("button");
    btnTheirs.className = "b-theirs";
    btnTheirs.textContent = "Take other version";
    const btnMine = document.createElement("button");
    btnMine.className = "b-mine";
    btnMine.textContent = "Keep mine";
    conflictSpan.appendChild(btnTheirs);
    conflictSpan.appendChild(btnMine);
    bar.appendChild(conflictSpan);
    const btnPublish = document.createElement("button");
    btnPublish.className = "b-publish";
    btnPublish.textContent = "Publish";
    bar.appendChild(btnPublish);
    const btnDiscard = document.createElement("button");
    btnDiscard.className = "b-discard";
    btnDiscard.textContent = "Discard";
    bar.appendChild(btnDiscard);
    const btnInspect = document.createElement("button");
    btnInspect.className = "b-inspect";
    btnInspect.title = "Inspector";
    btnInspect.textContent = "⚡";
    bar.appendChild(btnInspect);
    document.body.appendChild(bar);
    disposers.push(bind([editing], (v) => v === "on", (on) => {
        btnEdit.textContent = on ? "Done" : "Edit";
        btnEdit.classList.toggle("active", on);
    }, "→ cms:editbtn"));
    on(btnEdit, "click", () => editing.update((v) => (v === "on" ? "off" : "on")));
    on(btnPublish, "click", () => {
        // Guard: remote adapter without a token — point at the key field instead of failing with a 401.
        if (tokenCtl && !tokenCtl.hasToken()) {
            tokenSpan?.classList.add("flash");
            tokenInput?.focus();
            setTimeout(() => tokenSpan?.classList.remove("flash"), 1600);
            return;
        }
        site.save();
        editing.set("off");
    });
    on(btnDiscard, "click", () => { site.discard(); editing.set("off"); });
    on(btnTheirs, "click", () => site.acceptServer());
    on(btnMine, "click", () => site.forceMine());
    let insp = null;
    on(btnInspect, "click", () => {
        if (!insp) {
            insp = mountInspector();
            return;
        }
        insp.style.display = insp.style.display === "none" ? "" : "none";
    });
    disposers.push(bind([site.dirty, site.status], (d, st) => ({ d, st }), ({ d, st }) => {
        btnPublish.disabled = !d || st === "saving";
        btnDiscard.disabled = !d;
        statusSpan.textContent = st === "saving" ? "Publishing…"
            : st === "conflict" ? "Edited elsewhere —"
                : d ? "● Unpublished changes" : "Published ✓";
        statusSpan.classList.toggle("dirty", d);
    }, "→ cms:status", (a, b) => a.d === b.d && a.st === b.st));
    disposers.push(bind([site.conflict], (c) => !!c, (has) => { conflictSpan.hidden = !has; }, "→ cms:conflict"));
    return () => {
        disposers.forEach((d) => d());
        insp?.remove();
        bar.remove();
    };
}
// ── main entry ─────────────────────────────────────────────────────────────
export async function autocms(userOptions = {}) {
    const tag = document.querySelector("script[data-ratatui-cms]");
    const opts = {
        adapter: tag?.dataset.adapter || null,
        endpoint: tag?.dataset.endpoint || null,
        storageKey: tag?.dataset.storageKey || "ratatui:autocms",
        gate: tag?.dataset.gate || "hash",
        ghOwner: tag?.dataset.ghOwner || null,
        ghRepo: tag?.dataset.ghRepo || null,
        ghPath: tag?.dataset.ghPath || "content/page.json",
        ghToken: null, // data-gh-token is not read — tokens never come from HTML
        ghBranch: tag?.dataset.ghBranch || "main",
        token: null, // data-token is not read — tokens never come from HTML
        pinataName: tag?.dataset.pinataName || null,
        gateway: tag?.dataset.gateway || undefined,
        ...userOptions,
    };
    // Deprecated: tokens embedded in HTML are a secret leak — the attribute is ignored.
    if (tag?.dataset.token || tag?.dataset.ghToken) {
        console.warn("[RatatUI CMS] data-token / data-gh-token are no longer supported and are ignored. " +
            "Enter the token once via the CMS bar key field instead — it is stored only in your browser.");
    }
    const rootScope = scope("autocms");
    // Inject CMS styles
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    rootScope.add(() => style.remove());
    // Token storage: kept in this browser's localStorage, namespaced per site key.
    const tokenKey = `${opts.storageKey}:token`;
    const getStoredToken = () => {
        try {
            return localStorage.getItem(tokenKey);
        }
        catch {
            return null;
        }
    };
    // Load persisted state
    const store = resolveAdapter(opts, getStoredToken);
    let published = null;
    try {
        published = await store.load();
    }
    catch (e) {
        console.warn("[RatatUI CMS] load failed — starting from HTML defaults.", e);
    }
    const snap = published?.snapshot ?? null;
    // Scan DOM for editable annotations
    const signals = {};
    const editing = rootScope.own(mode("editing", "off"));
    const isEditing = rootScope.own(computed([editing], (v) => v === "on", "isEditing"));
    scanEditableText(signals, snap, isEditing, rootScope);
    scanEditableImg(signals, snap, isEditing, rootScope);
    scanEditableVideo(signals, snap, isEditing, rootScope);
    scanEditableInput(signals, snap, editing, isEditing, rootScope);
    scanEditableAttr(signals, snap, rootScope);
    scanEditableList(signals, snap, isEditing, rootScope);
    // User extension hook
    const ctx = { editing, isEditing, snapshot: snap, adapter: store };
    if (opts.extend)
        await opts.extend(signals, ctx);
    // Own all scanned signals so dispose() cleans them up
    for (const s of Object.values(signals))
        rootScope.own(s);
    // Draft + persistence
    const site = draft(signals, store.persist, {
        version: published?.version ?? null, label: "site",
    });
    rootScope.add(() => site.dispose());
    // CMS bar (gated). The hash gate is a UX convenience — not a security boundary.
    // Remote adapters still require a token to persist changes (see Publish guard below).
    const gated = opts.gate === "always" || /#edit(\b|$)/.test(location.hash);
    if (gated) {
        const remoteAdapters = ["github", "cf", "ipfs", "pinata", "rest"];
        const isRemote = opts.adapter ? remoteAdapters.includes(opts.adapter) : !!opts.endpoint;
        if (!isRemote && opts.gate === "hash") {
            console.warn("[RatatUI CMS] Using localAdapter with the #edit hash gate. " +
                "Anyone who discovers the URL can modify and persist content. " +
                "For production, use a remote adapter (github, rest, cf, pinata) with a token.");
        }
        const tokenCtl = isRemote
            ? { tokenKey, hasToken: () => !!(opts.token || opts.ghToken || getStoredToken()) }
            // note: opts.token/ghToken can only be a programmatic getter — HTML attrs are ignored
            : undefined;
        rootScope.add(buildCmsBar(editing, site, tokenCtl));
    }
    const api = {
        signals, draft: site, editing, isEditing, adapter: store,
        dispose: () => rootScope.dispose(),
    };
    if (opts.ready)
        opts.ready(api);
    return api;
}
if (typeof document !== "undefined" && document.querySelector("script[data-ratatui-cms]")) {
    (document.readyState === "loading")
        ? document.addEventListener("DOMContentLoaded", () => autocms())
        : autocms();
}
