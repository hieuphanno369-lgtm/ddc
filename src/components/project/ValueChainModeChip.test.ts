import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StageSelectionContext, StageSelectionProvider } from './StageSelectionContext';
import { ValueChainModeChip } from './ValueChainModeChip';

(globalThis as unknown as { React: typeof React }).React = React;

/**
 * Vong sua 1 muc 4d (danh-gia.md): chip goc the "Chuoi gia tri" phai doi ten theo giai doan dang
 * chon o StageExplorer (StageSelectionContext dung chung). Bom thang `value` qua Context.Provider
 * thay vi mo phong click (repo khong dung @testing-library, chi renderToStaticMarkup - xem
 * StageExplorer.test.ts, KpiCard.test.ts).
 */
const STAGE_LABELS = {
  design: 'Thiết kế', shop: 'Shop Drawing', procurement: 'Vật tư', fabrication: 'Gia công',
  transport: 'Vận chuyển', erection: 'Lắp dựng', handover: 'Nghiệm thu & BG',
} as const;

describe('ValueChainModeChip', () => {
  it('chua chon giai doan nao (selected=null, vd ngoai Provider) -> hien allStagesLabel', () => {
    const out = renderToStaticMarkup(
      React.createElement(ValueChainModeChip, { allStagesLabel: 'Toàn bộ 7 giai đoạn', stageLabels: STAGE_LABELS }),
    );
    expect(out).toContain('Toàn bộ 7 giai đoạn');
    expect(out).not.toContain('Shop Drawing');
  });

  it('trong StageSelectionProvider nhung chua bam chon -> van la allStagesLabel (selected mac dinh null)', () => {
    const out = renderToStaticMarkup(
      React.createElement(
        StageSelectionProvider,
        null,
        React.createElement(ValueChainModeChip, { allStagesLabel: 'Toàn bộ 7 giai đoạn', stageLabels: STAGE_LABELS }),
      ),
    );
    expect(out).toContain('Toàn bộ 7 giai đoạn');
  });

  it('da chon 1 giai doan (vd StageExplorer da bam "shop") -> chip doi thanh ten giai doan do', () => {
    const out = renderToStaticMarkup(
      React.createElement(
        StageSelectionContext.Provider,
        { value: { selected: 'shop', toggle: () => {} } },
        React.createElement(ValueChainModeChip, { allStagesLabel: 'Toàn bộ 7 giai đoạn', stageLabels: STAGE_LABELS }),
      ),
    );
    expect(out).toContain('Shop Drawing');
    expect(out).not.toContain('Toàn bộ 7 giai đoạn');
  });
});
