export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function getSkip(page: number, limit: number) {
  return (page - 1) * limit;
}

export function buildMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Turns `-createdAt` into `{ createdAt: -1, _id: -1 }`; `_id` keeps paging stable on ties. */
export function parseSort(sort: string): Record<string, 1 | -1> {
  const direction = sort.startsWith('-') ? -1 : 1;
  const field = sort.replace(/^-/, '');
  return { [field]: direction, _id: direction };
}

export function dateRangeFilter(field: string, from?: Date, to?: Date) {
  if (!from && !to) return {};
  const range: Record<string, Date> = {};
  if (from) range.$gte = from;
  if (to) {
    const end = new Date(to);
    end.setUTCHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return { [field]: range };
}
