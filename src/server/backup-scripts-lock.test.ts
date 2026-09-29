import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, existsSync, rmSync, readdirSync, mkdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * P5-B Task 5 - kiem doc lap khoa chong chay trung cua `scripts/backup/pg-backup.sh` BANG CACH
 * CHAY THAT script (khong co Postgres that tren may nay, nen dung binary gia `pg_dump`/`pg_restore`
 * trong 1 thu muc rieng, dua len dau PATH). Day la phan "chua chay that lan nao" ma coder da tu bao
 * o `.bangiao/thay-doi.md` rui ro 1 - tester tu chay de xac nhan doc lap.
 *
 * Bo qua neu may khong co `sh` (POSIX shell) trong PATH.
 */

const SCRIPT = path.resolve(__dirname, '../../scripts/backup/pg-backup.sh');
let shAvailable = true;
try {
  execFileSync('sh', ['-c', 'true']);
} catch {
  shAvailable = false;
}

/**
 * Doanh kha nang gui/bat tin hieu SIGTERM that su trong moi truong dang chay: tren May Windows +
 * Git Bash (MSYS), tien trinh `sh` la mo phong POSIX qua Windows API va viec gui tin hieu tu ben
 * ngoai (ke ca tu chinh Git Bash) thuong KHONG toi duoc trap cua no (da kiem tay, khong bat duoc).
 * Chi chay ca SIGTERM khi moi truong thuc su ho tro, tranh bao do gia do han che he dieu hanh.
 */
function probeSignalDelivery(): boolean {
  if (!shAvailable) return false;
  let dir = '';
  try {
    dir = mkdtempSync(path.join(tmpdir(), 'ddc-sig-probe-'));
    const marker = path.join(dir, 'caught');
    const script = path.join(dir, 'probe.sh');
    writeFileSync(script, `#!/bin/sh\ntrap 'echo x > "${marker}"; exit 0' TERM\nsleep 3\n`);
    chmodSync(script, 0o755);
    const child = spawn('sh', [script]);
    const readyBy = Date.now() + 300;
    while (Date.now() < readyBy) {
      /* cho tien trinh con vao duoc lenh sleep (da dang ky trap) truoc khi gui tin hieu */
    }
    child.kill('SIGTERM');
    const deadline = Date.now() + 1500;
    while (!existsSync(marker) && Date.now() < deadline) {
      /* cho trap chay xong */
    }
    const ok = existsSync(marker);
    try {
      child.kill('SIGKILL');
    } catch {
      /* noop */
    }
    return ok;
  } catch {
    return false;
  } finally {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
}
const signalDeliveryWorks = probeSignalDelivery();

function makeFakeBinDir(sleepSeconds: number): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ddc-fake-bin-'));
  writeFileSync(
    path.join(dir, 'pg_dump'),
    `#!/bin/sh\nfor a in "$@"; do case "$a" in --file=*) f="\${a#--file=}" ;; esac; done\necho fake > "$f"\nsleep ${sleepSeconds}\n`,
  );
  writeFileSync(path.join(dir, 'pg_restore'), `#!/bin/sh\nexit 0\n`);
  chmodSync(path.join(dir, 'pg_dump'), 0o755);
  chmodSync(path.join(dir, 'pg_restore'), 0o755);
  return dir;
}

function waitFor(condFn: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (condFn()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('timeout cho dieu kien'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

describe.skipIf(!shAvailable)('scripts/backup/pg-backup.sh - khoa chong chay trung (chay that qua binary gia)', () => {
  let fakeBinDir: string;

  beforeAll(() => {
    fakeBinDir = makeFakeBinDir(3);
  });

  afterAll(() => {
    rmSync(fakeBinDir, { recursive: true, force: true });
  });

  function env(backupDir: string) {
    return {
      ...process.env,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
      PGHOST: 'x', PGPORT: '5432', PGUSER: 'x', PGPASSWORD: 'x', PGDATABASE: 'demo_test',
      BACKUP_DIR: backupDir,
    };
  }

  it(
    'tien trinh thua khoa (thoat ma 3) KHONG duoc xoa khoa cua tien trinh dang giu (rui ro coder da tu neu)',
    async () => {
      const backupDir = mkdtempSync(path.join(tmpdir(), 'ddc-backup-dir-'));
      const lockDir = path.join(backupDir, '.lock');

      const child = spawn('sh', [SCRIPT], { env: env(backupDir) });
      await waitFor(() => existsSync(lockDir), 2000);
      expect(existsSync(lockDir)).toBe(true);

      // Tien trinh B chay trong luc A dang giu khoa -> phai thoat ma 3.
      let bExitCode: number | null = null;
      try {
        execFileSync('sh', [SCRIPT], { env: env(backupDir) });
        bExitCode = 0;
      } catch (e) {
        bExitCode = (e as { status: number | null }).status;
      }
      expect(bExitCode).toBe(3);

      // Hanh vi DUNG phai la: khoa VAN CON TON TAI ngay sau khi B thoat, vi A van dang chay.
      expect(existsSync(lockDir)).toBe(true);

      await new Promise((resolve) => child.on('exit', resolve));
    },
    10000,
  );
});

/**
 * P5-B Task 5 (vong 2, sau khi debugger doi cho `trap cleanup EXIT` xuong SAU khoi mkdir): xac nhan
 * ban va KHONG lam hong logic don dep binh thuong (khong tranh chap) - tien trinh THAT SU gianh duoc
 * khoa van phai tu xoa dung `.lock` + `.partial` cua chinh no, ca khi thanh cong lan khi loi giua
 * chung (o day mo phong bang `pg_restore --list` that bai - nhanh "corrupt_dump" cua script).
 */
describe.skipIf(!shAvailable)(
  'scripts/backup/pg-backup.sh - don dep khoa/.partial cho tien trinh THAT SU giu khoa (khong tranh chap)',
  () => {
    function makeConfigurableFakeBinDir(): string {
      const dir = mkdtempSync(path.join(tmpdir(), 'ddc-fake-bin-2-'));
      writeFileSync(
        path.join(dir, 'pg_dump'),
        `#!/bin/sh\nfor a in "$@"; do case "$a" in --file=*) f="\${a#--file=}" ;; esac; done\necho fake > "$f"\nexit "\${FAKE_PG_DUMP_EXIT:-0}"\n`,
      );
      writeFileSync(path.join(dir, 'pg_restore'), `#!/bin/sh\nexit "\${FAKE_PG_RESTORE_EXIT:-0}"\n`);
      chmodSync(path.join(dir, 'pg_dump'), 0o755);
      chmodSync(path.join(dir, 'pg_restore'), 0o755);
      return dir;
    }

    function baseEnv(fakeBinDir: string, backupDir: string, extra: Record<string, string>) {
      return {
        ...process.env,
        PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
        PGHOST: 'x', PGPORT: '5432', PGUSER: 'x', PGPASSWORD: 'x', PGDATABASE: 'demo_test',
        BACKUP_DIR: backupDir,
        ...extra,
      };
    }

    it('thanh cong: khoa .lock va file .partial khong con, chi con lai .dump + .sha256', () => {
      const fakeBinDir = makeConfigurableFakeBinDir();
      const backupDir = mkdtempSync(path.join(tmpdir(), 'ddc-backup-dir-ok-'));
      try {
        execFileSync('sh', [SCRIPT], {
          env: baseEnv(fakeBinDir, backupDir, { FAKE_PG_DUMP_EXIT: '0', FAKE_PG_RESTORE_EXIT: '0' }),
        });

        expect(existsSync(path.join(backupDir, '.lock'))).toBe(false);
        const files = readdirSync(backupDir);
        expect(files.some((f) => f.endsWith('.partial'))).toBe(false);
        expect(files.some((f) => f.startsWith('demo_test_') && f.endsWith('.dump'))).toBe(true);
        expect(files.some((f) => f.endsWith('.dump.sha256'))).toBe(true);
      } finally {
        rmSync(fakeBinDir, { recursive: true, force: true });
        rmSync(backupDir, { recursive: true, force: true });
      }
    }, 10000);

    it('loi giua chung (pg_restore --list that bai): van xoa .lock va .partial, KHONG tao ra file .dump cuoi', () => {
      const fakeBinDir = makeConfigurableFakeBinDir();
      const backupDir = mkdtempSync(path.join(tmpdir(), 'ddc-backup-dir-fail-'));
      try {
        let exitCode: number | null = null;
        try {
          execFileSync('sh', [SCRIPT], {
            env: baseEnv(fakeBinDir, backupDir, { FAKE_PG_DUMP_EXIT: '0', FAKE_PG_RESTORE_EXIT: '1' }),
          });
          exitCode = 0;
        } catch (e) {
          exitCode = (e as { status: number | null }).status;
        }
        expect(exitCode).toBe(1);

        expect(existsSync(path.join(backupDir, '.lock'))).toBe(false);
        const files = readdirSync(backupDir);
        expect(files.some((f) => f.endsWith('.partial'))).toBe(false);
        expect(files.some((f) => f.startsWith('demo_test_') && f.endsWith('.dump') && !f.endsWith('.partial'))).toBe(
          false,
        );
      } finally {
        rmSync(fakeBinDir, { recursive: true, force: true });
        rmSync(backupDir, { recursive: true, force: true });
      }
    }, 10000);
  },
);

/**
 * P5-B danh-gia.md B-3 - khoa `.lock` cu (stale) phai tu don thay vi ket vinh vien, va tin hieu
 * ket thuc binh thuong (SIGTERM/SIGINT/SIGHUP) phai don duoc `.lock` + `.partial` qua duong trap EXIT.
 */
describe.skipIf(!shAvailable)(
  'scripts/backup/pg-backup.sh - khoa cu (stale lock) va tin hieu ket thuc (B-3)',
  () => {
    function env(fakeBinDir: string, backupDir: string) {
      return {
        ...process.env,
        PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
        PGHOST: 'x', PGPORT: '5432', PGUSER: 'x', PGPASSWORD: 'x', PGDATABASE: 'demo_test',
        BACKUP_DIR: backupDir,
      };
    }

    it('.lock qua cu (hon nguong) duoc tu don, script chay thanh cong va log stale_lock_removed', () => {
      const fakeBinDir = makeFakeBinDir(0);
      const backupDir = mkdtempSync(path.join(tmpdir(), 'ddc-backup-dir-stale-'));
      const lockDir = path.join(backupDir, '.lock');
      try {
        mkdirSync(lockDir);
        const oldTime = new Date(Date.now() - 7 * 60 * 60 * 1000); // 7h truoc, vuot nguong 6h
        utimesSync(lockDir, oldTime, oldTime);

        const out = execFileSync('sh', [SCRIPT], { env: env(fakeBinDir, backupDir), encoding: 'utf8' });
        expect(out).toContain('"event":"backup.stale_lock_removed"');
        expect(existsSync(lockDir)).toBe(false);
      } finally {
        rmSync(fakeBinDir, { recursive: true, force: true });
        rmSync(backupDir, { recursive: true, force: true });
      }
    }, 10000);

    it('.lock con moi (trong nguong) van coi la dang chay, thoat ma 3 nhu cu', () => {
      const fakeBinDir = makeFakeBinDir(0);
      const backupDir = mkdtempSync(path.join(tmpdir(), 'ddc-backup-dir-fresh-lock-'));
      const lockDir = path.join(backupDir, '.lock');
      try {
        mkdirSync(lockDir); // mtime = bay gio, trong nguong 6h

        let exitCode: number | null = null;
        try {
          execFileSync('sh', [SCRIPT], { env: env(fakeBinDir, backupDir) });
          exitCode = 0;
        } catch (e) {
          exitCode = (e as { status: number | null }).status;
        }
        expect(exitCode).toBe(3);
        expect(existsSync(lockDir)).toBe(true);
      } finally {
        rmSync(fakeBinDir, { recursive: true, force: true });
        rmSync(backupDir, { recursive: true, force: true });
      }
    }, 10000);

    it.skipIf(!signalDeliveryWorks)(
      'nhan SIGTERM giua luc pg_dump dang "ngu": .lock va .partial duoc don sach sau khi tien trinh chet',
      async () => {
        const fakeBinDir = makeFakeBinDir(5);
        const backupDir = mkdtempSync(path.join(tmpdir(), 'ddc-backup-dir-sigterm-'));
        const lockDir = path.join(backupDir, '.lock');
        try {
          const child = spawn('sh', [SCRIPT], { env: env(fakeBinDir, backupDir) });
          await waitFor(() => existsSync(lockDir), 2000);
          await waitFor(() => readdirSync(backupDir).some((f) => f.endsWith('.partial')), 2000);

          child.kill('SIGTERM');
          await new Promise((resolve) => child.on('exit', resolve));

          expect(existsSync(lockDir)).toBe(false);
          expect(readdirSync(backupDir).some((f) => f.endsWith('.partial'))).toBe(false);
        } finally {
          rmSync(fakeBinDir, { recursive: true, force: true });
          rmSync(backupDir, { recursive: true, force: true });
        }
      },
      10000,
    );
  },
);
