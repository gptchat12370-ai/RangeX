-- Use the correct kasmweb image that exists
UPDATE Machine 
SET imageRef = 'kasmweb/core-kali-rolling:1.16.1-rolling-weekly'
WHERE imageRef = 'kasmweb/kali-rolling-desktop:latest';

-- Show updated machines
SELECT id, name, imageRef
FROM Machine 
WHERE name = 'Attacker Workstation';
