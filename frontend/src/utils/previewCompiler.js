import * as Babel from '@babel/standalone';

/**
 * Formats a hash route for display in the preview route field (e.g. '#/products' -> '/#/products', '#/' -> '/#/').
 */
export function formatRouteForDisplay(hash) {
  if (!hash || typeof hash !== 'string') return '/#/';
  const trimmed = hash.trim();
  if (!trimmed || trimmed === '#' || trimmed === '#/' || trimmed === '/' || trimmed === '/#/') {
    return '/#/';
  }
  if (trimmed.startsWith('/#/')) return trimmed;
  if (trimmed.startsWith('#/')) return '/' + trimmed;
  if (trimmed.startsWith('#')) return '/#/' + trimmed.slice(1).replace(/^\/+/, '');
  if (trimmed.startsWith('/')) return '/#' + trimmed;
  return '/#/' + trimmed;
}

/**
 * CodeCollab parent routes that should not be navigated to or loaded as routes in the preview sandbox.
 */
const CODECOLLAB_PARENT_ROUTES = [
  '/login',
  '/signup',
  '/projects',
  '/settings',
  '/preview'
];

/**
 * Checks whether a given pathname or route matches or starts with a CodeCollab parent route.
 */
export function isParentRoute(path) {
  if (!path || typeof path !== 'string') return false;
  let clean = path.trim().toLowerCase();
  // Strip leading hash or /# if present
  if (clean.startsWith('/#/')) clean = clean.slice(2);
  else if (clean.startsWith('#/')) clean = clean.slice(1);
  else if (clean.startsWith('#')) clean = clean.slice(1);
  if (!clean.startsWith('/')) clean = '/' + clean;

  if (clean === '/' || clean === '') return false;

  return CODECOLLAB_PARENT_ROUTES.some((parent) => {
    return clean === parent || clean.startsWith(parent + '/');
  });
}

/**
 * Validates a route input string for the preview sandbox.
 * Blocks:
 * - external URLs (http://, https:// pointing outside current origin, or protocol-relative //)
 * - dangerous protocols: javascript:, data:, vbscript:, file:, blob:
 * - CodeCollab parent routes (/login, /signup, /projects, /settings, /preview without hash)
 *
 * Returns: { isValid: boolean, hash: string, error?: string }
 */
export function validatePreviewRoute(input) {
  if (input === null || input === undefined) {
    return { isValid: true, hash: '#/' };
  }
  let str = String(input).trim();
  if (!str || str === '/' || str === '#' || str === '#/' || str === '/#/') {
    return { isValid: true, hash: '#/' };
  }

  // 1. Remove non-printable control characters & normalize for check
  const sanitized = str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

  // 2. Block dangerous pseudo-protocols: javascript:, data:, vbscript:, file:, blob:
  if (/^\s*(javascript|data|vbscript|file|blob)\s*:/i.test(sanitized)) {
    return { isValid: false, hash: '#/', error: 'Blocked unsafe protocol' };
  }
  if (/javascript\s*:/i.test(sanitized) || /data\s*:\s*text\/html/i.test(sanitized)) {
    return { isValid: false, hash: '#/', error: 'Blocked unsafe script or data URL' };
  }

  // 3. Block protocol-relative URLs (e.g. //evil.com)
  if (/^\s*\/\//.test(sanitized)) {
    return { isValid: false, hash: '#/', error: 'Blocked external protocol-relative URL' };
  }

  // 4. Handle full HTTP/HTTPS URLs
  if (/^https?:\/\//i.test(sanitized)) {
    try {
      const url = new URL(sanitized);
      const currentOrigin =
        typeof window !== 'undefined' && window.location ? window.location.origin : null;

      // Check if URL points to an external host
      if (currentOrigin && url.origin !== currentOrigin) {
        return { isValid: false, hash: '#/', error: 'Blocked external URL' };
      }

      // If it's a same-origin URL:
      // If it has a hash (e.g. /preview/123#/products), extract and validate the hash
      if (url.hash) {
        return validatePreviewRoute(url.hash);
      }

      // If it has no hash, check if pathname is a parent route
      const pathname = url.pathname.toLowerCase();
      if (isParentRoute(pathname)) {
        return { isValid: false, hash: '#/', error: 'Blocked CodeCollab parent route' };
      }

      // If it's a standalone preview URL without hash: /preview/<id>
      if (pathname.startsWith('/preview/')) {
        return { isValid: true, hash: '#/' };
      }

      return { isValid: false, hash: '#/', error: 'Blocked navigation to parent route' };
    } catch {
      return { isValid: false, hash: '#/', error: 'Invalid URL format' };
    }
  }

  // 5. Check if the input is a CodeCollab parent route (e.g. /login, /projects, /settings, /preview/123)
  if (isParentRoute(sanitized)) {
    return { isValid: false, hash: '#/', error: 'Blocked CodeCollab parent route' };
  }

  // 6. Safe route: Parse to standardized hash
  const hash = parseRouteToHash(sanitized);
  return { isValid: true, hash };
}

/**
 * Parses user input from the route field into a valid location hash (e.g. '/#/products' -> '#/products', '/#/' -> '#/').
 */
export function parseRouteToHash(input) {
  if (!input || typeof input !== 'string') return '#/';
  let str = input.trim();
  if (!str || str === '/' || str === '#' || str === '#/' || str === '/#/') {
    return '#/';
  }

  // Guard against dangerous protocols and protocol-relative URLs
  const sanitized = str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  if (/^\s*(javascript|data|vbscript|file|blob)\s*:/i.test(sanitized) || /^\s*\/\//.test(sanitized)) {
    return '#/';
  }

  try {
    if (str.startsWith('http://') || str.startsWith('https://')) {
      const parsed = new URL(str);
      const currentOrigin = typeof window !== 'undefined' && window.location ? window.location.origin : null;
      if (currentOrigin && parsed.origin !== currentOrigin) {
        return '#/';
      }
      str = parsed.hash || '#/';
    }
  } catch {
    return '#/';
  }

  if (isParentRoute(str)) {
    return '#/';
  }

  if (str.startsWith('/#/')) {
    return '#' + str.slice(2);
  }
  if (str.startsWith('#/')) {
    return str;
  }
  if (str.startsWith('#')) {
    return '#/' + str.slice(1).replace(/^\/+/, '');
  }
  if (str.startsWith('/')) {
    return '#' + str;
  }
  return '#/' + str;
}

/**
 * Normalizes user-entered URL or route path to a standardized hash route (e.g. '#/about').
 */
export function normalizeRouteHash(raw) {
  return parseRouteToHash(raw);
}

/**
 * Check if the workspace contains React files or dependencies.
 */
export function isReactWorkspace(files) {
  if (!files || typeof files !== 'object') return false;
  const keys = Object.keys(files);
  return keys.some((k) => {
    const cleanKey = k.replace(/^\.\//, '').replace(/^\//, '');
    const lowerKey = cleanKey.toLowerCase();
    if (lowerKey.endsWith('.jsx') || lowerKey.endsWith('.tsx')) return true;
    if (cleanKey.includes('App.') || cleanKey.includes('main.jsx') || cleanKey.includes('main.tsx')) return true;

    const file = files[k];
    const content = typeof file === 'string' ? file : file?.content;
    if (typeof content !== 'string') return false;

    if (cleanKey === 'package.json') {
      return content.includes('"react"') || content.includes("'react'");
    }

    if (lowerKey.endsWith('.html') || lowerKey.endsWith('.htm')) {
      return (
        content.includes('main.jsx') ||
        content.includes('main.tsx') ||
        content.includes('App.jsx') ||
        content.includes('App.tsx') ||
        content.includes('react') ||
        content.includes('id="root"')
      );
    }

    if (lowerKey.endsWith('.js') || lowerKey.endsWith('.mjs')) {
      return (
        content.includes("from 'react'") ||
        content.includes('from "react"') ||
        content.includes("require('react')") ||
        content.includes('require("react")')
      );
    }

    return false;
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Safely parses package.json and extracts declared dependencies and devDependencies.
 */
export function parsePackageDependencies(files) {
  const declaredDependencies = new Set();
  const pkgFile = files['package.json'] || files['/package.json'];
  const pkgJsonRaw = pkgFile?.content;
  let parsed = null;
  let parseError = null;

  if (typeof pkgJsonRaw === 'string' && pkgJsonRaw.trim()) {
    try {
      // Clean comments and trailing commas for robust JSON parsing
      const cleaned = pkgJsonRaw
        .replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '$1')
        .replace(/,\s*([\]}])/g, '$1');
      parsed = JSON.parse(cleaned);
      const deps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
      Object.keys(deps).forEach((pkg) => {
        const trimmed = pkg.trim();
        if (trimmed && !trimmed.startsWith('@types/')) {
          declaredDependencies.add(trimmed);
        }
      });
    } catch (err) {
      parseError = err.message;
    }

    // Resilient fallback: parse package names even if package.json has a syntax issue
    try {
      const depBlockRegex = /"(?:dependencies|devDependencies)"\s*:\s*\{([^}]+)\}/g;
      let match;
      while ((match = depBlockRegex.exec(pkgJsonRaw)) !== null) {
        const block = match[1];
        const entryRegex = /"([^"]+)"\s*:\s*"[^"]*"/g;
        let entryMatch;
        while ((entryMatch = entryRegex.exec(block)) !== null) {
          const pkgName = (entryMatch[1] || '').trim();
          if (pkgName && !pkgName.startsWith('@types/')) {
            declaredDependencies.add(pkgName);
          }
        }
      }
    } catch {}
  }

  return { declaredDependencies, parsed, parseError, hasPkgJson: Boolean(pkgFile) };
}

/**
 * Checks whether an npm package is a Node-only build/lint tool that cannot run in a browser sandbox.
 */
export function isNodeOnlyPackage(pkg) {
  if (!pkg || typeof pkg !== 'string') return true;
  const lower = pkg.trim().toLowerCase();
  return (
    lower === 'react' ||
    lower === 'react-dom' ||
    lower === 'vite' ||
    lower.startsWith('@vitejs/') ||
    lower.startsWith('@types/') ||
    lower === 'typescript' ||
    lower === 'eslint' ||
    lower.startsWith('eslint-') ||
    lower.startsWith('@eslint/') ||
    lower === 'globals' ||
    lower === 'prettier' ||
    lower.startsWith('prettier-') ||
    lower.startsWith('@babel/') ||
    lower === 'postcss' ||
    lower === 'autoprefixer' ||
    lower === 'tailwindcss' ||
    lower === 'rollup' ||
    lower.startsWith('rollup-') ||
    lower === 'webpack' ||
    lower.startsWith('webpack-')
  );
}

/**
 * Scans all JavaScript/TypeScript/JSX files for external package imports.
 */
export function detectImportedPackages(files) {
  if (!files || typeof files !== 'object') return [];
  const importedPkgs = new Set();
  const importRegex = /(?:import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

  // Normalized list of project file paths (replacing backslashes with slashes, removing leading ./ and /)
  const normalizedPaths = Object.keys(files).map((f) =>
    f.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '')
  );

  for (const [path, fileObj] of Object.entries(files)) {
    if (!fileObj || typeof fileObj.content !== 'string') continue;
    const lower = path.toLowerCase();
    if (!lower.endsWith('.jsx') && !lower.endsWith('.tsx') && !lower.endsWith('.js') && !lower.endsWith('.mjs')) continue;

    let match;
    while ((match = importRegex.exec(fileObj.content)) !== null) {
      const rawSpec = match[1] || match[2];
      if (!rawSpec) continue;
      const spec = rawSpec.trim();
      if (!spec) continue;

      // Skip relative paths, absolute paths, protocols, and data URIs
      if (
        spec.startsWith('.') ||
        spec.startsWith('/') ||
        spec.startsWith('http:') ||
        spec.startsWith('https:') ||
        spec.startsWith('data:')
      ) continue;

      // Skip common project path aliases: @/..., ~/..., #/...
      if (spec.startsWith('@/') || spec.startsWith('~/') || spec.startsWith('#/')) continue;

      // Skip built-in react runtime modules
      if (
        spec === 'react' ||
        spec === 'react-dom' ||
        spec === 'react-dom/client' ||
        spec === 'react/jsx-runtime' ||
        spec === 'react/jsx-dev-runtime'
      ) continue;

      // Check if spec points to a CSS file that is local
      if (spec.endsWith('.css') && normalizedPaths.some((f) => f === spec || f === `src/${spec}`)) {
        continue;
      }

      // Extract the root package name (handling scoped packages like @supabase/supabase-js or subpaths like lodash/debounce)
      let rootPkg = spec;
      if (spec.startsWith('@')) {
        const parts = spec.split('/');
        rootPkg = parts.length > 1 ? `${parts[0]}/${parts[1]}` : spec;
      } else {
        rootPkg = spec.split('/')[0];
      }

      // Check if rootPkg or spec matches an existing project file or directory (e.g. "components", "pages", "src", "utils", etc.)
      const isLocal = normalizedPaths.some((cleanF) => {
        return (
          cleanF === spec ||
          cleanF === rootPkg ||
          cleanF.startsWith(`${spec}/`) ||
          cleanF.startsWith(`${rootPkg}/`) ||
          cleanF.startsWith(`src/${spec}/`) ||
          cleanF.startsWith(`src/${rootPkg}/`) ||
          cleanF.replace(/\.(jsx?|tsx?)$/, '') === spec ||
          cleanF.replace(/\.(jsx?|tsx?)$/, '') === rootPkg ||
          cleanF.replace(/\.(jsx?|tsx?)$/, '') === `src/${spec}` ||
          cleanF.replace(/\.(jsx?|tsx?)$/, '') === `src/${rootPkg}`
        );
      });
      if (isLocal) continue;

      // Also skip known build-only packages
      if (isNodeOnlyPackage(rootPkg)) continue;

      importedPkgs.add(rootPkg);
    }
  }

  return Array.from(importedPkgs);
}

/**
 * Detect all external npm packages imported in the project files or listed in package.json.
 */
export function detectExternalPackages(files) {
  if (!files || typeof files !== 'object') return [];
  const { declaredDependencies } = parsePackageDependencies(files);
  const importedPackages = detectImportedPackages(files);
  const allPackages = new Set();

  declaredDependencies.forEach((pkg) => {
    if (!isNodeOnlyPackage(pkg)) {
      allPackages.add(pkg);
    }
  });
  importedPackages.forEach((pkg) => {
    if (!isNodeOnlyPackage(pkg)) {
      allPackages.add(pkg);
    }
  });

  return Array.from(allPackages);
}

/**
 * Generates an informative preview error document when a required dependency is missing from package.json.
 */
function renderMissingDependencyDocument(missingPkg, telemetryScript) {
  const errorMsg = `Missing preview dependency: ${missingPkg}. Add it to package.json.`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dependency Required - CodeCollab Preview</title>
  ${telemetryScript}
  <script>
    if (typeof postMsg === 'function') {
      postMsg('error', [${JSON.stringify(errorMsg)}]);
    }
  </script>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #131a29;
      --danger: #ef4444;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --border: #243048;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background-color: var(--bg);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .missing-dep-card {
      background-color: var(--card-bg);
      border: 1px solid rgba(239, 68, 68, 0.4);
      border-radius: 14px;
      padding: 32px 28px;
      max-width: 540px;
      width: 100%;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
      animation: fadeIn 0.25s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .header-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }
    .badge-icon {
      font-size: 24px;
      line-height: 1;
    }
    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #fca5a5;
    }
    p {
      color: var(--text-muted);
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 18px 0;
    }
    p strong {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }
    .instructions-box {
      background: #060910;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .instructions-title {
      font-size: 12px;
      color: #818cf8;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    pre {
      margin: 0;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 13px;
      color: #a5b4fc;
      line-height: 1.5;
    }
    .tip-text {
      font-size: 12px;
      color: #64748b;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="missing-dep-card">
    <div class="header-row">
      <span class="badge-icon">⚠️</span>
      <h2>Missing Preview Dependency</h2>
    </div>
    <p>
      Missing preview dependency: <strong>${missingPkg}</strong>. Add it to <code>package.json</code>.
    </p>
    <div class="instructions-box">
      <div class="instructions-title">Add to package.json:</div>
      <pre>{\n  "dependencies": {\n    "${missingPkg}": "^6.26.2"\n  }\n}</pre>
    </div>
    <p class="tip-text">
      💡 Once added to <code>package.json</code>, CodeCollab will automatically resolve and execute it client-side without any manual npm install.
    </p>
  </div>
</body>
</html>`;
}

/**
 * Builds an isolated HTML bundle by safely inlining CSS and JS from project files.
 * Replaces <link rel="stylesheet"> and <script src="..."> tags with inlined contents,
 * injects any unlinked project CSS/JS, and attaches safe console telemetry.
 * Automatically supports React + JSX client-side sandboxing when React files are present.
 */
export function buildPreviewDocument(files, selectedHtmlFile, _renderNonce, initialHash = '') {
  if (!files || typeof files !== 'object') {
    return '<html><body><p>No project files found.</p></body></html>';
  }

  // Safe telemetry & error handler script
  const telemetryScript = `
<script data-codecollab-sandbox-telemetry="true">
(function() {
  // Polyfill window.URL in about:srcdoc sandboxes so client routers do not fail
  if (typeof window !== 'undefined' && window.URL) {
    try {
      var OrigURL = window.URL;
      var SAFE_BASE = 'http://localhost';
      function SafeURL(url, base) {
        var safeBase = base;
        if (typeof safeBase === 'string') {
          var trimmedBase = safeBase.trim().toLowerCase();
          if (
            trimmedBase.startsWith('about:') ||
            trimmedBase === 'null' ||
            trimmedBase === ''
          ) {
            safeBase = SAFE_BASE;
          }
        } else if (!safeBase && typeof url === 'string' && (url.startsWith('/') || url.startsWith('#'))) {
          safeBase = SAFE_BASE;
        }

        try {
          if (safeBase !== undefined) {
            return new OrigURL(url, safeBase);
          }
          return new OrigURL(url);
        } catch (e) {
          try {
            return new OrigURL(url, SAFE_BASE);
          } catch (e2) {
            try {
              return new OrigURL('/' + url, SAFE_BASE);
            } catch (e3) {
              throw e;
            }
          }
        }
      }
      SafeURL.prototype = OrigURL.prototype;
      SafeURL.createObjectURL = function() { return OrigURL.createObjectURL.apply(OrigURL, arguments); };
      SafeURL.revokeObjectURL = function() { return OrigURL.revokeObjectURL.apply(OrigURL, arguments); };
      if (OrigURL.canParse) {
        SafeURL.canParse = function(url, base) {
          try {
            new SafeURL(url, base);
            return true;
          } catch(e) {
            return false;
          }
        };
      }
      window.URL = SafeURL;
    } catch(e) {}
  }

  // Restore initial requested route hash if specified
  var requestedHash = ${JSON.stringify(initialHash || '')};
  if (requestedHash && typeof window !== 'undefined') {
    try {
      if (window.location.hash !== requestedHash) {
        window.location.hash = requestedHash;
      }
    } catch(e) {}
  }

  function serialize(arg) {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
    if (arg instanceof Error) return arg.name + ': ' + arg.message + (arg.stack ? '\\n' + arg.stack : '');
    try {
      return JSON.stringify(arg, null, 2);
    } catch(e) {
      return String(arg);
    }
  }

  function postMsg(type, args, meta) {
    try {
      var msgs = Array.prototype.slice.call(args).map(serialize);
      window.parent.postMessage({
        source: 'codecollab-preview',
        type: type,
        messages: msgs,
        meta: meta || {},
        timestamp: Date.now()
      }, '*');
    } catch(e) {}
  }

  // Broadcast hash change events to parent window
  function notifyHash() {
    try {
      var currentHash = window.location.hash || '#/';
      window.parent.postMessage({
        source: 'codecollab-preview',
        type: 'preview-hash-change',
        hash: currentHash
      }, '*');
    } catch(e) {}
  }

  // Helper to extract and safely update location hash from a URL or route path
  function safeUpdateHashFromUrl(url) {
    if (!url || typeof url !== 'string') return;
    var targetHash = '';
    if (url.indexOf('#') !== -1) {
      targetHash = url.slice(url.indexOf('#'));
    } else if (url.startsWith('/')) {
      targetHash = '#' + url;
    } else if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
      targetHash = '#/' + url;
    }
    if (targetHash && !/^\\s*(javascript|data|vbscript|file):/i.test(targetHash)) {
      try {
        if (window.location.hash !== targetHash) {
          window.location.hash = targetHash;
        }
      } catch(e) {}
    }
  }

  // Intercept history.pushState and history.replaceState so HashRouter navigations notify parent immediately
  // and NEVER throw SecurityError in about:srcdoc (origin 'null') which triggers location.assign fallback
  try {
    var _origPushState = window.history.pushState;
    window.history.pushState = function(state, title, url) {
      var result;
      try {
        if (_origPushState) {
          result = _origPushState.apply(this, arguments);
        }
      } catch(e) {
        // Native pushState throws DOMException in sandboxed about:srcdoc with null origin.
        // Catch it and update hash directly so React Router never triggers location.assign fallback.
        safeUpdateHashFromUrl(url);
      }
      setTimeout(notifyHash, 0);
      return result;
    };

    var _origReplaceState = window.history.replaceState;
    window.history.replaceState = function(state, title, url) {
      var result;
      try {
        if (_origReplaceState) {
          result = _origReplaceState.apply(this, arguments);
        }
      } catch(e) {
        safeUpdateHashFromUrl(url);
      }
      setTimeout(notifyHash, 0);
      return result;
    };
  } catch(e) {}

  // Intercept link clicks inside sandbox to ensure hash updates and prevent document navigation away from about:srcdoc
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el !== document.body && el.tagName !== 'A') {
      el = el.parentElement;
    }
    if (!el || el.tagName !== 'A') return;

    var href = el.getAttribute('href');
    if (!href) return;

    // Do not interfere with external links (http://, https://, //)
    if (/^https?:\\/\\//i.test(href) || /^\\/\\//.test(href)) {
      return;
    }

    // Ignore dangerous pseudo-protocols
    if (/^\\s*(javascript|data|vbscript):/i.test(href)) {
      e.preventDefault();
      return;
    }

    if (href.startsWith('#')) {
      // Standard hash link (e.g. '#/products' or '#/about')
      try {
        if (window.location.hash !== href) {
          window.location.hash = href;
        }
      } catch(err) {}
      setTimeout(notifyHash, 0);
    } else {
      var rawPath = href.split('#')[0];
      var linkHash = href.indexOf('#') !== -1 ? href.slice(href.indexOf('#')) : '';
      var cleanTarget = rawPath;
      while (cleanTarget.startsWith('./') || cleanTarget.startsWith('/') || cleanTarget.startsWith('.')) {
        if (cleanTarget.startsWith('./')) cleanTarget = cleanTarget.slice(2);
        else cleanTarget = cleanTarget.slice(1);
      }
      if (cleanTarget.toLowerCase().endsWith('.html') || cleanTarget.toLowerCase().endsWith('.htm')) {
        e.preventDefault();
        e.stopPropagation();
        window.parent.postMessage({
          source: 'codecollab-preview',
          type: 'preview-page-navigate',
          page: cleanTarget,
          hash: linkHash
        }, '*');
        return;
      }

      // Relative path link (e.g. '/products' or 'about')
      e.preventDefault();
      e.stopPropagation();
      var safeHash = href.startsWith('/') ? '#' + href : '#/' + href;
      try {
        if (window.location.hash !== safeHash) {
          window.location.hash = safeHash;
        }
      } catch(err) {}
      setTimeout(notifyHash, 0);
    }
  }, true);

  window.addEventListener('hashchange', notifyHash);
  window.addEventListener('popstate', notifyHash);
  window.addEventListener('DOMContentLoaded', notifyHash);
  setTimeout(notifyHash, 50);
  setTimeout(notifyHash, 250);

  // Listen to hash change commands from parent (for browser Back/Forward or manual navigation)
  window.addEventListener('message', function(event) {
    if (event.data && event.data.source === 'codecollab-parent' && event.data.type === 'parent-hash-change') {
      var targetHash = event.data.hash || '#/';
      if (typeof targetHash === 'string' && !/^\\s*(javascript|data|vbscript|file):/i.test(targetHash)) {
        if (window.location.hash !== targetHash) {
          window.location.hash = targetHash;
        }
      }
    }
  });

  var _log = console.log, _info = console.info, _warn = console.warn, _error = console.error;
  function shouldFilterWarn(args) {
    try {
      var first = args && args[0];
      if (typeof first === 'string' && first.indexOf('React Router Future Flag Warning') !== -1) {
        return true;
      }
    } catch(e) {}
    return false;
  }
  console.log = function() { _log && _log.apply(console, arguments); postMsg('log', arguments); };
  console.info = function() { _info && _info.apply(console, arguments); postMsg('info', arguments); };
  console.warn = function() {
    if (!shouldFilterWarn(arguments)) {
      _warn && _warn.apply(console, arguments);
      postMsg('warn', arguments);
    }
  };
  console.error = function() { _error && _error.apply(console, arguments); postMsg('error', arguments); };

  window.onerror = function(msg, url, line, col, err) {
    var errorStr = (err && err.message) ? err.message : String(msg);
    postMsg('runtime-error', [errorStr], { line: line, col: col });
    return false;
  };

  window.addEventListener('unhandledrejection', function(event) {
    var reason = event.reason;
    var msg = (reason && reason.message) ? reason.message : String(reason);
    postMsg('runtime-error', ['Unhandled Promise Rejection: ' + msg]);
  });

  window.addEventListener('DOMContentLoaded', function() {
    postMsg('system', ['Preview DOM content ready']);
  });
})();
</script>
`;



  // =========================================================================
  // 1. REACT SANDBOX COMPILER (When JSX / React files exist)
  // =========================================================================
  if (isReactWorkspace(files)) {
    try {
      // Find HTML shell
      const indexFile =
        files['index.html'] ||
        files['/index.html'] ||
        files['./index.html'] ||
        (selectedHtmlFile && files[selectedHtmlFile]);
      let htmlContent = indexFile?.content || `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>React App</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

      // Remove any existing script tags pointing to local files (like /src/main.jsx), self-closing scripts, or Vite dev preambles
      htmlContent = htmlContent.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>|<script\b([^>]*)\/>/gi, (match, attrs1, inner, attrs2) => {
        const attrs = attrs1 || attrs2 || '';
        const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
        if (srcMatch) {
          const src = srcMatch[1];
          // Preserve external CDN scripts (e.g. https://... or http://...)
          if (/^https?:\/\//i.test(src) || /^\/\//.test(src)) {
            return match;
          }
          // Strip local/relative script tags (e.g. /src/main.jsx, ./main.js, etc.)
          return `<!-- [CodeCollab] Transpiled in-memory: ${src} -->`;
        }
        // For inline scripts, strip Vite dev server refresh preambles or local module imports
        if (inner && (inner.includes('@react-refresh') || inner.includes('@vite') || inner.includes('main.jsx') || inner.includes('App.jsx'))) {
          return '<!-- [CodeCollab] Stripped dev preamble -->';
        }
        return match;
      });

      // Ensure root div exists
      if (!htmlContent.includes('id="root"')) {
        if (/<\/body>/i.test(htmlContent)) {
          htmlContent = htmlContent.replace(/<\/body>/i, '<div id="root"></div>\n</body>');
        } else {
          htmlContent += '\n<div id="root"></div>';
        }
      }

      // Collect and inline all CSS files
      let combinedCss = '';
      Object.entries(files).forEach(([path, fileObj]) => {
        if (!fileObj || typeof fileObj.content !== 'string') return;
        if (path.toLowerCase().endsWith('.css') || fileObj.language === 'css') {
          combinedCss += `\n/* ${path} */\n${fileObj.content}\n`;
        }
      });

      // 1. Safely parse package.json and extract declared dependencies
      const { declaredDependencies } = parsePackageDependencies(files);
      const importedExternalPackages = detectImportedPackages(files);

      // Check if project uses routing
      const usesRouter =
        importedExternalPackages.includes('react-router-dom') ||
        importedExternalPackages.includes('react-router') ||
        Object.values(files).some((file) => {
          if (!file || typeof file.content !== 'string') return false;
          const c = file.content;
          return (
            c.includes('react-router-dom') ||
            c.includes('react-router') ||
            c.includes('HashRouter') ||
            c.includes('BrowserRouter') ||
            c.includes('<Routes') ||
            c.includes('<Route') ||
            c.includes('useNavigate') ||
            c.includes('useLocation')
          );
        });

      // Requirement 10: If react-router-dom is missing from package.json, show a helpful preview error instead of crashing
      if (usesRouter && !declaredDependencies.has('react-router-dom') && !declaredDependencies.has('react-router')) {
        return renderMissingDependencyDocument('react-router-dom', telemetryScript);
      }

      // 2. Validate dependencies: if an external package is imported but NOT declared in package.json
      const missingDependencies = importedExternalPackages.filter(
        (pkg) => !isNodeOnlyPackage(pkg) && !declaredDependencies.has(pkg) && !declaredDependencies.has(pkg.split('/')[0])
      );

      if (missingDependencies.length > 0) {
        return renderMissingDependencyDocument(missingDependencies[0], telemetryScript);
      }

      // Collect all packages to load (filtered of node-only / build packages)
      const detectedPkgs = detectExternalPackages(files);

      // Transpile all JSX and JS files into CommonJS modules using Babel
      const compiledModules = {};
      for (const [path, fileObj] of Object.entries(files)) {
        if (!fileObj || typeof fileObj.content !== 'string') continue;
        const lower = path.toLowerCase();
        if (!lower.endsWith('.jsx') && !lower.endsWith('.tsx') && !lower.endsWith('.js') && !lower.endsWith('.mjs')) {
          continue;
        }

        const transformed = Babel.transform(fileObj.content, {
          presets: ['react'],
          plugins: ['transform-modules-commonjs'],
          filename: path
        });

        const code = transformed.code;
        const normalizedPath = path.replace(/\\/g, '/');
        compiledModules[path] = code;
        compiledModules[normalizedPath] = code;

        const clean = normalizedPath.replace(/^\.\//, '').replace(/^\//, '');
        compiledModules[clean] = code;
        compiledModules[`./${clean}`] = code;
        compiledModules[`/${clean}`] = code;

        // If file is inside src/ (e.g. src/components/Sidebar.jsx), also register without src/ and with @/ alias
        if (clean.startsWith('src/')) {
          const stripped = clean.slice(4);
          compiledModules[stripped] = code;
          compiledModules[`./${stripped}`] = code;
          compiledModules[`/${stripped}`] = code;
          compiledModules[stripped.replace(/\.(jsx?|tsx?)$/, '')] = code;
          compiledModules[`./${stripped.replace(/\.(jsx?|tsx?)$/, '')}`] = code;

          const atAlias = `@/${stripped}`;
          compiledModules[atAlias] = code;
          compiledModules[atAlias.replace(/\.(jsx?|tsx?)$/, '')] = code;
        }

        // Directory index resolution (e.g. pages/index.jsx -> pages, src/pages/index.jsx -> pages, @/pages)
        if (clean.endsWith('/index.jsx') || clean.endsWith('/index.js') || clean.endsWith('/index.tsx') || clean.endsWith('/index.ts')) {
          const dir = clean.replace(/\/index\.(jsx?|tsx?)$/, '');
          compiledModules[dir] = code;
          compiledModules[`./${dir}`] = code;
          compiledModules[`/${dir}`] = code;
          if (dir.startsWith('src/')) {
            const strippedDir = dir.slice(4);
            compiledModules[strippedDir] = code;
            compiledModules[`./${strippedDir}`] = code;
            compiledModules[`/${strippedDir}`] = code;
            compiledModules[`@/${strippedDir}`] = code;
          }
        }

        const baseName = clean.split('/').pop();
        compiledModules[baseName] = code;
        compiledModules[`./${baseName}`] = code;
        compiledModules[baseName.replace(/\.(jsx?|tsx?)$/, '')] = code;
        compiledModules[`./${baseName.replace(/\.(jsx?|tsx?)$/, '')}`] = code;
      }

      // Virtual CommonJS + ESM bundle runner with dynamic package resolution
      const reactBundleScript = `
<script type="module" data-codecollab-react-bundle="true">
import * as React from 'https://esm.sh/react@18.3.1';
import * as ReactDOMClient from 'https://esm.sh/react-dom@18.3.1/client';
import * as JsxRuntime from 'https://esm.sh/react@18.3.1/jsx-runtime';

window.React = React.default || React;
window.ReactDOM = ReactDOMClient.default || ReactDOMClient;
window.ReactDOMClient = ReactDOMClient;
window.JsxRuntime = JsxRuntime;

var externalPackages = ${JSON.stringify(detectedPkgs)};
var externalModules = {};

function wrapModule(mod, pkgName) {
  if (!mod) return mod;
  if (typeof mod === 'function') {
    try {
      mod.default = mod;
      mod.__esModule = true;
    } catch(e) {}
    return mod;
  }
  var target = {};
  try {
    Object.assign(target, mod);
  } catch(e) {}
  try {
    var keys = Object.getOwnPropertyNames(mod);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key !== '__esModule') {
        try {
          target[key] = mod[key];
        } catch(e) {}
      }
    }
  } catch(e) {}
  target.default = mod.default !== undefined ? mod.default : mod;
  target.__esModule = true;
  // Requirement: Use HashRouter for all user-created React projects & auto-opt-in v7 future flags
  if (target.HashRouter) {
    var OrigHashRouter = target.HashRouter;
    var WrappedRouter = function(props) {
      var mergedProps = Object.assign({}, props, {
        future: Object.assign({ v7_startTransition: true, v7_relativeSplatPath: true }, props ? props.future : null)
      });
      return window.React.createElement(OrigHashRouter, mergedProps);
    };
    target.HashRouter = WrappedRouter;
    target.BrowserRouter = WrappedRouter;
  }
  if (target.createHashRouter) {
    var origCreateHashRouter = target.createHashRouter;
    var wrappedCreateHashRouter = function(routes, opts) {
      var mergedOpts = Object.assign({}, opts, {
        future: Object.assign({ v7_startTransition: true, v7_relativeSplatPath: true }, opts ? opts.future : null)
      });
      return origCreateHashRouter(routes, mergedOpts);
    };
    target.createHashRouter = wrappedCreateHashRouter;
    target.createBrowserRouter = wrappedCreateHashRouter;
  }
  return target;
}

var modules = {};
var cache = {};

${Object.entries(compiledModules)
  .map(([id, code]) => `modules[${JSON.stringify(id)}] = function(module, exports, require) {\n${code}\n};`)
  .join('\n')}

function customRequire(name) {
  if (name === 'react') return window.React;
  if (name === 'react-dom') return window.ReactDOM;
  if (name === 'react-dom/client') return window.ReactDOMClient || window.ReactDOM;
  if (name === 'react/jsx-runtime' || name === 'react/jsx-dev-runtime') {
    return window.JsxRuntime || {
      jsx: function(type, props, key) {
        if (!type) {
          console.error('[CodeCollab React Sandbox] Error: Element type is invalid (got ' + typeof type + '). Did you forget to export a component or make a typo in the import?');
        }
        var p = Object.assign({}, props);
        if (key !== undefined) p.key = key;
        var children = p.children;
        delete p.children;
        return Array.isArray(children)
          ? window.React.createElement.apply(window.React, [type, p].concat(children))
          : children !== undefined
          ? window.React.createElement(type, p, children)
          : window.React.createElement(type, p);
      },
      jsxs: function(type, props, key) {
        return this.jsx(type, props, key);
      },
      Fragment: window.React.Fragment
    };
  }

  // Handle CSS import (e.g. import './index.css' or import 'leaflet/dist/leaflet.css')
  if (name.endsWith('.css')) {
    if (!name.startsWith('.') && !name.startsWith('/')) {
      var existing = document.querySelector('link[data-pkg-css="' + name + '"]');
      if (!existing) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.setAttribute('data-pkg-css', name);
        link.href = 'https://esm.sh/' + name;
        document.head.appendChild(link);
      }
    }
    return {};
  }

  if (cache[name]) return cache[name].exports;

  // Dedicated handler for react-router-dom / react-router
  if (name === 'react-router-dom' || name === 'react-router') {
    var routerMod = externalModules['react-router-dom'] || externalModules['react-router'];
    if (routerMod) {
      if (routerMod.HashRouter) {
        routerMod.BrowserRouter = routerMod.HashRouter;
      }
      if (routerMod.createHashRouter && routerMod.createBrowserRouter) {
        routerMod.createBrowserRouter = routerMod.createHashRouter;
      }
      return routerMod;
    }
  }

  // External package resolution (exact match or package base name)
  if (externalModules[name]) {
    return externalModules[name];
  }
  var rootName = name.replace(/^@/, '__at__').split('/')[0].replace(/^__at__/, '@');
  if (externalModules[rootName]) {
    return externalModules[rootName];
  }

  var cleanName = typeof name === 'string' ? name : '';
  while (cleanName.startsWith('./') || cleanName.startsWith('/') || cleanName.startsWith('.')) {
    if (cleanName.startsWith('./')) {
      cleanName = cleanName.slice(2);
    } else {
      cleanName = cleanName.slice(1);
    }
  }
  var aliasName = cleanName.startsWith('@/') ? 'src/' + cleanName.slice(2) : cleanName;
  var modFn = modules[name] ||
              modules[cleanName] ||
              modules[aliasName] ||
              modules['./' + cleanName] ||
              modules['src/' + cleanName] ||
              modules['./src/' + cleanName] ||
              modules[cleanName + '.jsx'] ||
              modules[cleanName + '.js'] ||
              modules[aliasName + '.jsx'] ||
              modules[aliasName + '.js'] ||
              modules['./' + cleanName + '.jsx'] ||
              modules['./' + cleanName + '.js'] ||
              modules['src/' + cleanName + '.jsx'] ||
              modules['src/' + cleanName + '.js'] ||
              modules['./src/' + cleanName + '.jsx'] ||
              modules['./src/' + cleanName + '.js'] ||
              modules[cleanName + '/index.jsx'] ||
              modules[cleanName + '/index.js'] ||
              modules[aliasName + '/index.jsx'] ||
              modules[aliasName + '/index.js'] ||
              modules['src/' + cleanName + '/index.jsx'] ||
              modules['src/' + cleanName + '/index.js'];

  if (!modFn) {
    console.warn('[CodeCollab React Sandbox] Module not found: ' + name);
    return {};
  }

  var mod = { exports: {} };
  cache[name] = mod;
  modFn(mod, mod.exports, customRequire);
  return mod.exports;
}

// Pre-load external npm packages via esm.sh CDN before executing entry component
async function startApp() {
  if (externalPackages.length > 0) {
    var loadingBanner = document.createElement('div');
    loadingBanner.id = 'codecollab-pkg-loading';
    loadingBanner.style.cssText = 'position:fixed;bottom:16px;right:16px;background:rgba(15,23,42,0.92);color:#93c5fd;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:12px;padding:8px 14px;border-radius:20px;border:1px solid rgba(59,130,246,0.3);box-shadow:0 8px 20px rgba(0,0,0,0.4);display:flex;align-items:center;gap:8px;z-index:99999;backdrop-filter:blur(6px);pointer-events:none;transition:opacity 0.3s ease;';
    loadingBanner.innerHTML = '<span style="display:inline-block;width:10px;height:10px;border:2px solid #60a5fa;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></span><span>Resolving packages (' + externalPackages.length + ')...</span><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(loadingBanner);

    await Promise.all(externalPackages.map(async function(pkg) {
      try {
        var importUrl = 'https://esm.sh/' + pkg + '?bundle&external=react,react-dom';
        if (pkg === 'react-router-dom' || pkg === 'react-router') {
          importUrl = 'https://esm.sh/react-router-dom@6.28.0/X-ZXJlYWN0LHJlYWN0LWRvbQ/es2022/react-router-dom.bundle.mjs';
        }
        var mod;
        try {
          mod = await import(importUrl);
        } catch(directErr) {
          // If bundle with external failed, try direct esm.sh bundle or fallback
          try {
            mod = await import('https://esm.sh/' + pkg + '?bundle');
          } catch(bundleErr) {
            mod = await import('https://esm.sh/' + pkg);
          }
        }
        var wrapped = wrapModule(mod, pkg);
        externalModules[pkg] = wrapped;
        var parts = pkg.split('/');
        if (parts.length > 1) {
          externalModules[parts[0]] = externalModules[parts[0]] || wrapped;
        }
      } catch (err) {
        console.warn('[CodeCollab Sandbox] Could not load external package "' + pkg + '":', err);
      }
    }));

    if (loadingBanner && loadingBanner.parentNode) {
      loadingBanner.style.opacity = '0';
      setTimeout(function() {
        if (loadingBanner.parentNode) loadingBanner.parentNode.removeChild(loadingBanner);
      }, 300);
    }
  }

  // Ensure requested hash is set before HashRouter initializes
  var initialReqHash = ${JSON.stringify(initialHash || '')};
  if (initialReqHash && typeof window !== 'undefined') {
    try {
      if (window.location.hash !== initialReqHash) {
        window.location.hash = initialReqHash;
      }
    } catch(e) {}
  }

  // Execute entry file
  try {
    if (modules['src/main.jsx'] || modules['main.jsx']) {
      customRequire(modules['src/main.jsx'] ? 'src/main.jsx' : 'main.jsx');
    } else if (modules['src/index.jsx'] || modules['index.jsx']) {
      customRequire(modules['src/index.jsx'] ? 'src/index.jsx' : 'index.jsx');
    } else if (modules['src/App.jsx'] || modules['App.jsx']) {
      var AppMod = customRequire(modules['src/App.jsx'] ? 'src/App.jsx' : 'App.jsx');
      var App = AppMod.default || AppMod;
      var rootEl = document.getElementById('root');
      if (App && window.ReactDOM && rootEl) {
        window.ReactDOM.createRoot(rootEl).render(window.React.createElement(App));
      }
    }
  } catch(err) {
    console.error('[React Runtime Error]', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
</script>
`;

      const importMapScript = `
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18.3.1",
    "react/": "https://esm.sh/react@18.3.1/",
    "react-dom": "https://esm.sh/react-dom@18.3.1",
    "react-dom/": "https://esm.sh/react-dom@18.3.1/",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
    "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
    "react/jsx-dev-runtime": "https://esm.sh/react@18.3.1/jsx-dev-runtime",
    "/": "https://esm.sh/"
  }
}
</script>
`;

      // Inject React importmap, telemetry, styles, and bundle into HTML (importmap must come first)
      const headInjection = `\n${importMapScript}\n${telemetryScript}\n<style>\n${combinedCss}\n</style>\n`;
      if (/<head\b[^>]*>/i.test(htmlContent)) {
        htmlContent = htmlContent.replace(/<head\b[^>]*>/i, `$&${headInjection}`);
      } else {
        htmlContent = `${headInjection}\n${htmlContent}`;
      }

      if (/<\/body>/i.test(htmlContent)) {
        htmlContent = htmlContent.replace(/<\/body>/i, `${reactBundleScript}\n</body>`);
      } else {
        htmlContent += `\n${reactBundleScript}`;
      }

      return htmlContent;
    } catch (compileErr) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>React Compilation Error</title>
  <style>
    body {
      background: #0f1117;
      color: #f87171;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      padding: 24px;
      margin: 0;
    }
    .error-card {
      background: #181c27;
      border: 1px solid #7f1d1d;
      border-radius: 8px;
      padding: 20px;
      max-width: 650px;
      margin: 30px auto;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    h3 { margin-top: 0; color: #ef4444; font-size: 16px; }
    pre {
      background: #090c14;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #282f44;
      color: #fca5a5;
      font-size: 12.5px;
      white-space: pre-wrap;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="error-card">
    <h3>React JSX Compilation Error</h3>
    <p style="color: #94a3b8; font-size: 13px;">There was a problem compiling your React components:</p>
    <pre>${escapeHtml(compileErr.message)}</pre>
  </div>
</body>
</html>`;
    }
  }

  // =========================================================================
  // 2. STANDARD HTML / CSS / JS COMPILER
  // =========================================================================

  // Find all available HTML files
  const htmlFileNames = Object.keys(files).filter((fileName) => {
    const lower = fileName.toLowerCase();
    return lower.endsWith('.html') || lower.endsWith('.htm');
  });

  // Determine entry HTML file
  let entryFile = selectedHtmlFile;
  if (!entryFile || !files[entryFile]) {
    if (files['index.html']) {
      entryFile = 'index.html';
    } else if (htmlFileNames.length > 0) {
      entryFile = htmlFileNames[0];
    } else {
      entryFile = null;
    }
  }

  let htmlContent = '';
  if (entryFile && files[entryFile]?.content) {
    htmlContent = files[entryFile].content;
  } else {
    htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CodeCollab Preview</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
      margin: 0;
      background: #0f172a;
      color: #f8fafc;
    }
    .preview-placeholder {
      max-width: 500px;
      margin: 40px auto;
      padding: 24px;
      border: 1px dashed #334155;
      border-radius: 8px;
      text-align: center;
    }
    h2 { margin-top: 0; color: #6d5dfc; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
  </style>
</head>
<body>
  <div id="app" class="preview-placeholder">
    <h2>CodeCollab Live Preview</h2>
    <p>JavaScript and CSS files will run in this container.</p>
  </div>
</body>
</html>`;
  }

  // Build lookup maps for CSS and JS files
  const cssFiles = {};
  const jsFiles = {};

  Object.entries(files).forEach(([path, fileObj]) => {
    if (!fileObj || typeof fileObj.content !== 'string') return;
    const cleanPath = path.replace(/^\.\//, '').replace(/^\//, '');
    const baseName = fileObj.name || cleanPath.split('/').pop();

    if (cleanPath.toLowerCase().endsWith('.css') || fileObj.language === 'css') {
      cssFiles[cleanPath] = fileObj.content;
      cssFiles[baseName] = fileObj.content;
      cssFiles[`./${cleanPath}`] = fileObj.content;
      cssFiles[`./${baseName}`] = fileObj.content;
    } else if (cleanPath.toLowerCase().endsWith('.js') || fileObj.language === 'javascript') {
      jsFiles[cleanPath] = fileObj.content;
      jsFiles[baseName] = fileObj.content;
      jsFiles[`./${cleanPath}`] = fileObj.content;
      jsFiles[`./${baseName}`] = fileObj.content;
    }
  });

  const inlinedCss = new Set();
  const inlinedJs = new Set();

  // 1. In-line explicitly referenced <link rel="stylesheet" href="..."> tags
  htmlContent = htmlContent.replace(/<link\b([^>]*)\/?>/gi, (match, attrs) => {
    const isStylesheet = /rel=["']stylesheet["']/i.test(attrs);
    if (!isStylesheet) return match;

    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) return match;

    const href = hrefMatch[1];
    const cleanHref = href.replace(/^\.\//, '').replace(/^\//, '');
    const content = cssFiles[href] || cssFiles[cleanHref];

    if (content !== undefined) {
      inlinedCss.add(cleanHref);
      inlinedCss.add(href);
      return `\n<style data-codecollab-file="${cleanHref}">\n/* Inlined: ${cleanHref} */\n${content}\n</style>\n`;
    }
    return match;
  });

  // 2. In-line explicitly referenced <script src="..."> tags
  htmlContent = htmlContent.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>|<script\b([^>]*)\/>/gi, (match, attrs1, _inner, attrs2) => {
    const attrs = attrs1 || attrs2 || '';
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) return match;

    const src = srcMatch[1];
    // Preserve external CDN scripts
    if (/^https?:\/\//i.test(src) || /^\/\//.test(src)) {
      return match;
    }

    const cleanSrc = src.replace(/^\.\//, '').replace(/^\//, '');
    const content = jsFiles[src] || jsFiles[cleanSrc];

    if (content !== undefined) {
      inlinedJs.add(cleanSrc);
      inlinedJs.add(src);
      const safeJs = content.replace(/<\/script>/gi, '</scr" + "ipt>');
      return `\n<style data-codecollab-inline="${cleanSrc}"></style>\n<script data-codecollab-file="${cleanSrc}">\n/* Inlined: ${cleanSrc} */\n${safeJs}\n</script>\n`;
    }
    return `<!-- [CodeCollab Preview] Skipped unresolvable local script: ${src} -->`;
  });

  // 3. Auto-inject any unlinked project CSS (e.g. styles.css)
  let unlinkedCss = '';
  Object.entries(cssFiles).forEach(([name, content]) => {
    if (!name.includes('/') && !name.startsWith('./') && !inlinedCss.has(name)) {
      inlinedCss.add(name);
      unlinkedCss += `\n<style data-codecollab-file="${name}">\n/* Auto-injected: ${name} */\n${content}\n</style>\n`;
    }
  });

  if (unlinkedCss) {
    if (/<head\b[^>]*>/i.test(htmlContent)) {
      htmlContent = htmlContent.replace(/<head\b[^>]*>/i, `$&${unlinkedCss}`);
    } else {
      htmlContent = `${unlinkedCss}\n${htmlContent}`;
    }
  }

  // 4. Auto-inject any unlinked project JS (e.g. main.js)
  let unlinkedJs = '';
  Object.entries(jsFiles).forEach(([name, content]) => {
    if (!name.includes('/') && !name.startsWith('./') && !inlinedJs.has(name)) {
      inlinedJs.add(name);
      const safeJs = content.replace(/<\/script>/gi, '</scr" + "ipt>');
      unlinkedJs += `\n<script data-codecollab-file="${name}">\n/* Auto-injected: ${name} */\n${safeJs}\n</script>\n`;
    }
  });

  if (unlinkedJs) {
    if (/<\/body>/i.test(htmlContent)) {
      htmlContent = htmlContent.replace(/<\/body>/i, `${unlinkedJs}\n$&`);
    } else {
      htmlContent = `${htmlContent}\n${unlinkedJs}`;
    }
  }

  // 5. Inject safe telemetry & error handler script at top of document
  if (/<head\b[^>]*>/i.test(htmlContent)) {
    htmlContent = htmlContent.replace(/<head\b[^>]*>/i, `$&${telemetryScript}`);
  } else {
    htmlContent = `${telemetryScript}\n${htmlContent}`;
  }

  return htmlContent;
}
