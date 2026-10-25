"use client";

import { useEffect, useRef, useState } from "react";
import type { Analysis, Article, Sentiment } from "@/lib/article";
import { AnalysisCard, ArticleCard, MoodBar, SENTIMENTS, SearchIcon, SkeletonCard, Spinner } from "./components";

const TOPICS = ["Artificial intelligence", "Climate", "Stock market", "Elections", "Space", "Health"];
const STEPS = [
  ["Search a topic", "The latest articles from thousands of sources."],
  ["Pick a story", "Hit “Summarize & score”, or analyze the whole page at once."],
  ["Get the gist", "A 2–3 sentence summary and the story’s tone, saved to your library."],
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [analyses, setAnalyses] = useState<Analysis[] | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | Sentiment>("all");
  const [keyword, setKeyword] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef("");
  const inflight = useRef(new Set<string>());

  async function search(raw: string) {
    const q = raw.trim();
    if (!q) return;
    latest.current = q;
    setQuery(q);
    setSearched(q);
    setSearching(true);
    setError("");
    history.replaceState(null, "", `?q=${encodeURIComponent(q)}`); // refresh / share keeps the search
    try {
      const { articles } = await api<{ articles: Article[] }>(`/api/articles?q=${encodeURIComponent(q)}`);
      if (latest.current === q) setArticles(articles); // ignore responses to superseded searches
    } catch (e) {
      if (latest.current === q) setError((e as Error).message);
    } finally {
      if (latest.current === q) setSearching(false);
    }
  }

  async function analyze(article: Article) {
    if (inflight.current.has(article.url)) return; // card click + "Analyze all" can race on the same article
    inflight.current.add(article.url);
    setPending((p) => new Set(p).add(article.url));
    setFailed((f) => ({ ...f, [article.url]: "" }));
    try {
      const a = await api<Analysis>("/api/analyses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(article),
      });
      setAnalyses((prev) => (prev?.some((p) => p.id === a.id) ? prev : [a, ...(prev ?? [])]));
    } catch (e) {
      setFailed((f) => ({ ...f, [article.url]: (e as Error).message }));
    } finally {
      inflight.current.delete(article.url);
      setPending((p) => {
        const next = new Set(p);
        next.delete(article.url);
        return next;
      });
    }
  }

  const byUrl = new Map(analyses?.map((a) => [a.url, a]));
  const todo = articles?.filter((a) => !byUrl.has(a.url) && !pending.has(a.url)) ?? [];

  async function analyzeAll() {
    const queue = [...todo];
    // 3 at a time: quick, without hammering publishers or OpenAI
    const worker = async () => {
      for (let a = queue.shift(); a; a = queue.shift()) await analyze(a);
    };
    await Promise.all([worker(), worker(), worker()]);
  }

  useEffect(() => {
    api<{ analyses: Analysis[] }>("/api/analyses")
      .then((d) => setAnalyses(d.analyses))
      .catch((e) => (setAnalyses([]), setError(e.message)));
    const q = new URLSearchParams(location.search).get("q");
    if (q) search(q); // restore a shared/refreshed search
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const topicAnalyses = articles?.flatMap((a) => byUrl.get(a.url) ?? []) ?? [];
  const kw = keyword.trim().toLowerCase();
  const library = (analyses ?? []).filter(
    (a) => (filter === "all" || a.sentiment === filter) && (!kw || `${a.title} ${a.summary} ${a.source}`.toLowerCase().includes(kw)),
  );
  const idle = !articles && !searching;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-5 sm:pb-8">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-ink text-sm font-bold text-bg">N</span>
            <span className="font-semibold tracking-tight">Newsbrief</span>
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">The news, summarized, with its tone at a glance.</h1>
          <p className="mt-1.5 text-muted">Search what’s happening, then get a short AI summary and sentiment for the stories you pick.</p>

          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              search(query);
            }}
            className="mt-5 flex gap-2"
          >
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={input}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                required
                maxLength={200}
                placeholder='Search news, e.g. electric vehicles or "interest rates"'
                aria-label="Search news"
                className="w-full rounded-lg border border-line bg-bg py-2.5 pl-9 pr-10 outline-none transition-colors placeholder:text-muted focus:border-ink/40 focus:bg-surface"
              />
              {!query && (
                <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-xs text-muted sm:block">
                  /
                </kbd>
              )}
            </div>
            <button
              disabled={searching}
              className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {searching && <Spinner />} Search
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Try</span>
            {TOPICS.map((t) => (
              <button
                key={t}
                onClick={() => search(t)}
                className="rounded-full border border-line px-3 py-1 transition-colors hover:border-ink/30 hover:bg-bg"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      <p aria-live="polite" className="sr-only">
        {searching ? "Searching" : articles ? `${articles.length} articles found` : ""}
      </p>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="results-heading" className="min-w-0">
          {error && (
            <p role="alert" className="mb-4 rounded-lg border border-neg/30 bg-neg-soft px-4 py-3 text-sm text-neg-ink">
              {error}
            </p>
          )}

          {idle ? (
            <>
              <h2 id="results-heading" className="sr-only">
                How it works
              </h2>
              <ol className="grid gap-3 sm:grid-cols-3">
                {STEPS.map(([title, text], i) => (
                  <li key={title} className="rounded-xl border border-line bg-surface p-4">
                    <span className="grid size-6 place-items-center rounded-full bg-bg text-xs font-semibold text-muted">{i + 1}</span>
                    <p className="mt-3 font-medium">{title}</p>
                    <p className="mt-1 text-sm text-muted">{text}</p>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="results-heading" className="text-lg font-semibold tracking-tight">
                    Latest on “{searched}”
                  </h2>
                  {articles && !searching && <p className="text-sm text-muted">{articles.length} articles, newest first</p>}
                </div>
                {!searching && (todo.length > 0 || pending.size > 0) && (
                  <button
                    onClick={analyzeAll}
                    disabled={pending.size > 0 || !todo.length}
                    className="inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {pending.size ? (
                      <>
                        <Spinner /> Analyzing… {pending.size + todo.length} left
                      </>
                    ) : (
                      <>
                        <span aria-hidden>✦</span> Analyze all {todo.length}
                      </>
                    )}
                  </button>
                )}
              </div>

              {!searching && topicAnalyses.length > 0 && (
                <div className="mb-4 rounded-xl border border-line bg-surface p-4">
                  <MoodBar
                    analyses={topicAnalyses}
                    label={`Tone of “${searched}” · ${topicAnalyses.length} of ${articles?.length} analyzed`}
                  />
                </div>
              )}

              {searching ? (
                <ul className="space-y-3">
                  {[0, 1, 2, 3].map((i) => (
                    <SkeletonCard key={i} />
                  ))}
                </ul>
              ) : !articles?.length ? (
                <div className="rounded-xl border border-dashed border-line p-8 text-center">
                  <p className="font-medium">No recent articles for “{searched}”</p>
                  <p className="mt-1 text-sm text-muted">Try broader keywords, or check the spelling.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {articles.map((a) => (
                    <ArticleCard
                      key={a.url}
                      article={a}
                      analysis={byUrl.get(a.url)}
                      pending={pending.has(a.url)}
                      error={failed[a.url]}
                      onAnalyze={() => analyze(a)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <aside
          aria-labelledby="library-heading"
          className={`min-w-0 lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100dvh-3rem)] lg:flex-col lg:self-start ${idle ? "order-first lg:order-none" : ""}`}
        >
          <div className="flex items-baseline justify-between">
            <h2 id="library-heading" className="text-lg font-semibold tracking-tight">
              Your library
            </h2>
            {analyses && <span className="text-sm text-muted">{analyses.length} saved</span>}
          </div>

          {analyses && analyses.length > 0 && (
            <div className="mt-3 space-y-3">
              <MoodBar analyses={analyses} label="Overall tone" />
              <div role="group" aria-label="Filter by sentiment" className="flex flex-wrap gap-1.5">
                {(["all", ...SENTIMENTS] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    aria-pressed={filter === f}
                    className="rounded-full border border-line px-3 py-1 text-xs capitalize transition-colors hover:border-ink/30 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
                  >
                    {f}
                  </button>
                ))}
              </div>
              <input
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Filter by keyword"
                aria-label="Filter library by keyword"
                className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none placeholder:text-muted focus:border-ink/40"
              />
            </div>
          )}

          <div className="mt-3 lg:-mx-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-1 lg:pb-2">
            {!analyses ? (
              <ul className="space-y-3">
                <SkeletonCard />
              </ul>
            ) : !analyses.length ? (
              <div className="rounded-xl border border-dashed border-line p-6 text-center">
                <p className="font-medium">Nothing saved yet</p>
                <p className="mt-1 text-sm text-muted">Every article you analyze lands here, so you can come back to it.</p>
              </div>
            ) : !library.length ? (
              <p className="py-6 text-center text-sm text-muted">No saved analyses match.</p>
            ) : (
              <ul className="space-y-3">
                {library.map((a) => (
                  <AnalysisCard key={a.id} analysis={a} />
                ))}
              </ul>
            )}

            <details className="mt-4 text-sm text-muted">
              <summary className="cursor-pointer select-none hover:text-ink">How is sentiment scored?</summary>
              <ul className="mt-2 space-y-1">
                <li>
                  <b className="text-pos-ink">▲ Positive</b>: good news, progress, optimism.
                </li>
                <li>
                  <b className="text-neu-ink">● Neutral</b>: factual, routine or mixed.
                </li>
                <li>
                  <b className="text-neg-ink">▼ Negative</b>: harm, conflict, loss or criticism.
                </li>
              </ul>
              <p className="mt-2">Judged by an AI model on the overall tone for a general reader, not on whether you’d agree.</p>
            </details>
          </div>
        </aside>
      </main>
    </div>
  );
}
