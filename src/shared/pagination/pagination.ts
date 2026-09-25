import type { PaginationQueryDto } from './pagination.query.dto';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function toOffset({ page, pageSize }: PaginationQueryDto): number {
  return (page - 1) * pageSize;
}

export function toPage<T>(
  items: T[],
  total: number,
  { page, pageSize }: PaginationQueryDto,
): Page<T> {
  return { items, total, page, pageSize };
}
