import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthDatabase } from '../database/auth';
import { AuthMiddleware } from '../middleware/auth';

export const createAuthRoutes = (authDB: AuthDatabase, authMiddleware: AuthMiddleware) => {
    const router = express.Router();

    // POST /auth/login - Handle login for different providers
    router.post('/login', async (req: Request, res: Response) => {
        try {
            const { provider, username, data } = req.body;

            if (!provider || !username) {
                return res.status(400).json({
                    error: 'Provider and username are required',
                    code: 'MISSING_CREDENTIALS'
                });
            }

            let user;

            // Handle different provider types
            switch (provider) {
                case 'dropdown':
                    // For dropdown (test) login, find user by username
                    user = await authDB.getUserByProvider('dropdown', username);
                    if (!user) {
                        return res.status(401).json({
                            error: 'Invalid test user',
                            code: 'INVALID_TEST_USER'
                        });
                    }
                    break;

                default:
                    return res.status(400).json({
                        error: `Unsupported provider: ${provider}`,
                        code: 'UNSUPPORTED_PROVIDER'
                    });
            }

            // Check if user is active
            if (user.status !== 'active') {
                return res.status(401).json({
                    error: 'User account is not active',
                    code: 'USER_INACTIVE'
                });
            }

            // Create session
            const sessionId = uuidv4();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

            await authDB.createSession(sessionId, user.id, expiresAt);

            // Generate JWT token
            const token = authMiddleware.generateToken(user, sessionId);

            // Set authentication cookie
            authMiddleware.setAuthCookie(res, token);

            // Clean up user object for response (remove sensitive data if any)
            const safeUser = {
                id: user.id,
                username: user.username,
                display_name: user.display_name,
                status: user.status
            };

            res.json({
                success: true,
                user: safeUser,
                message: 'Login successful'
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                error: 'Login failed',
                code: 'LOGIN_ERROR'
            });
        }
    });

    // POST /auth/logout - Invalidate JWT token
    router.post('/logout', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            // Extract session ID from the request (it should be in the token)
            const cookies = req.headers.cookie;
            if (cookies) {
                const tokenCookie = cookies
                    .split(';')
                    .find(cookie => cookie.trim().startsWith('auth_token='));

                if (tokenCookie) {
                    const token = tokenCookie.split('=')[1];
                    try {
                        const jwtSecret = process.env.JWT_SECRET;
                        if (jwtSecret) {
                            const jwt = require('jsonwebtoken');
                            const decoded = jwt.verify(token, jwtSecret);

                            // Delete session from database
                            await authDB.deleteSession(decoded.jti);
                        }
                    } catch (error) {
                        // Token might be invalid, but that's ok for logout
                    }
                }
            }

            // Clear authentication cookie
            authMiddleware.clearAuthCookie(res);

            res.json({
                success: true,
                message: 'Logout successful'
            });

        } catch (error) {
            console.error('Logout error:', error);

            // Even if there's an error, clear the cookie
            authMiddleware.clearAuthCookie(res);

            res.status(500).json({
                error: 'Logout failed',
                code: 'LOGOUT_ERROR'
            });
        }
    });

    // GET /auth/me - Get current user info
    router.get('/me', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                return res.status(401).json({
                    error: 'User not found',
                    code: 'USER_NOT_FOUND'
                });
            }

            // Return safe user object
            const safeUser = {
                id: user.id,
                username: user.username,
                display_name: user.display_name,
                status: user.status,
                created_at: user.created_at
            };

            res.json({
                success: true,
                user: safeUser
            });

        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({
                error: 'Failed to get user information',
                code: 'GET_USER_ERROR'
            });
        }
    });

    // GET /auth/test-users - Get list of test users for dropdown
    router.get('/test-users', async (req: Request, res: Response) => {
        try {
            const testUsers = await authDB.getTestUsers();

            // Return safe user objects for dropdown
            const safeUsers = testUsers.map(user => ({
                username: user.username,
                display_name: user.display_name
            }));

            res.json({
                success: true,
                users: safeUsers
            });

        } catch (error) {
            console.error('Get test users error:', error);
            res.status(500).json({
                error: 'Failed to get test users',
                code: 'GET_TEST_USERS_ERROR'
            });
        }
    });

    // GET /auth/status - Check authentication status (optional auth)
    router.get('/status', authMiddleware.optionalAuth, async (req: Request, res: Response) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            const isAuthenticated = authMiddleware.isAuthenticated(req);

            if (isAuthenticated && user) {
                const safeUser = {
                    id: user.id,
                    username: user.username,
                    display_name: user.display_name,
                    status: user.status
                };

                res.json({
                    authenticated: true,
                    user: safeUser
                });
            } else {
                res.json({
                    authenticated: false,
                    user: null
                });
            }

        } catch (error) {
            console.error('Check auth status error:', error);
            res.json({
                authenticated: false,
                user: null
            });
        }
    });

    // POST /auth/refresh - Refresh authentication (extend session)
    router.post('/refresh', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                return res.status(401).json({
                    error: 'User not found',
                    code: 'USER_NOT_FOUND'
                });
            }

            // Create new session
            const sessionId = uuidv4();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

            await authDB.createSession(sessionId, user.id, expiresAt);

            // Generate new JWT token
            const token = authMiddleware.generateToken(user, sessionId);

            // Set new authentication cookie
            authMiddleware.setAuthCookie(res, token);

            res.json({
                success: true,
                message: 'Token refreshed successfully'
            });

        } catch (error) {
            console.error('Token refresh error:', error);
            res.status(500).json({
                error: 'Failed to refresh token',
                code: 'REFRESH_ERROR'
            });
        }
    });

    return router;
}; 