-- ============================================================
-- WearList — Supabase Schema
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- Items (koleksi pakaian)
CREATE TABLE IF NOT EXISTS items (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  foto_url       TEXT,
  kategori       TEXT NOT NULL,
  catatan        TEXT,
  arsip          BOOLEAN DEFAULT FALSE,
  arsip_kategori TEXT,
  arsip_tanggal  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Kategori koleksi
CREATE TABLE IF NOT EXISTS categories (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kategori arsip
CREATE TABLE IF NOT EXISTS arsip_categories (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profil ukuran badan
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  tinggi     NUMERIC,
  berat      NUMERIC,
  dada       NUMERIC,
  pinggang   NUMERIC,
  pinggul    NUMERIC,
  lengan     NUMERIC,
  kaki       NUMERIC,
  sepatu     NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE arsip_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;

-- Policies: items
CREATE POLICY "items_select" ON items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "items_insert" ON items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "items_update" ON items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "items_delete" ON items FOR DELETE USING (auth.uid() = user_id);

-- Policies: categories
CREATE POLICY "cats_select" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cats_insert" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cats_delete" ON categories FOR DELETE USING (auth.uid() = user_id);

-- Policies: arsip_categories
CREATE POLICY "acats_select" ON arsip_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "acats_insert" ON arsip_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "acats_delete" ON arsip_categories FOR DELETE USING (auth.uid() = user_id);

-- Policies: profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Storage bucket untuk foto pakaian
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies: storage
CREATE POLICY "photos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

CREATE POLICY "photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "photos_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "photos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
