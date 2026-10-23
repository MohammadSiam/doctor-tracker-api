import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { login, logout, me } from './auth.controller.js';
import { loginSchema } from './auth.schema.js';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later' },
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate({ body: loginSchema }), login);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, me);
