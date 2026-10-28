// dotenv must be the very first import so env vars are available to all modules
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { chatRouter } from './routes/chat.js';
import { keyManager } from './services/keyManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'], credentials: true }));
app.use(express.json({ limit: '50mb' }));

app.use('/api', chatRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    keys: keyManager.count,
    providers: keyManager.getStatus(),
  });
});

const distPath = path.join(__dirname, '../dist/client');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\nNova AI server → http://localhost:${PORT}`);
  if (keyManager.count === 0) {
    console.warn('⚠  No API keys configured. Add OPENROUTER_API_KEYS or GROQ_API_KEYS to .env\n');
  } else {
    console.log(`✓  ${keyManager.count} API key(s) ready\n`);
  }
});
