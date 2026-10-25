# Newsbrief

Search recent news, pick the stories you care about, and get an AI summary plus a sentiment label (positive / neutral / negative) for each. Every analysis is saved to Postgres and shown in a filterable list.

**Live:** https://newsbrief-kappa.vercel.app

**Stack:** Next.js 16 (TypeScript, App Router) · PostgreSQL · GNews API · OpenAI · hosted on Vercel.

How it works and why it's built this way: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## How to use it

1. Type a topic (`electric vehicles`, `"interest rates"`, `covid-19`) and press **Search**. You get the 10 latest matching articles.
2. Click **Summarize & score** on any article. Newsbrief reads the full article, then saves a 2–3 sentence summary and a sentiment label.
3. The **Analyses** column lists everything you've analyzed, newest first. Filter it by sentiment. Search results you've already analyzed show their sentiment badge and a **View analysis** link instead of the button, so nothing is analyzed twice.

## Run locally

Requires Node 22+ and any PostgreSQL 14+.

```sh
npm install
cp .env.example .env.local        # then fill in the three values
psql "$DATABASE_URL" -f schema.sql   # once, creates the table
npm run dev                        # http://localhost:3000
```

| Variable | What |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI key |
| `GNEWS_API_KEY` | Free key from https://gnews.io (100 requests/day) |
| `DATABASE_URL` | Postgres connection string |
| `OPENAI_MODEL` | Optional, defaults to `gpt-4.1-nano` |

No Postgres at hand? Use a throwaway local cluster (Homebrew `postgresql@17`):

```sh
initdb -D .pgdata -U postgres --auth=trust
pg_ctl -D .pgdata -o "-p 5433 -k /tmp" -l .pgdata/server.log start
createdb -h localhost -p 5433 -U postgres newsbrief
# DATABASE_URL=postgres://postgres@localhost:5433/newsbrief
```

## Deploy to Vercel

1. Import the GitHub repo in Vercel (framework is auto-detected as Next.js).
2. **Storage → Create Database → Neon (Postgres)** and connect it to the project. This sets `DATABASE_URL`. Put the functions in the same region as the database (**Settings → Functions → Region**, e.g. both `iad1`). Otherwise every query crosses an ocean.
3. Run `psql "<that DATABASE_URL>" -f schema.sql` once.
4. Add `OPENAI_API_KEY` and `GNEWS_API_KEY` (and `OPENAI_MODEL` if needed) under **Settings → Environment Variables**, then redeploy.

## REST API

| Method & path | Purpose | Responses |
| --- | --- | --- |
| `GET /api/articles?q=` | Search recent news (GNews proxy) | `200 {articles: Article[]}` · `400` bad query · `502` GNews error (message passed through, e.g. quota) |
| `GET /api/analyses` | All saved analyses, newest first | `200 {analyses: Analysis[]}` |
| `POST /api/analyses` | Body: an `Article`. Summarize, score and save it | `201 Analysis` new · `200 Analysis` already analyzed (no LLM call) · `400` invalid article · `502` LLM failure |

Errors are always `{ "error": "message" }`. Types live in [`lib/article.ts`](lib/article.ts).

```jsonc
// Analysis
{ "id": 1, "url": "https://…", "title": "…", "description": "…", "source": "BBC News",
  "imageUrl": "https://…", "publishedAt": "2026-10-25T09:00:00.000Z",
  "summary": "…", "sentiment": "neutral", "createdAt": "2026-10-25T10:52:55.913Z" }
```

## Tests

```sh
npm test         # node:test unit tests for query building, input validation and article text extraction
npm run build    # type-check + production build
npm run lint
```
