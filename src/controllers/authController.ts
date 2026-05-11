import { Request, Response } from 'express';
import jwtAuthService from '../services/jwtAuthService';
import User from '../models/User';
import { env } from '../config/env';
import { AuthRequest, Instrument } from '../types';

const VALID_INSTRUMENTS: Instrument[] = [
  'drums',
  'guitar',
  'bass',
  'saxophone',
  'keyboards',
  'vocals',
];

const validateSignupBody = (body: unknown): { username: string; password: string; instrument: Instrument } | string => {
  if (!body || typeof body !== 'object') return 'Invalid body';
  const b = body as Record<string, unknown>;
  if (typeof b.username !== 'string' || b.username.trim().length < 3) {
    return 'Username must be at least 3 characters';
  }
  if (typeof b.password !== 'string' || b.password.length < 6) {
    return 'Password must be at least 6 characters';
  }
  if (typeof b.instrument !== 'string' || !VALID_INSTRUMENTS.includes(b.instrument as Instrument)) {
    return 'Invalid instrument';
  }
  return {
    username: b.username,
    password: b.password,
    instrument: b.instrument as Instrument,
  };
};

export const signup = async (req: Request, res: Response): Promise<void> => {
  const validated = validateSignupBody(req.body);
  if (typeof validated === 'string') {
    res.status(400).json({ success: false, message: validated });
    return;
  }

  try {
    const { token, user } = await jwtAuthService.signUp({
      ...validated,
      role: 'user',
    });
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        instrument: user.instrument,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg === 'USERNAME_TAKEN') {
      res.status(409).json({ success: false, message: 'Username already taken', errorCode: 'USERNAME_TAKEN' });
      return;
    }
    res.status(500).json({ success: false, message: 'Signup failed' });
  }
};

export const adminSignup = async (req: Request, res: Response): Promise<void> => {
  const validated = validateSignupBody(req.body);
  if (typeof validated === 'string') {
    res.status(400).json({ success: false, message: validated });
    return;
  }

  const adminSecret = (req.body as Record<string, unknown>).adminSecret;
  if (typeof adminSecret !== 'string' || adminSecret !== env.adminSignupSecret) {
    res.status(403).json({ success: false, message: 'Invalid admin secret' });
    return;
  }

  try {
    const { token, user } = await jwtAuthService.signUp({
      ...validated,
      role: 'admin',
    });
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        instrument: user.instrument,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg === 'USERNAME_TAKEN') {
      res.status(409).json({ success: false, message: 'Username already taken', errorCode: 'USERNAME_TAKEN' });
      return;
    }
    res.status(500).json({ success: false, message: 'Admin signup failed' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = (req.body ?? {}) as { username?: unknown; password?: unknown };
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ success: false, message: 'username and password are required' });
    return;
  }

  try {
    const { token, user } = await jwtAuthService.login(username, password);
    res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        instrument: user.instrument,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg === 'INVALID_CREDENTIALS') {
      res.status(401).json({ success: false, message: 'Invalid username or password', errorCode: 'INVALID_CREDENTIALS' });
      return;
    }
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const { expiredToken } = (req.body ?? {}) as { expiredToken?: unknown };
  if (typeof expiredToken !== 'string') {
    res.status(400).json({ success: false, message: 'expiredToken is required' });
    return;
  }
  try {
    const token = await jwtAuthService.refreshFromExpired(expiredToken);
    res.json({ success: true, token });
  } catch {
    res.status(401).json({ success: false, message: 'Could not refresh token', errorCode: 'REFRESH_FAILED' });
  }
};

export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }
  const user = await User.findById(req.user.userId);
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }
  res.json({
    success: true,
    user: {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      instrument: user.instrument,
    },
  });
};
