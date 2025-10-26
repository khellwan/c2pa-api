# API Gateway URL
output "api_gateway_url" {
  description = "URL do API Gateway"
  value       = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
}

# S3 Buckets
output "s3_bucket_uploads" {
  description = "Nome do bucket S3 para uploads"
  value       = aws_s3_bucket.uploads.id
}

output "s3_bucket_signed" {
  description = "Nome do bucket S3 para arquivos assinados"
  value       = aws_s3_bucket.signed.id
}

# DynamoDB Table
output "dynamodb_table_manifests" {
  description = "Nome da tabela DynamoDB para manifests"
  value       = aws_dynamodb_table.manifests.name
}

# SQS Queue
output "sqs_queue_manifest_jobs" {
  description = "URL da fila SQS para jobs"
  value       = aws_sqs_queue.manifest_jobs.id
}

# Lambda Function
output "lambda_function_name" {
  description = "Nome da função Lambda"
  value       = aws_lambda_function.api.function_name
}

# Secrets Manager
output "secret_arn_c2pa_keys" {
  description = "ARN do secret para chaves C2PA"
  value       = aws_secretsmanager_secret.c2pa_keys.arn
  sensitive   = true
}

# KMS Key
output "kms_key_id" {
  description = "ID da chave KMS"
  value       = aws_kms_key.main.key_id
}

# CloudWatch Log Group
output "cloudwatch_log_group" {
  description = "Nome do CloudWatch Log Group"
  value       = aws_cloudwatch_log_group.lambda.name
}

# Terraform Backend Resources (para configuração posterior)
output "terraform_state_bucket" {
  description = "Nome do bucket para Terraform state (configure manualmente)"
  value       = "${local.name_prefix}-terraform-state-${local.suffix}"
}

output "terraform_locks_table" {
  description = "Nome da tabela DynamoDB para locks do Terraform"
  value       = aws_dynamodb_table.terraform_locks.name
}

# Deploy instructions
output "deploy_instructions" {
  description = "Instruções para deploy"
  value = <<-EOT
1. Build e push da imagem Docker:
   docker build -t c2pa-api .
   aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.${var.aws_region}.amazonaws.com
   docker tag c2pa-api:latest ACCOUNT_ID.dkr.ecr.${var.aws_region}.amazonaws.com/c2pa-api:latest
   docker push ACCOUNT_ID.dkr.ecr.${var.aws_region}.amazonaws.com/c2pa-api:latest

2. Atualizar variável lambda_image_uri:
   terraform apply -var="lambda_image_uri=ACCOUNT_ID.dkr.ecr.${var.aws_region}.amazonaws.com/c2pa-api:latest"

3. Configurar chaves C2PA no Secrets Manager:
   aws secretsmanager update-secret --secret-id ${aws_secretsmanager_secret.c2pa_keys.arn} --secret-string '{"private_key":"...","certificate":"...","ca_chain":"...","passphrase":"..."}'

4. (Opcional) Configurar backend remoto:
   - Criar bucket: aws s3 mb s3://${local.name_prefix}-terraform-state-${local.suffix}
   - Descomentar backend no main.tf
   - terraform init -migrate-state
EOT
}