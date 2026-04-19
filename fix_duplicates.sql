-- Hapus kategori duplikat, simpan yang paling awal
DELETE FROM categories
WHERE id NOT IN (
  SELECT MIN(id) FROM categories GROUP BY user_id, name
);

DELETE FROM arsip_categories
WHERE id NOT IN (
  SELECT MIN(id) FROM arsip_categories GROUP BY user_id, name
);

-- Cegah duplikat di masa depan
ALTER TABLE categories
  ADD CONSTRAINT categories_user_name_unique UNIQUE (user_id, name);

ALTER TABLE arsip_categories
  ADD CONSTRAINT arsip_cats_user_name_unique UNIQUE (user_id, name);
