"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { Analysis, Article, Sentiment } from "@/lib/article";
import { ArticleItem, SavedItem, SENTIMENTS, TONE } from "./components";

const TOPICS = ["climate", "interest rates", "artificial intelligence", "elections"];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

const countBy = (list: Analysis[], s: Sentiment) => list.filter((a) => a.sentiment === s).length;

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
  const [today, setToday] = useState("");
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
    if (inflight.current.has(article.url)) return; // a click and "Summarize all" can race on the same article
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
    setToday(new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
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

  const covered = articles?.flatMap((a) => byUrl.get(a.url) ?? []) ?? [];
  const kw = keyword.trim().toLowerCase();
  const saved = (analyses ?? []).filter(
    (a) => (filter === "all" || a.sentiment === filter) && (!kw || `${a.title} ${a.summary} ${a.source}`.toLowerCase().includes(kw)),
  );
  const idle = !articles && !searching;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <header className="pt-6">
        <div className="kicker flex justify-between gap-4 border-b border-rule pb-2 text-muted">
          <span>{today}&nbsp;</span>
          <span className="hidden sm:inline">Summaries and sentiment for the stories you choose</span>
        </div>
        <h1 className="py-5 text-center text-5xl font-semibold tracking-tight sm:py-7 sm:text-7xl">Newsbrief</h1>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            search(query);
          }}
          className="flex items-center gap-4 border-y-2 border-ink py-2"
        >
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
            maxLength={200}
            placeholder="Search the news"
            aria-label="Search the news"
            className="min-w-0 flex-1 bg-transparent py-1 text-xl outline-none placeholder:italic placeholder:text-muted"
          />
          <button disabled={searching} className="kicker hover:text-muted disabled:text-muted">
            {searching ? "Searching…" : "Search"}
          </button>
        </form>
        <p className="mt-2 text-sm italic text-muted">
          Try{" "}
          {TOPICS.map((t, i) => (
            <Fragment key={t}>
              {i > 0 && (i === TOPICS.length - 1 ? " or " : ", ")}
              <button onClick={() => search(t)} className="underline decoration-rule underline-offset-2 hover:text-ink hover:decoration-ink">
                {t}
              </button>
            </Fragment>
          ))}
          .
        </p>
      </header>

      <p aria-live="polite" className="sr-only">
        {searching ? "Searching" : articles ? `${articles.length} articles found` : ""}
      </p>

      <main className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="results-heading" className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b-2 border-ink pb-2">
            <h2 id="results-heading" className="kicker">
              {idle ? "Latest" : <>Results for “{searched}”</>}
            </h2>
            {!searching && (todo.length > 0 || pending.size > 0) && (
              <button
                onClick={analyzeAll}
                disabled={pending.size > 0 || !todo.length}
                className="kicker hover:text-muted disabled:text-muted"
              >
                {pending.size ? `Summarizing… ${pending.size + todo.length} left` : `Summarize all ${todo.length}`}
              </button>
            )}
          </div>

          {!searching && covered.length > 0 && (
            <p className="kicker mt-2 text-muted">
              Tone so far:{" "}
              {SENTIMENTS.map((s, i) => (
                <Fragment key={s}>
                  {i > 0 && " · "}
                  <span className={TONE[s]}>
                    {countBy(covered, s)} {s}
                  </span>
                </Fragment>
              ))}{" "}
              ({covered.length} of {articles?.length})
            </p>
          )}

          {error && (
            <p role="alert" className="mt-4 italic text-neg">
              {error}
            </p>
          )}

          {idle ? (
            <p className="mt-6 text-2xl leading-snug text-muted">Search a topic to see the latest coverage, then summarize the stories you care about.</p>
          ) : searching ? (
            <p className="mt-6 italic text-muted">Searching…</p>
          ) : !articles?.length ? (
            <p className="mt-6 italic text-muted">No recent articles for “{searched}”. Try broader keywords.</p>
          ) : (
            <ul className="divide-y divide-rule">
              {articles.map((a) => (
                <ArticleItem
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
        </section>

        <aside
          aria-labelledby="saved-heading"
          className={`min-w-0 lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100dvh-3rem)] lg:flex-col lg:self-start ${idle ? "order-first lg:order-none" : ""}`}
        >
          <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
            <h2 id="saved-heading" className="kicker">
              Saved
            </h2>
            {analyses && <span className="kicker text-muted">{analyses.length}</span>}
          </div>

          {analyses && analyses.length > 0 && (
            <>
              <div role="group" aria-label="Filter by sentiment" className="kicker mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {(["all", ...SENTIMENTS] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    aria-pressed={filter === f}
                    className={`kicker border-b pb-0.5 ${filter === f ? "border-ink" : "border-transparent text-muted hover:text-ink"}`}
                  >
                    {f === "all" ? `All ${analyses.length}` : <span className={filter === f ? TONE[f] : ""}>{`${f} ${countBy(analyses, f)}`}</span>}
                  </button>
                ))}
              </div>
              <input
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Filter saved"
                aria-label="Filter saved by keyword"
                className="mt-3 w-full border-b border-rule bg-transparent py-1.5 text-sm outline-none placeholder:italic placeholder:text-muted focus:border-ink"
              />
            </>
          )}

          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {!analyses ? (
              <p className="mt-4 italic text-muted">Loading…</p>
            ) : !analyses.length ? (
              <p className="mt-4 italic text-muted">Nothing saved yet. Every story you summarize is kept here.</p>
            ) : !saved.length ? (
              <p className="mt-4 italic text-muted">Nothing matches.</p>
            ) : (
              <ul className="divide-y divide-rule">
                {saved.map((a) => (
                  <SavedItem key={a.id} analysis={a} />
                ))}
              </ul>
            )}
            <p className="mt-6 border-t border-rule pt-3 text-xs italic leading-relaxed text-muted">
              Sentiment is the overall tone of a story for a general reader: positive for progress or good news, negative for harm,
              conflict, loss or criticism, neutral for factual or mixed coverage. Summaries and sentiment are generated by an AI model.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
