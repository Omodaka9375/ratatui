// controls.ts — two-way DOM input ↔ knob wiring. Equality guards stop loops;
// the reverse binding means revert()/presets physically move the controls.
// Every disposer also removes the DOM event listeners it registered.
import { bind } from "./bind.js";
export function slider(el, k) {
    const onInput = (e) => k.set(parseFloat(e.target.value));
    el.addEventListener("input", onInput);
    const unbind = bind(k, (v) => v, (v) => { if (parseFloat(el.value) !== v)
        el.value = String(v); }, `ui:${k.label}`);
    return () => { el.removeEventListener("input", onInput); unbind(); };
}
export function textInput(el, k) {
    const onInput = (e) => k.set(e.target.value);
    el.addEventListener("input", onInput);
    const unbind = bind(k, (v) => v, (v) => { if (el.value !== v)
        el.value = v; }, `ui:${k.label}`);
    return () => { el.removeEventListener("input", onInput); unbind(); };
}
export function toggle(el, k) {
    const onChange = (e) => k.set(e.target.checked);
    el.addEventListener("change", onChange);
    const unbind = bind(k, (v) => v, (v) => { if (el.checked !== v)
        el.checked = v; }, `ui:${k.label}`);
    return () => { el.removeEventListener("change", onChange); unbind(); };
}
export function colorInput(el, k) {
    const onInput = (e) => k.set(e.target.value);
    el.addEventListener("input", onInput);
    const unbind = bind(k, (v) => v, (v) => { if (el.value !== v)
        el.value = v; }, `ui:${k.label}`);
    return () => { el.removeEventListener("input", onInput); unbind(); };
}
export function select(el, k) {
    const isNum = el.dataset.type === "number";
    const onChange = (e) => {
        const val = e.target.value;
        k.set(isNum ? parseFloat(val) || 0 : val);
    };
    el.addEventListener("change", onChange);
    const unbind = bind(k, (v) => v, (val) => {
        const strVal = String(val);
        if (isNum ? parseFloat(el.value) !== val : el.value !== strVal) {
            el.value = strVal;
        }
    }, `ui:${k.label}`);
    return () => { el.removeEventListener("change", onChange); unbind(); };
}
export function textarea(el, k) {
    const onInput = (e) => k.set(e.target.value);
    el.addEventListener("input", onInput);
    const unbind = bind(k, (v) => v, (val) => {
        if (el.value !== val)
            el.value = val;
    }, `ui:${k.label}`);
    return () => { el.removeEventListener("input", onInput); unbind(); };
}
export function numberInput(el, k) {
    const onInput = (e) => k.set(parseFloat(e.target.value) || 0);
    el.addEventListener("input", onInput);
    const unbind = bind(k, (v) => v, (val) => {
        if (parseFloat(el.value) !== val)
            el.value = String(val);
    }, `ui:${k.label}`);
    return () => { el.removeEventListener("input", onInput); unbind(); };
}
// editable(el, signal, editingSignal?) — inline editing of real page text.
export function editable(el, s, editing) {
    const onInput = () => s.set(el.textContent || "");
    el.addEventListener("input", onInput);
    const disposers = [
        bind(s, (v) => v, (v) => {
            if (el.textContent !== v)
                el.textContent = v;
        }, `ui:${s.label}`),
    ];
    if (editing) {
        disposers.push(bind(editing, Boolean, (on) => {
            try {
                el.contentEditable = on ? "plaintext-only" : "false";
            }
            catch {
                el.contentEditable = on ? "true" : "false";
            }
            el.classList.toggle("is-editable", on);
        }, `editable:${s.label}`));
    }
    return () => {
        el.removeEventListener("input", onInput);
        disposers.forEach((d) => d());
    };
}
// ── Media controls ────────────────────────────────────────────────────────────
// editableImg(el, signal, editing?) — editable image src.
// In edit mode: click to enter URL, or paste/drop an image (file → data URI, URL → URL).
// The signal holds the src string (URL or data URI).
export function editableImg(el, s, editing) {
    const disposers = [
        bind(s, (v) => v, (v) => { if (el.src !== v)
            el.src = v; }, `img:${s.label}`),
    ];
    // Paste handler: accepts image files or plain text URLs
    const onPaste = (e) => {
        const files = e.clipboardData?.files;
        if (files && files.length > 0 && files[0].type.startsWith("image/")) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = () => s.set(reader.result);
            reader.readAsDataURL(files[0]);
            return;
        }
        const text = e.clipboardData?.getData("text/plain")?.trim();
        if (text && /^https?:\/\/.+/i.test(text)) {
            e.preventDefault();
            s.set(text);
        }
    };
    // Drop handler: accepts image files
    const onDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer?.files[0];
        if (file && file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = () => s.set(reader.result);
            reader.readAsDataURL(file);
            return;
        }
        const text = e.dataTransfer?.getData("text/plain")?.trim();
        if (text && /^https?:\/\/.+/i.test(text))
            s.set(text);
    };
    const onDragover = (e) => e.preventDefault();
    // Click → prompt for URL
    const onClick = () => {
        const url = prompt("Image URL:", s.get());
        if (url !== null)
            s.set(url.trim());
    };
    const detachMediaListeners = () => {
        el.removeEventListener("click", onClick);
        el.removeEventListener("paste", onPaste);
        el.removeEventListener("drop", onDrop);
        el.removeEventListener("dragover", onDragover);
        el.removeAttribute("tabindex");
    };
    if (editing) {
        disposers.push(bind(editing, Boolean, (on) => {
            el.classList.toggle("rui-editable-media", on);
            if (on) {
                el.addEventListener("click", onClick);
                el.addEventListener("paste", onPaste);
                el.addEventListener("drop", onDrop);
                el.addEventListener("dragover", onDragover);
                el.setAttribute("tabindex", "0");
            }
            else {
                detachMediaListeners();
            }
        }, `editable-img:${s.label}`));
    }
    return () => {
        detachMediaListeners();
        el.classList.remove("rui-editable-media");
        disposers.forEach((d) => d());
    };
}
// editableVideo(el, signal, editing?) — editable video/embed src.
// In edit mode: click to enter URL. Handles YouTube/Vimeo URLs → embed conversion.
// Works with <video>, <iframe>, or any element with a src/data-src attribute.
export function editableVideo(el, s, editing) {
    const isIframe = el.tagName === "IFRAME";
    const isVideo = el.tagName === "VIDEO";
    const setSrc = (url) => {
        const embedUrl = toEmbedUrl(url);
        if (isIframe || isVideo) {
            if (el.src !== embedUrl)
                el.src = embedUrl;
        }
        else {
            // Generic element: use a child iframe
            let iframe = el.querySelector("iframe.rui-video-embed");
            if (!iframe) {
                iframe = document.createElement("iframe");
                iframe.className = "rui-video-embed";
                iframe.setAttribute("allowfullscreen", "");
                iframe.style.cssText = "width:100%;height:100%;border:none;border-radius:inherit;";
                el.appendChild(iframe);
            }
            if (iframe.src !== embedUrl)
                iframe.src = embedUrl;
        }
    };
    const disposers = [
        bind(s, (v) => v, setSrc, `video:${s.label}`),
    ];
    const onClick = () => {
        const url = prompt("Video URL (YouTube, Vimeo, or direct):", s.get());
        if (url !== null)
            s.set(url.trim());
    };
    // The actual media element that would swallow the click (iframes don't bubble
    // clicks to the parent — the player would start instead of opening the editor).
    const mediaEl = () => (isIframe || isVideo ? el : el.querySelector("iframe.rui-video-embed"));
    const detachVideoListeners = () => {
        el.removeEventListener("click", onClick);
        el.removeAttribute("tabindex");
        const m = mediaEl();
        if (m)
            m.style.pointerEvents = "";
    };
    if (editing) {
        disposers.push(bind(editing, Boolean, (on) => {
            el.classList.toggle("rui-editable-media", on);
            if (on) {
                el.addEventListener("click", onClick);
                el.setAttribute("tabindex", "0");
                // Let clicks fall through the player to the editable container.
                const m = mediaEl();
                if (m)
                    m.style.pointerEvents = "none";
            }
            else {
                detachVideoListeners();
            }
        }, `editable-video:${s.label}`));
    }
    return () => {
        detachVideoListeners();
        el.classList.remove("rui-editable-media");
        disposers.forEach((d) => d());
    };
}
// Convert YouTube/Vimeo watch URLs to embeddable URLs
function toEmbedUrl(url) {
    // YouTube: youtube.com/watch?v=ID, youtu.be/ID
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (ytMatch)
        return `https://www.youtube.com/embed/${ytMatch[1]}`;
    // Vimeo: vimeo.com/ID
    const vmMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vmMatch)
        return `https://player.vimeo.com/video/${vmMatch[1]}`;
    // Already an embed URL or direct video — pass through after validation.
    // Reject dangerous URL schemes (data:, javascript:, blob without http origin, etc.)
    const lower = url.trim().toLowerCase();
    if (/^(https?:)\/\//i.test(lower))
        return url;
    if (/^(data|javascript|blob|vbscript):/i.test(lower)) {
        console.warn(`[RatatUI] editableVideo: rejected dangerous URL scheme in "${url.slice(0, 80)}"`);
        return "";
    }
    // Unknown scheme — warn but pass through (e.g. ipfs://, magnet://)
    console.warn(`[RatatUI] editableVideo: unexpected URL scheme in "${url.slice(0, 80)}" — passed through`);
    return url;
}
