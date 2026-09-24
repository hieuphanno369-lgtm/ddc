import { isValidIsoDate } from '@/lib/clock';

/**
 * Chốt chặn cho script seed hiệu năng (Bước 7 P2B): CHỈ chạy trên `ddc_control_tower_b` (DB của
 * B), không bao giờ chạm DB của A (`ddc_control_tower`) hay DB nào khác.
 */
export const PERF_DB = 'ddc_control_tower_b';
export const PERF_PREFIX = 'PERF-';
export const PERF_USER = 'perf-seed'; // audit_log.changedBy, dim_project.createdBy/updatedBy
export const PERF_ACTIVITY_EMAIL = 'perf@seed.local';

/** Ném Error nếu currentDb !== PERF_DB (chặn chạy nhầm DB của A 'ddc_control_tower' hay DB khác). */
export function assertPerfDb(currentDb: string): void {
  if (currentDb !== PERF_DB) {
    throw new Error(
      `perf-guard: dang ket noi database '${currentDb}', KHONG PHAI '${PERF_DB}'. ` +
      'Dung lai - kiem tra DATABASE_URL truoc khi chay script seed hieu nang.',
    );
  }
}

export interface PerfOptions { projects: number; days: number; audit: number; activity: number; end: string; clean: boolean }

function parsePositiveInt(value: string, flag: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${flag} phai la so nguyen duong, nhan '${value}'`);
  }
  return n;
}

/** Đọc argv: --projects=500 --days=730 --audit=1000000 --activity=100000 --end=YYYY-MM-DD --clean-only. */
export function parsePerfArgs(argv: string[], today: string): PerfOptions {
  const opts: PerfOptions = { projects: 500, days: 730, audit: 1_000_000, activity: 100_000, end: today, clean: false };
  for (const arg of argv) {
    if (arg === '--clean-only') {
      opts.clean = true;
      continue;
    }
    const m = /^--([a-z]+)=(.*)$/.exec(arg);
    if (!m) continue;
    const [, key, value] = m;
    if (key === 'projects') opts.projects = parsePositiveInt(value, '--projects');
    else if (key === 'days') opts.days = parsePositiveInt(value, '--days');
    else if (key === 'audit') opts.audit = parsePositiveInt(value, '--audit');
    else if (key === 'activity') opts.activity = parsePositiveInt(value, '--activity');
    else if (key === 'end') {
      if (!isValidIsoDate(value)) throw new Error(`--end phai la ngay hop le 'YYYY-MM-DD', nhan '${value}'`);
      opts.end = value;
    }
  }
  return opts;
}

/** Ước lượng số dòng sẽ sinh (để in trước khi chạy). */
export function estimateRows(o: PerfOptions, contractors: number, shifts: number, equipments: number, stages: number): number {
  return o.projects * (
    1 + 36 * 3 + 36 * stages + contractors + 6
    + contractors * o.days * shifts
    + contractors * equipments * o.days
  ) + o.audit + o.activity;
}
