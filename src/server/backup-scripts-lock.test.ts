import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, existsSync, rmSync } from 'node:fs';
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
