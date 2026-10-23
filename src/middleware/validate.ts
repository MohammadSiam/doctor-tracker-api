import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../utils/ApiError.js';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates and coerces the request. In Express 5 `req.query` is read-only, so parsed
 * query and params are stored on `res.locals` and read from there by the controllers.
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, res, next) => {
    const issues: { path: string; message: string }[] = [];

    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key] ?? {});
      if (result.success) {
        if (key === 'body') req.body = result.data;
        else res.locals[key] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({ path: [key, ...issue.path].join('.'), message: issue.message });
        }
      }
    }

    if (issues.length > 0) return next(ApiError.badRequest('Validation failed', issues));
    next();
  };
