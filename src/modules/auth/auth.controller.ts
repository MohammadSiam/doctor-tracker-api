import type { CookieOptions, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { isProduction } from '../../config/env.js';
import { AUTH_COOKIE, signToken } from '../../middleware/auth.js';
import { UserModel } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  // The frontend proxies /api through its own domain, so the cookie is first-party and Lax is enough.
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const toPublicUser = (user: { _id: unknown; name: string; email: string; role: string }) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
});

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = await UserModel.findOne({ email }).select('+passwordHash').lean();

  // Same message for unknown email and wrong password, so emails cannot be enumerated.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = signToken({ sub: String(user._id), email: user.email, role: user.role });
  res.cookie(AUTH_COOKIE, token, cookieOptions);
  res.json({ success: true, data: toPublicUser(user) });
}

export function logout(_req: Request, res: Response) {
  const { maxAge: _maxAge, ...clearOptions } = cookieOptions;
  res.clearCookie(AUTH_COOKIE, clearOptions);
  res.json({ success: true, data: null });
}

export async function me(req: Request, res: Response) {
  const user = await UserModel.findById(req.user!.sub).lean();
  if (!user) throw ApiError.unauthorized();
  res.json({ success: true, data: toPublicUser(user) });
}
