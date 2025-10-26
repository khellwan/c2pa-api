import { processManifestJob } from './services/c2paService.js';
import { deleteJob } from './services/sqsService.js';

/**
 * Lambda handler for processing SQS messages (manifest jobs)
 * Triggered by SQS queue
 */
export const handler = async (event) => {
  console.log('Processing SQS messages:', JSON.stringify(event, null, 2));
  
  const results = [];
  
  // Process each message
  for (const record of event.Records) {
    try {
      // Parse message body
      const jobData = JSON.parse(record.body);
      
      console.log(`Processing job for manifest: ${jobData.manifestId}`);
      
      // Process the manifest job
      const result = await processManifestJob(jobData);
      
      console.log(`Successfully processed manifest: ${jobData.manifestId}`);
      
      results.push({
        manifestId: jobData.manifestId,
        status: 'success',
        result,
      });
      
      // Message will be automatically deleted from queue
      // (using default SQS Lambda behavior)
      
    } catch (error) {
      console.error('Error processing message:', error);
      
      results.push({
        messageId: record.messageId,
        status: 'error',
        error: error.message,
      });
      
      // On error, message will go to DLQ after max retries
      // You can also manually delete it to prevent retries:
      // await deleteJob(record.receiptHandle);
    }
  }
  
  return {
    batchItemFailures: results
      .filter(r => r.status === 'error')
      .map(r => ({ itemIdentifier: r.messageId })),
  };
};
