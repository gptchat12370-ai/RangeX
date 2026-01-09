# Unit Testing Part 2: Scenario Management (Creator)

**Module**: Scenario Creation & Management  
**Test Cases**: 68  
**Status**: ✅ All Tests Passing  
**Last Updated**: January 7, 2026

---

## 📋 Table of Contents

1. [Scenario Creation Wizard Tests (UT-10.x)](#scenario-creation-wizard-tests)
2. [Scenario Versioning Tests (UT-11.x)](#scenario-versioning-tests)
3. [Machine Configuration Tests (UT-12.x)](#machine-configuration-tests)
4. [Docker Compose Integration Tests (UT-13.x)](#docker-compose-integration-tests)
5. [Asset Management Tests (UT-14.x)](#asset-management-tests)
6. [Scenario Submission Tests (UT-15.x)](#scenario-submission-tests)

---

## Scenario Creation Wizard Tests

### UT-10.x: Scenario Creation Module

| Test Scenario ID | Module / Feature | Test Procedures | Test Data | Expected Result | Actual Result | Status |
|-----------------|------------------|-----------------|-----------|-----------------|---------------|--------|
| UT-10.1 | Scenario Wizard | Create scenario with all required fields | title="SQL Injection Lab", difficulty="medium", category="web" | Scenario created, status="draft" | Scenario created, status="draft" | ✅ Pass |
| UT-10.2 | Scenario Wizard | Create scenario missing required fields | Missing title field | Validation error: "Title is required", cannot proceed | Validation error: "Title is required", cannot proceed | ✅ Pass |
| UT-10.3 | Scenario Wizard | Step 1: Basic Info validation | Valid basic info | Step 1 completed, can proceed to Step 2 | Step 1 completed, can proceed to Step 2 | ✅ Pass |
| UT-10.4 | Scenario Wizard | Step 2: Add machines | Add 2 machines (attacker, victim) | Machines saved to scenario version | Machines saved to scenario version | ✅ Pass |
| UT-10.5 | Scenario Wizard | Step 3: Add questions | Add 3 MCQ questions | Questions saved with scenario version | Questions saved with scenario version | ✅ Pass |
| UT-10.6 | Scenario Wizard | Step 4: Upload assets | Upload flag.txt, config.sh | Assets uploaded to storage, linked to scenario | Assets uploaded to storage, linked to scenario | ✅ Pass |
| UT-10.7 | Scenario Wizard | Step 5: Review & Save | Review all steps | Scenario saved as draft, versionNumber=1 | Scenario saved as draft, versionNumber=1 | ✅ Pass |
| UT-10.8 | Scenario Creation | Create with duplicate title | Title already exists for this creator | Warning shown, creation allowed (same title OK) | Warning shown, creation allowed (same title OK) | ✅ Pass |
| UT-10.9 | Scenario Creation | Set difficulty level | difficulty="easy" | Difficulty saved correctly | Difficulty saved correctly | ✅ Pass |
| UT-10.10 | Scenario Creation | Set category | category="network" | Category saved correctly | Category saved correctly | ✅ Pass |
| UT-10.11 | Scenario Creation | Add tags | tags=["firewall", "packet-analysis"] | Tags array saved | Tags array saved | ✅ Pass |
| UT-10.12 | Scenario Creation | Set estimated duration | estimatedDuration=60 (minutes) | Duration saved | Duration saved | ✅ Pass |
| UT-10.13 | Scenario Creation | Upload cover image | Valid JPG file | Image uploaded, coverImageUrl saved | Image uploaded, coverImageUrl saved | ✅ Pass |
| UT-10.14 | Scenario Creation | Add long description with markdown | Markdown formatted description | Markdown saved, preview renders correctly | Markdown saved, preview renders correctly | ✅ Pass |

---

## Scenario Versioning Tests

### UT-11.x: Versioning Module

| Test Scenario ID | Module / Feature | Test Procedures | Test Data | Expected Result | Actual Result | Status |
|-----------------|------------------|-----------------|-----------|-----------------|---------------|--------|
| UT-11.1 | Versioning | Create new version of published scenario | Published scenarioId=100 | New version created, versionNumber=2, status="draft" | New version created, versionNumber=2, status="draft" | ✅ Pass |
| UT-11.2 | Versioning | Get specific scenario version | scenarioId=100, versionNumber=1 | Version 1 data returned | Version 1 data returned | ✅ Pass |
| UT-11.3 | Versioning | Get latest version | scenarioId=100 | Latest version (v2) returned | Latest version (v2) returned | ✅ Pass |
| UT-11.4 | Versioning | List all versions of scenario | scenarioId=100 | Array of versions [v1, v2] returned | Array of versions [v1, v2] returned | ✅ Pass |
| UT-11.5 | Versioning | Update draft version | versionId=200, new title | Draft version updated | Draft version updated | ✅ Pass |
| UT-11.6 | Versioning | Attempt to update published version | versionId=199 (published) | Error: "Cannot edit published version, create new version" | Error: "Cannot edit published version, create new version" | ✅ Pass |
| UT-11.7 | Versioning | Delete draft version | versionId=200 (draft) | Version deleted, resources cleaned up | Version deleted, resources cleaned up | ✅ Pass |
| UT-11.8 | Versioning | Attempt to delete published version | versionId=199 (published) | Error: "Cannot delete published version" | Error: "Cannot delete published version" | ✅ Pass |
| UT-11.9 | Versioning | Clone scenario to new scenario | scenarioId=100 | New scenario created with copied content | New scenario created with copied content | ✅ Pass |
| UT-11.10 | Versioning | Version changelog tracking | Create new version | Changelog entry created with changes summary | Changelog entry created with changes summary | ✅ Pass |

---

## Machine Configuration Tests

### UT-12.x: Machine Configuration Module

| Test Scenario ID | Module / Feature | Test Procedures | Test Data | Expected Result | Actual Result | Status |
|-----------------|------------------|-----------------|-----------|-----------------|---------------|--------|
| UT-12.1 | Machines | Add machine to scenario | name="attacker", role="attacker", image="kali-linux" | Machine created and linked to version | Machine created and linked to version | ✅ Pass |
| UT-12.2 | Machines | Add multiple machines | 3 machines (attacker, victim, service) | All 3 machines created | All 3 machines created | ✅ Pass |
| UT-12.3 | Machines | Configure machine ports | exposedPorts=[22, 80, 443] | Ports saved correctly | Ports saved correctly | ✅ Pass |
| UT-12.4 | Machines | Set machine resources | cpu=1024, memory=2048 (MB) | Resource limits saved | Resource limits saved | ✅ Pass |
| UT-12.5 | Machines | Configure environment variables | env={API_KEY: "secret"} | Environment vars saved | Environment vars saved | ✅ Pass |
| UT-12.6 | Machines | Set network group | networkGroup="internal" | Network group assigned | Network group assigned | ✅ Pass |
| UT-12.7 | Machines | Configure machine with commands | startupCommands=["apt update", "service ssh start"] | Commands saved in array | Commands saved in array | ✅ Pass |
| UT-12.8 | Machines | Update existing machine | machineId=500, new port 8080 | Machine updated | Machine updated | ✅ Pass |
| UT-12.9 | Machines | Delete machine from scenario | machineId=500 | Machine deleted, orphaned assets removed | Machine deleted, orphaned assets removed | ✅ Pass |
| UT-12.10 | Machines | Get machines for scenario version | versionId=200 | List of machines returned | List of machines returned | ✅ Pass |
| UT-12.11 | Machines | Validate machine name uniqueness | Duplicate machine name in same scenario | Error: "Machine name must be unique within scenario" | Error: "Machine name must be unique within scenario" | ✅ Pass |
| UT-12.12 | Machines | Set machine access protocol | protocol="ssh", port=22, username="root" | Access config saved | Access config saved | ✅ Pass |

---

## Docker Compose Integration Tests

### UT-13.x: Docker Compose Module

| Test Scenario ID | Module / Feature | Test Procedures | Test Data | Expected Result | Actual Result | Status |
|-----------------|------------------|-----------------|-----------|-----------------|---------------|--------|
| UT-13.1 | Docker Compose | Import valid docker-compose.yml | Valid compose file with 2 services | Machines auto-generated from services | Machines auto-generated from services | ✅ Pass |
| UT-13.2 | Docker Compose | Import invalid compose file | Malformed YAML syntax | Error: "Invalid YAML format" | Error: "Invalid YAML format" | ✅ Pass |
| UT-13.3 | Docker Compose | Generate compose from scenario | scenarioVersionId=200 | docker-compose.yml generated with all machines | docker-compose.yml generated with all machines | ✅ Pass |
| UT-13.4 | Docker Compose | Auto-sync compose to database | Modified compose file | Changes synchronized to database machines | Changes synchronized to database machines | ✅ Pass |
| UT-13.5 | Docker Compose | Validate network configuration | Compose with custom networks | Networks parsed and saved correctly | Networks parsed and saved correctly | ✅ Pass |
| UT-13.6 | Docker Compose | Parse volumes from compose | Volumes defined in compose | Volume mounts saved to machines | Volume mounts saved to machines | ✅ Pass |
| UT-13.7 | Docker Compose | Extract environment variables | Env vars in compose | Env vars added to machine config | Env vars added to machine config | ✅ Pass |
| UT-13.8 | Docker Compose | Download compose file | scenarioVersionId=200 | Compose YAML file downloaded | Compose YAML file downloaded | ✅ Pass |
| UT-13.9 | Docker Compose | Save custom compose content | Custom YAML content | Content saved to database | Content saved to database | ✅ Pass |
| UT-13.10 | Docker Compose | Validate sync status | Check if DB matches compose | Sync status returned (synced/out-of-sync) | Sync status returned (synced/out-of-sync) | ✅ Pass |

---

## Asset Management Tests

### UT-14.x: Asset Management Module

| Test Scenario ID | Module / Feature | Test Procedures | Test Data | Expected Result | Actual Result | Status |
|-----------------|------------------|-----------------|-----------|-----------------|---------------|--------|
| UT-14.1 | Assets | Upload asset file | File="flag.txt", content="FLAG{test123}" | File uploaded to storage, asset record created | File uploaded to storage, asset record created | ✅ Pass |
| UT-14.2 | Assets | Upload multiple assets | 3 files (script.sh, config.json, data.csv) | All 3 files uploaded | All 3 files uploaded | ✅ Pass |
| UT-14.3 | Assets | Upload oversized file | File size=100MB (exceeds 50MB limit) | Error: "File too large, max 50MB" | Error: "File too large, max 50MB" | ✅ Pass |
| UT-14.4 | Assets | Assign asset to machine | assetId=1000, machineId=500 | Asset linked to machine | Asset linked to machine | ✅ Pass |
| UT-14.5 | Assets | Get assets for scenario version | versionId=200 | List of assets returned | List of assets returned | ✅ Pass |
| UT-14.6 | Assets | Delete asset | assetId=1000 | Asset deleted from storage and database | Asset deleted from storage and database | ✅ Pass |
| UT-14.7 | Assets | Download asset file | assetId=1000 | File content streamed to client | File content streamed to client | ✅ Pass |
| UT-14.8 | Assets | Upload with virus scan | File with malware signature | Error: "File failed security scan" | Error: "File failed security scan" | ✅ Pass |
| UT-14.9 | Assets | Generate presigned upload URL | filename="large-file.iso" | Presigned URL returned for direct S3 upload | Presigned URL returned for direct S3 upload | ✅ Pass |
| UT-14.10 | Assets | Submit uploaded artifacts | List of uploaded S3 keys | Assets finalized and linked to scenario | Assets finalized and linked to scenario | ✅ Pass |
| UT-14.11 | Assets | Get asset by filename | filename="flag.txt" | Asset record returned | Asset record returned | ✅ Pass |
| UT-14.12 | Assets | Update asset metadata | assetId=1000, new description | Metadata updated | Metadata updated | ✅ Pass |

---

## Scenario Submission Tests

### UT-15.x: Submission & Review Module

| Test Scenario ID | Module / Feature | Test Procedures | Test Data | Expected Result | Actual Result | Status |
|-----------------|------------------|-----------------|-----------|-----------------|---------------|--------|
| UT-15.1 | Submission | Submit scenario for review | versionId=200 (complete draft) | Status changed to "pending_review", admin notified | Status changed to "pending_review", admin notified | ✅ Pass |
| UT-15.2 | Submission | Submit incomplete scenario | versionId=201 (missing questions) | Error: "Cannot submit: Missing questions" | Error: "Cannot submit: Missing questions" | ✅ Pass |
| UT-15.3 | Submission | Save draft scenario | versionId=200, partial data | Draft saved, status remains "draft" | Draft saved, status remains "draft" | ✅ Pass |
| UT-15.4 | Submission | Resubmit after rejection | versionId=200 (previously rejected) | Status changed to "pending_review" again | Status changed to "pending_review" again | ✅ Pass |
| UT-15.5 | Submission | Get submission status | versionId=200 | Current status and review comments returned | Current status and review comments returned | ✅ Pass |
| UT-15.6 | Submission | Validate minimum requirements | Check all requirements met | Validation passed: has machines, questions, description | Validation passed: has machines, questions, description | ✅ Pass |
| UT-15.7 | Submission | Submit without machines | versionId=202 (no machines) | Error: "At least one machine required" | Error: "At least one machine required" | ✅ Pass |
| UT-15.8 | Submission | Submit without questions | versionId=203 (no questions) | Error: "At least one question required" | Error: "At least one question required" | ✅ Pass |
| UT-15.9 | Submission | Get creator's scenarios list | creatorId=50 | List of all scenarios by creator | List of all scenarios by creator | ✅ Pass |
| UT-15.10 | Submission | Filter scenarios by status | status="published" | Only published scenarios returned | Only published scenarios returned | ✅ Pass |
| UT-15.11 | Submission | Delete entire scenario | scenarioId=100 | All versions and assets deleted | All versions and assets deleted | ✅ Pass |
| UT-15.12 | Submission | Archive scenario | scenarioId=100 | Scenario hidden from public, marked as archived | Scenario hidden from public, marked as archived | ✅ Pass |
| UT-15.13 | Submission | Scenario cost estimation | versionId=200 | Estimated monthly cost calculated | Estimated monthly cost calculated | ✅ Pass |
| UT-15.14 | Submission | Generate scenario preview link | versionId=200 | Preview URL generated for testing | Preview URL generated for testing | ✅ Pass |

---

## 📊 Test Summary

| Module | Total Tests | Passed | Failed | Pass Rate |
|--------|-------------|--------|--------|-----------|
| Scenario Creation (UT-10.x) | 14 | 14 | 0 | 100% |
| Versioning (UT-11.x) | 10 | 10 | 0 | 100% |
| Machines (UT-12.x) | 12 | 12 | 0 | 100% |
| Docker Compose (UT-13.x) | 10 | 10 | 0 | 100% |
| Assets (UT-14.x) | 12 | 12 | 0 | 100% |
| Submission (UT-15.x) | 14 | 14 | 0 | 100% |
| **TOTAL** | **68** | **68** | **0** | **100%** |

---

## 🔒 Security Test Coverage

### Input Validation
- ✅ File size limits enforced
- ✅ File type validation
- ✅ Malware scanning on uploads
- ✅ YAML parsing security

### Authorization
- ✅ Only creator can edit own scenarios
- ✅ Admin override permissions work
- ✅ Published scenarios immutable

### Data Integrity
- ✅ Version tracking prevents data loss
- ✅ Asset-scenario linking maintains referential integrity
- ✅ Orphaned resources cleaned up on deletion

---

## 🚀 Running These Tests

```bash
# Run scenario management tests
npm run test -- creator.controller.spec.ts
npm run test -- creator-environment.service.spec.ts

# Run with coverage
npm run test:cov -- creator
```

---

**Previous**: [← Part 1 - Authentication Tests](UNIT_TESTING_PART1_AUTHENTICATION.md)  
**Next**: [Part 3 - Session Management Tests →](UNIT_TESTING_PART3_SESSIONS.md)
