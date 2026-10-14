/**
 * Base ExecutionProvider interface.
 * All external sandbox execution adapters must extend this class and implement execute().
 */
export class ExecutionProvider {
  constructor(name) {
    if (new.target === ExecutionProvider) {
      throw new TypeError('Cannot construct ExecutionProvider instances directly.');
    }
    this.name = name;
  }

  /**
   * Execute code in sandboxed environment.
   * @param {Object} params
   * @param {Object} params.languageConfig - Language configuration object from languageConfig.js
   * @param {string} params.code - Source code string
   * @param {string} params.fileName - File name (e.g. main.py)
   * @param {string} [params.stdin] - Standard input
   * @param {Array<{ name: string, content: string }>} [params.files] - Optional auxiliary files
   * @param {number} [params.timeoutMs] - Execution timeout in milliseconds
   * @returns {Promise<NormalizedExecutionResult>}
   */
  async execute(/* params */) {
    throw new Error(`execute() not implemented in ${this.name} adapter.`);
  }

  /**
   * Helper to normalize output into uniform format across providers.
   */
  formatNormalizedResult({
    stdout = '',
    stderr = '',
    compileOutput = null,
    exitCode = 0,
    timeSeconds = null,
    memoryKb = null,
    statusDescription = 'Accepted',
    isSuccess = true,
    language = '',
    fileName = '',
    raw = null
  }) {
    const cleanStdout = (stdout || '').toString();
    const cleanStderr = (stderr || '').toString();
    const cleanCompile = compileOutput ? compileOutput.toString() : null;

    return {
      success: isSuccess,
      provider: this.name,
      language,
      fileName,
      status: statusDescription,
      statusDetails: {
        description: statusDescription,
        isSuccess,
        isError: !isSuccess
      },
      stdout: cleanStdout,
      stderr: cleanStderr,
      compileOutput: cleanCompile,
      output: cleanCompile ? `${cleanCompile}\n${cleanStderr}\n${cleanStdout}`.trim() : (cleanStdout || cleanStderr),
      exitCode: exitCode ?? (isSuccess ? 0 : 1),
      executionTimeMs: timeSeconds !== null && !isNaN(timeSeconds) ? Math.round(Number(timeSeconds) * 1000) : null,
      memoryKb: memoryKb !== null && !isNaN(memoryKb) ? Number(memoryKb) : null,
      executedAt: new Date().toISOString(),
      raw
    };
  }
}

export default ExecutionProvider;
