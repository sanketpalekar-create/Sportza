-- Backfill: ensure existing users have isActive = true (already the column default,
-- but safe to run in case any rows pre-date the schema push)
UPDATE users SET isActive = true WHERE isActive IS NULL OR isActive = 0;
UPDATE users SET isActive = true WHERE role = 'admin';
