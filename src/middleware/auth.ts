import { Response, NextFunction } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import jwtAuthService from '../services/jwtAuthService';
import { AuthRequest, Role } from '../types';

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Missing bearer token' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    req.user = jwtAuthService.verifyToken(token);
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      res.status(401).json({ success: false, message: 'Token expired', errorCode: 'TOKEN_EXPIRED' });
      return;
    }
    if (error instanceof JsonWebTokenError) {
      res.status(401).json({ success: false, message: 'Invalid token', errorCode: 'INVALID_TOKEN' });
      return;
    }
    res.status(500).json({ success: false, message: 'Auth error' });
  }
};

export const authorize = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    next();
  };
};
