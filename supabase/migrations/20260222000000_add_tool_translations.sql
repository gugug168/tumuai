-- Tool translations for multi-language UI/data rendering.
-- This table stores per-tool translated fields (currently used for English `/en`).

create table if not exists public.tool_translations (
  tool_id uuid not null references public.tools (id) on delete cascade,
  lang text not null,
  tagline text,
  description text,
  source_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (tool_id, lang),
  constraint tool_translations_lang_check check (lang in ('en'))
);

create index if not exists tool_translations_lang_idx on public.tool_translations (lang);

alter table public.tool_translations enable row level security;

-- Public read: allow the browser anon key to read translations.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tool_translations'
      and policyname = 'Public read tool translations'
  ) then
    create policy "Public read tool translations"
      on public.tool_translations
      for select
      using (true);
  end if;
end $$;

