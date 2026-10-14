import ExecutionProvider from './ExecutionProvider.js';
import { ApiError } from '../../utils/apiError.js';
import { logger } from '../../utils/logger.js';

export class Judge0Adapter extends ExecutionProvider {
  constructor({ apiUrl = 'https://ce.judge0.com', apiKey = '', timeoutMs = 10000 } = {}) {
    super('judge0');
    this.apiUrl = (apiUrl || 'https://ce.judge0.com').replace(/\/+$/, '');
    this.apiKey = apiKey || '';
    this.timeoutMs = timeoutMs || 10000;
  }

  async execute({ languageConfig, code, fileName, stdin = '', timeoutMs }) {
    const judge0Config = languageConfig?.judge0;
    if (!judge0Config?.languageId) {
      throw new ApiError(400, `Language ${languageConfig?.displayName || 'unknown'} is not supported by Judge0 adapter.`);
    }

    const effectiveTimeoutMs = timeoutMs || this.timeoutMs;
    const isRapidApi = this.apiUrl.includes('rapidapi.com');

    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      if (isRapidApi) {
        headers['X-RapidAPI-Key'] = this.apiKey;
        headers['X-RapidAPI-Host'] = new URL(this.apiUrl).host;
      } else {
        headers['X-Auth-Token'] = this.apiKey;
      }
    }

    const payload = {
      language_id: judge0Config.languageId,
      source_code: code || '',
      stdin: stdin || '',
      cpu_time_limit: Math.max(1, Math.min(10, Math.round(effectiveTimeoutMs / 1000))),
      memory_limit: 128000 // 128MB
    };

    const endpoint = `${this.apiUrl}/submissions?wait=true`;
    logger.info(`[Judge0Adapter] Dispatching ${languageConfig.id} execution to ${endpoint}`);

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
        logger.error(`[Judge0Adapter] HTTP ${response.status}: ${errorText}`);
        throw new ApiError(
          response.status === 429 ? 429 : 502,
          response.status === 429
            ? 'Execution rate limit exceeded. Please wait a moment before running code again.'
            : `Code execution service error (${response.status}): ${errorText || response.statusText}`
        );
      }

      const data = await response.json();
      const statusDesc = data.status?.description || 'Unknown';
      const statusId = data.status?.id;

      // Status 3 is Accepted (Successful run).
      // Status 6 is Compilation Error. Status 5 is Time Limit Exceeded. Status 7-12 are Runtime Errors.
      const isSuccess = statusId === 3;

      return this.formatNormalizedResult({
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        compileOutput: data.compile_output || null,
        exitCode: data.exit_code !== undefined ? data.exit_code : (isSuccess ? 0 : 1),
        timeSeconds: data.time || null,
        memoryKb: data.memory || null,
        statusDescription: statusDesc,
        isSuccess,
        language: languageConfig.id,
        fileName,
        raw: data
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new ApiError(504, `Code execution timed out after ${effectiveTimeoutMs / 1000} seconds.`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

export default Judge0Adapter;
