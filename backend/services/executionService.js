import { getLanguageConfig, getSupportedLanguagesList, detectLanguageFromFileName } from './execution/languageConfig.js';
import { getExecutionProvider } from './execution/providerFactory.js';
import { ApiError } from '../utils/apiError.js';
import { logActivity } from './activityService.js';
import { getProjectById } from '../db/projects.js';
import { logger } from '../utils/logger.js';

/**
 * Execute user-supplied code via sandboxed external execution provider.
 * NEVER executes code directly on the CodeCollab backend host.
 */
export async function executeUserCode({
  language: requestedLanguage,
  fileName,
  code,
  stdin = '',
  files = [],
  projectIdOrRoomId = null,
  user = null,
  providerName = null
}) {
  if (typeof code !== 'string') {
    throw new ApiError(400, 'Source code string is required for execution.');
  }

  // Resolve language configuration
  let langConfig = getLanguageConfig(requestedLanguage);
  if (!langConfig && fileName) {
    langConfig = getLanguageConfig(fileName);
  }

  if (!langConfig) {
    const supportedList = getSupportedLanguagesList().map((l) => l.id).join(', ');
    throw new ApiError(
      400,
      `Unsupported or unrecognized language. Supported languages: ${supportedList}`
    );
  }

  const resolvedFileName = fileName || langConfig.defaultFileName;
  const provider = getExecutionProvider(providerName);

  logger.info(
    `[executionService] Running ${langConfig.id} (${resolvedFileName}) for user: ${user?.email || 'guest'} via ${provider.name}`
  );

  const startTime = Date.now();
  const executionResult = await provider.execute({
    languageConfig: langConfig,
    code,
    fileName: resolvedFileName,
    stdin: typeof stdin === 'string' ? stdin : '',
    files: Array.isArray(files) ? files : []
  });

  const totalDurationMs = Date.now() - startTime;
  if (!executionResult.executionTimeMs) {
    executionResult.executionTimeMs = totalDurationMs;
  }

  // Optionally log activity if project context is available
  if (projectIdOrRoomId && user) {
    try {
      const project = await getProjectById(projectIdOrRoomId, user.id);
      if (project) {
        const exitText = executionResult.exitCode === 0 ? 'succeeded' : `failed (exit code ${executionResult.exitCode})`;
        logActivity({
          roomId: project.room_id,
          userId: user.id,
          userName: user.name || 'User',
          userEmail: user.email || '',
          actionType: 'code_execution',
          targetName: resolvedFileName,
          details: {
            language: langConfig.id,
            exitCode: executionResult.exitCode,
            status: executionResult.status?.description,
            executionTimeMs: executionResult.executionTimeMs,
            provider: provider.name
          },
          summary: `${user.name || 'User'} executed ${resolvedFileName} (${langConfig.displayName}): ${exitText}`
        }).catch(() => {});
      }
    } catch {
      // Activity logging is best-effort and non-blocking
    }
  }

  return executionResult;
}

/**
 * Return list of all supported languages with default templates.
 */
export function getSupportedLanguages() {
  return getSupportedLanguagesList();
}

export default {
  executeUserCode,
  getSupportedLanguages
};
