import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthDatabase, User } from '../database/auth';
import * as sqlite3 from 'sqlite3';

// Extend Express Request interface to include user and authDB
declare global {
    namespace Express {
        interface Request {
            user?: User;
            authDB?: AuthDatabase;
        }
    }
}

export interface JWTPayload {
    sub: string;  // user ID
    username: string;
    jti: string;  // token ID
    iat: number;
    exp: number;
}

export class AuthMiddleware {
    constructor(private authDB: AuthDatabase) { }

    // Middleware to attach authDB to request
    attachAuthDB = (req: Request, res: Response, next: NextFunction) => {
        req.authDB = this.authDB;
        next();
    };

    // Main authentication middleware
    authenticate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const token = this.extractTokenFromCookies(req);

            if (!token) {
                return res.status(401).json({
                    error: 'Authentication required',
                    code: 'NO_TOKEN'
                });
            }

            const jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                console.error('JWT_SECRET not configured');
                return res.status(500).json({ error: 'Authentication configuration error' });
            }

            // Verify JWT token
            const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

            // Check if session exists and is valid
            const session = await this.authDB.getSession(decoded.jti);
            if (!session) {
                return res.status(401).json({
                    error: 'Invalid or expired session',
                    code: 'INVALID_SESSION'
                });
            }

            // Get user from database
            const user = await this.authDB.getUserById(decoded.sub);
            if (!user) {
                return res.status(401).json({
                    error: 'User not found',
                    code: 'USER_NOT_FOUND'
                });
            }

            if (user.status !== 'active') {
                return res.status(401).json({
                    error: 'User account is not active',
                    code: 'USER_INACTIVE'
                });
            }

            // Attach user to request
            req.user = user;
            next();
        } catch (error) {
            if (error instanceof jwt.JsonWebTokenError) {
                return res.status(401).json({
                    error: 'Invalid token',
                    code: 'INVALID_TOKEN'
                });
            }
            if (error instanceof jwt.TokenExpiredError) {
                return res.status(401).json({
                    error: 'Token expired',
                    code: 'TOKEN_EXPIRED'
                });
            }

            console.error('Authentication error:', error);
            return res.status(500).json({ error: 'Authentication error' });
        }
    };

    // Optional authentication - doesn't fail if no token, but attaches user if valid token
    optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const token = this.extractTokenFromCookies(req);

            if (!token) {
                return next(); // Continue without user
            }

            const jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                return next(); // Continue without user
            }

            const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
            const session = await this.authDB.getSession(decoded.jti);

            if (session) {
                const user = await this.authDB.getUserById(decoded.sub);
                if (user && user.status === 'active') {
                    req.user = user;
                }
            }
        } catch (error) {
            // Silently continue without user if token is invalid
        }

        next();
    };

    // Extract JWT token from HTTP-only cookies
    private extractTokenFromCookies(req: Request): string | null {
        const cookies = req.headers.cookie;
        if (!cookies) return null;

        const tokenCookie = cookies
            .split(';')
            .find(cookie => cookie.trim().startsWith('auth_token='));

        if (!tokenCookie) return null;

        return tokenCookie.split('=')[1];
    }

    // Generate JWT token
    generateToken(user: User, sessionId: string): string {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET not configured');
        }

        const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

        const payload: Partial<JWTPayload> = {
            sub: user.id,
            username: user.username,
            jti: sessionId
        };

        return jwt.sign(payload, jwtSecret, { expiresIn });
    }

    // Set authentication cookie
    setAuthCookie(res: Response, token: string): void {
        const isProduction = process.env.NODE_ENV === 'production';
        const cookieDomain = process.env.COOKIE_DOMAIN || 'localhost';

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: isProduction, // HTTPS only in production
            sameSite: isProduction ? 'strict' : 'lax',
            domain: isProduction ? cookieDomain : undefined,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
            path: '/'
        });
    }

    // Clear authentication cookie
    clearAuthCookie(res: Response): void {
        const isProduction = process.env.NODE_ENV === 'production';
        const cookieDomain = process.env.COOKIE_DOMAIN || 'localhost';

        res.clearCookie('auth_token', {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'strict' : 'lax',
            domain: isProduction ? cookieDomain : undefined,
            path: '/'
        });
    }

    // Get current user from request
    getCurrentUser(req: Request): User | null {
        return req.user || null;
    }

    // Check if user is authenticated
    isAuthenticated(req: Request): boolean {
        return !!req.user;
    }
}

// Create middleware functions
export const createAuthMiddleware = (authDB: AuthDatabase) => {
    return new AuthMiddleware(authDB);
}; 