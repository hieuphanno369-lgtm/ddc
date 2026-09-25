import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { buildSchemaMeta, type DatamodelLike } from './build';
import { toMermaid } from './mermaid';

const BEGIN = '<!-- ERD:BEGIN (sinh tu dong: npm run docs:erd) -->';
const END = '<!-- ERD:END -->';

describe('toMermaid', () => {
  const meta = buildSchemaMeta(Prisma.dmmf.datamodel as unknown as DatamodelLike);
  const lines = toMermaid(meta).split('\n').map((l) => l.trim());

  it('co dong dim_shift ||--o{ fact_daily_manpower : "shiftCode"', () => {
    expect(lines).toContain('dim_shift ||--o{ fact_daily_manpower : "shiftCode"');
  });

  it('co dong dim_factory |o--o{ dim_project : "factoryId"', () => {
    expect(lines).toContain('dim_factory |o--o{ dim_project : "factoryId"');
  });
});

describe('docs/DATA_WAREHOUSE_README.md muc 1 (ERD) dong bo voi schema that', () => {
  it('doan giua ERD:BEGIN/ERD:END khop voi toMermaid(...) hien tai', () => {
    const readmePath = resolve(__dirname, '../../../docs/DATA_WAREHOUSE_README.md');
    // Chuan hoa CRLF -> LF: checkout tren Windows (core.autocrlf=true) doi README sang CRLF.
    const content = readFileSync(readmePath, 'utf-8').replace(/\r\n/g, '\n');
    const beginIdx = content.indexOf(BEGIN);
    const endIdx = content.indexOf(END);
    expect(beginIdx, `khong tim thay dau moc ${BEGIN}`).toBeGreaterThan(-1);
    expect(endIdx, `khong tim thay dau moc ${END}`).toBeGreaterThan(-1);

    const actual = content.slice(beginIdx + BEGIN.length, endIdx).trim();
    const meta = buildSchemaMeta(Prisma.dmmf.datamodel as unknown as DatamodelLike);
    const expected = '```mermaid\n' + toMermaid(meta) + '\n```';

    expect(actual, 'README lech voi schema - chay `npm run docs:erd`').toBe(expected);
  });
});
