/**
 * previewCompiler.js
 * Builds an isolated HTML bundle by safely inlining CSS and JS from project files.
 * Replaces <link rel="stylesheet"> and <script src="..."> tags with inlined contents,
 * injects any unlinked project CSS/JS, and attaches safe console telemetry.
 */
export function buildPreviewDocument(files, selectedHtmlFile, _renderNonce) {
  if (!files || typeof files !== 'object') {
    return '<html><body><p>No project files found.</p></body></html>';
  }

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
    // Fallback HTML shell if no HTML file exists
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
  htmlContent = htmlContent.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, _inner) => {
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) return match;

    const src = srcMatch[1];
    const cleanSrc = src.replace(/^\.\//, '').replace(/^\//, '');
    const content = jsFiles[src] || jsFiles[cleanSrc];

    if (content !== undefined) {
      inlinedJs.add(cleanSrc);
      inlinedJs.add(src);
      const safeJs = content.replace(/<\/script>/gi, '</scr" + "ipt>');
      return `\n<style data-codecollab-inline="${cleanSrc}"></style>\n<script data-codecollab-file="${cleanSrc}">\n/* Inlined: ${cleanSrc} */\n${safeJs}\n</script>\n`;
    }
    return match;
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
  const telemetryScript = `
<script data-codecollab-sandbox-telemetry="true">
(function() {
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

  var _log = console.log, _info = console.info, _warn = console.warn, _error = console.error;
  console.log = function() { _log && _log.apply(console, arguments); postMsg('log', arguments); };
  console.info = function() { _info && _info.apply(console, arguments); postMsg('info', arguments); };
  console.warn = function() { _warn && _warn.apply(console, arguments); postMsg('warn', arguments); };
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

  if (/<head\b[^>]*>/i.test(htmlContent)) {
    htmlContent = htmlContent.replace(/<head\b[^>]*>/i, `$&${telemetryScript}`);
  } else {
    htmlContent = `${telemetryScript}\n${htmlContent}`;
  }

  return htmlContent;
}
