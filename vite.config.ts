import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import https from 'https';
import {defineConfig, Plugin} from 'vite';

function amfiNavProxyPlugin(): Plugin {
  let cachedAmfiText: string = '';
  let lastCachedTime = 0;

  function fetchAmfiWithRedirects(targetUrl: string, maxRedirects: number = 3): Promise<string> {
    return new Promise((resolve, reject) => {
      if (maxRedirects < 0) {
        return reject(new Error('Too many redirects while fetching AMFI NAV data'));
      }

      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/plain, text/html, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        }
      };

      https.get(targetUrl, options, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, targetUrl).toString();
          return resolve(fetchAmfiWithRedirects(redirectUrl, maxRedirects - 1));
        }

        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          return reject(new Error(`AMFI returned HTTP status ${res.statusCode}`));
        }

        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(data);
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  return {
    name: 'amfi-nav-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/amfi-nav' || req.url === '/api/amfi/navall') {
          // Serve from memory cache if less than 1 hour old
          if (cachedAmfiText && Date.now() - lastCachedTime < 1000 * 60 * 60) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.end(cachedAmfiText);
            return;
          }

          try {
            const rawText = await fetchAmfiWithRedirects('https://portal.amfiindia.com/spages/NAVAll.txt');
            if (rawText && rawText.includes(';')) {
              cachedAmfiText = rawText;
              lastCachedTime = Date.now();
              res.setHeader('Content-Type', 'text/plain; charset=utf-8');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cache-Control', 'public, max-age=3600');
              res.end(rawText);
              return;
            }
          } catch (err: any) {
            if (cachedAmfiText) {
              res.setHeader('Content-Type', 'text/plain; charset=utf-8');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(cachedAmfiText);
              return;
            }
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Failed to fetch AMFI NAVAll', details: err?.message }));
            return;
          }
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
