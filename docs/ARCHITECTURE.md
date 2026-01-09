# RangeX Architecture

## Monorepo Layout
- `frontend/` – Vite + React + TypeScript + Tailwind + shadcn UI (finalized design preserved). API client + Zod validation added.
- `backend/` – NestJS + TypeScript + TypeORM (MySQL). Auth (JWT + Argon2), RBAC, validation, budget/limit enforcement, AWS Fargate wrapper.
- `local/` – Dockerfiles and `docker-compose.yml` for MySQL, backend, frontend, gateway (Nginx), and optional Prometheus/Grafana/Loki.
- `infra/terraform/` – Cost-aware AWS skeleton: VPC (no NAT), private subnets, ECS Fargate cluster, ECR repos.
- `docs/` – This file plus cost and security models and migrated UI docs.

## Data & Domain
- Core entities: `User`, `Scenario` + `ScenarioVersion`, `Machine`, `EnvironmentSession` + `EnvironmentMachine`, `SystemSetting`, `UsageDaily`, `RegistryCredential`, `AuditLog`.
- System settings hold all limits/cost knobs: max active users, max envs per user, global concurrency, default TTL, soft/hard budget caps, and Fargate pricing inputs.
- Budget/limit enforcement happens before AWS calls; AWS orchestration goes through `AwsIntegrationService` only after passing checks.

## Backend Runtime
- Nest bootstrap: Helmet, CORS (configured via `FRONTEND_ORIGINS`), global ValidationPipe (whitelist/forbid), global exception filter with safe error bodies, throttling guard.
- Services:
  - `LimitService` – user/global/scenario limit checks.
  - `CostService` – per-profile cost estimation, monthly aggregation, usage recording.
  - `EnvironmentService` – start/terminate sessions, orchestrate machines via AWS SDK v3, enforce budget logic, emit audit warnings on soft-cap.
  - `CleanupService` – cron for TTL cleanup + hard-budget enforcement → maintenance mode + mass termination.
  - `RegistryService` – AES-GCM encryption helper for private registry credentials.
- Auth: JWT access/refresh, Argon2 passwords, `RolesGuard` for solver/creator/admin. DTOs validate password strength and email formats.

## Frontend Runtime
- Axios `httpClient` with JWT injection + error handling, auth/solver/admin API wrappers.
- React Hook Form + Zod schemas for login, platform settings, image/registry validation.
- Existing UI/UX retained; new validation and admin settings wiring use the same shadcn components.

## Local Development
- Prereqs: Docker + Compose, Node 20+ for direct runs.
- Commands:
  - Frontend only: `cd frontend && npm install && npm run dev`.
  - Backend only: `cd backend && npm install && npm run start:dev` (copy `.env.example` first).
  - Full stack: `cd local && docker-compose up --build` then hit gateway at `http://localhost:8080` (frontend) and backend at `http://localhost:3000/api`.
- MySQL init script creates `rangex` DB and `rangex_app` user; use `RANGEX_DB_PASSWORD` env for compose.

## AWS Lab Stack (Terraform)
- VPC with **no NAT** (cost control). Private subnets only; tasks get no public IPs.
- Security group restricts lab ingress to VPN/gateway CIDR.
- ECS Fargate cluster + generic task definition (awsvpc, CloudWatch logs). Add per-scenario/task defs as needed.
- ECR repos for curated images (`kali-lite`, `web-basic`, `linux-basic`, `custom-attacker`).
- Future: add VPC interface endpoints for ECR/CloudWatch to keep pulls/logging private without NAT.

## Observability & Ops
- Compose includes Prometheus/Grafana/Loki under `monitoring` profile (opt-in). Backend metrics path placeholder `/metrics`.
- Audit logging ready for budget triggers and admin actions.
- Gateway (Nginx) fronts frontend/backend locally; production TLS to be mounted via secrets.

## Safety & Defaults
- No public image pulls without validation; image refs validated for forbidden characters/whitespace and http(s) prefixes.
- Registry secrets always encrypted; never rendered back to users.
- Maintenance mode + budget hard cap terminate active sessions via cron and block new starts.
