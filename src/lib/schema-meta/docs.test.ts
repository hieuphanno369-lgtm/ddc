import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { IMPORT_MAPPING } from '@/lib/data-schema';
import { buildSchemaMeta, type DatamodelLike } from './build';
import { ERD_LAYOUT, LOGICAL_JOINS, TABLE_DOCS } from './docs';

const meta = buildSchemaMeta(Prisma.dmmf.datamodel as unknown as DatamodelLike);
const tableNames = meta.tables.map((t) => t.table);

describe('TABLE_DOCS chong lech voi schema that', () => {
  it('moi bang trong meta co TABLE_DOCS', () => {
    for (const name of tableNames) expect(TABLE_DOCS, `thieu TABLE_DOCS['${name}']`).toHaveProperty(name);
  });

  it('khong co bang thua trong TABLE_DOCS', () => {
    const extra = Object.keys(TABLE_DOCS).filter((name) => !tableNames.includes(name));
    expect(extra, `TABLE_DOCS co bang khong ton tai trong schema: ${extra.join(',')}`).toEqual([]);
  });

  it('moi bang trong meta co ERD_LAYOUT, khong 2 bang trung o', () => {
    for (const name of tableNames) expect(ERD_LAYOUT, `thieu ERD_LAYOUT['${name}']`).toHaveProperty(name);
    const seen = new Map<string, string>();
    for (const [name, pos] of Object.entries(ERD_LAYOUT)) {
      const key = `${pos.col}:${pos.row}`;
      expect(seen.has(key), `${name} trung o (${pos.col},${pos.row}) voi ${seen.get(key)}`).toBe(false);
      seen.set(key, name);
    }
  });

  it('moi cot that co mo ta khong rong, khong co cot thua trong TABLE_DOCS', () => {
    for (const t of meta.tables) {
      const doc = TABLE_DOCS[t.table];
      expect(doc, `thieu TABLE_DOCS['${t.table}']`).toBeDefined();
      const realCols = t.fields.map((f) => f.name);
      for (const col of realCols) {
        expect(doc.fields[col], `thieu mo ta ${t.table}.${col}`).toBeTruthy();
      }
      const extraCols = Object.keys(doc.fields).filter((c) => !realCols.includes(c));
      expect(extraCols, `${t.table} co mo ta thua cho cot khong ton tai: ${extraCols.join(',')}`).toEqual([]);
    }
  });
});

describe('LOGICAL_JOINS', () => {
  it('moi from/to dang bang.cot deu ton tai trong schema', () => {
    const fieldSet = new Set(meta.tables.flatMap((t) => t.fields.map((f) => `${t.table}.${f.name}`)));
    for (const j of LOGICAL_JOINS) {
      expect(fieldSet.has(j.from), `LOGICAL_JOINS.from '${j.from}' khong ton tai`).toBe(true);
      expect(fieldSet.has(j.to), `LOGICAL_JOINS.to '${j.to}' khong ton tai`).toBe(true);
    }
  });
});

describe('IMPORT_MAPPING (src/lib/data-schema.ts)', () => {
  it('moi token bang.cot trong targetField deu ton tai trong schema that', () => {
    const fieldSet = new Set(meta.tables.flatMap((t) => t.fields.map((f) => `${t.table}.${f.name}`)));
    const tokenRe = /[a-z_]+\.[a-zA-Z]+/g;
    for (const m of IMPORT_MAPPING) {
      const tokens = m.targetField.match(tokenRe) ?? [];
      expect(tokens.length, `khong trich duoc token bang.cot nao tu '${m.targetField}'`).toBeGreaterThan(0);
      for (const token of tokens) {
        expect(fieldSet.has(token), `IMPORT_MAPPING.targetField token '${token}' khong ton tai`).toBe(true);
      }
    }
  });
});
