import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { isProduction } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let error: ApiError;

  if (err instanceof ApiError) {
    error = err;
  } else if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    error = ApiError.badRequest('Validation failed', details);
  } else if (err instanceof mongoose.Error.CastError) {
    error = ApiError.badRequest(`Invalid value for ${err.path}`);
  } else if (err?.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
    error = ApiError.conflict(`A record with this ${field} already exists`);
  } else if (err?.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Malformed JSON body');
  } else {
    console.error(err);
    error = new ApiError(500, 'Something went wrong');
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(error.details !== undefined && { details: error.details }),
    ...(!isProduction && error.statusCode === 500 && { stack: err?.stack }),
  });
};
