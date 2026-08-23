import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '../../.env' });
dotenv.config(); // fallback

export const CONFIG = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:4000',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://ivf_user:ivf_password_secure_2026@localhost:5432/ivf_db?schema=public',
  
  // Site Access Key Hash (Default 'clinic2026')
  APP_ACCESS_KEY_HASH: process.env.APP_ACCESS_KEY_HASH || 'ec189984c5b36432f04401eb55b916a4801153d10b627bc4cc590382e27d1aa8',
  
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev_jwt_access_secret_super_secure_32_bytes_long_2026!',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_super_secure_32_bytes_long_2026!',
  JWT_ACCESS_EXPIRATION: process.env.JWT_ACCESS_EXPIRATION || '1h',
  JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION || '7d',

  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'local',
  STORAGE_LOCAL_DIR: process.env.STORAGE_LOCAL_DIR || './uploads',
  
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  OCR_PROVIDER: process.env.OCR_PROVIDER || 'google',
};

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (CONFIG.OCR_PROVIDER === 'google') {
    if (!CONFIG.GOOGLE_APPLICATION_CREDENTIALS) {
      errors.push('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.');
    }
  }
  return { valid: errors.length === 0, errors };
}

export function verifyAccessKey(providedKey: string): boolean {
  if (!providedKey) return false;
  const cleanKey = providedKey.trim();
  const hash = crypto.createHash('sha256').update(cleanKey).digest('hex');
  return hash.toLowerCase() === CONFIG.APP_ACCESS_KEY_HASH.toLowerCase();
}
