import type { SchemaMeta } from './build';

/**
 * Sinh khối `erDiagram` (Mermaid) từ `SchemaMeta` - dùng cho `docs/DATA_WAREHOUSE_README.md` mục 1
 * (xem `scripts/gen-erd-doc.ts`). Hàm thuần, thứ tự ổn định theo thứ tự đã sort trong `meta`.
 */

const CARD: Record<'N:1' | '1:1', { required: string; optional: string }> = {
  'N:1': { required: '||--o{', optional: '|o--o{' },
  '1:1': { required: '||--||', optional: '|o--o|' },
};

export function toMermaid(meta: SchemaMeta): string {
  const lines: string[] = ['erDiagram'];

  for (const r of meta.relations) {
    const symbol = CARD[r.kind][r.optional ? 'optional' : 'required'];
    lines.push(`    ${r.toTable} ${symbol} ${r.fromTable} : "${r.fromColumns.join(',')}"`);
  }

  lines.push('');
  for (const t of meta.tables) {
    lines.push(`    ${t.table} {`);
    for (const f of t.fields) {
      const key = f.pk && f.fk ? 'PK,FK' : f.pk ? 'PK' : f.fk ? 'FK' : '';
      const type = `${f.type}${f.isList ? 'Array' : ''}`;
      lines.push(`      ${type} ${f.name}${key ? ` ${key}` : ''}`);
    }
    lines.push('    }');
  }

  return lines.join('\n');
}
