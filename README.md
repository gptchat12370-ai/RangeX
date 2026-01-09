# RangeX Monorepo

Security-focused full-stack for the RangeX cyber range platform. This repo now ships a monorepo layout with the existing finalized React design plus a new NestJS backend, local Docker stack, and AWS Fargate lab infra skeleton.

## Layout
- `frontend/` – existing Vite + React + TypeScript + Tailwind + shadcn UI (design preserved).
- `backend/` – NestJS + TypeScript API, MySQL via TypeORM, auth, limits/budget enforcement, AWS Fargate orchestration wrapper.
- `local/` – docker-compose for backend, frontend, MySQL, gateway, and monitoring stubs; MySQL init SQL.
- `infra/terraform/` – cost-aware AWS Fargate lab stack (no NAT by default) with VPC, ECS, and ECR modules.
- `docs/` – architecture, security, cost, usage, and migrated UI docs from the original design.
- `.github/` – existing CI/policy files from the design bundle.

## Quickstart (local dev)
1) `cd frontend && npm install && npm run dev` to run the UI against a locally running backend.
2) `cd backend && npm install && npm run start:dev` after copying `.env.example` to `.env` and configuring secrets.
3) For containers: `cd local && docker-compose up --build` (brings up MySQL + backend + frontend + gateway).

## Notes
- Secrets are **never** committed. Set `.env` files locally (see `backend/.env.example`).
- Frontend keeps the finalized styling; new API clients are added without altering the visual theme.
- Labs on AWS Fargate run **without public IPs** or NAT by default; see `infra/terraform/` for details.
