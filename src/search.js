import { normalizeBaseUrl } from "./util.js";

export async function searxngSearch({ baseUrl, query, language, safeSearch, categories, maxResults, timeoutMs }) {
  const b = normalizeBaseUrl(baseUrl);
  if (!b) throw new Error("search.baseUrl is required");
  if (!query || !String(query).trim()) throw new Error("query is required");

  const url = new URL(`${b}/search`);
  url.searchParams.set("q", String(query));
  url.searchParams.set("format", "json");
  if (categories) url.searchParams.set("categories", String(categories));
  if (language) url.searchParams.set("language", String(language));
  if (safeSearch !== undefined && safeSearch !== null) url.searchParams.set("safesearch", String(safeSearch));

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), Number(timeoutMs || 10000));
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`SearxNG HTTP ${res.status}`);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    const results = Array.isArray(json.results) ? json.results : [];
    const limited = results.slice(0, clampInt(maxResults, 1, 20));
    return limited.map((r) => ({
      title: String(r?.title || ""),
      url: String(r?.url || ""),
      content: String(r?.content || ""),
      engine: String(r?.engine || ""),
      imgSrc: String(r?.img_src || r?.thumbnail_src || r?.image || "")
    }));
  } finally {
    clearTimeout(to);
  }
}

export async function searxngImageSearch({ baseUrl, query, language, safeSearch, maxResults, timeoutMs }) {
  const results = await searxngSearch({
    baseUrl,
    query,
    language,
    safeSearch,
    categories: "images",
    maxResults,
    timeoutMs
  });
  return results
    .map((r) => ({
      title: r.title,
      pageUrl: r.url,
      imageUrl: r.imgSrc || "",
      engine: r.engine
    }))
    .filter((r) => r.imageUrl);
}

function clampInt(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}
