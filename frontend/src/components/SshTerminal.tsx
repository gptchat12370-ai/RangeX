import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { io, Socket } from 'socket.io-client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import 'xterm/css/xterm.css';

interface SshTerminalProps {
  sessionId: string;
  machineId: string;
  machineName: string;
  username?: string;
  password?: string;
  onClose?: () => void;
}

export const SshTerminal: React.FC<SshTerminalProps> = ({
  sessionId,
  machineId,
  machineName,
  username = 'root',
  password = 'changeme',
  onClose,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const socket = useRef<Socket | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal
    terminal.current = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      rows: 24,
      cols: 80,
    });

    fitAddon.current = new FitAddon();
    terminal.current.loadAddon(fitAddon.current);
    terminal.current.open(terminalRef.current);
    
    // Fit terminal to container
    setTimeout(() => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    }, 100);

    // Connect to SSH gateway
    terminal.current.writeln('\x1b[1;36m>>> Connecting to SSH gateway...\x1b[0m');
    
    // SECURITY FIX: Use session-scoped WebSocket endpoint instead of hardcoded localhost
    // Get base URL from window.location for production compatibility
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    const wsUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000/ssh' // Development fallback
      : `${wsProtocol}//${wsHost}:${wsPort}/ssh`; // Production
    
    socket.current = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      query: {
        sessionId, // Pass sessionId for server-side validation
      },
    });

    socket.current.on('connect', () => {
      terminal.current?.writeln('\x1b[1;32m>>> Connected to gateway\x1b[0m');
      terminal.current?.writeln(`\x1b[1;36m>>> Connecting to ${machineName}...\x1b[0m`);
      
      // Validate credentials before sending
      if (!sessionId || !machineId) {
        terminal.current?.writeln('\r\n\x1b[1;31m>>> Error: Invalid session or machine ID\x1b[0m\r\n');
        setError('Invalid connection parameters');
        return;
      }
      
      socket.current?.emit('ssh-connect', {
        sessionId,
        machineId,
        username: username || 'root',
        password: password || '',
      });
    });

    socket.current.on('ssh-ready', () => {
      terminal.current?.writeln('\x1b[1;32m>>> SSH connection established!\x1b[0m\r\n');
      setIsConnected(true);
      setError(null);
    });

    socket.current.on('ssh-data', (data: string) => {
      terminal.current?.write(data);
    });

    socket.current.on('ssh-error', (error: { message: string }) => {
      terminal.current?.writeln(`\r\n\x1b[1;31m>>> Error: ${error.message}\x1b[0m\r\n`);
      setError(error.message);
      setIsConnected(false);
    });

    socket.current.on('ssh-close', () => {
      terminal.current?.writeln('\r\n\x1b[1;33m>>> Connection closed\x1b[0m\r\n');
      setIsConnected(false);
    });

    socket.current.on('disconnect', () => {
      terminal.current?.writeln('\r\n\x1b[1;33m>>> Disconnected from gateway\x1b[0m\r\n');
      setIsConnected(false);
    });

    socket.current.on('connect_error', (err) => {
      terminal.current?.writeln(`\r\n\x1b[1;31m>>> Gateway connection error: ${err.message}\x1b[0m\r\n`);
      setError('Failed to connect to SSH gateway');
    });

    // Send terminal input to SSH
    terminal.current.onData((data) => {
      if (isConnected) {
        socket.current?.emit('ssh-data', data);
      }
    });

    // Handle window resize
    const handleResize = () => {
      if (fitAddon.current && terminal.current) {
        fitAddon.current.fit();
        socket.current?.emit('ssh-resize', {
          rows: terminal.current.rows,
          cols: terminal.current.cols,
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Resize observer for container changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      terminal.current?.dispose();
      socket.current?.disconnect();
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [sessionId, machineId, machineName, username, password]);

  const handleClose = () => {
    socket.current?.emit('ssh-disconnect');
    socket.current?.disconnect();
    onClose?.();
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    }, 100);
  };

  return (
    <Card
      className={`${
        isFullscreen
          ? 'fixed inset-4 z-50 flex flex-col'
          : 'w-full'
      }`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          SSH Terminal - {machineName}
          {isConnected && (
            <span className="ml-2 text-xs text-green-500">● Connected</span>
          )}
          {error && (
            <span className="ml-2 text-xs text-red-500">● Error</span>
          )}
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 w-8 p-0"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className={isFullscreen ? 'flex-1 flex flex-col p-0' : 'p-0'}>
        <div
          ref={terminalRef}
          className={`terminal-container ${isFullscreen ? 'h-full' : 'h-[500px]'}`}
          style={{
            padding: '8px',
            backgroundColor: '#1e1e1e',
          }}
        />
      </CardContent>
    </Card>
  );
};
