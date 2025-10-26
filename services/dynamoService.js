// DynamoDB operations for manifests
import { PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDocClient, ENV } from '../config/aws.js';

const TABLE_NAME = ENV.DYNAMODB_TABLE_MANIFESTS;

/**
 * Save manifest metadata to DynamoDB
 */
export async function saveManifest(manifestData) {
  const params = {
    TableName: TABLE_NAME,
    Item: {
      manifestId: manifestData.manifestId,
      status: manifestData.status || 'PENDING', // PENDING, PROCESSING, DONE, ERROR
      s3KeyUpload: manifestData.s3KeyUpload,
      s3KeySigned: manifestData.s3KeySigned || null,
      contentCredentials: manifestData.contentCredentials,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      format: manifestData.format,
      signed: manifestData.signed || false,
    },
  };

  await dynamoDocClient.send(new PutCommand(params));
  return params.Item;
}

/**
 * Get manifest by ID
 */
export async function getManifest(manifestId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      manifestId,
    },
  };

  const result = await dynamoDocClient.send(new GetCommand(params));
  return result.Item;
}

/**
 * Update manifest status
 */
export async function updateManifestStatus(manifestId, status, s3KeySigned = null) {
  const updateExpression = s3KeySigned
    ? 'SET #status = :status, s3KeySigned = :s3KeySigned, updatedAt = :updatedAt, signed = :signed'
    : 'SET #status = :status, updatedAt = :updatedAt';

  const expressionAttributeValues = s3KeySigned
    ? {
        ':status': status,
        ':s3KeySigned': s3KeySigned,
        ':updatedAt': new Date().toISOString(),
        ':signed': true,
      }
    : {
        ':status': status,
        ':updatedAt': new Date().toISOString(),
      };

  const params = {
    TableName: TABLE_NAME,
    Key: {
      manifestId,
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  };

  const result = await dynamoDocClient.send(new UpdateCommand(params));
  return result.Attributes;
}

/**
 * Query manifests by status
 */
export async function getManifestsByStatus(status, limit = 20) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'StatusIndex',
    KeyConditionExpression: '#status = :status',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': status,
    },
    Limit: limit,
    ScanIndexForward: false, // Sort descending by createdAt
  };

  const result = await dynamoDocClient.send(new QueryCommand(params));
  return result.Items;
}
