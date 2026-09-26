import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AuditLogEntry } from '@/server/repo/types';
import { ProjectAuditCard } from './ProjectAuditCard';

(globalThis as unknown as { React: typeof React }).React = React;

const LABELS = {
  title: 'Dấu vết thay đổi', chip: 'append-only', time: 'Thời điểm', user: 'Người sửa',
  table: 'Nội dung', field: 'Trường', old: 'Giá trị cũ', new: 'Giá trị mới', empty: 'Chưa có thay đổi nào',
  note: 'ghi chú',
};
const TABLE_LABELS = { dim_project_alias: 'Mã CT' };

const ROW = (over: Partial<AuditLogEntry>): AuditLogEntry => ({
  id: 1, tableName: 'dim_project_alias', recordId: '1', field: 'aliasCode',
  oldValue: 'A', newValue: 'B', changedBy: 'admin@x', changedAt: '2026-09-16T00:00:00.000Z', note: '',
  ...over,
});

describe('ProjectAuditCard', () => {
  it('cat 160 ky tu, chuoi day du nam o title', () => {
    const long = 'x'.repeat(200);
    const out = renderToStaticMarkup(
      React.createElement(ProjectAuditCard, { entries: [ROW({ newValue: long })], locale: 'vi', labels: LABELS, tableLabels: TABLE_LABELS }),
    );
    expect(out).toContain(`${'x'.repeat(160)}…`);
    expect(out).toContain(`title="${long}"`);
  });

  it('map ten bang qua tableLabels', () => {
    const out = renderToStaticMarkup(
      React.createElement(ProjectAuditCard, { entries: [ROW({})], locale: 'vi', labels: LABELS, tableLabels: TABLE_LABELS }),
    );
    expect(out).toContain('Mã CT');
  });

  it('khong co dong -> trang thai trong', () => {
    const out = renderToStaticMarkup(
      React.createElement(ProjectAuditCard, { entries: [], locale: 'vi', labels: LABELS, tableLabels: TABLE_LABELS }),
    );
    expect(out).toContain('Chưa có thay đổi nào');
  });
});
