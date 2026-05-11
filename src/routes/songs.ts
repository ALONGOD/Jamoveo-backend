import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { searchSongs, fetchSong } from '../controllers/songsController';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/search', searchSongs);
router.get('/fetch', fetchSong);

export default router;
