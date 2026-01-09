UPDATE Machine 
SET imageRef = 'kalilinux/kali-desktop-xfce:latest',
    startupCommands = NULL
WHERE name = 'Attacker Workstation' 
AND imageRef LIKE '%kalilinux%';

SELECT id, name, imageRef, startupCommands
FROM Machine 
WHERE name = 'Attacker Workstation';
