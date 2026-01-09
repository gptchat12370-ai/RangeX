# RangeX Gateway Proxy

A secure HTTP/WebSocket proxy that bridges your localhost RangeX backend to private AWS challenge tasks running in Fargate.

## Architecture

```
┌──────────────────┐                  ┌──────────────────┐                  ┌──────────────────┐
│  RangeX Backend  │                  │  Gateway Proxy   │                  │  Challenge Tasks │
│   (localhost)    │ ─────────────────│  (Fargate, Public│ ─────────────────│  (Fargate, Private│
│   Port 3000      │  Internet        │   IP, Port 80)   │  VPC Internal    │   IPs, Private)  │
└──────────────────┘                  └──────────────────┘                  └──────────────────┘
```

## Features

- **Secure Authentication**: Requires `X-RANGEX-PROXY-KEY` header for all requests
- **Target Validation**: 
  - Restricts destinations to VPC CIDR (default: `10.*`)
  - Only allows specific ports (22, 80, 443, 3389, 8080, 3000)
- **HTTP + WebSocket Support**: Proxies both standard HTTP and WebSocket connections
- **Health Checks**: `/health` endpoint for ECS health monitoring
- **Graceful Shutdown**: Handles SIGTERM/SIGINT for clean ECS task termination

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `80` | Port the proxy listens on |
| `RANGEX_PROXY_KEY` | - | **Required**. Shared secret for authentication |
| `RANGEX_VPC_CIDR_PREFIX` | `10.` | VPC CIDR prefix (e.g., `10.` for `10.0.0.0/8`) |
| `RANGEX_ALLOWED_PORTS` | `22,80,443,8080,3000,3389` | Comma-separated list of allowed destination ports |

## API Endpoints

### Health Check
```
GET /health
```
Returns `200 OK` with uptime information. No authentication required.

### HTTP Proxy
```
ALL /http?dst=<ip>&port=<port>&path=<path>
Headers: X-RANGEX-PROXY-KEY: <secret>
```
Forwards HTTP request to `http://<ip>:<port><path>`.

**Example:**
```bash
curl -H "X-RANGEX-PROXY-KEY: secret123" \
  "http://gateway-ip/http?dst=10.0.128.55&port=80&path=/api/flag"
```

### WebSocket Proxy
```
WS /ws?dst=<ip>&port=<port>&path=<path>
Headers: X-RANGEX-PROXY-KEY: <secret>
```
Upgrades to WebSocket and forwards to `ws://<ip>:<port><path>`.

**Example (JavaScript):**
```javascript
const ws = new WebSocket("ws://gateway-ip/ws?dst=10.0.128.55&port=3000&path=/socket", {
  headers: { "X-RANGEX-PROXY-KEY": "secret123" }
});
```

## Local Development

```bash
# Install dependencies
npm install

# Set environment variables
export RANGEX_PROXY_KEY="your-secret-key"
export RANGEX_VPC_CIDR_PREFIX="10."
export PORT=8080

# Run
npm start
```

## Docker Build

```bash
# Build image
docker build -t rangex-gateway-proxy:latest .

# Run locally
docker run -p 8080:80 \
  -e RANGEX_PROXY_KEY=secret123 \
  -e RANGEX_VPC_CIDR_PREFIX=10. \
  rangex-gateway-proxy:latest
```

## Deployment to AWS ECR/ECS

See `GATEWAY_PROXY_DEPLOYMENT.md` in the root directory for complete deployment instructions.

## Security Considerations

1. **Proxy Key**: Generate a strong random key (32+ characters)
2. **Security Groups**: Restrict inbound to your public IP only (`YOUR_IP/32`)
3. **VPC Isolation**: Proxy can only reach IPs matching `RANGEX_VPC_CIDR_PREFIX`
4. **Port Allowlist**: Only specified ports are accessible
5. **No Open Proxy**: Cannot proxy to arbitrary internet destinations

## Troubleshooting

### 401 Unauthorized
- Check `X-RANGEX-PROXY-KEY` header is set correctly
- Verify proxy key matches the value in ECS task definition

### 400 Bad Request "Port not allowed"
- Ensure destination port is in `RANGEX_ALLOWED_PORTS`
- Update ECS task definition to add missing ports

### 502 Proxy Error
- Verify destination IP is reachable from proxy (check security groups)
- Confirm challenge task is running and listening on the specified port
- Check VPC routing tables

### WebSocket Connection Fails
- Ensure WebSocket upgrade uses `/ws` endpoint (not `/http`)
- Verify `X-RANGEX-PROXY-KEY` is sent in headers during upgrade
