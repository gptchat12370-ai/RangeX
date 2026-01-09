# Kali Linux with Xfce desktop and VNC access
# Based on consol/ubuntu-xfce-vnc pattern
FROM kalilinux/kali-rolling:latest

ENV REFRESHED_AT 2026-01-05
ENV DISPLAY=:1 \
    VNC_PORT=5901 \
    NO_VNC_PORT=6901 \
    VNC_COL_DEPTH=24 \
    VNC_RESOLUTION=1280x1024 \
    VNC_PW=vncpassword \
    VNC_VIEW_ONLY=false

# Install Xfce, VNC server, noVNC, and common cybersecurity tools
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        supervisor \
        xfce4 \
        xfce4-terminal \
        xfce4-goodies \
        tigervnc-standalone-server \
        tigervnc-common \
        novnc \
        websockify \
        net-tools \
        dbus-x11 \
        # Cybersecurity tools
        nmap \
        netcat-traditional \
        sqlmap \
        nikto \
        metasploit-framework \
        john \
        hydra \
        aircrack-ng \
        wireshark \
        tcpdump \
        curl \
        wget \
        git \
        vim \
        firefox-esr \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create user
RUN useradd -m -s /bin/bash kasm_user && \
    echo "kasm_user:password" | chpasswd && \
    mkdir -p /home/kasm_user/.vnc

# Setup VNC password
RUN mkdir -p /home/kasm_user/.vnc && \
    echo "$VNC_PW" | vncpasswd -f > /home/kasm_user/.vnc/passwd && \
    chmod 600 /home/kasm_user/.vnc/passwd && \
    chown -R kasm_user:kasm_user /home/kasm_user

# Create startup script
RUN mkdir -p /dockerstartup
COPY <<'EOF' /dockerstartup/vnc_startup.sh
#!/bin/bash
set -e

# Set VNC password
mkdir -p $HOME/.vnc
echo "$VNC_PW" | vncpasswd -f > $HOME/.vnc/passwd
chmod 600 $HOME/.vnc/passwd

# Start VNC server
vncserver :1 -geometry $VNC_RESOLUTION -depth $VNC_COL_DEPTH -SecurityTypes None -rfbport $VNC_PORT &

# Wait for VNC server to start
sleep 3

# Start noVNC
/usr/share/novnc/utils/novnc_proxy --vnc localhost:$VNC_PORT --listen $NO_VNC_PORT &

# Keep container running
tail -f /dev/null
EOF

RUN chmod +x /dockerstartup/vnc_startup.sh && \
    chown kasm_user:kasm_user /dockerstartup/vnc_startup.sh

# Expose ports
EXPOSE $VNC_PORT $NO_VNC_PORT

USER kasm_user
WORKDIR /home/kasm_user

CMD ["/dockerstartup/vnc_startup.sh"]
