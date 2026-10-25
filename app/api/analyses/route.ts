import { connection } from "next/server";
import postgres from "postgres";
import { extractText, parseArticle, type Analysis, type Article, type Sentiment } from "@/lib/article";

const sql = postgres(process.env.DATABASE_URL ?? "", { transform: postgres.camel });

const PROMPT = `You analyze news articles. Return:
- summary: 2-3 plain sentences covering what happened, who is involved, and why it matters. Use only facts in the text. If the text is only a short snippet, summarize the snippet and do not invent details.
- sentiment: the overall tone of the news for a general reader. "positive" = good news, progress, or optimism. "negative" = harm, conflict, loss, or criticism. "neutral" = factual, routine, or mixed.`;

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
  },
  required: ["summary", "sentiment"],
  additionalProperties: false,
};

// GET /api/analyses — every stored analysis, newest first
export async function GET() {
  await connection();
  // ponytail: returns all rows; add limit/cursor pagination once there are hundreds
  const analyses = await sql<Analysis[]>`select * from analyses order by created_at desc`;
  return Response.json({ analyses });
}

// POST /api/analyses — body: Article. Summarizes + scores it, stores it, returns the analysis.
// 201 when newly created, 200 when this article was already analyzed (no second OpenAI call).
export async function POST(req: Request) {
  const article = parseArticle(await req.json().catch(() => null));
  if (!article) return Response.json({ error: "A valid article url and title are required" }, { status: 400 });

  const [existing] = await sql<Analysis[]>`select * from analyses where url = ${article.url}`;
  if (existing) return Response.json(existing);

  let result;
  try {
    result = await analyze(await articleText(article));
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Analysis failed, try again" }, { status: 502 });
  }

  const { url, title, description, source, imageUrl, publishedAt } = article; // content isn't stored
  // No-op update on conflict so a concurrent duplicate request still gets the stored row back.
  const [analysis] = await sql<Analysis[]>`
    insert into analyses ${sql({ url, title, description, source, imageUrl, publishedAt, ...result })}
    on conflict (url) do update set url = excluded.url
    returning *`;
  return Response.json(analysis, { status: 201 });
}

// GNews free tier only returns a ~200 char snippet, so try the full page first.
// ponytail: fetches a client-supplied http(s) URL server-side; fine on Vercel, add an SSRF allowlist on a private network.
async function articleText(a: Article) {
  const snippet = [a.title, a.description, a.content].filter(Boolean).join("\n\n");
  try {
    const res = await fetch(a.url, {
      signal: AbortSignal.timeout(5000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; Newsbrief/1.0)" },
    });
    const text = res.ok ? extractText(await res.text()) : "";
    return text.length > snippet.length ? `${a.title}\n\n${text.slice(0, 12_000)}` : snippet;
  } catch {
    return snippet;
  }
}

async function analyze(text: string): Promise<{ summary: string; sentiment: Sentiment }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-nano",
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: text },
      ],
      response_format: { type: "json_schema", json_schema: { name: "analysis", strict: true, schema: SCHEMA } },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const { message } = (await res.json()).choices[0];
  if (!message.content) throw new Error(`OpenAI refusal: ${message.refusal}`);
  return JSON.parse(message.content);
}
