KET QUA TEST: XANH

# P7-C1 - ket qua kiem thu doc lap (tester)

> Skill da dung: `test-driven-development`, `verification-before-completion` (goi truoc khi bat dau).
> Khong sua bat ky file san pham nao. Chi tao them 1 file test moi:
> `src/components/admin/ActivityViewer-legacy-action.test.ts`.

## 1. Cong kiem cuoi cung (chay that, output that)

- `npx tsc --noEmit` -> sach, khong loi (exit 0).
- `npm test` -> **203 file test passed | 2193 test passed** (0 fail). Tang 1 file / 3 case so voi
  ban giao cua coder (202 file / 2190 test) vi them file test moi o muc 3 duoi day.
- `npx playwright test` (cong 3003, DB `ddc_control_tower_c`) chay **3 lan trong luot kiem nay**:
  - Lan 1 (xoa `.next`, cold start giong dung dieu kien lan dau cua coder o Buoc 1): **70 passed, 0 failed** (2.4 phut).
  - Lan 2 (xoa `.next` lai, cold start lan nua): **70 passed, 0 failed** (1.9 phut).
  - Lan 3 (khong xoa `.next`, warm): **70 passed, 0 failed** (2.8 phut).
  - Rieng `e2e/02-overview.spec.ts --repeat-each=6` (cold `.next`): **9/9 passed** (3 setup + 6 lap lai).
  - Tong cong: **0/79 lan chay `02-overview.spec.ts` bi do** trong dot kiem nay (khong tinh cac spec khac).
- Lint: repo nay **khong co script/cau hinh eslint** (`package.json` khong co "lint", khong tim thay
  `.eslintrc*` o goc repo) -> khong co gi de kiem, bo qua muc nay, ghi ro thay vi gia vo da kiem.
- Da tat dev server tam (PID 3948) va xac nhan cong 3003 khong con lang nghe truoc khi ket thuc.

## 2. C-0 - guard chan DB A (chan that, khong dung DB A)

- Doc lai 19 case trong `e2e/helpers/env.test.ts` (isExpectedDbUrl/parseE2eBaseUrl/resolveE2eTarget):
  du ca DB A o moi cong (3000-3003), cap lech (C+3001, B+3003), cong la (3002), ten gan giong
  (`_b2`,`_c2`), host/port Postgres khac, URL rong/khong parse duoc -> deu tra ve false/throw, khong throw
  ngoai y muon o `isExpectedDbUrl`. Chay lai: **19/19 passed**.
- Kiem THAT bang script doc lap (khong sua `.env`, khong dung DB A that): gia lap bien SHELL
  `DATABASE_URL` tro DB A (`ddc_control_tower`) + `NEXTAUTH_URL=http://localhost:3003`, roi
  `import('playwright.config.ts')` that (qua `tsx`) - dung chinh code path config dung khi chay e2e:
  - Ket qua: `playwright.config.ts` **KHONG dung DATABASE_URL DB A** vi `.env` that cua repo (dung, tro
    `ddc_control_tower_c`) thang bien shell dung nhu thiet ke K10 (`{ ...process.env, ...loadDotEnv() }`).
    `webServer.env.DATABASE_URL` cuoi cung tro dung `ddc_control_tower_c`, `use.baseURL` dung
    `http://localhost:3003`. Chung minh: ke ca neu shell/CI bi set nham DB A, e2e cua worktree C
    van khong bao gio cham DB A mien la `.env` cua worktree dung.
  - Da grep xac nhan chuoi loi trong `env.ts` khong chua `DATABASE_URL`/`pass@` (khong lo mat khau).
  - Khong sua `.env` that cua repo trong qua trinh nay (script chi doc `process.env` gia lap trong
    tien trinh Node rieng, khong dung tien trinh dev/test nao cua repo).
- Ket luan C-0: guard hoat dong dung nhu ke hoach, ca lop unit (19 case) lan lop tich hop
  (playwright.config.ts thuc te khi import).

## 3. 7.1 - go han "xoa toan bo du lieu", giu `activity.reset_data`

- Grep toan repo (bo `node_modules`, `.next`, `.bangiao/archive`):
  `resetDataAction|resetAllData|ResetDataButton` chi con trong file test cua coder
  (`src/server/reset-data-removed.test.ts`) - khong con trong code san pham nao.
  `admin\.resetData|resetConfirm` chi con: bien cuc bo `resetConfirm` trong `UserEditor.tsx`
  (xac nhan mat khau, khong lien quan - dung nhu coder ghi) va file test.
- **Test hanh vi moi (khong chi kiem JSON)**: `src/components/admin/ActivityViewer-legacy-action.test.ts`
  (3 case, dung ban dich THAT tu `vi.json`/`en.json`, khong mock chuoi key):
  1. Dong nhat ky cu voi `action: 'reset_data'` -> ActivityViewer render ra **"Xóa dữ liệu"** (vi that,
     khong phai key tho).
  2. Tuong tu ban en -> **"Reset data"**.
  3. Case tu-kiem-chung: gia lap xoa key `activity.reset_data` khoi ban dich (chi trong bo nho test,
     khong dung file that) -> lai thay chuoi key tho `activity.reset_data` hien ra, chung minh 2 case
     tren THAT SU kiem tra duoc (khong phai gia dinh suong).
  - Chay: `npx vitest run src/components/admin/ActivityViewer-legacy-action.test.ts` -> **3 passed (3)**.
  - Da xem lai code that: `ActivityViewer.tsx` dong 56 van la `t(\`activity.${a.action}\`)`, khong doi.
- Kiem mat that /vi/admin (dev server tam tren 3003, da tat ngay sau): card dau tien "Phan quyen
  nguoi dung" nam sat topbar, khong con khoang trong thua sau khi bo khoi nut reset; card "Xoa du an"
  (xoa 1 du an rieng le - tinh nang khac, N-2) va "Lich su hoat dong" van o dung vi tri, bo cuc deu voi
  cac trang khac. Anh: `test-results/tester-admin-top-vi.png` (gitignored, xem truc tiep tren may).

## 4. Pixel-perfect sidebar/login (kiem mat that, doc lap voi anh cua coder)

Da tu mo dev server tam tren cong 3003 (KHONG dung lai anh coder chup san), dang nhap that bang
`admin@daidung.com.vn`, tu chup lai toan bo bang `mcp__playwright`:

- `test-results/tester-login-vi.png`, `tester-login-en.png`: h1 "BÁO CÁO QUẢN TRỊ" / "MANAGEMENT
  REPORTS" deu gon 1 dong, can giua, khong tran khoi the dang nhap, khoang cach voi dong phu ben duoi
  deu dan.
- `test-results/tester-sidebar-vi-desktop.png`, `tester-sidebar-en-desktop.png`: dong dam (12px,
  `var(--t-caption1)`, fallback coder ap dung o Buoc 5) va dong mo (11px, `var(--t-caption2)`, CSS co
  san) can trai thang hang voi logo va cac muc nav ben duoi; ca 2 locale deu gon 1 dong, khong de len
  logo, khong tran ra khoi vien sidebar. Do luong nay khop voi so do coder ghi trong `thay-doi.md`
  (5.3-5.4: EN tung xuong 2 dong o 13px, sau fallback ve 12px thi het).
- `test-results/tester-sidebar-en-collapsed.png`: thu gon dung nhu ke hoach, chi con logo, khong lo
  chu nao.
- `test-results/tester-sidebar-vi-mobile.png`: drawer mobile (390x844) mo dung, chu 1 dong, khong tran.
- Console browser: chi co canh bao `defaultProps` cua thu vien `recharts` (loi thu vien ben thu 3, co
  san tu truoc, khong lien quan P7-C1) - khong co loi lien quan sidebar/ten app/i18n.
- Ket luan: khop hoan toan voi mo ta va anh chup cua coder o `thay-doi.md` Buoc 5. Khong thay lech
  pixel nao dang ke ngoai pham vi da duyet.

## 5. Test chap chon `e2e/02-overview.spec.ts` (khong tai hien duoc trong dot kiem nay)

**Da co gang tai hien 9+ lan** (xem muc 1): 3 lan chay tron bo (2 lan cold `.next`, 1 lan warm) +
1 lan `--repeat-each=6` rieng file nay (cold `.next`) = tong 3 + 6 = 9 lan chay test nay, **0 lan do**.

**Dieu tra them (khong sua code san pham, chi doc va suy luan tu code that):**
- Doc `e2e/global-setup.ts`: seed DB (`execSync` dong bo, cho xong moi tra ve) chay TRUOC khi
  Playwright khoi dong `webServer`. Vay khong co dua giua seed-chua-xong va request dau tien.
- Doc `e2e/auth.setup.ts`: dang nhap admin xong `waitForURL` toi trang sau dang nhap (thuc te la
  `/vi/overview`, xac nhan qua `01-login.spec.ts` dong 20: "admin dang nhap dung -> ve /vi/overview").
  Nghia la trang `/vi/overview` DA duoc compile/warm tu buoc dang nhap admin trong `auth.setup.ts`,
  TRUOC khi `02-overview.spec.ts` tu dieu huong toi lan nua. Gia thuyet "cold-compile trung thoi diem
  seed" cua coder (Buoc 1) vi vay co ve khong phai nguyen nhan chinh - da tu chay lai that su cold
  (xoa `.next`) 2 lan doc lap va van xanh, kha khop voi suy luan nay.
- Doc `src/server/cache.ts`: `loadProjectList` dung `unstable_cache` (Next.js Data Cache, dang file
  tren dia, sinh trong `.next/cache`) voi `revalidate: 1800` (30 phut) lam "safety net". Ly thuyet con
  lai chua loai duoc: neu qua trinh compile dev server (webpack) dang chay dong thoi voi request dau
  tien goi `unstable_cache` (vi du do may cham hoac dang bi tai boi tien trinh khac cung luc - vd 2
  agent/phien chay song song tren cung may nhu quy uoc CLAUDE.md mo ta 3 tai khoan A/B/C), co the co
  1 request bi huy giua chung roi Next tra ve gia tri cache rong da duoc ghi tam - day la gia thuyet
  chua chung minh duoc, chi la kha nang con lai sau khi loai gia thuyet chinh cua coder.
- **KHONG sua** `src/server/queries.ts` / `src/server/cache.ts` (dung theo yeu cau: khong dung code
  san pham du da doc va nghi ra huong).

**Ket luan va de xuat (bao lai chu du an, khong tu quyet):**
- Voi ty le tai hien 0/9 trong dot kiem nay + 3/64 (~4.7%) trong lan chay dau cua coder (1 do trong
  Buoc 1, roi tat ca cac lan sau deu xanh), day la flaky RAT HIEM, nhieu kha nang lien quan toi tai
  may/thoi diem chay (vd may dang chay nhieu tien trinh nang khac cung luc - dung luc do co the co ca
  phien tester nay dang mo nhieu cong cu khac) hon la loi logic trong code. Chua co bang chung du
  manh de xac dinh gio dung mot dong code cu the nao trong `queries.ts`/`cache.ts` la thu pham.
- De xuat (chu du an quyet dinh, khong tu lam):
  1. Neu muon giam rui ro further: cho retry=1 rieng cho `02-overview.spec.ts` (hoac toan bo
     `playwright.config.ts`, hien `retries: 0`) - day la thay doi hanh vi cau hinh, ngoai pham vi
     tester (khong sua code san pham).
  2. Neu tai dien trong CI/may khac: bat `trace: 'on'` (thay vi `retain-on-failure`) tam thoi cho file
     nay de co du lieu network/console dung luc that bai, roi phan tich `.next/cache` truoc/sau.
  3. Theo doi tiep qua nhieu lan chay CI thuc te thay vi co gang tai hien thu cong tren 1 may - flaky
     roi rac kieu nay thuong can nhieu du lieu hon 9 lan de ket luan chac chan.
- Khong danh dau la "loi da sua" - chi ghi nhan "khong tai hien duoc, da dieu tra sau nhat co the trong
  pham vi cho phep (chi doc, khong sua san pham)".

## 6. Danh sach file lien quan

- Test moi (da commit): `src/components/admin/ActivityViewer-legacy-action.test.ts`.
- Anh chup tester tu chup (KHONG commit, `test-results/` da gitignore, xem truc tiep tren may C):
  `test-results/tester-login-vi.png`, `tester-login-en.png`, `tester-sidebar-vi-desktop.png`,
  `tester-sidebar-en-desktop.png`, `tester-sidebar-en-collapsed.png`, `tester-sidebar-vi-mobile.png`,
  `tester-admin-top-vi.png`.
- Anh chup cua coder (da co san, doi chieu them o muc 4): `test-results/p7-*.png`.

## 7. Cac buoc da lam (tom tat theo skill TDD/verification-before-completion)

1. Doc `.bangiao/thay-doi.md`, `.bangiao/ke-hoach.md`, cac file da doi.
2. Chay cong kiem hien co (`tsc`, `npm test`, `npx playwright test`) that su - khong suy doan.
3. Viet them 1 file test hanh vi con thieu (7.1/K7), tu kiem chung bang case "gia lap mat key"
   (RED noi bo) truoc khi tin case chinh la GREEN that.
4. Tai hien flaky bang nhieu lan chay that (cold + warm + repeat-each), doc code lien quan de dua ra
   gia thuyet co can cu, khong sua code san pham.
5. Tu mo trinh duyet that (Playwright MCP) kiem pixel doc lap voi anh coder da chup, dang nhap that,
   chup lai toan bo cac trang hinh trong ke hoach.
6. Kiem guard C-0 bang mot phep thu tich hop that (import `playwright.config.ts` voi bien shell
   gia lap tro DB A), khong dung DB A that, khong sua `.env`.
7. Tat het server tam da mo, xac nhan cong 3003 dong truoc khi ket thuc.
