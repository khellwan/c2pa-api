import { ManifestBuilder, createC2pa, SigningAlgorithm, createTestSigner } from 'c2pa-node';
import { v4 as uuidv4 } from 'uuid';
import { uploadToS3, downloadFromS3 } from './s3Service.js';
import { saveManifest, getManifest, updateManifestStatus } from './dynamoService.js';
import { enqueueJob } from './sqsService.js';
import { getC2PAKeys } from './secretsService.js';
import { ENV } from '../config/aws.js';

const USE_TEST_SIGNER = process.env.USE_TEST_SIGNER === 'true';

// Create local signer with keys from Secrets Manager
async function createLocalSigner() {
    try {
        const keys = await getC2PAKeys();
        
        return {
            type: 'local',
            certificate: keys.certificate,
            privateKey: keys.privateKey,
            algorithm: SigningAlgorithm.ES256,
            tsaUrl: 'http://timestamp.digicert.com',
        };
    } catch (error) {
        console.error('Error creating local signer, falling back to test signer:', error);
        return await createTestSigner();
    }
}

async function signAsset(asset, manifest) {
    const signer = USE_TEST_SIGNER ? await createTestSigner() : await createLocalSigner();
    const c2pa = createC2pa({
      signer,
    });
  
    const { signedAsset, signedManifest } = await c2pa.sign({
      asset,
      manifest,
      options: {
        embed: true,
      }
    });

    const generatedManifest = await c2pa.read({buffer: signedAsset.buffer, mimeType: manifest.definition.format})

    return { signedAsset, generatedManifest };
}

async function createIngredient(asset, contentCredentials) {
    const signer = USE_TEST_SIGNER ? await createTestSigner() : await createLocalSigner();
    const c2pa = createC2pa({
      signer,
    });
  
    const ingredient = await c2pa.createIngredient({
      asset,
      title: contentCredentials.title || 'Default Title',
      authors: contentCredentials.authors || ['Anonymous'],
      assertions: [
        {
          label: contentCredentials.label || 'c2pa-api.actions',
          data: {
            description: contentCredentials.description || 'Default description',
            version: contentCredentials.version || '1.0.0',
            actions: [
              {
                action: contentCredentials.action || 'c2pa.created',
                timestamp: new Date().toISOString(),
              },
            ],
          },
        },
      ],
    });
  
    return ingredient;
  }

/**
 * Converts a MIME type to the corresponding file extension
 * @param {string} mimeType - The MIME type (ex: "image/jpeg")
 * @return {string} - The file extension (ex: "jpg")
 */
export const getMimeTypeExtension = (mimeType) => {
  let fileExtension = 'bin'; // Default value
  
  if (mimeType && mimeType.includes('/')) {
    // Extract what comes after the slash
    fileExtension = mimeType.split('/')[1];
    
    // Specific adjustments for certain formats
    switch(fileExtension) {
      // Images
      case 'jpeg': 
        return 'jpg'; 
      case 'svg+xml': 
        return 'svg'; 
        
      // Videos
      case 'quicktime': 
        return 'mov'; 
      case 'x-msvideo': 
        return 'avi'; 
      case 'x-matroska': 
        return 'mkv'; 
      case 'mpeg4': 
        return 'mp4'; 
      case '3gpp': 
        return '3gp'; 
      case 'x-flv': 
        return 'flv'; 
        
      // Documents
      case 'msword': 
        return 'doc'; 
      case 'vnd.openxmlformats-officedocument.wordprocessingml.document': 
        return 'docx'; 
      case 'vnd.ms-excel': 
        return 'xls'; 
      case 'vnd.openxmlformats-officedocument.spreadsheetml.sheet': 
        return 'xlsx'; 
      
      // Audio
      case 'mpeg': 
        return 'mp3'; 
      case 'x-wav': 
        return 'wav'; 
        
      // If none of the above, return the original fileExtension
      default:
        return fileExtension;
    }
  }
  
  return fileExtension;
};

export const createManifest = async ({ fileData, contentCredentials }) => {
    try {
        // Decode base64 file
        const buffer = Buffer.from(fileData, 'base64');
        
        // Generate unique manifest ID
        const manifestId = uuidv4();
        const fileExtension = getMimeTypeExtension(contentCredentials.format);
        
        // S3 keys
        const s3KeyUpload = `uploads/${manifestId}.${fileExtension}`;
        const s3KeySigned = `signed/${manifestId}.${fileExtension}`;
        
        // Upload original file to S3 uploads bucket
        await uploadToS3(
            ENV.S3_BUCKET_UPLOADS, 
            s3KeyUpload, 
            buffer, 
            contentCredentials.format
        );
        
        // Save manifest metadata to DynamoDB
        await saveManifest({
            manifestId,
            status: 'PENDING',
            s3KeyUpload,
            contentCredentials,
            format: contentCredentials.format,
        });
        
        // Enqueue job for asynchronous processing
        await enqueueJob({
            type: 'SIGN_MANIFEST',
            manifestId,
            s3KeyUpload,
            s3KeySigned,
            contentCredentials,
        });

        return manifestId;

    } catch (err) {
      console.error('Error creating manifest:', err);
      throw new Error('Failed to create manifest');
    }
};

// Manifest update - add ingredient
export const updateManifest = async ({ fileData, contentCredentials }) => {
    try {
        const buffer = Buffer.from(fileData, 'base64');
        
        // Generate unique manifest ID
        const manifestId = uuidv4();
        const fileExtension = getMimeTypeExtension(contentCredentials.format);
        
        // S3 keys
        const s3KeyUpload = `uploads/${manifestId}.${fileExtension}`;
        const s3KeySigned = `signed/${manifestId}.${fileExtension}`;
        
        // Upload original file to S3 uploads bucket
        await uploadToS3(
            ENV.S3_BUCKET_UPLOADS, 
            s3KeyUpload, 
            buffer, 
            contentCredentials.format
        );
        
        // Save manifest metadata to DynamoDB
        await saveManifest({
            manifestId,
            status: 'PENDING',
            s3KeyUpload,
            contentCredentials,
            format: contentCredentials.format,
        });
        
        // Enqueue job for asynchronous processing (update type)
        await enqueueJob({
            type: 'UPDATE_MANIFEST',
            manifestId,
            s3KeyUpload,
            s3KeySigned,
            contentCredentials,
        });
        
        return manifestId;
    } catch (err) {
        console.error('Error updating manifest:', err);
        throw new Error('Failed to update manifest');
    }
};

// Manifest validation via ID
export const validateManifestById = async (manifestId) => {
    const manifestData = await getManifest(manifestId);
    if (!manifestData) {
        throw new Error('Manifest not found');
    }
    return manifestData;
};

// Manifest validation via file
export const validateManifestByFile = async (fileData, format) => {
    try {
        // Decode base64 file
        const buffer = Buffer.from(fileData, 'base64');
        const mimeType = format;

        const signer = USE_TEST_SIGNER ? await createTestSigner() : await createLocalSigner();
        const c2pa = createC2pa({ signer });
    
        // Read the manifest
        const result = await c2pa.read({ buffer, mimeType });
        if (result) {
            const { active_manifest, manifests, validation_status } = result;
            if (validation_status && validation_status.errors && validation_status.errors.length > 0) {
                return { isValid: false, message: 'Found errors in validating manifest: ' + JSON.stringify(validation_status.errors) };
            }
            return { isValid: true, message: active_manifest };
        } else {
            return('No claim found');
        }
    } catch (err) {
        console.error('Error validating manifest:', err);
        throw new Error('Failed to validate manifest');
    } 
};

// Process job from SQS (called by worker)
export const processManifestJob = async (jobData) => {
    try {
        const { type, manifestId, s3KeyUpload, s3KeySigned, contentCredentials } = jobData;
        
        // Update status to PROCESSING
        await updateManifestStatus(manifestId, 'PROCESSING');
        
        // Download file from S3
        const buffer = await downloadFromS3(ENV.S3_BUCKET_UPLOADS, s3KeyUpload);
        
        // Create asset from buffer
        const asset = { buffer, mimeType: contentCredentials.format };
        
        let manifest;
        
        if (type === 'SIGN_MANIFEST') {
            // Create a C2PA manifest
            manifest = new ManifestBuilder({
                claim_generator: 'c2pa-api',
                format: contentCredentials.format,
                title: contentCredentials.title || 'Default Title',
                authors: contentCredentials.authors || ['Anonymous'],
                assertions: [
                    {
                        label: 'c2pa-api.actions',
                        data: {
                            actions: [
                                {
                                    action: 'c2pa.created',
                                    timestamp: new Date().toISOString(),
                                },
                            ],
                        },
                    },
                ],
            });
        } else if (type === 'UPDATE_MANIFEST') {
            // Create ingredient
            const ingredient = await createIngredient(asset, contentCredentials);
            
            // Create a new manifest builder
            manifest = new ManifestBuilder({
                claim_generator: 'c2pa-api',
                format: contentCredentials.format,
                title: contentCredentials.title || 'Default Title',
                authors: contentCredentials.authors || ['Anonymous'],
                assertions: [
                    {
                        label: 'c2pa-api.actions',
                        data: {
                            actions: [
                                {
                                    action: contentCredentials.action || 'c2pa.edited',
                                    timestamp: new Date().toISOString(),
                                },
                            ],
                        },
                    },
                ],
            });
            
            // Add the ingredient
            manifest.addIngredient(ingredient);
        }
        
        // Sign the asset
        const { signedAsset } = await signAsset(asset, manifest);
        
        // Upload signed file to S3 signed bucket
        await uploadToS3(
            ENV.S3_BUCKET_SIGNED,
            s3KeySigned,
            signedAsset.buffer,
            contentCredentials.format
        );
        
        // Update manifest status to DONE
        await updateManifestStatus(manifestId, 'DONE', s3KeySigned);
        
        return { success: true, manifestId };
        
    } catch (err) {
        console.error('Error processing manifest job:', err);
        
        // Update status to ERROR
        await updateManifestStatus(jobData.manifestId, 'ERROR');
        
        throw err;
    }
};


