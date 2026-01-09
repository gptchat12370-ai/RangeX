variable "aws_region" {
  description = "AWS region for lab infrastructure"
  type        = string
  default     = "ap-southeast-1"
}

variable "prefix" {
  description = "Name prefix for all resources"
  type        = string
  default     = "rangex"
}

variable "vpc_cidr" {
  description = "VPC CIDR block for labs"
  type        = string
  default     = "10.20.0.0/16"
}

variable "gateway_cidr" {
  description = "Gateway/VPN CIDR allowed to reach lab tasks"
  type        = string
  default     = "10.0.0.0/24"
}
