// adapters.ts — persistence backends for commitBoundary.
//
// Token model: adapters accept a static token string OR a () => string getter.
// The getter is resolved per request, so a token can be entered at runtime
// (CMS bar) and never has to live in the HTML source.
import { CommitConflict } from "./commit.js";
const resolveToken = (t) => {
    const v = typeof t === "function" ? t() : t;
    return v ?? null;
};
// ── localStorage ──────────────────────────────────────────────────────────────
export function localAdapter(storageKey) {
    return {
        async load() {
            const raw = localStorage.getItem(storageKey);
            return raw ? JSON.parse(raw) : null;
        },
        async persist(snapshot, { version }) {
            const currentVersion = version ? parseInt(version, 10) : 0;
            const next = currentVersion + 1;
            localStorage.setItem(storageKey, JSON.stringify({ snapshot, version: String(next) }));
            return { version: String(next) };
        },
    };
}
// ── Generic REST (PUT with ETag) ──────────────────────────────────────────────
export function restAdapter(url, options = {}) {
    const { fetchImpl = fetch, headers = {}, token } = options;
    const hdrs = () => {
        const t = resolveToken(token);
        return t ? { ...headers, Authorization: `Bearer ${t}` } : { ...headers };
    };
    return {
        async load() {
            const res = await fetchImpl(url, { headers: hdrs() });
            if (res.status === 404)
                return null;
            if (!res.ok)
                throw new Error(`[RatatUI] load failed: ${res.status}`);
            return { snapshot: await res.json(), version: res.headers.get("ETag") };
        },
        async persist(snapshot, { version }) {
            const res = await fetchImpl(url, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...(version ? { "If-Match": version } : {}),
                    ...hdrs(),
                },
                body: JSON.stringify(snapshot),
            });
            if (res.status === 409 || res.status === 412) {
                const server = await res.json().catch(() => null);
                const etag = res.headers.get("ETag");
                throw new CommitConflict(server, etag);
            }
            if (!res.ok)
                throw new Error(`[RatatUI] persist failed: ${res.status}`);
            return { version: res.headers.get("ETag") };
        },
    };
}
// ── GitHub (commits a JSON file to a repo) ────────────────────────────────────
// Usage: githubAdapter({ owner: "you", repo: "site", path: "content/page.json", token: "ghp_..." })
// Token needs `repo` or `contents:write` scope — and is optional: public repos load
// unauthenticated, so a token is only required to publish (or to read private repos).
// Versioning uses the git blob SHA — if someone else commits between load and persist, GitHub
// returns 409 and we surface a CommitConflict.
export function githubAdapter(opts) {
    const { owner, repo, path, token, branch = "main", fetchImpl = fetch } = opts;
    const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const hdrs = () => {
        const h = {
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
        };
        const t = resolveToken(token);
        if (t)
            h.Authorization = `Bearer ${t}`;
        return h;
    };
    return {
        async load() {
            const res = await fetchImpl(`${api}?ref=${branch}`, { headers: hdrs() });
            if (res.status === 404)
                return null; // file doesn't exist yet
            if (!res.ok)
                throw new Error(`[RatatUI] github load: ${res.status}`);
            const json = await res.json();
            // content is base64-encoded
            const snapshot = JSON.parse(atob(json.content.replace(/\n/g, "")));
            return { snapshot, version: json.sha };
        },
        async persist(snapshot, { version }) {
            const body = {
                message: `[RatatUI] update ${path}`,
                content: btoa(JSON.stringify(snapshot, null, 2)),
                branch,
            };
            if (version)
                body.sha = version; // optimistic concurrency via blob SHA
            const res = await fetchImpl(api, { method: "PUT", headers: hdrs(), body: JSON.stringify(body) });
            if (res.status === 409 || res.status === 422) {
                // SHA mismatch — someone else pushed
                const current = await fetchImpl(`${api}?ref=${branch}`, { headers: hdrs() });
                if (current.ok) {
                    const j = await current.json();
                    const serverSnap = JSON.parse(atob(j.content.replace(/\n/g, "")));
                    throw new CommitConflict(serverSnap, j.sha);
                }
                throw new CommitConflict(null, null, "GitHub conflict — could not fetch current version");
            }
            if (!res.ok)
                throw new Error(`[RatatUI] github persist: ${res.status}`);
            const result = await res.json();
            return { version: result.content.sha };
        },
    };
}
// ── Cloudflare Workers KV ─────────────────────────────────────────────────────
// Points at a Worker URL that wraps KV. The worker is ~30 lines — see docs.
// Protocol: GET returns { snapshot, version }, PUT accepts JSON body,
// expects X-Version header, returns { version } or 409 on conflict.
// Token passed as Bearer auth — the Worker validates it.
export function cfAdapter(workerUrl, options = {}) {
    const { token, fetchImpl = fetch } = options;
    const hdrs = () => {
        const h = { "Content-Type": "application/json" };
        const t = resolveToken(token);
        if (t)
            h.Authorization = `Bearer ${t}`;
        return h;
    };
    return {
        async load() {
            const res = await fetchImpl(workerUrl, { headers: hdrs() });
            if (res.status === 404)
                return null;
            if (!res.ok)
                throw new Error(`[RatatUI] cf load: ${res.status}`);
            const data = await res.json();
            return { snapshot: data.snapshot, version: data.version ?? null };
        },
        async persist(snapshot, { version }) {
            const res = await fetchImpl(workerUrl, {
                method: "PUT",
                headers: { ...hdrs(), ...(version ? { "X-Version": version } : {}) },
                body: JSON.stringify(snapshot),
            });
            if (res.status === 409) {
                const server = await res.json().catch(() => null);
                throw new CommitConflict(server?.snapshot ?? null, server?.version ?? null);
            }
            if (!res.ok)
                throw new Error(`[RatatUI] cf persist: ${res.status}`);
            const result = await res.json();
            return { version: result.version ?? null };
        },
    };
}
// ── IPFS (via Pinata, web3.storage, or any pinning service) ───────────────────
// Publishes JSON snapshots as pins. Each publish creates a new CID (version).
// Load fetches the latest CID from a "pointer" endpoint (your API or DNS TXT).
// This is content-addressed — no conflict detection (last write wins).
//
// pointerUrl: GET returns { cid: "bafy..." }, PUT { cid } updates the pointer.
// gateway: IPFS gateway to fetch content (default: w3s.link).
export function ipfsAdapter(opts) {
    const { pinEndpoint, pointerUrl, gateway = "https://w3s.link/ipfs", token, fetchImpl = fetch, } = opts;
    const hdrs = () => {
        const h = { "Content-Type": "application/json" };
        const t = resolveToken(token);
        if (t)
            h.Authorization = `Bearer ${t}`;
        return h;
    };
    return {
        async load() {
            // 1. Get current CID from pointer
            const ptrRes = await fetchImpl(pointerUrl, { headers: hdrs() });
            if (ptrRes.status === 404)
                return null;
            if (!ptrRes.ok)
                throw new Error(`[RatatUI] ipfs pointer load: ${ptrRes.status}`);
            const { cid } = await ptrRes.json();
            if (!cid)
                return null;
            // 2. Fetch content from IPFS gateway
            const contentRes = await fetchImpl(`${gateway}/${cid}`);
            if (!contentRes.ok)
                throw new Error(`[RatatUI] ipfs fetch: ${contentRes.status}`);
            return { snapshot: await contentRes.json(), version: cid };
        },
        async persist(snapshot) {
            // ponytail: no conflict detection — IPFS is content-addressed, last write wins.
            // Upgrade path: compare CID at pointer before updating.
            // 1. Pin the content
            const pinRes = await fetchImpl(pinEndpoint, {
                method: "POST",
                headers: hdrs(),
                body: JSON.stringify(snapshot),
            });
            if (!pinRes.ok)
                throw new Error(`[RatatUI] ipfs pin: ${pinRes.status}`);
            const { cid } = await pinRes.json();
            // 2. Update pointer to new CID
            const ptrRes = await fetchImpl(pointerUrl, {
                method: "PUT",
                headers: hdrs(),
                body: JSON.stringify({ cid }),
            });
            if (!ptrRes.ok)
                throw new Error(`[RatatUI] ipfs pointer update: ${ptrRes.status}`);
            return { version: cid };
        },
    };
}
