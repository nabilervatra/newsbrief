export type Sentiment = "positive" | "neutral" | "negative";

export type Article = {
  url: string;
  title: string;
  description: string | null;
  content: string | null;
  source: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
};

export type Analysis = Omit<Article, "content"> & {
  id: number;
  summary: string;
  sentiment: Sentiment;
  model: string;
  createdAt: string;
};

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

// Validates an article coming from the client. Returns null if unusable.
export function parseArticle(body: unknown): Article | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const url = str(b.url, 2000);
  const title = str(b.title, 500);
  if (!url || !title || !/^https?:\/\//i.test(url) || !URL.canParse(url)) return null;
  const imageUrl = str(b.imageUrl, 2000);
  const publishedAt = str(b.publishedAt, 50);
  return {
    url,
    title,
    description: str(b.description, 2000),
    content: str(b.content, 5000),
    source: str(b.source, 200),
    imageUrl: imageUrl && /^https?:\/\//i.test(imageUrl) ? imageUrl : null,
    publishedAt: publishedAt && !isNaN(Date.parse(publishedAt)) ? publishedAt : null,
  };
}

// GNews rejects unquoted special characters (covid-19, Apple's, AI?), so quote those words.
// Words already using quotes, parentheses or AND/OR/NOT pass through untouched.
export const toGNewsQuery = (q: string) =>
  q.trim().split(/\s+/).map((w) => (/[^\p{L}\p{N}_()"]/u.test(w) && !w.includes('"') ? `"${w}"` : w)).join(" ");

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// NOTE(shortcut): regex <p> scrape, misses JS-rendered/paywalled pages (caller falls back to the GNews snippet); upgrade is @mozilla/readability.
// Swap for @mozilla/readability if summary quality matters more than a dependency.
export function extractText(html: string): string {
  return [...html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").matchAll(/<p[\s>][\s\S]*?<\/p>/gi)]
    .map((m) =>
      m[0]
        .replace(/<[^>]+>/g, "")
        .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (e, c: string) =>
          c[0] !== "#" ? (ENTITIES[c] ?? e) : String.fromCodePoint(/x/i.test(c[1]) ? parseInt(c.slice(2), 16) : +c.slice(1)),
        )
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((p) => p.length > 40)
    .join("\n\n");
}
