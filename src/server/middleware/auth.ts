import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthDatabase, User } from '../database/auth';

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
    authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Attach authDB to the request so it's available in protected routes.
        req.authDB = this.authDB;

        try {
            const token = this.extractTokenFromCookies(req) || this.extractTokenFromHeader(req);

            if (!token) {
                res.status(401).json({
                    error: 'Authentication required',
                    code: 'NO_TOKEN'
                });
                return;
            }

            // Check for debug test token first
            if (this.isTestToken(token)) {
                const testUser = await this.getTestUser();
                if (testUser) {
                    req.user = testUser;
                    next();
                    return;
                }
            }

            const jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                console.error('JWT_SECRET not configured');
                res.status(500).json({ error: 'Authentication configuration error' });
                return;
            }

            // Verify JWT token
            const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

            // Check if session exists and is valid
            const session = await this.authDB.getSession(decoded.jti);
            if (!session) {
                res.status(401).json({
                    error: 'Invalid or expired session',
                    code: 'INVALID_SESSION'
                });
                return;
            }

            // Get user from database
            const user = await this.authDB.getUserById(decoded.sub);
            if (!user) {
                res.status(401).json({
                    error: 'User not found',
                    code: 'USER_NOT_FOUND'
                });
                return;
            }

            if (user.status !== 'active') {
                res.status(401).json({
                    error: 'User account is not active',
                    code: 'USER_INACTIVE'
                });
                return;
            }

            // Attach user to request
            req.user = user;
            next();
        } catch (error) {
            if (error instanceof jwt.JsonWebTokenError) {
                res.status(401).json({
                    error: 'Invalid token',
                    code: 'INVALID_TOKEN'
                });
                return;
            }
            if (error instanceof jwt.TokenExpiredError) {
                res.status(401).json({
                    error: 'Token expired',
                    code: 'TOKEN_EXPIRED'
                });
                return;
            }

            console.error('Authentication error:', error);
            res.status(500).json({ error: 'Authentication error' });
            return;
        }
    };

    // Optional authentication - doesn't fail if no token, but attaches user if valid token
    optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const token = this.extractTokenFromCookies(req) || this.extractTokenFromHeader(req);

            if (!token) {
                next(); // Continue without user
                return;
            }

            // Check for debug test token first
            if (this.isTestToken(token)) {
                const testUser = await this.getTestUser();
                if (testUser) {
                    req.user = testUser;
                }
                next();
                return;
            }

            const jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                next(); // Continue without user
                return;
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

    // Extract token from Authorization header (for API testing)
    private extractTokenFromHeader(req: Request): string | null {
        const authHeader = req.headers.authorization;
        if (!authHeader) return null;

        const [type, token] = authHeader.split(' ');
        if (type !== 'Bearer') return null;

        return token;
    }

    // Check if token is the debug test token
    private isTestToken(token: string): boolean {
        const DEBUG_AUTH_TOKEN = 'debug-auth-token-script-writer-dev';
        return token === DEBUG_AUTH_TOKEN;
    }

    // Get the test user for debug authentication
    private async getTestUser(): Promise<User | null> {
        try {
            // First try to get the xiyang user specifically
            const xiyangUser = await this.authDB.getUserByUsername('xiyang');
            if (xiyangUser) {
                return xiyangUser;
            }

            // Fallback to the first available test user
            const testUsers = await this.authDB.getTestUsers();
            if (testUsers.length > 0) {
                return testUsers[0];
            }

            // Fallback: get test-user-1 directly
            return await this.authDB.getUserById('test-user-1');
        } catch (error) {
            console.error('Error getting test user for debug token:', error);
            return null;
        }
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

        return jwt.sign(payload, jwtSecret, { expiresIn } as jwt.SignOptions);
    }

    // Set authentication cookie
    setAuthCookie(res: Response, token: string): void {
        const isProduction = process.env.NODE_ENV === 'production';
        const cookieDomain = process.env.COOKIE_DOMAIN || 'localhost';
        // Allow HTTP in production for testing by setting ALLOW_HTTP_COOKIES=true
        const allowHttp = process.env.ALLOW_HTTP_COOKIES === 'true';

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: isProduction && !allowHttp, // Only require HTTPS if not explicitly allowing HTTP
            sameSite: isProduction && !allowHttp ? 'strict' : 'lax',
            domain: isProduction ? cookieDomain : undefined,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
            path: '/'
        });
    }

    // Clear authentication cookie
    clearAuthCookie(res: Response): void {
        const isProduction = process.env.NODE_ENV === 'production';
        const cookieDomain = process.env.COOKIE_DOMAIN || 'localhost';
        const allowHttp = process.env.ALLOW_HTTP_COOKIES === 'true';

        res.clearCookie('auth_token', {
            httpOnly: true,
            secure: isProduction && !allowHttp,
            sameSite: isProduction && !allowHttp ? 'strict' : 'lax',
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