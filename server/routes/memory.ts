import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getMemories, createMemory, updateMemory, deleteMemory, clearUserMemories
} from '../services/memoryService.js';
import { logAudit } from '../services/developerIdentity.js';
import { rateLimit } from 'express-rate-limit';

export const memoryRouter = Router();

const limiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });

memoryRouter.use(requireAuth);
memoryRouter.use(limiter);

// GET /api/memory — list user's memories
memoryRouter.get('/', async (req: Request, res: Response) => {
  const memories = await getMemories(req.user!.id);
  res.json(memories);
});

// POST /api/memory — create a memory
memoryRouter.post('/', async (req: Request, res: Response) => {
  const { content, category, importance } = req.body as {
    content?: string; category?: string; importance?: number;
  };
  if (!content?.trim()) { res.status(400).json({ error: 'content is required.' }); return; }

  try {
    const memory = await createMemory(req.user!.id, content.trim(), category, importance);
    if (!memory) { res.status(500).json({ error: 'Failed to save memory.' }); return; }
    await logAudit(req.user!.id, 'memory_created', 'memories', { memoryId: memory.id });
    res.status(201).json(memory);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save memory.' });
  }
});

// PATCH /api/memory/:id
memoryRouter.patch('/:id', async (req: Request, res: Response) => {
  const { content, category, importance } = req.body as {
    content?: string; category?: string; importance?: number;
  };
  try {
    const ok = await updateMemory(req.user!.id, String(req.params.id), { content, category, importance });
    if (!ok) { res.status(404).json({ error: 'Memory not found.' }); return; }
    res.json({ message: 'Updated.' });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Update failed.' });
  }
});

// DELETE /api/memory/:id
memoryRouter.delete('/:id', async (req: Request, res: Response) => {
  const ok = await deleteMemory(req.user!.id, String(req.params.id));
  if (!ok) { res.status(404).json({ error: 'Memory not found.' }); return; }
  await logAudit(req.user!.id, 'memory_deleted', 'memories', { memoryId: req.params.id });
  res.json({ message: 'Deleted.' });
});

// DELETE /api/memory — clear all (non-system)
memoryRouter.delete('/', async (req: Request, res: Response) => {
  await clearUserMemories(req.user!.id);
  await logAudit(req.user!.id, 'memories_cleared', 'memories');
  res.json({ message: 'All memories cleared.' });
});
