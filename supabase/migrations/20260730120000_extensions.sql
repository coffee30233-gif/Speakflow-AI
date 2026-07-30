-- ============================================================================
-- 0000: Extensions
-- ============================================================================
-- gen_random_uuid() 需要 pgcrypto（Supabase 專案預設通常已啟用，這裡用 IF NOT EXISTS 保險）
create extension if not exists pgcrypto;
