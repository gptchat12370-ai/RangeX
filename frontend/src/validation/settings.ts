import { z } from "zod";

export const systemSettingsSchema = z
  .object({
    max_active_users: z.number().int().min(1).max(1000),
    max_envs_per_user: z.number().int().min(1).max(10),
    max_concurrent_envs_global: z.number().int().min(1).max(100),
    env_default_duration_minutes: z.number().int().min(15).max(480),
    soft_usage_limit_rm: z.number().min(0),
    hard_usage_limit_rm: z.number().min(0),
    fargate_vcpu_price_per_hour_rm: z.number().min(0),
    fargate_memory_price_per_gb_hour_rm: z.number().min(0),
    maintenance_mode: z.boolean(),
  })
  .refine((val) => val.soft_usage_limit_rm <= val.hard_usage_limit_rm, {
    path: ["soft_usage_limit_rm"],
    message: "Soft limit must be lower than hard limit",
  });

export type SystemSettingsForm = z.infer<typeof systemSettingsSchema>;
