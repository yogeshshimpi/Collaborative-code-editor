/**
 * Starter file templates and configuration for all supported project types in CodeCollab.
 *
 * Supported types:
 * - html: HTML / CSS / JavaScript (with Live Preview)
 * - react: React + Vite application (component-based)
 * - javascript: JavaScript script / console runner
 * - python: Python script (safe workspace)
 * - java: Java application (safe workspace)
 * - cpp: C++ program (safe workspace)
 * - blank: Empty project workspace
 */

export const ALLOWED_PROJECT_TYPES = [
  'html',
  'react',
  'javascript',
  'python',
  'java',
  'cpp',
  'blank'
];

export const PROJECT_STARTER_TEMPLATES = {
  html: {
    id: 'html',
    name: 'HTML / CSS / JavaScript',
    folders: [],
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CodeCollab Live Preview</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="container">
    <div class="card">
      <span class="badge">Live Project</span>
      <h1>Welcome to CodeCollab</h1>
      <p>A real-time developer environment engineered for high-performance team collaboration.</p>
      <button id="cta-btn">Click Me</button>
      <p id="output" class="output-text"></p>
    </div>
  </main>
  <script src="main.js"></script>
</body>
</html>
`,
      'styles.css': `/* CodeCollab Modern Dark Theme Styles */
:root {
  --bg-primary: #0f1117;
  --bg-card: #161922;
  --accent: #6366f1;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
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
  border: 1px solid #282f44;
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
  background: rgba(99, 102, 241, 0.15);
  border-radius: 9999px;
  margin-bottom: 1rem;
}

button {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.65rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 1rem;
}

button:hover {
  background: #4f46e5;
}

.output-text {
  margin-top: 1rem;
  color: var(--accent);
  font-weight: 500;
}
`,
      'main.js': `// Welcome to CodeCollab - Professional Collaborative Code Editor
// Real-time Collaborative Session

function calculateProjectStats(project) {
  const { name, teamSize, status } = project;
  return {
    projectName: name,
    collaborators: teamSize,
    workspaceState: status,
    readyForSync: true,
    timestamp: new Date().toLocaleTimeString()
  };
}

const currentSession = calculateProjectStats({
  name: 'CodeCollab Project',
  teamSize: 2,
  status: 'active'
});

const btn = document.getElementById('cta-btn');
const output = document.getElementById('output');
if (btn && output) {
  let clicks = 0;
  btn.addEventListener('click', () => {
    clicks += 1;
    output.textContent = \`Button clicked \${clicks} time\${clicks === 1 ? '' : 's'}!\`;
  });
}
`
    }
  },

  react: {
    id: 'react',
    name: 'React + Vite',
    folders: ['src'],
    files: {
      'package.json': `{
  "name": "codecollab-react-project",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.2"
  }
}
`,
      'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React + Vite Project</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
      'src/main.jsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
      'src/App.jsx': `import React, { useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import './index.css';

function Navigation() {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <span className="brand-dot"></span>
        <span>CodeCollab React</span>
      </div>
      <div className="nav-links">
        <Link to="/" className={location.pathname === '/' ? 'nav-link active' : 'nav-link'}>
          Home
        </Link>
        <Link to="/about" className={location.pathname === '/about' ? 'nav-link active' : 'nav-link'}>
          About
        </Link>
        <Link to="/products" className={location.pathname === '/products' ? 'nav-link active' : 'nav-link'}>
          Products
        </Link>
        <Link to="/cart" className={location.pathname === '/cart' ? 'nav-link active' : 'nav-link'}>
          Cart
        </Link>
      </div>
    </nav>
  );
}

function Home() {
  const [count, setCount] = useState(0);

  return (
    <div className="card">
      <span className="badge">Home Page</span>
      <h1>Welcome to CodeCollab</h1>
      <p>A collaborative React application powered by Vite and React Router.</p>
      <div className="actions">
        <button className="counter-btn" onClick={() => setCount((c) => c + 1)}>
          Count is: {count}
        </button>
        <Link to="/products" className="secondary-link">
          Explore Products →
        </Link>
      </div>
    </div>
  );
}

function About() {
  const location = useLocation();

  return (
    <div className="card">
      <span className="badge">About Page</span>
      <h1>About This Project</h1>
      <p>
        Client-side React with <strong>HashRouter</strong> and <strong>useLocation</strong> in CodeCollab Live Preview.
      </p>
      <div className="route-info">
        <span>Current Route:</span>
        <code>#{location.pathname}</code>
      </div>
      <div className="actions">
        <Link to="/" className="primary-link">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}

function Products() {
  const location = useLocation();

  return (
    <div className="card">
      <span className="badge">Products Page</span>
      <h1>Products Collection</h1>
      <p>Discover our featured items and add them to your cart.</p>
      <div className="route-info">
        <span>Current Route:</span>
        <code>#{location.pathname}</code>
      </div>
      <div className="actions">
        <Link to="/cart" className="primary-link">
          View Cart →
        </Link>
        <Link to="/" className="secondary-link">
          ← Home
        </Link>
      </div>
    </div>
  );
}

function Cart() {
  const location = useLocation();

  return (
    <div className="card">
      <span className="badge">Cart Page</span>
      <h1>Shopping Cart</h1>
      <p>Your cart is ready for checkout with instant client-side routing.</p>
      <div className="route-info">
        <span>Current Route:</span>
        <code>#{location.pathname}</code>
      </div>
      <div className="actions">
        <Link to="/products" className="primary-link">
          ← Back to Products
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <div className="app-container">
        <Navigation />
        <main className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/products" element={<Products />} />
            <Route path="/cart" element={<Cart />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
`,
      'src/index.css': `:root {
  --bg-primary: #0f1117;
  --bg-card: #161922;
  --accent: #6366f1;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --border: #282f44;
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--bg-primary);
  color: var(--text-main);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background-color: var(--bg-card);
  border-bottom: 1px solid var(--border);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 15px;
  color: var(--text-main);
}

.brand-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--accent);
}

.nav-links {
  display: flex;
  gap: 10px;
}

.nav-link {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.nav-link:hover {
  color: var(--text-main);
  background-color: rgba(255, 255, 255, 0.05);
}

.nav-link.active {
  color: #ffffff;
  background-color: var(--accent);
}

.content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.card {
  background: var(--bg-card);
  padding: 2.5rem;
  border-radius: 14px;
  border: 1px solid var(--border);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  max-width: 480px;
  width: 100%;
  text-align: center;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
  background: rgba(99, 102, 241, 0.15);
  border-radius: 9999px;
  margin-bottom: 1rem;
}

h1 {
  font-size: 22px;
  margin: 0 0 10px 0;
  color: var(--text-main);
}

p {
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.5;
  margin: 0 0 20px 0;
}

.route-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border);
  padding: 8px 14px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 13px;
}

.route-info code {
  color: #818cf8;
  font-weight: 600;
}

.actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.counter-btn, .primary-link {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.65rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.2s;
}

.counter-btn:hover, .primary-link:hover {
  background: #4f46e5;
}

.secondary-link {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  padding: 0.65rem 1rem;
}

.secondary-link:hover {
  color: var(--text-main);
}
`
    }
  },

  javascript: {
    id: 'javascript',
    name: 'JavaScript',
    folders: [],
    files: {
      'main.js': `// JavaScript Project - CodeCollab
// Run mode: JavaScript console / output

function greet(name) {
  return "Hello, " + name + "! Welcome to CodeCollab.";
}

console.log(greet('Developer'));

const data = [10, 25, 40, 55, 70];
const doubled = data.map((n) => n * 2);
console.log('Original numbers:', data);
console.log('Doubled numbers:', doubled);

const total = data.reduce((sum, current) => sum + current, 0);
console.log('Sum total:', total);
`
    }
  },

  python: {
    id: 'python',
    name: 'Python',
    folders: [],
    files: {
      'main.py': `# Python Project - CodeCollab
# Safe workspace mode

def calculate_stats(numbers):
    total = sum(numbers)
    average = total / len(numbers) if numbers else 0
    return {
        "count": len(numbers),
        "total": total,
        "average": average
    }

def main():
    print("Welcome to CodeCollab Python Workspace!")
    sample_data = [12, 45, 68, 23, 89, 34]
    stats = calculate_stats(sample_data)
    print(f"Data numbers: {sample_data}")
    print(f"Data summary: {stats}")

if __name__ == "__main__":
    main()
`
    }
  },

  java: {
    id: 'java',
    name: 'Java',
    folders: [],
    files: {
      'Main.java': `// Java Project - CodeCollab
// Safe workspace mode

public class Main {
    public static void main(String[] args) {
        System.out.println("Welcome to CodeCollab Java Workspace!");

        int[] numbers = {10, 20, 30, 40, 50};
        int sum = 0;
        for (int num : numbers) {
            sum += num;
        }

        System.out.println("Total sum of numbers: " + sum);
    }
}
`
    }
  },

  cpp: {
    id: 'cpp',
    name: 'C++',
    folders: [],
    files: {
      'main.cpp': `// C++ Project - CodeCollab
// Safe workspace mode

#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::cout << "Welcome to CodeCollab C++ Workspace!" << std::endl;

    std::vector<int> numbers = {10, 20, 30, 40, 50};
    int total = std::accumulate(numbers.begin(), numbers.end(), 0);

    std::cout << "Total sum: " << total << std::endl;
    return 0;
}
`
    }
  },

  blank: {
    id: 'blank',
    name: 'Blank Project',
    folders: [],
    files: {}
  }
};
