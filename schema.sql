create table if not exists analyses (
  id int generated always as identity primary key,
  url text not null unique, -- one analysis per article; re-requests return the stored row
  title text not null,
  description text,
  source text,
  image_url text,
  published_at timestamptz,
  summary text not null,
  sentiment text not null check (sentiment in ('positive', 'neutral', 'negative')),
  created_at timestamptz not null default now()
);
