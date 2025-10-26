// S3 operations for file storage
import { 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, ENV } from '../config/aws.js';

/**
 * Upload file to S3
 */
export async function uploadToS3(bucket, key, buffer, contentType) {
  const params = {
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ServerSideEncryption: 'aws:kms',
  };

  await s3Client.send(new PutObjectCommand(params));
  return { bucket, key };
}

/**
 * Download file from S3
 */
export async function downloadFromS3(bucket, key) {
  const params = {
    Bucket: bucket,
    Key: key,
  };

  const response = await s3Client.send(new GetObjectCommand(params));
  
  // Convert stream to buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

/**
 * Generate presigned URL for upload (PUT)
 */
export async function generatePresignedUploadUrl(key, contentType, expiresIn = 3600) {
  const params = {
    Bucket: ENV.S3_BUCKET_UPLOADS,
    Key: key,
    ContentType: contentType,
  };

  const command = new PutObjectCommand(params);
  const url = await getSignedUrl(s3Client, command, { expiresIn });
  
  return url;
}

/**
 * Generate presigned URL for download (GET)
 */
export async function generatePresignedDownloadUrl(bucket, key, expiresIn = 3600) {
  const params = {
    Bucket: bucket,
    Key: key,
  };

  const command = new GetObjectCommand(params);
  const url = await getSignedUrl(s3Client, command, { expiresIn });
  
  return url;
}

/**
 * Delete file from S3
 */
export async function deleteFromS3(bucket, key) {
  const params = {
    Bucket: bucket,
    Key: key,
  };

  await s3Client.send(new DeleteObjectCommand(params));
  return { deleted: true, bucket, key };
}
