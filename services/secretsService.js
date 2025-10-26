// Secrets Manager operations
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { secretsClient, ENV } from '../config/aws.js';

let cachedSecret = null;

/**
 * Get C2PA signing keys from Secrets Manager
 */
export async function getC2PAKeys() {
  // Return cached secret if available
  if (cachedSecret) {
    return cachedSecret;
  }

  try {
    const command = new GetSecretValueCommand({
      SecretId: ENV.SECRET_ARN_C2PA_KEYS,
    });

    const response = await secretsClient.send(command);
    
    // Parse secret string
    const secret = JSON.parse(response.SecretString);
    
    // Cache for subsequent calls
    cachedSecret = {
      privateKey: secret.private_key,
      certificate: secret.certificate,
      caChain: secret.ca_chain,
      passphrase: secret.passphrase,
    };

    return cachedSecret;
  } catch (error) {
    console.error('Error fetching C2PA keys from Secrets Manager:', error);
    throw new Error('Failed to retrieve signing keys');
  }
}

/**
 * Clear cached secret (useful for key rotation)
 */
export function clearSecretCache() {
  cachedSecret = null;
}
