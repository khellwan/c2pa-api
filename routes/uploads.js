import express from 'express';
import * as uploadsController from '../controllers/uploadsController.js';

const router = express.Router();

// Generate presigned URL for upload
router.post('/presigned', uploadsController.generateUploadUrl);

// Create manifest from uploaded file (via S3 key)
router.post('/create-manifest', uploadsController.createManifestFromUpload);

export default router;
