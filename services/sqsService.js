// SQS operations for job queue
import { SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { sqsClient, ENV } from '../config/aws.js';

const QUEUE_URL = ENV.SQS_QUEUE_MANIFEST_JOBS;

/**
 * Send message to SQS queue
 */
export async function enqueueJob(jobData) {
  const params = {
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(jobData),
    MessageAttributes: {
      JobType: {
        DataType: 'String',
        StringValue: jobData.type || 'SIGN_MANIFEST',
      },
      ManifestId: {
        DataType: 'String',
        StringValue: jobData.manifestId,
      },
    },
  };

  const result = await sqsClient.send(new SendMessageCommand(params));
  return {
    messageId: result.MessageId,
    queueUrl: QUEUE_URL,
  };
}

/**
 * Receive messages from SQS queue
 */
export async function receiveJobs(maxMessages = 1, waitTimeSeconds = 20) {
  const params = {
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: maxMessages,
    WaitTimeSeconds: waitTimeSeconds,
    MessageAttributeNames: ['All'],
  };

  const result = await sqsClient.send(new ReceiveMessageCommand(params));
  return result.Messages || [];
}

/**
 * Delete message from SQS queue
 */
export async function deleteJob(receiptHandle) {
  const params = {
    QueueUrl: QUEUE_URL,
    ReceiptHandle: receiptHandle,
  };

  await sqsClient.send(new DeleteMessageCommand(params));
  return { deleted: true };
}
