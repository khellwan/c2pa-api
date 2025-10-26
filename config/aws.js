// AWS SDK clients configuration
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const region = process.env.AWS_REGION || 'us-east-1';

// S3 Client
export const s3Client = new S3Client({
  region,
  maxAttempts: 3,
});

// DynamoDB Client
const dynamoClient = new DynamoDBClient({
  region,
  maxAttempts: 3,
});

export const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

// SQS Client
export const sqsClient = new SQSClient({
  region,
  maxAttempts: 3,
});

// Secrets Manager Client
export const secretsClient = new SecretsManagerClient({
  region,
  maxAttempts: 3,
});

// Environment variables
export const ENV = {
  S3_BUCKET_UPLOADS: process.env.S3_BUCKET_UPLOADS,
  S3_BUCKET_SIGNED: process.env.S3_BUCKET_SIGNED,
  DYNAMODB_TABLE_MANIFESTS: process.env.DYNAMODB_TABLE_MANIFESTS,
  SQS_QUEUE_MANIFEST_JOBS: process.env.SQS_QUEUE_MANIFEST_JOBS,
  SECRET_ARN_C2PA_KEYS: process.env.SECRET_ARN_C2PA_KEYS,
  AWS_REGION: region,
};
