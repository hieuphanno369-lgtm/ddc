import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['vi', 'en'],
  defaultLocale: 'vi',
  // next-intl 4 mặc định cookie locale là cookie phiên; giữ 1 năm như bản 3 để người dùng không mất ngôn ngữ đã chọn.
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});

export type Locale = (typeof routing.locales)[number];
