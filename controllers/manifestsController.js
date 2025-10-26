import * as c2paService from '../services/c2paService.js';

export const createManifest = async (req, res) => {
  try {
    // Debug: Log request body
    console.log('Request body:', JSON.stringify(req.body));
    console.log('Body keys:', Object.keys(req.body || {}));
    
    // Check if required parameters are present
    if (!req.body) {
      return res.status(400).json({ error: "Request body is missing" });
    }
    if (!req.body.fileData) {
      return res.status(400).json({ error: "fileData is required" });
    } 
    if (!req.body.contentCredentials) {
      return res.status(400).json({ error: "contentCredentials is required" });
    } 
    if (!req.body.contentCredentials.format) {
      return res.status(400).json({ error: "format is required" });
    } 

    const result = await c2paService.createManifest({
      fileData: req.body.fileData,
      contentCredentials: req.body.contentCredentials
    });
    
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateManifest = async (req, res) => {
  // Check if required parameters are present
  if (!req.body) {
    return res.status(400).json({ error: "Request body is missing" });
  }
  if (!req.body.fileData) {
    return res.status(400).json({ error: "fileData is required" });
  } 
  if (!req.body.contentCredentials) {
    return res.status(400).json({ error: "contentCredentials is required" });
  } 
  if (!req.body.contentCredentials.format) {
    return res.status(400).json({ error: "format is required" });
  } 
  try {
    const result = await c2paService.updateManifest({
      fileData: req.body.fileData,
      contentCredentials: req.body.contentCredentials
    });
    res.status(200).json(result);
  } catch (err) {   
    // For other types of errors
    res.status(500).json({ error: err.message });
  }
};

export const validateManifestById = async (req, res) => {
  try {
    const manifestId = req.params.id;
    const result = await c2paService.validateManifestById(manifestId);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const validateManifestByFile = async (req, res) => {
  try {
    const fileData = req.body.fileData;
    const format = req.body.format;
    
    // Log de validação com informações do cliente
    console.log('=== VALIDATE MANIFEST BY FILE ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('IP:', req.ip || req.connection?.remoteAddress);
    console.log('User-Agent:', req.get('user-agent'));
    console.log('Format:', format);
    console.log('File size (base64):', fileData?.length || 0, 'bytes');
    console.log('File size (decoded):', fileData ? Math.floor(fileData.length * 0.75) : 0, 'bytes');
    console.log('Request headers:', JSON.stringify(req.headers));
    
    const result = await c2paService.validateManifestByFile(fileData, format);
    
    console.log('Validation result:', result.isValid ? 'VALID' : 'INVALID');
    console.log('=================================');
    
    res.status(200).json(result);
  } catch (err) {
    console.error('Validation error:', err);
    res.status(500).json({ error: err.message });
  }
};
