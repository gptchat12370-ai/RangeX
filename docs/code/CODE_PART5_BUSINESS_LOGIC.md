# Code Documentation - Part 5: Business Logic Services

[← Back to Code Documentation Index](CODE_DOCUMENTATION_INDEX.md)

This document showcases the business logic services that implement core features like answer validation, badge awarding, session lifecycle, and security checks.

---

## 📑 Table of Contents
1. [Submission Validation Service - Security Policy Checks](#1-submission-validation-service---security-policy-checks)
2. [Badges Service - Gamification System](#2-badges-service---gamification-system)
3. [Sessions Service - Lifecycle Management](#3-sessions-service---lifecycle-management)

---

## 1. Submission Validation Service - Security Policy Checks

**File:** `backend/src/services/submission-validation.service.ts`

### Code Snippet (Lines 1-150)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { MinioService } from './minio.service';
import { JobQueueService } from './job-queue.service';
import * as yaml from 'js-yaml';

export interface ValidationReport {
  versionId: string;
  timestamp: Date;
  hardBlocks: Array<{ check: string; message: string; severity: 'critical' }>;
  warnings: Array<{ check: string; message: string; severity: 'warning' }>;
  passed: boolean;
}

@Injectable()
export class SubmissionValidationService {
  private readonly logger = new Logger(SubmissionValidationService.name);

  constructor(
    @InjectRepository(ScenarioVersion)
    private readonly versionRepo: Repository<ScenarioVersion>,
    private readonly minioService: MinioService,
    private readonly jobQueue: JobQueueService,
  ) {}

  /**
   * Validate a submitted scenario version
   * Phase 2: Automated policy checks
   */
  async validateSubmission(versionId: string): Promise<ValidationReport> {
    this.logger.log(`Starting validation for version ${versionId}`);

    const report: ValidationReport = {
      versionId,
      timestamp: new Date(),
      hardBlocks: [],
      warnings: [],
      passed: true,
    };

    try {
      // Download compose from staging
      const composeContent = await this.minioService.downloadObject(
        'rangex-staging',
        `scenarios/${versionId}/compose.yml`
      );

      // Parse compose YAML
      let compose: any;
      try {
        compose = yaml.load(composeContent);
      } catch (yamlError) {
        report.hardBlocks.push({
          check: 'compose_parse',
          message: 'Invalid YAML syntax in docker-compose.yml',
          severity: 'critical',
        });
        report.passed = false;
        return report;
      }

      // Run validation checks
      await this.checkPrivilegedContainers(compose, report);
      await this.checkHostNetworking(compose, report);
      await this.checkResourceLimits(compose, report);
      await this.checkPortAllowlist(compose, report);
      await this.checkImageSizeLimits(versionId, report);
      await this.checkAssetSizeLimits(versionId, report);

      // Update passed status based on hard blocks
      report.passed = report.hardBlocks.length === 0;

      // Store validation report
      await this.minioService.uploadFile(
        Buffer.from(JSON.stringify(report, null, 2)),
        `scenarios/${versionId}/validation/report.json`,
        'rangex-staging',
      );

      // Update version status
      if (report.hardBlocks.length > 0) {
        await this.versionRepo.update(versionId, { status: 'validation_failed' as any });
        this.logger.warn(
          `Validation failed for version ${versionId}: ${report.hardBlocks.length} hard blocks`,
        );
      } else {
        // Enqueue security scan job (Trivy)
        await this.jobQueue.enqueue('SCAN_SUBMISSION', {
          versionId,
          bucketPrefix: `scenarios/${versionId}`,
        });
        await this.versionRepo.update(versionId, { status: 'scanning' as any });
        this.logger.log(
          `Validation passed for version ${versionId}. Enqueued security scan. Warnings: ${report.warnings.length}`,
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Validation error for version ${versionId}: ${errorMessage}`);
      report.hardBlocks.push({
        check: 'validation_error',
        message: `Validation failed: ${errorMessage}`,
        severity: 'critical',
      });
      report.passed = false;
    }

    return report;
  }

  /**
   * Check for privileged containers (security policy)
   * Hard block: Privileged mode grants container full host access
   */
  private async checkPrivilegedContainers(
    compose: any,
    report: ValidationReport,
  ): Promise<void> {
    if (!compose.services) return;

    for (const [serviceName, service] of Object.entries<any>(compose.services)) {
      if (service.privileged === true) {
        report.hardBlocks.push({
          check: 'privileged_container',
          message: `Service "${serviceName}" uses privileged mode. This is not allowed for security reasons.`,
          severity: 'critical',
        });
      }

      // Check for cap_add: ALL or SYS_ADMIN
      if (service.cap_add) {
        const dangerousCaps = ['ALL', 'SYS_ADMIN', 'SYS_MODULE', 'SYS_RAWIO'];
        const caps = Array.isArray(service.cap_add) ? service.cap_add : [service.cap_add];
        const foundDangerous = caps.filter((cap: string) => dangerousCaps.includes(cap.toUpperCase()));
        
        if (foundDangerous.length > 0) {
          report.hardBlocks.push({
            check: 'dangerous_capabilities',
            message: `Service "${serviceName}" requests dangerous capabilities: ${foundDangerous.join(', ')}`,
            severity: 'critical',
          });
        }
      }
    }
  }
```

### Line-by-Line Explanation

**Lines 1-7:** Imports
- `@Injectable()` - NestJS dependency injection
- `Repository` - TypeORM database access
- `yaml` - Parse docker-compose.yml files

**Lines 9-15:** ValidationReport interface
- `hardBlocks` - Critical issues (blocks approval)
- `warnings` - Non-critical issues (approval proceeds)
- `passed` - Boolean summary (no hard blocks = pass)

**Lines 17-26:** Constructor with dependency injection
- `versionRepo` - Query ScenarioVersion database
- `minioService` - Download files from MinIO (S3-compatible)
- `jobQueue` - Enqueue background jobs (Trivy scans)

**Lines 32-40:** Initialize validation report
- Every validation creates a report with timestamp
- `hardBlocks` and `warnings` start empty
- `passed: true` until a hard block is found

**Lines 42-47:** Download docker-compose.yml
- **CRITICAL**: Compose file stored in MinIO staging bucket
- Path: `scenarios/{versionId}/compose.yml`
- This is the file creator uploaded during submission

**Lines 49-60:** YAML parsing
- Attempts to parse compose content
- If YAML is invalid (syntax error), **immediate hard block**
- Example: Missing colon in YAML = critical error

**Lines 62-68:** Run all validation checks
- `checkPrivilegedContainers()` - Security policy (no privileged mode)
- `checkHostNetworking()` - Security policy (no host networking)
- `checkResourceLimits()` - Cost control (CPU/RAM limits required)
- `checkPortAllowlist()` - Security policy (only allowed ports)
- `checkImageSizeLimits()` - Cost control (image size < 5GB)
- `checkAssetSizeLimits()` - Cost control (assets < 2GB)

**Lines 70-71:** Final pass/fail decision
- `passed = true` only if `hardBlocks.length === 0`
- Warnings don't affect pass status

**Lines 73-78:** Store validation report
- Upload report JSON to MinIO
- Path: `scenarios/{versionId}/validation/report.json`
- Admins can download this to see specific failures

**Lines 80-86:** Handle validation failure
- If hard blocks exist, update status to `validation_failed`
- Creator will see rejection with specific reasons
- No further processing (stops pipeline)

**Lines 87-97:** Handle validation success
- Enqueue security scan job (Trivy vulnerability scanner)
- Update status to `scanning`
- Pipeline continues to next phase

**Lines 98-108:** Error handling
- Catch unexpected errors (e.g., MinIO connection failure)
- Add as hard block with error message
- Mark validation as failed

**Lines 115-149:** Privileged container check
- **WHY CRITICAL**: `privileged: true` gives container root access to host
- Security risk: Malicious creator could escape container
- Also checks `cap_add` for dangerous capabilities (SYS_ADMIN, etc.)
- Example violation: `cap_add: [ALL]` = hard block

### WHY This Matters

- **Security Gate**: Prevents malicious or insecure scenarios from being deployed
- **Automated Policy**: No human judgment needed for basic security checks
- **Cost Control**: Enforces resource limits to prevent AWS bill spikes
- **Transparency**: Validation report shows creators exactly what's wrong

### Key Takeaways

✅ **Automated Security Checks**: Blocks privileged containers, host networking, dangerous ports  
✅ **Policy Enforcement**: Hard blocks = rejection, warnings = proceed with caution  
✅ **Pipeline Integration**: Enqueues Trivy scan after passing validation  
✅ **Transparent Feedback**: Validation report stored in MinIO for creator review

---

## 2. Badges Service - Gamification System

**File:** `backend/src/services/badges.service.ts`

### Code Snippet (Lines 1-70)

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Badge } from '../entities/badge.entity';
import { UserBadge } from '../entities/user-badge.entity';
import { User } from '../entities/user.entity';
import { EnvironmentSession } from '../entities/environment-session.entity';

@Injectable()
export class BadgesService {
  constructor(
    @InjectRepository(Badge) private readonly badgeRepo: Repository<Badge>,
    @InjectRepository(UserBadge) private readonly userBadgeRepo: Repository<UserBadge>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(EnvironmentSession) private readonly sessionRepo: Repository<EnvironmentSession>,
  ) {}

  async awardBadges() {
    const users = await this.userRepo.find();
    const badges = await this.badgeRepo.find();

    for (const user of users) {
      for (const badge of badges) {
        const hasBadge = await this.userBadgeRepo.findOne({ where: { userId: user.id, badgeId: badge.id } });
        if (hasBadge) {
          continue;
        }

        const [criteriaType, criteriaValue] = badge.criteria.split('_');
        const value = parseInt(criteriaValue, 10);

        if (criteriaType === 'challenges' && (await this.getCompletedChallenges(user.id)) >= value) {
          await this.awardBadge(user.id, badge.id);
        }
      }
    }
  }

  private async getCompletedChallenges(userId: string): Promise<number> {
    return this.sessionRepo.count({ where: { userId, status: 'terminated' } });
  }

  private async awardBadge(userId: string, badgeId: string) {
    const userBadge = this.userBadgeRepo.create({ userId, badgeId });
    await this.userBadgeRepo.save(userBadge);
  }

  async createBadge(badgeData: { name: string; description: string; iconUrl: string; criteria: string }) {
    const badge = this.badgeRepo.create(badgeData);
    return this.badgeRepo.save(badge);
  }

  async updateBadge(badgeId: string, badgeData: { name?: string; description?: string; iconUrl?: string; criteria?: string }) {
    await this.badgeRepo.update(badgeId, badgeData);
    return this.badgeRepo.findOne({ where: { id: badgeId } });
  }

  async deleteBadge(badgeId: string) {
    await this.badgeRepo.delete(badgeId);
    return { deleted: true };
  }

  async delete(badgeId: string) {
    await this.badgeRepo.delete(badgeId);
    return { deleted: true };
  }

  async listBadges() {
    return this.badgeRepo.find();
  }
}
```

### Line-by-Line Explanation

**Lines 9-16:** Dependency injection
- `badgeRepo` - Badge definitions (First Win, Challenge Master, etc.)
- `userBadgeRepo` - Join table (which users have which badges)
- `userRepo` - User accounts
- `sessionRepo` - Used to count completed challenges

**Lines 18-36:** Badge awarding algorithm
- **Line 19**: Get all users
- **Line 20**: Get all badge definitions
- **Lines 22-35**: Nested loops - check each badge for each user
- **Line 24**: Skip if user already has badge (idempotent)
- **Line 29**: Parse criteria string (e.g., "challenges_10" → type="challenges", value=10)
- **Line 32**: Award badge if user meets criteria

**Lines 38-40:** Count completed challenges
- Query `environment_session` table for `status = 'terminated'`
- Terminated = successfully completed (not stopped early)

**Lines 42-45:** Award badge to user
- Creates entry in `user_badge` join table
- This is many-to-many relationship

**Lines 47-50:** Create badge (admin function)
- `name` - "Challenge Master"
- `description` - "Complete 10 challenges"
- `iconUrl` - S3/MinIO path to badge icon
- `criteria` - "challenges_10" (parsed in line 29)

**Lines 52-55:** Update badge
- Admins can edit badge definitions
- Returns updated badge

**Lines 57-65:** Delete badge
- Two identical methods (backwards compatibility?)
- Deletes badge definition (cascades to user_badge entries)

**Lines 67-69:** List all badges
- Used by UI to display badge gallery

### WHY This Matters

- **Gamification**: Motivates users to complete more challenges
- **Criteria-Based**: Flexible string format allows various achievement types
- **Idempotent**: Running `awardBadges()` multiple times won't duplicate awards
- **Admin Control**: Badges fully configurable (create/update/delete)

### Key Takeaways

✅ **Automatic Awarding**: `awardBadges()` runs periodically (e.g., cron job) to check all users  
✅ **Criteria String Format**: `"challenges_10"` → Award if user completed 10+ challenges  
✅ **Idempotent Logic**: Checks `hasBadge` before awarding (prevents duplicates)  
✅ **Admin CRUD**: Full create/update/delete for badge management

---

## 3. Sessions Service - Lifecycle Management

**File:** `backend/src/services/sessions.service.ts`

### Code Snippet (Lines 1-60)

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../entities/event.entity';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(EnvironmentSession)
    private readonly sessionRepository: Repository<EnvironmentSession>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll() {
    const sessions = await this.sessionRepository.find({
      relations: ['environmentMachines'],
      order: { startedAt: 'DESC' },
      take: 100,
    });

    // Load user emails separately since there's no user relation
    const userIds = [...new Set(sessions.map(s => s.userId))];
    const users = await this.userRepository.find({
      where: userIds.map(id => ({ id })),
      select: ['id', 'email']
    });
    
    const userMap = new Map(users.map(u => [u.id, u.email]));

    return sessions.map(session => ({
      ...session,
      userEmail: userMap.get(session.userId) || 'Unknown',
      idleMinutes: session.stoppedAt 
        ? Math.floor((session.stoppedAt.getTime() - (session.startedAt?.getTime() || 0)) / 60000)
        : session.startedAt
        ? Math.floor((new Date().getTime() - session.startedAt.getTime()) / 60000)
        : 0
    }));
  }

  async terminate(sessionId: string) {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    session.stoppedAt = new Date();
    session.status = 'terminated';
    session.reasonStopped = 'Terminated by admin';
    await this.sessionRepository.save(session);
    return { terminated: true, sessionId };
  }
}
```

### Line-by-Line Explanation

**Lines 9-17:** Dependency injection
- `eventRepository` - Events (competitions)
- `sessionRepository` - EnvironmentSession (user challenge instances)
- `userRepository` - User accounts

**Lines 19-43:** List all sessions (admin view)
- **Lines 20-24**: Query last 100 sessions, sorted by start time (newest first)
- **Line 21**: `relations: ['environmentMachines']` - Include machines in response
- **Lines 27-31**: **PERFORMANCE OPTIMIZATION**: Load user emails in single query
  - Without this: N+1 queries (1 query per session for user)
  - With this: 1 query for all users (efficient)
- **Lines 33**: Create `Map` for O(1) email lookup
- **Lines 35-43**: Calculate idle time (how long session has been running)
  - If `stoppedAt` exists: Duration = stop - start
  - If still running: Duration = now - start
  - Convert milliseconds to minutes (`/ 60000`)

**Lines 45-55:** Admin terminate session
- **Line 46**: Find session by ID
- **Lines 47-49**: Throw 404 if not found (REST best practice)
- **Lines 50-52**: Update session state
  - `stoppedAt` - Current timestamp
  - `status` - 'terminated'
  - `reasonStopped` - "Terminated by admin" (audit trail)
- **Line 53**: Save to database
- **Line 54**: Return confirmation

### WHY This Matters

- **Admin Monitoring**: Admins can see all active sessions and their costs
- **Performance**: Efficient user email loading (1 query vs. 100)
- **Idle Time Calculation**: Helps identify stuck or abandoned sessions
- **Admin Control**: Force-terminate sessions (e.g., during maintenance)

### Key Takeaways

✅ **Efficient Queries**: Loads user emails in single query (prevents N+1 problem)  
✅ **Idle Time Calculation**: Converts timestamps to minutes for easy monitoring  
✅ **Admin Termination**: Force-stop sessions with audit trail (`reasonStopped`)  
✅ **Pagination**: Limits to 100 sessions (prevents UI overload)

---

## Related Documentation

- **← [Part 4: Database Models](CODE_PART4_DATABASE_MODELS.md)** - Entities used by these services
- **→ [Part 6: Frontend Components](CODE_PART6_FRONTEND_COMPONENTS.md)** - UI that calls these services
- **[Part 2: Authentication & Security](CODE_PART2_AUTH_SECURITY.md)** - Guards protecting these endpoints
- **[Architecture Overview](../ARCHITECTURE_OVERVIEW.md)** - How services fit into architecture

---

## Quick Reference: Service Responsibilities

| Service | Responsibility | Key Method |
|---------|---------------|-----------|
| **SubmissionValidationService** | Automated security checks on docker-compose.yml | `validateSubmission()` |
| **BadgesService** | Gamification and achievements | `awardBadges()` |
| **SessionsService** | Admin session monitoring and termination | `findAll()`, `terminate()` |

---

**Last Updated:** 2025  
**Status:** ✅ Complete
