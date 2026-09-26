import { Prisma } from '@prisma/client';
import { getLocale } from 'next-intl/server';
import { requireUser } from '@/lib/require-user';
import { DATA_DICTIONARY } from '@/lib/data-dictionary';
import { buildSchemaMeta, type DatamodelLike } from '@/lib/schema-meta/build';
import { LOGICAL_JOINS, TABLE_DOCS, type TableKind } from '@/lib/schema-meta/docs';
import { IconChevronDown } from '@/components/icons';

const KIND_ORDER: TableKind[] = ['hub', 'dim', 'fact', 'support', 'log'];
const KIND_LABEL: Record<TableKind, string> = {
  hub: 'Hub', dim: 'Dimension', fact: 'Fact', support: 'Support', log: 'Log',
};

export default async function DataDictionaryPage() {
  // RBAC server-side: trang hệ thống chỉ dành cho admin (không phó mặc middleware).
  const locale = await getLocale();
  await requireUser(locale, ['admin']);
  const isVi = locale === 'vi';

  const meta = buildSchemaMeta(Prisma.dmmf.datamodel as unknown as DatamodelLike);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3.5">
      <div className="card">
        <div className="bd">
          <p className="hintline">
            {isVi
              ? 'Giải thích ý nghĩa + công thức từng field, cách đọc chart và cách dùng What-if - cho người không chuyên.'
              : 'Meaning + formula of every field, how to read each chart, and how to use What-if - for non-technical users.'}
          </p>
        </div>
      </div>

      {DATA_DICTIONARY.map((section, si) => (
        <details key={si} className="card group">
          <summary className="hd cursor-pointer [&::-webkit-details-marker]:hidden">
            <span>{isVi ? section.titleVi : section.titleEn}</span>
            <IconChevronDown size={16} className="shrink-0 text-label3 transition-transform duration-fast group-open:rotate-180" />
          </summary>
          <div className="bd flex flex-col gap-2.5">
            {section.entries.map((e, ei) => (
              <div key={ei} className="sumbar" style={{ display: 'block' }}>
                <div className="text-footnote font-semibold text-label">
                  {isVi ? e.fieldVi : e.fieldEn}
                </div>
                <p className="mt-1 text-caption1 leading-relaxed text-label2">
                  {isVi ? e.meaningVi : e.meaningEn}
                </p>
                {(isVi ? e.formulaVi : e.formulaEn) && (
                  <p className="mono mt-1.5" style={{ color: 'var(--ok)' }}>
                    {isVi ? e.formulaVi : e.formulaEn}
                  </p>
                )}
              </div>
            ))}
          </div>
        </details>
      ))}

      {/* Tu dien bang du lieu - sinh tu Prisma.dmmf.datamodel, mo ta luon tieng Viet ca 2 locale
          (giong quy uoc /data-schema hien tai). */}
      <div className="sect">
        <b>{isVi ? 'Từ điển bảng dữ liệu (sinh từ schema)' : 'Table dictionary (generated from schema)'}</b>
        <i />
      </div>

      {KIND_ORDER.map((kind) => {
        const tables = meta.tables.filter((t) => (TABLE_DOCS[t.table]?.kind ?? 'support') === kind);
        if (tables.length === 0) return null;
        return (
          <div key={kind} className="flex flex-col gap-3">
            <div className="text-caption2 font-bold uppercase tracking-[.025em] text-label3">{KIND_LABEL[kind]}</div>
            {tables.map((t) => {
              const doc = TABLE_DOCS[t.table];
              const outgoing = meta.relations.filter((r) => r.fromTable === t.table);
              const incoming = meta.relations.filter((r) => r.toTable === t.table);
              const logical = LOGICAL_JOINS.filter((j) => j.from.startsWith(`${t.table}.`) || j.to.startsWith(`${t.table}.`));
              const hasJoins = outgoing.length > 0 || incoming.length > 0 || logical.length > 0;
              return (
                <details key={t.table} className="card group">
                  <summary className="hd cursor-pointer [&::-webkit-details-marker]:hidden">
                    <code className="mono">{t.table}</code>
                    <span className="ml-auto flex items-center gap-2 text-caption1 text-label3">
                      {doc.desc}
                      <IconChevronDown size={15} className="shrink-0 text-label3 transition-transform duration-fast group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="bd flex flex-col gap-3">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Kiểu</th>
                          <th>Bắt buộc</th>
                          <th>Khoá</th>
                          <th>Ý nghĩa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.fields.map((f) => (
                          <tr key={f.name}>
                            <td className="mono">{f.name}</td>
                            <td className="mono text-label3">{f.type}{f.isList ? '[]' : ''}</td>
                            <td>{f.nullable ? '-' : '✓'}</td>
                            <td className="mono text-label3">{[f.pk ? 'PK' : null, f.fk ? 'FK' : null].filter(Boolean).join(', ') || '-'}</td>
                            <td className="text-label3">{doc.fields[f.name]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {hasJoins && (
                      <div>
                        <div className="text-caption2 font-bold uppercase tracking-[.025em] text-label3">Join</div>
                        <ul className="mt-1 flex flex-col gap-1">
                          {outgoing.map((r, i) => (
                            <li key={`o${i}`} className="mono text-caption1 text-label2">
                              {r.fromColumns.join(',')} → {r.toTable}.{r.toColumns.join(',')} ({r.kind}, xoá: {r.onDelete ?? '-'})
                            </li>
                          ))}
                          {incoming.map((r, i) => (
                            <li key={`i${i}`} className="mono text-caption1 text-label2">
                              {r.fromTable}.{r.fromColumns.join(',')} → {r.toColumns.join(',')}
                            </li>
                          ))}
                          {logical.map((j, i) => (
                            <li key={`l${i}`} className="mono text-caption1 text-label2">{j.from} → {j.to} (join logic)</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
