import { Router } from 'express';
import { signup, adminSignup, login, refresh, me } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/signup', signup);
router.post('/admin-signup', adminSignup);
router.post('/login', login);
router.post('/refresh', refresh);
router.get('/me', authenticate, me);

export default router;
