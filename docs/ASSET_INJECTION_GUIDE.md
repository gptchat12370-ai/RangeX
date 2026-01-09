# Asset Injection Implementation - Complete Flow

## Overview

This document explains how files (flags, vulnerable code, configurations) are uploaded and injected into scenario containers.

## Architecture Flow

```
1. Creator uploads file (flag.txt)
   ↓
2. File stored in MinIO (rangex-assets bucket)
   ↓
3. Creator assigns to machine with target path
   ↓
4. Saved to scenario_asset table with machineId + targetPath
   ↓
5. Student starts scenario
   ↓
6. DockerComposeGeneratorService generates docker-compose.yml
   ↓
7. Assets mounted as Docker volumes
   ↓
8. Containers start with files injected at specified paths
```

## Database Schema

### scenario_asset Table

```sql
CREATE TABLE scenario_asset (
  id VARCHAR(36) PRIMARY KEY,
  scenarioVersionId VARCHAR(255) NOT NULL,
  machineId VARCHAR(255) NULL,              -- FK to machine.id
  assetType ENUM('tool','script','file','wordlist','config'),
  fileName VARCHAR(255) NOT NULL,
  fileUrl VARCHAR(500) NOT NULL,            -- MinIO URL
  fileSize INT,
  targetPath VARCHAR(500) NULL,             -- Container path e.g., /root/flag.txt
  permissions VARCHAR(10) DEFAULT '0644',   -- File permissions
  description TEXT NULL,                    -- Purpose explanation
  uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (scenarioVersionId) REFERENCES scenario_version(id) ON DELETE CASCADE,
  FOREIGN KEY (machineId) REFERENCES machine(id) ON DELETE CASCADE
);
```

## Backend Implementation

### 1. Upload Endpoint (creator.controller.ts)

**POST** `/scenarios/:scenarioId/versions/:versionId/upload-asset`

**Request Body** (multipart/form-data):
```typescript
{
  file: File,                    // The actual file
  assetType: 'file' | 'config' | 'tool' | 'script',
  machineId: string,             // UUID of target machine (optional)
  targetPath: string,            // e.g., "/var/www/html/flag.txt"
  permissions: string,           // e.g., "0644", "0755"
  description: string            // Purpose explanation
}
```

**Upload Process**:
1. Validate file (max 50MB)
2. Validate assetType
3. **NEW**: Validate machineId exists
4. **NEW**: Validate targetPath is absolute (starts with /)
5. Upload to MinIO: `scenarios/{scenarioId}/assets/{assetType}s/{uuid}-{filename}`
6. **NEW**: Save with machineId, targetPath, permissions to database

**Response**:
```json
{
  "id": "asset-uuid",
  "url": "http://minio:9000/rangex-assets/scenarios/xyz/assets/files/flag.txt",
  "fileName": "flag.txt",
  "assetType": "file",
  "fileSize": 1024,
  "machineId": "machine-uuid",
  "targetPath": "/root/flag.txt",
  "permissions": "0644",
  "message": "Asset uploaded successfully"
}
```

### 2. Docker Compose Generator Service

**File**: `backend/src/services/docker-compose-generator.service.ts`

**Purpose**: Generate docker-compose.yml with volume mounts for assets

**Key Method**: `generateDockerCompose(scenarioVersionId, sessionId)`

**Process**:
```typescript
1. Load all machines for scenario version
2. Load all assets for scenario version
3. For each machine:
   a. Create Docker service definition
   b. Find assets assigned to this machine (asset.machineId === machine.id)
   c. Generate volume mounts:
      - Source: /tmp/rangex/{sessionId}/assets/{assetId}/{fileName}
      - Target: {asset.targetPath}
      - Mode: ro (read-only) or rw based on permissions
   d. Add to services
4. Generate networks based on machine.networkGroup
5. Return docker-compose configuration
```

**Example Generated docker-compose.yml**:
```yaml
version: '3.8'
services:
  web_server:
    image: minio.rangex.local:9000/rangex-assets/dvwa:latest
    container_name: session123-web_server
    hostname: web_server
    volumes:
      - /tmp/rangex/session123/assets/asset-uuid-1/vuln-login.php:/var/www/html/login.php:ro
      - /tmp/rangex/session123/assets/asset-uuid-2/flag.txt:/root/flag.txt:ro
      - /tmp/rangex/session123/assets/asset-uuid-3/config.ini:/etc/app/config.ini:rw
    networks:
      - dmz
  
  mysql_server:
    image: minio.rangex.local:9000/rangex-assets/mysql:8.0
    container_name: session123-mysql_server
    hostname: mysql_server
    volumes:
      - /tmp/rangex/session123/assets/asset-uuid-4/secret.sql:/docker-entrypoint-initdb.d/01-secret.sql:ro
    networks:
      - internal

networks:
  dmz:
    driver: bridge
    ipam:
      config:
        - subnet: 172.18.1.0/24
  internal:
    driver: bridge
    ipam:
      config:
        - subnet: 172.18.2.0/24
```

### 3. Asset Preparation Service

**Method**: `prepareAssets(scenarioVersionId, sessionId)`

**Purpose**: Download assets from MinIO to local filesystem before docker-compose up

**Process**:
```typescript
1. Load all assets for scenario version
2. For each asset:
   a. Parse MinIO URL to get bucket + object key
   b. Download file stream from MinIO
   c. Save to /tmp/rangex/{sessionId}/assets/{assetId}/{fileName}
   d. Set file permissions based on asset.permissions
3. Return list of prepared asset paths
```

**Storage Locations**:
- **Development**: `/tmp/rangex/{sessionId}/assets/`
- **Production (Fargate)**: EFS mount at `/mnt/efs/rangex/{sessionId}/assets/`

## Frontend Implementation

### Asset Upload & Assignment UI

**Location**: `frontend/src/components/creator/AssetsPanel.tsx` (to be created)

**Features**:
1. **File Upload Section**:
   - Drag & drop or browse to upload
   - Asset type selector (Flag, Config, Tool, Script)
   - File size validation (max 50MB)

2. **Machine Assignment Dialog**:
   - Triggered after file upload
   - Machine dropdown (filtered by scenario version)
   - Target path input with examples:
     ```
     Web Server files: /var/www/html/
     Database scripts: /docker-entrypoint-initdb.d/
     User home: /home/user/
     Root home: /root/
     Configuration: /etc/app/
     ```
   - Permission selector:
     - 0644 (read-only for owner, read for others)
     - 0755 (executable)
     - 0777 (full access - not recommended)
   - Description text area (explain purpose)

3. **Assets List**:
   - Table showing uploaded assets
   - Columns: Name, Type, Machine, Target Path, Size, Actions
   - Actions: View, Edit Assignment, Delete

**Example UI Flow**:
```
1. Creator clicks "Upload Asset" button
2. Selects file: flag.txt
3. Selects asset type: "Flag"
4. Modal opens: "Assign to Machine"
5. Selects machine: "MySQL Server"
6. Enters target path: "/root/flag.txt"
7. Selects permissions: "0644"
8. Enters description: "Root flag for privilege escalation challenge"
9. Clicks "Upload & Assign"
10. File uploaded to MinIO, metadata saved with machineId
11. Asset appears in table with green "Assigned" badge
```

## Deployment Flow

### Scenario Launch Process

**When student starts scenario**:

```typescript
1. SessionService.createSession()
   ↓
2. DockerComposeGeneratorService.generateDockerCompose(scenarioVersionId, sessionId)
   ↓
3. DockerComposeGeneratorService.prepareAssets(scenarioVersionId, sessionId)
   - Downloads files from MinIO to /tmp/rangex/{sessionId}/assets/
   ↓
4. DockerComposeGeneratorService.exportAsYAML()
   - Generates docker-compose.yml with volume mounts
   ↓
5. Save docker-compose.yml to /tmp/rangex/{sessionId}/docker-compose.yml
   ↓
6. Execute: docker-compose -f /tmp/rangex/{sessionId}/docker-compose.yml up -d
   ↓
7. Containers start with assets mounted at specified paths
   ↓
8. Student can access files inside containers
```

### AWS Fargate Deployment

**In production**, assets are handled differently:

1. **EFS Storage**: Assets downloaded to EFS volume
   ```
   /mnt/efs/rangex/{sessionId}/assets/{assetId}/{fileName}
   ```

2. **Init Container**: Fargate task includes init container
   ```yaml
   initContainers:
     - name: asset-downloader
       image: rangex/asset-downloader
       command:
         - /bin/sh
         - -c
         - |
           # Download assets from S3/ECR
           aws s3 cp s3://rangex-assets/scenarios/xyz/ /mnt/assets/ --recursive
           # Set permissions
           chmod 0644 /mnt/assets/flag.txt
       volumeMounts:
         - name: assets
           mountPath: /mnt/assets
   ```

3. **Volume Mounts**: Same volume mounted to scenario containers
   ```yaml
   containers:
     - name: web-server
       volumeMounts:
         - name: assets
           mountPath: /var/www/html/flag.txt
           subPath: assets/flag.txt
           readOnly: true
   ```

## Security Considerations

### File Validation

**Upload Restrictions**:
- Max size: 50MB per file
- Allowed types: Any (binary, text, scripts)
- Content scanning: ❌ Not implemented (TODO: virus scanning)

**Path Validation**:
- Target path must be absolute (start with /)
- No directory traversal: `../../etc/passwd` → rejected
- Length limit: 500 characters

### Permission Management

**Supported Modes**:
- `0644`: Read-only for owner, read for group/others
- `0755`: Executable for owner, read+execute for others
- `0777`: Full access (⚠️ use with caution)

**Default**: `0644` (read-only)

### Isolation

**MinIO Access**:
- Assets stored in isolated buckets per scenario
- Pre-signed URLs with expiration (15 minutes)
- No public access allowed

**Container Isolation**:
- Read-only mounts by default
- Network segmentation per scenario
- No shared volumes between scenarios

## Testing Guide

### 1. Test Asset Upload

```bash
# Upload flag file
curl -X POST http://localhost:3000/creator/scenarios/{scenarioId}/versions/{versionId}/upload-asset \
  -H "Authorization: Bearer {token}" \
  -F "file=@flag.txt" \
  -F "assetType=file" \
  -F "machineId={machineId}" \
  -F "targetPath=/root/flag.txt" \
  -F "permissions=0644" \
  -F "description=Root flag for privilege escalation"
```

### 2. Test Docker Compose Generation

```typescript
// In backend console
const generator = new DockerComposeGeneratorService(machineRepo, assetRepo, minioService);
const compose = await generator.generateDockerCompose(versionId, 'test-session-123');
const yaml = generator.exportAsYAML(compose);
console.log(yaml);
```

### 3. Test Asset Injection

```bash
# 1. Prepare assets
mkdir -p /tmp/rangex/test-session/assets/asset-123/
echo "FLAG{test_flag}" > /tmp/rangex/test-session/assets/asset-123/flag.txt

# 2. Create docker-compose.yml with volume mount
cat > /tmp/rangex/test-session/docker-compose.yml <<EOF
version: '3.8'
services:
  test:
    image: alpine:latest
    command: cat /root/flag.txt
    volumes:
      - /tmp/rangex/test-session/assets/asset-123/flag.txt:/root/flag.txt:ro
EOF

# 3. Run container
docker-compose -f /tmp/rangex/test-session/docker-compose.yml up

# Expected output: FLAG{test_flag}
```

### 4. Test Complete Flow

```bash
# 1. Create scenario with machines
# 2. Upload 3 assets:
#    - flag.txt → MySQL Server → /root/flag.txt
#    - vuln.php → Web Server → /var/www/html/login.php
#    - config.ini → Web Server → /etc/app/config.ini
# 3. Launch scenario
# 4. Access containers:
docker exec {sessionId}-mysql_server cat /root/flag.txt
docker exec {sessionId}-web_server cat /var/www/html/login.php
docker exec {sessionId}-web_server cat /etc/app/config.ini
# 5. Verify files exist with correct content
```

## Common Use Cases

### 1. Capture The Flag (CTF)

**Scenario**: Web application with hidden flag

**Assets**:
- `flag.txt` → Web Server → `/var/www/html/.hidden/flag.txt` (0644)
- `db-backup.sql` → Database → `/docker-entrypoint-initdb.d/backup.sql` (0644)

**Student Objective**: Find SQL injection vulnerability, dump database, locate flag file

### 2. Privilege Escalation

**Scenario**: Linux system with SUID vulnerability

**Assets**:
- `flag.txt` → Target Server → `/root/flag.txt` (0600)
- `vulnerable-script.sh` → Target Server → `/usr/local/bin/backup.sh` (4755 SUID)

**Student Objective**: Exploit SUID script to read /root/flag.txt

### 3. Vulnerable Code Injection

**Scenario**: PHP application with code injection

**Assets**:
- `vuln-upload.php` → Web Server → `/var/www/html/upload.php` (0644)
- `webshell.php` → Attacker Machine → `/root/tools/webshell.php` (0755)

**Student Objective**: Upload malicious file, execute commands

## API Reference

### Upload Asset

```http
POST /creator/scenarios/:scenarioId/versions/:versionId/upload-asset
Authorization: Bearer {token}
Content-Type: multipart/form-data

{
  "file": File,
  "assetType": "file" | "config" | "tool" | "script",
  "machineId": "uuid",
  "targetPath": "/absolute/path/in/container",
  "permissions": "0644" | "0755" | "0777",
  "description": "Purpose explanation"
}
```

### List Assets

```http
GET /creator/scenarios/:scenarioId/versions/:versionId/assets
Authorization: Bearer {token}

Response: [
  {
    "id": "uuid",
    "fileName": "flag.txt",
    "assetType": "file",
    "fileSize": 1024,
    "machineId": "uuid",
    "machineName": "Web Server",
    "targetPath": "/root/flag.txt",
    "permissions": "0644",
    "description": "Root flag",
    "uploadedAt": "2024-01-01T12:00:00Z"
  }
]
```

### Update Asset Assignment

```http
PATCH /creator/assets/:assetId/assign
Authorization: Bearer {token}
Content-Type: application/json

{
  "machineId": "uuid",
  "targetPath": "/new/path",
  "permissions": "0755",
  "description": "Updated purpose"
}
```

### Delete Asset

```http
DELETE /creator/scenarios/:scenarioId/versions/:versionId/asset
Authorization: Bearer {token}
Content-Type: application/json

{
  "fileUrl": "http://minio:9000/rangex-assets/..."
}
```

## Next Steps

### Immediate TODOs

1. ✅ Update scenario-asset entity with machineId, targetPath, permissions
2. ✅ Create SQL migration to add columns
3. ✅ Update uploadAsset endpoint to accept assignment parameters
4. ✅ Create DockerComposeGeneratorService
5. ⏳ Create AssetsPanel frontend component
6. ⏳ Create AssetAssignmentDialog component
7. ⏳ Implement prepareAssets() download logic
8. ⏳ Integrate with scenario launch flow
9. ⏳ Add asset management endpoints (list, update, delete)
10. ⏳ Add file content validation
11. ⏳ Add virus scanning integration
12. ⏳ Add EFS storage for Fargate

### Future Enhancements

- **Asset Templates**: Pre-configured asset bundles (SQLi challenges, XSS challenges)
- **Dynamic Assets**: Generate files based on scenario parameters (random flags)
- **Asset Versioning**: Track changes to uploaded files
- **Bulk Upload**: Upload multiple files at once
- **Asset Preview**: View file contents before deployment
- **Permission Presets**: Quick select common permission patterns
- **Path Autocomplete**: Suggest common paths based on machine image type

## Support

For questions or issues:
- Check logs: `docker logs {container-name}`
- MinIO UI: http://localhost:9001
- Database: `SELECT * FROM scenario_asset WHERE scenarioVersionId = '...'`
- Backend logs: Check NestJS console output
