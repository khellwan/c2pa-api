import { ManifestBuilder, createC2pa, SigningAlgorithm, createTestSigner } from 'c2pa-node';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simulating a temporary storage for manifests (could be S3 later)
const manifestStorage = {};

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
    });

    return signedAsset;
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
        const id = uuidv4();
    
        // Use the MIME type to extension conversion function
        const fileExtension = getMimeTypeExtension(contentCredentials.format);
    
        // Temporarily save the file with the extracted extension
        const tempFileName = id + '.' + fileExtension;
        const tempFilePath = path.join(__dirname, '../uploads', tempFileName);
    
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


        // TODO: Use functions to sign and create ingredient
        // Instantiate signer and c2pa
        const signer = await createTestSigner();
        const c2pa = createC2pa({ signer });
        
        // Create ingredient asset from buffer
        const ingredientAssetFromBuffer = {
            buffer: buffer,
            mimeType: contentCredentials.format
        };

        // Create ingredient
        const ingredient = await c2pa.createIngredient({
            asset: ingredientAssetFromBuffer,
            title: contentCredentials.title || 'Default Title'
        });
        
        // Add ingredient to manifest
        manifest.addIngredient(ingredient);
        
        // Create asset from buffer
        const asset = { buffer, mimeType: contentCredentials.format };
        
        // Sign the manifest and asset
        const {signedAsset, signedManifest} = await c2pa.sign({
            asset,
            manifest,
            options: {
                outputPath: "../uploads",
            },
        });

        // Generate a storage manifest ID
        const manifestId = id;

        // Save in storage
        manifestStorage[manifestId] = {
            tempFilePath,
            manifest,
            contentCredentials,
            fileExtension,
            signed: false,
        };

        // Writes file with embedded manifest
        fs.writeFileSync(tempFilePath, signedAsset.buffer);
        
        // DEBUG: Log the manifest data
        //console.log('Manifest data:', await c2pa.read({buffer: signedAsset.buffer, mimeType: contentCredentials.format}));

        // TODO: Store the file in s3 and return the URL
        return { 
            signedAsset: signedAsset.buffer.toString('base64'),
            manifestId 
        };
    } catch (err) {
      console.error('Error creating manifest:', err);
      throw new Error('Failed to create manifest');
    }
};

// Manifest signing
export const signManifest = async (manifestId) => {
  // TODO: Implement manifest signature logic. Will it be needed?
};

// Manifest update - add ingredient
export const updateManifest = async (fileData, contentCredentials) => {
    
    try {
        const buffer = Buffer.from(fileData, 'base64');

        // Create a C2PA manifest
        const manifest = new ManifestBuilder({
            claim_generator: 'c2pa-api',
            format: contentCredentials.format,
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

        // TODO: Use functions to sign and create ingredient
        // Instantiate signer and c2pa
        const signer = await createTestSigner();
        const c2pa = createC2pa({ signer });

        // Crete ingredient asset from buffer
        const ingredientAssetFromBuffer = {
            buffer: buffer,
            mimeType: contentCredentials.format
        };

        // Create ingredient
        const ingredient = await c2pa.createIngredient({
            asset: ingredientAssetFromBuffer,
            title: contentCredentials.title || 'Default Title'
        });

        // Add ingredient to manifest
        manifest.addIngredient(ingredient);
        return manifest;
    } catch (err) {
        console.error('Error creating manifest:', err);
        throw new Error('Failed to create manifest');
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
        const result = await c2pa.read({ buffer, mimeType});
        if (result) {
            const { active_manifest, manifests, validation_status } = result;
            if (validation_status) {
                return({isValid: false, message: 'Found errors in validating manifest: ' + validation_status}.toJson());
            }
            return({isValid: true, message: active_manifest}.toJson());
        } else {
            return('No claim found');
        }
    } catch (err) {
        console.error('Error validating manifest:', err);
        throw new Error('Failed to validate manifest');
    } 
};


