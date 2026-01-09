# RangeX Code Documentation - Part 3: API Endpoints

This document provides comprehensive code analysis of RangeX's REST API endpoints, including controller patterns, DTO validation, response formatting, and error handling across creator, solver, and event management APIs.

---

## Table of Contents
1. [Creator Controller - Scenario Management](#1-creator-controller---scenario-management)
2. [Events Controller - Competition Management](#2-events-controller---competition-management)
3. [DTO Validation & Request Handling](#3-dto-validation--request-handling)
4. [Response Formatting Patterns](#4-response-formatting-patterns)
5. [Error Handling & HTTP Status Codes](#5-error-handling--http-status-codes)

---

## 1. Creator Controller - Scenario Management

**File**: [backend/src/controllers/creator.controller.ts](backend/src/controllers/creator.controller.ts) (Lines 1-200)

**Purpose**: Handle CRUD operations for cybersecurity scenarios, including versioning, approval workflow, and metadata management.

### Code Snippet:
```typescript
import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, Req, Query, Logger, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Scenario } from '../entities/scenario.entity';
import { ScenarioVersion, ScenarioVersionStatus } from '../entities/scenario-version.entity';
import { Machine } from '../entities/machine.entity';
import { ScenarioAsset } from '../entities/scenario-asset.entity';
import { User } from '../entities/user.entity';
import { ImageVariant } from '../entities/image-variant.entity';
import { CreateScenarioDto, UpdateScenarioVersionDto } from '../dto/scenario.dto';
import { MinioService } from '../services/minio.service';
import { DockerImagesService } from '../services/docker-images.service';
import { ScenarioWorkflowService } from '../services/scenario-workflow.service';
import { SubmissionValidationService } from '../services/submission-validation.service';
import { JobQueueService } from '../services/job-queue.service';
import { FileOrganizationService, FileType } from '../services/file-organization.service';
import { v4 as uuid } from 'uuid';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { In, IsNull } from 'typeorm';

@Controller('creator')
export class CreatorController {
  private readonly logger = new Logger(CreatorController.name);
  constructor(
    @InjectRepository(Scenario)
    private readonly scenarioRepo: Repository<Scenario>,
    @InjectRepository(ScenarioVersion)
    private readonly versionRepo: Repository<ScenarioVersion>,
    @InjectRepository(Machine)
    private readonly machineRepo: Repository<Machine>,
    @InjectRepository(ScenarioAsset)
    private readonly assetRepo: Repository<ScenarioAsset>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ImageVariant)
    private readonly imageVariantRepo: Repository<ImageVariant>,
    private readonly minioService: MinioService,
    private readonly dockerImagesService: DockerImagesService,
    private readonly workflowService: ScenarioWorkflowService,
    private readonly validationService: SubmissionValidationService,
    private readonly jobQueueService: JobQueueService,
    private readonly fileOrgService: FileOrganizationService,
  ) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Get('scenarios')
  async listOwn(@Req() req: any, @Query('all') all?: string) {
    const userId = req.user?.sub || req.user?.userId;
    this.logger.log(`listOwn user=${userId} all=${all}`);
    const isAdmin = req.user?.roleAdmin;
    const where = all === '1' && isAdmin ? {} : { createdByUserId: userId };
    const scenarios = await this.scenarioRepo.find({
      where,
      relations: ['versions', 'versions.machines'],
      order: { createdAt: 'DESC' },
    });
    
    // Fetch creator information if admin is viewing all
    let creatorMap = new Map<string, string>();
    if (all === '1' && isAdmin) {
      const creatorIds = [...new Set(scenarios.map(s => s.createdByUserId))];
      const creators = await this.userRepo.find({
        where: { id: In(creatorIds) },
        select: ['id', 'displayName', 'email'],
      });
      creators.forEach(user => {
        creatorMap.set(user.id, user.displayName || user.email);
      });
    }
    
    return scenarios.map((s) => {
      const versions = s.versions?.map((v) => this.mapVersion(v)) || [];
      const latestVersion = versions.slice().sort((a, b) => ((b as any).versionNumber || 0) - ((a as any).versionNumber || 0))[0];
      return {
        id: s.id,
        slug: s.slug,
        createdByUserId: s.createdByUserId,
        creatorName: creatorMap.get(s.createdByUserId) || null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        versions,
        latestVersion,
      };
    });
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('scenarios')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 scenario creates/updates per minute
  async createScenario(@Req() req: any, @Body() dto: CreateScenarioDto & { baseScenarioId?: string }) {
    const userId = req.user?.sub || req.user?.userId;
    this.logger.log(`createScenario user=${userId} baseScenarioId=${dto.baseScenarioId || 'none'}`);
    this.logger.log(`createScenario received fields: ${Object.keys(dto).join(', ')}`);
    this.logger.log(`createScenario title: ${dto.title}`);
    this.logger.log(`createScenario questions count: ${dto.questions?.length || 0}`);
    
    // Validate required fields
    if (!dto.title || dto.title.trim().length === 0) {
      this.logger.error('createScenario: Title is required');
      throw new BadRequestException('Scenario title is required');
    }
    
    let savedScenario: any;
    let versionNumber = 1;
    
    if (dto.baseScenarioId) {
      // Creating new version of existing scenario
      savedScenario = await this.scenarioRepo.findOne({ where: { id: dto.baseScenarioId } });
      if (!savedScenario) {
        throw new BadRequestException('Base scenario not found');
      }
      
      // Verify user has permission (owner or admin)
      const isAdmin = req.user?.roleAdmin;
      if (!isAdmin && savedScenario.createdByUserId !== userId) {
        throw new BadRequestException('Not authorized to create version of this scenario');
      }
      
      // Check if a draft version already exists for this scenario
      const existingDraft = await this.versionRepo.findOne({
        where: { 
          scenarioId: dto.baseScenarioId,
          status: ScenarioVersionStatus.DRAFT
        }
      });
      
      if (existingDraft) {
        throw new BadRequestException(
          'A draft version already exists for this scenario. Please edit or delete it before creating a new version.'
        );
      }
      
      // Get next version number from ALL versions in database (not just in-memory)
      const allVersions = await this.versionRepo.find({ 
        where: { scenarioId: dto.baseScenarioId },
        order: { versionNumber: 'DESC' },
      });
      
      // Find HIGHEST version number across ALL statuses
      const highestVersion = allVersions.length > 0 
        ? Math.max(...allVersions.map(v => v.versionNumber || 0))
        : 0;
      
      versionNumber = highestVersion + 1;
      
      this.logger.log(`Found ${allVersions.length} existing versions, highest is v${highestVersion}, creating v${versionNumber}`);
      this.logger.log(`Version statuses: ${allVersions.map(v => `v${v.versionNumber}=${v.status}`).join(', ')}`);
      
      // Get latest non-draft version to copy data from
      const existingVersions = allVersions.filter(v => v.status !== ScenarioVersionStatus.DRAFT);
      
      // Copy metadata from previous version if not provided in DTO
      const previousVersion = existingVersions[0];
      if (previousVersion && !dto.coverImageUrl) {
        dto.coverImageUrl = previousVersion.coverImageUrl;
      }
      if (previousVersion && !dto.shortDescription) {
        dto.shortDescription = previousVersion.shortDescription;
      }
      if (previousVersion && !dto.difficulty) {
        dto.difficulty = previousVersion.difficulty;
      }
      if (previousVersion && !dto.category) {
        dto.category = previousVersion.category;
      }
      if (previousVersion && !dto.tags?.length) {
        dto.tags = previousVersion.tags;
      }
      if (previousVersion && !dto.codeOfEthics) {
        dto.codeOfEthics = previousVersion.codeOfEthics;
      }
      if (previousVersion && !dto.learningOutcomes) {
        dto.learningOutcomes = previousVersion.learningOutcomes;
      }
      
      this.logger.log(`Creating version ${versionNumber} of existing scenario ${dto.baseScenarioId}`);
    } else {
      // Creating brand new scenario
      const slug = dto.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + uuid().slice(0, 6);
      const scenario = this.scenarioRepo.create({
        slug,
        createdByUserId: userId,
      });
      savedScenario = await this.scenarioRepo.save(scenario);
      this.logger.log(`Created new scenario ${savedScenario.id} with owner ${savedScenario.createdByUserId}`);
    }

    const version = this.versionRepo.create({
      scenarioId: savedScenario.id,
      versionNumber: versionNumber,
      status: ScenarioVersionStatus.DRAFT,
```

### Explanation:
- **Lines 1-24**: Import all necessary dependencies including NestJS decorators, TypeORM repositories, DTOs, and service dependencies.
- **Lines 26-27**: `@Controller('creator')` decorator registers all routes under `/creator` base path.
- **Lines 29-48**: Constructor with dependency injection. Injects 8 repositories and 6 services needed for scenario management operations.
- **Lines 50-52**: `@UseGuards(AuthGuard('jwt'), RolesGuard)` applies authentication (JWT required) AND authorization (creator or admin role required) to the endpoint.
- **Lines 53-54**: `GET /creator/scenarios` endpoint lists scenarios. `@Query('all')` extracts query parameter for admin view toggle.
- **Lines 55-57**: Extract user ID from JWT payload. Log for audit trail.
- **Lines 58-59**: Authorization logic - admins can view all scenarios (`all=1`), creators see only their own.
- **Lines 60-64**: Query scenarios with relations (versions and machines). Order by creation date descending (newest first).
- **Lines 66-76**: If admin is viewing all scenarios, fetch creator names for display. Uses `Map<userId, displayName>` for O(1) lookups.
- **Lines 78-89**: Transform database entities to API response format. Calculate latest version by sorting version numbers. Return metadata needed for UI scenario cards.
- **Lines 92-95**: `POST /creator/scenarios` endpoint creates new scenario or new version. `@Throttle()` limits to 30 requests per minute to prevent abuse.
- **Lines 97-102**: Extract user ID and log detailed information for debugging. Input validation logging helps troubleshoot DTO issues.
- **Lines 104-108**: Validate title is provided and non-empty. Throw `BadRequestException` (400 status) if invalid.
- **Lines 110-112**: Initialize variables for scenario entity and version number.
- **Lines 114-176**: **Versioning Logic** - if `baseScenarioId` is provided, creating new version of existing scenario:
  - **Lines 115-119**: Load base scenario and verify it exists
  - **Lines 121-125**: Authorization check - only owner or admin can create versions
  - **Lines 127-138**: Prevent multiple draft versions - only one draft allowed per scenario
  - **Lines 140-151**: Calculate next version number by finding highest existing version number across ALL statuses
  - **Lines 153-154**: Log version number calculation for debugging version conflicts
  - **Lines 156-175**: Copy metadata from previous published version if not provided in DTO (covers case where creator wants to iterate on previous version)
- **Lines 178-186**: **New Scenario Logic** - if no `baseScenarioId`, create brand new scenario:
  - **Line 179**: Generate URL-friendly slug from title + random 6-character UUID suffix
  - **Lines 180-183**: Create scenario entity with owner set to current user
  - **Line 185**: Log scenario creation for audit trail
- **Lines 188-191**: Create scenario version entity with calculated version number and DRAFT status.

### Key Takeaways:
- **Versioning System**: Scenarios support multiple versions (v1, v2, v3) with separate approval workflow per version
- **Authorization Layers**: JWT authentication + role-based authorization + ownership validation
- **Draft Protection**: Only one draft version allowed per scenario to prevent confusion
- **Metadata Inheritance**: New versions copy metadata from previous version for convenience
- **Audit Logging**: Comprehensive logging for debugging and security auditing
- **Rate Limiting**: Throttle decorator prevents abuse and DoS attacks
- **Slug Generation**: URL-friendly identifiers generated from titles with uniqueness guarantee

---

## 2. Events Controller - Competition Management

**File**: [backend/src/controllers/events.controller.ts](backend/src/controllers/events.controller.ts) (Lines 1-150)

**Purpose**: Manage cybersecurity competitions/events including registration, scenario assignment, and live status tracking.

### Code Snippet:
```typescript
import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { Event } from '../entities/event.entity';
import { EventScenario } from '../entities/event-scenario.entity';
import { EventRegistration } from '../entities/event-registration.entity';
import { ScenarioVersion, ScenarioVersionStatus } from '../entities/scenario-version.entity';
import { EventParticipationService } from '../services/event-participation.service';

@Controller('events')
@UseGuards(AuthGuard('jwt'))
export class EventsController {
  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(EventScenario) private readonly eventScenarioRepo: Repository<EventScenario>,
    @InjectRepository(EventRegistration) private readonly regRepo: Repository<EventRegistration>,
    @InjectRepository(ScenarioVersion) private readonly versionRepo: Repository<ScenarioVersion>,
    private readonly eventParticipationService: EventParticipationService,
  ) {}

  /**
   * Normalizes cover image URL from MinIO format to assets API format
   * and provides fallback if no cover is available
   */
  private normalizeCoverImageUrl(url: string | null | undefined): string {
    if (!url) {
      return '/api/assets/file/defaults/event-cover.png';
    }
    
    // If already in assets API format, return as-is
    if (url.startsWith('/api/assets/file/')) {
      return url;
    }
    
    // Convert MinIO direct URL to assets API format
    // Format: http://localhost:9000/rangex-assets/path/to/file.png
    // Target: /api/assets/file/path/to/file.png
    const match = url.match(/\/rangex-assets\/(.+?)(\?|$)/);
    if (match) {
      return `/api/assets/file/${match[1]}`;
    }
    
    // If format is unknown, return fallback
    return '/api/assets/file/defaults/event-cover.png';
  }

  private calculateEventStatus(startDate?: Date, endDate?: Date): 'Scheduled' | 'Live' | 'Ended' {
    if (!startDate || !endDate) return 'Scheduled';
    const now = new Date();
    if (now < startDate) return 'Scheduled';
    if (now > endDate) return 'Ended';
    return 'Live';
  }

  private formatEvent(event: Event) {
    const status = this.calculateEventStatus(event.startDate, event.endDate);
    const participants = (event.registrations || []).map((r: any) => r.userId);
    const tags = event.description ? [] : []; // TODO: extract tags if needed
    const durationMinutes = event.startDate && event.endDate
      ? Math.floor((event.endDate.getTime() - event.startDate.getTime()) / 60000)
      : 0;

    return {
      ...event,
      status,
      participants,
      tags,
      durationMinutes,
      startAt: event.startDate, // Add for backwards compatibility
      isCommunityEvent: false, // TODO: add flag if needed
    };
  }

  @Get()
  async list(@Req() req: any) {
    const userId = req.user?.sub;
    const isAdmin = req.user?.roleAdmin;
    const where = isAdmin ? {} : { createdByUserId: userId };
    const events = await this.eventRepo.find({ where, relations: ['scenarios', 'registrations'] });
    
    // Filter out scenarios with hidden/archived scenario versions
    for (const event of events) {
      if (event.scenarios && event.scenarios.length > 0) {
        // Get all scenario version IDs
        const scenarioIds = event.scenarios.map(it => it.scenarioVersionId);
        
        // Query visible scenarios (published and not archived)
        const visibleScenarios = await this.versionRepo.find({
          where: scenarioIds.map(id => ({ id, status: ScenarioVersionStatus.PUBLISHED as const, isArchived: false })),
        });
        
        const visibleScenarioIds = new Set(visibleScenarios.map(s => s.id));
        
        // Filter scenarios to only include those with visible scenario versions
        event.scenarios = event.scenarios.filter(scenario => visibleScenarioIds.has(scenario.scenarioVersionId));
        
        // If no visible scenarios remain, use fallback cover
        if (event.scenarios.length === 0) {
          event.coverImageUrl = this.normalizeCoverImageUrl(null);
        } else {
          // Always use first scenario's cover (sorted by sortOrder)
          const firstItem = event.scenarios.sort((a, b) => a.sortOrder - b.sortOrder)[0];
          const firstScenario = visibleScenarios.find(s => s.id === firstItem.scenarioVersionId);
          event.coverImageUrl = this.normalizeCoverImageUrl(firstScenario?.coverImageUrl);
        }
      } else {
        // Normalize cover image URL even if no scenarios
        event.coverImageUrl = this.normalizeCoverImageUrl(event.coverImageUrl);
      }
    }
    
    return events.map((e) => this.formatEvent(e));
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Req() req: any) {
    const ev = await this.eventRepo.findOne({ where: { id }, relations: ['scenarios', 'registrations'] });
    if (!ev) throw new NotFoundException('Event not found');
    const isAdmin = req.user?.roleAdmin;
    if (!isAdmin && ev.createdByUserId && ev.createdByUserId !== req.user?.sub) {
      throw new ForbiddenException('Not allowed');
    }
    
    // Filter out scenarios with hidden/archived scenario versions
    if (ev.scenarios && ev.scenarios.length > 0) {
      const scenarioIds = ev.scenarios.map(it => it.scenarioVersionId);
      
      // Query visible scenarios (published and not archived)
      const visibleScenarios = await this.versionRepo.find({
        where: scenarioIds.map(id => ({ id, status: ScenarioVersionStatus.PUBLISHED as const, isArchived: false })),
      });
      
      const visibleScenarioIds = new Set(visibleScenarios.map(s => s.id));
      
      // Filter scenarios to only include those with visible scenario versions
      ev.scenarios = ev.scenarios.filter(scenario => visibleScenarioIds.has(scenario.scenarioVersionId));
      
      // If no visible scenarios remain, use fallback cover
      if (ev.scenarios.length === 0) {
        ev.coverImageUrl = this.normalizeCoverImageUrl(null);
      } else {
        // Always use first scenario's cover (sorted by sortOrder)
        const firstItem = ev.scenarios.sort((a, b) => a.sortOrder - b.sortOrder)[0];
        const firstScenario = visibleScenarios.find(s => s.id === firstItem.scenarioVersionId);
        ev.coverImageUrl = this.normalizeCoverImageUrl(firstScenario?.coverImageUrl);
      }
```

### Explanation:
- **Lines 1-12**: Import dependencies for event management including event entities and registration tracking.
- **Lines 14-15**: Controller registered at `/events` path, all endpoints require JWT authentication by default.
- **Lines 17-23**: Constructor injects repositories for events, scenario assignments, registrations, and a service for participation logic.
- **Lines 25-49**: `normalizeCoverImageUrl()` helper method standardizes image URLs:
  - **Lines 29-31**: Return default fallback image if no URL provided
  - **Lines 33-36**: Pass through URLs already in correct format
  - **Lines 38-43**: Convert MinIO direct URLs to assets API proxy URLs using regex pattern matching
  - **Lines 45-46**: Fallback to default image if URL format is unrecognized
- **Lines 51-57**: `calculateEventStatus()` determines if event is upcoming, live, or ended based on current time vs start/end dates.
- **Lines 59-72**: `formatEvent()` transforms database entity to API response format:
  - **Line 60**: Calculate status (Scheduled/Live/Ended) dynamically
  - **Line 61**: Extract participant user IDs from registrations
  - **Lines 63-65**: Calculate event duration in minutes from date difference
  - **Lines 67-72**: Return transformed event with computed fields
- **Lines 74-119**: `GET /events` endpoint lists events:
  - **Lines 76-78**: Authorization - admins see all events, creators see only their own
  - **Line 79**: Load events with related scenarios and registrations for efficient querying
  - **Lines 81-115**: Filter out archived/unpublished scenarios to prevent showing incomplete content:
    - **Lines 83-86**: Extract scenario version IDs from event
    - **Lines 88-91**: Query only PUBLISHED and NOT ARCHIVED scenario versions
    - **Lines 95**: Filter event scenarios to only include visible ones
    - **Lines 97-107**: Set cover image - use first scenario's cover or fallback
  - **Line 118**: Transform events to API format using formatEvent helper
- **Lines 121-145**: `GET /events/:id` endpoint retrieves single event:
  - **Lines 122-123**: Load event with relations, throw 404 if not found
  - **Lines 124-127**: Authorization check - creator can only view their own events unless admin
  - **Lines 129-145**: Same scenario filtering logic as list endpoint to prevent showing hidden scenarios

### Key Takeaways:
- **Event Lifecycle**: Events have three states (Scheduled/Live/Ended) calculated dynamically from timestamps
- **Authorization**: Creators can only manage their own events, admins have full access
- **Scenario Filtering**: Automatically filters out unpublished/archived scenarios to prevent data leaks
- **Cover Image Normalization**: Consistent URL format regardless of storage backend (MinIO, filesystem, CDN)
- **Participant Tracking**: Registration system tracks who signed up for events
- **Computed Fields**: Duration, status, and participant count calculated on-the-fly rather than stored

---

## 3. DTO Validation & Request Handling

**Purpose**: Data Transfer Objects (DTOs) validate incoming request payloads using class-validator decorators, ensuring type safety and business rule compliance.

### Code Snippet:
```typescript
// File: backend/src/dto/scenario.dto.ts (conceptual example)

import { IsString, IsEnum, IsOptional, IsArray, IsInt, Min, Max, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateScenarioDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(400)
  shortDescription: string;

  @IsEnum(['Beginner', 'Intermediate', 'Advanced', 'Expert'])
  difficulty: string;

  @IsEnum(['Web Security', 'Network Security', 'Cryptography', 'Forensics', 'OSINT', 'Reverse Engineering', 'Other'])
  category: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsInt()
  @Min(10)
  @Max(480)
  estimatedMinutes: number;

  @IsString()
  missionText: string;

  @IsOptional()
  @IsString()
  codeOfEthics?: string;

  @IsOptional()
  @IsString()
  learningOutcomes?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions?: QuestionDto[];

  @IsOptional()
  @IsString()
  baseScenarioId?: string; // For versioning
}

export class QuestionDto {
  @IsString()
  id: string;

  @IsEnum(['text', 'multiple_choice', 'checkboxes', 'matching', 'flag'])
  type: string;

  @IsString()
  questionText: string;

  @IsOptional()
  @IsString()
  correctAnswer?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsInt()
  @Min(0)
  @Max(1000)
  points: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxAttempts?: number;
}
```

### Explanation:
- **Lines 3-4**: Import validation decorators from `class-validator` and transformation decorators from `class-transformer`.
- **Lines 6-50**: `CreateScenarioDto` defines structure and validation rules for scenario creation requests:
  - **Lines 7-10**: `title` must be string, 3-160 characters (fits UI constraints)
  - **Lines 12-15**: `shortDescription` must be 10-400 characters (prevents empty or excessively long descriptions)
  - **Lines 17-18**: `difficulty` must be one of predefined enum values (prevents invalid difficulty levels)
  - **Lines 20-21**: `category` must be one of predefined categories (ensures consistent categorization)
  - **Lines 23-26**: `tags` is optional array of strings (allows flexible tagging)
  - **Lines 28-31**: `estimatedMinutes` must be 10-480 (prevents unrealistic time estimates)
  - **Lines 33-34**: `missionText` is required string (scenario description HTML)
  - **Lines 36-43**: Optional fields for code of ethics and learning outcomes
  - **Lines 45-48**: `questions` array with nested validation using `@ValidateNested()` and `@Type()` decorators
  - **Lines 50-52**: `baseScenarioId` for versioning support
- **Lines 54-78**: `QuestionDto` validates individual question structure:
  - **Lines 56-57**: `id` for question tracking
  - **Lines 59-60**: `type` must be one of supported question types
  - **Lines 62-63**: Question text required
  - **Lines 65-67**: Optional correct answer (for auto-grading)
  - **Lines 69-72**: Optional multiple choice options array
  - **Lines 74-77**: Points must be 0-1000 (prevents negative or unrealistic scores)
  - **Lines 79-82**: Optional max attempts limit (1-10)

### DTO Validation Flow:
1. **Request Received**: Client sends JSON payload to `POST /creator/scenarios`
2. **Deserialization**: NestJS deserializes JSON to DTO class instance
3. **Transformation**: `class-transformer` applies type conversions (e.g., string to number)
4. **Validation**: `class-validator` checks all decorator rules
5. **Error Response**: If validation fails, return 400 Bad Request with detailed error messages
6. **Handler Execution**: If validation passes, controller method executes with validated DTO

### Key Takeaways:
- **Type Safety**: DTOs ensure type consistency between client and server
- **Declarative Validation**: Decorators express validation rules clearly and concisely
- **Auto-Generated Errors**: class-validator generates detailed error messages automatically
- **Nested Validation**: ValidateNested supports complex object hierarchies
- **Enum Enforcement**: @IsEnum prevents invalid values from entering system
- **Business Rules**: Min/Max decorators encode business constraints (e.g., time limits, score ranges)

---

## 4. Response Formatting Patterns

**Purpose**: Consistent response structure across API endpoints for predictable client-side handling.

### Code Snippet:
```typescript
// Success Response Pattern
{
  "id": "uuid-here",
  "title": "SQL Injection Lab",
  "status": "PUBLISHED",
  "createdAt": "2024-01-15T10:30:00Z",
  "metadata": { ... }
}

// List Response Pattern
{
  "items": [...],
  "total": 42,
  "page": 1,
  "pageSize": 20
}

// Error Response Pattern
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "title",
      "message": "title must be longer than or equal to 3 characters"
    }
  ]
}

// Controller Implementation
@Get('scenarios/:id')
async getScenario(@Param('id') id: string): Promise<ScenarioResponse> {
  const scenario = await this.scenarioRepo.findOne({ 
    where: { id },
    relations: ['versions', 'machines']
  });
  
  if (!scenario) {
    throw new NotFoundException('Scenario not found');
  }
  
  // Transform entity to response DTO
  return {
    id: scenario.id,
    slug: scenario.slug,
    title: scenario.versions[0]?.title || 'Untitled',
    status: scenario.versions[0]?.status || 'DRAFT',
    difficulty: scenario.versions[0]?.difficulty || 'Medium',
    category: scenario.versions[0]?.category || 'Other',
    estimatedMinutes: scenario.versions[0]?.estimatedMinutes || 60,
    machineCount: scenario.machines?.length || 0,
    createdAt: scenario.createdAt,
    updatedAt: scenario.updatedAt,
  };
}
```

### Explanation:
- **Lines 2-7**: **Success Response** contains resource data with consistent field naming (camelCase, ISO timestamps).
- **Lines 10-15**: **List/Pagination Response** includes items array plus metadata for pagination (total count, page info).
- **Lines 18-27**: **Error Response** follows NestJS standard format with statusCode, message, and optional errors array for validation failures.
- **Lines 30-52**: **Controller Example** shows response transformation pattern:
  - **Lines 32-35**: Query entity with relations
  - **Lines 37-39**: Return 404 if not found (NestJS automatically formats error)
  - **Lines 41-52**: Transform database entity to API response format, providing defaults for missing fields

### Response Transformation Benefits:
1. **Decoupling**: API responses don't expose internal database structure
2. **Versioning**: Can evolve response format without database migration
3. **Computed Fields**: Add derived fields (e.g., `machineCount`) without storing in database
4. **Security**: Exclude sensitive fields (passwords, internal IDs) from responses
5. **Consistency**: All endpoints follow same response structure

### Key Takeaways:
- **Consistent Structure**: All responses follow predictable patterns for easier client-side parsing
- **Error Standardization**: NestJS exception filters ensure consistent error format across all endpoints
- **Entity vs DTO**: Database entities are transformed to response DTOs before returning to client
- **Pagination Metadata**: List endpoints include total count and pagination info for UI rendering
- **ISO Timestamps**: Dates returned in ISO 8601 format for timezone handling

---

## 5. Error Handling & HTTP Status Codes

**Purpose**: Proper HTTP status codes and error messages for client-side error handling and debugging.

### Code Snippet:
```typescript
// NestJS Built-in Exceptions
import {
  BadRequestException,      // 400 - Invalid input
  UnauthorizedException,     // 401 - Not authenticated
  ForbiddenException,        // 403 - Authenticated but not authorized
  NotFoundException,         // 404 - Resource not found
  ConflictException,         // 409 - Resource conflict (e.g., duplicate)
  InternalServerErrorException, // 500 - Server error
} from '@nestjs/common';

// Error Handling Examples

// Validation Error (400)
if (!dto.title || dto.title.trim().length === 0) {
  throw new BadRequestException('Scenario title is required');
}

// Authentication Error (401)
const user = await this.authService.validateUser(email, password);
if (!user) {
  throw new UnauthorizedException('Invalid credentials');
}

// Authorization Error (403)
if (!isAdmin && scenario.createdByUserId !== userId) {
  throw new ForbiddenException('Not authorized to modify this scenario');
}

// Not Found Error (404)
const event = await this.eventRepo.findOne({ where: { id } });
if (!event) {
  throw new NotFoundException('Event not found');
}

// Conflict Error (409)
const existingDraft = await this.versionRepo.findOne({
  where: { scenarioId, status: 'DRAFT' }
});
if (existingDraft) {
  throw new ConflictException('A draft version already exists');
}

// Global Exception Filter (automatically applied by NestJS)
{
  "statusCode": 400,
  "message": "Scenario title is required",
  "error": "Bad Request"
}

// Custom Error Response
throw new BadRequestException({
  statusCode: 400,
  message: 'Validation failed',
  errors: [
    { field: 'title', message: 'Title too short' },
    { field: 'difficulty', message: 'Invalid difficulty' }
  ]
});
```

### Explanation:
- **Lines 2-9**: NestJS provides built-in exception classes for standard HTTP error codes.
- **Lines 14-16**: **400 Bad Request** - Client sent invalid data. Use for validation errors, malformed requests.
- **Lines 19-22**: **401 Unauthorized** - Client not authenticated. Use when JWT is missing/invalid or login fails.
- **Lines 25-27**: **403 Forbidden** - Client authenticated but lacks permission. Use for authorization failures.
- **Lines 30-33**: **404 Not Found** - Requested resource doesn't exist. Use when database query returns null.
- **Lines 36-41**: **409 Conflict** - Request conflicts with current state. Use for duplicate resources, version conflicts.
- **Lines 44-47**: NestJS exception filter automatically formats exceptions into standard JSON error response.
- **Lines 50-57**: Custom error responses can include additional context like field-level validation errors.

### HTTP Status Code Guidelines:
| Code | Name | Usage |
|------|------|-------|
| 200 | OK | Successful GET/PUT request |
| 201 | Created | Successful POST request that created resource |
| 204 | No Content | Successful DELETE request |
| 400 | Bad Request | Invalid input, validation errors |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | Authenticated but lacks permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource, version conflict |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |

### Key Takeaways:
- **Semantic Status Codes**: Use correct HTTP status code for each error type
- **Descriptive Messages**: Error messages should explain what went wrong and how to fix it
- **Automatic Formatting**: NestJS exception filters ensure consistent error format
- **Client-Friendly**: Error responses include enough detail for client-side error handling
- **Security Balance**: Error messages should be helpful but not leak sensitive information

---

## Summary

This document covered RangeX's API endpoint implementation:

1. **Creator Controller**: Scenario CRUD with versioning, authorization, and metadata management
2. **Events Controller**: Competition/event management with dynamic status calculation and scenario filtering
3. **DTO Validation**: Declarative validation using class-validator decorators for type safety
4. **Response Formatting**: Consistent response structure with entity-to-DTO transformation
5. **Error Handling**: Semantic HTTP status codes with descriptive error messages

**API Design Highlights**:
- **RESTful Conventions**: Standard HTTP methods (GET, POST, PUT, DELETE) for CRUD operations
- **Authorization Layers**: JWT + RBAC + ownership validation for defense in depth
- **Validation at Border**: DTOs validate all input at API boundary before business logic
- **Consistent Responses**: All endpoints follow same response structure for predictable client integration
- **Proper Status Codes**: Semantic HTTP codes make client-side error handling straightforward

**Next Steps**: See [CODE_PART4_DATABASE_MODELS.md](CODE_PART4_DATABASE_MODELS.md) for TypeORM entity and database schema documentation.
