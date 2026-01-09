# Gateway Proxy Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RangeX System Architecture                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐                    ┌──────────────────┐
│   Your Computer  │                    │   AWS Cloud      │
│   (Development)  │                    │   (ap-south-2)   │
│                  │                    │                  │
│  ┌────────────┐  │                    │  ┌────────────┐  │
│  │  Frontend  │  │                    │  │            │  │
│  │ :5173      │◄─┼────────────────────┼──│  Public    │  │
│  └────────────┘  │                    │  │  Internet  │  │
│        │         │                    │  │            │  │
│        ▼         │                    │  └──────┬─────┘  │
│  ┌────────────┐  │  ┌─────────────┐  │         │        │
│  │  Backend   │  │  │   GATEWAY   │  │         ▼        │
│  │ :3000      │──┼─►│   PROXY     │◄─┼─────────┐        │
│  │            │  │  │  (Public    │  │         │        │
│  └────────────┘  │  │   Fargate)  │  │    ┌────▼──────┐ │
│                  │  │   Port 80   │  │    │ Security  │ │
└──────────────────┘  └─────────────┘  │    │ Group     │ │
                                       │    │ (Your IP) │ │
                                       │    └────┬──────┘ │
                                       │         │        │
                                       │         ▼        │
                                       │  ┌─────────────┐ │
                                       │  │   Private   │ │
                                       │  │   VPC       │ │
                                       │  │  (10.0.0.0) │ │
                                       │  │             │ │
                                       │  │ ┌─────────┐ │ │
                                       │  │ │Challenge│ │ │
                                       │  │ │  Task   │ │ │
                                       │  │ │ :22,80  │ │ │
                                       │  │ └─────────┘ │ │
                                       │  │             │ │
                                       │  │ ┌─────────┐ │ │
                                       │  │ │Challenge│ │ │
                                       │  │ │  Task   │ │ │
                                       │  │ │ :3389   │ │ │
                                       │  │ └─────────┘ │ │
                                       │  └─────────────┘ │
                                       └──────────────────┘
```

## Why Gateway Proxy is Essential

### Without Gateway Proxy ❌

```
┌──────────────┐     ❌ CANNOT REACH     ┌──────────────┐
│   Backend    │─────────────────────────│  Challenge   │
│ (localhost)  │   (No public IP)        │  Task        │
│              │                         │  (Private)   │
└──────────────┘                         └──────────────┘

Problem: Challenge tasks are on private subnets (no internet access)
Backend is on your localhost (not in AWS VPC)
```

### With Gateway Proxy ✅

```
┌──────────────┐     Internet      ┌──────────────┐    VPC      ┌──────────────┐
│   Backend    │───────────────────│   Gateway    │─────────────│  Challenge   │
│ (localhost)  │    HTTP + Key     │   Proxy      │  Forwarding │  Task        │
│              │                   │  (Public)    │             │  (Private)   │
└──────────────┘                   └──────────────┘             └──────────────┘

✅ Gateway has public IP (backend can reach it)
✅ Gateway is in VPC (can reach private tasks)
✅ Secure with authentication key
```

## Traffic Flow

### 1. Backend Discovers Gateway
```
Backend                         ECS API                    Gateway Task
  │                               │                            │
  │─────Get service info─────────►│                            │
  │◄────Service ARN───────────────│                            │
  │                               │                            │
  │─────Get task details──────────►│                            │
  │◄────Network interface ID──────│                            │
  │                               │                            │
  │─────Get public IP─────────────►│                            │
  │◄────13.127.45.123─────────────│                            │
  │                               │                            │
  └───────────────────────────────────────────────────────────┘
         Backend now knows gateway IP
```

### 2. Admin Test Environment Starts
```
Backend                    Environment Service          Gateway Proxy           Challenge Task
  │                               │                            │                      │
  │───Start test env─────────────►│                            │                      │
  │                               │────Discover gateway───────►│                      │
  │                               │◄───Public IP───────────────│                      │
  │                               │                            │                      │
  │                               │────Start Fargate task──────┼─────────────────────►│
  │                               │                            │                      │
  │◄──Session + gateway IP────────│                            │                      │
  │   (13.127.45.123)             │                            │                      │
```

### 3. Solver Connects to Challenge
```
Solver                     Gateway Proxy              Challenge Task
  │                               │                      │
  │──HTTP /http?dst=10.0.128.55──►│                      │
  │   &port=80&path=/api/flag     │                      │
  │   X-RANGEX-PROXY-KEY: xxx     │                      │
  │                               │                      │
  │                               │───Validate auth──────│
  │                               │───Check IP is 10.x───│
  │                               │───Check port allowed─│
  │                               │                      │
  │                               │─────HTTP GET─────────►│
  │                               │   10.0.128.55:80     │
  │                               │                      │
  │                               │◄────Response─────────│
  │◄──────Response────────────────│                      │
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     Security Architecture                        │
└─────────────────────────────────────────────────────────────────┘

Layer 1: Network Isolation
├─ Gateway Proxy: PUBLIC subnet (has internet access)
└─ Challenge Tasks: PRIVATE subnets (no internet, only VPC)

Layer 2: Security Groups
├─ Gateway SG (sg-097b38f550083fb26)
│  ├─ Inbound: Only your IP (210.19.13.180/32) on port 80
│  └─ Outbound: Only VPC CIDR (10.0.0.0/16)
│
└─ Challenge Task SG (per-session)
   ├─ Inbound: Only from Gateway SG on allowed ports
   └─ Outbound: VPC for S3, no internet

Layer 3: Application Authentication
├─ Proxy Key: 7e7a79c613cd7df96b57689c0c26e90f08cb90911aea4cfade2c723f9a28aefa
└─ Header: X-RANGEX-PROXY-KEY required on all requests

Layer 4: Validation
├─ Destination IP must start with "10." (VPC CIDR)
└─ Port must be in allowlist: 22,80,443,3389,8080,3000
```

## Connection Methods

### SSH Access (Port 22)
```
User Terminal                Gateway Proxy              Challenge Task
     │                             │                          │
     │──ssh user@GATEWAY_IP────────►│                          │
     │   port 22                    │                          │
     │   X-RANGEX-PROXY-KEY         │                          │
     │                              │──SSH forward─────────────►│
     │                              │  to 10.0.128.55:22       │
     │◄─────────────────────────────┴──────────────────────────│
                        SSH session established
```

### HTTP Access (Port 80)
```
Frontend                   Gateway Proxy              Challenge Task
    │                            │                          │
    │──GET /http?dst=10.x.x.x───►│                          │
    │   &port=80&path=/api       │                          │
    │                            │──HTTP GET────────────────►│
    │                            │  http://10.x.x.x:80/api  │
    │◄───────JSON response───────┴──────────────────────────│
```

### WebSocket (Real-time)
```
Frontend                   Gateway Proxy              Challenge Task
    │                            │                          │
    │──WS /ws?dst=10.x.x.x──────►│                          │
    │   &port=3000               │                          │
    │                            │──WebSocket upgrade───────►│
    │                            │  ws://10.x.x.x:3000      │
    │◄═══════════════════════════╧══════════════════════════│
              Bi-directional WebSocket stream
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AWS ECS Fargate Deployment                    │
└─────────────────────────────────────────────────────────────────┘

ECR Repository
└─ rangex-gateway-proxy:latest
   └─ Image URI: 688693885048.dkr.ecr.ap-south-2.amazonaws.com/rangex-gateway-proxy:latest

ECS Task Definition: rangex-gateway-proxy
├─ Family: rangex-gateway-proxy
├─ CPU: 256 (0.25 vCPU)
├─ Memory: 512 MB
├─ Network Mode: awsvpc
├─ Requires Compatibilities: FARGATE
└─ Container: gateway-proxy
   ├─ Image: <ECR_IMAGE>
   ├─ Port: 80
   ├─ Environment:
   │  ├─ PORT=80
   │  ├─ RANGEX_PROXY_KEY=<SECRET>
   │  ├─ RANGEX_VPC_CIDR_PREFIX=10.
   │  └─ RANGEX_ALLOWED_PORTS=22,80,443,3389,8080,3000
   └─ Health Check:
      └─ wget http://localhost/health every 30s

ECS Service: rangex-gateway-proxy-svc
├─ Cluster: rangex-fargate-cluster
├─ Desired Count: 1
├─ Launch Type: FARGATE
└─ Network Configuration:
   ├─ Subnets: subnet-08b1cc1f2de2cb01a (Public Subnet A)
   ├─ Security Groups: sg-097b38f550083fb26
   └─ Assign Public IP: ENABLED
```

## Cost Breakdown

```
Gateway Proxy Cost (24/7 operation)
├─ Fargate vCPU: 0.25 vCPU × $0.04048/hour × 730 hours = $7.39
├─ Fargate Memory: 0.5 GB × $0.004445/hour × 730 hours = $3.24
├─ Data Transfer Out: ~1 GB/month (negligible) = $0.09
└─ Total: ~$10.72/month

Note: This is essential infrastructure for admin testing
Running costs are minimal compared to functionality gained
```

## High Availability (Optional)

```
For production, run 2+ gateway tasks behind NLB:

┌─────────────┐
│   Backend   │
│             │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Network Load       │  (Public IP)
│  Balancer           │
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌────────┐  ┌────────┐
│Gateway │  │Gateway │
│Task 1  │  │Task 2  │
└────────┘  └────────┘

Benefits:
- Zero downtime updates
- Automatic failover
- Better performance

Cost: +$16/month (NLB) + $10/month (2nd task) = $26/month extra
```

## Monitoring

```
CloudWatch Metrics
├─ ECS Service
│  ├─ CPUUtilization (target: <70%)
│  ├─ MemoryUtilization (target: <70%)
│  └─ RunningTaskCount (should be 1)
│
└─ Application Logs: /ecs/rangex-gateway-proxy
   ├─ [PROXY] HTTP requests
   ├─ [WS PROXY] WebSocket connections
   ├─ [AUTH FAIL] Authentication failures
   └─ [VALIDATION FAIL] Invalid requests

CloudWatch Alarms (recommended)
├─ Gateway task stopped (TaskCount = 0)
└─ High error rate (>10 auth failures/minute)
```

## Troubleshooting Flow

```
Issue: "Cannot connect to challenge tasks"
│
├─ Step 1: Is gateway running?
│  └─ aws ecs describe-services ... (check RunningCount = 1)
│     ├─ No → Deploy gateway: .\deploy.ps1
│     └─ Yes → Continue
│
├─ Step 2: Does backend know gateway IP?
│  └─ Check backend logs for "Discovered gateway proxy"
│     ├─ No → Restart backend: npm run start:dev
│     └─ Yes → Continue
│
├─ Step 3: Can you reach gateway health endpoint?
│  └─ curl http://<GATEWAY_IP>/health
│     ├─ No → Check security group allows your IP
│     └─ Yes → Continue
│
├─ Step 4: Is proxy key correct?
│  └─ Test with: curl -H "X-RANGEX-PROXY-KEY: <KEY>" http://<IP>/http?...
│     ├─ 401 → Proxy key mismatch
│     └─ 200/502 → Key is correct
│
└─ Step 5: Can gateway reach tasks?
   └─ Check security group outbound rules allow VPC CIDR
      └─ aws ec2 describe-security-groups --group-ids sg-097b38f550083fb26
```
