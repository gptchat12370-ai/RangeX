UPDATE Machine 
SET startupCommands = 'bash -c "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y tigervnc-standalone-server xfce4 xfce4-goodies dbus-x11 && mkdir -p ~/.vnc && echo password | vncpasswd -f > ~/.vnc/passwd && chmod 600 ~/.vnc/passwd && vncserver :0 -geometry 1280x720 -depth 24 && tail -f /dev/null"'
WHERE name = 'Attacker Workstation' 
AND imageRef LIKE '%kalilinux%';

SELECT id, name, imageRef, LEFT(startupCommands, 100) as startup_preview
FROM Machine 
WHERE name = 'Attacker Workstation';
