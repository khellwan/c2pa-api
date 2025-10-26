import { v4 as uuidv4 } from 'uuid';
import { generatePresignedUploadUrl, generatePresignedDownloadUrl } from '../services/s3Service.js';
import { getManifest } from '../services/dynamoService.js';
import { ENV } from '../config/aws.js';
import { getMimeTypeExtension } from '../services/c2paService.js';

/**
 * Generate presigned URL for file upload
 * POST /uploads/presigned
 */
export const generateUploadUrl = async (req, res) => {
    try {
        const { contentType, fileName } = req.body;
        
        if (!contentType) {
            return res.status(400).json({ error: 'contentType is required' });
        }
        
        // Generate unique file ID
        const fileId = uuidv4();
        const extension = getMimeTypeExtension(contentType);
        const s3Key = `uploads/${fileId}.${extension}`;
        
        // Generate presigned URL (expires in 1 hour)
        const uploadUrl = await generatePresignedUploadUrl(s3Key, contentType, 3600);
        
        res.json({
            uploadUrl,
            s3Key,
            fileId,
            expiresIn: 3600,
            instructions: 'Use PUT request to upload file to this URL',
        });
    } catch (error) {
        console.error('Error generating upload URL:', error);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
};

/**
 * Get manifest status and download URL
 * GET /manifests/:id/status
 */
export const getManifestStatus = async (req, res) => {
    try {
        const { id } = req.params;
        
        const manifest = await getManifest(id);
        
        if (!manifest) {
            return res.status(404).json({ error: 'Manifest not found' });
        }
        
        const response = {
            manifestId: manifest.manifestId,
            status: manifest.status,
            format: manifest.format,
            createdAt: manifest.createdAt,
            updatedAt: manifest.updatedAt,
            signed: manifest.signed,
        };
        
        // If signed, generate download URL
        if (manifest.status === 'DONE' && manifest.s3KeySigned) {
            const downloadUrl = await generatePresignedDownloadUrl(
                ENV.S3_BUCKET_SIGNED,
                manifest.s3KeySigned,
                3600
            );
            response.downloadUrl = downloadUrl;
            response.expiresIn = 3600;
        }
        
        res.json(response);
    } catch (error) {
        console.error('Error getting manifest status:', error);
        res.status(500).json({ error: 'Failed to get manifest status' });
    }
};

/**
 * Create manifest from S3 key (after upload via presigned URL)
 * POST /manifests/from-upload
 */
export const createManifestFromUpload = async (req, res) => {
    try {
        const { s3Key, contentCredentials } = req.body;
        
        if (!s3Key || !contentCredentials) {
            return res.status(400).json({ 
                error: 's3Key and contentCredentials are required' 
            });
        }
        
        // Extract fileId from s3Key (uploads/fileId.ext)
        const fileId = s3Key.split('/')[1].split('.')[0];
        
        const { saveManifest } = await import('../services/dynamoService.js');
        const { enqueueJob } = await import('../services/sqsService.js');
        
        const manifestId = fileId; // Use same ID
        const fileExtension = getMimeTypeExtension(contentCredentials.format);
        const s3KeySigned = `signed/${manifestId}.${fileExtension}`;
        
        // Save manifest metadata to DynamoDB
        await saveManifest({
            manifestId,
            status: 'PENDING',
            s3KeyUpload: s3Key,
            contentCredentials,
            format: contentCredentials.format,
        });
        
        // Enqueue job for processing
        await enqueueJob({
            type: 'SIGN_MANIFEST',
            manifestId,
            s3KeyUpload: s3Key,
            s3KeySigned,
            contentCredentials,
        });
        
        res.status(202).json({
            manifestId,
            status: 'PENDING',
            message: 'Manifest queued for processing',
            statusUrl: `/manifests/${manifestId}/status`,
        });
    } catch (error) {
        console.error('Error creating manifest from upload:', error);
        res.status(500).json({ error: 'Failed to create manifest' });
    }
};
