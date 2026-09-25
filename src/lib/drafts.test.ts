import { describe, expect, it } from 'vitest';
import { clearAllDrafts, clearDraftsOnLogout, draftOwnerTag, purgeForeignDrafts, type KeyStore } from './drafts';

function fakeStore(initial: Record<string, string>): KeyStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get length() {
      return data.size;
    },
    key(i: number) {
      return [...data.keys()][i] ?? null;
    },
    removeItem(k: string) {
      data.delete(k);
    },
  };
}

describe('draftOwnerTag', () => {
  it('cung email (khac hoa thuong + khoang trang) -> cung tag', () => {
    expect(draftOwnerTag('A@x.com')).toBe(draftOwnerTag(' a@x.com '));
  });

  it('email khac nhau -> tag khac nhau', () => {
    expect(draftOwnerTag('a@x.com')).not.toBe(draftOwnerTag('b@x.com'));
  });

  it('luon ra 8 ky tu hex thuong', () => {
    expect(draftOwnerTag('pm@daidung.com.vn')).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('clearAllDrafts', () => {
  it('xoa het ddc_draft_*/ddc_pform_*, giu cac key khac (vd ddc-theme)', () => {
    const s = fakeStore({
      ddc_draft_v3_abc123_1_2026_09: '{}',
      ddc_pform_v1_abc123_1: '{}',
      'ddc-theme': 'dark',
    });
    const removed = clearAllDrafts(s);
    expect(removed).toBe(2);
    expect([...s.data.keys()]).toEqual(['ddc-theme']);
  });
});

describe('clearDraftsOnLogout', () => {
  it('xoa het ddc_draft_*/ddc_pform_* (dung lai logic clearAllDrafts)', () => {
    const s = fakeStore({ ddc_draft_v3_abc123_1_2026_09: '{}', 'ddc-theme': 'dark' });
    clearDraftsOnLogout(s);
    expect([...s.data.keys()]).toEqual(['ddc-theme']);
  });

  it('storage nem loi (che do rieng tu) -> khong crash', () => {
    const broken: KeyStore = {
      length: 1,
      key: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
    };
    expect(() => clearDraftsOnLogout(broken)).not.toThrow();
  });
});

describe('purgeForeignDrafts', () => {
  const OWNER = 'abc12345';

  it('xoa v1/v2, giu dung key cua owner hien tai o v3/pform', () => {
    const s = fakeStore({
      ddc_draft_1_2026_09: '{}', // v1
      ddc_draft_v2_1_2026_09: '{}', // v2
      [`ddc_draft_v3_${OWNER}_1_2026_09`]: '{}', // v3 cua chinh minh
      ddc_draft_v3_other99_1_2026_09: '{}', // v3 cua nguoi khac
      [`ddc_pform_v1_${OWNER}_new`]: '{}', // pform cua chinh minh
      ddc_pform_v1_other99_new: '{}', // pform cua nguoi khac
    });
    const removed = purgeForeignDrafts(s, OWNER);
    expect(removed).toBe(4);
    expect([...s.data.keys()].sort()).toEqual([
      `ddc_draft_v3_${OWNER}_1_2026_09`,
      `ddc_pform_v1_${OWNER}_new`,
    ].sort());
  });
});
