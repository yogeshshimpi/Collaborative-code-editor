import asyncHandler from '../utils/asyncHandler.js';
import { executeUserCode, getSupportedLanguages } from '../services/executionService.js';

export const executeCode = asyncHandler(async (req, res) => {
  const { language, fileName, code, stdin, files, provider } = req.body;
  const projectId = req.params?.id || req.body?.projectId || null;

  const result = await executeUserCode({
    language,
    fileName,
    code,
    stdin,
    files,
    projectIdOrRoomId: projectId,
    user: req.user || null,
    providerName: provider || null
  });

  res.status(200).json({
    success: result.success !== false,
    result
  });
});

export const getLanguages = asyncHandler(async (_req, res) => {
  const languages = getSupportedLanguages();
  res.status(200).json({ languages });
});

export default {
  executeCode,
  getLanguages
};
