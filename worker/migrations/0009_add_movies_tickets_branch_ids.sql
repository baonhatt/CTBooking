-- Multi-branch targeting for movies and ticket_packages (v2 JSON approach)
--
-- - branch_ids IS NULL => applicable to all branches
-- - branch_ids = "[]" => not configured (admin warning)
-- - branch_ids = "[1,2,3]" => applicable only to selected branches

ALTER TABLE movies ADD COLUMN branch_ids TEXT;
ALTER TABLE ticket_packages ADD COLUMN branch_ids TEXT;

-- Backfill from legacy branch_id column
UPDATE movies
SET branch_ids = json_array(branch_id)
WHERE branch_id IS NOT NULL AND branch_ids IS NULL;

UPDATE ticket_packages
SET branch_ids = json_array(branch_id)
WHERE branch_id IS NOT NULL AND branch_ids IS NULL;

CREATE INDEX IF NOT EXISTS idx_movies_branch_ids ON movies (branch_ids);
CREATE INDEX IF NOT EXISTS idx_ticket_packages_branch_ids ON ticket_packages (branch_ids);
