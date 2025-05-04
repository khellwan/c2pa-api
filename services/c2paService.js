import { ManifestBuilder, createC2pa, SigningAlgorithm, createTestSigner } from 'c2pa-node';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simulating a temporary storage for manifests (could be S3 later)
const manifestStorage = {};

// TODO: Use local signer instead of test signer
async function createLocalSigner() {
    return{
        type: 'local',
        certificate: process.env.PUBLIC_KEY,
        privateKey: process.env.PRIVATE_KEY,
        algorithm: SigningAlgorithm.ES256,
        tsaUrl: 'http://timestamp.digicert.com',
    };
}

async function signAsset(asset, manifest) {
    const signer = await createTestSigner();
    const c2pa = createC2pa({
      signer,
    });
  
    const { signedAsset, signedManifest } = await c2pa.sign({
      asset,
      manifest,
      options: {
        outputPath: "../uploads",
        embed: true,
      }
    });

    const generatedManifest = await c2pa.read({buffer: signedAsset.buffer, mimeType: manifest.definition.format})

    return { signedAsset, generatedManifest };
}

async function createIngredient(asset, contentCredentials) {
    const signer = await createTestSigner();
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
    
        // Create a C2PA manifest
        const manifest = new ManifestBuilder({
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
                        },
                        ],
                    },
                },
            ],
        });

        // Create asset from buffer
        const asset = { buffer, mimeType: contentCredentials.format };
        
        const { signedAsset, generatedManifest } = await signAsset(asset, manifest);

        // Generate a storage manifest ID
        const manifestId = generatedManifest.active_manifest.label.replace('urn:uuid:', '');

        // Define the file path using the manifest ID
        const fileExtension = getMimeTypeExtension(contentCredentials.format);
        const tempFileName = manifestId + '.' + fileExtension;
        const tempFilePath = path.join(__dirname, '../uploads', tempFileName);

        // Save the file to /uploads
        fs.writeFileSync(tempFilePath, signedAsset.buffer);

        // Save in storage TODO: Use S3 
        manifestStorage[manifestId] = {
          manifest,
          contentCredentials,
          filePath: tempFilePath,
          signed: false,
        };

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

        // Create ingredient asset from buffer
        const ingredientAssetFromBuffer = {
            buffer: buffer,
            mimeType: contentCredentials.format
        };

        // Create ingredient
        const ingredient = await createIngredient(ingredientAssetFromBuffer, contentCredentials);
        
        // Create a new manifest builder
        const newManifest = new ManifestBuilder({
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
        
        // Add the ingredient to the new manifest
        newManifest.addIngredient(ingredient);
        
        // Create asset from buffer
        const asset = { buffer, mimeType: contentCredentials.format };
        
        // Sign the asset with the new manifest
        const { signedAsset, generatedManifest } = await signAsset(asset, newManifest);
        
        // Generate a storage manifest ID
        const manifestId = generatedManifest.active_manifest.label.replace('urn:uuid:', '');

        // Define the file path using the manifest ID
        const fileExtension = getMimeTypeExtension(contentCredentials.format);
        const tempFileName = manifestId + '.' + fileExtension;
        const tempFilePath = path.join(__dirname, '../uploads', tempFileName);

        // Save the file to /uploads
        fs.writeFileSync(tempFilePath, signedAsset.buffer);

        // Save in storage TODO: Use S3 
        manifestStorage[manifestId] = {
          manifest: newManifest,
          contentCredentials,
          filePath: tempFilePath,
          signed: true,
        };
        
        return manifestId;
    } catch (err) {
        console.error('Error updating manifest:', err);
        throw new Error('Failed to update manifest');
    }
};

// Manifest validation via ID
export const validateManifestById = async (manifestId) => {
    const manifestData = manifestStorage[manifestId];
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

        const signer = await createTestSigner();
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


