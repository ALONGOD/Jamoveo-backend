import { Router } from 'express';
import authRoutes from './auth';
import songRoutes from './songs';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/songs', songRoutes);

export default router;
