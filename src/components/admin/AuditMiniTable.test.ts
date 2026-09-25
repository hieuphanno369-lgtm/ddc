import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AuditLogEntry } from '@/server/repo/types';
import { AuditMiniTable } from './AuditMiniTable';

(globalThis as unknown as { React: typeof React }).React = React;

const LABELS = { time: 'Thoi gian', user: 'Nguoi dung', table: 'Bang', record: 'Ban ghi', field: 'Truong', empty: 'Khong co du lieu' };

const ROW: AuditLogEntry = {
  id: 1,
  tableName: 'fact_progress_monthly',
  recordId: '42',
  field: 'pctActual',
  oldValue: '30',
  newValue: '45',
  changedBy: 'admin@daidung.com.vn',
  changedAt: '2026-09-23T08:15:00.000Z',
  note: '',
};

describe('AuditMiniTable (P1B Task 6)', () => {
  it('header dung thu tu time, user, table, record, field', () => {
    const out = renderToStaticMarkup(React.createElement(AuditMiniTable, { entries: [ROW], locale: 'vi', labels: LABELS }));
    const heads = [...out.matchAll(/<th>([^<]+)<\/th>/g)].map((m) => m[1]);
    expect(heads).toEqual([LABELS.time, LABELS.user, LABELS.table, LABELS.record, LABELS.field]);
  });

  it('o thoi gian = formatDateTime (co gio:phut)', () => {
    const out = renderToStaticMarkup(React.createElement(AuditMiniTable, { entries: [ROW], locale: 'vi', labels: LABELS }));
    expect(out).toMatch(/class="mono">\d{2}:\d{2} \d{2}\/\d{2}\/\d{4}</);
  });

  it('rong -> hien labels.empty, khong co <table', () => {
    const out = renderToStaticMarkup(React.createElement(AuditMiniTable, { entries: [], locale: 'vi', labels: LABELS }));
    expect(out).toContain(LABELS.empty);
    expect(out).not.toContain('<table');
  });
});
