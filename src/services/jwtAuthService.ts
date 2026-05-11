import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User, { IUserDocument } from '../models/User';
import { env } from '../config/env';
import { Instrument, JwtPayload, Role } from '../types';

const JWT_EXPIRATION_SECONDS = 60 * 60;

class JwtAuthService {
  private buildPayload(user: IUserDocument): JwtPayload {
    return {
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
      instrument: user.instrument,
    };
  }

  signJwt(user: IUserDocument): string {
    const options: SignOptions = { expiresIn: JWT_EXPIRATION_SECONDS };
    return jwt.sign(this.buildPayload(user), env.jwtSecret, options);
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, env.jwtSecret) as JwtPayload;
  }

  // Used by /auth/refresh: accepts an expired-but-valid JWT and reissues a fresh one.
  // Same pattern as the reference monorepo's jwtAuthService.refreshToken.
  verifyTokenIgnoreExpiration(token: string): JwtPayload {
    return jwt.verify(token, env.jwtSecret, { ignoreExpiration: true }) as JwtPayload;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  async signUp(params: {
    username: string;
    password: string;
    instrument: Instrument;
    role: Role;
  }): Promise<{ token: string; user: IUserDocument }> {
    const username = params.username.trim().toLowerCase();

    const existing = await User.findOne({ username });
    if (existing) {
      throw new Error('USERNAME_TAKEN');
    }

    const passwordHash = await this.hashPassword(params.password);
    const user = await User.create({
      username,
      passwordHash,
      instrument: params.instrument,
      role: params.role,
    });

    return { token: this.signJwt(user), user };
  }

  async login(usernameRaw: string, password: string): Promise<{ token: string; user: IUserDocument }> {
    const username = usernameRaw.trim().toLowerCase();
    const user = await User.findOne({ username });
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const ok = await this.comparePassword(password, user.passwordHash);
    if (!ok) {
      throw new Error('INVALID_CREDENTIALS');
    }

    return { token: this.signJwt(user), user };
  }

  async refreshFromExpired(expiredToken: string): Promise<string> {
    const decoded = this.verifyTokenIgnoreExpiration(expiredToken);
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
    return this.signJwt(user);
  }
}

export default new JwtAuthService();
