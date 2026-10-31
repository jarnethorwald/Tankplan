-- Tankplan Update 2: geplante TSS, kJ und TP-Beschreibung werden mit gesichert.
-- In Supabase unter SQL Editor einfügen und einmal ausführen. Ohne diesen Schritt läuft die App trotzdem, sichert diese drei Felder aber nicht.
alter table plan add column if not exists tss numeric;
alter table plan add column if not exists kj numeric;
alter table plan add column if not exists descr text;
