import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { buildSchemaMeta, type DatamodelLike } from './build';
import { buildErd } from './erd-geometry';
import { ERD_LAYOUT, LOGICAL_JOINS, TABLE_DOCS } from './docs';

const meta = buildSchemaMeta(Prisma.dmmf.datamodel as unknown as DatamodelLike);
const kinds = Object.fromEntries(Object.entries(TABLE_DOCS).map(([k, v]) => [k, v.kind]));
const erd = buildErd(meta, { layout: ERD_LAYOUT, kinds, logical: LOGICAL_JOINS });

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

describe('buildErd', () => {
  it('so boxes = so bang', () => {
    expect(erd.boxes).toHaveLength(meta.tables.length);
  });

  it('so canh lien = meta.relations.length', () => {
    expect(erd.edges.filter((e) => !e.dashed)).toHaveLength(meta.relations.length);
  });

  it('so canh dut = so LOGICAL_JOINS co dich la cot o bang khac', () => {
    const expected = LOGICAL_JOINS.filter((j) => j.from.split('.')[0] !== j.to.split('.')[0]).length;
    expect(erd.edges.filter((e) => e.dashed)).toHaveLength(expected);
  });

  it('khong 2 hop chong nhau', () => {
    for (let i = 0; i < erd.boxes.length; i++) {
      for (let j = i + 1; j < erd.boxes.length; j++) {
        expect(overlaps(erd.boxes[i], erd.boxes[j]), `${erd.boxes[i].table} chong ${erd.boxes[j].table}`).toBe(false);
      }
    }
  });

  it("canh dim_project.factoryId -> dim_factory co toLabel '0..1'", () => {
    const e = erd.edges.find((x) => x.from === 'dim_project' && x.to === 'dim_factory');
    expect(e).toBeDefined();
    expect(e!.toLabel).toBe('0..1');
  });

  it("canh fact_daily_manpower -> dim_shift co fromLabel 'N', toLabel '1'", () => {
    const e = erd.edges.find((x) => x.from === 'fact_daily_manpower' && x.to === 'dim_shift');
    expect(e).toBeDefined();
    expect(e!.fromLabel).toBe('N');
    expect(e!.toLabel).toBe('1');
  });
});
