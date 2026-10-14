import ExecutionProvider from './ExecutionProvider.js';
import { ApiError } from '../../utils/apiError.js';
import { logger } from '../../utils/logger.js';

export class PistonAdapter extends ExecutionProvider {
  constructor({ apiUrl = 'https://emkc.org/api/v2/piston', apiKey = '', timeoutMs = 10000 } = {}) {
    super('piston');
    this.apiUrl = (apiUrl || 'https://emkc.org/api/v2/piston').replace(/\/+$/, '');
    this.apiKey = apiKey || '';
    this.timeoutMs = timeoutMs || 10000;
  }

  async execute({ languageConfig, code, fileName, stdin = '', files = [], timeoutMs }) {
    const pistonConfig = languageConfig?.piston;
    if (!pistonConfig?.language) {
      throw new ApiError(400, `Language ${languageConfig?.displayName || 'unknown'} is not supported by Piston adapter.`);
    }

    const effectiveTimeoutMs = timeoutMs || this.timeoutMs;
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers.Authorization = this.apiKey;
    }

    // Build files array with the main file first, then auxiliary files if any
    const payloadFiles = [
      {
        name: fileName || languageConfig.defaultFileName,
        content: code || ''
      }
    ];

    if (Array.isArray(files)) {
      for (const f of files) {
        if (f.name && f.name !== fileName && typeof f.content === 'string') {
          payloadFiles.push({
            name: f.name,
            content: f.content
          });
        }
      }
    }

    const payload = {
      language: pistonConfig.language,
      version: pistonConfig.version || '*',
      files: payloadFiles,
      stdin: stdin || '',
      run_timeout: effectiveTimeoutMs,
      compile_timeout: effectiveTimeoutMs
    };

    const endpoint = `${this.apiUrl}/execute`;
    logger.info(`[PistonAdapter] Dispatching ${languageConfig.id} execution to ${endpoint}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs + 3000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error(`[PistonAdapter] HTTP ${response.status}: ${errorText}`);
        throw new ApiError(
          response.status === 429 ? 429 : 502,
          response.status === 429
            ? 'Piston rate limit reached. Please wait a moment.'
            : `Piston execution service error (${response.status}): ${errorText || response.statusText}`
        );
      }

      const data = await response.json();

      const runPhase = data.run || {};
      const compilePhase = data.compile || null;

      const compileOutput = compilePhase?.output || compilePhase?.stderr || null;
      const isCompileError = compilePhase && compilePhase.code !== 0;

      const exitCode = isCompileError ? compilePhase.code : (runPhase.code ?? 0);
      const isSuccess = !isCompileError && exitCode === 0;

      let statusDescription = 'Accepted';
      if (isCompileError) {
        statusDescription = 'Compilation Error';
      } else if (runPhase.signal) {
        statusDescription = `Terminated (${runPhase.signal})`;
      } else if (exitCode !== 0) {
        statusDescription = `Exited with code ${exitCode}`;
      }

      return this.formatNormalizedResult({
        stdout: runPhase.stdout || '',
        stderr: runPhase.stderr || '',
        compileOutput: isCompileError ? compileOutput : null,
        exitCode,
        statusDescription,
        isSuccess,
        language: languageConfig.id,
        fileName,
        raw: data
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new ApiError(504, `Piston execution timed out after ${effectiveTimeoutMs / 1000} seconds.`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

export default PistonAdapter;
