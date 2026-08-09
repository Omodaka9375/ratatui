// adapters.ts — persistence backends for commitBoundary.
//
// Token model: adapters accept a static token string OR a () => string getter.
// The getter is resolved per request, so a token can be entered at runtime
// (CMS bar) and never has to live in the HTML source.

import { CommitConflict } from "./commit.js";

export interface Adapter {
  load(): Promise<{ snapshot: any; version: string | null } | null>;
  persist: (snapshot: any, context: { version: string | null; label: string }) => Promise<{ version?: string | null }>;
}

/** A static token or a lazy getter resolved per request. */
export type TokenSource = string | (() => string | null | undefined);

const resolveToken = (t?: TokenSource): string | null => {
  const v = typeof t === "function" ? t() : t;
  return v ?? null;
};

// ── localStorage ──────────────────────────────────────────────────────────────

export function localAdapter(storageKey: string): Adapter {
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

export function restAdapter(
  url: string,
  options: { fetchImpl?: typeof fetch; headers?: Record<string, string>; token?: TokenSource } = {}
): Adapter {
  const { fetchImpl = fetch, headers = {}, token } = options;
  const hdrs = (): Record<string, string> => {
    const t = resolveToken(token);
    return t ? { ...headers, Authorization: `Bearer ${t}` } : { ...headers };
  };

  return {
    async load() {
      const res = await fetchImpl(url, { headers: hdrs() });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`[RatatUI] load failed: ${res.status}`);
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
      if (!res.ok) throw new Error(`[RatatUI] persist failed: ${res.status}`);
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

export function githubAdapter(opts: {
  owner: string;
  repo: string;
  path: string;
  token?: TokenSource;
  branch?: string;
  fetchImpl?: typeof fetch;
}): Adapter {
  const { owner, repo, path, token, branch = "main", fetchImpl = fetch } = opts;
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const hdrs = (): Record<string, string> => {
    const h: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };
    const t = resolveToken(token);
    if (t) h.Authorization = `Bearer ${t}`;
    return h;
  };

  return {
    async load() {
      const res = await fetchImpl(`${api}?ref=${branch}`, { headers: hdrs() });
      if (res.status === 404) return null; // file doesn't exist yet
      if (!res.ok) throw new Error(`[RatatUI] github load: ${res.status}`);
      const json = await res.json();
      // content is base64-encoded
      const snapshot = JSON.parse(atob(json.content.replace(/\n/g, "")));
      return { snapshot, version: json.sha };
    },
    async persist(snapshot, { version }) {
      const body: any = {
        message: `[RatatUI] update ${path}`,
        content: btoa(JSON.stringify(snapshot, null, 2)),
        branch,
      };
      if (version) body.sha = version; // optimistic concurrency via blob SHA
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
      if (!res.ok) throw new Error(`[RatatUI] github persist: ${res.status}`);
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

export function cfAdapter(
  workerUrl: string,
  options: { token?: TokenSource; fetchImpl?: typeof fetch } = {}
): Adapter {
  const { token, fetchImpl = fetch } = options;
  const hdrs = (): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const t = resolveToken(token);
    if (t) h.Authorization = `Bearer ${t}`;
    return h;
  };

  return {
    async load() {
      const res = await fetchImpl(workerUrl, { headers: hdrs() });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`[RatatUI] cf load: ${res.status}`);
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
      if (!res.ok) throw new Error(`[RatatUI] cf persist: ${res.status}`);
      const result = await res.json();
      return { version: result.version ?? null };
    },
  };
}

// ── IPFS via Pinata Cloud (v3 API) ───────────────────────────────────────────
// Publishes JSON snapshots as public-IPFS uploads. The file `name` is the mutable
// pointer — load() lists files by name (newest first) and reads that CID from a
// gateway. Content-addressed, last-write-wins: no conflict detection.
//
// jwt: a Pinata JWT (Pinata App → API Keys). Needs files:read + files:write scopes.

const PINATA_UPLOADS = "https://uploads.pinata.cloud/v3";
const PINATA_API = "https://api.pinata.cloud/v3";

export function pinataAdapter(opts: {
  name: string;            // logical pointer name for this page's content (e.g. "home")
  jwt?: TokenSource;       // Pinata JWT — lazy getter keeps it out of the HTML
  gateway?: string;        // read gateway (default: https://gateway.pinata.cloud)
  network?: "public" | "private"; // upload network (default: public)
  fetchImpl?: typeof fetch;
}): Adapter {
  const {
    name, jwt, gateway = "https://gateway.pinata.cloud",
    network = "public", fetchImpl = fetch,
  } = opts;

  const authHdrs = (): Record<string, string> => {
    const t = resolveToken(jwt);
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  return {
    async load() {
      // 1. Latest file with this name on the target network (last-write-wins)
      const listRes = await fetchImpl(
        `${PINATA_API}/files/${network}?name=${encodeURIComponent(name)}&order=DESC&limit=1`,
        { headers: authHdrs() }
      );
      if (listRes.status === 404) return null;
      if (!listRes.ok) throw new Error(`[RatatUI] pinata list: ${listRes.status}`);
      const listData = await listRes.json();
      const file = listData?.data?.files?.[0];
      if (!file?.cid) return null;
      // 2. Fetch content by CID from the gateway
      const contentRes = await fetchImpl(`${gateway}/ipfs/${file.cid}`);
      if (!contentRes.ok) throw new Error(`[RatatUI] pinata fetch: ${contentRes.status}`);
      return { snapshot: await contentRes.json(), version: file.cid };
    },
    async persist(snapshot) {
      const form = new FormData();
      form.append("network", network);
      form.append("name", name);
      form.append(
        "file",
        new Blob([JSON.stringify(snapshot)], { type: "application/json" }),
        `${name}.json`
      );
      const res = await fetchImpl(`${PINATA_UPLOADS}/files`, {
        method: "POST",
        headers: authHdrs(), // no Content-Type — multipart boundary is set automatically
        body: form,
      });
      if (!res.ok) throw new Error(`[RatatUI] pinata upload: ${res.status}`);
      const data = await res.json();
      return { version: data?.data?.cid ?? null };
    },
  };
}

// Back-compat alias — the Pinata-backed IPFS adapter.
export const ipfsAdapter = pinataAdapter;
