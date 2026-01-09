# Phase 3: Backend API & Database Architecture

**Duration**: 5 weeks  
**Status**: ✅ Complete  
**Completion**: 100%

[← Back to Phase 2](./PHASE_2_FRONTEND.md) | [Phase Index](../RANGEX_PROJECT_PHASES.md) | [Continue to Phase 4 →](./PHASE_4_SECURITY.md)

---

## 📋 Phase Overview

Phase 3 established the complete backend infrastructure using NestJS, TypeORM, and MySQL. This phase delivered 56+ database entities, 100+ API endpoints, comprehensive service layer, and robust data validation.

---

## 🎯 Phase Objectives

- ✅ Create 56+ TypeORM entities with relationships
- ✅ Implement 100+ RESTful API endpoints
- ✅ Build 40+ service classes for business logic
- ✅ Setup database migrations
- ✅ Implement DTOs for validation
- ✅ Configure TypeORM with MySQL

---

## 🗄️ Database Architecture

### Core Entities (56+)

#### Authentication & Users
```typescript
User                    // User accounts and profiles
UserBadge              // Achievement tracking
CreatorPreferences     // Creator settings
```

#### Scenarios & Versions
```typescript
Scenario               // Challenge metadata
ScenarioVersion        // Versioned content
ScenarioLimit          // Resource constraints
ScenarioRating         // User ratings
Machine                // Container/VM definitions
Question               // Q&A challenges
Tool                   // Auto-install tools
Asset                  // File uploads
ScenarioAsset          // Asset relationships
AssetScenarioVersion   // Version-specific assets
```

#### Environment & Sessions
```typescript
EnvironmentSession           // Active challenge sessions
EnvironmentMachine           // Deployed containers
DeploymentEnvironment        // Environment configs
SessionNetworkTopology       // Network design
NetworkPivotPoint            // Network connections
SessionSecurityGroup         // Per-session firewall rules
MachineSecurityGroup         // Machine-level rules
InterfaceEndpoint            // Network interfaces
```

#### Docker & Images
```typescript
DockerImage            // Image catalog
ImageVariant           // Image versions
DockerCredential       // Registry auth
PlatformImage          // Curated images
RegistryCredential     // Private registry secrets
```

#### Content Organization
```typescript
CareerPath             // Learning paths
CareerPathItem         // Path steps
Playlist               // Curated collections
PlaylistItem           // Playlist contents
Event                  // Competitions
EventScenario          // Event challenges
EventParticipation     // User participation
EventRegistration      // Event signups
EventSession           // Event challenge sessions
```

#### Teams & Social
```typescript
Team                   // Team profiles
TeamMember             // Membership
TeamJoinRequest        // Join requests
UserFavorite           // Saved scenarios
```

#### System & Admin
```typescript
SystemSetting          // Platform configuration
AuditLog               // Activity tracking
Notification           // User notifications
UsageDaily             // Cost tracking
Job                    // Background tasks
Badge                  // Achievement definitions
BadgeRequirement       // Badge criteria
```

#### Testing & Deployment
```typescript
TestDeployment                // Test environments
ScenarioVersionTestRun        // Test results
ScenarioVersionAdminTest      // Admin testing
AdminTestValidation           // Validation rules
```

### Entity Relationships

```
User ──┬──< EnvironmentSession
       ├──< Scenario (as author)
       ├──< TeamMember
       ├──< EventParticipation
       └──< UserBadge

Scenario ──< ScenarioVersion ──┬──< Machine
                                ├──< Question
                                ├──< AssetScenarioVersion
                                └──< ScenarioVersionTestRun

EnvironmentSession ──< EnvironmentMachine ──> Machine
                   └──< SessionNetworkTopology

Event ──< EventScenario ──> ScenarioVersion
      └──< EventRegistration ──> User
```

---

## 🚀 API Endpoints (100+)

### Authentication Module
```
POST   /auth/register          // Create account
POST   /auth/login             // Login
POST   /auth/refresh           // Refresh tokens
POST   /auth/logout            // Logout
POST   /auth/2fa/setup         // Setup MFA
POST   /auth/2fa/verify        // Verify MFA code
```

### Users Module
```
GET    /users/me               // Current user profile
PATCH  /users/me               // Update profile
GET    /users/:id              // User by ID
GET    /users                  // List users (admin)
PATCH  /users/:id/role         // Change role (admin)
POST   /users/:id/mfa/toggle   // Toggle MFA (admin)
```

### Scenarios Module
```
GET    /scenarios              // List scenarios
POST   /scenarios              // Create scenario (creator)
GET    /scenarios/:id          // Get scenario
PATCH  /scenarios/:id          // Update scenario (creator)
DELETE /scenarios/:id          // Delete scenario (creator)
GET    /scenarios/:id/versions // List versions
POST   /scenarios/:id/versions // Create version
GET    /scenarios/search       // Search scenarios
POST   /scenarios/:id/favorite // Favorite scenario
GET    /scenarios/my-scenarios // Creator's scenarios
```

### Scenario Versions Module
```
GET    /versions/:id           // Get version details
PATCH  /versions/:id           // Update version
POST   /versions/:id/publish   // Publish version
POST   /versions/:id/archive   // Archive version
GET    /versions/:id/machines  // List machines
POST   /versions/:id/machines  // Add machine
GET    /versions/:id/questions // List questions
POST   /versions/:id/questions // Add question
```

### Machines Module
```
GET    /machines/:id           // Get machine
PATCH  /machines/:id           // Update machine
DELETE /machines/:id           // Delete machine
POST   /machines/:id/test      // Test configuration
```

### Environment Sessions Module
```
POST   /sessions/start         // Start challenge session
GET    /sessions/:id           // Get session status
PATCH  /sessions/:id/pause     // Pause session
PATCH  /sessions/:id/resume    // Resume session
DELETE /sessions/:id/terminate // Terminate session
GET    /sessions/active        // List active sessions
POST   /sessions/:id/submit    // Submit answers
GET    /sessions/:id/score     // Get score
```

### Docker Images Module
```
GET    /images                 // List images
POST   /images                 // Upload image (creator)
GET    /images/:id             // Get image details
PATCH  /images/:id             // Update image
DELETE /images/:id             // Delete image (admin)
POST   /images/:id/scan        // Security scan
GET    /images/variants        // Image variants
```

### Career Paths Module
```
GET    /career-paths           // List paths
POST   /career-paths           // Create path (admin)
GET    /career-paths/:id       // Get path
PATCH  /career-paths/:id       // Update path (admin)
DELETE /career-paths/:id       // Delete path (admin)
POST   /career-paths/:id/items // Add scenario to path
```

### Playlists Module
```
GET    /playlists              // List playlists
POST   /playlists              // Create playlist
GET    /playlists/:id          // Get playlist
PATCH  /playlists/:id          // Update playlist
DELETE /playlists/:id          // Delete playlist
POST   /playlists/:id/follow   // Follow playlist
POST   /playlists/:id/items    // Add scenario
```

### Events Module
```
GET    /events                 // List events
POST   /events                 // Create event (creator)
GET    /events/:id             // Get event
PATCH  /events/:id             // Update event
DELETE /events/:id             // Delete event
POST   /events/:id/register    // Register for event
GET    /events/:id/leaderboard // Event standings
POST   /events/:id/start       // Start event session
```

### Teams Module
```
GET    /teams                  // List teams
POST   /teams                  // Create team
GET    /teams/:id              // Get team
PATCH  /teams/:id              // Update team
DELETE /teams/:id              // Delete team
POST   /teams/:id/join         // Join team
POST   /teams/:id/leave        // Leave team
GET    /teams/:id/members      // Team members
```

### Admin Module
```
GET    /admin/users            // User management
PATCH  /admin/users/:id/role   // Change user role
GET    /admin/audit-logs       // View audit logs
GET    /admin/system-health    // System health
GET    /admin/settings         // Platform settings
PATCH  /admin/settings         // Update settings
GET    /admin/statistics       // Platform analytics
POST   /admin/images/:id/approve   // Approve image
POST   /admin/images/:id/reject    // Reject image
```

### Monitoring & Health
```
GET    /health                 // Health check
GET    /metrics                // Prometheus metrics
GET    /api/info               // API version info
```

---

## 🔧 Service Layer (40+)

### Core Services
```typescript
UsersService              // User CRUD operations
AuthService               // Authentication logic
ScenariosService          // Scenario management
SessionsService           // Session lifecycle
ScenarioWorkflowService   // Publishing workflow
ScenarioApprovalService   // Review/approval
```

### Environment Services
```typescript
EnvironmentService              // Session orchestration
SessionStateMachineService      // State transitions
SessionTimeoutService           // TTL management
SessionSecurityService          // Access control
SessionConnectionService        // Connection info
SessionLimitService             // Concurrency limits
```

### Infrastructure Services
```typescript
AwsIntegrationService           // AWS SDK wrapper
EcsTaskService                  // Fargate tasks
SecurityGroupManagerService     // Security groups
SessionSecurityGroupService     // Per-session SGs
VpcEndpointService              // VPC endpoints
```

### Docker Services
```typescript
DockerService                   // Dockerode wrapper
CreatorTestingService           // Local testing
ImagePipelineService            // Build & deploy pipeline
RegistryService                 // Registry management
RegistryEncryptionHelper        // AES-GCM encryption
```

### Cost & Monitoring Services
```typescript
CostService                     // Cost estimation
BudgetMonitorService            // Budget tracking
LimitService                    // Resource limits
OrphanedTaskMonitorService      // Cleanup orphaned tasks
HealthMonitorService            // Container health
AwsConfigSyncService            // Config drift detection
```

### Content Services
```typescript
PlaylistService                 // Playlist CRUD
CareerPathService               // Career path management
EventService                    // Event management
TeamsService                    // Team operations
BadgeService                    // Achievement system
```

### Utility Services
```typescript
NotificationService             // Notifications
AlertService                    // Multi-channel alerts (SMS/Email/Web)
AuditLogService                 // Activity logging
SystemSettingsService           // Platform config
EmailService                    // Email sending
SmsService                      // Twilio SMS
```

---

## 📦 Data Transfer Objects (DTOs)

### Validation with class-validator
```typescript
// Create Scenario DTO
export class CreateScenarioDto {
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(20)
  description: string;

  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @IsString()
  category: string;

  @IsArray()
  @IsString({ each: true })
  tags: string[];
}

// Start Session DTO
export class StartSessionDto {
  @IsUUID()
  scenarioVersionId: string;

  @IsEnum(['micro', 'small', 'medium', 'large'])
  @IsOptional()
  resourceProfile?: string;

  @IsInt()
  @Min(30)
  @Max(480)
  @IsOptional()
  durationMinutes?: number;
}

// Update Settings DTO
export class UpdateSettingsDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  softBudgetLimitRm?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  hardBudgetLimitRm?: number;

  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  maxActiveUsers?: number;
}
```

---

## 🗃️ Database Migrations

### Migration System
```bash
# Generate migration
npm run migration:generate -- -n MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

### Key Migrations
1. `InitialSchema` - Core tables
2. `AddScenarioVersioning` - Version support
3. `AddNetworkTopology` - Network configs
4. `AddSecurityGroups` - Firewall rules
5. `AddImageVariants` - Image versioning
6. `AddEventSystem` - Competition features
7. `AddBudgetTracking` - Cost monitoring

---

## 🔌 TypeORM Configuration

```typescript
// typeorm.config.ts
export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: ['src/entities/**/*.entity.ts'],
  migrations: ['src/migrations/**/*.ts'],
  synchronize: false, // Use migrations in production
  logging: process.env.NODE_ENV === 'development',
  charset: 'utf8mb4',
  timezone: 'Z',
  maxQueryExecutionTime: 1000, // Log slow queries
  poolSize: 10,
});
```

---

## 📊 Phase Deliverables

- ✅ 56+ database entities with relationships
- ✅ 100+ API endpoints (REST + WebSocket)
- ✅ 40+ service classes
- ✅ Complete DTO validation layer
- ✅ Database migration system
- ✅ TypeORM configuration
- ✅ API documentation
- ✅ Error handling middleware
- ✅ Logging infrastructure

---

## ⏭️ Next Phase

[Phase 4: Authentication & Security](./PHASE_4_SECURITY.md) will add:
- JWT authentication system
- Role-based access control
- Password hashing with Argon2
- MFA support
- Security middleware
- Audit logging

---

**Last Updated**: January 6, 2026  
**Phase Status**: ✅ Complete
