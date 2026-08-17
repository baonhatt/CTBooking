-- Add branch targeting to posts and site_media (all-branches by default)
--
-- Strategy (v2 JSON approach):
-- - branch_ids IS NULL => applicable to all branches
-- - branch_ids is a JSON array string like "[1,2,3]" => applicable only to selected branches

ALTER TABLE posts ADD COLUMN branch_ids TEXT;
ALTER TABLE site_media ADD COLUMN branch_ids TEXT;

-- Optional indexes (SQLite can handle it; safe even if column is mostly NULL)
CREATE INDEX IF NOT EXISTS idx_posts_branch_ids ON posts (branch_ids);
CREATE INDEX IF NOT EXISTS idx_site_media_branch_ids ON site_media (branch_ids);

