# Phase 1: Project Foundation & Core Design

**Duration**: 3 weeks  
**Status**: ✅ Complete  
**Completion**: 100%

---

## 📋 Phase Overview

Phase 1 established the foundational architecture, technology stack, and design system for the RangeX cybersecurity training platform. This phase focused on strategic planning, requirement analysis, and establishing the core structure that would support all subsequent development phases.

---

## 🎯 Phase Objectives

### Primary Goals
1. Define comprehensive system requirements
2. Select optimal technology stack
3. Design system architecture
4. Create database schema
5. Establish UI/UX design system
6. Setup monorepo structure
7. Define development workflows

### Success Criteria
- ✅ Complete requirements documentation
- ✅ Approved technology stack
- ✅ Validated system architecture
- ✅ Complete database design
- ✅ Design system guidelines
- ✅ Functional project structure

---

## 🔍 Requirements Analysis

### Functional Requirements

#### User Roles
1. **Solver (Student)**
   - Browse and start challenges
   - Track progress and scores
   - Earn badges and achievements
   - Join teams and competitions
   - Access learning paths

2. **Creator (Instructor)**
   - Create and manage scenarios
   - Design challenge environments
   - Configure Docker/VM topologies
   - Upload artifacts and tools
   - Monitor student progress

3. **Admin (Platform Manager)**
   - Manage users and roles
   - Control platform settings
   - Review and approve content
   - Monitor system health
   - Manage costs and budgets

#### Core Features
- Multi-step scenario creation wizard
- Docker and VM provisioning
- Real-time environment management
- Question-and-answer challenge system
- Career paths and playlists
- Events and competitions
- Leaderboards and gamification

### Non-Functional Requirements

#### Performance
- Support 100+ concurrent users
- Challenge environment launch < 2 minutes
- API response time < 200ms
- Real-time updates via WebSocket

#### Security
- JWT-based authentication
- Role-based access control
- Encrypted credentials storage
- VPC network isolation
- Regular security audits

#### Scalability
- Horizontal scaling support
- Auto-scaling with AWS Fargate
- Database connection pooling
- CDN for static assets

#### Cost Efficiency
- Budget tracking and alerts
- Resource optimization
- Spot instance usage
- Cost per user < RM 2/month

---

## 🛠️ Technology Stack Selection

### Frontend Technologies

#### Core Framework
- **React 18** - Component-based UI library
  - Rationale: Large ecosystem, excellent performance, strong community
  - Virtual DOM for efficient updates
  - Hooks for state management
  - Extensive third-party libraries

- **TypeScript** - Type-safe JavaScript
  - Rationale: Catch errors at compile-time, better IDE support
  - Full type coverage across codebase
  - Enhanced developer experience
  - Reduced runtime errors

- **Vite** - Build tool and dev server
  - Rationale: Lightning-fast HMR, modern ES modules
  - Instant server start
  - Optimized production builds
  - Plugin ecosystem

#### UI Framework
- **Tailwind CSS** - Utility-first CSS framework
  - Rationale: Rapid development, consistent styling, small bundle size
  - Customizable design system
  - JIT compiler for optimal performance
  - Dark mode support

- **shadcn/ui** - Component library
  - Rationale: Accessible, customizable, copy-paste components
  - Built on Radix UI primitives
  - Full TypeScript support
  - Tailwind integration

#### State Management
- **Zustand** - Lightweight state manager
  - Rationale: Simple API, minimal boilerplate, TypeScript-friendly
  - No providers/context needed
  - DevTools integration
  - Middleware support

#### Additional Libraries
- **React Hook Form** - Form validation
- **Zod** - Schema validation
- **Axios** - HTTP client
- **Socket.io Client** - WebSocket communication
- **Recharts** - Data visualization
- **xterm.js** - Terminal emulator
- **TipTap** - Rich text editor

### Backend Technologies

#### Core Framework
- **NestJS** - Progressive Node.js framework
  - Rationale: TypeScript-first, modular architecture, enterprise-ready
  - Dependency injection
  - Decorator-based routing
  - Built-in testing utilities
  - Extensive module ecosystem

- **TypeORM** - ORM for TypeScript
  - Rationale: Type-safe database queries, migration support
  - Active Record & Data Mapper patterns
  - Multiple database support
  - Entity relationships management

- **MySQL 8.0** - Relational database
  - Rationale: ACID compliance, excellent performance, proven reliability
  - JSON column support
  - Full-text search
  - Replication support
  - Wide hosting support

#### Authentication & Security
- **Passport** - Authentication middleware
- **JWT** - Token-based auth
- **Argon2** - Password hashing
- **Helmet** - Security headers
- **CORS** - Cross-origin configuration
- **Throttler** - Rate limiting

#### AWS Integration
- **AWS SDK v3** - Cloud services integration
  - EC2 Client - VPC and security groups
  - ECS Client - Fargate task management
  - ECR Client - Container registry
  - S3 Client - Object storage
  - CloudWatch Logs - Logging

#### Additional Libraries
- **Socket.io** - WebSocket server
- **Multer** - File uploads
- **MinIO** - S3-compatible storage
- **Dockerode** - Docker API client
- **Node-SSH2** - SSH connections
- **Nodemailer** - Email sending
- **Twilio** - SMS alerts

### Infrastructure & DevOps

#### Container Orchestration
- **Docker** - Containerization
- **Docker Compose** - Local multi-container apps
- **AWS Fargate** - Serverless containers

#### Cloud Services
- **AWS ECS** - Container orchestration
- **AWS ECR** - Container registry
- **AWS VPC** - Network isolation
- **AWS S3** - Object storage (backup)

#### Infrastructure as Code
- **Terraform** - Cloud infrastructure provisioning
  - VPC module
  - ECS module
  - ECR module
  - Security groups module

#### Monitoring
- **Prometheus** - Metrics collection
- **Grafana** - Visualization
- **Loki** - Log aggregation
- **CloudWatch** - AWS monitoring

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │   Solver   │  │  Creator   │  │   Admin    │           │
│  │    UI      │  │     UI     │  │     UI     │           │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘           │
│        │                │                │                   │
│        └────────────────┴────────────────┘                   │
│                         │                                     │
│                    REST API + WebSocket                       │
│                         │                                     │
└─────────────────────────┼─────────────────────────────────────┘
                          │
┌─────────────────────────┼─────────────────────────────────────┐
│                   APPLICATION LAYER                           │
│  ┌──────────────────────┴──────────────────────┐             │
│  │          NestJS Backend                      │             │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐ │             │
│  │  │  Auth    │  │ Scenario │  │ Environment│ │             │
│  │  │ Service  │  │ Service  │  │  Service   │ │             │
│  │  └──────────┘  └──────────┘  └───────────┘ │             │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐ │             │
│  │  │   Cost   │  │  Docker  │  │    AWS     │ │             │
│  │  │ Service  │  │ Service  │  │  Service   │ │             │
│  │  └──────────┘  └──────────┘  └───────────┘ │             │
│  └──────────────────┬─────────────────────────┘             │
│                     │                                         │
└─────────────────────┼─────────────────────────────────────────┘
                      │
┌─────────────────────┼─────────────────────────────────────────┐
│                 DATA LAYER                                    │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐     │
│  │     MySQL     │  │  MinIO / S3   │  │    Redis     │     │
│  │   Database    │  │    Storage    │  │    Cache     │     │
│  └───────────────┘  └───────────────┘  └──────────────┘     │
└───────────────────────────────────────────────────────────────┘
                      │
┌─────────────────────┼─────────────────────────────────────────┐
│             INFRASTRUCTURE LAYER                              │
│  ┌──────────────────────────────────────────────┐            │
│  │         AWS Cloud Infrastructure              │            │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐  │            │
│  │  │   VPC    │  │    ECS   │  │    ECR    │  │            │
│  │  │ Network  │  │ Fargate  │  │ Registry  │  │            │
│  │  └──────────┘  └──────────┘  └───────────┘  │            │
│  └──────────────────────────────────────────────┘            │
└───────────────────────────────────────────────────────────────┘
```

### Architecture Patterns

#### 1. Monorepo Structure
```
rangex/
├── frontend/           # React application
├── backend/            # NestJS API
├── local/              # Docker Compose setup
├── infra/              # Terraform configurations
├── docker-images/      # Custom Docker images
├── gateway-proxy/      # Nginx reverse proxy
└── docs/               # Documentation
```

#### 2. Layered Architecture
- **Presentation Layer**: React components, pages, UI logic
- **API Layer**: REST controllers, WebSocket gateways
- **Business Logic Layer**: Services, use cases
- **Data Access Layer**: TypeORM repositories, entities
- **Infrastructure Layer**: AWS services, Docker, networking

#### 3. Module Pattern (Backend)
- Auth module
- Scenarios module
- Environments module
- Users module
- Teams module
- Events module
- Playlists module
- Admin module

---

## 🗄️ Database Design

### Entity Relationship Diagram

```
┌──────────────┐         ┌──────────────────┐
│    User      │────┬────│  ScenarioVersion │
├──────────────┤    │    ├──────────────────┤
│ id           │    │    │ id               │
│ username     │    │    │ scenarioId       │
│ email        │    │    │ version          │
│ passwordHash │    │    │ missionHtml      │
│ role         │    │    │ status           │
│ mfaEnabled   │    │    │ publishedAt      │
└──────┬───────┘    │    └────────┬─────────┘
       │            │             │
       │            │             │
       │            │             ├──────────┐
       │            │             │          │
       │            │    ┌────────▼───────┐  │
       │            └────│    Machine     │  │
       │                 ├────────────────┤  │
       │                 │ id             │  │
       │                 │ versionId      │  │
       │                 │ name           │  │
       │                 │ kind (Docker)  │  │
       │                 │ imageName      │  │
       │                 │ role           │  │
       │                 └────────────────┘  │
       │                                     │
       │                 ┌────────────────┐  │
       │                 │   Question     │◄─┘
       │                 ├────────────────┤
       │                 │ id             │
       │                 │ versionId      │
       │                 │ type (MCQ)     │
       │                 │ text           │
       │                 │ points         │
       │                 └────────────────┘
       │
       │
       │                 ┌────────────────────┐
       └─────────────────│ EnvironmentSession │
                         ├────────────────────┤
                         │ id                 │
                         │ userId             │
                         │ scenarioVersionId  │
                         │ status             │
                         │ startedAt          │
                         │ expiresAt          │
                         └──────────┬─────────┘
                                    │
                                    │
                         ┌──────────▼──────────┐
                         │ EnvironmentMachine  │
                         ├─────────────────────┤
                         │ id                  │
                         │ sessionId           │
                         │ machineId           │
                         │ fargateTaskArn      │
                         │ privateIp           │
                         │ status              │
                         └─────────────────────┘
```

### Core Entities

#### User
```typescript
- id: UUID
- username: string (unique)
- email: string (unique)
- passwordHash: string (Argon2)
- firstName: string
- lastName: string
- country: string
- roleSolver: boolean
- roleCreator: boolean
- roleAdmin: boolean
- mfaEnabled: boolean
- twofaSecret: string (nullable)
- avatarUrl: string (nullable)
- pointsTotal: number (default: 0)
- createdAt: timestamp
- updatedAt: timestamp
```

#### Scenario
```typescript
- id: UUID
- title: string
- description: text
- coverImageUrl: string (nullable)
- authorId: UUID (FK → User)
- difficulty: enum (Easy, Intermediate, Hard, Impossible)
- category: string
- tags: JSON array
- featured: boolean
- createdAt: timestamp
- updatedAt: timestamp
```

#### ScenarioVersion
```typescript
- id: UUID
- scenarioId: UUID (FK → Scenario)
- version: string (semver)
- missionHtml: text
- rulesHtml: text
- dockerComposeYaml: text (nullable)
- resourceProfile: enum (micro, small, medium, large)
- estimatedDurationMinutes: number
- status: enum (draft, review, published, archived)
- publishedAt: timestamp (nullable)
- createdAt: timestamp
- updatedAt: timestamp
```

#### Machine
```typescript
- id: UUID
- versionId: UUID (FK → ScenarioVersion)
- name: string
- role: enum (attacker, victim)
- kind: enum (Docker, VM)
- imageName: string
- imageTag: string
- solverCanAccess: boolean
- credentials: JSON { username, password }
- exposePorts: JSON array
- env: JSON object
- order: number
```

#### EnvironmentSession
```typescript
- id: UUID
- userId: UUID (FK → User)
- scenarioVersionId: UUID (FK → ScenarioVersion)
- status: enum (provisioning, running, paused, completed, terminated)
- startedAt: timestamp
- expiresAt: timestamp
- terminatedAt: timestamp (nullable)
- score: number (default: 0)
- costRm: decimal (nullable)
```

### Indexes & Optimization
- Primary keys: All `id` fields (UUID)
- Foreign keys: All relational fields
- Unique constraints: `User.username`, `User.email`
- Composite indexes:
  - `(scenarioId, version)` on ScenarioVersion
  - `(userId, status)` on EnvironmentSession
  - `(authorId, status)` on Scenario

---

## 🎨 Design System

### Color Palette

#### Primary Colors
```css
--primary: #3b82f6       /* Blue */
--primary-light: #60a5fa
--primary-dark: #2563eb

--accent: #0ea5e9        /* Cyan */
--accent-light: #38bdf8
--accent-dark: #0284c7
```

#### Background Colors
```css
--background: #020617    /* Dark blue-black */
--card: #0f172a          /* Slightly lighter */
--card-hover: #1e293b    /* Hover state */
--border: #1e40af22      /* Semi-transparent blue */
```

#### Text Colors
```css
--foreground: #e0e7ff    /* Light blue-white */
--muted: #94a3b8         /* Gray text */
--muted-foreground: #64748b
```

#### Status Colors
```css
--success: #10b981       /* Green */
--warning: #f59e0b       /* Orange */
--error: #ef4444         /* Red */
--info: #3b82f6          /* Blue */
```

### Typography

#### Font Families
- **Primary**: Inter (sans-serif)
- **Monospace**: JetBrains Mono

#### Font Sizes
```css
--text-xs: 0.75rem      /* 12px */
--text-sm: 0.875rem     /* 14px */
--text-base: 1rem       /* 16px */
--text-lg: 1.125rem     /* 18px */
--text-xl: 1.25rem      /* 20px */
--text-2xl: 1.5rem      /* 24px */
--text-3xl: 1.875rem    /* 30px */
--text-4xl: 2.25rem     /* 36px */
```

### Component Specifications

#### Button Variants
- **Primary**: Blue background, white text
- **Secondary**: Gray background, white text
- **Outline**: Transparent background, blue border
- **Ghost**: No background, hover effect
- **Destructive**: Red background, white text

#### Card Component
- Border: 1px semi-transparent blue
- Border radius: 0.5rem
- Background: `--card`
- Padding: 1.5rem
- Shadow: Subtle blue glow on hover

#### Input Components
- Border: 1px border color
- Border radius: 0.375rem
- Padding: 0.5rem 0.75rem
- Focus ring: 2px blue outline

### Custom Effects

#### Cyber Glow
```css
.cyber-glow {
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
}
```

#### Grid Pattern
```css
.cyber-grid {
  background-image: linear-gradient(
    rgba(59, 130, 246, 0.1) 1px,
    transparent 1px
  ),
  linear-gradient(
    90deg,
    rgba(59, 130, 246, 0.1) 1px,
    transparent 1px
  );
  background-size: 20px 20px;
}
```

---

## 📁 Project Structure

### Monorepo Organization

```
rangex/
│
├── frontend/                      # React application
│   ├── src/
│   │   ├── components/            # Reusable components
│   │   │   ├── ui/                # shadcn/ui components (50+)
│   │   │   ├── creator/           # Creator-specific components
│   │   │   ├── admin/             # Admin-specific components
│   │   │   ├── solver/            # Solver-specific components
│   │   │   ├── Layout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── CommandPalette.tsx
│   │   │   └── ...
│   │   ├── pages/                 # Page components (15+)
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ChallengesPage.tsx
│   │   │   ├── creator/
│   │   │   ├── admin/
│   │   │   └── ...
│   │   ├── api/                   # API client
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── lib/                   # Utilities
│   │   ├── services/              # Business logic
│   │   ├── types.ts               # TypeScript types
│   │   └── App.tsx
│   ├── public/                    # Static assets
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── backend/                       # NestJS API
│   ├── src/
│   │   ├── modules/               # Feature modules
│   │   ├── entities/              # TypeORM entities (56+)
│   │   ├── services/              # Business logic (40+)
│   │   ├── controllers/           # API routes
│   │   ├── guards/                # Auth guards
│   │   ├── decorators/            # Custom decorators
│   │   ├── dto/                   # Data transfer objects
│   │   ├── gateways/              # WebSocket gateways
│   │   ├── jobs/                  # Scheduled tasks
│   │   ├── utils/                 # Helper functions
│   │   ├── config/                # Configuration
│   │   ├── migrations/            # Database migrations
│   │   └── main.ts
│   ├── package.json
│   ├── nest-cli.json
│   ├── tsconfig.json
│   └── typeorm.config.ts
│
├── local/                         # Local development
│   ├── docker-compose.yml         # Multi-container setup
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   ├── gateway.conf               # Nginx config
│   ├── init-mysql.sql             # DB initialization
│   ├── prometheus.yml
│   └── loki-config.yml
│
├── infra/                         # Infrastructure as Code
│   └── terraform/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── modules/
│           ├── vpc/
│           ├── ecs/
│           └── ecr/
│
├── docker-images/                 # Custom Docker images
│   ├── kali-lite/
│   ├── web-basic/
│   └── ...
│
├── gateway-proxy/                 # Reverse proxy service
│   ├── src/
│   ├── Dockerfile
│   └── package.json
│
├── docs/                          # Documentation
│   ├── phases/                    # Phase documentation
│   ├── ARCHITECTURE.md
│   ├── FEATURES.md
│   ├── COST-MODEL.md
│   ├── SECURITY-MODEL.md
│   └── ...
│
├── .github/                       # GitHub configuration
│   ├── workflows/                 # CI/CD pipelines
│   └── instructions/              # Instructions
│
├── .env.example                   # Environment template
├── .gitignore
├── package.json                   # Root package.json
└── README.md
```

---

## 🔄 Development Workflow

### Git Workflow
- **Main Branch**: Production-ready code
- **Development Branch**: Integration branch
- **Feature Branches**: `feature/feature-name`
- **Bugfix Branches**: `bugfix/bug-name`
- **Hotfix Branches**: `hotfix/issue-name`

### Code Standards
- **TypeScript**: Strict mode enabled
- **Linting**: ESLint configuration
- **Formatting**: Prettier
- **Naming Conventions**:
  - Components: PascalCase
  - Functions: camelCase
  - Constants: UPPER_SNAKE_CASE
  - Files: kebab-case or PascalCase

### Commit Convention
```
type(scope): subject

body

footer
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

---

## 📊 Phase Deliverables

### Documentation
- ✅ System requirements specification
- ✅ Technology stack justification
- ✅ Architecture diagrams (high-level + detailed)
- ✅ Database ER diagrams
- ✅ Design system documentation
- ✅ Project structure documentation

### Code & Configuration
- ✅ Monorepo structure initialized
- ✅ Git repository with .gitignore
- ✅ Package.json configurations
- ✅ TypeScript configurations
- ✅ ESLint and Prettier setup
- ✅ Environment variable templates

### Design Assets
- ✅ Color palette definitions
- ✅ Typography specifications
- ✅ Component library foundations
- ✅ Icon set selection
- ✅ Logo and branding (if applicable)

---

## ⏭️ Next Phase

**Phase 2: Frontend UI/UX Development** will build upon this foundation by:
- Implementing the design system in React components
- Creating 50+ UI components using shadcn/ui
- Building 15+ application pages
- Implementing state management
- Creating the command palette
- Setting up routing

[Continue to Phase 2 →](./PHASE_2_FRONTEND.md)

---

## 📝 Lessons Learned

### What Went Well
- Thorough requirements analysis prevented scope creep
- Technology choices aligned perfectly with requirements
- Monorepo structure simplified development
- Design system provided consistency early

### Challenges Faced
- Balancing feature richness with development timeline
- Choosing between multiple valid technology options
- Database schema normalization vs performance

### Key Decisions
- **Chose NestJS over Express**: Better structure for large projects
- **TypeScript everywhere**: Reduced bugs, improved DX
- **Monorepo approach**: Simplified dependency management
- **AWS Fargate over EKS**: Lower operational overhead

---

**Last Updated**: January 6, 2026  
**Phase Status**: ✅ Complete  
**Next Phase**: [Phase 2: Frontend Development](./PHASE_2_FRONTEND.md)
