import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../../common/prisma.js';
import { CONFIG, verifyAccessKey } from '../../common/config.js';

interface JwtPayload {
  userId: string;
  staffId: string;
  role: string;
}

const loginAttempts = new Map<string, { count: number; lockUntil: number }>();

export class AuthService {
  // Layer 1 Access Key Check
  verifySiteKey(key: string): boolean {
    return verifyAccessKey(key);
  }

  // Rate limiting check
  private checkRateLimit(ip: string): void {
    const record = loginAttempts.get(ip);
    const now = Date.now();
    if (record && record.lockUntil > now) {
      const waitMins = Math.ceil((record.lockUntil - now) / 60000);
      throw new Error(`Too many failed attempts. Please wait ${waitMins} minutes before trying again.`);
    }
  }

  private recordFailedAttempt(ip: string): void {
    const now = Date.now();
    const record = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
    record.count += 1;
    if (record.count >= 5) {
      record.lockUntil = now + 15 * 60 * 1000; // Lock for 15 minutes
    }
    loginAttempts.set(ip, record);
  }

  private resetFailedAttempt(ip: string): void {
    loginAttempts.delete(ip);
  }

  // Password hashing using Argon2id
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  // Staff Login
  async login(staffIdOrEmail: string, password: string, ip: string = '127.0.0.1') {
    this.checkRateLimit(ip);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { staffId: staffIdOrEmail },
          { email: staffIdOrEmail.toLowerCase() },
        ],
      },
    });

    if (!user) {
      this.recordFailedAttempt(ip);
      throw new Error('Invalid staff credentials.');
    }

    const isValid = await this.verifyPassword(user.passwordHash, password);
    if (!isValid) {
      this.recordFailedAttempt(ip);
      throw new Error('Invalid staff credentials.');
    }

    this.resetFailedAttempt(ip);

    // Generate JWT Access & Refresh Tokens
    const payload: JwtPayload = {
      userId: user.id,
      staffId: user.staffId,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, CONFIG.JWT_ACCESS_SECRET, { expiresIn: (CONFIG.JWT_ACCESS_EXPIRATION as any) || '1h' });
    const refreshToken = jwt.sign(payload, CONFIG.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // Log Audit Event
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'USER_LOGIN',
        entityName: 'User',
        entityId: user.id,
        ipAddress: ip,
      },
    });

    return {
      user: {
        id: user.id,
        staffId: user.staffId,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  async seedUsersIfNeeded(): Promise<void> {
    try {
      const adminExists = await prisma.user.findUnique({ where: { staffId: 'ADMIN001' } });
      if (!adminExists) {
        const adminHash = await argon2.hash('AdminPassword123!', { type: argon2.argon2id });
        await prisma.user.create({
          data: {
            staffId: 'ADMIN001',
            email: 'admin@ivfclinic.com',
            name: 'Dr. Sarah Jenkins (Admin)',
            passwordHash: adminHash,
            role: 'ADMIN',
          },
        });
        console.log('[Auth] Auto-seeded default Admin user (ADMIN001)');
      }

      const staffExists = await prisma.user.findUnique({ where: { staffId: 'STAFF001' } });
      if (!staffExists) {
        const staffHash = await argon2.hash('StaffPassword123!', { type: argon2.argon2id });
        await prisma.user.create({
          data: {
            staffId: 'STAFF001',
            email: 'staff@ivfclinic.com',
            name: 'Alex Vance (Embryologist)',
            passwordHash: staffHash,
            role: 'STAFF',
          },
        });
        console.log('[Auth] Auto-seeded default Staff user (STAFF001)');
      }
    } catch (err: any) {
      console.error('[Auth Seed Warning]', err.message);
    }
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, CONFIG.JWT_ACCESS_SECRET) as JwtPayload;
    } catch {
      throw new Error('Unauthorized access token.');
    }
  }

  verifyRefreshToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, CONFIG.JWT_REFRESH_SECRET) as JwtPayload;
    } catch {
      throw new Error('Unauthorized refresh token.');
    }
  }
}

export const authService = new AuthService();
