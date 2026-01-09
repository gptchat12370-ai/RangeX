variable "cluster_name" {
  description = "Name for ECS cluster"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
}

variable "vpc_id" {
  description = "VPC id"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR used to restrict egress"
  type        = string
}

variable "default_cpu" {
  description = "Default CPU for generic lab task definition"
  type        = string
  default     = "512"
}

variable "default_memory" {
  description = "Default memory (MB) for generic lab task"
  type        = string
  default     = "1024"
}

variable "default_image" {
  description = "Base image used for the placeholder task definition"
  type        = string
  default     = "public.ecr.aws/amazonlinux/amazonlinux:2023"
}
