import dotenv from 'dotenv';

dotenv.config();

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

const optional = (key: string, fallback: string): string => process.env[key] ?? fallback;

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3001'), 10),
  mongodbUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  adminSignupSecret: required('ADMIN_SIGNUP_SECRET'),
  frontendUrl: optional('FRONTEND_URL', 'http://localhost:3000'),
};

export const isProduction = env.nodeEnv === 'production';
