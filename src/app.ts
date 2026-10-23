import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env, isProduction } from './config/env.js';
import { openApiDocument } from './docs/openapi.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { doctorRouter } from './modules/doctors/doctor.routes.js';
import { patientRouter } from './modules/patients/patient.routes.js';
import { statsRouter } from './modules/stats/stats.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // Render terminates TLS in front of the app
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(morgan(isProduction ? 'combined' : 'dev', { skip: (req) => req.path === '/api/health' }));

  // Public: used by the keep-alive ping and Render's health check.
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down', uptime: process.uptime() });
  });

  // Public API docs: "Try it out" runs on this origin, so the login cookie authenticates the other calls.
  app.get('/', (_req, res) => res.redirect('/api/docs'));
  app.get('/api/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'Doctor Tracker API',
      swaggerOptions: { persistAuthorization: true, withCredentials: true, displayRequestDuration: true },
    }),
  );

  app.use('/api/auth', authRouter);
  app.use('/api/doctors', requireAuth, doctorRouter);
  app.use('/api/patients', requireAuth, patientRouter);
  app.use('/api/stats', requireAuth, statsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
