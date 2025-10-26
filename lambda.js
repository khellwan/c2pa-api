import serverless from 'serverless-http';
import app from './server.js';

// Set environment for Lambda
process.env.NODE_ENV = 'lambda';

// Create Lambda handler
export const handler = serverless(app, {
  binary: ['image/*', 'video/*', 'audio/*', 'application/octet-stream'],
  request(request, event, context) {
    // Add AWS context to request
    request.awsEvent = event;
    request.awsContext = context;
    
    // Fix body parsing - if isBase64Encoded is false, parse as JSON
    if (event.body && !event.isBase64Encoded && typeof event.body === 'string') {
      try {
        request.body = JSON.parse(event.body);
      } catch (e) {
        // Body is already parsed or invalid JSON
      }
    }
  },
});
