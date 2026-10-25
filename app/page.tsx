"use client";

import { useEffect, useState } from "react";
import type { Analysis, Article, Sentiment } from "@/lib/article";

const FILTERS = ["all", "positive", "neutral", "negative"] as const;
const TONE: Record<Sentiment, string> = {
  positive: "bg-emerald-100 text-emerald-800",
  neutral: "bg-stone-200 text-stone-700",
  negative: "bg-rose-100 text-rose-800",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

const when = (d: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

const Badge = ({ sentiment }: { sentiment: Sentiment }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${TONE[sentiment]}`}>{sentiment}</span>
);

export default function Home() {
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [analyses, setAnalyses] = useState<Analysis[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  useEffect(() => {
    api<{ analyses: Analysis[] }>("/api/analyses")
      .then((d) => setAnalyses(d.analyses))
      .catch((e) => (setAnalyses([]), setError(e.message)));
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError("");
    try {
      setArticles((await api<{ articles: Article[] }>(`/api/articles?q=${encodeURIComponent(query)}`)).articles);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  // Adds a new analysis (if not already listed) and clears the filter so it's visible.
  function show(a: Analysis) {
    setAnalyses((prev) => (prev?.some((p) => p.id === a.id) ? prev : [a, ...(prev ?? [])]));
    setFilter("all");
  }

  const byUrl = new Map(analyses?.map((a) => [a.url, a]));
  const count = (f: (typeof FILTERS)[number]) => analyses?.filter((a) => f === "all" || a.sentiment === f).length ?? 0;
  const shown = analyses?.filter((a) => filter === "all" || a.sentiment === filter) ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Newsbrief</h1>
        <p className="text-sm text-stone-600">Search recent news, then get an AI summary and sentiment for the stories you care about.</p>
      </header>

      <form onSubmit={search} role="search" className="mb-6 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          required
          maxLength={200}
          placeholder='Search news, e.g. electric vehicles or "interest rates"'
          aria-label="Search news"
          className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 focus:border-stone-500 focus:outline-none"
        />
        <button disabled={searching} className="rounded-md bg-stone-900 px-4 py-2 font-medium text-white disabled:opacity-50">
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mb-6 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="results">
          <h2 id="results" className="mb-3 font-semibold">
            Results {articles && <span className="font-normal text-stone-500">({articles.length})</span>}
          </h2>
          {!articles ? (
            <p className="text-sm text-stone-500">Search a topic to see the latest articles.</p>
          ) : !articles.length ? (
            <p className="text-sm text-stone-500">No articles found. Try broader keywords.</p>
          ) : (
            <ul className="space-y-3">
              {articles.map((a) => (
                <ArticleCard key={a.url} article={a} analysis={byUrl.get(a.url)} onShow={show} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="analyses">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="analyses" className="font-semibold">Analyses</h2>
            <div role="group" aria-label="Filter by sentiment" className="flex gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className="rounded-full border border-stone-300 px-3 py-1 text-xs capitalize aria-pressed:border-stone-900 aria-pressed:bg-stone-900 aria-pressed:text-white"
                >
                  {f} {count(f)}
                </button>
              ))}
            </div>
          </div>
          {!analyses ? (
            <p className="text-sm text-stone-500">Loading…</p>
          ) : !shown.length ? (
            <p className="text-sm text-stone-500">
              {analyses.length ? "No analyses with this sentiment." : "Analyze an article and its summary will be saved here."}
            </p>
          ) : (
            <ul className="space-y-3">
              {shown.map((a) => (
                <li
                  key={a.id}
                  id={`analysis-${a.id}`}
                  className="scroll-mt-4 rounded-lg border border-stone-200 bg-white p-4 target:ring-2 target:ring-amber-400"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <Badge sentiment={a.sentiment} />
                    <span>
                      {a.source} · {when(a.publishedAt)}
                    </span>
                  </div>
                  <a href={a.url} target="_blank" rel="noreferrer" className="mt-2 block font-medium hover:underline">
                    {a.title}
                  </a>
                  <p className="mt-2 text-sm leading-relaxed text-stone-700">{a.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function ArticleCard({ article, analysis, onShow }: { article: Article; analysis?: Analysis; onShow: (a: Analysis) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    setPending(true);
    setError("");
    try {
      onShow(
        await api<Analysis>("/api/analyses", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(article),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="flex gap-4 rounded-lg border border-stone-200 bg-white p-4">
      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote hosts; next/image needs each one allowlisted
        <img src={article.imageUrl} alt="" loading="lazy" className="hidden h-20 w-28 shrink-0 rounded object-cover sm:block" />
      )}
      <div className="min-w-0 flex-1">
        <a href={article.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
          {article.title}
        </a>
        <p className="mt-1 text-xs text-stone-500">
          {article.source} · {when(article.publishedAt)}
        </p>
        {article.description && <p className="mt-1 line-clamp-2 text-sm text-stone-600">{article.description}</p>}
        <div className="mt-3 flex items-center gap-3">
          {analysis ? (
            <a href={`#analysis-${analysis.id}`} onClick={() => onShow(analysis)} className="flex items-center gap-2 text-sm hover:underline">
              <Badge sentiment={analysis.sentiment} /> View analysis
            </a>
          ) : (
            <button
              onClick={analyze}
              disabled={pending}
              className="rounded-md border border-stone-300 px-3 py-1 text-sm font-medium hover:bg-stone-100 disabled:opacity-50"
            >
              {pending ? "Analyzing…" : "Summarize & score"}
            </button>
          )}
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
