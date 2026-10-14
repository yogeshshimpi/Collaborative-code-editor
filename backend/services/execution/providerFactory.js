import {
  CODE_EXECUTION_PROVIDER,
  JUDGE0_API_URL,
  JUDGE0_API_KEY,
  PISTON_API_URL,
  PISTON_API_KEY,
  CODE_EXECUTION_TIMEOUT_MS
} from '../../config/env.js';
import Judge0Adapter from './Judge0Adapter.js';
import PistonAdapter from './PistonAdapter.js';
import { logger } from '../../utils/logger.js';

let defaultProviderInstance = null;

export function getExecutionProvider(providerName = null) {
  const targetProvider = (providerName || CODE_EXECUTION_PROVIDER || 'judge0').toLowerCase();

  if (targetProvider === 'piston') {
    return new PistonAdapter({
      apiUrl: PISTON_API_URL,
      apiKey: PISTON_API_KEY,
      timeoutMs: CODE_EXECUTION_TIMEOUT_MS
    });
  }

  // Default to Judge0 (tested, reliable, zero-config for CE)
  if (!defaultProviderInstance || defaultProviderInstance.name !== 'judge0') {
    defaultProviderInstance = new Judge0Adapter({
      apiUrl: JUDGE0_API_URL,
      apiKey: JUDGE0_API_KEY,
      timeoutMs: CODE_EXECUTION_TIMEOUT_MS
    });
  }

  logger.info(`[providerFactory] Utilizing code execution provider: ${targetProvider}`);
  return defaultProviderInstance;
}

export default {
  getExecutionProvider
};
