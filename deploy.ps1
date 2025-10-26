# Deploy script for c2pa-api to AWS Lambda (PowerShell)
# Usage: .\deploy.ps1 [environment] [region]

param(
    [string]$Environment = "dev",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"
$ProjectName = "c2pa-api"

Write-Host "========================================" -ForegroundColor Green
Write-Host "Deploying $ProjectName to AWS" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green

# Get AWS Account ID
Write-Host "`nGetting AWS Account ID..." -ForegroundColor Cyan
$AccountId = (aws sts get-caller-identity --query Account --output text)
Write-Host "AWS Account ID: $AccountId" -ForegroundColor Yellow

# ECR Repository names
$EcrRepoApi = "$ProjectName-api"
$EcrRepoWorker = "$ProjectName-worker"

# Step 1: Create ECR repositories
Write-Host "`nStep 1: Creating ECR repositories..." -ForegroundColor Cyan
try {
    aws ecr describe-repositories --repository-names $EcrRepoApi --region $Region 2>$null
} catch {
    aws ecr create-repository --repository-name $EcrRepoApi --region $Region
}

try {
    aws ecr describe-repositories --repository-names $EcrRepoWorker --region $Region 2>$null
} catch {
    aws ecr create-repository --repository-name $EcrRepoWorker --region $Region
}

# Step 2: Login to ECR
Write-Host "`nStep 2: Logging in to ECR..." -ForegroundColor Cyan
Write-Host "Note: If login fails, run manually:" -ForegroundColor Yellow
Write-Host "  aws ecr get-login-password --region $Region > ecr-password.txt" -ForegroundColor Yellow
Write-Host "  Get-Content ecr-password.txt | docker login --username AWS --password-stdin $AccountId.dkr.ecr.$Region.amazonaws.com" -ForegroundColor Yellow
Write-Host "  Remove-Item ecr-password.txt" -ForegroundColor Yellow

# Try login (may fail on some PowerShell versions, but Docker caches credentials)
aws ecr get-login-password --region $Region > ecr-password.txt 2>$null
if (Test-Path ecr-password.txt) {
    Get-Content ecr-password.txt | docker login --username AWS --password-stdin "$AccountId.dkr.ecr.$Region.amazonaws.com" 2>$null
    Remove-Item ecr-password.txt -Force -ErrorAction SilentlyContinue
}
Write-Host "ECR login step completed (using cached credentials if login failed)" -ForegroundColor Green

# Step 3: Build Docker images
Write-Host "`nStep 3: Building Docker images..." -ForegroundColor Cyan

# API Lambda
Write-Host "Building API Lambda image..." -ForegroundColor Yellow
docker buildx build --platform linux/amd64 --provenance=false -f Dockerfile.lambda -t "${ProjectName}-api:latest" --load .
docker tag "${ProjectName}-api:latest" "$AccountId.dkr.ecr.$Region.amazonaws.com/${EcrRepoApi}:latest"
docker tag "${ProjectName}-api:latest" "$AccountId.dkr.ecr.$Region.amazonaws.com/${EcrRepoApi}:$Environment"

# Worker Lambda
Write-Host "Building Worker Lambda image..." -ForegroundColor Yellow
docker buildx build --platform linux/amd64 --provenance=false -f Dockerfile.worker -t "${ProjectName}-worker:latest" --load .
docker tag "${ProjectName}-worker:latest" "$AccountId.dkr.ecr.$Region.amazonaws.com/${EcrRepoWorker}:latest"
docker tag "${ProjectName}-worker:latest" "$AccountId.dkr.ecr.$Region.amazonaws.com/${EcrRepoWorker}:$Environment"

# Step 4: Push images to ECR
Write-Host "`nStep 4: Pushing images to ECR..." -ForegroundColor Cyan
docker push "$AccountId.dkr.ecr.$Region.amazonaws.com/${EcrRepoApi}:latest"
docker push "$AccountId.dkr.ecr.$Region.amazonaws.com/${EcrRepoApi}:$Environment"

docker push "$AccountId.dkr.ecr.$Region.amazonaws.com/${EcrRepoWorker}:latest"
docker push "$AccountId.dkr.ecr.$Region.amazonaws.com/${EcrRepoWorker}:$Environment"

# Step 5: Deploy infrastructure with Terraform
Write-Host "`nStep 5: Deploying infrastructure with Terraform..." -ForegroundColor Cyan
Set-Location terraform

# Initialize Terraform if needed
if (-not (Test-Path ".terraform")) {
    terraform init
}

# Apply Terraform with image URIs
terraform apply `
  -var="environment=$Environment" `
  -var="aws_region=$Region" `
  -var="lambda_image_uri=$AccountId.dkr.ecr.$Region.amazonaws.com/${EcrRepoApi}:$Environment" `
  -var="lambda_worker_image_uri=$AccountId.dkr.ecr.$Region.amazonaws.com/${EcrRepoWorker}:$Environment" `
  -auto-approve

Set-Location ..

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Deployment completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Configure C2PA keys in Secrets Manager"
Write-Host "2. Get API Gateway URL from Terraform outputs"
Write-Host "3. Test the API endpoints"
Write-Host "`nGet outputs:" -ForegroundColor Cyan
Write-Host "  cd terraform; terraform output"
