-- Use valid Kali desktop image with VNC
UPDATE Machine 
SET imageRef = 'kasmweb/kali-rolling-desktop:latest'
WHERE imageRef = 'kalilinux/kali-desktop-xfce:latest';

-- Show updated machines
SELECT id, name, imageRef, startupCommands
FROM Machine 
WHERE name = 'Attacker Workstation';
