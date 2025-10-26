# IAM Role para Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${local.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-lambda-role"
  }
}

# Lambda basic execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Custom policy para Lambda
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${local.name_prefix}-lambda-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObjectVersion"
        ]
        Resource = [
          "${aws_s3_bucket.uploads.arn}/*",
          "${aws_s3_bucket.signed.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.uploads.arn,
          aws_s3_bucket.signed.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.manifests.arn,
          "${aws_dynamodb_table.manifests.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.manifest_jobs.arn,
          aws_sqs_queue.manifest_jobs_dlq.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.c2pa_keys.arn
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.main.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Lambda Function
resource "aws_lambda_function" "api" {
  function_name = "${local.name_prefix}-api"
  role          = aws_iam_role.lambda_role.arn
  
  # Usar imagem do ECR se fornecida, senão placeholder
  package_type = var.lambda_image_uri != "" ? "Image" : "Zip"
  image_uri    = var.lambda_image_uri != "" ? var.lambda_image_uri : null

  # Placeholder para ZIP (será atualizado depois)
  filename         = var.lambda_image_uri == "" ? "placeholder.zip" : null
  source_code_hash = var.lambda_image_uri == "" ? data.archive_file.placeholder[0].output_base64sha256 : null

  memory_size = var.lambda_memory
  timeout     = var.lambda_timeout

  environment {
    variables = {
      NODE_ENV                    = "production"
      DYNAMODB_TABLE_MANIFESTS    = aws_dynamodb_table.manifests.name
      SQS_QUEUE_MANIFEST_JOBS     = aws_sqs_queue.manifest_jobs.id
      S3_BUCKET_UPLOADS           = aws_s3_bucket.uploads.id
      S3_BUCKET_SIGNED            = aws_s3_bucket.signed.id
      SECRET_ARN_C2PA_KEYS        = aws_secretsmanager_secret.c2pa_keys.arn
      KMS_KEY_ID                  = aws_kms_key.main.key_id
      # AWS_REGION is automatically set by Lambda, no need to configure
    }
  }

  tags = {
    Name = "${local.name_prefix}-api"
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy.lambda_policy,
    aws_cloudwatch_log_group.lambda
  ]
}

# CloudWatch Log Group para Lambda
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.name_prefix}-api"
  retention_in_days = 14
  # Removed KMS encryption to avoid CloudWatch Logs access issues

  tags = {
    Name = "${local.name_prefix}-lambda-logs"
  }
}

# Placeholder ZIP para quando não usar imagem
data "archive_file" "placeholder" {
  count       = var.lambda_image_uri == "" ? 1 : 0
  type        = "zip"
  output_path = "placeholder.zip"
  
  source {
    content  = "exports.handler = async () => ({ statusCode: 200, body: 'Placeholder' });"
    filename = "index.js"
  }
}

# API Gateway REST API
resource "aws_api_gateway_rest_api" "main" {
  name        = "${local.name_prefix}-api"
  description = "C2PA API Gateway"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Name = "${local.name_prefix}-api-gateway"
  }
}

# API Gateway Resource (proxy)
resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "{proxy+}"
}

# API Gateway Method (ANY)
resource "aws_api_gateway_method" "proxy" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

# API Gateway Integration
resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_method.proxy.resource_id
  http_method = aws_api_gateway_method.proxy.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

# API Gateway Method (root)
resource "aws_api_gateway_method" "proxy_root" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_rest_api.main.root_resource_id
  http_method   = "ANY"
  authorization = "NONE"
}

# API Gateway Integration (root)
resource "aws_api_gateway_integration" "lambda_root" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_method.proxy_root.resource_id
  http_method = aws_api_gateway_method.proxy_root.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "main" {
  depends_on = [
    aws_api_gateway_integration.lambda,
    aws_api_gateway_integration.lambda_root,
  ]

  rest_api_id = aws_api_gateway_rest_api.main.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.proxy.id,
      aws_api_gateway_method.proxy.id,
      aws_api_gateway_integration.lambda.id,
      aws_api_gateway_method.proxy_root.id,
      aws_api_gateway_integration.lambda_root.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# API Gateway Stage
resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.environment

  tags = {
    Name = "${local.name_prefix}-api-stage"
  }
}

# Lambda permission para API Gateway
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# ============================================
# Worker Lambda for SQS Processing
# ============================================

# Lambda Function - Worker
resource "aws_lambda_function" "worker" {
  function_name = "${local.name_prefix}-worker"
  role          = aws_iam_role.lambda_role.arn
  
  # Usar imagem do ECR worker
  package_type = "Image"
  image_uri    = var.lambda_worker_image_uri != "" ? var.lambda_worker_image_uri : var.lambda_image_uri

  memory_size = var.lambda_memory * 2  # Worker needs more memory for C2PA processing
  timeout     = 300  # 5 minutes for processing

  environment {
    variables = {
      NODE_ENV                    = "production"
      DYNAMODB_TABLE_MANIFESTS    = aws_dynamodb_table.manifests.name
      SQS_QUEUE_MANIFEST_JOBS     = aws_sqs_queue.manifest_jobs.id
      S3_BUCKET_UPLOADS           = aws_s3_bucket.uploads.id
      S3_BUCKET_SIGNED            = aws_s3_bucket.signed.id
      SECRET_ARN_C2PA_KEYS        = aws_secretsmanager_secret.c2pa_keys.arn
      KMS_KEY_ID                  = aws_kms_key.main.key_id
      # AWS_REGION is automatically set by Lambda, no need to configure
      USE_TEST_SIGNER             = "false"  # Production mode - uses real C2PA certificates from Secrets Manager
    }
  }

  tags = {
    Name = "${local.name_prefix}-worker"
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy.lambda_policy,
    aws_cloudwatch_log_group.worker
  ]
}

# CloudWatch Log Group para Worker Lambda
resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/lambda/${local.name_prefix}-worker"
  retention_in_days = 14
  # Removed KMS encryption to avoid CloudWatch Logs access issues

  tags = {
    Name = "${local.name_prefix}-worker-logs"
  }
}

# SQS Event Source Mapping para Worker Lambda
resource "aws_lambda_event_source_mapping" "sqs_worker" {
  event_source_arn = aws_sqs_queue.manifest_jobs.arn
  function_name    = aws_lambda_function.worker.arn
  batch_size       = 1
  
  # Enable partial batch response
  function_response_types = ["ReportBatchItemFailures"]
  
  # Scaling config
  scaling_config {
    maximum_concurrency = 10
  }
}