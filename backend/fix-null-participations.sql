-- Fix event participations with null userId
-- This removes old broken participation records
-- Database: rangex

USE rangex;

-- First, check table structure
SHOW TABLES LIKE 'event%';

-- Check columns in event_participation table
DESCRIBE event_participation;

-- See what we have with null userId
SELECT * FROM event_participation WHERE userId IS NULL AND participantType = 'player';

-- Delete participations where userId is null for player type
DELETE FROM event_participation WHERE userId IS NULL AND participantType = 'player';

-- Verify cleanup
SELECT COUNT(*) as total_participations FROM event_participation;
