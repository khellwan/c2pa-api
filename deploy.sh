#!/bin/bash

# Deploy script for c2pa-api to AWS Lambda
# Usage: ./deploy.sh [environment] [region]

set -e

ENVIRONMENT=${1:-dev}
REGION=${2:-us-east-1}
PROJECT_NAME="c2pa-api"

echo "========================================"
echo "Deploying $PROJECT_NAME to AWS"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "========================================"

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $ACCOUNT_ID"

# ECR Repository names
ECR_REPO_API="${PROJECT_NAME}-api"
ECR_REPO_WORKER="${PROJECT_NAME}-worker"

# Step 1: Create ECR repositories if they don't exist
echo ""
echo "Step 1: Creating ECR repositories..."
aws ecr describe-repositories --repository-names $ECR_REPO_API --region $REGION 2>/dev/null || \
  aws ecr create-repository --repository-name $ECR_REPO_API --region $REGION

aws ecr describe-repositories --repository-names $ECR_REPO_WORKER --region $REGION 2>/dev/null || \
  aws ecr create-repository --repository-name $ECR_REPO_WORKER --region $REGION

# Step 2: Login to ECR
echo ""
echo "Step 2: Logging in to ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Step 3: Build Docker images
echo ""
echo "Step 3: Building Docker images..."

# API Lambda
echo "Building API Lambda image..."
docker build -f Dockerfile.lambda -t $PROJECT_NAME-api:latest .
docker tag $PROJECT_NAME-api:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_API:latest
docker tag $PROJECT_NAME-api:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_API:$ENVIRONMENT

# Worker Lambda
echo "Building Worker Lambda image..."
docker build -f Dockerfile.worker -t $PROJECT_NAME-worker:latest .
docker tag $PROJECT_NAME-worker:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_WORKER:latest
docker tag $PROJECT_NAME-worker:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_WORKER:$ENVIRONMENT

# Step 4: Push images to ECR
echo ""
echo "Step 4: Pushing images to ECR..."
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_API:latest
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_API:$ENVIRONMENT

docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_WORKER:latest
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_WORKER:$ENVIRONMENT

# Step 5: Deploy infrastructure with Terraform
echo ""
echo "Step 5: Deploying infrastructure with Terraform..."
cd terraform

# Initialize Terraform if needed
if [ ! -d ".terraform" ]; then
  terraform init
fi

# Apply Terraform with image URIs
terraform apply \
  -var="environment=$ENVIRONMENT" \
  -var="aws_region=$REGION" \
  -var="lambda_image_uri=$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_API:$ENVIRONMENT" \
  -auto-approve

cd ..

echo ""
echo "========================================"
echo "Deployment completed successfully!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Configure C2PA keys in Secrets Manager"
echo "2. Get API Gateway URL from Terraform outputs"
echo "3. Test the API endpoints"
echo ""
echo "Get outputs:"
echo "  cd terraform && terraform output"
