import type { Analysis, Article, Sentiment } from "@/lib/article";

export const SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative"];
// Full literal class names so Tailwind can see them.
export const TONE: Record<Sentiment, string> = { positive: "text-pos", neutral: "text-neu", negative: "text-neg" };

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

function Byline({ parts }: { parts: React.ReactNode[] }) {
  const shown = parts.filter(Boolean);
  return (
    <p className="kicker text-muted">
      {shown.map((p, i) => (
        <span key={i}>
          {i > 0 && " · "}
          {p}
        </span>
      ))}
    </p>
  );
}

type ArticleItemProps = {
  article: Article;
  analysis?: Analysis;
  pending: boolean;
  error?: string;
  onAnalyze: () => void;
};

export function ArticleItem({ article, analysis, pending, error, onAnalyze }: ArticleItemProps) {
  return (
    <li className="py-6 first:pt-4">
      <div className="flex gap-5">
        <div className="min-w-0 flex-1">
          <Byline parts={[article.source, article.publishedAt && <Time iso={article.publishedAt} />]} />
          <h3 className="mt-1.5 text-xl font-semibold leading-snug tracking-tight">
            <a href={article.url} target="_blank" rel="noreferrer" className="decoration-1 underline-offset-4 hover:underline">
              {article.title}
            </a>
          </h3>
          {article.description && <p className="mt-1.5 line-clamp-3 leading-relaxed text-muted">{article.description}</p>}
        </div>
        {article.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote hosts; next/image needs each one allowlisted
          <img
            src={article.imageUrl}
            alt=""
            loading="lazy"
            onError={(e) => (e.currentTarget.hidden = true)}
            className="h-20 w-24 shrink-0 bg-rule object-cover sm:h-24 sm:w-36"
          />
        )}
      </div>

      {analysis ? (
        <div className="mt-4">
          <p className="kicker">
            <span className={TONE[analysis.sentiment]}>{analysis.sentiment}</span>
            <span className="text-muted"> · Summary</span>
          </p>
          <p className="mt-1 text-[1.0625rem] leading-relaxed">{analysis.summary}</p>
        </div>
      ) : pending ? (
        <p className="mt-4 italic text-muted" aria-busy="true">
          Reading the article…
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <button onClick={onAnalyze} className="kicker border-b border-ink pb-0.5 hover:border-muted hover:text-muted">
            {error ? "Retry" : "Summarize"}
          </button>
          {error && (
            <p role="alert" className="text-sm italic text-neg">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function SavedItem({ analysis: a }: { analysis: Analysis }) {
  return (
    <li className="py-4">
      <Byline
        parts={[<span key="s" className={TONE[a.sentiment]}>{a.sentiment}</span>, a.source, a.publishedAt && <Time iso={a.publishedAt} />]}
      />
      <a href={a.url} target="_blank" rel="noreferrer" className="mt-1 block font-semibold leading-snug decoration-1 underline-offset-4 hover:underline">
        {a.title}
      </a>
      <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink/80">{a.summary}</p>
    </li>
  );
}
