# RangeX Deployment Guide
## Hybrid AWS + Local Infrastructure

**Cost Target**: RM 134/month (66% savings vs AWS-heavy approach)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Infrastructure Setup](#local-infrastructure-setup)
3. [AWS Infrastructure Deployment](#aws-infrastructure-deployment)
4. [Application Deployment](#application-deployment)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Cost Monitoring](#cost-monitoring)

---

## Prerequisites

### Required Tools

```powershell
# AWS CLI
winget install Amazon.AWSCLI

# Docker Desktop
winget install Docker.DockerDesktop

# Node.js 18+
winget install OpenJS.NodeJS

# Git
winget install Git.Git
```

### AWS Account Setup

1. **Create AWS Account** (if not exists)
   - Free tier: 12 months
   - Payment method: Credit card

2. **Create IAM User** (admin access)
   ```bash
   aws iam create-user --user-name rangex-deployer
   aws iam attach-user-policy --user-name rangex-deployer --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
   aws iam create-access-key --user-name rangex-deployer
   ```

3. **Configure AWS CLI**
   ```bash
   aws configure
   # AWS Access Key ID: <from previous step>
   # AWS Secret Access Key: <from previous step>
   # Default region: ap-southeast-1
   # Default output format: json
   ```

---

## Local Infrastructure Setup

### 1. MySQL Database

```powershell
# Using Docker
docker run -d `
  --name rangex-mysql `
  -e MYSQL_ROOT_PASSWORD=root_password `
  -e MYSQL_DATABASE=rangex `
  -e MYSQL_USER=rangex `
  -e MYSQL_PASSWORD=secure_password `
  -p 3306:3306 `
  -v rangex-mysql-data:/var/lib/mysql `
  mysql:8.0

# Verify
docker exec -it rangex-mysql mysql -u rangex -p rangex
```

### 2. MinIO (S3 Replacement)

```powershell
# Create directories
New-Item -Path "C:\rangex\minio\data" -ItemType Directory -Force

# Run MinIO
docker run -d `
  --name rangex-minio `
  -p 9000:9000 `
  -p 9001:9001 `
  -e MINIO_ROOT_USER=minioadmin `
  -e MINIO_ROOT_PASSWORD=minioadmin `
  -v C:\rangex\minio\data:/data `
  minio/minio server /data --console-address ":9001"

# Access console: http://localhost:9001
# Create buckets: rangex-staging, rangex-approved
```

### 3. Local Syslog Server (CloudWatch Replacement)

```powershell
# Using syslog-ng
docker run -d `
  --name rangex-syslog `
  -p 514:514/tcp `
  -p 514:514/udp `
  -v C:\rangex\logs:/var/log/syslog-ng `
  balabit/syslog-ng:latest

# Verify
Get-Content C:\rangex\logs\messages -Wait
```

### 4. Prometheus + Grafana (Monitoring)

```powershell
# Prometheus
docker run -d `
  --name rangex-prometheus `
  -p 9090:9090 `
  -v C:\rangex\prometheus\prometheus.yml:/etc/prometheus/prometheus.yml `
  prom/prometheus

# Grafana
docker run -d `
  --name rangex-grafana `
  -p 3000:3000 `
  -e GF_SECURITY_ADMIN_PASSWORD=admin `
  grafana/grafana

# Access Grafana: http://localhost:3000 (admin/admin)
```

---

## AWS Infrastructure Deployment

### 1. Deploy CloudFormation Stack

```bash
# Navigate to infra directory
cd infra/cloudformation

# Deploy stack
aws cloudformation create-stack \
  --stack-name rangex-prod \
  --template-body file://rangex-minimal-stack.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=prod \
    ParameterKey=LocalSyslogServer,ParameterValue=YOUR_PUBLIC_IP:514 \
  --capabilities CAPABILITY_NAMED_IAM \
  --tags \
    Key=Project,Value=rangex \
    Key=Environment,Value=prod \
    Key=CostCenter,Value=engineering

# Wait for completion (5-10 minutes)
aws cloudformation wait stack-create-complete --stack-name rangex-prod

# Get outputs
aws cloudformation describe-stacks --stack-name rangex-prod --query 'Stacks[0].Outputs'
```

### 2. Save CloudFormation Outputs

```powershell
# Save to .env file
$outputs = aws cloudformation describe-stacks --stack-name rangex-prod --query 'Stacks[0].Outputs' | ConvertFrom-Json

# Extract values
$vpcId = ($outputs | Where-Object { $_.OutputKey -eq 'VPCId' }).OutputValue
$subnet1 = ($outputs | Where-Object { $_.OutputKey -eq 'PrivateSubnet1Id' }).OutputValue
$subnet2 = ($outputs | Where-Object { $_.OutputKey -eq 'PrivateSubnet2Id' }).OutputValue
$sgId = ($outputs | Where-Object { $_.OutputKey -eq 'FargateSecurityGroupId' }).OutputValue
$clusterName = ($outputs | Where-Object { $_.OutputKey -eq 'ECSClusterName' }).OutputValue
$ecrUri = ($outputs | Where-Object { $_.OutputKey -eq 'ECRRepositoryUri' }).OutputValue

# Update .env
@"
ECS_CLUSTER_NAME=$clusterName
ECS_SUBNET_IDS=$subnet1,$subnet2
ECS_SECURITY_GROUP_ID=$sgId
ECR_REPOSITORY_URI=$ecrUri
"@ | Out-File -FilePath ..\..\backend\.env -Append
```

### 3. Configure AWS Budgets (Manual)

1. Go to AWS Console → AWS Budgets
2. Create Budget:
   - Name: `rangex-monthly-budget`
   - Amount: `$150` (RM 134/month)
   - Type: Cost budget
   - Period: Monthly
3. Set Alert:
   - Threshold: 80% ($120)
   - Email: Your email
4. Save

---

## Application Deployment

### 1. Build Backend

```powershell
cd backend

# Install dependencies
npm install

# Build
npm run build

# Run migrations
npm run migration:run

# Start server
npm run start:prod
```

### 2. Build Frontend

```powershell
cd frontend

# Install dependencies
npm install

# Build
npm run build

# Serve (production)
npm install -g serve
serve -s dist -l 5173
```

### 3. Build and Push Docker Image

```powershell
cd backend

# Login to ECR
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin $ecrUri

# Build image
docker build -t rangex-backend .

# Tag image
docker tag rangex-backend:latest $ecrUri:latest

# Push to ECR
docker push $ecrUri:latest
```

### 4. Deploy to Fargate

```bash
# Update task definition with latest image
aws ecs update-service \
  --cluster rangex-prod \
  --service rangex-backend \
  --force-new-deployment

# Verify
aws ecs describe-services \
  --cluster rangex-prod \
  --services rangex-backend \
  --query 'services[0].deployments'
```

---

## Verification

### 1. Check Local Services

```powershell
# MySQL
docker exec -it rangex-mysql mysql -u rangex -p -e "SHOW DATABASES;"

# MinIO
curl http://localhost:9000/minio/health/live

# Syslog
Get-Content C:\rangex\logs\messages | Select-Object -Last 10

# Prometheus
curl http://localhost:9090/-/healthy

# Grafana
curl http://localhost:3000/api/health
```

### 2. Check AWS Services

```bash
# VPC Endpoints
aws ec2 describe-vpc-endpoints --filters "Name=tag:Project,Values=rangex"

# ECS Cluster
aws ecs describe-clusters --clusters rangex-prod

# ECR Repository
aws ecr describe-repositories --repository-names rangex-prod

# Running Tasks
aws ecs list-tasks --cluster rangex-prod
```

### 3. Test Application

```powershell
# Backend health
curl http://localhost:3000/health

# Frontend
curl http://localhost:5173

# API endpoints
curl http://localhost:3000/api/scenarios
```

---

## Troubleshooting

### Issue: Fargate Task Won't Start

**Symptoms**: Task stays in PENDING state

**Solutions**:
1. Check VPC endpoints:
   ```bash
   aws ec2 describe-vpc-endpoints --vpc-endpoint-ids vpce-xxx
   ```

2. Verify security groups:
   ```bash
   aws ec2 describe-security-groups --group-ids sg-xxx
   ```

3. Check task definition:
   ```bash
   aws ecs describe-task-definition --task-definition rangex-prod-scenario
   ```

4. View task logs (if syslog working):
   ```powershell
   Get-Content C:\rangex\logs\messages -Wait
   ```

### Issue: ECR Push Fails

**Symptoms**: `denied: Your authorization token has expired`

**Solution**:
```bash
# Re-authenticate
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin $ecrUri
```

### Issue: Syslog Not Receiving Logs

**Symptoms**: No logs in C:\rangex\logs\messages

**Solutions**:
1. Check firewall:
   ```powershell
   New-NetFirewallRule -DisplayName "Syslog TCP" -Direction Inbound -Protocol TCP -LocalPort 514 -Action Allow
   New-NetFirewallRule -DisplayName "Syslog UDP" -Direction Inbound -Protocol UDP -LocalPort 514 -Action Allow
   ```

2. Verify public IP in task definition:
   ```bash
   aws ecs describe-task-definition --task-definition rangex-prod-scenario --query 'taskDefinition.containerDefinitions[0].logConfiguration'
   ```

3. Test syslog locally:
   ```powershell
   "test message" | nc localhost 514
   ```

### Issue: Budget Alerts Not Working

**Symptoms**: No email when budget exceeds 80%

**Solutions**:
1. Verify budget exists:
   ```bash
   aws budgets describe-budgets --account-id YOUR_ACCOUNT_ID
   ```

2. Check email subscription:
   - AWS Console → Budgets → Alerts → Verify email

3. Manually trigger alert:
   ```bash
   curl -X POST http://localhost:3000/api/budget-monitor/manual-alert/1
   ```

---

## Cost Monitoring

### 1. AWS Cost Explorer

```bash
# Get current month cost
aws ce get-cost-and-usage \
  --time-period Start=$(date -u +%Y-%m-01),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://cost-filter.json
```

**cost-filter.json**:
```json
{
  "Tags": {
    "Key": "Project",
    "Values": ["rangex"]
  }
}
```

### 2. Real-Time Dashboard

Access: http://localhost:3000/admin/budget

**Features**:
- Current month cost
- Projected end-of-month cost
- Budget percentage used
- Top 5 cost drivers
- Grace period status

### 3. Cost Allocation Tags

All AWS resources are tagged with:
- `Project`: rangex
- `Environment`: prod
- `CostCenter`: engineering
- `Owner`: admin@rangex.com

View in AWS Console → Billing → Cost Allocation Tags

---

## Expected Monthly Costs

| Service | Cost (RM) | Notes |
|---------|-----------|-------|
| **AWS Services** |
| Fargate (4 tasks, 24/7) | RM 60 | 0.25 vCPU + 0.5 GB RAM |
| ECR (100 GB) | RM 10 | Image storage |
| VPC Interface Endpoints (2) | RM 20 | ECR DKR + API |
| VPC Gateway Endpoint (1) | RM 0 | S3 (FREE) |
| Data Transfer (5 GB) | RM 8 | Egress to internet |
| **Local Services** |
| MinIO (Electricity + Storage) | RM 20 | 500 GB HDD |
| MySQL (Electricity) | RM 0 | Minimal resources |
| Syslog (Electricity) | RM 16 | ELK stack resources |
| **TOTAL** | **RM 134** | 66% savings vs AWS-heavy |

**NOT USING** (Savings):
- ❌ Secrets Manager: RM 100/month saved
- ❌ CloudWatch Logs: RM 40/month saved
- ❌ NAT Gateway: RM 180/month saved
- ❌ Application Load Balancer: RM 80/month saved

**Total Savings**: RM 400/month (75% reduction)

---

## Next Steps

1. ✅ Local infrastructure deployed
2. ✅ AWS infrastructure deployed
3. ✅ Application running
4. ⏸ Set up SSL certificates (Let's Encrypt)
5. ⏸ Configure VPN for private access
6. ⏸ Set up automated backups (MySQL + MinIO)
7. ⏸ Configure Grafana dashboards
8. ⏸ Set up CI/CD pipeline (GitHub Actions)

---

## Support

- Documentation: `docs/`
- Issues: GitHub Issues
- Email: admin@rangex.com
