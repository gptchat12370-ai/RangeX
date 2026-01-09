# RangeX Code Documentation - Master Index

**Document Version**: 1.0  
**Date**: January 7, 2026  
**Purpose**: Document important code implementations across the platform

---

## 📋 Overview

This documentation provides detailed code examples from the RangeX platform, showcasing the most important implementations including AWS configurations, API endpoints, security implementations, and core business logic.

---

## 📚 Documentation Structure

### Part 1: AWS Integration & Infrastructure
**File**: [CODE_PART1_AWS_INFRASTRUCTURE.md](CODE_PART1_AWS_INFRASTRUCTURE.md)  
**Coverage**:
- AWS ECS Fargate Deployment Service
- AWS ECR Image Management
- VPC Endpoint Configuration
- Security Group Management
- Budget Monitoring Service
- Health Check Service
- Task Definition Registration

### Part 2: Authentication & Security
**File**: [CODE_PART2_AUTH_SECURITY.md](CODE_PART2_AUTH_SECURITY.md)  
**Coverage**:
- JWT Authentication Implementation
- CSRF Protection
- Password Hashing (Argon2)
- Rate Limiting (Throttler)
- Role-Based Access Control (RBAC)
- Guard Implementations
- User Entity with Security Fields

### Part 3: Core API Endpoints
**File**: [CODE_PART3_API_ENDPOINTS.md](CODE_PART3_API_ENDPOINTS.md)  
**Coverage**:
- Scenario Management APIs
- Session Management APIs
- Question & Submission APIs
- Event Management APIs
- Team Management APIs
- Admin APIs

### Part 4: Database Models & Relations
**File**: [CODE_PART4_DATABASE_MODELS.md](CODE_PART4_DATABASE_MODELS.md) ✅ Complete  
**Coverage**:
- Scenario Entity (parent container with ratings, publication)
- ScenarioVersion Entity (versioned content, approval workflow)
- EnvironmentSession Entity (runtime state, cost tracking, answers)
- User Entity (RBAC, 2FA, budget limits, brute-force protection)
- Foreign Key Relationships
- TypeORM decorators and constraints

**Key Highlights:**
- ScenarioVersionStatus enum (DRAFT → SUBMITTED → APPROVED → PUBLISHED)
- JSON columns for flexible data (questions, hints, tags, answers)
- OWASP session security (IP, user-agent, lastActivityAt)
- Optimistic locking with `@VersionColumn()`

### Part 5: Business Logic & Services
**File**: [CODE_PART5_BUSINESS_LOGIC.md](CODE_PART5_BUSINESS_LOGIC.md) ✅ Complete  
**Coverage**:
- Submission Validation Service (security policy checks)
- Badge Service (gamification and achievements)
- Session Service (admin lifecycle management)
- Docker Compose security validation
- Criteria-based badge awarding
- N+1 query optimization

**Key Highlights:**
- `checkPrivilegedContainers()` blocks dangerous Docker settings
- `awardBadges()` with criteria string parsing ("challenges_10")
- Validation report stored in MinIO
- Efficient user email loading (1 query vs. 100)

### Part 6: Frontend Core Components
**File**: [CODE_PART6_FRONTEND_COMPONENTS.md](CODE_PART6_FRONTEND_COMPONENTS.md) ✅ Complete  
**Coverage**:
- Zustand Global State Store (persistent auth, appearance)
- ScenarioCard Component (favorites, images, hover effects)
- SshTerminal Component (xterm.js + WebSocket SSH)
- Solver API Client (type-safe backend calls)
- InChallengePage (complex challenge UI)
- State Management & Real-time features

**Key Highlights:**
- Persistent localStorage with `zustand/persist`
- Dynamic WebSocket URL for production (`window.location`)
- Fisher-Yates shuffle for question randomization
- Admin test mode support with API switching

---

## 🎯 Code Highlight Categories

### AWS & Cloud Infrastructure
- **Files**: `backend/src/services/aws-*.service.ts`
- **Key Features**: ECS, ECR, VPC, Cost monitoring
- **Complexity**: ⭐⭐⭐⭐⭐ High

### Security & Authentication
- **Files**: `backend/src/controllers/auth.controller.ts`, `backend/src/guards/*.ts`
- **Key Features**: JWT, CSRF, Argon2, RBAC
- **Complexity**: ⭐⭐⭐⭐ Medium-High

### API Endpoints
- **Files**: `backend/src/controllers/*.controller.ts`
- **Key Features**: RESTful APIs, NestJS decorators
- **Complexity**: ⭐⭐⭐ Medium

### Database Models
- **Files**: `backend/src/entities/*.entity.ts`
- **Key Features**: TypeORM, Relations, Constraints
- **Complexity**: ⭐⭐⭐ Medium

### Business Logic
- **Files**: `backend/src/services/*.service.ts`
- **Key Features**: Grading, badges, sessions
- **Complexity**: ⭐⭐⭐⭐ Medium-High

### Frontend Components
- **Files**: `frontend/src/components/*.tsx`, `frontend/src/pages/*.tsx`
- **Key Features**: React, TypeScript, Real-time UI
- **Complexity**: ⭐⭐⭐ Medium

---

## 💡 How to Use This Documentation

### For Developers
1. Start with **Part 1** to understand AWS infrastructure
2. Review **Part 2** for security implementations
3. Study **Part 3** for API design patterns
4. Reference **Part 4** for database schema
5. Explore **Part 5** for business logic
6. Check **Part 6** for frontend patterns

### For System Architects
- Focus on Parts 1, 4, and 5
- Understand AWS cost optimization (Part 1)
- Review data relationships (Part 4)
- Analyze service orchestration (Part 5)

### For Security Auditors
- Prioritize Part 2 (Authentication & Security)
- Review RBAC implementations
- Check data encryption and hashing
- Verify CSRF and rate limiting

### For Frontend Developers
- Start with Part 6 (Frontend Components)
- Reference Part 3 for API contracts
- Study WebSocket integration
- Review state management patterns

---

## 🔍 Code Location Quick Reference

| Feature | File Location | Part |
|---------|---------------|------|
| AWS ECS Deployment | `backend/src/services/aws-deploy.service.ts` | 1 |
| JWT Authentication | `backend/src/controllers/auth.controller.ts` | 2 |
| Scenario API | `backend/src/controllers/creator.controller.ts` | 3 |
| User Entity | `backend/src/entities/user.entity.ts` | 4 |
| Auto-Grading | `backend/src/services/question.service.ts` | 5 |
| SSH Terminal | `frontend/src/components/SshTerminal.tsx` | 6 |
| Budget Monitor | `backend/src/services/budget-monitor.service.ts` | 1 |
| CSRF Protection | `backend/src/common/guards/csrf.guard.ts` | 2 |
| Session Management | `backend/src/controllers/session.controller.ts` | 3 |
| Scenario Entity | `backend/src/entities/scenario.entity.ts` | 4 |
| Badge Service | `backend/src/services/badges.service.ts` | 5 |
| WebSocket Client | `frontend/src/lib/websocket.ts` | 6 |

---

## 📊 Documentation Statistics

- **Total Code Files Documented**: 60+
- **Total Code Snippets**: 200+
- **Lines of Code Shown**: 5,000+
- **AWS Services Covered**: 8 (ECS, ECR, EC2, VPC, CloudWatch, IAM, S3, Fargate)
- **API Endpoints**: 100+
- **Database Tables**: 59
- **Frontend Components**: 50+

---

## 🛠️ Technology Stack Reference

### Backend
```typescript
Framework: NestJS 11.0.0
Language: TypeScript 5.x
ORM: TypeORM 0.3.20
Database: MySQL 9.3
Authentication: Passport JWT
Password: Argon2
AWS SDK: v3 (ECS, ECR, EC2, CloudWatch)
```

### Frontend
```typescript
Framework: React 18.3.1
Language: TypeScript 5.x
Build: Vite 6.4.1
State: Zustand 4.5
HTTP: Axios 1.7
Terminal: xterm.js 5.5
```

---

## 📄 Document Navigation

**Start Here**: [Part 1 - AWS Integration & Infrastructure →](CODE_PART1_AWS_INFRASTRUCTURE.md)

**All Parts**:
1. [AWS Integration & Infrastructure](CODE_PART1_AWS_INFRASTRUCTURE.md)
2. [Authentication & Security](CODE_PART2_AUTH_SECURITY.md)
3. [Core API Endpoints](CODE_PART3_API_ENDPOINTS.md)
4. [Database Models & Relations](CODE_PART4_DATABASE_MODELS.md)
5. [Business Logic & Services](CODE_PART5_BUSINESS_LOGIC.md)
6. [Frontend Core Components](CODE_PART6_FRONTEND_COMPONENTS.md)

---

## 🔄 Document Updates

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 7, 2026 | Initial code documentation with 6 parts |

---

**Last Updated**: January 7, 2026  
**Status**: ✅ Complete  
**Maintained By**: RangeX Development Team
