-- Add MinIO storage and usage tracking fields to docker_image
ALTER TABLE docker_image
  ADD COLUMN minio_path VARCHAR(500) COMMENT 'Path to image in MinIO storage',
  ADD COLUMN image_size_mb INT COMMENT 'Total image size in megabytes',
  ADD COLUMN pull_count INT DEFAULT 0 COMMENT 'Number of times pulled',
  ADD COLUMN last_pulled_at TIMESTAMP NULL COMMENT 'Last pull timestamp';

-- Add index on minio_path for faster lookups
CREATE INDEX idx_docker_image_minio_path ON docker_image(minio_path);

-- Add index on last_pulled_at for cleanup queries
CREATE INDEX idx_docker_image_last_pulled ON docker_image(last_pulled_at);
