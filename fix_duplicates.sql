-- Hapus kategori duplikat, simpan yang paling awal
DELETE FROM categories
WHERE id NOT IN (
  SELECT MIN(id) FROM categories GROUP BY user_id, name
);

DELETE FROM arsip_categories
WHERE id NOT IN (
  SELECT MIN(id) FROM arsip_categories GROUP BY user_id, name
);

-- Cegah duplikat di masa depan (skip jika constraint sudah ada)
DO $$ BEGIN
  ALTER TABLE categories ADD CONSTRAINT categories_user_name_unique UNIQUE (user_id, name);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE arsip_categories ADD CONSTRAINT arsip_cats_user_name_unique UNIQUE (user_id, name);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
