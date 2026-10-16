export const INITIAL_FILES = {
  'main.js': {
    name: 'main.js',
    language: 'javascript',
    content: `// Welcome to CodeCollab - Collaborative Code Editor
function calculateProjectStats(project) {
  const { name, teamSize, status } = project;
  return {
    projectName: name,
    collaborators: teamSize,
    workspaceState: status,
    readyForSync: true,
    engine: 'Monaco Editor (VS Code core)',
    timestamp: new Date().toLocaleTimeString()
  };
}

const currentSession = calculateProjectStats({
  name: 'CodeCollab Project',
  teamSize: 1,
  status: 'active'
});
`
  },
  'index.html': {
    name: 'index.html',
    language: 'html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CodeCollab Preview</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="container">
    <div class="card">
      <span class="badge">Live Project</span>
      <h1>Welcome to CodeCollab</h1>
      <p>A real-time developer environment engineered for high-performance team collaboration.</p>
      <button id="cta-btn">Explore Documentation</button>
    </div>
  </main>
  <script src="main.js"></script>
</body>
</html>
`
  },
  'styles.css': {
    name: 'styles.css',
    language: 'css',
    content: `/* CodeCollab Modern Dark Theme Styles */
:root {
  --bg-primary: #090d16;
  --bg-card: #121a29;
  --accent: #6d5dfc;
  --text-main: #f2f6ff;
  --text-muted: #b4c2d9;
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--bg-primary);
  color: var(--text-main);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.card {
  background: var(--bg-card);
  padding: 2.5rem;
  border-radius: 12px;
  border: 1px solid #26344d;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  max-width: 480px;
  text-align: center;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
  background: rgba(109, 93, 252, 0.16);
  border-radius: 9999px;
  margin-bottom: 1rem;
}
`
  }
};

export const getLanguageFromFile = (fileName) => {
  if (!fileName || typeof fileName !== 'string') return 'plaintext';
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'javascript';
  if (lower.endsWith('.jsx')) return 'javascript';
  if (lower.endsWith('.ts')) return 'typescript';
  if (lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.sass') || lower.endsWith('.less')) return 'css';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.java')) return 'java';
  if (lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx') || lower.endsWith('.hpp')) return 'cpp';
  if (lower.endsWith('.c') || lower.endsWith('.h')) return 'c';
  if (lower.endsWith('.sql')) return 'sql';
  if (lower.endsWith('.xml') || lower.endsWith('.svg')) return 'xml';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
  if (lower.endsWith('.sh') || lower.endsWith('.bash')) return 'shell';
  return 'plaintext';
};

export const getDefaultFileContent = (fileName) => {
  if (!fileName || typeof fileName !== 'string') return '';
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.jsx')) {
    const componentName = fileName.split('/').pop().replace(/\.jsx$/, '') || 'Component';
    return `import React from 'react';\n\nexport default function ${componentName}() {\n  return (\n    <div>\n      <h2>${componentName}</h2>\n    </div>\n  );\n}\n`;
  }
  if (lower.endsWith('.tsx')) {
    const componentName = fileName.split('/').pop().replace(/\.tsx$/, '') || 'Component';
    return `import React from 'react';\n\ninterface Props {}\n\nexport default function ${componentName}(props: Props) {\n  return (\n    <div>\n      <h2>${componentName}</h2>\n    </div>\n  );\n}\n`;
  }
  if (lower.endsWith('.html')) {
    return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Document</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>\n`;
  }
  if (lower.endsWith('.css')) {
    return `/* Styles for ${fileName.split('/').pop()} */\n`;
  }
  if (lower.endsWith('.json')) {
    return `{\n  \n}\n`;
  }
  if (lower.endsWith('.py')) {
    return `def main():\n    print("Hello from Python in CodeCollab!")\n\nif __name__ == "__main__":\n    main()\n`;
  }
  if (lower.endsWith('.java')) {
    const className = fileName.split('/').pop().replace(/\.java$/, '') || 'Main';
    return `public class ${className} {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java in CodeCollab!");\n    }\n}\n`;
  }
  if (lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx')) {
    return `#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++ in CodeCollab!" << std::endl;\n    return 0;\n}\n`;
  }
  if (lower.endsWith('.c')) {
    return `#include <stdio.h>\n\nint main() {\n    printf("Hello from C in CodeCollab!\\n");\n    return 0;\n}\n`;
  }
  if (lower.endsWith('.sql')) {
    return `-- SQL Query\n`;
  }
  if (lower.endsWith('.md')) {
    const title = fileName.split('/').pop().replace(/\.md$/, '') || 'Documentation';
    return `# ${title}\n\nProject documentation.\n`;
  }
  if (lower.endsWith('.js') || lower.endsWith('.ts')) {
    return `// ${fileName.split('/').pop()}\nconsole.log("Hello from JavaScript in CodeCollab!");\n`;
  }
  return '';
};

