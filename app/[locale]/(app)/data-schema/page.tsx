import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { IMPORT_MAPPING, SCHEMA_ENTITIES, type SchemaEntity, type SchemaKind } from '@/lib/data-schema';
import { IconChevronDown } from '@/components/icons';

const KIND: Record<SchemaKind, { label: string; cls: string }> = {
  dim: { label: 'Dimension', cls: 'chip c-gold' },
  project: { label: 'Hub', cls: 'chip c-info' },
  fact: { label: 'Fact', cls: 'chip c-ok' },
  support: { label: 'Support', cls: 'chip c-plain' },
};

function kindOf(e: SchemaEntity): SchemaKind {
  return e.kind;
}

export default async function DataSchemaPage() {
  // RBAC server-side: trang hệ thống chỉ dành cho admin (không phó mặc middleware).
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') redirect(`/${locale}${homeForRole(user.role)}`);
  const dims = SCHEMA_ENTITIES.filter((e) => e.kind === 'dim');
  const project = SCHEMA_ENTITIES.find((e) => e.kind === 'project')!;
  const facts = SCHEMA_ENTITIES.filter((e) => e.kind === 'fact');
  const support = SCHEMA_ENTITIES.filter((e) => e.kind === 'support');

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3.5">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(KIND) as SchemaKind[]).map((k) => (
          <span key={k} className={KIND[k].cls}>
            <span className="h-2 w-2 rounded-full bg-current opacity-60" />
            {KIND[k].label}
          </span>
        ))}
      </div>

      {/* ERD diagram (star schema) */}
      <div className="card">
        <div className="hd"><h3>Mô hình quan hệ - Star schema</h3></div>
        <div className="bd">
          <p className="hintline">
            Mô hình dữ liệu (ERD) - biết cần field gì và join thế nào khi import, để dữ liệu đúng và không trùng.
          </p>
          <p className="hintline">
            Mọi bảng fact đều trỏ về <code className="mono" style={{ color: 'var(--accent)' }}>projects.id</code> bằng khóa <code className="mono">projectId</code>. Dimension được chuẩn hóa trước khi import.
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
            {/* Dims */}
            <div className="space-y-2">
              <div className="text-caption2 font-bold uppercase tracking-[.025em] text-label3">Dimension (vàng)</div>
              {dims.map((e) => (
                <div key={e.name} className="sumbar" style={{ display: 'block', background: 'rgba(245,179,1,.12)' }}>
                  <div className="mono" style={{ fontWeight: 700 }}>{e.name}</div>
                  <div className="hintline">{e.fields.find((f) => f.key === 'PK')?.name}</div>
                </div>
              ))}
            </div>

            {/* Arrow + hub */}
            <div className="flex flex-col items-center justify-center">
              <div className="hidden text-label3 lg:block">→</div>
              <div className="rounded-sm border-2 border-brand bg-brand-tint px-4 py-3 text-center">
                <div className="mono text-sm font-bold text-brand">{project.name}</div>
                <div className="mt-0.5 text-caption2 text-label2">id (PK)</div>
              </div>
              <div className="mt-2 text-label3 lg:hidden">↓</div>
            </div>

            {/* Facts */}
            <div className="space-y-2">
              <div className="text-caption2 font-bold uppercase tracking-[.025em] text-label3">Fact (navy)</div>
              {facts.map((e) => (
                <div key={e.name} className="sumbar" style={{ display: 'block' }}>
                  <div className="mono" style={{ fontWeight: 700 }}>{e.name}</div>
                  <div className="hintline">projectId → projects.id</div>
                </div>
              ))}
            </div>
          </div>

          {/* Support */}
          <div className="mt-4 border-t border-sep pt-3">
            <div className="text-caption2 font-bold uppercase tracking-[.025em] text-label3">Support (xám) - trỏ về projects.id</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {support.map((e) => (
                <span key={e.name} className="mono rounded-md border border-sep bg-fill px-2 py-1 text-caption2 text-label2">
                  {e.name}
                </span>
              ))}
            </div>
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

      {/* Entity field tables (accordion) */}
      <div className="flex flex-col gap-3">
        <div className="sect"><b>Chi tiết từng bảng</b><i /></div>
        {SCHEMA_ENTITIES.map((e) => (
          <details key={e.name} className="card group">
            <summary className="hd cursor-pointer [&::-webkit-details-marker]:hidden">
              <span className={KIND[kindOf(e)].cls}>
                {KIND[kindOf(e)].label}
              </span>
              <code className="mono">{e.name}</code>
              <span className="ml-auto flex items-center gap-2 text-caption1 text-label3">
                {e.desc}
                <IconChevronDown size={15} className="transition-transform duration-fast group-open:rotate-180" />
              </span>
            </summary>
            <div className="bd">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Type</th>
                    <th>Key</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {e.fields.map((f) => (
                    <tr key={f.name}>
                      <td className="mono">{f.name}</td>
                      <td className="mono text-label3">{f.type}</td>
                      <td>
                        {f.key === 'PK' && <span className="chip c-gold" style={{ fontSize: 10 }}>PK</span>}
                        {f.key === 'FK' && <span className="chip c-info" style={{ fontSize: 10 }}>FK → {f.ref}</span>}
                      </td>
                      <td className="text-label3">{f.desc ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
