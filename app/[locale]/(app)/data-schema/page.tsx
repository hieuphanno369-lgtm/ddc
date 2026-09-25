import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { getLocale } from 'next-intl/server';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { IMPORT_MAPPING } from '@/lib/data-schema';
import { buildSchemaMeta, type DatamodelLike } from '@/lib/schema-meta/build';
import { ERD_LAYOUT, LOGICAL_JOINS, TABLE_DOCS, type TableKind } from '@/lib/schema-meta/docs';
import { HEAD_H, LINE_H, PAD, buildErd } from '@/lib/schema-meta/erd-geometry';
import { IconChevronDown } from '@/components/icons';

const KIND: Record<TableKind, { label: string; cls: string }> = {
  dim: { label: 'Dimension', cls: 'chip c-gold' },
  hub: { label: 'Hub', cls: 'chip c-info' },
  fact: { label: 'Fact', cls: 'chip c-ok' },
  support: { label: 'Support', cls: 'chip c-plain' },
  log: { label: 'Log', cls: 'chip c-warn' },
};

const HEADER_FILL: Record<TableKind, string> = {
  dim: 'rgba(245,179,1,.18)',
  hub: 'var(--accent-tint)',
  fact: 'var(--fill)',
  support: 'transparent',
  log: 'transparent',
};

export default async function DataSchemaPage() {
  // RBAC server-side: trang hệ thống chỉ dành cho admin (không phó mặc middleware).
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') redirect(`/${locale}${homeForRole(user.role)}`);

  const meta = buildSchemaMeta(Prisma.dmmf.datamodel as unknown as DatamodelLike);
  const kinds = Object.fromEntries(Object.entries(TABLE_DOCS).map(([k, v]) => [k, v.kind])) as Record<string, TableKind>;
  const erd = buildErd(meta, { layout: ERD_LAYOUT, kinds, logical: LOGICAL_JOINS });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3.5">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(KIND) as TableKind[]).map((k) => (
          <span key={k} className={KIND[k].cls}>
            <span className="h-2 w-2 rounded-full bg-current opacity-60" />
            {KIND[k].label}
          </span>
        ))}
        <span className="hintline">
          nét liền = khoá ngoại thật trong DB, nét đứt = join logic không có FK; N / 1 / 0..1 = cardinality
        </span>
      </div>

      {/* ERD (sinh tu Prisma.dmmf.datamodel) */}
      <div className="card">
        <div className="hd"><h3>Mô hình quan hệ</h3></div>
        <div className="bd">
          <div style={{ overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${erd.width} ${erd.height}`} width={erd.width} height={erd.height} role="img" aria-label="Mô hình quan hệ dữ liệu">
              {erd.edges.map((e, i) => (
                <g key={`${e.from}-${e.to}-${i}`}>
                  <path
                    d={e.path}
                    fill="none"
                    strokeWidth={1.2}
                    strokeDasharray={e.dashed ? '5 4' : undefined}
                    style={{ stroke: 'var(--label3)' }}
                  />
                  <text x={e.fromLabelPos.x} y={e.fromLabelPos.y} fontSize={10} fontWeight={800} style={{ fill: 'var(--label2)' }}>{e.fromLabel}</text>
                  <text x={e.toLabelPos.x} y={e.toLabelPos.y} fontSize={10} fontWeight={800} style={{ fill: 'var(--label2)' }}>{e.toLabel}</text>
                </g>
              ))}
              {erd.boxes.map((b) => (
                <g key={b.table}>
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} style={{ fill: 'var(--glass-3)', stroke: 'var(--sep)' }} />
                  <rect x={b.x} y={b.y} width={b.w} height={HEAD_H} rx={8} style={{ fill: HEADER_FILL[b.kind] }} />
                  <text x={b.x + 8} y={b.y + 17} fontSize={12} fontWeight={700} className="mono" style={{ fill: 'var(--label)' }}>{b.table}</text>
                  {b.keyFields.map((k) => (
                    <text key={k.name} x={b.x + 8} y={b.y + k.y + 4} fontSize={11} className="mono" style={{ fill: 'var(--label2)' }}>
                      {k.name} <tspan style={{ fill: 'var(--label3)' }}>{k.tag}</tspan>
                    </text>
                  ))}
                  {b.moreCount > 0 && (
                    <text
                      x={b.x + 8}
                      y={b.y + HEAD_H + PAD + b.keyFields.length * LINE_H + LINE_H / 2 + 4}
                      fontSize={10.5}
                      style={{ fill: 'var(--label3)' }}
                    >
                      + {b.moreCount} cột
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>

      {/* Import mapping */}
      <div className="card">
        <div className="hd"><h3>Import - khóa ghép & join</h3></div>
        <div className="bd">
          <p className="hintline">
            Quy trình DE: <b>1)</b> normalize dimension (alias/merge) → <b>2)</b> resolve mã ngoài (SAP / mã cũ) về <code className="mono">projectId</code> → <b>3)</b> ghi fact theo <code className="mono">projectId + yearMonth</code> (append-only, import lặp không trùng).
          </p>
          <div className="scroll mt-3">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nguồn (Excel)</th>
                  <th>Field nguồn</th>
                  <th>Field đích (DB)</th>
                  <th>Join</th>
                </tr>
              </thead>
              <tbody>
                {IMPORT_MAPPING.map((m) => (
                  <tr key={m.sourceField}>
                    <td>{m.source}</td>
                    <td style={{ fontWeight: 600 }}>{m.sourceField}</td>
                    <td className="mono" style={{ color: 'var(--accent)' }}>{m.targetField}</td>
                    <td className="mono text-label2">{m.join}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Chi tiet tung bang (accordion) */}
      <div className="flex flex-col gap-3">
        <div className="sect"><b>Chi tiết từng bảng</b><i /></div>
        {meta.tables.map((t) => {
          const doc = TABLE_DOCS[t.table];
          return (
            <details key={t.table} className="card group">
              <summary className="hd cursor-pointer [&::-webkit-details-marker]:hidden">
                <span className={KIND[doc.kind].cls}>{KIND[doc.kind].label}</span>
                <code className="mono">{t.table}</code>
                <span className="ml-auto flex items-center gap-2 text-caption1 text-label3">
                  {doc.desc}
                  <IconChevronDown size={15} className="transition-transform duration-fast group-open:rotate-180" />
                </span>
              </summary>
              <div className="bd">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Type</th>
                      <th>Null</th>
                      <th>Key</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.fields.map((f) => (
                      <tr key={f.name}>
                        <td className="mono">{f.name}</td>
                        <td className="mono text-label3">{f.type}{f.isList ? '[]' : ''}</td>
                        <td>{f.nullable ? '?' : ''}</td>
                        <td>
                          {f.pk && <span className="chip c-gold" style={{ fontSize: 10 }}>PK</span>}
                          {f.fk && (
                            <span className="chip c-info" style={{ fontSize: 10 }}>
                              FK → {f.fk.table}.{f.fk.column}
                            </span>
                          )}
                        </td>
                        <td className="text-label3">{doc.fields[f.name]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
