/**
 * Đọc `Prisma.dmmf.datamodel` (sinh từ `schema.prisma`) thành siêu dữ liệu dùng cho ERD (T4) -
 * không viết tay danh sách bảng/cột nữa, tránh lệch khi schema đổi.
 */

export interface MetaField {
  name: string;
  type: string; // 'Int' | 'String' | 'DateTime' | 'Date' (@db.Date) | tên enum
  nullable: boolean;
  isList: boolean;
  pk: boolean;
  unique: boolean;
  hasDefault: boolean;
  fk: { table: string; column: string } | null;
}
export interface MetaTable { model: string; table: string; fields: MetaField[]; primaryKey: string[] }
export interface MetaRelation {
  name: string; fromTable: string; fromColumns: string[]; toTable: string; toColumns: string[];
  kind: 'N:1' | '1:1'; optional: boolean; onDelete: string | null;
}
export interface SchemaMeta { tables: MetaTable[]; relations: MetaRelation[] }

/** Kiểu tối thiểu, khớp cấu trúc Prisma.dmmf.datamodel (Prisma 6: model.dbName, model.primaryKey, field.kind/relationFromFields…). */
export interface DatamodelLike {
  models: readonly {
    name: string; dbName: string | null;
    primaryKey: { fields: readonly string[] } | null;
    uniqueFields: readonly (readonly string[])[];
    fields: readonly {
      name: string; kind: string; type: string; isRequired: boolean; isList: boolean; isId: boolean;
      isUnique: boolean; hasDefaultValue: boolean; nativeType?: readonly [string, readonly string[]] | null;
      relationName?: string; relationFromFields?: readonly string[]; relationToFields?: readonly string[]; relationOnDelete?: string;
    }[];
  }[];
}

type DmField = DatamodelLike['models'][number]['fields'][number];
type DmModel = DatamodelLike['models'][number];

function fieldType(f: DmField): string {
  if (f.kind === 'enum') return f.type;
  if (f.type === 'DateTime' && f.nativeType?.[0] === 'Date') return 'Date';
  return f.type;
}

function modelPkFields(m: DmModel): string[] {
  if (m.primaryKey) return [...m.primaryKey.fields];
  return m.fields.filter((f) => f.isId).map((f) => f.name);
}

function sameColumnSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((c) => b.includes(c));
}

export function buildSchemaMeta(dm: DatamodelLike): SchemaMeta {
  const tables: MetaTable[] = dm.models.map((m) => {
    const pkFields = modelPkFields(m);
    const fields: MetaField[] = m.fields
      .filter((f) => f.kind === 'scalar' || f.kind === 'enum')
      .map((f) => ({
        name: f.name,
        type: fieldType(f),
        nullable: !f.isRequired,
        isList: f.isList,
        pk: f.isId || pkFields.includes(f.name),
        unique: f.isUnique || m.uniqueFields.some((uf) => uf.length === 1 && uf[0] === f.name),
        hasDefault: f.hasDefaultValue,
        fk: null,
      }));
    return { model: m.name, table: m.dbName ?? m.name, fields, primaryKey: pkFields };
  });
  const tableByTableName = new Map(tables.map((t) => [t.table, t]));

  const relations: MetaRelation[] = [];
  for (const m of dm.models) {
    const fromTable = m.dbName ?? m.name;
    const pkFields = modelPkFields(m);
    for (const f of m.fields) {
      if (f.kind !== 'object') continue;
      if (!f.relationFromFields || f.relationFromFields.length === 0) continue; // phía không giữ FK
      const targetModel = dm.models.find((x) => x.name === f.type);
      if (!targetModel) continue;
      const toTable = targetModel.dbName ?? targetModel.name;
      const fromColumns = [...f.relationFromFields];
      const toColumns = [...(f.relationToFields ?? [])];

      const singleUnique = fromColumns.length === 1
        && m.fields.some((x) => x.name === fromColumns[0] && x.isUnique);
      const compositeUnique = m.uniqueFields.some((uf) => sameColumnSet(uf, fromColumns));
      const isFullPk = sameColumnSet(pkFields, fromColumns);
      const kind: MetaRelation['kind'] = (singleUnique || compositeUnique || isFullPk) ? '1:1' : 'N:1';
      const optional = fromColumns.some((c) => !m.fields.find((x) => x.name === c)?.isRequired);

      relations.push({
        name: f.relationName ?? `${fromTable}_${f.name}`,
        fromTable, fromColumns, toTable, toColumns, kind, optional,
        onDelete: f.relationOnDelete ?? null,
      });

      const fromTableMeta = tableByTableName.get(fromTable);
      if (fromTableMeta) {
        fromColumns.forEach((col, i) => {
          const fld = fromTableMeta.fields.find((x) => x.name === col);
          if (fld) fld.fk = { table: toTable, column: toColumns[i] ?? '' };
        });
      }
    }
  }

  tables.sort((a, b) => a.table.localeCompare(b.table));
  relations.sort((a, b) =>
    a.fromTable.localeCompare(b.fromTable) || a.fromColumns.join(',').localeCompare(b.fromColumns.join(',')));

  return { tables, relations };
}
