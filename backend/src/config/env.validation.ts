import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  
  // Legacy database vars (optional)
  DB_USER: Joi.string().optional(),
  DB_NAME: Joi.string().optional(),

  // JWT - Main secret (512-bit minimum for strong security)
  JWT_SECRET: Joi.string().min(64).required(),
  
  // Legacy JWT secrets (optional for backward compatibility)
  JWT_ACCESS_SECRET: Joi.string().min(32).optional(),
  JWT_REFRESH_SECRET: Joi.string().min(32).optional(),

  REGISTRY_ENCRYPTION_KEY: Joi.string().min(32).required(),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  FRONTEND_ORIGINS: Joi.string().default('http://localhost:5173'),

  AWS_REGION: Joi.string().required(),
  AWS_ECS_CLUSTER_NAME: Joi.string().required(),
  AWS_ECS_SUBNET_IDS: Joi.string().required(),
  AWS_ECS_SECURITY_GROUP_IDS: Joi.string().required(),

  ASSETS_STORAGE_DRIVER: Joi.string().valid('local', 'minio').default('local'),
  ASSETS_PUBLIC_BASE_URL: Joi.string().uri().optional(),
  MINIO_ENDPOINT: Joi.string().when('ASSETS_STORAGE_DRIVER', { is: 'minio', then: Joi.required() }),
  MINIO_PORT: Joi.number().when('ASSETS_STORAGE_DRIVER', { is: 'minio', then: Joi.required() }),
  MINIO_USE_SSL: Joi.boolean().when('ASSETS_STORAGE_DRIVER', { is: 'minio', then: Joi.required() }),
  MINIO_ACCESS_KEY: Joi.string().when('ASSETS_STORAGE_DRIVER', { is: 'minio', then: Joi.required() }),
  MINIO_SECRET_KEY: Joi.string().when('ASSETS_STORAGE_DRIVER', { is: 'minio', then: Joi.required() }),
  MINIO_BUCKET: Joi.string().when('ASSETS_STORAGE_DRIVER', { is: 'minio', then: Joi.required() }),
});
