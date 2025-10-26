# Deploy Guide - c2pa-api on AWS

## Overview

This guide details the complete deployment process for c2pa-api on AWS using serverless architecture.

## Implemented Architecture

```
Client → WAF/CloudFront → API Gateway → Lambda (API) → S3/DynamoDB
                                              ↓
                                            SQS Queue
                                              ↓
                                        Lambda (Worker) → S3 (signed)
```

## Components

- **Lambda API**: REST endpoints to create/update/validate manifests
- **Lambda Worker**: Processes asynchronous jobs from SQS queue
- **S3**: Two buckets (uploads and signed)
- **DynamoDB**: Manifest metadata
- **SQS**: Job queue with DLQ
- **Secrets Manager**: C2PA keys
- **CloudFront + WAF**: CDN and protection

## Prerequisites

1. **AWS CLI** configured
   ```bash
   aws configure
   ```

2. **Docker** installed and running

3. **Terraform** >= 1.0
   ```bash
   terraform --version
   ```

4. **Node.js** 20+ (for local testing)

5. **IAM Permissions** to create AWS resources

## Deployment Step by Step

### 1. Clone and Configure

```bash
cd c2pa-api
```

### 2. Configure Terraform Variables

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
```hcl
project_name = "c2pa-api"
environment  = "dev"
aws_region   = "us-east-1"

lambda_memory  = 512
lambda_timeout = 30

enable_waf = true
rate_limit = 1000
```

### 3. Automated Deploy (Recommended)

**Windows (PowerShell):**
```powershell
.\deploy.ps1 dev us-east-1
```

**Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh dev us-east-1
```

This script performs:
- Creates ECR repositories
- Builds Docker images (API and Worker)
- Pushes to ECR
- Deploys infrastructure via Terraform

### 4. Manual Deploy (Step by Step)

#### 4.1. Create ECR Repositories

```bash
aws ecr create-repository --repository-name c2pa-api-api --region us-east-1
aws ecr create-repository --repository-name c2pa-api-worker --region us-east-1
```

#### 4.2. Build and Push Images

```bash
# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1

# Login to ECR
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Build API Lambda
docker build -f Dockerfile.lambda -t c2pa-api-api:latest .
docker tag c2pa-api-api:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/c2pa-api-api:latest
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/c2pa-api-api:latest

# Build Worker Lambda
docker build -f Dockerfile.worker -t c2pa-api-worker:latest .
docker tag c2pa-api-worker:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/c2pa-api-worker:latest
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/c2pa-api-worker:latest
```

#### 4.3. Deploy with Terraform

```bash
cd terraform
terraform init

terraform apply \
  -var="lambda_image_uri=$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/c2pa-api-api:latest" \
  -var="lambda_worker_image_uri=$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/c2pa-api-worker:latest"
```

### 5. Configure C2PA Keys

#### 5.1. Get Secret ARN

```bash
cd terraform
SECRET_ARN=$(terraform output -raw secret_arn_c2pa_keys)
```

#### 5.2. Update Secret with Real Keys

```bash
aws secretsmanager update-secret \
  --secret-id $SECRET_ARN \
  --secret-string '{
    "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----",
    "certificate": "-----BEGIN CERTIFICATE-----\nYOUR_CERT_HERE\n-----END CERTIFICATE-----",
    "ca_chain": "-----BEGIN CERTIFICATE-----\nCA_CHAIN_HERE\n-----END CERTIFICATE-----",
    "passphrase": ""
  }'
```

**Note**: For development, keep `USE_TEST_SIGNER=true` in environment variables.

### 6. Get URLs and Test

```bash
cd terraform

# API Gateway URL
terraform output api_gateway_url

# CloudFront URL
terraform output cloudfront_url
```

## Testing the API

### 1. Health Check

```bash
API_URL=$(cd terraform && terraform output -raw api_gateway_url)

curl $API_URL/health
```

### 2. Generate Presigned URL for Upload

```bash
curl -X POST $API_URL/uploads/presigned \
  -H "Content-Type: application/json" \
  -d '{
    "contentType": "image/jpeg",
    "fileName": "test.jpg"
  }'
```

Response:
```json
{
  "uploadUrl": "https://s3.amazonaws.com/...",
  "s3Key": "uploads/uuid.jpg",
  "fileId": "uuid",
  "expiresIn": 3600
}
```

### 3. Upload File

```bash
# Use the returned uploadUrl
curl -X PUT "<uploadUrl>" \
  --upload-file test.jpg \
  -H "Content-Type: image/jpeg"
```

### 4. Create Manifest

```bash
curl -X POST $API_URL/uploads/create-manifest \
  -H "Content-Type: application/json" \
  -d '{
    "s3Key": "uploads/uuid.jpg",
    "contentCredentials": {
      "format": "image/jpeg",
      "title": "Test Image",
      "authors": ["John Doe"]
    }
  }'
```

Response:
```json
{
  "manifestId": "uuid",
  "status": "PENDING",
  "statusUrl": "/manifests/uuid/status"
}
```

### 5. Check Status

```bash
curl $API_URL/manifests/{manifestId}/status
```

Response (when DONE):
```json
{
  "manifestId": "uuid",
  "status": "DONE",
  "downloadUrl": "https://s3.amazonaws.com/...",
  "expiresIn": 3600,
  "signed": true
}
```

## Monitoring

### CloudWatch Logs

```bash
# API Lambda logs
aws logs tail /aws/lambda/c2pa-api-dev-api --follow

# Worker Lambda logs
aws logs tail /aws/lambda/c2pa-api-dev-worker --follow
```

### SQS Metrics

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/SQS \
  --metric-name ApproximateNumberOfMessagesVisible \
  --dimensions Name=QueueName,Value=c2pa-api-dev-manifest-jobs \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-01T23:59:59Z \
  --period 300 \
  --statistics Average
```

## Troubleshooting

### Lambda Timeout

If C2PA processing takes too long:

```hcl
# terraform/terraform.tfvars
lambda_timeout = 60  # Increase to 60s
```

### Insufficient Memory

```hcl
# terraform/terraform.tfvars
lambda_memory = 1024  # Increase to 1GB
```

### Invalid C2PA Keys

Check Worker Lambda logs:
```bash
aws logs tail /aws/lambda/c2pa-api-dev-worker --since 5m
```

If you see "falling back to test signer", the Secrets Manager keys are incorrect.

## Cleanup

To remove all resources:

```bash
cd terraform
terraform destroy
```

**Warning**: This removes ALL resources, including data in S3 and DynamoDB.

## Next Steps

1. **Custom Domain**: Configure Route 53 and ACM certificate
2. **CI/CD**: Automate deployment with GitHub Actions
3. **Monitoring**: Set up CloudWatch alarms
4. **Testing**: Implement automated tests
5. **Multi-region**: Replicate to other regions for HA
