# Kết quả Test — Redesign "Apple Glass" (Tester)

Nhánh: `feature/apple-glass-redesign`. Tài liệu này có **5 vòng**, giữ nguyên
lịch sử các vòng trước (không xoá) — xem mục "VÒNG 5" ở cuối file cho kết luận
mới nhất.

**TRẠNG THÁI HIỆN TẠI (sau VÒNG 5): PASS** — xem mục "VÒNG 5" ở cuối file.
(Vòng 3 đã PASS cho CS-1/CS-2. Vòng 4 PASS cho CS-3. Vòng 5 xác nhận B-1..B-5 —
5 điểm reviewer chỉ ra ở "VÒNG 2" của `danh-gia.md`, commit `1e34b26` — đều đã
vá đúng, không hồi quy, đủ điều kiện chuyển reviewer chốt merge.)

---

## VÒNG 1 — Test lần đầu trên 12 Task redesign của Coder

Chốt tại HEAD `4b515e1` (+ 1 commit docs `e7787db`). Bàn giao đọc:
`.bangiao/ke-hoach.md` (plan gốc) + `.bangiao/thay-doi.md` (coder viết, mục 6
đọc trước tiên theo yêu cầu).

**Skill đã dùng:** `ddc-tower:test-driven-development`,
`ddc-tower:verification-before-completion` (bắt buộc theo đề bài). Không gọi
`qa`/`qa-only` riêng vì đề bài đã chỉ định cụ thể dùng `mcp__playwright` trực
tiếp cho việc xem bằng mắt; không gọi `systematic-debugging` vì không có test
nào rớt một cách khó hiểu — 2 lỗi tìm được đều đã truy ra gốc rễ rõ ràng qua
đọc code + git diff, không cần điều tra thêm.

**mcp__postgres:** gọi `list_schemas` một lần để xác nhận Postgres thật đang
chạy (đăng nhập cần DB qua `src/data/seed/history.ts`). Đây là việc THUẦN GIAO
DIỆN — không có migration/ghi dữ liệu nào để kiểm trạng thái sau test.

---

## KẾT LUẬN VÒNG 1: **FAIL**

Không phải vì hạ tầng vỡ — `tsc` sạch, 537/537 test gốc của coder vẫn xanh
100%, và tuyệt đại đa số 12 Task redesign làm **rất tốt** (xem mục "Nhận xét
thẩm mỹ" bên dưới). FAIL vì tìm thấy **2 lỗi thật do chính đợt redesign này
gây ra** (không phải chủ ý đã ghi trong Q1–Q8 hay mục 3 của `thay-doi.md`),
đã viết test RED bắt được cả hai, và theo đúng vai trò Tester: dây chuyền
dừng ở đây, chuyển Reviewer xử lý, tôi không tự sửa code sản phẩm.

---

## 1. Kết quả 2 cổng kiểm tra bắt buộc

### `npx tsc --noEmit`
**Sạch, 0 lỗi.** (chạy lại lần cuối ngay trước khi viết báo cáo này)

### `npm test`
**544/545 xanh, 1 rớt (31 file test, 30 xanh + 1 rớt).**

```
Test Files  1 failed | 30 passed (31)
     Tests  1 failed | 544 passed (545)
```

- 537 test gốc của coder: **giữ nguyên 100% xanh**, gồm cả 3 test render trang
  thật `operation-pages-render.test.ts`, `projects-detail-page-month-guard.test.ts`,
  `compliance-page.test.ts` — tôi không sửa bất kỳ test nào của coder.
- **+7 test mới** (`src/components/dashboard/KpiCard.test.ts`) — GREEN, đặc tả
  hành vi `KpiCard` (component trước đây chưa có file test riêng).
- **+1 test mới, RED có chủ đích** (`src/components/admin/ActivityViewer.test.ts`)
  — bắt lỗi thật #2 bên dưới. Đây chính là "trường hợp phải thất bại" theo yêu
  cầu đề bài, không phải test tautology dựng lên cho có.

Con rớt duy nhất:
```
FAIL src/components/admin/ActivityViewer.test.ts > ActivityViewer - cot "Nguoi dung" (ten + email)
  > ten va email phai hien tach biet, khong dinh lien thanh mot chuoi khong doc duoc
AssertionError: expected 'admin.allUsersadmin@daidung.com.vnadm…' not to contain 'Adminadmin@daidung.com.vn'
```

---

## 2. Hai lỗi thật tìm thấy (do redesign gây ra)

### BUG #1 — Thẻ KPI "Trọng tâm": nhãn đè lên tag vàng ở màn hình điện thoại phổ thông
**Mức độ: Trung bình.** Không crash, không mất dữ liệu, nhưng chữ trên đúng
thẻ KPI được đánh dấu "quan trọng nhất" (theo Q7) bị che một phần, khó đọc,
trên nhóm thiết bị rất phổ biến (điện thoại tầm 360–410px, ví dụ iPhone
SE/12/13/14 cỡ chuẩn, nhiều máy Android phổ thông).

**Tái hiện:** `/vi/overview` hoặc `/vi/report`, viewport ≤ ~410px (khi
`.kpis` chuyển sang lưới 2 cột theo `@media(max-width:680px)`), theme sáng
hoặc tối đều như nhau (lỗi là kích thước/layout, không phải màu).

**Bằng chứng đo được (Playwright, `Range.getBoundingClientRect()` trên chữ
thật, không phải suy đoán từ box của div):**

| Viewport | Nhãn / Tag | Overlap chữ thật |
|---|---|---|
| 375px (iPhone SE) | "Trễ tiến độ" / "Trọng tâm" | **19.8px** đè lên nhau |
| 390px (iPhone 12/13/14) | "Trễ tiến độ" / "Trọng tâm" | **12.5px** đè lên nhau |
| 390px, locale `en` | "Behind Schedule" / "Focus" | **21.2px** đè lên nhau (còn nặng hơn) |
| 430px (iPhone Pro Max) | "Trễ tiến độ" / "Trọng tâm" | Không đè (-7.5px, còn dư) |
| 680px (biên 2 cột) | như trên | Không đè (-132px, dư nhiều) |

**Gốc rễ (`app/globals.css` dòng 236–252, copy nguyên văn mock-up dòng
254–280 theo đúng plan):**
```css
.kpi .lb{...white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:30px}
.kpi.key .tag{position:absolute;right:13px;top:13px;...padding:3px 7px;...}
```
`30px` chỉ đủ chừa chỗ cho icon `.ic` (26px vuông) dùng ở thẻ KPI thường.
Nhưng thẻ `.kpi.key` (hero) thay icon bằng tag chữ "Trọng tâm"/"Focus", rộng
thực tế ~65–75px (đo được `tagRect.width` = 74.6px ở 390px) — rộng hơn hẳn
30px đã chừa. Mock-up gốc chỉ có 3 nhãn ngắn ("% Thực tế BQ", "SPI danh mục",
"CPI danh mục") nên không lộ vấn đề này; nhãn thật của app ("Trễ tiến độ",
"Behind Schedule") dài hơn nên mới lộ ra ở màn hẹp.

**Vì sao không viết test Vitest cho lỗi này:** đây là lỗi hình học pixel thật
(cần layout engine + font metrics thật của trình duyệt). `vitest.config.ts`
chạy `environment: 'node'`, không có `jsdom`/trình duyệt nào trong
devDependencies — `getBoundingClientRect()` trong môi trường đó luôn trả về
0, không thể phát hiện chồng lấn thật. Viết một test Vitest kiểm tra con số
`padding-right: 30px` trong CSS sẽ là kiểm tra "ruột gan" (chi tiết cài đặt),
không phải hành vi, và dễ thành tautology. Bằng chứng ở trên (đo trực tiếp
trên trình duyệt thật qua Playwright, lặp lại ở nhiều viewport + 2 locale)
là RED test "thật" theo đúng tinh thần đề bài, dù không phải file `.test.ts`
committed được.

### BUG #2 — Text dính liền không có khoảng cách (`.en` mất margin khi đổi class)
**Mức độ: Trung bình.** Xảy ra ở **mọi** viewport/theme (không phụ thuộc kích
thước màn hình vì đây là lỗi thiếu ký tự trắng trong markup, không phải CSS
responsive). Có **test RED thật** bắt được, xem
`src/components/admin/ActivityViewer.test.ts`.

**2 chỗ xác nhận cụ thể (grep đủ 4 chỗ dùng `.en`, xác nhận 2/4 an toàn nhờ
context flex-gap, 2/4 vỡ vì không có flex):**

1. `/vi/admin` → khối "Lịch sử hoạt động": cột "Người dùng" hiện
   **"Adminadmin@daidung.com.vn"** dính liền (thấy trực tiếp trong ảnh chụp
   màn hình, cả sáng lẫn tối).
2. `/vi/import` → nút chọn file: hiện **"Chọn file ExcelFile .xlsx/.csv - cột:
   Mã SAP..."** dính liền (thấy trực tiếp trong ảnh chụp, cả sáng lẫn tối).

**Gốc rễ (xác nhận bằng git diff, không suy đoán):**
- Trước redesign, `ActivityViewer.tsx`: `<span className="ml-1 text-xs text-slate-400">` (có `margin-left`).
- Sau Task 8: đổi thành `<span className="en">` — CSS `.en` (`app/globals.css`
  dòng 160) chỉ có `font-size/color/letter-spacing`, **không có margin/gap
  nào**: `.en{font-size:var(--t-caption2);font-weight:550;color:var(--label3);letter-spacing:.01em}`.
- Tương tự cho `ImportPanel.tsx` (Task 7): trước là
  `className="ml-2 text-xs text-slate-400"`, sau đổi `className="en"`.
- **Vì sao `Card.tsx`/`ProjectTable.tsx` (2 chỗ dùng `.en` còn lại) KHÔNG bị
  lỗi này**: cả hai nằm trong `<h3>` con của `.card>.hd`, và
  `.card>.hd h3{display:flex;...gap:8px;...}` (dòng 159) tự động tạo khoảng
  cách giữa text và `.en` dù markup không có ký tự trắng. `ActivityViewer`
  đặt `.en` thẳng trong `<td>` (bảng, không phải flex), `ImportPanel` đặt
  trong `<span className="flex-1">` (span thường, không phải flex container)
  — cả hai đều không có gì bù khoảng trắng đã mất.

**Test RED (thật, không tautology):**
```
FAIL src/components/admin/ActivityViewer.test.ts
AssertionError: expected 'admin.allUsersadmin@daidung.com.vnadm…' not to contain 'Adminadmin@daidung.com.vn'
```
Test render `ActivityViewer` thật (`renderToStaticMarkup`, không mock chính
component), khẳng định đúng chuỗi văn bản người dùng nhìn thấy — đúng chuỗi
lỗi đã quan sát bằng mắt qua Playwright, không phải suy diễn.

`ImportPanel.tsx` cùng gốc rễ, đã xác nhận qua đọc mã nguồn + git diff +
DOM thật (`label.innerHTML`) nhưng không viết thêm test trùng lặp cho nó
(là client component nhiều state hơn, cùng một nguyên nhân đã chứng minh
chắc chắn ở `ActivityViewer`) — Reviewer sửa `.en` (thêm margin) hoặc
`ImportPanel.tsx`/`ActivityViewer.tsx` (thêm khoảng trắng/wrapper flex) sẽ
tự động khớp cả hai.

---

## 3. Quan sát KHÁC — xác nhận là lỗi có từ TRƯỚC redesign, ngoài phạm vi

Đã kiểm bằng `git show bb14dc9:<file>` (bb14dc9 = commit ngay trước Task 1)
để không đổ oan cho đợt việc này. Không tính vào kết luận PASS/FAIL trên,
chỉ ghi lại vì gặp trong lúc test và có thể hữu ích cho backlog:

1. **Nút hamburger/thu gọn sidebar có `aria-label={t('common.filter')}`**
   ("Lọc") — sai ngữ nghĩa (đây là nút menu, không phải bộ lọc). Xác nhận
   dòng này đã có y hệt ở `bb14dc9`, Task 2 không đụng tới.
2. **`admin.delete` thiếu key i18n** — nút "Xóa dự án" ở `/vi/admin` hiện chữ
   thô `admin.delete` thay vì nhãn dịch (thấy rõ trong ảnh chụp). Xác nhận
   `t('admin.delete')` đã gọi y hệt ở `bb14dc9`; Task 8 chỉ đổi `className`.
   `vi.json` có `admin.confirmDelete`/`admin.deleted` nhưng thiếu `admin.delete`.
3. **`/vi/khong-ton-tai` (URL không khớp route nào) hiện trang 404 mặc định
   của Next.js** (chữ đen nền trắng) thay vì `not-found.tsx` đã redesign đẹp.
   Đã điều tra kỹ, KHÔNG phải lỗi CSS: đây là giới hạn kiến trúc Next.js App
   Router — `not-found.tsx` lồng trong segment động `[locale]` chỉ được gọi
   khi có `notFound()` gọi từ code đã khớp route (xác nhận bằng cách thử
   `/vi/projects/999999` — ID không tồn tại — trang `not-found.tsx` đẹp hiện
   đúng, kèm cảnh báo dev-mode xác nhận "Falling back to nearest NotFound
   boundary"). URL không khớp route nào ở tầng cao nhất thì Next.js dùng
   trang 404 gốc, bất kể `[locale]/not-found.tsx` có đẹp cỡ nào. Đây là hạn
   chế có từ kiến trúc file-based routing, Task 11/12 (chỉ đổi className)
   không thể và không được phép sửa (ngoài phạm vi "chỉ đổi giao diện").

---

## 4. Nhận xét thẩm mỹ — từng URL đã xem bằng mắt qua Playwright

Đăng nhập thật bằng `admin@daidung.com.vn` (role admin, xem đủ mọi trang).
"✓✓" = đã chụp ảnh cả 2 theme; "✓" = đã chụp 1 theme trực tiếp, theme còn lại
suy luận có căn cứ vững (cùng hệ token/class, đã kiểm 4 trang đại diện đủ
mọi mẫu UI — card/kpi/bảng/form/chart — ở cả 2 theme và luôn nhất quán;
`design-tokens.test.ts` cũng khẳng định 118 token cả 2 theme khớp mock-up).

| URL | Theme đã xem | Nhận xét |
|---|---|---|
| `/vi/login` | ✓✓ sáng+tối | Đẹp, thẻ kính dày (`--mat-chrome`), logo Đại Dũng đỏ trên nền trắng đúng Q1(b), không Google button (đúng vì thiếu `GOOGLE_CLIENT_ID`) |
| `/vi/overview` | ✓✓ sáng+tối | 6 thẻ KPI đúng số/nhãn, đúng 1 tag "Trọng tâm" (Q7 mặc định); nền `.wall` có vệt màu tĩnh không animate (đúng Q6); **có BUG #1 ở mobile** |
| `/vi/projects/1` | ✓✓ sáng+tối | Đầy đủ EVM/S-curve/What-if/Alert/Tài chính/Ảnh hiện trường, ProjectSwitcher dropdown không bị cắt |
| `/vi/nhap-lieu` | ✓✓ sáng+tối | Wizard 4 bước rõ ràng, Combobox "Khách hàng" trong CreateProjectForm không bị cắt (đã test riêng theo yêu cầu) |
| `/vi/report` | ✓✓ sáng+tối | Bảng SPI/CPI màu sắc rõ, nút Xuất Excel nổi bật; cùng **BUG #1** (thẻ hero KPI) |
| `/vi/alerts` | ✓✓ sáng+tối | Bảng scroll ngang riêng (`.scroll{overflow-x:auto}`) — đã xác nhận không phải lỗi cắt nội dung |
| `/vi/compliance` | ✓✓ sáng+tối | Trạng thái rỗng sạch sẽ |
| `/vi/audit` | ✓✓ sáng+tối | Trạng thái rỗng sạch sẽ |
| `/vi/admin` | ✓✓ sáng+tối | **Có BUG #2** (Adminadmin@...) + 2 quan sát ngoài phạm vi (mục 3.1, 3.2) |
| `/vi/import` | ✓✓ sáng+tối | **Có BUG #2** (Chọn file ExcelFile...) |
| `/vi/data-dictionary` | ✓✓ sáng+tối | Accordion mở/đóng mượt, công thức code màu xanh lá dễ đọc |
| `/vi/data-schema` | ✓✓ sáng+tối | Sơ đồ ERD rõ ràng, màu Dimension/Hub/Fact/Support phân biệt tốt |
| `/vi/khong-ton-tai` (404) | trung tính | Xem mục 3.3 — ngoài phạm vi |
| `/en/overview` | ✓ tối (light suy luận) | Dịch đầy đủ, **cùng BUG #1** (còn nặng hơn VI) |

**Riêng đã test theo yêu cầu cụ thể của đề bài:**
- **Sidebar thu gọn (nút toggle ở topbar, ≥1024px):** hoạt động tốt, icon-only
  gọn gàng, mục đang mở vẫn highlight đúng.
- **Hamburger + drawer mobile (<1024px):** trượt vào mượt, scrim mờ kính phía
  sau đúng token, click ra ngoài scrim đóng drawer đúng (xác nhận bằng toạ độ
  click thật, không chỉ đọc code).
- **Dropdown/Combobox không bị `.card{overflow:hidden}` cắt:** đã test
  `ProjectSwitcher` (trang chi tiết dự án) và `Combobox` "Khách hàng" (trong
  CreateProjectForm) — cả hai đều nổi đúng, không bị cắt.
- **Responsive điện thoại (375/390/430px):** bố cục chung không vỡ, ngoại trừ
  BUG #1 đã nêu.
- **KpiCard 6 thẻ + `heroTagLabel`:** xác nhận bằng mắt lẫn bằng
  `git grep`/đọc `OverviewWidgets.tsx` dòng 59 — chỉ đúng 1/6 thẻ
  (`kpi.behindSchedule`) có `hero heroTagLabel`, khớp Q7 mặc định.
- **`legacy-style-guard.test.ts` (PENDING=[]) có bắt sót gì không:** grep độc
  lập trên toàn bộ `app/`+`src/components/` các pattern `#B91C1C`, `dark:`,
  `bg-white`, `text-slate-`, `bg-slate-`, `border-slate-`, `text-red-`,
  `bg-red-`, `text-amber-`, `bg-amber-`, `text-emerald-`, `bg-emerald-`,
  `text-blue-`, `bg-blue-`, `text-navy-`, `bg-navy-`, `rounded-card`,
  `shadow-card`, `table-zebra`, `bg-accent`, `gold-soft`, `canvas`,
  `offwhite`, và hex 6 ký tự trong `.tsx` — **0 kết quả** ngoài 4 mã màu
  Google trong `LoginForm.tsx` (đã nằm trong `HEX_ALLOW`). Test canh **không
  bắt sót**, đúng như coder báo cáo.

**Không còn dấu vết đỏ `#B91C1C`** ở đâu ngoài logo Đại Dũng (chủ ý Q1).
**Độ tương phản chữ/nền** ở mọi trang đã xem đều đọc tốt, cả 2 theme.

---

## 5. File đã tạo/sửa (chỉ file test, đúng giới hạn được giao)

- **Tạo mới** `src/components/dashboard/KpiCard.test.ts` — 7 test, GREEN.
  Đặc tả hành vi `KpiCard` (đường thuận lợi: hiện label/value/icon đúng, delta
  lên/xuống; biên theo Task 4 spec: hero ẩn icon + hiện tag, không delta/sub
  hiện dấu "-"; khoá hợp đồng hiện tại khi `hero=true` mà thiếu `heroTagLabel`).
- **Tạo mới** `src/components/admin/ActivityViewer.test.ts` — 1 test, **RED**
  có chủ đích, bắt BUG #2.
- Không sửa bất kỳ file test nào của coder, không đụng file sản phẩm nào.

---

## 6. Việc cần Reviewer/Coder xử lý tiếp

1. BUG #1: thêm padding-right đủ rộng cho `.kpi.key .lb` (thay vì dùng chung
   30px với thẻ thường), hoặc cho tag `.kpi.key .tag` xuống dòng ở màn hẹp.
2. BUG #2: thêm lại khoảng cách đã mất khi đổi sang `.en` — hoặc thêm ký tự
   trắng/`&nbsp;` trong JSX, hoặc thêm `margin-left`/`gap` riêng cho 2 chỗ
   dùng `.en` ngoài ngữ cảnh flex (`ImportPanel.tsx`, `ActivityViewer.tsx`).
3. Sau khi sửa: chạy lại `npm test` — kỳ vọng `ActivityViewer.test.ts` chuyển
   GREEN mà không cần sửa gì trong chính file test đó.
4. 3 quan sát ngoài phạm vi (mục 3) — tuỳ chủ dự án quyết định có đưa vào
   backlog riêng hay không, không chặn việc ship redesign này.

---

## VÒNG 2 — Xác nhận độc lập bản vá của Debugger (commit `e35a540`)

Debugger đã sửa 2 lỗi ở VÒNG 1, ghi chi tiết ở `.bangiao/thay-doi.md` mục 7
("CAN SUA #1"). Nhiệm vụ vòng này: **xác nhận độc lập**, không tin suông báo
cáo của Debugger — tự đo lại bằng Playwright thật, không đọc số của Debugger
rồi gật đầu.

**Diff thật đã kiểm** (`git show e35a540`) — đúng 3 file sản phẩm, tối thiểu,
khớp mô tả trong `thay-doi.md`:
- `app/globals.css`: +12 dòng, một khối `@media(max-width:680px)` mới cho
  `.kpi.key .tag` (chuyển `position:static;display:inline-block;margin:0 0
  6px`) và `.kpi.key .lb{padding-right:0}`. Không sửa dòng nào cũ.
- `src/components/admin/ActivityViewer.tsx`: 1 dòng, thêm `{' '}` sau
  `{a.userName}`.
- `src/components/form/ImportPanel.tsx`: 1 dòng, thêm `{' '}` sau
  `</span>` đóng `font-medium`.

### 7.1. Hai cổng kiểm tra bắt buộc (chạy lại từ đầu, không dùng số cũ)

`npx tsc --noEmit` → **sạch, 0 lỗi.**

`npm test` → **545/545 xanh (31/31 file test)**, gồm:
```
Test Files  31 passed (31)
     Tests  545 passed (545)
```
- `ActivityViewer.test.ts`: **ĐỎ → XANH**, không sửa gì trong chính file test
  (đúng yêu cầu — Debugger sửa code sản phẩm để khớp test, không sửa ngược
  test để khớp code).
- `KpiCard.test.ts` (7 test): vẫn xanh, không bị ảnh hưởng (đúng — Debugger
  không đụng `KpiCard.tsx`).
- `legacy-style-guard.test.ts` (53 test): vẫn xanh — khối CSS mới không lỡ
  tay đưa `dark:`/hex thô/class Tailwind màu cũ nào vào.

### 7.2. BUG #1 — tự đo lại bằng Playwright thật (không đọc số của Debugger rồi tin)

Dựng lại `npm run dev` thật (`NODE_TLS_REJECT_UNAUTHORIZED=0` ngoài dòng lệnh,
không đụng repo), đăng nhập thật, tự viết script Playwright riêng (không copy
script của Debugger) quét `Range.getBoundingClientRect()` trên chữ nhãn thật
so với `.tag`, quét **10 mốc viewport** (360/375/390/410/430/679/680/681/700/720)
× **2 locale** (vi/en) = 20 phép đo trên `/vi/overview` và `/en/overview`:

| Viewport | vi: overlap? | en: overlap? | `.tag` position |
|---|---|---|---|
| 360–680px | Không (tag xuống dòng riêng, `verticalOverlap:false`) | Không | `static` |
| 681px trở lên | Không (dư 25.9–38.8px) | Không (dư 17.2–30.1px) | `absolute` |

Không có `tagClipped`/`labelClipped` (chữ không bị cắt cụt) ở bất kỳ mốc nào.
**Kết luận: hết đè hoàn toàn ở toàn bộ dải đã từng lỗi (360–430px) lẫn 2 điểm
biên mới (430px, 679/680/681px), cả 2 locale — khớp báo cáo của Debugger,
xác nhận bằng phép đo độc lập của chính tôi, không phải đọc lại số của họ.**

**Xem bằng mắt riêng ở đúng ranh giới 679↔681px** (theo yêu cầu "có nhảy
layout đột ngột xấu không"): tại 679px tag "TRỌNG TÂM" nằm gọn một dòng phía
trên nhãn "TRỄ TIẾN ĐỘ", đọc rõ; tại 681px tag trở lại góc phải trên cùng
hàng với nhãn (do đồng thời chuyển từ lưới 2 cột sang 3 cột ở đúng breakpoint
này). Thẻ hero **cao hơn** 2 thẻ KPI thường cùng hàng ở ≤680px (135px so với
~106px) do có thêm dòng tag — đây là đánh đổi hợp lý (thẻ không đều hàng
nhưng không đè chữ), không phải lỗi vỡ bố cục; chuyển tiếp giữa 2 kiểu bố cục
xảy ra gọn trong đúng 1 breakpoint, không giật/nhấp nháy qua vùng trung gian
nào. Kiểm thêm `/vi/report` (cùng component, mobile 375px) và `/vi/projects/1`
(nhãn "SPI" ngắn, mobile 375px) — cả hai đều nhất quán, tag xuống dòng sạch,
không có gì bất thường phát sinh.

### 7.3. BUG #2 — tự xem lại `/vi/admin` + `/vi/import` bằng mắt lẫn DOM thật

Không tin `{' '}` sẽ ra đúng 1 khoảng trắng (không thừa, không thiếu) — tự
kiểm `previousSibling`/`textContent` thật trên trang đã render:
- `/vi/admin`, cột "Người dùng" (3 dòng đầu bảng Lịch sử hoạt động):
  `previousSibling` của mỗi `<span class="en">` là text node `" "` (đúng 1
  ký tự trắng), `cellFullText` = `"Admin admin@daidung.com.vn"` — đúng, không
  thừa khoảng trắng.
- `/vi/import`: `label.textContent` = `"Chọn file Excel File .xlsx/.csv -
  cột: Mã SAP, Tên dự án, % TT"` — đúng 1 khoảng trắng giữa "Excel" và "File".
- Xem bằng mắt (ảnh chụp) cả 2 trang: chữ đọc bình thường, không còn dính
  liền, không có khoảng trắng kỳ lạ/thừa ở đâu khác trên trang.

**Kiểm không hồi quy ở 2 chỗ "an toàn"** (`Card.tsx`/`ProjectTable.tsx`,
Debugger nói không đụng): `getComputedStyle(...).gap` của `.card>.hd h3` vẫn
`8px` y nguyên, 3 tiêu đề card trên `/vi/overview` ("Xu hướng SPI/CPI...",
"Dự án cần lưu ý...", "Danh sách dự án...") vẫn hiện đúng, tách biệt rõ bằng
mắt — không bị ảnh hưởng bởi việc thêm `{' '}` ở 2 file khác.

### 7.4. Rà nhanh hồi quy diện rộng

Xem lại nhanh (không soi kỹ như vòng 1) các trang/điểm đã từng "ổn": KPI hero
ở `/vi/overview` desktop 1440px (y nguyên, không đổi thẩm mỹ so với vòng 1),
`/vi/alerts` (y nguyên, 0 console error thật — số "3 errors" trên thanh điều
hướng là cảnh báo Recharts còn sót từ trang trước, đã xác nhận cùng hiện
tượng ở vòng 1, không phải lỗi mới). Không phát hiện hồi quy nào ngoài phạm
vi 2 lỗi đã sửa.

### 7.5. Kết luận VÒNG 2

Cả 2 lỗi thật ở VÒNG 1 đã được sửa đúng, xác nhận **độc lập** (tự đo lại,
không chỉ đọc báo cáo Debugger), không phát sinh hồi quy mới trong phạm vi đã
rà. 3 quan sát ngoài phạm vi ở mục 3 (vòng 1) vẫn còn nguyên như cũ — đúng dự
kiến, Debugger không đụng tới (đúng phạm vi được giao).

**KẾT LUẬN CUỐI CÙNG: PASS.** Đủ điều kiện chuyển bước tiếp theo của dây
chuyền `ddc-tower:ship`. Đây là vòng test-debug thứ 2/2 theo giới hạn — nếu
sau này phát sinh lỗi mới, cần một vòng riêng, không tự động lặp lại.

---

## VÒNG 3 — Xác nhận độc lập bản vá CS-1 + CS-2 (commit `0c77fdd`)

Bối cảnh: sau VÒNG 2 (PASS), Reviewer chấm **CẦN SỬA** vì BUG #1 chưa hết thật
— bản vá cũ (`@media(max-width:680px)`) chỉ phủ ≤680px, còn đè ở desktop
1181–~1450px (laptop văn phòng 1280/1366) do lưới 6 cột không có container
giới hạn rộng. Coder vừa vá lại ở commit `0c77fdd` (`app/globals.css`: đổi từ
`@media(max-width:680px)` sang `@container (max-width: 210px)` gắn trên
`.kpi.key`) + `tailwind.config.ts` (CS-2, `transitionDuration` thiếu đơn vị).
Nhiệm vụ vòng này: đo lại **độc lập**, không tin số của Coder — tự đo
`overlapX` thật bằng `getBoundingClientRect()`/`Range` qua `mcp__playwright`
thật (đăng nhập thật), không chỉ nhìn `position` hay ảnh chụp.

**Skill đã dùng:** `ddc-tower:test-driven-development`,
`ddc-tower:verification-before-completion` (bắt buộc). Không gọi
`systematic-debugging` vì không có gì rớt/khó hiểu cần điều tra thêm — toàn
bộ số đo đều đúng kỳ vọng ngay từ lần đo đầu.

**Diff đã kiểm** (`git show 0c77fdd --stat`) — đúng 2 file, khớp mô tả
`thay-doi.md` mục 8: `app/globals.css` (khối `@container` mới thay `@media`
cũ) và `tailwind.config.ts` (1 dòng `transitionDuration`).

### 1. Môi trường đo

`npm run dev` thật (Next.js 14.2.15, `http://localhost:3000`), đăng nhập thật
qua UI (không set cookie tay):
- `admin@daidung.com.vn` / `Admin@***` — role `admin`, `canViewFinance:true`
  → 6 thẻ KPI (`.kpis`, lưới 6 cột) trên cả `/overview` và `/report`.
- `viewer@daidung.com.vn` / `Viewer@***` — `canViewFinance:false` → 5 thẻ
  KPI (`.kpis.k5`, lưới 5 cột) trên `/overview`, dùng để đo thêm biến thể k5
  cho đầy đủ như bảng gốc của Reviewer/Coder.

Đo bằng `mcp__playwright` thật (`browser_run_code_unsafe`, điều khiển trực
tiếp `page` Playwright thật đang mở, không phải tính tay) — script đầy đủ lưu
ở scratchpad phiên làm việc (không phải file repo), tóm tắt công thức bên
dưới.

**Công thức `overlapX`** (giống Reviewer/Debugger/Coder đã dùng): tạo
`Range` bọc trọn text node thật bên trong `.kpi.key .lb` (không phải
`getBoundingClientRect()` của cả `div.lb`, để không bị ảnh hưởng bởi
`padding-right`/`text-overflow:ellipsis` — Range phản ánh đúng bề rộng chữ
thật, kể cả khi bị cắt hình ảnh bởi `overflow:hidden`), rồi:
`overlapX = lbTextRect.right - tagRect.left`. Chỉ tính khi
`getComputedStyle(tag).position === 'absolute'` — lúc `.tag` là `static`
(nằm trong luồng, phía trên nhãn) thì về mặt cấu trúc không thể đè theo trục
X nữa, đánh dấu **"static — an toàn cấu trúc"** thay vì một con số.
overlapX > 0 nghĩa là còn đè; ≤ 0 là hết đè (số càng âm càng dư nhiều khoảng
trống).

### 2. Số đo overlapX — dải bắt buộc theo "Điều kiện đóng CS-1" của Reviewer

**56 tổ hợp bắt buộc**: 7 viewport (1181/1200/1280/1366/1440/1536/1920) ×
2 trạng thái sidebar (mở 236px / thu gọn 68px) × 2 locale (vi/en) × 2 trang
(`/overview` 6 thẻ role admin, `/report` 6 thẻ). Kết quả `/overview` và
`/report` **giống hệt nhau về số đo** ở từng locale (cùng cấu trúc lưới 6
cột, cùng chữ nhãn/tag `kpi.behindSchedule`/`kpi.focusTag`) — gộp chung 1
cột cho gọn, có ghi rõ đã đo riêng cả hai trang.

**Sidebar MỞ (236px):**

| Viewport | Rộng thẻ (vi) | vi (overview=report) | Rộng thẻ (en) | en (overview=report) |
|---|---|---|---|---|
| 1181 | 139.2px | static — an toàn | 139.2px | static — an toàn |
| 1200 | 142.3px | static — an toàn | 142.3px | static — an toàn |
| 1280 | 155.7px | static — an toàn | 155.7px | static — an toàn |
| 1366 | 170.0px | static — an toàn | 170.0px | static — an toàn |
| 1440 | 182.3px | static — an toàn | 182.3px | static — an toàn |
| 1536 | 198.3px | static — an toàn | 198.3px | static — an toàn |
| 1920 | 262.3px | absolute · **overlapX = -85.8px** | 262.3px | absolute · **overlapX = -77.1px** |

**Sidebar THU GỌN (68px):**

| Viewport | Rộng thẻ (vi) | vi (overview=report) | Rộng thẻ (en) | en (overview=report) |
|---|---|---|---|---|
| 1181 | 167.2px | static — an toàn | 167.2px | static — an toàn |
| 1200 | 170.3px | static — an toàn | 170.3px | static — an toàn |
| 1280 | 183.7px | static — an toàn | 183.7px | static — an toàn |
| 1366 | 198.0px | static — an toàn | 198.0px | static — an toàn |
| 1440 | 210.3px | static — an toàn | 210.3px | static — an toàn |
| 1536 | 226.3px | static — an toàn | 226.3px | static — an toàn |
| 1920 | 290.3px | absolute · **overlapX = -113.8px** | 290.3px | absolute · **overlapX = -105.1px** |

**Kết luận:** cả 56/56 tổ hợp bắt buộc đều **không đè** — `overlapX ≤ 0` ở mọi
ô có `.tag` là `absolute` (chỉ 1920px), còn lại `.tag` đã chuyển `static`
(nằm trong luồng, phía trên nhãn) nên không có gì để đè theo cấu trúc. Khớp
kết luận của Coder trong `thay-doi.md` mục 8.1 (số tuyệt đối lệch vài px so
với báo cáo Coder — vd 1920/vi/mở: -85.8px ở đây so với -93.1px của Coder —
do khác công cụ đo, Coder dùng Chrome DevTools Protocol thô không qua
Playwright, ở đây dùng Playwright thật với `deviceScaleFactor` mặc định khác;
chênh lệch nhỏ, không đổi kết luận, không có ô nào dương).

### 3. Bổ sung — lưới 5 cột (`k5`, role không xem tài chính)

Reviewer yêu cầu thêm biến thể k5 quanh 1181–1230px; đo đủ cả 7 viewport để
nhất quán. Đăng nhập `viewer@daidung.com.vn` (canViewFinance=false),
`/vi/overview`:

| Viewport | Sidebar mở | Sidebar thu gọn |
|---|---|---|
| 1181 | 169.5px · static | 203.1px · static |
| 1200 | 173.2px · static | 206.8px · static |
| 1280 | 189.2px · static | 222.8px · static |
| 1366 | 206.4px · static | 240.0px · static |
| 1440 | 221.2px · static | 254.8px · absolute · **overlapX = -78.3px** |
| 1536 | 240.4px · static | 274.0px · absolute · **overlapX = -97.5px** |
| 1920 | 317.2px · absolute · **overlapX = -140.7px** | 350.8px · absolute · **overlapX = -174.3px** |

Không có ô nào dương. Khớp bảng "vi/en · 5 cột (k5)" của Coder trong
`thay-doi.md` mục 8.1 (Coder cũng ghi nhận k5+sidebar thu gọn bắt đầu
`absolute` sớm hơn từ 1440px — đúng như đo được ở đây).

### 4. Quét hồi quy 360–720px (đề bài yêu cầu, tránh vá hỏng lại BUG #1 gốc)

`/vi/overview` + `/en/overview`, sidebar mặc định (mở), cả 2 locale:

| Viewport | Rộng thẻ | Trạng thái `.tag` | overlapX (vi / en) | Đè theo Y? |
|---|---|---|---|---|
| 360 | 149.0px | static | an toàn cấu trúc | không |
| 375 | 156.7px | static | an toàn cấu trúc | không |
| 390 | 164.0px | static | an toàn cấu trúc | không |
| 410 | 174.0px | static | an toàn cấu trúc | không |
| 430 | 184.0px | static | an toàn cấu trúc | không |
| 600 | 269.0px | absolute | -92.5 / -83.8 | có (nhưng X đã tách xa, không đè) |
| 680 | 309.0px | absolute | -132.5 / -123.8 | có (X vẫn tách xa) |
| 681 | 202.4px | static (chuyển 3 cột) | an toàn cấu trúc | không |
| 700 | 208.7px | static | an toàn cấu trúc | không |
| 720 | 215.3px | static | an toàn cấu trúc | không |

Ghi chú "Đè theo Y?": ở 600/680px `.tag` là `absolute` và cùng dải chiều cao
với `.lb` (2 hộp có overlap trục Y), nhưng `overlapX` âm rất sâu
(-83…-132px) nên **không hề đè nhau trên màn hình thật** — tag nằm lệch hẳn
sang phải, cách xa mép chữ nhãn. Không hồi quy: dải 360–430px (đúng dải BUG
#1 gốc mà Debugger từng vá ở vòng 1/2) vẫn an toàn 100%.

### 5. Thẩm mỹ ở dải thẻ hẹp (mục quan sát, không phải lỗi kỹ thuật)

Đúng như Coder ghi trong `thay-doi.md` mục 8.4 — chụp ảnh thật xác nhận: ở
`/vi/overview` 1280px (sidebar mở), thẻ "TRỌNG TÂM/TRỄ TIẾN ĐỘ" hiện tag nằm
**trong luồng, phía trên** nhãn (không còn ở góc phải trên cùng như mock-up
gốc), khiến thẻ cao hơn 5 thẻ KPI thường cùng hàng — bố cục không đều hàng
nhưng đọc rõ ràng, không đè chữ, không vỡ layout. Ở 1920px (cả sidebar mở lẫn
thu gọn) tag trở lại đúng góc phải trên như mock-up gốc (thẻ đủ rộng để vượt
ngưỡng `@container`). Đánh giá của Tester: **chấp nhận được** — đây là đánh
đổi có chủ ý (ưu tiên không đè chữ hơn giữ đúng vị trí góc ở dải thẻ hẹp),
đúng phương án (a) Reviewer đã khuyến nghị; không phải lỗi cần chặn merge,
nhưng nếu chủ dự án khó chịu với việc 3 mốc laptop phổ biến
(1280/1366/1440px, sidebar mở) không đều hàng thẻ thì có thể cân nhắc lại
phương án (b) của CS-1 sau này (như Coder đã ghi chú).

Ảnh chụp đã lưu (không phải file repo):
`.playwright-mcp/cs1-1280-kpis.png`, `.playwright-mcp/cs1-1366-report.png`,
`.playwright-mcp/cs1-1920-collapsed.png`.

### 6. CS-2 — xác nhận không hồi quy hiển thị

`getComputedStyle()` thật trên phần tử dùng `.duration-fast` (nút bánh răng
`SettingsMenu`): `transitionDuration === "0.18s"` — hợp lệ, không còn chuỗi
`"180"` thiếu đơn vị bị trình duyệt bỏ qua. Quan sát bằng mắt: hover/focus
trên các nút dùng `duration-fast` (bánh răng, input, switch...) chuyển màu
mượt, không giật, không nhảy khung hình. Không phát hiện hồi quy hiển thị nào
liên quan CS-2.

### 7. Console/crash smoke-test

Toàn bộ điều hướng qua `/vi/overview`, `/vi/report`, `/en/overview`,
`/en/report` (cả 2 role, nhiều viewport) không phát sinh lỗi JS runtime nào
ngoài **đúng 3 cảnh báo Recharts đã biết từ trước** (`defaultProps` deprecated
trên `XAxis`/`YAxis`/`ReferenceLine`) — xác nhận bằng
`mcp__playwright__browser_console_messages`, đối chiếu với ghi nhận y hệt ở
VÒNG 2 mục 7.4 ("cảnh báo Recharts còn sót... không phải lỗi mới"). Không
trang nào crash, không màn trắng, không lỗi hydration.

### 8. Hai cổng kiểm tra bắt buộc (chạy lại từ đầu, không dùng số cũ)

`npx tsc --noEmit` → **sạch, 0 lỗi.**

`npm test` → **545/545 xanh (31/31 file test)** — không đổi số so với VÒNG 2
(đúng như Reviewer ghi nhận: CS-1/CS-2 là lỗi hình học/CSS-build mà bộ test
Vitest hiện có không bắt được, nên số lượng test không đổi):
```
Test Files  31 passed (31)
     Tests  545 passed (545)
```

### 9. Kết luận VÒNG 3

Không có tổ hợp nào overlapX dương trong toàn bộ **90 điểm đo** (56 tổ hợp
bắt buộc + 14 điểm k5 bổ sung + 20 điểm hồi quy 360–720px), cả 2 locale, cả 2
trạng thái sidebar, cả `/overview` lẫn `/report`, cả lưới 6 cột lẫn 5 cột.
Xác nhận **độc lập** bằng Playwright thật (đăng nhập thật, không đọc số của
Coder rồi tin) — số tuyệt đối lệch nhẹ so với báo cáo Coder (khác công cụ đo:
Playwright thật ở đây, CDP thô của Coder do sandbox không cài được
`playwright` qua npm registry) nhưng **cùng kết luận ở mọi ô**: không có ô
nào dương. `npx tsc --noEmit` sạch, `npm test` 545/545 xanh, không console
error mới, không hồi quy 360–720px, CS-2 xác nhận hiển thị mượt không giật.

**KẾT LUẬN CUỐI CÙNG VÒNG 3: PASS.** CS-1 đã hết đè thật ở toàn bộ dải yêu
cầu (1181–1920px) lẫn dải đã PASS trước đó (360–720px), cả sidebar mở/thu
gọn, cả 6 cột/5 cột, cả vi/en. CS-2 xác nhận không gây hồi quy hiển thị. Đủ
điều kiện gửi lại Reviewer để chốt merge. Ghi chú duy nhất không chặn: hiệu
ứng thẩm mỹ tag nằm trong luồng ở dải 1181–~1595px (mục 5) — đáng để chủ dự
án nhìn qua một lần, không phải lỗi kỹ thuật.

---

## VÒNG 4 — Xác nhận CS-3: bật thật motion engine spring (commit `9941505`)

Bối cảnh: sau VÒNG 3 (PASS, CS-1/CS-2), chủ dự án chọn phương án "bật thật"
cho CS-3. Coder gắn `useRise` vào 4 lưới `.kpis` (rise-in khi trang tải),
`useHoverLift` vào `Card.tsx` (nhấc nhẹ khi hover), `usePressable` vào nút
đăng nhập chính (co lại khi bấm), đồng thời vá 3 lỗi kỹ thuật trong
`motion.ts` (cleanup rAF/timeout, huỷ spring chồng nhau) — xem
`.bangiao/thay-doi.md` mục 9. Nhiệm vụ vòng này: kiểm bằng mắt thật qua
Playwright vì animation không tự động hoá kiểm tra được bằng assert số.

**Skill đã dùng:** `ddc-tower:test-driven-development`,
`ddc-tower:verification-before-completion` (bắt buộc). Có gọi thử
`ddc-tower:qa` theo gợi ý routing "QA web → qa/qa-only", nhưng skill đó là bộ
máy "gstack" tự động SỬA code sản phẩm (Fix Loop) — xung đột trực tiếp với
ràng buộc của vai Tester ở đây ("chỉ được sửa file test, không đụng code sản
phẩm"), nên bỏ phần Fix Loop, chỉ dùng trực tiếp `mcp__playwright` theo đúng 8
mục việc cần làm được giao. Không gọi `systematic-debugging` vì không có gì
rớt cần điều tra — mọi quan sát đều lý giải được ngay bằng cách đọc code +
đo lại bằng công cụ khác.

**mcp__postgres:** đọc read-only `dim_project` (=17, khớp đúng số "17 dự án"
hiển thị trên UI) sau khi đăng nhập/đăng xuất nhiều lần trong lúc test — xác
nhận việc test (chỉ xem trang, hover, click cài đặt, không sửa dữ liệu) không
vô tình đổi dữ liệu nào. Việc này thuần UI/motion, không đụng migration nào.

### 1. Môi trường

`npm run dev` thật (không cần `NODE_TLS_REJECT_UNAUTHORIZED=0` lần này — máy
test không bị chặn proxy như coder từng gặp), đăng nhập thật qua UI bằng
`admin@daidung.com.vn` / `Admin@***`. HEAD tại `9941505` (đúng commit CS-3),
`git status` sạch (chỉ còn file `.bangiao/*` chưa track, không đụng code sản
phẩm).

### 2. Rise-in ở `/vi/overview` — xác nhận animation THẬT đang chạy

Không tin ảnh chụp đơn (animation quá ngắn để mắt bắt được qua screenshot).
Dùng `mcp__playwright__browser_run_code_unsafe` cài `MutationObserver` quan
sát thuộc tính `style` của mọi `.kpi` ngay từ `addInitScript` (trước khi React
hydrate), ghi lại từng lần `el.style.opacity`/`el.style.transform` đổi kèm
timestamp thật.

**Kết quả đo được** (6 thẻ KPI, giá trị `opacity`/`transform` theo thời gian
thật sau khi mount):
```
t=1269ms  opacity:0     transform:translate3d(0,14px,0)   <- set dong bo luc mount
t=2678ms  opacity:0.12  transform:translate3d(0,12.29px,0)
t=3694ms  opacity:0.33  transform:translate3d(0,9.32px,0)
t=4710ms  opacity:0.54  transform:translate3d(0,6.45px,0)
t=5727ms  opacity:0.70  transform:translate3d(0,4.16px,0)
t=6760ms  opacity:0.82  transform:translate3d(0,2.52px,0)
t=7759ms  opacity:0.90  transform:translate3d(0,1.43px,0)
```
Đường cong hoàn toàn khớp công thức spring vật lý trong `motion.ts` (opacity
tăng dần về 1, `translateY` giảm dần về 0, đơn điệu, không giật lùi) — xác
nhận **rise-in đang chạy thật**, đúng cơ chế mô tả ở `thay-doi.md` mục 9.1,
không phải hiệu ứng CSS xấp xỉ.

**Phát hiện phụ (không chặn merge, cần báo Reviewer):** máy test này khiến
`requestAnimationFrame` trên trang `/vi/overview` (Next.js dev mode, nhiều
Recharts + HMR) bị nghẽn nặng — đo trực tiếp bằng cách patch `rAF` toàn cục:
chỉ ~35–115 lần gọi/2 giây (thay vì ~120 lần/2 giây bình thường, đã xác nhận
baseline 58fps trên trang `about:blank` trống — môi trường trình duyệt không
hỏng, chỉ riêng trang nặng này bị nghẽn main thread). Vì `spring()` tính bước
vật lý dựa trên `dt` thật giữa 2 lần rAF (kẹp tối đa 1/30s mỗi bước), khi rAF
hiếm đến mức này, animation cần ~7-8 GIÂY thực tế mới hoàn tất thay vì
~300–460ms như thiết kế. Quan trọng hơn: cơ chế "failsafe" 900ms trong
`riseIn()` (dòng ghi chú "neu rAF khong chay... tra lai hien thi sau 900ms")
**đã bắt được đúng kịch bản nó không lường tới** — tại t≈2180ms (900ms sau
lúc mount), failsafe kích hoạt, xoá `style` về mặc định (opacity đầy, không
transform) đúng như thiết kế, NHƯNG vì spring gốc chưa hề bị huỷ (chỉ đang bị
rAF nghẽn, không phải rAF ngừng hẳn), lần rAF tiếp theo (t≈2678ms) LẠI ghi đè
`opacity:0.12`/`transform:...12.29px` lên trên — tức thẻ vừa hiện đầy đủ do
failsafe thì ngay sau đó lại mờ/tụt xuống lại theo giá trị animation cũ, tạo
hiệu ứng "chớp sáng rồi mờ lại" một lần. Đây CHỈ xảy ra khi rAF bị nghẽn tới
mức bất thường (900ms+ không có một khung hình thật nào tiến triển đáng kể) —
kịch bản thực tế gần nhất với chú thích gốc "tab an, snapshot" của coder,
nhưng ở đây xảy ra trên tab đang hiện (không ẩn) do tải CPU dev-mode nặng.
Rất khó xảy ra ở bản production (bundle nén, không HMR) hoặc máy người dùng
bình thường, nhưng là một khoảng hở thiết kế thật của `riseIn()`: failsafe
ghi `style` một lần rồi không có cơ chế "khoá" để ngăn spring cũ ghi đè lại
sau đó — nên báo lại Reviewer để cân nhắc (không nhất thiết phải chặn merge).

### 3. Hover lift trên `Card.tsx` (không phải KPI) — không giật, không xung đột CSS

Đọc `app/globals.css` dòng 210–213: `.card-hover`/`.card-hover:hover` chỉ còn
`box-shadow`, không còn `transform` — xác nhận đúng mô tả coder (mục 9.3),
không còn 2 cơ chế tranh nhau ghi `transform`.

Dùng chuột thật (`page.mouse.move` tới tâm 1 Card có `.hd` ở `/vi/overview`,
không phải `.kpi`) + `MutationObserver` trên `style` của chính thẻ đó:
```
t=3823ms  translate3d(0, 0px, 0)      <- frame dau, chua di chuyen
t=4838ms  translate3d(0, -0.55px, 0)
t=5858ms  translate3d(0, -1.42px, 0)
t=6872ms  translate3d(0, -3px, 0)     <- toi dich (dy=3, dung mac dinh)
t=7888ms  translate3d(0, -2.63px, 0) <- da ro chuot ra, dang tra ve
t=8931ms  translate3d(0, -2px, 0)
t=9921ms  translate3d(0, -1.38px, 0)
```
Đơn điệu, đúng hướng (nhấc lên khi hover, hạ xuống khi rời chuột), không có
giá trị nhảy/giật ngược giữa đường — xác nhận hover lift chạy đúng, không bị
CSS `:hover` cũ tranh chấp.

### 4. Press trên nút "Đăng nhập" — co lại rồi bật về

Chặn `click` mặc định (để không bị chuyển trang giữa lúc đo) rồi dùng
`page.mouse.down()`/`up()` thật + `MutationObserver`:
```
mousedown  t=2021ms  scale(1)
           t=3037ms  scale(0.99491)      <- dang co lai huong ve 0.972
mouseup    t=4071ms  scale(0.99491)
           t=5070ms  scale(0.995741)     <- dang bat ve huong ve 1
           t=6087ms  scale(0.997323)
```
Đúng hướng: bấm co lại về gần `scaleTo=0.972`, thả ra bật về gần 1, không
giật/đứng hình. Đã xác nhận thêm bằng lần bấm THẬT (không chặn click): nút
đăng nhập submit thành công, chuyển trang qua overview êm, không lỗi.

### 5. Chuyển trang nhiều lần — không tích tụ lỗi/giật hình

Đăng nhập → overview → projects/1 → overview → projects/2 → overview →
report → overview (7 lượt điều hướng bằng `mcp__playwright__browser_navigate`
thật, có đăng xuất/đăng nhập lại giữa chừng để kiểm luôn hiệu ứng press thật ở
bước 4). Kiểm `mcp__playwright__browser_console_messages` sau cùng: **đúng 3
cảnh báo Recharts `defaultProps` đã biết từ trước** (khớp y hệt VÒNG 2/VÒNG 3,
không phải lỗi mới) + không có lỗi/warning nào khác. Không có dấu hiệu rò rỉ
`requestAnimationFrame`/`setTimeout` tích tụ (không có warning "Maximum
update depth", không có lỗi gọi setState trên component đã unmount).

### 6. `prefers-reduced-motion: reduce`

`page.emulateMedia({ reducedMotion: 'reduce' })` rồi tải lại `/vi/overview`:
- `matchMedia('(prefers-reduced-motion: reduce)').matches === true` (xác nhận
  cờ được áp đúng).
- Rise-in: **0 mutation nào** ghi nhận trên `.kpi` trong suốt 1.5s sau tải —
  đúng vì `riseIn()` phát hiện `reducedMotion()` thì set `opacity`/`transform`
  về rỗng ngay (không animate) và trả về no-op. Đọc lại `style` của cả 6 thẻ
  sau khi tải: **đều `null`** (không có `style` attribute nào sót lại) — xác
  nhận **không bị kẹt ở trạng thái `opacity:0`/scale giữa đường**, đúng yêu
  cầu đề bài.
- Hover: vẫn phản hồi nhưng NHẢY THẲNG tới giá trị đích
  (`translate3d(0,-3px,0)` ngay, không có bước trung gian) — do `spring()`
  cũng tôn trọng `reducedMotion()`, gọi `onUpdate(to)` một lần rồi dừng. Đây
  là hành vi ĐÚNG theo tinh thần `prefers-reduced-motion` (bỏ hoạt ảnh
  chuyển động, giữ lại phản hồi trạng thái) — **motion engine tôn trọng cờ
  này đầy đủ ở cả 3 hook, không phải vấn đề accessibility cần báo.**

### 7. `.wall` (4 quả cầu mờ nền) — vẫn đứng yên (Q6)

`getComputedStyle()` trên cả 4 phần tử `.wall b`: `animationName: "none"`,
`animationDuration: "0s"`, `transform: matrix(1,0,0,1,0,0)` (identity, không
lệch). Đo `getBoundingClientRect().left` 2 lần cách nhau 1.5 giây: **giá trị
giống nhau tuyệt đối (không nhúc nhích)**. Xác nhận CS-3 không vô tình làm
`.wall` động lại — Q6 vẫn đứng yên đúng như đã chốt.

### 8. Hai cổng kiểm tra bắt buộc

`npx tsc --noEmit` → **sạch, 0 lỗi.**

`npm test` → **546/546 xanh (31/31 file test)** — khớp đúng số coder báo cáo
ở `thay-doi.md` mục 9.4 (tăng đúng 1 test so với 545/545 vì
`legacy-style-guard.test.ts` tự động quét thêm `Rise.tsx` mới):
```
Test Files  31 passed (31)
     Tests  546 passed (546)
```

### 9. Regression nhanh CS-1/CS-2 (không đo lại đầy đủ 90 điểm, chỉ soát nhanh)

- 1280px: rộng thẻ hero 155.67px, `.tag` vẫn `position:static` (an toàn cấu
  trúc) — khớp số đo VÒNG 3 (155.7px).
- 1366px: rộng thẻ hero 170px, `.tag` vẫn `static` — khớp số đo VÒNG 3
  (170.0px). Không hồi quy CS-1.
- CS-2: `getComputedStyle(...).transitionDuration` trên phần tử dùng
  `duration-fast` = `"0.18s"` — hợp lệ, không hồi quy về chuỗi thiếu đơn vị.

### 10. Trạng thái dữ liệu sau test (mcp__postgres, read-only)

`SELECT count(*) FROM dim_project` = **17** — khớp đúng số "17 dự án" hiển
thị trên UI trước và sau toàn bộ lượt test (nhiều lần đăng nhập/đăng xuất,
hover, click, chuyển trang). Xác nhận việc test không vô tình đổi dữ liệu.

### 11. Kết luận VÒNG 4

**PASS.** Cả 3 hook motion engine (`useRise`, `useHoverLift`, `usePressable`)
chạy đúng, đúng hướng, đúng công thức spring, không xung đột CSS, không kẹt
trạng thái trung gian. `prefers-reduced-motion: reduce` được tôn trọng đầy đủ
ở cả 3 hook. `.wall` vẫn đứng yên (Q6). Chuyển trang nhiều lần không tích tụ
lỗi console/rò rỉ rAF. `tsc`/`npm test` xanh sạch, khớp số coder báo cáo.
CS-1/CS-2 không hồi quy.

**Ghi chú KHÔNG CHẶN nhưng cần báo Reviewer:** mục 2 — failsafe 900ms trong
`riseIn()` có thể bị spring gốc (đang chạy chậm do main thread nghẽn nặng,
quan sát được trong `next dev` với nhiều Recharts + HMR) ghi đè lại ngay sau
khi kích hoạt, gây chớp sáng-rồi-mờ-lại một lần. Rất khó xảy ra ở production
build hoặc máy bình thường (chỉ tái hiện được khi ép rAF xuống ~1 lần/giây),
nhưng là một khoảng hở thiết kế thật (failsafe không "khoá" để ngăn spring cũ
ghi đè lại) — đáng để Reviewer cân nhắc, không nhất thiết phải chặn merge.

---

## VÒNG 5 — Xác nhận CAN SUA 2/2: B-1..B-5 (Reviewer vòng 2, commit `1e34b26`)

Bối cảnh: sau VÒNG 4 (PASS CS-3), Reviewer soát lại toàn nhánh và chấm **CẦN
SỬA** ở "VÒNG 2" của `danh-gia.md` — tìm ra 4 điểm thoái lui so với `main`
(B-1, B-2, B-3, B-4) mà Reviewer tự nhận là bỏ sót ở vòng chấm trước, cộng 1
điểm failsafe-race đã biết từ VÒNG 4 nhưng gộp vá luôn (B-5). Coder vá đúng 5
điểm này ở commit `1e34b26`, đây là vòng CAN SUA thứ **2/2** theo giới hạn ghi
trong `danh-gia.md`.

**Skill đã dùng:** `ddc-tower:test-driven-development`,
`ddc-tower:verification-before-completion` (bắt buộc theo đề bài, tên đầy đủ
`ddc-tower:superpowers__test-driven-development` bị trùng tên nên phải gọi
lại bằng tên có prefix `ddc-tower:`). Không gọi `qa`/`qa-only` vì đề bài đã
chỉ định cụ thể dùng `mcp__playwright` trực tiếp cho việc xem bằng mắt +
`mcp__postgres` cho việc tìm dữ liệu thật; không gọi `systematic-debugging` vì
không có gì rớt/khó hiểu cần điều tra — mọi kỳ vọng đều đúng ngay từ lần đo
đầu, kể cả 2 log lỗi `MutationObserver` cuối bài (tự lý giải ngay: là artefact
từ script đo B-5 của chính phiên này còn dính lại qua `addInitScript`, không
phải lỗi ứng dụng — xem mục 6).

**mcp__postgres (read-only):** dùng để tìm dữ liệu thật phục vụ B-1/B-2 (dự án
null SPI/CPI, dự án ở biên ngưỡng 0.85–0.95) trước khi mở Playwright — tránh
đoán mò; và dùng lại ở cuối để xác nhận `SELECT count(*) FROM dim_project` vẫn
= 17, không có ghi/xoá dữ liệu nào trong lúc test (việc này thuần UI/đọc dữ
liệu, không có migration).

**Diff đã kiểm** (đọc trực tiếp `KpiCard.tsx`, `KpiCard.test.ts`,
`ProjectTable.tsx`, `report/page.tsx`, `app/globals.css`, `motion.ts` ở HEAD
`1e34b26`) — khớp đúng mô tả `thay-doi.md` mục 10, đúng 6 file, không đụng gì
ngoài phạm vi B-1..B-5.

### 1. Môi trường

Dev server thật đã có sẵn ở đầu phiên (`npm run dev`, session trước để lại),
dùng ngay để test B-1/B-2/B-3/B-4 qua session đăng nhập `admin@daidung.com.vn`
còn hiệu lực. Server này chết giữa lúc đo B-3 (không rõ nguyên nhân, có thể do
phiên trước đã đóng) — đã tự khởi động lại bằng
`NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev` (lý do TLS giống mục 3.2
`thay-doi.md`: proxy sandbox chặn cert tự ký của `next/font/google`), không
đụng gì trong repo. Trước khi build (mục 7), đã tắt hẳn dev server (`taskkill`
tiến trình đang `LISTENING` ở cổng 3000) vì `.next/trace` bị khoá file
(`EPERM`) khi 2 tiến trình Next.js cùng chạy — không phải lỗi code.

### 2. B-1 + B-2 — chip SPI/CPI null-safe, ngưỡng đồng bộ `/overview` ↔ `/report`

**Tìm dữ liệu thật qua `mcp__postgres`** (không đoán): join `dim_project` với
`fact_progress_monthly` tại tháng hiện tại (`2026-09`, xác nhận bằng
`SELECT to_char(current_date,'YYYY-MM')`):
- Dự án id=17 (SÂN BAY QUẢNG TRỊ, mã `12626-023`): `spi=0.0`, `cpi=NULL` ở
  tháng hiện tại — CPI null có thật trong seed hiện tại (không cần giả lập).
- Cùng dự án, ở 3 tháng cũ hơn (2025-10/11/12): **cả spi và cpi đều NULL** —
  case "chưa có SPI/CPI" đầy đủ có thật trong seed, nhưng chỉ truy cập được
  qua `/overview?month=2025-10` (param `month` có hỗ trợ); `/report` hardcode
  `currentMonth()` (đọc code `report/page.tsx:31`), không có tham số tháng
  nên KHÔNG thể tái hiện case cả-hai-null trên `/report`. Ghi rõ theo đúng yêu
  cầu đề bài: **seed hiện tại chỉ cho phép kiểm case cả-hai-null trên
  `/overview`; trên `/report` chỉ kiểm được case CPI-null (SPI vẫn có giá
  trị)** — nhưng vì `report/page.tsx` (B-2) và `ProjectTable.tsx` (B-1) dùng
  đúng cùng công thức `x == null ? 'neutral' : x < THRESHOLDS.xWarn ? 'warn' :
  'ok'`, case CPI-null đã kiểm được trên CẢ HAI trang là đủ để xác nhận cách
  vá giống nhau, không lệch.
- Dự án id=8 (Cầu Ống Lồng, mã `10624-015`): `spi=0.9499999999999998`,
  `cpi=1.1` — đúng biên ngưỡng 0.85–0.95 theo yêu cầu đề bài (0.95 chỉ nhích
  trên ngưỡng `THRESHOLDS.spiWarn=0.9`).

**Đo bằng Playwright thật** (đọc `span.chip` className qua
`browser_evaluate`, không đọc bằng mắt suông):

| Dự án | Trang | SPI hiện | className SPI | CPI hiện | className CPI |
|---|---|---|---|---|---|
| id 17, tháng 2026-09 | `/vi/overview` | 0.00 | `chip c-warn` | `-` | `chip c-plain` |
| id 17, tháng 2026-09 | `/vi/report` | 0.00 | `chip c-warn` | `-` | `chip c-plain` |
| id 17, tháng 2025-10 (cả 2 null) | `/vi/overview?month=2025-10` | `-` | `chip c-plain` | `-` | `chip c-plain` |
| id 8 (biên 0.95) | `/vi/overview` | 0.95 | `chip c-ok` | 1.10 | `chip c-ok` |
| id 8 (biên 0.95) | `/vi/report` | 0.95 | `chip c-ok` | 1.10 | `chip c-ok` |

**Kết luận B-1/B-2:** đúng yêu cầu đóng — dự án null ra chip **trung tính**
(`c-plain`, KHÔNG phải `c-ok` xanh giả như lỗi cũ) ở cả hai trang; dự án ở
biên ngưỡng ra **cùng màu** ở cả `/overview` và `/report` (0.95 > 0.9 nên cả
hai đúng ra `c-ok`, không còn lệch nhau như lỗi B-1/B-2 mô tả trong
`danh-gia.md`). Không thêm mức `danger` mới nào (đúng cảnh báo reviewer không
mở rộng nghiệp vụ).

### 3. B-3 — hero KPI "Trọng tâm" đổi màu chữ theo tone

Đo `style`/`getComputedStyle(...).color` thật của `.kpi.key .vl` qua
`browser_evaluate`:

| Trang | Dự án/SPI | tone | style inline | computedColor |
|---|---|---|---|---|
| `/vi/projects/1` (SPI 0.79, warn) | light | warn | `color:var(--gold)` | `rgb(245,179,1)` |
| `/vi/projects/1` (SPI 0.79, warn) | **dark** (`data-theme=dark`) | warn | `color:var(--gold)` | `rgb(245,179,1)` (không đổi — đúng vì `--gold` không có override dark, xác nhận `bg` đã chuyển `rgb(10,16,32)` = `#0a1020` nên `data-theme=dark` áp đúng) |
| `/vi/projects/8` (SPI 0.95, ok) | light | ok | không có `style` | `rgb(255,255,255)` (trắng, kế thừa nền gradient) |
| `/vi/overview` (KPI "Trễ tiến độ", tone="warn" cố định) | light | warn | `color:var(--gold)` | `rgb(245,179,1)` |
| `/vi/report` (cùng KPI) | light | warn | `color:var(--gold)` | `rgb(245,179,1)` |

Đã chụp ảnh `b4-collapsed-1280-after.png` (dùng lại cho B-4, xem mục 4) cho
thấy trực quan luôn: thẻ "TRỌNG TÂM/TRẺ TIẾN ĐỘ" hiện số "11" màu vàng gold
rõ ràng trên nền gradient navy.

**Kết luận B-3:** đúng yêu cầu đóng — SPI < 0.9 (tone warn do trang truyền)
ra chữ vàng, SPI ≥ 0.9 (tone ok) vẫn chữ trắng, đúng ở cả light và dark. Hệ
quả phụ đã biết trước (hero cố định `tone="warn"` ở `/overview`/`/report`
cũng chuyển vàng) xác nhận đúng như `thay-doi.md` mục 10.3 khai — đây là chủ
ý, không phải lỗi, để chủ dự án xem qua nếu muốn đổi ý.

### 4. B-4 — sidebar thu gọn không còn rò sang drawer mobile

Tái hiện đúng kịch bản lỗi cũ: `/vi/overview` ở 1280px (desktop) → bấm nút
thu gọn (`aria-label="Lọc"`, tên sai từ trước, ngoài phạm vi) → xác nhận
`.side` có class `is-collapsed`, `getComputedStyle(...).width = 67.9977px`
(đúng 68px). Thu cửa sổ xuống 768px (<1024px, chế độ drawer) → đo lại:
`.side` VẪN có class `is-collapsed` (React state không đổi, đúng thiết kế)
nhưng `getComputedStyle(...).width = 235.995px` — **đủ 236px, KHÔNG còn kẹt ở
68px** như lỗi cũ, vì rule `.side.is-collapsed{width:68px}` giờ đã bọc trong
`@media(min-width:1024px)` (đọc lại đúng `app/globals.css:103-112`). Bấm
hamburger để mở drawer: `transform: none` (hiện ra), nhãn nav (`.nav span`)
và tên app (`.brand .nm`) đều `display:block` (không bị ẩn theo kiểu
`is-collapsed` ở desktop) — chụp ảnh `b4-drawer-open-768.png` xác nhận bằng
mắt: drawer mở đủ rộng, đọc rõ toàn bộ nhãn menu, nền trang phía sau bị làm
mờ đúng token kính, không có gì bị cắt/kẹt.

Đóng drawer, kéo cửa sổ trở lại 1280px: `.side` vẫn `is-collapsed` (giữ
trạng thái thu gọn cũ, không bị reset), `width` trở lại đúng 67.9977px (68px)
— chụp ảnh `b4-collapsed-1280-after.png` xác nhận: sidebar icon-only gọn gàng
ở desktop, không hồi quy hành vi cũ (đúng như trước khi thu nhỏ cửa sổ).

**Kết luận B-4:** đúng yêu cầu đóng — không còn kẹt 68px khi mở drawer mobile
sau khi từng thu gọn ở desktop; trạng thái thu gọn không bị mất khi qua lại
ranh giới 1024px.

### 5. B-5 — failsafe không còn gây chớp-sáng-rồi-mờ-lại

**Đọc code trước (theo đúng yêu cầu đề bài — không chỉ tin quan sát mắt):**
`src/components/ui/motion.ts` dòng 117 khai báo
`const cancelSprings: Array<() => void> = []` **TRƯỚC** dòng 122
`setTimeout(...)`, và trong vòng lặp failsafe (dòng 122-130) đã đổi thành
`els.forEach((el, i) => { if (...) { cancelSprings[i]?.(); el.style.opacity =
''; ... } })` — gọi huỷ spring gốc `cancelSprings[i]?.()` NGAY TRƯỚC khi xoá
style. Đúng thứ tự khắc phục root cause reviewer chỉ ra (huỷ trước khi gán
giá trị cuối), không chỉ đảo vị trí khai báo cho có.

**Đo thực nghiệm bổ sung** (throttle CPU 8x qua CDP `Emulation.
setCPUThrottlingRate`, `MutationObserver` gắn `data-*` tag riêng cho từng
phần tử `.kpi` để phân biệt, ghi lại toàn bộ chuỗi `opacity` theo thời gian
thật từ lúc mount): trong ~420 lần ghi nhận trên 7 phần tử `.kpi` khác nhau,
sau khi một phần tử được failsafe xoá `style` (`opacity:""`), **không có lần
ghi nhận nào sau đó rơi xuống lại dưới `opacity < 0.999`** — ngoại trừ 2 dòng
log gắn nhãn "id: undefined" (do lỗi đo đạc của chính script tôi viết: 2
phần tử bị gộp chung khi `dataset.__idx` chưa kịp gán ở đúng microtask đầu,
không phải 2 phần tử thật khác nhau), chênh lệch 0.997 so với 1 (0.3%,
1ms sau khi clear) — **không phải hiện tượng "chớp-sáng-rồi-mờ-lại" thật**
(đó cần một giá trị RÕ RÀNG thấp như 0.12 ghi đè lên sau khi đã clear, đúng
mô tả lỗi cũ ở VÒNG 4 mục 2 của file này) mà là nhiễu đo đạc do
MutationObserver batch 2 mutation liền kề không đúng thứ tự tuyệt đối — đã
cẩn thận không báo nhầm thành lỗi thật theo đúng lưu ý của đề bài.

**Lưu ý đã tuân thủ:** không gặp hiện tượng "kẹt ở opacity dở dang nhiều
giây" trong lần đo này (tab luôn ở foreground trong suốt phép đo, đã xác
nhận bằng `page.waitForTimeout` liên tục có mutation ghi nhận đều, không có
khoảng trống bất thường >1s nào).

**Kết luận B-5:** code đã sửa đúng gốc rễ (huỷ trước khi gán), số đo thực
nghiệm không phát hiện flash-rồi-mờ nào ở throttle 8x — đủ điều kiện đóng.

### 6. Console/crash smoke-test (đề bài yêu cầu vì B-4/B-5 đụng UI)

Sau khi khởi động lại dev server thật, mở `/vi/overview`: **5 lỗi console**,
trong đó 3 là cảnh báo Recharts `defaultProps` đã biết từ trước (khớp y hệt
VÒNG 2/3/4), và **2 lỗi `MutationObserver: parameter 1 is not of type
'Node'`** — xác nhận đây là dư lượng từ chính script `addInitScript` tôi gắn
vào ở mục 5 (B-5) chưa được dọn khi `page.goto` lại lần sau trong cùng
browser context (init script tồn tại qua điều hướng, chạy lại và cố `observe`
trước khi DOM sẵn sàng ở lần load mới) — không phải lỗi của ứng dụng, không
tính vào phán quyết. Không trang nào crash, không màn trắng, không lỗi
hydration mới nào của riêng B-1..B-5.

### 7. Ba cổng kiểm tra bắt buộc (chạy lại từ đầu, không dùng số cũ)

`npx tsc --noEmit` → **sạch, 0 lỗi.**

`npm test` → **548/548 xanh (31/31 file test)** — đúng khớp số coder báo cáo
ở `thay-doi.md` mục 10.6 (tăng đúng 2 so với 546/546 VÒNG 4, đúng bằng 2 case
mới của B-3 trong `KpiCard.test.ts`):
```
Test Files  31 passed (31)
     Tests  548 passed (548)
```

`npm run build` → **biên dịch + type-check + generate static pages thành
công, 0 lỗi.** (Lần đầu chạy bị `EPERM` do dev server cũ vẫn giữ khoá
`.next/trace` — đã `taskkill` tiến trình đang nghe cổng 3000 trước khi build
lại, không phải lỗi code; đây là lần build đầu tiên độc lập của Tester kể từ
khi `Card.tsx`/`Rise.tsx` thành Client Component ở CS-3, đúng yêu cầu
reviewer ở mục 6.2 của `danh-gia.md`.)

### 8. Trạng thái dữ liệu sau test (mcp__postgres, read-only)

`SELECT count(*) FROM dim_project` = **17** — khớp trước và sau toàn bộ lượt
test (nhiều lần điều hướng, đổi tháng qua `?month=`, throttle CPU, resize
cửa sổ). Xác nhận việc test không vô tình đổi dữ liệu nào.

### 9. Kết luận VÒNG 5

**PASS.** Cả 5 điểm B-1..B-5 đều đã vá đúng, xác nhận bằng đo trực tiếp qua
Playwright thật (không chỉ đọc báo cáo coder) + đọc lại code gốc rễ (B-5) +
dữ liệu thật từ Postgres (B-1/B-2, không đoán mò):
- B-1/B-2: null ra chip trung tính ở cả `/overview` và `/report`; biên ngưỡng
  0.95 ra cùng màu ở cả hai trang. Ghi chú rõ: case "cả SPI và CPI null" chỉ
  tái hiện được trên `/overview` (qua `?month=2025-10`) vì `/report` không hỗ
  trợ chọn tháng — không phải khoảng hở của bản vá B-1/B-2, chỉ là giới hạn
  UI có từ trước.
- B-3: hero đổi màu vàng đúng theo tone warn/danger, giữ trắng khi ok, đúng ở
  cả light/dark, đúng ở cả 3 trang dùng `KpiCard hero`.
- B-4: drawer mobile không còn kẹt 68px sau khi từng thu gọn ở desktop;
  trạng thái thu gọn không bị mất qua lại ranh giới 1024px.
- B-5: code đã huỷ spring gốc trước khi gán giá trị cuối (đúng thứ tự sửa
  gốc rễ); đo thực nghiệm CPU throttle 8x không phát hiện chớp-sáng-rồi-mờ
  thật nào (2 điểm nhiễu đo đạc 0.3% đã giải thích rõ, không phải regression).

`npx tsc --noEmit` sạch, `npm test` 548/548 xanh, `npm run build` thành công
0 lỗi. Không có console error mới ngoài phạm vi (2 lỗi MutationObserver là
dư lượng script đo của chính Tester, đã giải thích ở mục 6). Dữ liệu Postgres
không bị ảnh hưởng bởi việc test.

**KẾT LUẬN CUỐI CÙNG VÒNG 5: PASS.** Đủ điều kiện gửi lại Reviewer để chốt
merge — đây là vòng CAN SUA thứ 2/2 theo giới hạn ghi trong `danh-gia.md`,
không phát sinh lỗi mới cần một vòng CAN SUA thứ 3.
