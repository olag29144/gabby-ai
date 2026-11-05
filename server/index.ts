// dotenv must be the very first import so env vars are available to all modules
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { chatRouter } from './routes/chat.js';
import { keyManager } from './services/keyManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));

app.use('/api', chatRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    keys: keyManager.count,
    providers: keyManager.getStatus(),
  });
});

async function start() {
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.join(__dirname, '../dist/client');

  if (!isProd && !fs.existsSync(path.join(distPath, 'index.html'))) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      app.use('*', async (req, res, next) => {
        try {
          const indexPath = path.resolve(__dirname, '../index.html');
          const template = fs.readFileSync(indexPath, 'utf-8');
          const html = await vite.transformIndexHtml(req.originalUrl, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
    } catch {
      app.use(express.static(distPath));
    }
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const file = path.join(distPath, 'index.html');
      if (fs.existsSync(file)) {
        res.sendFile(file);
      } else {
        res.status(404).send('Application build not found. Please build the client first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\nGabby AI server → http://0.0.0.0:${PORT}`);
    if (keyManager.count === 0) {
      console.warn('⚠  No API keys configured. Add GEMINI_API_KEY, OPENROUTER_API_KEYS, or GROQ_API_KEYS to .env\n');
    } else {
      console.log(`✓  ${keyManager.count} API key(s) ready\n`);
    }
  });
}

start();
