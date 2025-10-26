import express from 'express';
import * as manifestsController from '../controllers/manifestsController.js';
import * as uploadsController from '../controllers/uploadsController.js';

const router = express.Router();

// Create manifest
router.post('/', manifestsController.createManifest);

// Update manifest
router.post('/update', manifestsController.updateManifest);

// Get manifest status
router.get('/:id/status', uploadsController.getManifestStatus);

// Validate manifest via ID
router.get('/:id/validate', manifestsController.validateManifestById);

// Validate manifest via uploaded file
router.post('/validate', manifestsController.validateManifestByFile);

export default router;
