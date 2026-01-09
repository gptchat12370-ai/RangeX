terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  repositories = [
    "rangex/kali-lite",
    "rangex/web-basic",
    "rangex/linux-basic",
    "rangex/custom-attacker",
  ]
}

resource "aws_ecr_repository" "repos" {
  for_each = toset(local.repositories)
  name     = each.value
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.ecr.arn
  }
}

resource "aws_kms_key" "ecr" {
  description             = "KMS key for ECR encryption"
  deletion_window_in_days = 7
}
