# Cost Model

- **Inputs**
  - Pricing read from `SystemSetting`: `fargate_vcpu_price_per_hour_rm`, `fargate_memory_price_per_gb_hour_rm`.
  - Resource profiles map to vCPU/memory: micro (0.25 vCPU/0.5 GB), small (0.5/1), medium (1/2), large (2/4).
  - Session TTL defaults to `env_default_duration_minutes` (90) unless overridden in the start request.
- **Estimation Flow**
  1. On start request, CostService computes per-task hourly cost from profile + pricing.
  2. Worst-case session cost = hourlyCost × ceil(TTL hours) × machineCount.
  3. `currentMonthCost` is aggregated from `UsageDaily` rows.
  4. If `currentMonthCost + projected >= hard_usage_limit_rm` → reject with `BUDGET_EXCEEDED` and skip AWS runTask.
  5. If projected pushes above soft limit but below hard → allow, return `softBudgetWarning`.
- **Runtime Accounting**
  - `recordSessionUsage` multiplies duration hours × machine count × profile price and stores in `UsageDaily`.
  - TTL cleanup cron terminates expired sessions and records usage.
- **Admin Controls**
  - Limits and price inputs editable in Admin › Platform Settings (frontend uses Zod validation; backend enforces DTO/pipe validation).
  - Soft limit must be ≤ hard limit; UI warns before saving.
- **AWS Cost Posture**
  - Fargate tasks run without public IPs; no NAT by default to prevent surprise data egress.
  - Savings: add VPC interface endpoints for ECR/CloudWatch if needed instead of NAT gateways.
