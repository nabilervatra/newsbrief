import type { Analysis, Article, Sentiment } from "@/lib/article";

export const SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative"];
const GLYPH: Record<Sentiment, string> = { positive: "▲", neutral: "●", negative: "▼" };
// Full literal class names so Tailwind can see them.
const BADGE: Record<Sentiment, string> = {
  positive: "bg-pos-soft text-pos-ink",
  neutral: "bg-neu-soft text-neu-ink",
  negative: "bg-neg-soft text-neg-ink",
};
const ACCENT: Record<Sentiment, string> = { positive: "border-l-pos", neutral: "border-l-neu", negative: "border-l-neg" };
const BAR: Record<Sentiment, string> = { positive: "bg-pos", neutral: "bg-neu", negative: "bg-neg" };
const INK: Record<Sentiment, string> = { positive: "text-pos-ink", neutral: "text-neu-ink", negative: "text-neg-ink" };

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const UNITS = [["day", 86400], ["hour", 3600], ["minute", 60]] as const;

export function Time({ iso }: { iso: string | null }) {
  if (!iso) return null;
  // eslint-disable-next-line react-hooks/purity -- relative time must read the clock; no React Compiler memoization here
  const secs = (Date.parse(iso) - Date.now()) / 1000;
  const unit = UNITS.find(([, s]) => Math.abs(secs) >= s);
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()}>
      {unit ? rtf.format(Math.round(secs / unit[1]), unit[0]) : "just now"}
    </time>
  );
}

export function Badge({ sentiment }: { sentiment: Sentiment }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${BADGE[sentiment]}`}>
      <span aria-hidden className="text-[0.55rem]">{GLYPH[sentiment]}</span>
      {sentiment}
    </span>
  );
}

export const Spinner = () => (
  <span aria-hidden className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
);

export function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={`size-4 ${className}`}>
      <circle cx="9" cy="9" r="6" />
      <path d="m14 14 4 4" strokeLinecap="round" />
    </svg>
  );
}

// Stacked share bar + legend. Segments keep a 2px gap; the legend carries glyph + count so color is never the only cue.
export function MoodBar({ analyses, label }: { analyses: Analysis[]; label: string }) {
  const count = (s: Sentiment) => analyses.filter((a) => a.sentiment === s).length;
  const summary = SENTIMENTS.map((s) => `${count(s)} ${s}`).join(", ");
  return (
    <figure>
      <figcaption className="mb-2 text-xs font-medium text-muted">{label}</figcaption>
      <div role="img" aria-label={summary} className="flex h-2.5 gap-0.5">
        {SENTIMENTS.filter(count).map((s) => (
          <div key={s} title={`${count(s)} ${s}`} className={`rounded ${BAR[s]}`} style={{ flexGrow: count(s) }} />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {SENTIMENTS.map((s) => (
          <span key={s}>
            <span aria-hidden className={`text-[0.55rem] ${INK[s]}`}>{GLYPH[s]}</span> {count(s)} {s}
          </span>
        ))}
      </p>
    </figure>
  );
}

function Summary({ analysis }: { analysis: Analysis }) {
  return (
    <div className={`mt-4 rounded-lg border border-l-4 border-line bg-bg p-3 ${ACCENT[analysis.sentiment]}`}>
      <div className="flex items-center gap-2">
        <Badge sentiment={analysis.sentiment} />
        <span className="text-xs text-muted">AI summary · saved</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed">{analysis.summary}</p>
    </div>
  );
}

function Analyzing() {
  return (
    <div className="mt-4 rounded-lg border border-line bg-bg p-3" aria-busy="true">
      <p className="flex items-center gap-2 text-xs text-muted">
        <Spinner /> Reading the article and analyzing…
      </p>
      <div className="mt-3 animate-pulse space-y-2">
        <div className="h-2.5 rounded bg-line" />
        <div className="h-2.5 w-11/12 rounded bg-line" />
        <div className="h-2.5 w-2/3 rounded bg-line" />
      </div>
    </div>
  );
}

type ArticleCardProps = {
  article: Article;
  analysis?: Analysis;
  pending: boolean;
  error?: string;
  onAnalyze: () => void;
};

export function ArticleCard({ article, analysis, pending, error, onAnalyze }: ArticleCardProps) {
  return (
    <li className="rounded-xl border border-line bg-surface p-4 transition-shadow hover:shadow-md hover:shadow-ink/5">
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            <span className="font-medium text-ink/80">{article.source}</span>
            {article.source && article.publishedAt && " · "}
            <Time iso={article.publishedAt} />
          </p>
          <a href={article.url} target="_blank" rel="noreferrer" className="mt-1 block font-semibold leading-snug hover:underline">
            {article.title}
          </a>
          {article.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{article.description}</p>}
        </div>
        {article.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote hosts; next/image needs each one allowlisted
          <img
            src={article.imageUrl}
            alt=""
            loading="lazy"
            onError={(e) => (e.currentTarget.hidden = true)}
            className="h-16 w-20 shrink-0 rounded-lg bg-line object-cover sm:h-20 sm:w-28"
          />
        )}
      </div>
      {analysis ? (
        <Summary analysis={analysis} />
      ) : pending ? (
        <Analyzing />
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={onAnalyze}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition-colors hover:border-ink/30 hover:bg-bg focus-visible:outline-2 focus-visible:outline-ink"
          >
            <span aria-hidden>✦</span> {error ? "Try again" : "Summarize & score"}
          </button>
          {error && (
            <p role="alert" className="text-sm text-neg-ink">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function AnalysisCard({ analysis: a }: { analysis: Analysis }) {
  return (
    <li className={`rounded-xl border border-l-4 border-line bg-surface p-4 ${ACCENT[a.sentiment]}`}>
      <div className="flex items-center justify-between gap-2">
        <Badge sentiment={a.sentiment} />
        <span className="text-xs text-muted">
          <Time iso={a.publishedAt} />
        </span>
      </div>
      <a href={a.url} target="_blank" rel="noreferrer" className="mt-2 block font-semibold leading-snug hover:underline">
        {a.title}
      </a>
      {a.source && <p className="mt-0.5 text-xs text-muted">{a.source}</p>}
      <p className="mt-2 text-sm leading-relaxed text-ink/90">{a.summary}</p>
    </li>
  );
}

export function SkeletonCard() {
  return (
    <li className="animate-pulse rounded-xl border border-line bg-surface p-4" aria-hidden>
      <div className="flex gap-4">
        <div className="flex-1 space-y-2.5">
          <div className="h-2.5 w-1/4 rounded bg-line" />
          <div className="h-3.5 w-11/12 rounded bg-line" />
          <div className="h-3.5 w-3/4 rounded bg-line" />
          <div className="h-2.5 w-full rounded bg-line" />
        </div>
        <div className="h-16 w-20 rounded-lg bg-line sm:h-20 sm:w-28" />
      </div>
    </li>
  );
}
