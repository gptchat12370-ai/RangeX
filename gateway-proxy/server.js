const express = require("express");
const httpProxy = require("http-proxy");
const net = require("net");
const { WebSocketServer } = require("ws");

const app = express();
const proxy = httpProxy.createProxyServer({ ws: true });

// Configuration from environment variables
const PORT = process.env.PORT || 8080;
const PROXY_KEY = process.env.RANGEX_PROXY_KEY;
const VPC_CIDR_PREFIX = process.env.RANGEX_VPC_CIDR_PREFIX || "10."; // Simple dev check
const ALLOWED_PORTS = (process.env.RANGEX_ALLOWED_PORTS || "22,80,443,5900,5901,6901,8080,3000,3389")
  .split(",")
  .map((p) => parseInt(p.trim(), 10))
  .filter(Boolean);

// Validation functions
function requireAuth(req, res) {
  const key = req.header("X-RANGEX-PROXY-KEY");
  if (!PROXY_KEY || key !== PROXY_KEY) {
    console.warn(`[AUTH FAIL] Missing or invalid proxy key from ${req.ip}`);
    res.status(401).send("Unauthorized");
    return false;
  }
  return true;
}

function validateTarget(dst, port) {
  if (!dst || typeof dst !== "string") {
    return "Missing dst parameter";
  }
  
  // Check if destination is a Docker hostname (alphanumeric + hyphens) or valid VPC IP
  const isHostname = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(dst);
  const isVpcIp = dst.startsWith(VPC_CIDR_PREFIX);
  
  if (!isHostname && !isVpcIp) {
    return `Destination ${dst} must be a valid hostname or IP in VPC CIDR (${VPC_CIDR_PREFIX}*)`;
  }
  
  // Validate port is in allowed list
  const p = parseInt(port, 10);
  if (isNaN(p) || !ALLOWED_PORTS.includes(p)) {
    return `Port ${port} not in allowed list: ${ALLOWED_PORTS.join(", ")}`;
  }
  
  return null;
}

// Health check endpoint (no auth required)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// HTTP proxy endpoint
app.all("/http", (req, res) => {
  // Require authentication
  if (!requireAuth(req, res)) return;

  const dst = req.query.dst;
  const port = req.query.port;
  const path = req.query.path || "/";

  // Validate target
  const validationError = validateTarget(dst, port);
  if (validationError) {
    console.warn(`[VALIDATION FAIL] ${validationError}`);
    // Sanitize error message to prevent XSS
    return res.status(400).json({ error: "Invalid request parameters" });
  }

  const target = `http://${dst}:${port}`;
  req.url = path; // Forward to the requested path

  console.log(`[PROXY] ${req.method} ${target}${path} from ${req.ip}`);

  proxy.web(req, res, { target }, (error) => {
    console.error(`[PROXY ERROR] ${target}${path}: ${error.message}`);
    // Sanitize error message to prevent information disclosure
    res.status(502).json({ error: "Proxy connection failed" });
  });
});

// WebSocket proxy endpoint
app.all("/ws", (req, res) => {
  res.status(426).send("Upgrade Required - Use WebSocket connection");
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           RangeX Gateway Proxy - RUNNING                       ║
╚════════════════════════════════════════════════════════════════╝

  Port:           ${PORT}
  VPC CIDR:       ${VPC_CIDR_PREFIX}*
  Allowed Ports:  ${ALLOWED_PORTS.join(", ")}
  Auth:           ${PROXY_KEY ? "ENABLED" : "⚠️  DISABLED (INSECURE)"}
  
  Endpoints:
    GET  /health              - Health check
    ALL  /http?dst=<ip>&port=<p>&path=<path>  - HTTP proxy
    WS   /ws?dst=<ip>&port=<p>&path=<path>    - WebSocket proxy
  
  Ready to forward traffic from localhost → private challenge tasks
`);
});

// WebSocket upgrade handler
server.on("upgrade", (req, socket, head) => {
  // Parse URL first to get token
  const url = new URL(req.url, "http://localhost");
  const token = url.searchParams.get("token");
  
  // Accept either header-based or token-based authentication
  const key = req.headers["x-rangex-proxy-key"];
  const hasValidAuth = (PROXY_KEY && key === PROXY_KEY) || (token && token.length === 48);
  
  if (!hasValidAuth) {
    console.warn(`[WS AUTH FAIL] Missing or invalid auth from ${socket.remoteAddress}`);
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  // Validate target
  const dst = url.searchParams.get("dst");
  const port = url.searchParams.get("port");
  const path = url.searchParams.get("path") || "/";

  const validationError = validateTarget(dst, port);
  if (validationError) {
    console.warn(`[WS VALIDATION FAIL] ${validationError}`);
    socket.write(`HTTP/1.1 400 Bad Request\r\n\r\nInvalid request`);
    socket.destroy();
    return;
  }

  const target = `ws://${dst}:${port}`;
  console.log(`[WS PROXY] ${target}${path} from ${socket.remoteAddress}`);

  // For VNC ports (5900, 5901, 6901), use WebSocket-to-TCP bridge
  // VNC uses RFB protocol, not HTTP, so we need to unwrap WebSocket frames
  const isVncPort = [5900, 5901, 6901].includes(parseInt(port, 10));
  
  if (isVncPort) {
    // Create WebSocket server to handle this connection
    const wss = new WebSocketServer({ noServer: true });
    
    wss.handleUpgrade(req, socket, head, (ws) => {
      console.log(`[VNC WS] WebSocket established from ${socket.remoteAddress}`);
      
      // Connect to VNC server via TCP
      const vncSocket = net.connect(port, dst, () => {
        console.log(`[VNC TCP] Connected to ${dst}:${port}`);
      });
      
      // Forward WebSocket messages (unwrapped) to VNC server
      ws.on('message', (data) => {
        vncSocket.write(data);
      });
      
      // Forward VNC server data (wrapped) back to WebSocket client
      vncSocket.on('data', (data) => {
        if (ws.readyState === 1) { // 1 = OPEN state
          ws.send(data);
        }
      });
      
      // Handle errors and cleanup
      ws.on('error', (error) => {
        console.error(`[VNC WS ERROR]: ${error.message}`);
        vncSocket.destroy();
      });
      
      vncSocket.on('error', (error) => {
        console.error(`[VNC TCP ERROR] ${dst}:${port}: ${error.message}`);
        ws.close();
      });
      
      ws.on('close', () => {
        console.log(`[VNC WS] Client disconnected`);
        vncSocket.destroy();
      });
      
      vncSocket.on('close', () => {
        console.log(`[VNC TCP] Server disconnected`);
        ws.close();
      });
    });
  } else {
    // For non-VNC WebSocket connections, use http-proxy
    proxy.ws(req, socket, head, { target }, (error) => {
      console.error(`[WS PROXY ERROR] ${target}${path}: ${error.message}`);
      socket.destroy();
    });
  }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n[SHUTDOWN] Received SIGTERM, closing server gracefully...");
  server.close(() => {
    console.log("[SHUTDOWN] Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\n[SHUTDOWN] Received SIGINT, closing server gracefully...");
  server.close(() => {
    console.log("[SHUTDOWN] Server closed");
    process.exit(0);
  });
});
