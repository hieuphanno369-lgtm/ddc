import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_STAGE_WEIGHTS, SEED_STAGE_CODES } from '@/lib/stages';
import type { Stage } from '@/server/repo/types';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
  useLocale: () => 'vi',
}));

import { StageWeightEditor } from './StageWeightEditor';

/** 8 giai đoạn seed (P7-C2), tên VI khớp seed thật để test tìm chữ "Thanh quyết toán". */
const STAGE_NAMES_VI: Record<string, string> = {
  design: 'Thiết kế', shop: 'Shop Drawing', procurement: 'Vật tư', fabrication: 'Gia công',
  transport: 'Vận chuyển', erection: 'Lắp dựng', handover: 'Nghiệm thu', settlement: 'Thanh quyết toán',
};
const STAGES: Stage[] = SEED_STAGE_CODES.map((code, i) => ({
  code, nameVi: STAGE_NAMES_VI[code], nameEn: code, sortOrder: i + 1,
  calcMode: 'manual', side: i < 4 ? 'left' : 'right', isActive: true,
}));

describe('StageWeightEditor', () => {
  it('DEFAULT_STAGE_WEIGHTS -> co projectForm.weights.ok', () => {
    const out = renderToStaticMarkup(React.createElement(StageWeightEditor, { value: DEFAULT_STAGE_WEIGHTS, onChange: () => {}, stages: STAGES }));
    expect(out).toContain('projectForm.weights.ok');
  });

  it('tong 99 -> weights.bad', () => {
    const rows = DEFAULT_STAGE_WEIGHTS.map((r, i) => (i === 0 ? { ...r, weightPct: r.weightPct - 1 } : r));
    const out = renderToStaticMarkup(React.createElement(StageWeightEditor, { value: rows, onChange: () => {}, stages: STAGES }));
    expect(out).toContain('projectForm.weights.bad');
  });

  it('tat ca tat -> weights.empty', () => {
    const rows = DEFAULT_STAGE_WEIGHTS.map((r) => ({ ...r, applicable: false }));
    const out = renderToStaticMarkup(React.createElement(StageWeightEditor, { value: rows, onChange: () => {}, stages: STAGES }));
    expect(out).toContain('projectForm.weights.empty');
  });

  it('khong truyen onApplyPreset -> khong co nut weights.applyPreset', () => {
    const out = renderToStaticMarkup(React.createElement(StageWeightEditor, { value: DEFAULT_STAGE_WEIGHTS, onChange: () => {}, stages: STAGES }));
    expect(out).not.toContain('projectForm.weights.applyPreset');
  });

  it("render voi 8 stage -> co 'Thanh quyet toan', dong 0% ap dung van bao weights.ok", () => {
    const out = renderToStaticMarkup(React.createElement(StageWeightEditor, { value: DEFAULT_STAGE_WEIGHTS, onChange: () => {}, stages: STAGES }));
    expect(out).toContain('Thanh quyết toán');
    expect(out).toContain('projectForm.weights.ok');
  });
});
