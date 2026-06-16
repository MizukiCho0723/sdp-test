-- 既存DB用マイグレーション: profiles.name を last_name / first_name に分割
-- 実行方法: sudo -u www-data sqlite3 /var/www/sns_data/db/OrderManage.db < db/migrate_split_name.sql
-- ※ 新規にinit.sqlで作成したDBには実行不要

ALTER TABLE profiles ADD COLUMN last_name TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN first_name TEXT DEFAULT '';

-- 旧nameカラム「姓 名」(半角スペース区切り)を分割してコピー
UPDATE profiles SET
    last_name  = CASE WHEN instr(name, ' ') > 0 THEN substr(name, 1, instr(name, ' ') - 1) ELSE name END,
    first_name = CASE WHEN instr(name, ' ') > 0 THEN substr(name, instr(name, ' ') + 1) ELSE '' END;

-- 旧nameカラムは互換のため残す(SQLite 3.35+なら以下で削除可能)
-- ALTER TABLE profiles DROP COLUMN name;
