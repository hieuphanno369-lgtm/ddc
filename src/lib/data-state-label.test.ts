import { describe, expect, it } from 'vitest';
import { dataStateLabel } from './data-state-label';

describe('dataStateLabel', () => {
  it('4 nhánh', () => {
    expect(dataStateLabel({ kind: 'current', month: '2026-09' })).toEqual({ key: 'asOf.month', month: '09/2026' });
    expect(dataStateLabel({ kind: 'carried', month: '2026-08' })).toEqual({ key: 'asOf.carried', month: '08/2026' });
    expect(dataStateLabel({ kind: 'completed', month: '2026-05' })).toEqual({ key: 'asOf.completed', month: '05/2026' });
    expect(dataStateLabel({ kind: 'none', month: null })).toEqual({ key: 'asOf.none', month: '' });
  });
});
