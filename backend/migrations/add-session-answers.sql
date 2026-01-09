-- Add answers tracking and score fields to environment_session table

ALTER TABLE `environment_session`
ADD COLUMN `answers` JSON NULL AFTER `softLimitWarned`,
ADD COLUMN `score` INT NOT NULL DEFAULT 0 AFTER `answers`;
