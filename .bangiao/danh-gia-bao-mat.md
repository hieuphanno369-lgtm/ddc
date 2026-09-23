PHAN QUYET BAO MAT: DAT

# Đánh giá Bảo mật — Redesign "Apple Glass" (Security-reviewer)

Nhánh: `feature/apple-glass-redesign`, HEAD `70965f6` (mã sản phẩm chốt ở `e35a540` — bản vá
của Debugger; các commit sau đó chỉ là docs + 2 file test). Phạm vi rà: diff từ `950359f`
(merge-base với `main`) tới HEAD — 59 file, +3008/-1474 dòng.

**KẾT LUẬN: AN TOÀN** — không có lỗ hổng mới mức cao/trung do đợt redesign gây ra, không có
mục CẦN VÁ chặn ship. Có 3 ghi chú mức THẤP về vệ sinh (mục 4) và 2 nợ bảo mật có TỪ TRƯỚC
(mục 5) — ghi lại để đưa vào backlog, không tính vào phán quyết.

**Skill đã dùng:** `ddc-tower:security-review` (checklist: secrets, input validation,
injection, authn/authz, XSS, CSRF, rate-limit, lộ dữ liệu, dependency).
Không gọi: `api-security-testing` (không có endpoint/API/logic auth nào đổi — mục 1),
`security-audit` (đề bài không yêu cầu audit toàn diện), `find-security-vulnerabilities-in-code`
/ các skill Strix (phải chạy agent pentest chủ động; phạm vi ở đây là diff UI thuần nên đã rà
thủ công từng dòng — white-box).

**mcp__postgres (chỉ đọc):** `list_schemas` + đọc `public._prisma_migrations`. Migration cuối
`20260923025310_b5_dim_fk_restrict` áp lúc 10:03 ngày 23/09 — TRƯỚC commit gốc của nhánh
`950359f` (10:45) và Task 1 `3e3cbe5` (12:16). Tức là redesign không chạy migration nào,
không đổi schema. `prisma/` lần cuối đổi ở `2178ef8` (Run 1).

---

## 1. Ràng buộc #1 (không đụng nghiệp vụ) — ĐẠT

`git diff --name-only 950359f..HEAD` trên các vùng cấm: `src/server/**`, `src/lib/**`,
`prisma/**`, `src/data/**`, `app/api/**`, `middleware.ts`, `next.config.*`, `package.json`,
`package-lock.json`, `.env*` → **0 file**. Ngoài `.tsx`/CSS, chỉ có `src/i18n/messages/{vi,en}.json`
đổi: thêm đúng 1 khoá `kpi.focusTag` ("Trọng tâm"/"Focus"), đúng Constraint #8.

**So sánh chuẩn hoá hành vi:** với từng `.tsx` bị sửa, lọc mọi dòng chứa handler/binding
(`onClick/onChange/onSubmit/onCreate`, `value/checked/disabled/required/accept/type=`,
`href/src`, `*Action(`, `await`, `router.`, `signIn/signOut`, `.role`, `canClose/canLock/locked`),
bỏ khoảng trắng + `className` + `style`, rồi so bản gốc với HEAD. Mọi khác biệt còn lại chỉ
thuộc 4 loại vô hại:

| Loại khác biệt | File | Đánh giá |
|---|---|---|
| Thêm prop `heroTagLabel={t('kpi.focusTag')}` | `OverviewWidgets.tsx`, `report/page.tsx`, `projects/[id]/page.tsx` | Chuỗi dịch tĩnh, render qua JSX (có escape) ở `KpiCard.tsx:53` — vô hại, đúng mục 3.1 `thay-doi.md` |
| Bỏ biến thừa `const t = await getTranslations()` | `data-dictionary`, `data-schema`, `import` page | Không đổi hành vi |
| Sắp lại thứ tự thuộc tính / thêm `style` | `FieldEditor`, `ResetDataButton`, `FilterBar`, `AppShell`, `Watchlist`, `ProjectTable` | Handler giữ nguyên |
| Thêm `getTranslations()` để hiện `app.subtitle` | `login/page.tsx` | Chuỗi công khai |

- Guard phân quyền ở trang (vd `canClose={user.role === 'admin' || user.role === 'bod'}` ở
  `alerts/page.tsx`, guard admin ở `audit/page.tsx`) xuất hiện theo cặp -/+ giống hệt nhau
  (chỉ đổi thụt lề).
- 20 server action mà các component bị sửa gọi tới (`createAccountAction`, `resetPasswordAction`,
  `setUserRoleAction`, `resetDataAction`, `removeProjectAction`, `importExcelAction`,
  `commitImportAction`, `addPhotoAction`, `deletePhotoAction`, `lockMonthAction`, ...) vẫn có
  guard phía server (`requireRole` / `requireProject` / `getCurrentUser` + zod) trong
  `src/server/actions.ts` — file này không bị đụng. Vì vậy đổi cách ẩn/hiện nút ở UI không ảnh
  hưởng quyền thật.
- **Không lộ thêm dữ liệu:** đếm số lần dùng các trường nhạy cảm (`lastLoginAt`, `userEmail`,
  `a.detail`, `a.owner`, `a.deadline`, `customerName`, `pctActual`, `committedHandoverDate`,
  `a.reason`, `f.yearMonth`) ở bản gốc và HEAD — **bằng nhau 100%**. Bảng admin/audit/user/alerts
  không thêm hay bớt cột nào.
- Lệch nhỏ chưa ghi trong `thay-doi.md`: `AppShell.tsx` xoá 1 dòng comment cuối file
  `// TODO: Cần kiểm tra lại đoạn logic này`. Chỉ là comment, không có logic.

## 2. Motion engine JS mới (`src/components/ui/motion.ts`) — AN TOÀN

- Không có `eval`, `new Function`, `setTimeout(chuỗi)`, `innerHTML`, `insertAdjacentHTML`,
  `document.write`.
- Chỉ ghi vào `el.style.opacity` / `el.style.transform` / `willChange` các giá trị **số** do
  engine tự tính (`scale(${v})`, `translate3d(0,${n.toFixed(2)}px,0)`). Không có đầu vào nào từ
  người dùng, URL hay DB.
- `usePressable` (dòng 151) đọc lại `el.style.transform` bằng regex `/scale\(([\d.]+)\)/` rồi
  `parseFloat` — chỉ nhận chữ số, không có đường injection.
- **Chưa được import ở đâu** (grep `useRise|usePressable|useHoverLift|ui/motion` trong
  `app/` + `src/` chỉ ra định nghĩa) → hiện là code chết, không có bề mặt tấn công.
- Ghi chú không phải bảo mật, cho lần bật sau: vòng `requestAnimationFrame` (dòng 56–81) và
  `setTimeout` 900ms (dòng 95) không huỷ khi unmount. Khi gắn hook vào component, nên trả về
  cleanup `cancelAnimationFrame` / `clearTimeout` (tránh rò rỉ hiệu năng).

`src/components/dashboard/useChartTokens.ts` (dòng 55–63): chỉ đọc
`getComputedStyle(...).getPropertyValue('--x')` của các token do dev định nghĩa trong
`app/tokens.css`, rồi truyền vào prop màu của Recharts (React tự escape attribute). Người dùng
không có cách nào điều khiển giá trị này.

## 3. XSS / injection / form / login — AN TOÀN

- **`dangerouslySetInnerHTML` duy nhất trong diff:** script khởi tạo theme ở
  `app/[locale]/layout.tsx:33`. Script này **có từ trước**, lần này chỉ đổi nội dung. Chuỗi hoàn
  toàn tĩnh (không nội suy biến). Giá trị `localStorage['ddc-theme']` chỉ được dùng sau phép so
  sánh chặt `t==='light'||t==='dark'` rồi mới `setAttribute('data-theme', t)`; mọi giá trị khác
  → `removeAttribute`. Kể cả ai đó ghi được localStorage cũng không chèn được gì. `applyTheme`
  trong `SettingsMenu.tsx` dùng cùng whitelist.
- Mọi nội dung động mới hiện ra (tên dự án, message cảnh báo, email user, giá trị cũ/mới trong
  audit, tooltip `.help .bub` ở `DataEntryForm`/`CreateProjectForm`) đều render qua JSX nên
  React tự escape. Không có `href`/`src` động mới — chỉ `/projects/${id}` và
  `/api/photos/${ph.url}`, cả hai có từ trước và không đổi.
- `style={{...}}` động mới chỉ nhận số đã được kẹp (`Math.min(100, Math.max(0, pct*100))%` ở
  `DataEntryForm`) hoặc token `var(--x)` cố định. React gán qua CSSOM nên không có CSS injection.
- **CSS** (`app/globals.css`, `app/tokens.css`): 0 `url(`, 0 `@import`, 0 `http(s)://`,
  0 `@font-face` → không tải tài nguyên bên thứ ba, không có kênh rò rỉ hay tracking qua CSS.
- **Form/wizard/import:** `required`, `type="email|password|number|file"`,
  `accept=".xlsx,.xls,.csv"`, `accept="image/*"`, `disabled={busy|locked|!resolveSel[...]}` giữ
  nguyên 100%. Validate phía server (zod trong `actions.ts`) không bị đụng. Nút `.help` mới có
  `type="button"` nên không vô tình submit form.
- **Login (Task 12):** `submit()` và `signIn('credentials' | 'google')` không đổi. Thông báo lỗi
  vẫn là chuỗi chung `auth.invalidCredentials` (không lộ tài khoản có tồn tại hay không). Thứ
  duy nhất mới hiện ra trước khi đăng nhập là `app.subtitle` ("Quản trị danh mục dự án kết cấu
  thép") — thông tin công khai. `googleEnabled` vẫn chỉ là boolean, không đẩy secret xuống client.
  `PasswordInput.tsx:34` vẫn là `type={show ? 'text' : 'password'}`.
- Luồng xác nhận 2 bước của `ResetDataButton` / `DeleteProject` giữ nguyên. Class
  `.btn.danger` (`globals.css:391`) và `.chip.c-dan` (`:171`) đều có định nghĩa → nút phá huỷ vẫn
  nhận ra được bằng mắt. Link xuất Excel `/api/report/export` không đổi.
- Không đổi dependency, header hay cấu hình.

## 4. Ghi chú mức THẤP (vệ sinh — không phải lỗ hổng trong code redesign)

### T-1 — Snapshot Playwright chứa mật khẩu dạng rõ, thư mục chưa được `.gitignore` (Thấp)
- **File:** `.playwright-mcp/page-2026-09-23T01-01-50-544Z.yml:13`,
  `page-2026-09-23T07-01-27-190Z.yml:65`, `page-2026-09-23T07-10-14-225Z.yml:14`,
  `page-2026-09-23T07-18-26-622Z.yml:65`, `page-2026-09-23T07-57-34-762Z.yml:65`. Trong các file
  này, ô textbox mật khẩu chứa nguyên mật khẩu seed. Lý do: công cụ snapshot đọc thẳng `value`,
  kể cả khi ô là `type="password"`. Nút "Hiện mật khẩu" trong snapshot cho thấy ô vẫn đang ẩn —
  **không phải lỗi của `PasswordInput`**.
- `.gitignore` (13 dòng) không có `.playwright-mcp/` hay `.obsidian/`, và `git check-ignore` xác
  nhận cả hai không bị ignore. Chỉ cần một lệnh `git add -A` / `git add .` là 98 file này
  (41 log + 57 yml) bị commit lên repo.
- **Cách khai thác:** ai đọc được repo sẽ đọc được mật khẩu trong snapshot. Hiện đây chỉ là mật
  khẩu seed (vốn đã có sẵn trong repo) nên tác động thêm gần như bằng 0. Nhưng nếu lần test sau
  dùng tài khoản thật thì tài khoản thật sẽ bị lộ.
- **Cách vá:** thêm `.playwright-mcp/` và `.obsidian/` vào `.gitignore`; xoá thư mục này sau mỗi
  phiên test.

### T-2 — Tài liệu bàn giao đã commit lặp lại tài khoản seed (Thấp / thông tin)
- `.bangiao/thay-doi.md:175` (đã commit trên nhánh) ghi rõ `admin@daidung.com.vn` kèm mật khẩu
  seed.
- Đây không phải rò rỉ mới: cùng thông tin đã có từ trước ở `src/data/seed/history.ts:606` và
  `docs/README_NON_TECH.md:161`.
- Rủi ro thật chỉ xảy ra nếu production dùng seed này, hoặc nếu nút "Xoá toàn bộ dữ liệu"
  (`resetDataAction`) tạo lại tài khoản seed trên production.
- **Cách vá:** trước go-live, đảm bảo đổi mật khẩu hoặc khoá tài khoản seed trên production;
  nếu muốn, che mật khẩu trong tài liệu bàn giao (ghi "xem seed").

### T-3 — Form quản trị không có `autoComplete` → trình duyệt tự điền mật khẩu admin vào ô "Mật khẩu ban đầu" (Thấp, có từ trước)
- **Bằng chứng:** `page-2026-09-23T07-01-27-190Z.yml` dòng 58 (email) và 65 (mật khẩu) — form tạo
  tài khoản ở `/vi/admin` bị điền sẵn email và mật khẩu của admin.
- **Nguồn:** `src/components/admin/UserEditor.tsx:73` (ô email), `:83`, `:179`, `:183`
  (PasswordInput). `src/components/ui/PasswordInput.tsx:33–40` không nhận cũng không đặt
  `autoComplete`. `git grep -i autocomplete` trên bản gốc `950359f` cũng ra 0 → **có từ trước**;
  redesign không gây ra và không làm tệ hơn.
- **Cách khai thác:** admin bấm "Tạo" mà không để ý → tài khoản mới nhận đúng mật khẩu của admin
  (mật khẩu đặc quyền bị dùng lại).
- **Cách vá** (backlog, ngoài phạm vi UI thuần): thêm prop `autoComplete` cho `PasswordInput`;
  dùng `autoComplete="new-password"` ở `UserEditor` và `ChangePasswordModal` (các ô mật khẩu mới),
  `autoComplete="off"` cho ô email khi tạo user; `autoComplete="username"` /
  `"current-password"` ở `LoginForm`.

## 5. Nợ bảo mật có TỪ TRƯỚC — ngoài phạm vi, không tính vào phán quyết

1. **Chưa có CSP hay security header nào:** `next.config.mjs` và `middleware.ts` không có
   `Content-Security-Policy`, `X-Frame-Options` hay `frame-ancestors`. Khi bổ sung CSP sau này,
   cần nonce hoặc hash cho script theme ở `layout.tsx:33` — hash phải tính theo nội dung **mới**.
2. **Nợ đã tự ghi ở `PROGRESS.md:142`:** NEXTAUTH_SECRET hardcoded, login không rate-limit,
   formula injection ở route CSV cũ, upload không giới hạn. Redesign không đụng các chỗ này
   (không đổi `src/server`, `app/api`, `src/lib`) nên vòng này không kiểm lại. Cần một đợt
   `ddc-tower:pentest` riêng.

## 6. Việc tiếp theo

- Không có mục CẦN VÁ chặn ship → chuyển sang chặng 6 (reviewer).
- Khuyến nghị, không chặn: làm T-1 ngay (chỉ 1 dòng `.gitignore`) trước khi có ai chạy
  `git add -A`; đưa T-2, T-3 và mục 5 vào backlog bảo mật.
