import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { IMPORT_MAPPING, SCHEMA_ENTITIES, type SchemaEntity, type SchemaKind } from '@/lib/data-schema';
import { IconChevronDown } from '@/components/icons';

const KIND: Record<SchemaKind, { label: string; cls: string }> = {
  dim: { label: 'Dimension', cls: 'bg-gold-soft text-gold ring-gold/30' },
  project: { label: 'Hub', cls: 'bg-accent-soft text-accent ring-accent/30' },
  fact: { label: 'Fact', cls: 'bg-navy-50 text-navy-700 ring-navy-500/20' },
  support: { label: 'Support', cls: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
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
  const t = await getTranslations();
  const dims = SCHEMA_ENTITIES.filter((e) => e.kind === 'dim');
  const project = SCHEMA_ENTITIES.find((e) => e.kind === 'project')!;
  const facts = SCHEMA_ENTITIES.filter((e) => e.kind === 'fact');
  const support = SCHEMA_ENTITIES.filter((e) => e.kind === 'support');

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-navy-900">{t('nav.dataSchema')}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Mô hình dữ liệu (ERD) - biết cần field gì và join thế nào khi import, để dữ liệu đúng và không trùng.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(Object.keys(KIND) as SchemaKind[]).map((k) => (
          <span key={k} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ${KIND[k].cls}`}>
            <span className="h-2 w-2 rounded-full bg-current opacity-60" />
            {KIND[k].label}
          </span>
        ))}
      </div>

      {/* ERD diagram (star schema) */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-navy-900">Mô hình quan hệ - Star schema</h2>
        <p className="mt-1 text-xs text-slate-500">
          Mọi bảng fact đều trỏ về <code className="font-mono text-accent">projects.id</code> bằng khóa <code className="font-mono">projectId</code>. Dimension được chuẩn hóa trước khi import.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
          {/* Dims */}
          <div className="space-y-2">
            <div className="label">Dimension (vàng)</div>
            {dims.map((e) => (
              <div key={e.name} className="rounded-lg border border-slate-200 bg-gold-soft/40 px-3 py-2">
                <div className="font-mono text-xs font-semibold text-navy-800">{e.name}</div>
                <div className="text-[11px] text-slate-500">{e.fields.find((f) => f.key === 'PK')?.name}</div>
              </div>
            ))}
          </div>

          {/* Arrow + hub */}
          <div className="flex flex-col items-center justify-center">
            <div className="hidden text-slate-300 lg:block">→</div>
            <div className="rounded-lg border-2 border-accent bg-accent-soft px-4 py-3 text-center">
              <div className="font-mono text-sm font-bold text-accent">{project.name}</div>
              <div className="mt-0.5 text-[11px] text-navy-700">id (PK)</div>
            </div>
            <div className="mt-2 text-slate-300 lg:hidden">↓</div>
          </div>

          {/* Facts */}
          <div className="space-y-2">
            <div className="label">Fact (navy)</div>
            {facts.map((e) => (
              <div key={e.name} className="rounded-lg border border-slate-200 bg-navy-50/60 px-3 py-2">
                <div className="font-mono text-xs font-semibold text-navy-800">{e.name}</div>
                <div className="text-[11px] text-slate-500">projectId → projects.id</div>
              </div>
            ))}
          </div>
        </div>

        {/* Support */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="label">Support (xám) - trỏ về projects.id</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {support.map((e) => (
              <span key={e.name} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600">
                {e.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Import mapping */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-navy-900">Import - khóa ghép & join</h2>
        <p className="mt-1 text-xs text-slate-500">
          Quy trình DE: <b>1)</b> normalize dimension (alias/merge) → <b>2)</b> resolve mã ngoài (SAP / mã cũ) về <code className="font-mono">projectId</code> → <b>3)</b> ghi fact theo <code className="font-mono">projectId + yearMonth</code> (append-only, import lặp không trùng).
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="py-1.5 font-medium">Nguồn (Excel)</th>
                <th className="py-1.5 font-medium">Field nguồn</th>
                <th className="py-1.5 font-medium">Field đích (DB)</th>
                <th className="py-1.5 font-medium">Join</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {IMPORT_MAPPING.map((m) => (
                <tr key={m.sourceField}>
                  <td className="py-2 pr-2 text-xs text-slate-500">{m.source}</td>
                  <td className="py-2 pr-2 text-xs font-medium text-navy-800">{m.sourceField}</td>
                  <td className="py-2 pr-2 font-mono text-xs text-accent">{m.targetField}</td>
                  <td className="py-2 font-mono text-xs text-slate-600">{m.join}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Entity field tables (accordion) */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-navy-900">Chi tiết từng bảng</h2>
        {SCHEMA_ENTITIES.map((e) => (
          <details key={e.name} className="card group overflow-hidden">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-3.5 text-sm font-semibold text-navy-900 [&::-webkit-details-marker]:hidden">
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] ring-1 ${KIND[kindOf(e)].cls}`}>
                {KIND[kindOf(e)].label}
              </span>
              <code className="font-mono">{e.name}</code>
              <span className="ml-auto flex items-center gap-2 text-xs font-normal text-slate-400">
                {e.desc}
                <IconChevronDown size={15} className="transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="px-5 pb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-400">
                    <th className="py-1 font-medium">Field</th>
                    <th className="py-1 font-medium">Type</th>
                    <th className="py-1 font-medium">Key</th>
                    <th className="py-1 font-medium">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {e.fields.map((f) => (
                    <tr key={f.name}>
                      <td className="py-1.5 pr-2 font-mono text-xs text-navy-800">{f.name}</td>
                      <td className="py-1.5 pr-2 font-mono text-xs text-slate-500">{f.type}</td>
                      <td className="py-1.5 pr-2">
                        {f.key === 'PK' && <span className="rounded bg-gold-soft px-1.5 py-0.5 text-[10px] font-semibold text-gold">PK</span>}
                        {f.key === 'FK' && <span className="rounded bg-navy-50 px-1.5 py-0.5 text-[10px] font-semibold text-navy-600">FK → {f.ref}</span>}
                      </td>
                      <td className="py-1.5 text-xs text-slate-500">{f.desc ?? ''}</td>
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
