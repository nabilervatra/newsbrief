import { cacheLife } from "next/cache";
import { toGNewsQuery, type Article } from "@/lib/article";

type GNewsArticle = {
  url: string;
  title: string;
  description: string | null;
  content: string | null;
  image: string | null;
  publishedAt: string | null;
  source?: { name?: string };
};

// GET /api/articles?q=... — search recent news (proxied so the GNews key stays server-side)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length > 200) return Response.json({ error: "Search query must be 1-200 characters" }, { status: 400 });
  try {
    const result = await search(toGNewsQuery(q));
    if ("error" in result) return Response.json({ error: `News search failed: ${result.error}` }, { status: 502 });
    return Response.json(result);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "News search failed, try again later" }, { status: 502 });
  }
}

// Cached (shared across serverless instances) so repeated searches don't burn the 100 requests/day GNews quota.
// Errors are returned, not thrown: Next redacts thrown messages in production, and the user should see "quota reached".
async function search(q: string): Promise<{ articles: Article[] } | { error: string }> {
  "use cache: remote";
  const params = new URLSearchParams({ q, lang: "en", max: "10", apikey: process.env.GNEWS_API_KEY ?? "" });
  const res = await fetch(`https://gnews.io/api/v4/search?${params}`);
  const data: { articles?: GNewsArticle[]; errors?: string[] | Record<string, string> } = await res.json().catch(() => ({}));
  if (!res.ok || !data.articles) {
    cacheLife("seconds"); // keep failures (quota, outage) for under a minute
    // GNews errors are {errors: [msg]} or {errors: {field: msg}}; both are safe to show (quota, bad query, bad key).
    return { error: Object.values(data.errors ?? {})[0] ?? `GNews returned ${res.status}` };
  }
  cacheLife({ revalidate: 900, expire: 3600 });
  return {
    articles: data.articles.map((a) => ({
      url: a.url,
      title: a.title,
      description: a.description,
      content: a.content,
      source: a.source?.name ?? null,
      imageUrl: a.image,
      publishedAt: a.publishedAt,
    })),
  };
}
