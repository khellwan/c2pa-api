# DynamoDB Table - Manifests
resource "aws_dynamodb_table" "manifests" {
  name           = "${local.name_prefix}-manifests"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "manifestId"

  attribute {
    name = "manifestId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  # GSI para consultas por status
  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = true
  }

  # Encryption at rest
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.main.arn
  }

  tags = {
    Name = "${local.name_prefix}-manifests"
  }
}

# DynamoDB Table para Terraform Locks (usado no backend)
resource "aws_dynamodb_table" "terraform_locks" {
  name           = "${local.name_prefix}-terraform-locks"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name = "${local.name_prefix}-terraform-locks"
  }
}