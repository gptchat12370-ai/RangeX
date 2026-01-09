# Gateway Proxy - Quick Start

## What is it?
The gateway proxy is a **bridge** between your localhost backend and private AWS challenge tasks.

```
Your Computer (Backend) ──Internet──→ Gateway Proxy ──VPC Internal──→ Challenge Tasks
localhost:3000                        Public IP:80                     Private IPs (10.x.x.x)
```

## Why do you need it?

✅ **Essential for Admin Cloud Testing**
- Challenge tasks run on private subnets (no internet access)
- Your backend runs on localhost (not in AWS VPC)
- Gateway proxy bridges the gap

✅ **Interactive Solver Access**
- Solvers connect to gateway proxy public IP
- Proxy forwards traffic to private challenge tasks
- Secure with authentication key

## Current Status

✅ **Backend is Ready**
- Gateway proxy service configured
- Auto-discovery enabled
- Security groups configured

❌ **Gateway Not Deployed**
- Proxy task not running in AWS
- No public IP available
- Admin testing won't work

## Deploy Now (5 minutes)

### Option 1: Automated Script (Recommended)

```powershell
# Navigate to gateway-proxy directory
cd gateway-proxy

# Check if gateway exists
.\deploy.ps1 -CheckOnly

# Deploy gateway (first time)
.\deploy.ps1

# Update gateway (if already deployed)
.\deploy.ps1  # Will auto-detect and update
```

### Option 2: Manual Steps

Follow the complete guide in [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

## Quick Deploy Commands

```powershell
# 1. Login to ECR
cd gateway-proxy
aws ecr get-login-password --region ap-south-2 | docker login --username AWS --password-stdin 688693885048.dkr.ecr.ap-south-2.amazonaws.com

# 2. Build and push
docker build -t rangex-gateway-proxy:latest .
docker tag rangex-gateway-proxy:latest 688693885048.dkr.ecr.ap-south-2.amazonaws.com/rangex-gateway-proxy:latest
docker push 688693885048.dkr.ecr.ap-south-2.amazonaws.com/rangex-gateway-proxy:latest

# 3. Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json --region ap-south-2

# 4. Create service
aws ecs create-service `
  --cluster rangex-fargate-cluster `
  --service-name rangex-gateway-proxy-svc `
  --task-definition rangex-gateway-proxy `
  --desired-count 1 `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[subnet-08b1cc1f2de2cb01a],securityGroups=[sg-097b38f550083fb26],assignPublicIp=ENABLED}" `
  --region ap-south-2

# 5. Get public IP
$taskArn = aws ecs list-tasks --cluster rangex-fargate-cluster --service-name rangex-gateway-proxy-svc --region ap-south-2 --query "taskArns[0]" --output text
$eniId = aws ecs describe-tasks --cluster rangex-fargate-cluster --tasks $taskArn --region ap-south-2 --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value" --output text
$publicIp = aws ec2 describe-network-interfaces --network-interface-ids $eniId --region ap-south-2 --query "NetworkInterfaces[0].Association.PublicIp" --output text
Write-Host "Gateway IP: $publicIp"

# 6. Test health
curl http://$publicIp/health
```

## After Deployment

### 1. Restart Backend
The backend will auto-discover the gateway:

```powershell
cd ..\backend
npm run start:dev
```

Look for log:
```
[GatewayProxyService] Discovered gateway proxy: <PUBLIC_IP>
```

### 2. Test Admin Cloud Testing
1. Login to RangeX UI
2. Go to Admin Panel → Review Scenarios
3. Click "Cloud Test" on any scenario
4. Start test environment
5. Verify you can see machine connection info

## Troubleshooting

### "Gateway proxy not discovered"
```powershell
# Check service status
aws ecs describe-services --cluster rangex-fargate-cluster --services rangex-gateway-proxy-svc --region ap-south-2
```

### "Connection refused"
```powershell
# Check security group allows your IP (210.19.13.180/32)
aws ec2 describe-security-groups --group-ids sg-097b38f550083fb26 --region ap-south-2
```

### "Health check fails"
```powershell
# Check CloudWatch logs
aws logs tail /ecs/rangex-gateway-proxy --follow --region ap-south-2
```

## Cost

**$32/month** (running 24/7)
- 0.25 vCPU + 0.5 GB RAM Fargate task
- Essential for admin testing functionality

## Security

✅ **Configured Correctly**
- Proxy key: `7e7a79c613cd7df96b57689c0c26e90f08cb90911aea4cfade2c723f9a28aefa`
- Security group: Only allows your IP (210.19.13.180/32)
- VPC isolation: Can only reach 10.0.0.0/16 CIDR
- Port allowlist: 22,80,443,3389,8080,3000

## Files

- [`server.js`](server.js) - Proxy server code
- [`Dockerfile`](Dockerfile) - Container image
- [`task-definition.json`](task-definition.json) - ECS task config
- [`deploy.ps1`](deploy.ps1) - Automated deployment script
- [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) - Complete manual guide
- [`README.md`](README.md) - API documentation

## Next Steps

1. ✅ Deploy gateway: `.\deploy.ps1`
2. ✅ Restart backend: `cd ..\backend && npm run start:dev`
3. ✅ Test admin cloud testing in UI
4. ✅ Verify solver access works
