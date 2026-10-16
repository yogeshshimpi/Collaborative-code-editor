import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Render Static Sites serve 404.html as the automatic fallback for client-routed paths.
// Duplicating dist/index.html as dist/404.html ensures direct visits to /preview/:roomId
// load the SPA immediately even if custom rewrites have not been configured yet in the dashboard.
function spaFallbackPlugin() {
  return {
    name: 'spa-fallback-plugin',
    closeBundle() {
      const distIndex = path.resolve(__dirname, 'dist/index.html');
      const dist404 = path.resolve(__dirname, 'dist/404.html');
      try {
        if (fs.existsSync(distIndex)) {
          fs.copyFileSync(distIndex, dist404);
          console.log('✓ Created dist/404.html for Render SPA routing fallback');
        }
      } catch (err) {
        console.warn('Could not copy index.html to 404.html:', err.message);
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), spaFallbackPlugin()],
  server: {
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});

