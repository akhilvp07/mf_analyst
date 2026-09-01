import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import https from 'https';
import {defineConfig, Plugin} from 'vite';

function amfiNavProxyPlugin(): Plugin {
  return {
    name: 'amfi-nav-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/amfi-nav' || req.url === '/api/amfi/navall') {
          const amfiReq = https.get('https://portal.amfiindia.com/spages/NAVAll.txt', (amfiRes) => {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            amfiRes.pipe(res);
          });
          amfiReq.on('error', (err) => {
            res.statusCode = 502;
            res.end('Error fetching AMFI NAV data: ' + err.message);
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), amfiNavProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
