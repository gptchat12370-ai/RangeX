-- Clean up event participations with null userId
-- This fixes the "Player Unknown" issue

USE rangex_db;

-- Show current bad records
SELECT id, eventId, userId, teamId, participantType, totalPoints, registeredAt 
FROM event_participation 
WHERE participantType = 'player' AND userId IS NULL;

-- Delete participations where userId is NULL (invalid player registrations)
DELETE FROM event_participation 
WHERE participantType = 'player' AND userId IS NULL;

-- Verify cleanup
SELECT COUNT(*) as remaining_bad_records 
FROM event_participation 
WHERE participantType = 'player' AND userId IS NULL;

SELECT 'Cleanup complete! Please re-register for the event.' as status;
