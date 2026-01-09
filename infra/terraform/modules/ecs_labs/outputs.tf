output "cluster_id" {
  value = aws_ecs_cluster.labs.id
}

output "cluster_name" {
  value = aws_ecs_cluster.labs.name
}

output "task_definition_arn" {
  value = aws_ecs_task_definition.lab_task.arn
}

output "task_security_group_id" {
  value = aws_security_group.task.id
}
