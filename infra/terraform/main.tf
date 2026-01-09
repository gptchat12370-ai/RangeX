terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "network" {
  source       = "./modules/network"
  name         = "${var.prefix}-labs"
  vpc_cidr     = var.vpc_cidr
  gateway_cidr = var.gateway_cidr
}

module "ecs_labs" {
  source      = "./modules/ecs_labs"
  cluster_name = "${var.prefix}-labs"
  region       = var.aws_region
  vpc_id       = module.network.vpc_id
  vpc_cidr     = var.vpc_cidr
}

module "ecr" {
  source = "./modules/ecr"
}

# Note: NAT gateways are intentionally omitted to keep costs predictable.
# If private tasks need to pull from ECR without NAT, add VPC interface endpoints for ECR and CloudWatch Logs.
