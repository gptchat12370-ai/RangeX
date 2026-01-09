# Testing Plan

- **Backend Unit Tests (Jest)**
  - `CostService` – profile pricing, multi-machine estimation, monthly aggregation, usage recording by machine count.
  - `EnvironmentService` – start flow rejects when limits or hard budget fail; ensures AWS is not called on rejection.
  - `CleanupService` – TTL cleanup terminates expired sessions and triggers maintenance on hard-cap breach.
- **Manual API Checks**
  - Auth: `/auth/login`, `/auth/refresh`, `/auth/change-password`.
  - Solver: `/solver/scenarios`, `/solver/scenarios/:id/start` (expect `LIMIT_EXCEEDED`/`BUDGET_EXCEEDED`/`MAINTENANCE_MODE` codes).
  - Admin: `/admin/settings`, `/admin/usage/daily`, `/admin/sessions/:id/terminate`.
- **Frontend**
  - Forms use Zod + RHF; validate with invalid emails/passwords, invalid budget (soft > hard), and image refs with forbidden characters.
  - Login flow: verify tokens stored and error banners show backend messages.
  - Admin settings: load from backend, adjust limits/pricing, confirm validation prevents bad inputs.
- **Containers**
  - `cd local && docker-compose up --build` to run end-to-end stack locally.
  - Verify gateway (`http://localhost:8080`) proxies UI and API; MySQL initialized with `rangex` DB.
