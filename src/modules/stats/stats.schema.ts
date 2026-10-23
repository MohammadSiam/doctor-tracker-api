import { z } from 'zod';

export const timeseriesQuery = z.object({
  range: z.enum(['7d', '30d', '90d', '12m']).default('30d'),
});

export type TimeseriesRange = z.infer<typeof timeseriesQuery>['range'];
