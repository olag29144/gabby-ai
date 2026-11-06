import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { chatRouter } from './server/routes/chat.js';
import { authRouter } from './server/routes/auth.js';
import { conversationsRouter } from './server/routes/conversations.js';
import { memoryRouter } from './server/routes/memory.js';
import { developerRouter } from './server/routes/developer.js';
import { keyManager } from './server/services/keyManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    keys: keyManager.count,
    providers: keyManager.getStatus(),
  });
});

// API routes
app.use('/api', chatRouter);
app.use('/api/auth', authRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/developer', developerRouter);

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Development mode: mount Vite dev middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Fallback handler to serve and transform index.html
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexHtmlPath = path.resolve(__dirname, 'index.html');
        const template = fs.readFileSync(indexHtmlPath, 'utf-8');
        const html = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Production mode: serve built static files
    const distPath = path.join(__dirname, 'dist/client');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\nGabby AI server running on http://0.0.0.0:${PORT}`);
    if (keyManager.count === 0) {
      console.warn('⚠  No API keys configured. Set GEMINI_API_KEY, GROQ_API_KEYS, or OPENROUTER_API_KEYS in .env\n');
    } else {
      console.log(`✓  ${keyManager.count} API key(s) ready\n`);
    }
  });
}

startServer();
