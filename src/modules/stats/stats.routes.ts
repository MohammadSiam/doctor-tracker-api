import { Router, type Request, type Response } from 'express';
import { validate } from '../../middleware/validate.js';
import { timeseriesQuery } from './stats.schema.js';
import * as statsService from './stats.service.js';

export const statsRouter = Router();

statsRouter.get('/overview', async (_req: Request, res: Response) => {
  const data = await statsService.getOverview();
  res.json({ success: true, data });
});

statsRouter.get('/timeseries', validate({ query: timeseriesQuery }), async (_req: Request, res: Response) => {
  const data = await statsService.getTimeseries(res.locals.query.range);
  res.json({ success: true, data });
});
