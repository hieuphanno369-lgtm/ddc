import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;

let pathname = '/login';
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'vi',
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('next/image', () => ({
  default: (p: { alt: string; src: string }) => React.createElement('img', { alt: p.alt, src: p.src }),
}));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace() {} }),
  Link: (p: { href: string; children?: React.ReactNode }) => React.createElement('a', { href: p.href }, p.children),
}));

import { AuthShowcase } from './AuthShowcase';

const render = () => renderToStaticMarkup(React.createElement(AuthShowcase));

describe('AuthShowcase', () => {
  beforeEach(() => { pathname = '/login'; });

  it('trang dang nhap: Gantt day du, cau chao, the canh bao', () => {
    const html = render();
    expect(html).toContain('data-auth="showcase"');
    expect(html).toContain('data-auth="mobile-head"');
    expect(html).toContain('data-auth="gantt-full"');
    expect(html).not.toContain('data-auth="gantt-compact"');
    expect(html).toContain('authPage.heroLine1');
    expect(html).toContain('authPage.alertText');
    expect(html).toContain('data-auth="crane"');
  });

  it('trang dang ky: Gantt rut gon, cau chao rieng, the vua hoan thanh', () => {
    pathname = '/dang-ky';
    const html = render();
    expect(html).toContain('data-auth="gantt-compact"');
    expect(html).not.toContain('data-auth="gantt-full"');
    expect(html).toContain('authPage.registerHero1');
    expect(html).toContain('authPage.doneToast');
  });

  it('khong con chuoi giu cho [TEN DU AN] cua ban ve', () => {
    for (const p of ['/login', '/dang-ky']) {
      pathname = p;
      expect(render()).not.toMatch(/\[T[ÊE]N D[ỰU] [ÁA]N\]/);
    }
  });

  it('hoat hinh cau thap co du cac nhom data-anim', () => {
    const html = render();
    for (const a of ['trolley', 'cable', 'hook', 'hb', 'placed', 'spark', 'blink']) {
      expect(html).toContain(`data-anim="${a}"`);
    }
  });
});
