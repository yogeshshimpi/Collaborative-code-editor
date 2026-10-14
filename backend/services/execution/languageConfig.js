/**
 * Unified Language Configuration for Sandboxed Code Execution.
 * Supports Judge0 and Piston execution parameters for all supported runtimes.
 */

export const LANGUAGE_CONFIG = {
  javascript: {
    id: 'javascript',
    displayName: 'JavaScript (Node.js)',
    extensions: ['.js', '.mjs', '.cjs'],
    defaultFileName: 'main.js',
    judge0: {
      languageId: 102, // Node.js 22.08.0
      fallbackIds: [97, 93, 63]
    },
    piston: {
      language: 'javascript',
      version: '18.15.0',
      aliases: ['node', 'js']
    },
    starterCode: `// JavaScript (Node.js)\nconsole.log("Hello from JavaScript in CodeCollab!");\n`
  },

  python: {
    id: 'python',
    displayName: 'Python 3',
    extensions: ['.py'],
    defaultFileName: 'main.py',
    judge0: {
      languageId: 100, // Python 3.12.5
      fallbackIds: [92, 71]
    },
    piston: {
      language: 'python',
      version: '3.10.0',
      aliases: ['py', 'python3']
    },
    starterCode: `# Python 3\ndef main():\n    print("Hello from Python in CodeCollab!")\n\nif __name__ == "__main__":\n    main()\n`
  },

  java: {
    id: 'java',
    displayName: 'Java (OpenJDK)',
    extensions: ['.java'],
    defaultFileName: 'Main.java',
    judge0: {
      languageId: 91, // Java JDK 17.0.6
      fallbackIds: [62]
    },
    piston: {
      language: 'java',
      version: '15.0.2',
      aliases: ['java']
    },
    starterCode: `// Java (Main.java)\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java in CodeCollab!");\n    }\n}\n`
  },

  cpp: {
    id: 'cpp',
    displayName: 'C++ (GCC)',
    extensions: ['.cpp', '.cc', '.cxx', '.hpp'],
    defaultFileName: 'main.cpp',
    judge0: {
      languageId: 105, // C++ GCC 14.1.0
      fallbackIds: [54, 53]
    },
    piston: {
      language: 'c++',
      version: '10.2.0',
      aliases: ['cpp', 'g++']
    },
    starterCode: `// C++ (GCC)\n#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++ in CodeCollab!" << std::endl;\n    return 0;\n}\n`
  },

  c: {
    id: 'c',
    displayName: 'C (GCC)',
    extensions: ['.c', '.h'],
    defaultFileName: 'main.c',
    judge0: {
      languageId: 103, // C GCC 14.1.0
      fallbackIds: [50, 49]
    },
    piston: {
      language: 'c',
      version: '10.2.0',
      aliases: ['c', 'gcc']
    },
    starterCode: `// C (GCC)\n#include <stdio.h>\n\nint main() {\n    printf("Hello from C in CodeCollab!\\n");\n    return 0;\n}\n`
  }
};

/**
 * Detect language identifier from filename or extension.
 */
export function detectLanguageFromFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') return null;
  const lower = fileName.trim().toLowerCase();

  for (const [langKey, config] of Object.entries(LANGUAGE_CONFIG)) {
    if (config.extensions.some((ext) => lower.endsWith(ext))) {
      return langKey;
    }
  }

  return null;
}

/**
 * Retrieve configuration for a language key or filename.
 */
export function getLanguageConfig(keyOrFileName) {
  if (!keyOrFileName || typeof keyOrFileName !== 'string') return null;
  const clean = keyOrFileName.trim().toLowerCase();

  if (LANGUAGE_CONFIG[clean]) {
    return LANGUAGE_CONFIG[clean];
  }

  const detected = detectLanguageFromFileName(clean);
  if (detected && LANGUAGE_CONFIG[detected]) {
    return LANGUAGE_CONFIG[detected];
  }

  return null;
}

/**
 * Returns formatted metadata list of supported languages for frontend display.
 */
export function getSupportedLanguagesList() {
  return Object.values(LANGUAGE_CONFIG).map((cfg) => ({
    id: cfg.id,
    displayName: cfg.displayName,
    extensions: cfg.extensions,
    defaultFileName: cfg.defaultFileName,
    starterCode: cfg.starterCode
  }));
}

export default {
  LANGUAGE_CONFIG,
  detectLanguageFromFileName,
  getLanguageConfig,
  getSupportedLanguagesList
};
