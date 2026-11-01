-- Tankplan Update 3: Tabelle für das tägliche Körpergewicht.
-- In Supabase unter SQL Editor einfügen und einmal ausführen. Ohne diesen Schritt läuft die App trotzdem,
-- speichert die Gewichtswerte aber nur auf diesem Gerät (nicht in Supabase).
create table if not exists weights (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  day date not null,
  kg numeric not null,
  primary key (user_id, id)
);
alter table weights enable row level security;
drop policy if exists "weights_own" on weights;
create policy "weights_own" on weights for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
