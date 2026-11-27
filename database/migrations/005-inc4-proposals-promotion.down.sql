DROP TABLE IF EXISTS social_links;
DROP TABLE IF EXISTS gallery_photos;
DROP TABLE IF EXISTS proposal_services;
DROP INDEX IF EXISTS ix_proposals_promotion_id;
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS chk_proposals_promotion_fields;
ALTER TABLE proposals DROP COLUMN IF EXISTS promotion_discount_snapshot;
ALTER TABLE proposals DROP COLUMN IF EXISTS promotion_description_snapshot;
ALTER TABLE proposals DROP COLUMN IF EXISTS promotion_name_snapshot;
ALTER TABLE proposals DROP COLUMN IF EXISTS promotion_id;
