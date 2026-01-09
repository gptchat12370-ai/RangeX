# Gateway Proxy Deployment Guide

## Overview
This guide deploys the RangeX Gateway Proxy to AWS ECS Fargate, enabling your localhost backend to connect to private challenge tasks.

## Prerequisites
- ✅ AWS CLI configured with credentials
- ✅ Docker installed
- ✅ ECR repository created (will be created if missing)
- ✅ Backend `.env` configured with proxy key

## Architecture
```
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│  Your Computer   │          │  Gateway Proxy   │          │  Challenge Tasks │
│  (Backend)       │──────────│  (Public Fargate)│──────────│  (Private Fargate│
│  localhost:3000  │ Internet │  Public IP:80    │ VPC Only │  10.x.x.x:22,80) │
└──────────────────┘          └──────────────────┘          └──────────────────┘
```

## Step 1: Build and Push Docker Image

### 1.1 Login to ECR
```powershell
# Navigate to gateway-proxy directory
cd gateway-proxy

# Login to ECR (ap-south-2 region)
aws ecr get-login-password --region ap-south-2 | docker login --username AWS --password-stdin 688693885048.dkr.ecr.ap-south-2.amazonaws.com
```

### 1.2 Create ECR Repository (if not exists)
```powershell
aws ecr describe-repositories --repository-names rangex-gateway-proxy --region ap-south-2 2>$null

# If not found, create it:
aws ecr create-repository --repository-name rangex-gateway-proxy --region ap-south-2 --image-scanning-configuration scanOnPush=true
```

### 1.3 Build and Push Image
```powershell
# Build the Docker image
docker build -t rangex-gateway-proxy:latest .

# Tag for ECR
docker tag rangex-gateway-proxy:latest 688693885048.dkr.ecr.ap-south-2.amazonaws.com/rangex-gateway-proxy:latest

# Push to ECR
docker push 688693885048.dkr.ecr.ap-south-2.amazonaws.com/rangex-gateway-proxy:latest
```

## Step 2: Create ECS Task Definition

### 2.1 Verify Task Definition
The [task-definition.json](task-definition.json) file should have your proxy key. Check line 24:
```json
{
  "name": "RANGEX_PROXY_KEY",
  "value": "7e7a79c613cd7df96b57689c0c26e90f08cb90911aea4cfade2c723f9a28aefa"
}
```

### 2.2 Register Task Definition
```powershell
aws ecs register-task-definition --cli-input-json file://task-definition.json --region ap-south-2
```

## Step 3: Create ECS Service

### 3.1 Create Service
```powershell
aws ecs create-service `
  --cluster rangex-fargate-cluster `
  --service-name rangex-gateway-proxy-svc `
  --task-definition rangex-gateway-proxy `
  --desired-count 1 `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[subnet-08b1cc1f2de2cb01a],securityGroups=[sg-097b38f550083fb26],assignPublicIp=ENABLED}" `
  --region ap-south-2
```

**Network Configuration Explained**:
- **Subnet**: `subnet-08b1cc1f2de2cb01a` (Public Subnet A) - needs public IP
- **Security Group**: `sg-097b38f550083fb26` (Gateway Proxy SG) - allows your IP only
- **assignPublicIp**: `ENABLED` - gateway needs public IP for backend to reach it

### 3.2 Verify Service is Running
```powershell
aws ecs describe-services --cluster rangex-fargate-cluster --services rangex-gateway-proxy-svc --region ap-south-2 --query "services[0].{Status:status,DesiredCount:desiredCount,RunningCount:runningCount,Deployments:deployments[0].status}"
```

Expected output:
```json
{
  "Status": "ACTIVE",
  "DesiredCount": 1,
  "RunningCount": 1,
  "Deployments": "PRIMARY"
}
```

## Step 4: Get Gateway Public IP

### 4.1 Discover Public IP
```powershell
# Get task ARN
$taskArn = aws ecs list-tasks --cluster rangex-fargate-cluster --service-name rangex-gateway-proxy-svc --region ap-south-2 --query "taskArns[0]" --output text

# Get network interface ID
$eniId = aws ecs describe-tasks --cluster rangex-fargate-cluster --tasks $taskArn --region ap-south-2 --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value" --output text

# Get public IP
$publicIp = aws ec2 describe-network-interfaces --network-interface-ids $eniId --region ap-south-2 --query "NetworkInterfaces[0].Association.PublicIp" --output text

Write-Host "Gateway Proxy Public IP: $publicIp"
```

### 4.2 Test Health Endpoint
```powershell
curl http://$publicIp/health
```

Expected response:
```json
{
  "status": "healthy",
  "uptime": 45.123,
  "timestamp": "2026-01-04T..."
}
```

## Step 5: Test Proxy Connection

### 5.1 Test HTTP Proxy (to localhost - will fail, just testing auth)
```powershell
curl -H "X-RANGEX-PROXY-KEY: 7e7a79c613cd7df96b57689c0c26e90f08cb90911aea4cfade2c723f9a28aefa" `
  "http://$publicIp/http?dst=10.0.0.1&port=80&path=/"
```

### 5.2 Check Backend Auto-Discovery
Your backend should automatically discover the gateway on startup. Check logs:
```powershell
# In backend directory
npm run start:dev
```

Look for log:
```
[GatewayProxyService] Discovered gateway proxy: 13.127.45.123 (task arn:...)
```

## Step 6: Update Security Groups (CRITICAL)

### 6.1 Verify Gateway Proxy SG Inbound Rules
```powershell
aws ec2 describe-security-groups --group-ids sg-097b38f550083fb26 --region ap-south-2 --query "SecurityGroups[0].IpPermissions"
```

**Required Inbound Rule**:
- **Type**: HTTP (TCP 80)
- **Source**: Your public IP (`210.19.13.180/32`)
- **Description**: "RangeX backend → gateway proxy"

### 6.2 Add Rule if Missing
```powershell
aws ec2 authorize-security-group-ingress `
  --group-id sg-097b38f550083fb26 `
  --protocol tcp `
  --port 80 `
  --cidr 210.19.13.180/32 `
  --region ap-south-2
```

### 6.3 Verify Gateway Can Reach Private Subnets
The gateway proxy SG (`sg-097b38f550083fb26`) needs **outbound rules** to reach challenge tasks:

```powershell
aws ec2 describe-security-groups --group-ids sg-097b38f550083fb26 --region ap-south-2 --query "SecurityGroups[0].IpPermissionsEgress"
```

**Required Outbound Rules**:
- **Type**: All TCP
- **Destination**: `10.0.0.0/16` (your VPC CIDR)
- **Description**: "Gateway → private challenge tasks"

### 6.4 Add Outbound Rule if Missing
```powershell
aws ec2 authorize-security-group-egress `
  --group-id sg-097b38f550083fb26 `
  --protocol tcp `
  --port 0-65535 `
  --cidr 10.0.0.0/16 `
  --region ap-south-2
```

## Step 7: Verify End-to-End

### 7.1 Start Backend
```powershell
cd ..\backend
npm run start:dev
```

### 7.2 Start an Admin Test Session
1. Open RangeX UI: http://localhost:5173
2. Login as admin
3. Go to Admin Panel → Review Scenarios
4. Find a scenario and click "Cloud Test"
5. Click "Start Test Environment"

### 7.3 Check Session Has Gateway IP
In backend logs, look for:
```
[SessionConnectionService] Environment session created with gateway IP: 13.127.45.123
```

### 7.4 Test Interactive Access
Once environment is running:
1. In admin test UI, click on a machine
2. You should see connection info with gateway IP
3. Copy SSH command and test from your terminal

## Troubleshooting

### Issue: "Gateway proxy not discovered"
**Solution**: Check ECS service is running:
```powershell
aws ecs describe-services --cluster rangex-fargate-cluster --services rangex-gateway-proxy-svc --region ap-south-2
```

### Issue: "401 Unauthorized" when testing proxy
**Solution**: Verify proxy key matches in:
- Task definition (`task-definition.json` line 24)
- Backend `.env` (`RANGEX_GATEWAY_PROXY_KEY`)

### Issue: "Connection refused" from backend to gateway
**Solution**: Check security group inbound rule allows your IP:
```powershell
aws ec2 describe-security-groups --group-ids sg-097b38f550083fb26 --region ap-south-2
```

### Issue: "502 Proxy Error" when connecting to challenge tasks
**Solution**: Check gateway SG outbound rules allow VPC CIDR:
```powershell
aws ec2 describe-security-groups --group-ids sg-097b38f550083fb26 --region ap-south-2 --query "SecurityGroups[0].IpPermissionsEgress"
```

### Issue: Gateway task keeps restarting
**Solution**: Check CloudWatch logs:
```powershell
aws logs tail /ecs/rangex-gateway-proxy --follow --region ap-south-2
```

## Cost Estimate

**Gateway Proxy Fargate Task**:
- **CPU**: 0.25 vCPU ($0.04048/hour)
- **Memory**: 0.5 GB ($0.004445/hour)
- **Total**: ~$0.045/hour = **$32.40/month** (if running 24/7)

**Recommendation**: Keep gateway running 24/7 for admin testing. It's only $32/month and critical for functionality.

## Next Steps

After deployment:
1. ✅ Verify gateway health: `curl http://$publicIp/health`
2. ✅ Test backend discovery: Check `npm run start:dev` logs
3. ✅ Run admin cloud test: Create test session and verify gateway IP
4. ✅ Test SSH connection: Use generated SSH command from UI
5. ✅ Monitor costs: Check AWS Cost Explorer after 24 hours

## Security Checklist

- [ ] Gateway proxy key is strong (32+ characters)
- [ ] Gateway SG only allows your IP (`210.19.13.180/32`)
- [ ] Gateway task definition has correct proxy key
- [ ] Gateway can reach VPC CIDR (`10.0.0.0/16`)
- [ ] Backend `.env` has matching proxy key
- [ ] No sensitive data in task definition (use Secrets Manager for production)

## Maintenance

### Update Gateway Proxy Code
```powershell
# Make changes to server.js
# Rebuild and push
docker build -t rangex-gateway-proxy:latest .
docker tag rangex-gateway-proxy:latest 688693885048.dkr.ecr.ap-south-2.amazonaws.com/rangex-gateway-proxy:latest
docker push 688693885048.dkr.ecr.ap-south-2.amazonaws.com/rangex-gateway-proxy:latest

# Force new deployment
aws ecs update-service --cluster rangex-fargate-cluster --service rangex-gateway-proxy-svc --force-new-deployment --region ap-south-2
```

### Scale Gateway (if needed)
```powershell
# Increase to 2 tasks for redundancy
aws ecs update-service --cluster rangex-fargate-cluster --service rangex-gateway-proxy-svc --desired-count 2 --region ap-south-2
```
