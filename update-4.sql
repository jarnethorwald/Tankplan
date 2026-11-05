-- Tankplan Update 4: Gemüse und Obst können als „gegart“ markiert werden.
-- In Supabase unter SQL Editor einfügen und einmal ausführen. Ohne diesen Schritt läuft die App trotzdem,
-- speichert die Markierung „gegart“ aber nur auf diesem Gerät (nicht in Supabase).
alter table meals add column if not exists cook text;
