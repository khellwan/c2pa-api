import * as c2paService from '../services/c2paService.js';

export const createManifest = async (req, res) => {
  try {
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
    const result = await c2paService.validateManifestByFile(fileData, format);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
