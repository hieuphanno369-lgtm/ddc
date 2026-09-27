import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { loadE2eEnv, resolveE2eTarget } from './helpers/env';

/**
 * Nang next15 (Task 3): next-intl 4 va gia GHSA-8f24-v5vv-gm5j (open redirect) + doi mac dinh cookie
 * locale thanh cookie phien. Kiem tu dong lai 2 hanh vi ke hoach yeu cau ("kiem o Task 5 bang trinh
 * duyet/e2e") de tranh hoi quy khi nang next-intl lan sau: khong bi open redirect, cookie locale con 1 nam.
 * Dung APIRequestContext moi (khong cookie) giong e2e/09-chan-chua-dang-nhap.spec.ts.
 *
 * Luu y URL "//evil.com/vi": phai truyen CA CHUOI TUYET DOI (BASE + path) cho api.get(), khong truyen
 * rieng path bat dau bang "//" (Playwright/WHATWG resolve "//x" tuong doi voi base nhu URL protocol-relative,
 * tu doi sang host "evil.com" that ngay trong client truoc khi gui request - khong phan anh dung hanh vi
 * server that, xem thay-doi.md).
 */
const BASE = resolveE2eTarget(loadE2eEnv()).baseURL;

let api: APIRequestContext;
test.beforeAll(async () => {
  api = await pwRequest.newContext({ baseURL: BASE });
});
test.afterAll(async () => {
  await api.dispose();
});

/** true neu Location tro ra host khac (open redirect: bat dau bang "//" hoac co scheme://host la). */
function isOpenRedirectLocation(location: string): boolean {
  if (location.startsWith('//')) return true;
  if (/^https?:\/\//i.test(location)) {
    try {
      return new URL(location).host !== new URL(BASE).host;
    } catch {
      return true;
    }
  }
  return false;
}

test.describe('12 - locale redirect + cookie (nang next-intl 4)', () => {
  test('duong chay thuan loi: "/" khong cookie -> redirect ve /vi (locale mac dinh)', async () => {
    const res = await api.get('/', { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(res.status());
    const location = res.headers()['location'] ?? '';
    expect(new URL(location, BASE).pathname).toBe('/vi');
  });

  test('bien: "/vi//evil.com" khong bi open redirect ra host la', async () => {
    const res = await api.get('/vi//evil.com', { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(res.status());
    const location = res.headers()['location'] ?? '';
    expect(isOpenRedirectLocation(location)).toBe(false);
  });

  test('bien: "//evil.com/vi" khong bi open redirect ra host la', async () => {
    // Truyen URL TUYET DOI (khong phai path tuong doi) de tranh client tu resolve "//" thanh protocol-relative.
    const res = await api.get(`${BASE}//evil.com/vi`, { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(res.status());
    const location = res.headers()['location'] ?? '';
    expect(isOpenRedirectLocation(location)).toBe(false);
  });

  test('bien: cookie NEXT_LOCALE giu ~1 nam (khong con la cookie phien mac dinh cua next-intl 4)', async () => {
    // /vi/login: duong dan cong khai (khong dang nhap van qua thang next-intl middleware, response
    // giu nguyen Set-Cookie cua no) - /vi (khong phai login) se bi middleware rieng cua app redirect
    // sang /vi/login bang mot NextResponse.redirect() moi, KHONG mang theo Set-Cookie locale.
    // Context RIENG (khong dung `api` chung): APIRequestContext giu cookie jar qua cac request trong
    // cung context nhu trinh duyet - cac test truoc da lam context `api` co san cookie NEXT_LOCALE, khien
    // next-intl khong can gui lai Set-Cookie (da khop). Test nay can trang thai "chua co cookie" that su.
    const fresh = await pwRequest.newContext({ baseURL: BASE });
    const res = await fresh.get('/vi/login', { maxRedirects: 0 });
    // res.headers() gop nhieu Set-Cookie thanh 1 chuoi khong dung chuan (Expires co dau phay) -
    // dung headersArray() (giu tung header rieng, kha nang lap lai ten) de doc dung header set-cookie.
    const setCookie = res
      .headersArray()
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => h.value)
      .join('\n');
    expect(setCookie).toMatch(/NEXT_LOCALE=/);
    const maxAgeMatch = setCookie.match(/Max-Age=(\d+)/i);
    expect(maxAgeMatch, `set-cookie phai co Max-Age (khong phai cookie phien): ${setCookie}`).not.toBeNull();
    const maxAge = Number(maxAgeMatch?.[1]);
    // ~1 nam (365 ngay), cho sai so nho.
    expect(maxAge).toBeGreaterThan(60 * 60 * 24 * 300);
    await fresh.dispose();
  });

  test('phai that bai: gia mao open-redirect vao trang bao ve khong lo du lieu, khong ra host la', async () => {
    // Next tu chuan hoa "//" thanh 1 dau "/" (308, van o localhost) TRUOC khi toi middleware. Segment
    // "evil.com" co dau cham nen khop `matcher` loai tru cua middleware (danh cho file tinh nhu .png/.js),
    // middleware KHONG chay cho hop sau - ket qua la 404 (khong co page nao khop), khong phai redirect ve
    // /vi/login (hanh vi cua ca 2 lop nay deu co tu truoc, khong doi trong phase nang Next15). Quan trong
    // nhat voi bao mat: khong bao gio ra ngoai host la, khong lo du lieu du an.
    const res = await api.get('/vi/overview//evil.com');
    expect(new URL(res.url()).host).toBe(new URL(BASE).host);
    expect(res.status()).toBe(404);
    const body = await res.text();
    expect(body).not.toContain('projectName');
  });
});
