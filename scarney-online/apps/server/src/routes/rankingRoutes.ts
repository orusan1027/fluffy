import { Router } from 'express';
import { getTopRankings } from '../services/rankingService.js';

const router = Router();

// GET /api/rankings
router.get('/', async (_req, res, next) => {
  try {
    const entries = await getTopRankings(20);
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});

export default router;
