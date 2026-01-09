-- Fix existing teams without leaderId by copying from ownerUserId
UPDATE team 
SET leaderId = ownerUserId 
WHERE leaderId IS NULL AND ownerUserId IS NOT NULL;

-- Verify the update
SELECT id, name, leaderId, ownerUserId 
FROM team 
WHERE leaderId IS NOT NULL;
