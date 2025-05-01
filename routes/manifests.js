import express from 'express';
import * as manifestsController from '../controllers/manifestsController.js';

const router = express.Router();

// Create manifest
router.post('/', manifestsController.createManifest);

// Update manifest
router.post('/update', manifestsController.updateManifest);

// Validate manifest via ID
router.get('/:id/validate', manifestsController.validateManifestById);

// Validate manifest via uploaded file
router.post('/validate', manifestsController.validateManifestByFile);

export default router;
