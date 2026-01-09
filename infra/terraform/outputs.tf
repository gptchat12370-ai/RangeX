output "vpc_id" {
  value = module.network.vpc_id
}

output "private_subnet_ids" {
  value = module.network.private_subnet_ids
}

output "labs_security_group_id" {
  value = module.network.labs_security_group_id
}

output "ecs_cluster_name" {
  value = module.ecs_labs.cluster_name
}

output "ecs_task_definition_arn" {
  value = module.ecs_labs.task_definition_arn
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}
