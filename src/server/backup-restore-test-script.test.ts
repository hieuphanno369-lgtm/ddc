import { describe, expect, it, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * P5-B danh-gia.md B-2 (TB-2) - `scripts/backup/pg-restore-test.sh` ghep ten bang tu file dump
 * (do noi dung file dump quyet dinh) vao SQL khong escape. Cung khuon voi
 * `src/server/backup-scripts-lock.test.ts`: chay THAT script bang `sh`, dung binary gia
 * `createdb`/`dropdb`/`pg_restore`/`psql` dua len dau PATH, khong can Postgres that.
 *
 * `psql` gia doc bien `FAKE_TABLE_NAMES` de tra ve danh sach "ten bang" tuy chinh (doc lap voi
 * noi dung file dump that), va ghi moi lenh no nhan duoc ra 1 file nhat ky (`PSQL_LOG`) de test
 * kiem duoc khong co lenh nao mang chuoi doc hai di chay that.
 */

const SCRIPT = path.resolve(__dirname, '../../scripts/backup/pg-restore-test.sh');
let shAvailable = true;
try {
  execFileSync('sh', ['-c', 'true']);
} catch {
  shAvailable = false;
}

function makeFakeBinDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ddc-fake-bin-restore-'));
  writeFileSync(path.join(dir, 'createdb'), `#!/bin/sh\nexit 0\n`);
  writeFileSync(path.join(dir, 'dropdb'), `#!/bin/sh\nexit 0\n`);
  writeFileSync(
    path.join(dir, 'pg_restore'),
    [
      '#!/bin/sh',
      'for a in "$@"; do',
      '  if [ "$a" = "--list" ]; then',
      '    echo "1; 12345 12345 TABLE public whatever_table postgres"',
      '    exit 0',
      '  fi',
      'done',
      'exit 0',
      '',
    ].join('\n'),
  );
  // `psql` gia: ghi nguyen lenh nhan duoc vao PSQL_LOG, roi tra loi theo noi dung cau SQL
  // (tim trong tham so di sau "-c"/"-tAc") de mo phong tung buoc cua script that.
  writeFileSync(
    path.join(dir, 'psql'),
    [
      '#!/bin/sh',
      'printf "CALL:%s\\n" "$*" >> "$PSQL_LOG"',
      'sql=""',
      'prev=""',
      'for a in "$@"; do',
      '  case "$prev" in',
      '    -c|-tAc) sql="$a" ;;',
      '  esac',
      '  prev="$a"',
      'done',
      'case "$sql" in',
      '  *"finished_at is not null"*) echo 1 ;;',
      '  *"finished_at is null"*) echo 0 ;;',
      '  *"table_name from information_schema.tables"*) printf "%s\\n" "$FAKE_TABLE_NAMES" ;;',
      '  *"information_schema.tables where table_schema="*) echo 1 ;;',
      '  *"count(*) from"*) echo 5 ;;',
      '  *) echo 0 ;;',
      'esac',
      'exit 0',
      '',
    ].join('\n'),
  );
  for (const bin of ['createdb', 'dropdb', 'pg_restore', 'psql']) {
    chmodSync(path.join(dir, bin), 0o755);
  }
  return dir;
}

describe.skipIf(!shAvailable)('scripts/backup/pg-restore-test.sh - khong duoc ghep ten bang tho vao SQL (B-2)', () => {
  let fakeBinDir: string;
  let backupDir: string;
  let dumpFile: string;
  let psqlLog: string;

  function env(fakeTableNames: string) {
    return {
      ...process.env,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
      PGHOST: 'x', PGPORT: '5432', PGUSER: 'ddc', PGPASSWORD: 'x', PGDATABASE: 'demo_test',
      BACKUP_DIR: backupDir,
      FAKE_TABLE_NAMES: fakeTableNames,
      PSQL_LOG: psqlLog,
    };
  }

  afterEach(() => {
    rmSync(fakeBinDir, { recursive: true, force: true });
    rmSync(backupDir, { recursive: true, force: true });
  });

  it('ten bang doc hai (SQL injection) -> thoat 1 voi reason bad_table_name, khong co lenh psql nao chay chuoi doc hai', () => {
    fakeBinDir = makeFakeBinDir();
    backupDir = mkdtempSync(path.join(tmpdir(), 'ddc-restore-dir-bad-'));
    dumpFile = path.join(backupDir, 'demo_test_20260101T000000Z.dump');
    writeFileSync(dumpFile, 'fake-dump');
    psqlLog = path.join(backupDir, 'psql.log');

    const malicious = 'x"; DROP TABLE "user_roles"; --';
    let exitCode: number | null = null;
    let stderr = '';
    try {
      execFileSync('sh', [SCRIPT, dumpFile], { env: env(malicious) });
      exitCode = 0;
    } catch (e) {
      const err = e as { status: number | null; stderr: Buffer };
      exitCode = err.status;
      stderr = err.stderr.toString();
    }

    expect(exitCode).toBe(1);
    expect(stderr).toContain('"reason":"bad_table_name"');

    const log = readFileSync(psqlLog, 'utf8');
    expect(log).not.toContain('DROP TABLE');
    expect(log).not.toContain(malicious);
  });

  it('ten bang hop le -> chay het, in dung dong tong ket restore_test.ok (duong thanh cong)', () => {
    fakeBinDir = makeFakeBinDir();
    backupDir = mkdtempSync(path.join(tmpdir(), 'ddc-restore-dir-ok-'));
    dumpFile = path.join(backupDir, 'demo_test_20260101T000000Z.dump');
    writeFileSync(dumpFile, 'fake-dump');
    psqlLog = path.join(backupDir, 'psql.log');

    const out = execFileSync('sh', [SCRIPT, dumpFile], { env: env('orders'), encoding: 'utf8' });

    expect(out).toContain('orders');
    expect(out).toContain('"event":"restore_test.ok"');
  });
});
