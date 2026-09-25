import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { buildSchemaMeta, type DatamodelLike } from './build';

const meta = buildSchemaMeta(Prisma.dmmf.datamodel as unknown as DatamodelLike);

describe('buildSchemaMeta (schema that qua Prisma.dmmf.datamodel)', () => {
  it('so bang = so model', () => {
    expect(meta.tables).toHaveLength(Prisma.dmmf.datamodel.models.length);
  });

  it('co du dim_shift, dim_date, project_equipment_plan, fact_daily_manpower', () => {
    const names = meta.tables.map((t) => t.table);
    expect(names).toEqual(expect.arrayContaining(['dim_shift', 'dim_date', 'project_equipment_plan', 'fact_daily_manpower']));
  });

  it('KHONG con ten cu "customers"/"projects" (da doi ve dim_customer/dim_project)', () => {
    const names = meta.tables.map((t) => t.table);
    expect(names).not.toContain('customers');
    expect(names).not.toContain('projects');
  });

  it('quan he fact_daily_manpower.shiftCode -> dim_shift.code kind N:1, khong optional', () => {
    const r = meta.relations.find((x) => x.fromTable === 'fact_daily_manpower' && x.fromColumns.includes('shiftCode'));
    expect(r).toBeDefined();
    expect(r!.toTable).toBe('dim_shift');
    expect(r!.toColumns).toEqual(['code']);
    expect(r!.kind).toBe('N:1');
    expect(r!.optional).toBe(false);
  });

  it('dim_project.factoryId -> dim_factory.id optional', () => {
    const r = meta.relations.find((x) => x.fromTable === 'dim_project' && x.fromColumns.includes('factoryId'));
    expect(r).toBeDefined();
    expect(r!.toTable).toBe('dim_factory');
    expect(r!.optional).toBe(true);
  });

  it('tu quan he dim_customer.mergedIntoId -> dim_customer.id', () => {
    const r = meta.relations.find((x) => x.fromTable === 'dim_customer' && x.fromColumns.includes('mergedIntoId'));
    expect(r).toBeDefined();
    expect(r!.toTable).toBe('dim_customer');
    expect(r!.toColumns).toEqual(['id']);
  });

  it('PK ghep fact_daily_manpower = 4 cot', () => {
    const t = meta.tables.find((x) => x.table === 'fact_daily_manpower')!;
    expect(t.primaryKey).toHaveLength(4);
    expect(t.primaryKey.sort()).toEqual(['contractorId', 'projectId', 'shiftCode', 'workDate'].sort());
  });
});

describe('buildSchemaMeta (datamodel gia - fixture)', () => {
  it('FK unique (1 cot @unique) -> kind 1:1', () => {
    const fixture: DatamodelLike = {
      models: [
        {
          name: 'Parent', dbName: 'parent', primaryKey: null, uniqueFields: [],
          fields: [
            { name: 'id', kind: 'scalar', type: 'Int', isRequired: true, isList: false, isId: true, isUnique: false, hasDefaultValue: true },
          ],
        },
        {
          name: 'Child', dbName: 'child', primaryKey: null, uniqueFields: [],
          fields: [
            { name: 'id', kind: 'scalar', type: 'Int', isRequired: true, isList: false, isId: true, isUnique: false, hasDefaultValue: true },
            { name: 'parentId', kind: 'scalar', type: 'Int', isRequired: true, isList: false, isId: false, isUnique: true, hasDefaultValue: false },
            {
              name: 'parent', kind: 'object', type: 'Parent', isRequired: true, isList: false, isId: false, isUnique: false, hasDefaultValue: false,
              relationName: 'ChildToParent', relationFromFields: ['parentId'], relationToFields: ['id'],
            },
          ],
        },
      ],
    };
    const m = buildSchemaMeta(fixture);
    const r = m.relations.find((x) => x.fromTable === 'child')!;
    expect(r.kind).toBe('1:1');
    const parentIdField = m.tables.find((t) => t.table === 'child')!.fields.find((f) => f.name === 'parentId')!;
    expect(parentIdField.fk).toEqual({ table: 'parent', column: 'id' });
  });
});
