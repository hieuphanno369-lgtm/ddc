# P3F - Bộ icon, trang Đăng nhập kính mờ, Đăng ký chờ admin bật: kế hoạch triển khai

> Dành cho coder: làm lần lượt Task 1 -> Task 7, mỗi Task 1 commit, bước dùng checkbox `- [ ]`.
> Chỉ đọc file này. Mọi tên file, tên hàm, kiểu, key i18n, số đo cần dùng đều có ở đây.
> Planner dùng skill `ddc-tower:writing-plans`; tra `next-intl` 4.14.7 qua context7 (đổi locale giữ query).

**Mục tiêu:** Vẽ lại bộ icon theo chuẩn mock-up (P3F-1), dựng lại 3 trang Đăng nhập / Quên mật khẩu / Đặt lại mật khẩu theo thiết kế kính mờ đã chốt (P3F-2), thêm Đăng ký tài khoản chờ admin bật kèm danh mục Phòng ban và trang Điều khoản (P3F-3).

**Kiến trúc:**
Các trang xác thực gom vào route group `app/[locale]/(auth)/` có 1 `layout.tsx` chung (nửa trái minh hoạ + nửa phải form), URL giữ nguyên, animation không chạy lại khi chuyển giữa các trang trong nhóm.
Toàn bộ CSS và keyframes của nhóm này nằm trong 1 CSS module `src/components/auth/auth.module.css`, dùng token có sẵn của `app/tokens.css`, không thêm gì vào `app/globals.css` (chỉ xoá lớp cũ không còn dùng).
Đăng ký dùng bảng riêng `signup_request` (chỉ chứa đăng ký đang chờ) và kho tiêm được `SignupStore` (Prisma + bộ nhớ) theo đúng khuôn `AuthStore` của P3E, nên không đụng `prisma-repo.ts` và `actions.ts`.

**Công nghệ:** Next 15.5.26 app router, React 19, next-intl 4.14.7, next-auth 4.24.15 (JWT), Prisma 6, PostgreSQL localhost:5433 (DB `ddc_control_tower_c`, cổng 3003), zod 4, bcryptjs, Vitest 2, Playwright 1.63.

**Nguồn yêu cầu:** `D:\_project\DDC_dieu-phoi\lenh-cho-B-2026-09-28-dang-nhap.md` (toàn bộ, đặc biệt 2 mục cuối "CẬP NHẬT CHỦ DỰ ÁN 2026-09-29" và "CHỐT THIẾT KẾ + CHUYỂN GIAO").
**Bản vẽ:** `docs/design/dang-nhap-2026-09-29/` (màu, bề mặt, font: `Main.dc.html`, `Dark.dc.html`, `DangKy.dc.html`, `Mobile.dc.html`) và `docs/design/dang-nhap-2026-09-29/goc-2026-09-28/` (nội dung chữ, animation cẩu tháp, bộ icon `Icons.dc.html`).

---

## TRẢ LỜI CHỦ DỰ ÁN (2026-09-29)

Chủ dự án đã trả lời đủ Q1-Q6, cả 6 câu đều chọn phương án **Đề xuất**.
Các bước ghi "(chờ Qx)" coi như đã chốt, coder làm đúng như viết, không cần dừng.
- Q1 = (a) dải nhắc đầu trang cho admin + khối "Đăng ký đang chờ" trong Quản trị.
- Q2 = (c) nhận cả `@daidung.vn` và `@daidung.com.vn`.
- Q3 = (a) bỏ ô "Ghi nhớ trên thiết bị này", giữ phiên 8 giờ.
- Q4 = (a) mobile theo bản chốt 29/09: không cẩu, thẻ form hiện dần.
- Q5 = (a) người bị từ chối được đăng ký lại.
- Q6 = (a) giữ icon trung tính cho mọi giai đoạn trong P3F.

## CÂU HỎI CÒN BỎ NGỎ (ĐÃ TRẢ LỜI, xem mục trên)

5 quyết định nghiệp vụ P3F-3 (đuôi email, danh mục Phòng ban, báo admin trong app, từ chối không gửi mail, điều khoản do mình soạn) đã chốt 2026-09-28, không hỏi lại.
Các câu dưới đây là chỗ lệnh chưa trả lời hoặc lệnh mâu thuẫn với code/bản vẽ.
Coder làm theo phương án **Đề xuất** ở các bước có ghi "(chờ Qx)"; nếu chủ dự án chọn khác thì sửa đúng các bước đó, không sửa chỗ khác.

**Q1 - "Chuông thông báo của P3B" chưa tồn tại trong app (chặn Task 7 bước 7.6).**
P3B chỉ làm thông báo gửi ra ngoài (webhook + email khi có cảnh báo); trong app không có biểu tượng chuông hay danh sách thông báo nào.
Mục "Cảnh báo" ở sidebar dùng icon chuông nhưng đó là trang danh sách cảnh báo dự án.
- (a) Dải nhắc đầu trang cho admin "Có N đăng ký mới đang chờ bật. Xem trong Quản trị", cùng kiểu dải nhắc thiếu tỷ giá đang có; kèm khối "Đăng ký đang chờ" ở đầu trang Quản trị. **Đề xuất**: dùng lại đúng kiểu nhắc admin đã quen, không đổi bố cục app, admin thấy ngay ở mọi trang.
- (b) Số đếm nhỏ cạnh mục "Quản trị" ở sidebar, kèm khối "Đăng ký đang chờ" ở trang Quản trị. Kín đáo hơn, dễ bị bỏ qua.
- (c) Làm mới một chuông thông báo trên thanh tiêu đề (có danh sách thông báo). Đổi bố cục thanh tiêu đề, cần duyệt mock-up riêng, làm lâu hơn.

**Q2 - Đuôi email công ty: toàn bộ tài khoản hiện có dùng `@daidung.com.vn`, quyết định 1 ghi `@daidung.vn` (chặn Task 6 bước 6.1 hằng số `COMPANY_EMAIL_DOMAINS`).**
Trong code, dữ liệu mẫu, tài khoản e2e và ô gợi ý đăng nhập hiện tại đều là `@daidung.com.vn`; không chỗ nào có `@daidung.vn`.
Đây không phải hỏi lại quyết định "chỉ nhận email công ty", chỉ hỏi đuôi nào là đuôi thật.
- (a) Chỉ `@daidung.vn`, đúng như quyết định đã ghi.
- (b) Chỉ `@daidung.com.vn`.
- (c) Nhận cả hai đuôi. **Đề xuất**: nếu công ty đang dùng cả hai đuôi thì không chặn nhầm người thật; nếu chỉ một đuôi là thật thì chọn đúng đuôi đó (a hoặc b).

**Q3 - Ô "Ghi nhớ trên thiết bị này" trong mock-up (chặn Task 4 bước 4.3 phần ô đánh dấu).**
Hiện mọi phiên đăng nhập tự hết sau 8 giờ; app chưa có cơ chế "ghi nhớ".
- (a) Bỏ ô này, giữ phiên 8 giờ như hiện nay. **Đề xuất**: ô không làm gì thật thì gây hiểu nhầm; kéo dài phiên là thay đổi an toàn cần cân nhắc riêng.
- (b) Giữ ô: có đánh dấu thì phiên kéo dài 7 ngày, không đánh dấu thì 8 giờ. Phải sửa cơ chế phiên và qua rà soát bảo mật thêm.

**Q4 - Điện thoại 390px: có cẩu tháp nhỏ và tấm form trượt lên không (chặn Task 3 bước 3.5 phần mobile).**
Bản gốc 28/09 có khối minh hoạ trên cùng với cẩu tháp nhỏ, 3 thanh Gantt và tấm form trượt lên từ dưới.
Bản chốt 29/09 (`Mobile.dc.html`) chỉ còn logo, câu "Mọi dự án. Một tầm nhìn.", thẻ form kính mờ, không cẩu, không trượt.
- (a) Theo đúng bản chốt 29/09: không cẩu, thẻ form hiện dần như trên desktop. **Đề xuất**: bản chốt là bản chủ dự án duyệt cuối, màn nhỏ gọn hơn, form lên cao hơn.
- (b) Thêm cẩu tháp nhỏ (150px) góc phải trên câu chào và cho thẻ form trượt lên 40px khi mở trang, theo bản gốc.

**Q5 - Người bị từ chối có được đăng ký lại không (chặn Task 5 bước 5.1 cách lưu, Task 6 bước 6.2).**
- (a) Được: từ chối xong, đăng ký đó biến khỏi danh sách chờ (nhật ký vẫn ghi ai từ chối, lúc nào); người đó gửi lại thì admin thấy một đăng ký mới. **Đề xuất**: hay gặp trường hợp chọn nhầm phòng ban hoặc gõ sai tên; giới hạn tần suất đã chặn gửi dồn.
- (b) Không: email đã bị từ chối thì các lần đăng ký sau bị bỏ qua lặng lẽ, muốn mở lại phải nhờ admin.

**Q6 - Icon riêng cho từng giai đoạn Chuỗi giá trị (không chặn, lệnh đã dặn hỏi ở vòng sau).**
Bảng giai đoạn chưa có trường icon, nên trong P3F mọi giai đoạn trên thẻ "Chuỗi giá trị" hiện cùng một icon trung tính.
- (a) Giữ icon trung tính trong P3F, bàn chuyện icon riêng sau. **Đề xuất**: đúng lệnh, không thêm việc.
- (b) Thêm cột icon cho giai đoạn ngay trong migration P3F-3, admin chọn icon từ bộ icon ngành thép ở mục "Giai đoạn chuỗi giá trị" của Quản trị.

---

## Quyết định kỹ thuật (planner tự chọn, có lý do)

- **K1 - Nội dung chữ theo bản gốc 28/09, font/màu/bề mặt theo bản chốt 29/09.**
  Riêng dòng "Quản trị viên duyệt xong bạn mới đăng nhập được." trong `DangKy.dc.html` bản chốt KHÔNG dùng, vì lệnh cấm nhấn mạnh chuyện duyệt; dùng câu bản gốc.
  Nhãn độ mạnh mật khẩu theo bản gốc: Yếu / Trung bình / Khá / Mạnh.
- **K2 - Không có lưới nền trôi 40 giây**: bề mặt đã chốt là nền mesh `.wall` của app (không lưới), nên bỏ lưới; mọi animation khác của bản gốc giữ.
- **K3 - Tia hàn (`spark`) giữ theo bản gốc** (lệnh bắt buộc), dù bản chốt không vẽ.
- **K4 - Bản tối dùng đúng cấu trúc của bản sáng** (`Main.dc.html`), chỉ đổi biến màu theo `Dark.dc.html`; `Dark.dc.html` lược bớt icon/chú giải chỉ vì là bản vẽ.
- **K5 - Trang Đăng ký dùng bố cục bản chốt `DangKy.dc.html`**: panel trái 696px, Gantt rút gọn 4 dòng không icon, không chú giải, không vạch "Hôm nay", thẻ "vừa hoàn thành".
- **K6 - Giữ các route riêng** `/login`, `/quen-mat-khau`, `/dat-lai-mat-khau`, thêm `/dang-ky`, `/dieu-khoan`; không gộp Quên mật khẩu thành trạng thái trong trang Đăng nhập như mock-up (giữ link e-mail và e2e đang có).
- **K7 - Tên app lấy từ key có sẵn**: `app.headerTitle` ("BÁO CÁO QUẢN TRỊ") hiện thành "Báo cáo quản trị" bằng CSS `text-transform: lowercase` + `::first-letter { text-transform: uppercase }`; `app.name` hiện hoa bằng `text-transform: uppercase`. Không tạo key trùng nghĩa.
- **K8 - Nhãn giai đoạn trong khối Gantt minh hoạ là chữ tĩnh qua i18n**, không đọc `dim_stage` (minh hoạ tĩnh, người chưa đăng nhập không được thấy dữ liệu).
- **K9 - Chỗ `[TÊN DỰ ÁN]` thay bằng chữ chung**: "Gia công chậm so với kế hoạch", "Thiết kế vừa hoàn thành".
- **K10 - Đăng ký luôn trả cùng một phản hồi** sau khi qua kiểm tra dữ liệu nhập: băm mật khẩu cho MỌI yêu cầu, phần còn lại (kiểm email đã có, ghi DB, ghi nhật ký) chạy nền theo hàng đợi có timeout, đúng khuôn `requestPasswordReset` (`src/server/password-reset.ts`).
- **K11 - Giới hạn tần suất đăng ký**: 10 lần/giờ/IP, 3 lần/giờ/email, "đặt chỗ" nguyên tử IP trước rồi email bằng `AuthStore.reserveThrottle` của P3E (kind mới `signup_ip`, `signup_email`). Hết lượt thì báo "gửi quá nhiều, thử lại sau 1 giờ" (không lộ email có tồn tại hay không, vì giới hạn tính cho mọi email).
- **K12 - Mật khẩu đăng ký**: băm bằng `hashPassword` (`src/lib/password.ts`), tối thiểu 8 ký tự như P3E, thêm tối đa 128 ký tự để chặn gửi chuỗi quá dài.
- **K13 - Phòng ban bắt buộc chọn khi danh mục có ít nhất 1 phòng ban đang dùng**, vì mock-up không ghi "không bắt buộc" và mọi ô khác đều bắt buộc; danh mục trống thì ẩn ô và gửi `departmentId = null`.
- **K14 - Bật tài khoản**: admin chọn vai trò (chọn sẵn "viewer", ít quyền nhất); `canViewFinance = role !== 'viewer'`, đúng luật `createAccountAction`.
  Bật xong gửi email qua kênh email đầu tiên có đủ SMTP (hàm `getAuthSmtpConfig` của P3E); chưa có SMTP hoặc `NEXTAUTH_URL` thì vẫn bật, báo admin "chưa gửi được email".
- **K15 - Phòng ban đang được dùng** (có người dùng HOẶC có đăng ký đang chờ) chỉ ẩn được, không xoá được; khoá ngoại `ON DELETE RESTRICT`.
- **K16 - Trạng thái "đang xử lý"** dùng đai ốc xoay `NutSpinner` (1 vòng/giây). App hiện KHÔNG có vòng tải nào ở nút (đã tìm `animate-spin`, `spinner`), nên chỉ dùng ở các nút của nhóm trang xác thực.
- **K17 - Chữ nhỏ bấm được** (nút VI/EN cao 32px, link "Quên mật khẩu?") nới vùng bấm lên 44px bằng `::after` trong suốt `inset: -6px` (nút) hoặc padding dọc + margin âm (link), không đổi hình vẽ.
- **K18 - Bảng màu tối của nền `.wall` giữ như app** (không chỉnh độ đậm blob theo `Dark.dc.html`), để không sửa `globals.css`.

---

## Luật chung (áp cho mọi Task)

- Không dùng dấu gạch dài (em dash, en dash) ở bất kỳ đâu: code, comment, i18n, commit.
- Commit message không dấu, dạng `feat(p3f-1): ...`, `feat(p3f-2): ...`, `feat(p3f-3): ...`, `test(p3f-x): ...`; giữ dòng `Co-Authored-By` của agent.
- Sau MỖI commit: cập nhật `D:\_project\DDC_dieu-phoi\phien-C.md` (task, nhánh `feature/p3f-dang-nhap-moi`, commit cuối, bước kế tiếp, file nóng đang giữ, giờ).
- File nóng: trước khi sửa, đọc mục "Đang giữ" của `phien-A.md` và `phien-B.md`; có bên giữ thì KHÔNG sửa, ghi chú rồi làm việc khác; không ai giữ thì ghi vào "Đang giữ" của `phien-C.md`, nhả sau commit.
- i18n: key mới đặt trong nhóm riêng `authPage`, `signup`, `department`, `terms` thêm vào CUỐI `vi.json` và `en.json`; key `activity.<action>` mới thêm vào CUỐI nhóm `activity` (khuôn P3E).
  Luôn gọi `useTranslations()` / `getTranslations()` KHÔNG namespace và viết đủ `t('authPage.loginTitle')`: test `src/i18n/messages.test.ts` chỉ bắt key dạng `t('nhom.key')`, gọi có namespace sẽ làm test báo thiếu key.
- Không thêm thư viện mới. Animation chỉ bằng CSS, chỉ đổi `transform`/`opacity` (không đổi kích thước, không gây nhảy bố cục).
- Bài học P3E (e2e 21, 25): phần tử có `backdrop-filter` tạo containing block mới cho con `position: fixed`, nên mọi hộp thoại/lớp phủ đặt trong thẻ kính phải render qua `createPortal(..., document.body)` (khuôn `src/components/layout/ChangePasswordModal.tsx` dòng 75). Hộp xác nhận đơn giản thì dùng `window.confirm` như `src/components/admin/DeleteProject.tsx`.
- Móc cho e2e: dùng thuộc tính `data-auth="..."` (CSS module băm tên lớp, không dùng tên lớp làm selector).
- Cổng mỗi Task: `npx tsc --noEmit`, `npm test`, các spec e2e liên quan xanh trên cổng 3003 (`npx playwright test <spec>`); Task cuối mỗi phần chạy toàn bộ e2e.
- Build chỉ để kiểm compile: `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` trỏ `D:\_project\DDC_dieu-phoi\tools\font-mock.js` rồi `npm run build`.
- Ảnh soi pixel lưu vào `.bangiao/anh-p3f/` (tên file ghi ở từng Task).

---

# P3F-1: Bộ icon

File nóng: không có. (`src/components/icons/index.tsx` và `app/[locale]/(app)/projects/[id]/page.tsx` không nằm trong danh sách nóng.)

### Task 1: Vẽ lại bộ icon + đai ốc xoay

**Files:**
- Modify: `src/components/icons/index.tsx` (toàn bộ)
- Create: `src/components/ui/NutSpinner.tsx`, `src/components/ui/NutSpinner.module.css`
- Test: `src/components/icons/icons.test.ts`, `src/components/ui/NutSpinner.test.ts`

**Interfaces:**
- Giữ nguyên: `export type IconProps = SVGProps<SVGSVGElement> & { size?: number }`, mọi tên export hiện có (51 icon), mặc định `size = 24`.
- Thêm: `IconSetSquare`, `IconHexNut`, `IconMail`, `IconArrowRight`, `IconArrowLeft`, `IconStage` (cùng kiểu `(p: IconProps) => JSX.Element`).
- `export function NutSpinner({ size = 18, className }: { size?: number; className?: string }): JSX.Element` - render `IconHexNut` có `data-auth="spinner"`, `aria-hidden="true"`; chữ "đang xử lý" do nút chứa nó hiển thị.

- [ ] **1.1 Viết test đỏ** `src/components/icons/icons.test.ts` (khuôn `src/components/admin/StageEditor.test.ts` dòng 1-7: `renderToStaticMarkup` + gán `globalThis.React`):
  - Duyệt `Object.entries(await import('./index'))`, lấy mọi export tên bắt đầu `Icon` là hàm; với từng icon render `createElement(Icon, { size: 20 })` và kiểm: chứa `viewBox="0 0 24 24"`, `width="20"`, `height="20"`, `stroke="currentColor"`, `stroke-width="1.8"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`, `aria-hidden="true"`; KHÔNG chứa `fill="#`, `stroke="#`, `stroke-width="1.7"`.
  - Số icon export >= 57 (51 cũ + 6 mới).
  - `IconHexNut` chứa đúng `d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"` và `r="3.2"`.
  - Truyền `strokeWidth={2}` thì ra `stroke-width="2"` (props ghi đè được).
- [ ] **1.2 Chạy** `npx vitest run src/components/icons/icons.test.ts`, mong đợi FAIL (1.7, thiếu icon mới).
- [ ] **1.3 Sửa `IconBase`**: `strokeWidth={1.8}`, giữ `{...props}` đặt SAU các thuộc tính mặc định. Sửa chú thích đầu file thành:
  `Bộ icon kỹ thuật DDC (chuẩn P3F, docs/design/dang-nhap-2026-09-29/goc-2026-09-28/Icons.dc.html): khung 24x24, nét currentColor, strokeWidth 1.8, đầu nét và góc nối tròn, không tô đặc, ít nét. Thêm icon mới: bám đúng chuẩn này, toạ độ nằm trong 2..22.`
- [ ] **1.4 Vẽ lại theo mock-up** (thay nguyên phần thân, đúng path dưới đây):
  - `IconSteelBeam` (dầm chữ I): `<path d="M5 4h14M5 20h14M12 4v16" />`
  - `IconTruck` (xe tải chở dầm): `<path d="M2 7h12v9H2z" />` `<path d="M14 10h4l3 3v3h-7" />` `<circle cx="6" cy="18" r="2" />` `<circle cx="17" cy="18" r="2" />` `<path d="M3 4.5h10" />`
  - `IconCrane` (cẩu): `<path d="M7 21V4" />` `<path d="M4 21h6" />` `<path d="M3 6h18" />` `<path d="M7 4l-3 2M7 4l10 2" />` `<path d="M16 6v6" />` `<path d="M14 12h4v2h-4z" />`
  - `IconBolt` (bu lông nhìn ngang): `<path d="M8 3h8v4H8z" />` `<path d="M12 7v14" />` `<path d="M10 11h4M10 14h4M10 17h4" />`
  - `IconEye`: `<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />` `<circle cx="12" cy="12" r="3" />`
  - `IconEyeOff`: `<path d="M3 3l18 18" />` `<path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2" />` `<path d="M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7a10.6 10.6 0 0 0 5.4-1.6" />` `<path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />`
  - `IconConfig` (bỏ path bánh răng rối): `<circle cx="12" cy="12" r="3" />` `<circle cx="12" cy="12" r="6.5" />` `<path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />`
  - Các icon còn lại giữ hình, chỉ đổi nét qua `IconBase` (đã là hình tối giản 24x24, nét, bo tròn).
- [ ] **1.5 Thêm icon mới** (đặt trong nhóm `// ---- Domain (kết cấu thép) ----` hoặc `// ---- Action ----` tương ứng):
  - `IconSetSquare` (ê-ke, Thiết kế): `<path d="M4 20V4l16 16z" />` `<path d="M8 16v-4l4 4z" />` `<path d="M4 8h2M4 12h2" />`
  - `IconHexNut` (đai ốc, Gia công): `<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" />` `<circle cx="12" cy="12" r="3.2" />`
  - `IconMail`: `<rect x="3" y="5" width="18" height="14" rx="2" />` `<path d="M3.5 6.5l8.5 6.5 8.5-6.5" />`
  - `IconArrowRight`: `<path d="M5 12h14" />` `<path d="M13 6l6 6-6 6" />`
  - `IconArrowLeft`: `<path d="M19 12H5" />` `<path d="M11 18l-6-6 6-6" />`
  - `IconStage` (icon trung tính cho giai đoạn): `<circle cx="12" cy="12" r="8" />` `<circle cx="12" cy="12" r="2.5" />`
- [ ] **1.6 NutSpinner**: `NutSpinner.module.css`:
  ```css
  .spin { animation: nutSpin 1s linear infinite; transform-origin: 50% 50%; }
  @keyframes nutSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
  ```
  Component render `<IconHexNut size={size} className={[s.spin, className].filter(Boolean).join(' ')} data-auth="spinner" />`.
  Test `NutSpinner.test.ts`: markup chứa `data-auth="spinner"`, `aria-hidden="true"`, path đai ốc; file CSS chứa `1s linear infinite` và khối `prefers-reduced-motion` có `animation: none` (đọc file bằng `readFileSync`).
- [ ] **1.7 Chạy** `npx vitest run src/components/icons src/components/ui/NutSpinner.test.ts` -> PASS; `npx tsc --noEmit` sạch; `npm test` xanh.
- [ ] **1.8 Commit** `feat(p3f-1): ve lai bo icon net 1.8 + icon nganh thep + dai oc xoay`.

### Task 2: Icon giai đoạn trên thẻ Chuỗi giá trị + soi toàn app

**Files:**
- Modify: `app/[locale]/(app)/projects/[id]/page.tsx` (hàm `StageRow` dòng 571-587 và chỗ gọi dòng ~326)
- Create: `e2e/26-bo-icon.spec.ts`
- Test: `src/server/projects-detail-page-render.test.ts` (thêm 1 ca)

**Interfaces:** Consumes `IconStage` (Task 1).

- [ ] **2.1 Test đỏ** thêm ca vào `src/server/projects-detail-page-render.test.ts`: markup thẻ Chuỗi giá trị có đúng số `data-stage-icon` bằng số giai đoạn đang dùng, mỗi cái nằm trong `.stage .nm`.
- [ ] **2.2 Sửa `StageRow`**: trong `<span className="nm">` thêm `<IconStage size={14} data-stage-icon="" className="shrink-0 text-label3" />` trước tên, span đổi thành `className="nm inline-flex items-center gap-1.5 min-w-0"`, tên bọc `<span className="truncate">{name}</span>`.
  Không gắn icon theo tên hay mã giai đoạn (chờ Q6; phương án (b) nếu được chọn làm ở vòng sau). Không đổi `gridTemplateColumns`.
- [ ] **2.3 e2e `e2e/26-bo-icon.spec.ts`** (storageState `e2e/.auth/admin.json`, `reducedMotion: 'reduce'`):
  - Lặp viewport `{1440x900, 390x844}` x `colorScheme {'light','dark'}` x trang `/vi/overview`, `/vi/projects/<id dự án đầu tiên trong sidebar>`, `/vi/nhap-lieu`, `/vi/admin`, `/vi/alerts`.
  - Mỗi trang: mọi `svg[aria-hidden="true"][viewBox="0 0 24 24"]` đang hiển thị có `getAttribute('stroke-width') === '1.8'` (trừ khi có prop ghi đè) và bounding box rộng = cao (không méo).
  - Với mỗi icon nằm cùng hàng chữ (`a.nav svg`, `.stage .nm svg`): tâm dọc icon lệch tâm dọc chữ kế bên <= 2px.
  - Chụp `page.screenshot({ fullPage: true })` lưu `.bangiao/anh-p3f/icon-<trang>-<rong>-<sang|toi>.png`.
  - 390px: mở drawer sidebar rồi kiểm lại icon trong `aside.side`.
- [ ] **2.4 Chạy** `npx playwright test e2e/26-bo-icon.spec.ts` -> PASS; mở ảnh, soi từng ảnh: icon không vỡ, không lệch dòng, sáng/tối đều thấy rõ. Chỗ lệch dù ngoài phạm vi icon thì sửa luôn nếu file không bị bên khác giữ, ngoài phạm vi thì ghi vào `thay-doi.md`.
- [ ] **2.5 Cổng**: `npx tsc --noEmit`, `npm test`, toàn bộ `npx playwright test` xanh.
- [ ] **2.6 Commit** `feat(p3f-1): icon giai doan tren the chuoi gia tri + e2e soi icon`.

**Tiêu chí xong P3F-1:** mọi icon nét 1.8, 6 icon mới có mặt, 19 file import cũ không phải sửa, thẻ Chuỗi giá trị có icon trung tính, e2e 26 xanh và ảnh soi đạt ở 1440/390 sáng/tối.

---

# P3F-2: Đăng nhập / Quên mật khẩu / Đặt lại mật khẩu

File nóng cần giữ: `src/i18n/messages/vi.json`, `src/i18n/messages/en.json` (Task 3-4), `app/globals.css` (Task 4 bước 4.9, chỉ xoá lớp cũ).

### Task 3: Khung `(auth)` + nửa trái minh hoạ + animation

**Files:**
- Move (git mv, giữ lịch sử): `app/[locale]/login/page.tsx` -> `app/[locale]/(auth)/login/page.tsx`; `app/[locale]/quen-mat-khau/page.tsx` -> `app/[locale]/(auth)/quen-mat-khau/page.tsx`; `app/[locale]/dat-lai-mat-khau/page.tsx` -> `app/[locale]/(auth)/dat-lai-mat-khau/page.tsx`
- Create: `app/[locale]/(auth)/layout.tsx`, `src/components/auth/auth.module.css`, `src/components/auth/AuthShowcase.tsx`, `src/components/auth/CraneArt.tsx`, `src/components/auth/GanttArt.tsx`, `src/components/auth/AuthLocaleSwitch.tsx`, `src/components/auth/AuthBrand.tsx`
- Modify: `src/i18n/messages.test.ts` (đường dẫn 3 trang dòng 70, 74, 75 thành `app/[locale]/(auth)/...`), `src/i18n/messages-p7-c1.test.ts` dòng 31, `vi.json`, `en.json`
- Test: `src/components/auth/auth-css.test.ts`, `src/components/auth/AuthShowcase.test.ts`

**Interfaces:**
- `app/[locale]/(auth)/layout.tsx` (server): `export default function AuthLayout({ children }: { children: React.ReactNode })` render:
  ```tsx
  <div className={s.shell} data-auth="shell">
    <AuthShowcase />
    <div className={s.side}>
      <Suspense fallback={null}><AuthLocaleSwitch /></Suspense>
      {children}
    </div>
  </div>
  ```
- `AuthShowcase` ('use client'): tự chọn biến thể theo `usePathname()` của `@/i18n/navigation`: `'/dang-ky'` -> `'register'`, còn lại -> `'login'`. Render panel trái desktop (`data-auth="showcase"`) và khối đầu trang mobile (`data-auth="mobile-head"`: `AuthBrand` + câu chào 2 dòng + `AuthLocaleSwitch compact`).
- `AuthBrand({ size }: { size: 'lg' | 'sm' })`: ô trắng bo góc chứa `next/image` `/logo.png` (lg: ô 48 bo 12, ảnh 44; sm: ô 40 bo 11, ảnh 36; `object-fit: contain`, `alt` = `t('app.name')`), dòng 1 `t('app.headerTitle')` (`data-auth="brand-title"`, K7), dòng 2 `t('app.name')` hoa.
- `CraneArt({ size }: { size: 'lg' | 'md' })`: SVG `viewBox="0 0 320 260"`, lg 270x220 (login), md 240x196 (register), `aria-hidden="true"`, đúng hình `Main.dc.html` dòng 87-111 cộng nhóm tia hàn của bản gốc `goc-2026-09-28/Main.dc.html` dòng 103; mỗi nhóm động có `data-anim="trolley|cable|hook|hb|placed|spark|blink"`.
- `GanttArt({ variant }: { variant: 'full' | 'compact' })`: full = `Main.dc.html` dòng 114-136 (tiêu đề, chú giải, tháng, 5 dòng có icon, vạch Hôm nay); compact = `DangKy.dc.html` dòng 76-81 (4 dòng không icon).
- `AuthLocaleSwitch({ compact }: { compact?: boolean })`: đổi locale giữ nguyên path và query:
  ```ts
  router.replace({ pathname, query: Object.fromEntries(searchParams.entries()) }, { locale: next });
  ```
  (`useRouter`, `usePathname` từ `@/i18n/navigation`, `useSearchParams` từ `next/navigation`; bắt buộc giữ query vì trang đặt lại mật khẩu có `?token=`). Bản thường: 2 nút VI/EN `aria-pressed`; bản compact: 1 nút hiện locale hiện tại, bấm đổi sang locale kia, `aria-label={t('authPage.changeLanguage')}`.

- [ ] **3.1 Giữ file nóng** `vi.json`, `en.json` theo luật chung.
- [ ] **3.2 Test đỏ** `src/components/auth/auth-css.test.ts` (đọc `auth.module.css` bằng `readFileSync`):
  - Có đủ keyframes `authUp`, `authGrow`, `authFade`, `authPing`, `authSpin`, `authTrolley`, `authCable`, `authHook`, `authHb`, `authPlaced`, `authSpark`, `authBlink`.
  - Chu kỳ: trolley/cable/hook/hb/placed/spark `10s`, blink `1.6s`, spin `6s`, ping `1.8s`.
  - Khối `@media (prefers-reduced-motion: reduce)` đặt `animation: none` cho mọi lớp động và `opacity: 0` cho `.spark` và `.placed`.
  - Mọi `@keyframes` chỉ chứa `transform` hoặc `opacity`.
  - Không có `#0B1220`, `#C2410C`, `#F59E4B`, `Be Vietnam`, `IBM Plex`.
  Test `AuthShowcase.test.ts` (mock `next-intl`, `@/i18n/navigation` `usePathname` trả `'/login'` rồi `'/dang-ky'`): login có `data-auth="gantt-full"` và key `authPage.heroLine1`; dang-ky có `data-auth="gantt-compact"` và key `authPage.registerHero1`; không chứa chuỗi `[TÊN DỰ ÁN]`.
- [ ] **3.3 Chạy** `npx vitest run src/components/auth` -> FAIL.
- [ ] **3.4 Viết `auth.module.css`** theo bảng số đo dưới (px lấy từ `Main.dc.html`, `DangKy.dc.html`, `Mobile.dc.html`).
  Biến màu khai báo trên `.shell`, bản tối ghi đè bằng 2 khối `:global(:root[data-theme="dark"]) .shell {...}` và `@media (prefers-color-scheme: dark) { :global(:root:not([data-theme="light"])) .shell {...} }` (khuôn `app/tokens.css` dòng 75 và 99):

  | Biến | Sáng | Tối |
  |---|---|---|
  | `--a-text` | `var(--label)` | `var(--label)` |
  | `--a-text-2` | `rgba(10,31,61,.64)` | `rgba(235,242,250,.64)` |
  | `--a-text-3` | `rgba(10,31,61,.50)` | `rgba(235,242,250,.50)` |
  | `--a-label` | `rgba(10,31,61,.70)` | `rgba(235,242,250,.72)` |
  | `--a-link` | `#1d5a9e` | `#8cbcf0` |
  | `--a-accent-text` (eyebrow, dòng chào thứ 2, nhãn Cảnh báo) | `#1d5a9e` (nhãn Cảnh báo `#9a6400`) | `#f5c542` |
  | `--a-inp-bg` / `--a-inp-border` | `var(--glass-3)` / `var(--sep-2)` | như cột trái (token tự đổi) |
  | `--a-focus` / `--a-focus-ring` | `#1d5a9e` / `rgba(29,90,158,.12)` | `#4e8ed0` / `rgba(78,142,208,.22)` |
  | `--a-btn` / `--a-btn-shadow` | `linear-gradient(160deg,#2a6db4,#1d5a9e)` / `0 1px 2px rgba(10,31,61,.05),0 6px 16px rgba(29,90,158,.28)` | `linear-gradient(160deg,#6ba6e0,#3f7fc2)` / `0 6px 18px rgba(78,142,208,.35)` |
  | `--a-ghost-bg` / `--a-ghost-border` | `rgba(10,31,61,.05)` / `rgba(10,31,61,.16)` | `rgba(255,255,255,.06)` / `rgba(255,255,255,.16)` |
  | `--a-crane` / `--a-column` / `--a-ground` / `--a-cable` | `#1d5a9e` / `#7d93b3` / `rgba(10,31,61,.18)` / `rgba(10,31,61,.55)` | `#6ba6e0` / `#4a6488` / `rgba(255,255,255,.18)` / `#e6e9f0` |
  | `--a-spark` | `#f5b301` | `#ffd08a` |
  | `--a-bar-done` / `--a-bar-plan-border` | `#1d5a9e` / `rgba(10,31,61,.35)` | `#4e8ed0` / `rgba(235,242,250,.35)` |
  | `--a-seg-on-bg` | `#ffffff` + `box-shadow: 0 1px 3px rgba(10,31,61,.12)` | `rgba(255,255,255,.14)` |

  Màu cố định cả 2 chế độ: vàng `#f5b301` (thanh đang chạy, xe con, dầm, đèn, chấm cảnh báo), vạch Hôm nay `#d93a30` chữ trắng.
  Bề mặt: `.glass` = `background: var(--glass)`, `backdrop-filter: blur(var(--mat-regular)) saturate(var(--mat-sat))` (kèm `-webkit-`), `border: .5px solid var(--glass-stroke)`, `box-shadow: var(--e3), var(--inner-hi)`; `.glass2` = `var(--glass-2)`, blur `var(--mat-chrome)`, cùng viền, `box-shadow: var(--inner-hi)`.
  Bố cục desktop (>= 1280px): `.shell` flex, padding 24, `min-height: 100dvh`, box-sizing border-box, `position: relative; z-index: 1` (nổi trên `.wall`).
  Panel trái login: `.glass2`, `flex: 0 1 796px; min-width: 0`, padding 40px 48px, bo 32, cột `justify-content: space-between`; register: `flex-basis: 696px`.
  Cột phải: `flex: 1 0 492px` (register 520px), căn giữa thẻ, nút VI/EN `position: absolute; top: 16px; right: 16px`.
  Mobile (< 1280px): ẩn `[data-auth="showcase"]`, hiện `[data-auth="mobile-head"]`; `.shell` thành cột, padding 28px 16px, gap 22, thẻ form `max-width: 480px; width: 100%` giữa màn.

  Số đo chi tiết:
  - Brand lg: gap 12; tên 17/700 letter-spacing -0.01em; dòng phụ 11/600 .16em màu `--a-text-3` (bản sáng mock .55, dùng `rgba(10,31,61,.55)` / `rgba(235,242,250,.55)`). Brand sm: tên 15/700, phụ 10/600.
  - Hero login: khối gap 18, chữ gap 16 padding-bottom 18; h2 54px/1.05/800, letter-spacing -0.035em, dòng 2 màu `--a-accent-text`; p 17/1.55, `max-width: 380px`, `flex-shrink: 1`. Register: h2 48/1.06 (3 dòng), p 16/1.55 max 330.
  - Mobile hero: h2 32/1.08/800 -0.035em, padding 4px 4px 0.
  - Gantt full: thẻ `.glass` bo 20, padding 20px 22px 24px, gap 14; tiêu đề 12/700 .14em hoa màu `rgba(10,31,61,.60)` / `rgba(235,242,250,.58)`; chú giải 12, gap 16, mẫu 14x6 bo 3 (kế hoạch 12x4 viền đứt); hàng tháng 11/600 màu `rgba(10,31,61,.45)`, cột nhãn 124; dòng cao 34, nhãn 14 gap 8 icon 16; thanh cao 10 bo 5.
    Vị trí thanh (left/width %): Thiết kế 0/34 hoàn thành; Mua sắm 18/30 hoàn thành; Gia công 36/30 vàng + `box-shadow: 0 0 0 4px rgba(245,179,1,.18)`, nhãn đậm 650, icon `IconHexNut` màu `#c28a00` (tối `#f5c542`) quay 6s; Vận chuyển 60/22 viền đứt; Lắp dựng 70/30 viền đứt.
    Icon dòng: Thiết kế `IconSetSquare`, Mua sắm `IconSteelBeam`, Gia công `IconHexNut`, Vận chuyển `IconTruck`, Lắp dựng `IconCrane`.
    Vạch Hôm nay: `left: calc(136px + (100% - 136px) * .58)`, top -6 bottom -6, viền trái 1.5px; nhãn pill top -28, 10/700 .08em, padding 2px 8px.
  - Gantt compact: `.glass` bo 20, padding 22, gap 4; dòng cao 32, cột nhãn 118.
  - Thẻ cảnh báo (login): hàng `justify-content: flex-end`, margin-top -28, padding-right 24; thẻ `.glass` rộng 320, padding 12px 16px, bo 16, nền `var(--glass-3)`; chấm 8x8 vàng margin 6px 4px 0 có vòng lan `::after`; nhãn 11/700 .12em; chữ 14/1.4.
    Thẻ "vừa hoàn thành" (register): margin-top -26, padding-right 24, thẻ padding 12px 16px bo 16, gap 10, icon `IconCheck` 18 nét 2 màu `#1b7a44` (tối `var(--ok)`), chữ 14.
  - Chân panel: 11/600 .1em hoa màu `--a-text-3`, 2 đầu `justify-content: space-between`. Mobile: 1 dòng giữa 10px.
  - Nút VI/EN: nhóm `.glass` bo 12 padding 3 gap 2; nút cao 32 padding 0 12 bo 9, 650 13px (nút tắt 600, màu `rgba(10,31,61,.60)` / `rgba(235,242,250,.60)`), vùng bấm 44 (K17). Compact: nút `.glass` cao 36 padding 0 12 bo 11.

  Animation (chỉ transform/opacity, đường cong `cubic-bezier(.2,.8,.2,1)` cho vào trang, `cubic-bezier(.45,0,.2,1)` cho cẩu):
  - `authUp` từ `opacity:0; translateY(12px)` tới `opacity:1; none`, .6s both; độ trễ khối form u1..u6 = .05s, .12s, .19s, .26s, .33s, .40s; hero trễ 0.
  - `authGrow` `scaleX(0)` -> `scaleX(1)`, `transform-origin: left center`, .9s both; trễ thanh d1..d5 = .15s, .30s, .45s, .60s, .75s.
  - `authFade` vạch Hôm nay .5s ease 1.1s both; thẻ cảnh báo `authUp` .6s 1.4s both; `authPing` (scale 1 -> 3, opacity .6 -> 0) 1.8s ease-out 1.6s infinite.
  - Cẩu: nguyên văn keyframes `trolley`, `cable`, `hook`, `hb`, `placed` của `Main.dc.html` dòng 55-59 (đổi tên thêm tiền tố `auth`), `spark` của `goc-2026-09-28/Main.dc.html` dòng 62, `blink` dòng 60; `.cable` cần `transform-box: fill-box; transform-origin: 50% 0`.
  - Mũi tên nút chính: `transition: transform .2s`, `:hover` -> `translateX(3px)`.
  - reduced-motion: `animation: none` cho mọi lớp trên; `.spark`, `.placed` `opacity: 0`; `.hb` giữ hiện (khung tĩnh: dầm treo trên móc); mũi tên không nhích. Quy tắc chung ở cuối `globals.css` chỉ rút `animation-duration`, không đủ cho vòng lặp vô hạn, nên module phải tự đặt `animation: none`.
- [ ] **3.5 Viết component** theo Interfaces.
  Mobile (chờ Q4, làm theo Đề xuất (a)): `mobile-head` gồm hàng brand sm + nút ngôn ngữ compact, rồi câu chào 2 dòng; không cẩu, không Gantt; thẻ form hiện bằng `authUp`.
  Nếu Q4 = (b): thêm `CraneArt` cỡ 150x122 `position: absolute; top: 20px; right: 14px` trong `mobile-head` và lớp `.sheet` (`translateY(40px)` -> `none`, .7s) cho thẻ form.
- [ ] **3.6 i18n** thêm nhóm `authPage` (Task 3 dùng các key dưới; Task 4 bổ sung tiếp vào cùng nhóm):

  | Key | vi | en |
  |---|---|---|
  | `heroLine1` | Mọi dự án. | Every project. |
  | `heroLine2` | Một tầm nhìn. | One view. |
  | `heroBody` | Theo dõi tiến độ, chuỗi giá trị và cảnh báo của toàn bộ dự án trên một màn hình duy nhất. | Track progress, value chain and alerts for every project on a single screen. |
  | `registerHero1` / `registerHero2` / `registerHero3` | Cùng một nhịp, / trên mọi / công trình. | In step, / on every / site. |
  | `registerBody` | Nơi cả công ty cùng nhìn vào một bức tranh: tiến độ, chuỗi giá trị và những việc cần chú ý hôm nay. | One shared picture for the whole company: progress, value chain and what needs attention today. |
  | `ganttTitle` | Tiến độ chuỗi giá trị | Value chain progress |
  | `legendDone` / `legendRunning` / `legendPlan` | Hoàn thành / Đang chạy / Kế hoạch | Done / In progress / Planned |
  | `stageDesign` / `stageProcurement` / `stageFabrication` / `stageDelivery` / `stageErection` | Thiết kế / Mua sắm / Gia công / Vận chuyển / Lắp dựng | Design / Procurement / Fabrication / Delivery / Erection |
  | `months` | T7,T8,T9,T10,T11,T12 | Jul,Aug,Sep,Oct,Nov,Dec |
  | `today` | Hôm nay | Today |
  | `alertLabel` | Cảnh báo | Alert |
  | `alertText` | Gia công chậm so với kế hoạch | Fabrication is behind schedule |
  | `doneToast` | Thiết kế vừa hoàn thành | Design stage just completed |
  | `footerNote` | Hệ thống nội bộ · Chỉ dành cho tài khoản được cấp quyền | Internal system · Authorised accounts only |
  | `footerShort` | Hệ thống nội bộ | Internal system |
  | `copyright` | © Đại Dũng | © Dai Dung |
  | `changeLanguage` | Đổi ngôn ngữ | Change language |

  `months` tách bằng `.split(',')`. Chữ hoa (tiêu đề Gantt, nhãn Cảnh báo, chân panel, Hôm nay) làm bằng CSS `text-transform: uppercase`.
- [ ] **3.7 Chuyển 3 trang** vào `(auth)` bằng `git mv`, sửa đường dẫn trong 2 file test i18n; tạm thời trang giữ nội dung cũ bọc trong thẻ kính mới để app chạy được giữa chừng (Task 4 thay hẳn).
- [ ] **3.8 Chạy** `npx vitest run src/components/auth src/i18n` -> PASS; `npx tsc --noEmit`; mở `http://localhost:3003/vi/login` kiểm tay 1440 và 390.
- [ ] **3.9 Commit** `feat(p3f-2): khung trang xac thuc kinh mo + minh hoa can thap gantt`.

### Task 4: Form Đăng nhập, Quên mật khẩu, Đặt lại mật khẩu + e2e pixel

**Files:**
- Create: `src/components/auth/AuthCard.tsx`, `src/components/auth/parts.tsx`, `src/components/auth/PasswordStrength.tsx`, `src/lib/password-strength.ts`
- Move + viết lại: `src/components/layout/LoginForm.tsx` -> `src/components/auth/LoginForm.tsx`; `ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx` tương tự
- Modify: 3 trang trong `app/[locale]/(auth)/`, `src/i18n/messages.test.ts` (đường dẫn component), `vi.json`, `en.json`, `app/globals.css` (xoá `.authwrap`, `.authcard`, `.authsep` dòng 538-560)
- Create e2e: `e2e/helpers/login.ts`, `e2e/27-giao-dien-dang-nhap.spec.ts`
- Modify e2e: `e2e/auth.setup.ts`, `e2e/01-login.spec.ts`, `e2e/10-ten-app.spec.ts` (dòng 112-128), `e2e/20-dang-nhap-google.spec.ts`, `e2e/21-khoa-tai-khoan.spec.ts`, `e2e/22-quen-mat-khau.spec.ts`, `e2e/23-doi-mat-khau.spec.ts`, `e2e/24-r2-1-hoi-sinh-phien.spec.ts`
- Test: `src/lib/password-strength.test.ts`, `src/components/auth/LoginForm.test.ts`

**Interfaces:**
- `AuthCard({ width, children }: { width: 452 | 480; children: React.ReactNode })`: `.glass`, padding 40px 40px 36px (480: 38px 40px 32px), bo 26, `data-auth="card"`; mobile: bo 24, padding 24px 20px, rộng 100%.
- `parts.tsx` export:
  - `AuthHeading({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: string })`: eyebrow 12/700 .16em hoa `--a-accent-text`; h1 34/1.12/800 -0.03em (mobile 24/800 -0.02em); intro 15/1.55 `--a-text-2`.
  - `AuthField({ id, label, children, aside }: { id: string; label: string; children: React.ReactNode; aside?: React.ReactNode })`: `<label htmlFor={id}>` 13/600 `--a-label`, gap 7, `aside` nằm bên phải hàng nhãn.
  - `AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>)`: cao 48 (register 46 qua prop `dense`), padding 0 14, bo 12, viền .5px `--a-inp-border`, nền `--a-inp-bg`, chữ 500 15px (mobile 16px), focus viền `--a-focus` + ring 3.5px.
  - `AuthPasswordInput({ id, value, onChange, autoComplete, placeholder }: {...})`: `AuthInput` + nút mắt 44x44 `right: 2px; top: 2px`, `aria-label` `t('auth.showPassword')` / `t('auth.hidePassword')`, icon `IconEye` / `IconEyeOff` 20.
  - `AuthPrimaryButton({ busy, busyLabel, children, arrow }: { busy: boolean; busyLabel: string; children: React.ReactNode; arrow?: boolean })`: `type="submit"`, cao 50, bo 12, 650 15px, nền `--a-btn`; khi `busy`: `disabled`, `aria-busy="true"`, nội dung = `<NutSpinner size={20} />` + `busyLabel`; không busy: children + `IconArrowRight` 18 `strokeWidth={2}` (nếu `arrow`).
  - `AuthGhostButton` (cao 50, nền `--a-ghost-bg`, viền .5px `--a-ghost-border`), `GoogleButton({ busy, onClick })` (logo Google 4 màu nguyên văn `Main.dc.html` dòng 163, chữ `t('authPage.continueGoogle')`).
  - `AuthDivider({ label })`: 2 vạch .5px + chữ 13 `--a-text-3`.
  - `AuthNotice({ tone, children }: { tone: 'error' | 'info' | 'success'; children: React.ReactNode })`: nền nhạt bo 12 padding 12px 14px, chữ 14/1.45 màu `--a-text`, icon nét 18 bên trái; error: nền `var(--danger-fill)`, icon `IconAlert` màu `var(--danger)`, `role="alert"`; info: `var(--info-fill)` + `IconMail` màu `var(--info)`, `role="status"`; success: `var(--ok-fill)` + `IconCheck` màu `var(--ok)`, `role="status"`. `data-auth="notice-<tone>"`.
  - `AuthLink` (link chữ 600 13px `--a-link`, vùng bấm 44 theo K17).
- `src/lib/password-strength.ts`: `export function passwordStrength4(password: string): 0 | 1 | 2 | 3 | 4` - rỗng -> 0; dài < 8 -> 1; còn lại = số nhóm ký tự có mặt trong {chữ thường, chữ hoa, số, ký tự khác}, tối thiểu 1.
- `PasswordStrength({ value }: { value: string })`: ẩn khi rỗng; 4 vạch cao 4 bo 2 gap 4 (vạch bật màu `#1d5a9e` sáng / `#4e8ed0` tối, vạch tắt `var(--fill-2)`), nhãn rộng 64 căn phải 12/600 màu vạch bật; nhãn `t('authPage.strength1..4')`; `aria-live="polite"`.
- `LoginForm({ googleEnabled, initialError }: { googleEnabled: boolean; initialError?: 'googleDenied' | null })` giữ nguyên luồng `signIn('credentials', { redirect: false, email, password })`, `signIn('google', { callbackUrl: \`/${locale}\` })`, `router.replace('/overview')`, map lỗi `locked` / `ip_limited` / còn lại như hiện nay, giữ `usePressable(submitRef)`.
- `e2e/helpers/login.ts`: `export async function fillLogin(page: Page, email: string, password: string): Promise<void>` - `page.goto('/vi/login')`, điền `#auth-email`, `#auth-password`, bấm nút tên `vi('auth.signIn')`.

- [ ] **4.1 Test đỏ**:
  - `password-strength.test.ts`: `''`->0, `'abc'`->1, `'abcdefgh'`->1, `'abcdefg1'`->2, `'Abcdefg1'`->3, `'Abcdef1!'`->4, `'ABCDEFGH'`->1, `'12345678'`->1.
  - `LoginForm.test.ts` (mock `next-auth/react`, `next-intl`, `@/i18n/navigation`, `@/components/ui/motion`): có `id="auth-email"` `autocomplete="email"`, `id="auth-password"` `autocomplete="current-password"`, `<label for="auth-email">`, key `authPage.continueGoogle` chỉ khi `googleEnabled`, key `authSecurity.googleDenied` khi `initialError='googleDenied'`, link tới `/quen-mat-khau` và `/dang-ky`, không có `type="checkbox"` (Q3 = a).
  - `messages.test.ts`: thêm vào `CHANGED_SOURCES` 3 component mới đường dẫn `src/components/auth/*.tsx`, `AuthShowcase.tsx`, `parts.tsx`; bỏ 3 đường dẫn `src/components/layout/*Form.tsx` cũ.
- [ ] **4.2 Chạy** các test trên -> FAIL.
- [ ] **4.3 Trang Đăng nhập** `app/[locale]/(auth)/login/page.tsx`: giữ redirect khi đã đăng nhập, `googleEnabled`, `initialError` như bản cũ; render `<AuthCard width={452}><LoginForm .../></AuthCard>`.
  Thứ tự trong form (gap 20; mobile gap 16 và bỏ eyebrow + intro theo `Mobile.dc.html`): `AuthHeading` (eyebrow `authPage.loginEyebrow`, title `authPage.loginTitle`, intro `authPage.loginIntro`) -> `GoogleButton` + `AuthDivider` (chỉ khi `googleEnabled`) -> ô Email (placeholder `authPage.emailPlaceholder`) -> ô Mật khẩu (aside = `AuthLink href="/quen-mat-khau"` chữ `authSecurity.forgotLink`, placeholder `authPage.passwordPlaceholder`) -> `AuthNotice error` nếu có lỗi -> `AuthPrimaryButton` (chữ `auth.signIn`, busy `authPage.signingIn`, `arrow`) -> dòng `authPage.noAccount` + `AuthLink href="/dang-ky"` chữ `authPage.createAccount`.
  Ô "Ghi nhớ trên thiết bị này": chờ Q3, làm theo Đề xuất (a) là KHÔNG render. Nếu Q3 = (b), tách thành Task riêng có rà soát bảo mật, không làm trong Task này.
  Mỗi khối có lớp `authUp` với độ trễ u1..u6.
  Không còn dòng "Built by Buffalo Tech" (mock-up không có).
- [ ] **4.4 Trang Quên mật khẩu**: `<AuthCard width={452}>`; `smtpReady` như cũ.
  Trạng thái form: `AuthLink href="/login"` có `IconArrowLeft` 16 + `authSecurity.backToLogin` -> `AuthHeading` (eyebrow `authPage.recoveryEyebrow`, title `authPage.forgotHeading`, intro `authPage.forgotBody`) -> ô Email -> `AuthPrimaryButton` (chữ `authPage.sendResetLink`, busy `authPage.sending`).
  Trạng thái đã gửi (luôn hiện giống nhau, S3): ô 56x56 bo 16 nền `--a-btn` bóng `--a-btn-shadow` chứa `IconMail` 26 màu `#f5b301` -> h1 `authPage.sentTitle` -> p `authPage.sentBody` -> `AuthGhostButton` về `/login` chữ `authSecurity.backToLogin`.
  Chưa cấu hình SMTP: `AuthNotice error` `authSecurity.smtpMissing` + link về đăng nhập.
- [ ] **4.5 Trang Đặt lại mật khẩu**: giữ `metadata` (`referrer: 'no-referrer'`, `robots.index: false`) và `isResetTokenUsable`.
  Form: `AuthHeading` (eyebrow `authPage.recoveryEyebrow`, title `authSecurity.resetTitle`, intro `authPage.resetIntro`) -> `AuthPasswordInput` mật khẩu mới (`autoComplete="new-password"`) + `PasswordStrength` -> ô nhập lại -> `AuthNotice error` (map lỗi như cũ) -> `AuthPrimaryButton` (chữ `authSecurity.resetSubmit`, busy `authPage.saving`).
  Xong: `AuthNotice success` (`authSecurity.resetDone` hoặc `authSecurity.resetDoneLocked`) + nút về đăng nhập.
  Token không dùng được: h1 `authPage.invalidTitle` + `AuthNotice error` `authSecurity.resetInvalid` + `AuthLink href="/quen-mat-khau"` chữ `authPage.requestNewLink`.
  `token` chỉ truyền vào action, không đưa vào URL nào khác (giữ S12).
- [ ] **4.6 i18n** bổ sung vào nhóm `authPage`:

  | Key | vi | en |
  |---|---|---|
  | `loginEyebrow` | Đăng nhập hệ thống | Sign in |
  | `loginTitle` | Chào mừng trở lại | Welcome back |
  | `loginIntro` | Đăng nhập bằng tài khoản Google công ty hoặc email đã được quản trị viên cấp quyền. | Sign in with your company Google account or an email set up by an administrator. |
  | `continueGoogle` | Tiếp tục với Google | Continue with Google |
  | `orEmail` | hoặc dùng email | or use email |
  | `emailPlaceholder` | ten@daidung.vn (chờ Q2: đổi theo đuôi được chọn) | name@daidung.vn |
  | `passwordPlaceholder` | Nhập mật khẩu | Enter password |
  | `signingIn` | Đang đăng nhập | Signing in |
  | `noAccount` | Chưa có tài khoản? | No account yet? |
  | `createAccount` | Tạo tài khoản | Create account |
  | `recoveryEyebrow` | Khôi phục mật khẩu | Password recovery |
  | `forgotHeading` | Quên mật khẩu? | Forgot your password? |
  | `forgotBody` | Nhập email của bạn, hệ thống sẽ gửi liên kết để đặt lại mật khẩu. | Enter your email and we will send you a link to reset your password. |
  | `sendResetLink` | Gửi liên kết đặt lại | Send reset link |
  | `sending` | Đang gửi | Sending |
  | `sentTitle` | Kiểm tra hộp thư | Check your inbox |
  | `sentBody` | Nếu email có trong hệ thống, liên kết đặt lại mật khẩu sẽ đến trong vài phút. Liên kết có hiệu lực trong 30 phút. | If the email is registered, a reset link will arrive within a few minutes. The link is valid for 30 minutes. |
  | `resetIntro` | Chọn mật khẩu mới cho tài khoản của bạn, tối thiểu 8 ký tự. | Choose a new password for your account, at least 8 characters. |
  | `saving` | Đang lưu | Saving |
  | `invalidTitle` | Liên kết không dùng được | This link can't be used |
  | `requestNewLink` | Xin liên kết mới | Request a new link |
  | `strength1` / `strength2` / `strength3` / `strength4` | Yếu / Trung bình / Khá / Mạnh | Weak / Fair / Good / Strong |

  Dùng lại key có sẵn: `auth.email`, `auth.password`, `auth.signIn`, `auth.invalidCredentials`, `auth.showPassword`, `auth.hidePassword`, `auth.newPassword`, `auth.confirmPassword`, `auth.passwordTooShort`, `auth.mismatch`, `authSecurity.forgotLink`, `backToLogin`, `locked`, `ipLimited`, `googleDenied`, `smtpMissing`, `resetTitle`, `resetSubmit`, `resetDone`, `resetDoneLocked`, `resetInvalid`.
  Sau khi xong, key cũ không còn chỗ dùng (`auth.signInGoogle`, `auth.or`, `authSecurity.forgotTitle`, `authSecurity.forgotIntro`, `authSecurity.forgotSubmit`, `authSecurity.forgotSent`): grep `src/`, `app/`, `e2e/` trước; không còn chỗ nào dùng thì xoá khỏi cả 2 file.
- [ ] **4.7 Sửa e2e cũ**: tạo `e2e/helpers/login.ts`; thay mọi đoạn điền form đăng nhập ở `auth.setup.ts`, 01, 20, 21, 22, 23, 24 bằng `fillLogin`.
  22: thay `authSecurity.forgotSubmit` -> `authPage.sendResetLink`, `authSecurity.forgotSent` -> `authPage.sentTitle`; ô mật khẩu mới/nhập lại tìm bằng `page.getByLabel(vi('auth.newPassword'), { exact: true })`, `page.getByLabel(vi('auth.confirmPassword'), { exact: true })`.
  10 (dòng 112-128): `h1` -> `[data-auth="brand-title"]` (desktop 1440x900), `toHaveText(T[loc]('app.headerTitle'))` (so textContent, không bị CSS đổi hoa thường) và `assertSingleLineNoOverflow`; ảnh chụp `[data-auth="showcase"]`.
- [ ] **4.8 e2e mới `e2e/27-giao-dien-dang-nhap.spec.ts`** (context không đăng nhập `storageState: { cookies: [], origins: [] }`):
  - Ma trận: viewport {1440x900, 1280x800, 390x844} x `colorScheme` {light, dark} x trang {`/vi/login`, `/vi/quen-mat-khau`, `/vi/dat-lai-mat-khau?token=khong-hop-le`, `/en/login`}, `reducedMotion: 'reduce'`, chờ `document.fonts.ready`.
    Mỗi ô: không cuộn ngang (`document.documentElement.scrollWidth <= innerWidth`); chụp `fullPage` vào `.bangiao/anh-p3f/dang-nhap-<trang>-<rong>-<sang|toi>.png`.
  - 1440 sáng `/vi/login`: `[data-auth="showcase"]` rộng 796 (+-1); `[data-auth="card"]` rộng 452; nút chính cao 50; `#auth-email` cao 48; nút mắt 44x44; hộp `[data-auth="crane"]` không giao hộp chữ hero.
  - 1280x800: showcase < 796 và hộp cẩu không giao hộp chữ hero; thẻ form nằm trọn trong viewport ngang.
  - 390: showcase ẩn, `[data-auth="mobile-head"]` hiện; thẻ rộng 358 (+-1); mọi nút, link, ô nhập có vùng bấm >= 44x44 (đo `getBoundingClientRect` của phần tử hoặc `::after` qua `elementFromPoint` ở mép).
  - Tối: màu chữ `h1` là `rgb(242, 245, 249)`; nền thẻ có `backdrop-filter` khác `none`.
  - reduced-motion: mọi `[data-anim]` có `getComputedStyle(el).animationName === 'none'`; `[data-anim="spark"]` opacity 0.
  - Không reduced-motion (context riêng): `[data-anim="trolley"]` có `animationDuration === '10s'`, `[data-anim="blink"]` `'1.6s'`; sau 2s mọi khối form có opacity 1.
  - Đang xử lý: `page.route('**/api/auth/callback/credentials**', r => setTimeout(() => r.continue(), 1500))`, bấm Đăng nhập -> `[data-auth="spinner"]` hiện, nút `aria-busy="true"` và `disabled`.
  - Lỗi: sai mật khẩu -> `[data-auth="notice-error"]` chứa `vi('auth.invalidCredentials')`; `/vi/login?error=AccessDenied` -> chứa `vi('authSecurity.googleDenied')`.
  - Đổi ngôn ngữ: ở `/vi/dat-lai-mat-khau?token=abc` bấm EN -> URL `/en/dat-lai-mat-khau?token=abc`.
  - Bàn phím: Tab đi qua VI/EN -> Google (nếu có) -> Email -> Quên mật khẩu -> Mật khẩu -> mắt -> Đăng nhập -> Tạo tài khoản, mỗi phần tử focus có `outline` 2px.
  - CLS: `PerformanceObserver` `layout-shift` tổng < 0.01 sau 3s ở 1440.
- [ ] **4.9 Dọn**: xoá `.authwrap`, `.authcard`, `.authsep` và các lớp con khỏi `app/globals.css` (giữ file nóng `globals.css` cho bước này); xoá 3 file cũ trong `src/components/layout/` sau khi đã chuyển.
- [ ] **4.10 Soi pixel**: đặt ảnh 1440 sáng cạnh `Main.dc.html`, 1440 tối cạnh `Dark.dc.html`, 390 cạnh `Mobile.dc.html`; lệch số đo, màu, khoảng cách thì sửa tới khi khớp. Ghi lại các chỗ cố ý khác mock-up (K2-K6) vào `.bangiao/thay-doi.md`.
- [ ] **4.11 Cổng**: `npx tsc --noEmit`, `npm test`, toàn bộ `npx playwright test`, build với font mock. Nhả `vi.json`, `en.json`, `globals.css`.
- [ ] **4.12 Commit** `feat(p3f-2): trang dang nhap quen dat lai mat khau kinh mo + e2e pixel`.

**Tiêu chí xong P3F-2:** 3 trang đúng bản chốt ở 1440/1280/390 sáng/tối, animation đủ theo lệnh và tắt hết khi reduced-motion, luồng Google và khoá tài khoản như cũ, e2e 01/10/20-24/27 xanh, không còn lớp CSS cũ.

---

# P3F-3: Đăng ký tài khoản chờ admin bật

File nóng cần giữ: `prisma/schema.prisma` + `prisma/migrations/` (Task 5), `src/i18n/messages/vi.json` + `en.json` (Task 6-7). Không đụng `actions.ts`, `prisma-repo.ts`, `queries.ts`, `project-queries.ts`, `globals.css`.

### Task 5: Schema, migration, rollback, kho `SignupStore`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_p3f_dang_ky_phong_ban/migration.sql` (sinh bằng Prisma), `prisma/rollback/<cùng tên>.down.sql`
- Create: `src/server/repo/signup-types.ts`, `src/server/repo/prisma-repo-signup.ts`, `src/server/repo/mock-repo-signup.ts`, `src/server/signup-store.ts`
- Modify: `src/server/repo/types.ts` (thêm 2 giá trị vào `ThrottleKind`)
- Test: `src/server/repo/mock-repo-signup.test.ts`, `src/server/repo/prisma-repo-signup-real-db.test.ts`

**Interfaces:**
- Prisma (thêm sau `model AuthThrottle`):
  ```prisma
  /// P3F-3: danh mục phòng ban (admin sửa trong Quản trị).
  model Department {
    id            Int             @id @default(autoincrement())
    name          String          @unique
    isActive      Boolean         @default(true)
    createdAt     DateTime        @default(now())
    updatedBy     String          @default("system")
    users         UserRole[]
    signupRequests SignupRequest[]

    @@map("dim_department")
  }

  /// P3F-3: đăng ký đang chờ admin bật. Bật hoặc từ chối thì xoá dòng (nhật ký ở activity_log).
  model SignupRequest {
    id           Int         @id @default(autoincrement())
    email        String      @unique
    name         String
    departmentId Int?
    passwordHash String
    locale       String      @default("vi")
    requestIp    String      @default("")
    createdAt    DateTime    @default(now())
    department   Department? @relation(fields: [departmentId], references: [id], onDelete: Restrict)

    @@index([createdAt])
    @@map("signup_request")
  }
  ```
  `UserRole` thêm (ngay dưới khối P3E): `departmentId Int?` và `department Department? @relation(fields: [departmentId], references: [id], onDelete: Restrict)`, `@@index([departmentId])`.
- `ThrottleKind` thêm `| 'signup_ip' | 'signup_email'`.
- `src/server/repo/signup-types.ts`:
  ```ts
  import type { Role } from './types';
  export interface DepartmentRow { id: number; name: string; isActive: boolean; userCount: number; pendingCount: number }
  export interface SignupRequestRow { id: number; email: string; name: string; departmentId: number | null; departmentName: string | null; locale: 'vi' | 'en'; createdAt: string }
  export interface NewSignupRequest { email: string; name: string; departmentId: number | null; passwordHash: string; locale: 'vi' | 'en'; requestIp: string; createdAtIso: string }
  export type ApproveResult = { email: string; name: string; locale: 'vi' | 'en' } | 'not_found' | 'duplicate_account';
  export interface SignupStore {
    listDepartments(): Promise<DepartmentRow[]>;               // mọi phòng ban, xếp theo name (localeCompare 'vi')
    listActiveDepartments(): Promise<{ id: number; name: string }[]>;
    isActiveDepartment(id: number): Promise<boolean>;
    saveDepartment(input: { id?: number; name: string }, by: string): Promise<{ id: number; name: string } | 'duplicate_name' | 'not_found'>;
    setDepartmentActive(id: number, isActive: boolean, by: string): Promise<boolean>;
    deleteDepartment(id: number): Promise<'ok' | 'not_found' | { inUse: number }>;
    emailTaken(email: string): Promise<boolean>;               // có trong user_roles HOẶC signup_request
    createRequest(row: NewSignupRequest): Promise<'created' | 'duplicate'>;
    listPending(): Promise<SignupRequestRow[]>;                // cũ trước
    countPending(): Promise<number>;
    approveRequest(id: number, input: { role: Role; canViewFinance: boolean }): Promise<ApproveResult>;
    rejectRequest(id: number): Promise<{ email: string } | 'not_found'>;
  }
  ```
- `src/server/signup-store.ts`: `export function getSignupStore(): SignupStore` - khuôn `src/server/auth-store.ts` (có `DATABASE_URL` -> `prismaSignupStore`, không có -> kho bộ nhớ giữ trong `globalThis.__ddcMemorySignupStore`, nguồn tài khoản là `repo` của `mock-repo`: `{ findAccount: (e) => repo.findAccount(e), createAccount: (a) => repo.createAccount(a) }`).
- `mock-repo-signup.ts`: `export interface MemorySignupSource { findAccount(email: string): UserAccount | undefined; createAccount(account: UserAccount): void }`, `export function createMemorySignupStore(source: MemorySignupSource): SignupStore`.

- [ ] **5.1 Giữ file nóng** `schema.prisma` + `prisma/migrations/`.
- [ ] **5.2 Test đỏ** `mock-repo-signup.test.ts` (chạy trên kho bộ nhớ; `prisma-repo-signup-real-db.test.ts` chạy cùng bộ ca trên Postgres thật, khuôn `src/server/repo/prisma-repo-auth-real-db.test.ts` dòng 1-40, `describe.skipIf(!hasDb)`, dữ liệu test có tiền tố `test-p3f-`, tự dọn):
  - `saveDepartment` tên được `trim()` và gộp khoảng trắng liên tiếp; trùng tên không phân biệt hoa thường -> `'duplicate_name'`; tên rỗng không tới được store (chặn ở action).
  - `listActiveDepartments` bỏ phòng ban ẩn.
  - `deleteDepartment`: có 1 user hoặc 1 đăng ký chờ trỏ tới -> `{ inUse: n }` và KHÔNG xoá; không ai dùng -> `'ok'`.
  - `createRequest` email đã có đăng ký chờ -> `'duplicate'` (Prisma: bắt `P2002`).
  - `emailTaken` true khi email có trong user_roles hoặc signup_request.
  - `approveRequest`: tạo user_roles đúng `email`, `name`, `passwordHash`, `role`, `canViewFinance`, `departmentId`, `isActive: true`, rồi xoá đăng ký; gọi lần 2 cùng id -> `'not_found'`; email đã có user_roles -> `'duplicate_account'` và đăng ký VẪN còn (giao dịch hoàn tác).
  - 2 lời gọi `approveRequest` đồng thời cùng id (`Promise.all`) -> đúng 1 thành công (chỉ ca DB thật).
  - `rejectRequest` xoá và trả email; lần 2 -> `'not_found'`.
- [ ] **5.3 Chạy** -> FAIL.
- [ ] **5.4 Sửa schema**, sinh migration: `npx prisma migrate dev --create-only --name p3f_dang_ky_phong_ban` (trỏ DB `ddc_control_tower_c`), đọc lại SQL (phải có `CREATE TABLE "dim_department"`, `CREATE TABLE "signup_request"`, `ALTER TABLE "user_roles" ADD COLUMN "departmentId"`, 2 khoá ngoại `ON DELETE RESTRICT`, index), rồi `npx prisma migrate deploy` và `npx prisma generate`.
- [ ] **5.5 Rollback** `prisma/rollback/<tên migration>.down.sql`, khuôn `prisma/rollback/20260928080000_p3e_dang_nhap_bo_anh.down.sql` (comment không dấu, dòng "Revert code truoc, roi moi chay file nay.", lệnh chạy `npx prisma db execute --file ... --schema prisma/schema.prisma`):
  ```sql
  BEGIN;
  ALTER TABLE "user_roles" DROP CONSTRAINT IF EXISTS "user_roles_departmentId_fkey";
  DROP INDEX IF EXISTS "user_roles_departmentId_idx";
  ALTER TABLE "user_roles" DROP COLUMN IF EXISTS "departmentId";
  DROP TABLE IF EXISTS "signup_request";
  DROP TABLE IF EXISTS "dim_department";
  DELETE FROM "_prisma_migrations" WHERE "migration_name" = '<tên migration>';
  COMMIT;
  ```
  Ghi chú trong file: đăng ký đang chờ và danh mục phòng ban bị mất khi hoàn tác.
  Thử thật trên DB C: chạy down -> `npx prisma migrate deploy` lại -> sạch.
- [ ] **5.6 Viết 2 kho**. Prisma:
  - `approveRequest` trong `prisma.$transaction(async (tx) => ...)`: `tx.signupRequest.delete({ where: { id } })` (bắt `P2025` -> `'not_found'`), rồi `tx.userRole.create(...)`; `P2002` ném ra ngoài giao dịch để hoàn tác, bắt ở ngoài -> `'duplicate_account'`.
  - `saveDepartment` kiểm trùng bằng `findFirst({ where: { name: { equals: name, mode: 'insensitive' }, NOT: { id } } })` trước khi ghi, vẫn bắt `P2002`.
  - `deleteDepartment`: đếm `userRole` + `signupRequest` theo `departmentId` trong cùng giao dịch trước khi xoá.
  - Kho bộ nhớ: cùng hành vi, id tăng dần, `createdAt` ISO.
- [ ] **5.7 Chạy** `npx vitest run src/server/repo/mock-repo-signup.test.ts`; chạy tay bản DB thật với `$env:DATABASE_URL` trỏ `ddc_control_tower_c` -> PASS. `npx tsc --noEmit`, `npm test` xanh.
- [ ] **5.8 Commit** `feat(p3f-3): schema phong ban + dang ky cho bat, migration co rollback, SignupStore`. Nhả `schema.prisma` + `prisma/migrations/`.

### Task 6: Logic đăng ký, trang `/dang-ky`, trang `/dieu-khoan`

**Files:**
- Create: `src/lib/signup-policy.ts`, `src/server/signup.ts`, `src/server/actions-signup.ts`, `app/[locale]/(auth)/dang-ky/page.tsx`, `src/components/auth/SignupForm.tsx`, `app/[locale]/dieu-khoan/page.tsx`
- Modify: `middleware.ts` (dòng 19 `PUBLIC_PATHS`), `src/lib/login-policy.ts` (thêm hằng số), `vi.json`, `en.json`, `src/i18n/messages.test.ts` (thêm file mới vào `CHANGED_SOURCES`)
- Test: `src/lib/signup-policy.test.ts`, `src/server/signup.test.ts`, `src/server/actions-signup.test.ts`, `src/server/middleware-auth.test.ts` (thêm ca), `src/components/auth/SignupForm.test.ts`

**Interfaces:**
- `src/lib/login-policy.ts` thêm: `SIGNUP_IP_LIMIT = 10`, `SIGNUP_EMAIL_LIMIT = 3`, `SIGNUP_WINDOW_MS = 3_600_000`, `SIGNUP_NAME_MAX = 100`, `SIGNUP_PASSWORD_MIN = 8`, `SIGNUP_PASSWORD_MAX = 128`.
- `src/lib/signup-policy.ts`:
  ```ts
  /** Chờ Q2: mặc định ['daidung.vn'] theo quyết định 1; Q2 = (b) thì ['daidung.com.vn'], (c) thì cả hai. */
  export const COMPANY_EMAIL_DOMAINS: readonly string[] = ['daidung.vn'];
  /** normalizeEmail rồi so khớp /^[a-z0-9._%+-]{1,64}@<đuôi>$/ với đúng 1 đuôi trong danh sách (khớp nguyên đuôi, không nhận tên miền con, không nhận đuôi dài hơn). */
  export function isCompanyEmail(raw: unknown): boolean;
  ```
- `src/server/signup.ts`:
  ```ts
  export type SignupField = 'name' | 'department' | 'email_domain' | 'too_short' | 'too_long';
  export type SignupResult = { status: 'accepted' } | { status: 'invalid'; field: SignupField } | { status: 'rate_limited' };
  export async function requestSignup(
    signup: SignupStore, auth: AuthStore,
    input: { name: unknown; departmentId: unknown; email: unknown; password: unknown; locale: 'vi' | 'en'; ip: string },
    now?: Date,
  ): Promise<SignupResult>;
  export function __signupQueueIdleForTest(): Promise<void>;
  ```
- `src/server/actions-signup.ts` (`'use server'`, KHÔNG cần đăng nhập): `export async function submitSignupAction(input: { name: string; departmentId: number | null; email: string; password: string; locale: string }): Promise<SignupResult>` - lấy IP bằng `clientIpFrom(await headers())`, locale qua `toLocale` (khuôn `src/server/actions-password-reset.ts` dòng 10-12), bọc try/catch: lỗi hạ tầng -> log tên lỗi, trả `{ status: 'accepted' }`.

- [ ] **6.1 Test đỏ `signup-policy.test.ts`** (chờ Q2, viết theo `['daidung.vn']`): nhận `ten@daidung.vn`, `Ten.A@DaiDung.VN`, `  ten@daidung.vn  `; từ chối `ten@daidung.vn.x.com`, `ten@sub.daidung.vn`, `ten@xdaidung.vn`, `ten@daidung.com.vn`, `@daidung.vn`, `a@b@daidung.vn`, `ten@daidung.vn.`, chuỗi 255 ký tự, `null`, `123`.
- [ ] **6.2 Test đỏ `signup.test.ts`** (kho bộ nhớ của Task 5 + `createMemoryAuthStore`; giả `hashPassword` bằng `vi.mock('@/lib/password')` đếm số lần gọi):
  - Tên rỗng/chỉ khoảng trắng/dài > 100 -> `invalid name`; email sai đuôi -> `invalid email_domain`; mật khẩu < 8 -> `too_short`, > 128 -> `too_long`.
  - Danh mục có phòng ban đang dùng: `departmentId` null, không phải số nguyên, không tồn tại hoặc đã ẩn -> `invalid department`. Danh mục trống: `departmentId` khác null -> `invalid department`, null -> hợp lệ.
  - Thứ tự kiểm: name -> department -> email_domain -> password (trả lỗi đầu tiên).
  - Hợp lệ, email mới -> `accepted`; sau `__signupQueueIdleForTest()` có đúng 1 đăng ký chờ với `passwordHash` khác mật khẩu gốc, `locale`, `requestIp`; `activity` có `signup_request` detail `created`.
  - Email đã có tài khoản / đã có đăng ký chờ -> VẪN `accepted`, `hashPassword` VẪN được gọi đúng 1 lần, không tạo dòng mới, `activity` ghi `signup_request` detail `duplicate` với tên/email cố định `'dang-ky-trung'` (không lưu email do người gọi gõ).
  - Lần thứ 11 trong 1 giờ cùng IP -> `rate_limited`; lần thứ 4 cùng email (IP khác nhau) -> `rate_limited` và nhả lại chỗ IP (`releaseThrottle`).
  - Hết lượt: KHÔNG gọi `hashPassword`, KHÔNG ghi activity.
  - Q5 = (a): đăng ký bị từ chối (`rejectRequest`) rồi gửi lại cùng email -> tạo đăng ký chờ mới. (Nếu Q5 = (b): phải thêm bảng/cột lưu email bị từ chối vào Task 5; dừng, báo lại planner.)
- [ ] **6.3 Viết `requestSignup`** đúng thứ tự:
  1. Kiểm dữ liệu nhập (chỉ phụ thuộc dữ liệu nhập và danh mục phòng ban công khai, không đọc tài khoản): `name.trim()` 1..100; phòng ban theo 6.2; `isCompanyEmail`; độ dài mật khẩu. Sai -> `invalid`.
  2. `ipKey = ip.trim() || 'unknown'`; `auth.reserveThrottle('signup_ip', ipKey, nowIso, sinceIso, SIGNUP_IP_LIMIT)`; `null` -> `rate_limited`.
  3. `auth.reserveThrottle('signup_email', email, ...)`, `null` -> `releaseThrottle(ipReserved)` rồi `rate_limited`.
  4. `passwordHash = await hashPassword(password)` (mọi nhánh còn lại đều băm, K10).
  5. Xếp việc nền vào hàng đợi (khuôn `resetRequestQueueTail` + `withTimeout` 30s của `src/server/password-reset.ts` dòng 37-69): `emailTaken` -> log `duplicate` và dừng; không thì `createRequest`, `'duplicate'` (đua) -> log `duplicate`; `'created'` -> `logActivity({ name, email }, 'signup_request', 'created')`. Lỗi nền chỉ log `e.name`.
  6. Trả `{ status: 'accepted' }`.
- [ ] **6.4 Middleware**: `PUBLIC_PATHS = ['/login', '/quen-mat-khau', '/dat-lai-mat-khau', '/dang-ky', '/dieu-khoan']`. Test thêm vào `src/server/middleware-auth.test.ts`: chưa đăng nhập vào `/vi/dang-ky` và `/en/dieu-khoan` không bị chuyển hướng; `/vi/dang-ky-gia` vẫn bị chuyển về `/vi/login`.
- [ ] **6.5 Trang `/dang-ky`** `app/[locale]/(auth)/dang-ky/page.tsx` (server): đã đăng nhập -> `redirect` như trang login; đọc `googleEnabled` như trang login; `departments = await getSignupStore().listActiveDepartments()`; render `<AuthCard width={480}><SignupForm departments={departments} googleEnabled={googleEnabled} /></AuthCard>`.
  `SignupForm({ departments, googleEnabled }: { departments: { id: number; name: string }[]; googleEnabled: boolean })` theo `DangKy.dc.html` dòng 93-110 (form gap 18, ô cao 46):
  `AuthHeading` (eyebrow `signup.eyebrow`, title `signup.title`, intro `signup.intro`) -> `GoogleButton` + `AuthDivider` (chỉ khi `googleEnabled`, cùng luồng `signIn('google', { callbackUrl: \`/${locale}\` })`) -> lưới 2 cột gap 12: Họ và tên (`id="signup-name"`, `autoComplete="name"`, `maxLength={100}`) + Phòng ban (`<select id="signup-department">` cùng kiểu ô nhập, dòng đầu `signup.departmentPlaceholder` giá trị rỗng; KHÔNG render khi `departments.length === 0`, khi đó ô Họ tên chiếm cả hàng; mobile < 1280 luôn 1 cột) -> Email công ty (`id="signup-email"`, `type="email"`, gợi ý 12px `signup.emailHint`; lỗi đuôi hiện ngay dưới ô, `aria-invalid`, `aria-describedby`) -> Mật khẩu (`AuthPasswordInput` `autoComplete="new-password"`, placeholder `signup.passwordPlaceholder`) + `PasswordStrength` -> `AuthNotice error` cho lỗi chung -> `AuthPrimaryButton` (chữ `signup.submit`, busy `authPage.sending`, `arrow`) -> dòng điều khoản 13/1.5 giữa `t.rich('signup.terms', { link: (c) => <Link href="/dieu-khoan">{c}</Link> })` -> dòng `signup.haveAccount` + link `/login` chữ `auth.signIn`.
  Kiểm tại form trước khi gửi (không thay kiểm ở server): đuôi email bằng `isCompanyEmail`, độ dài mật khẩu, tên.
  Kết quả: `invalid` -> lỗi đúng ô (`department`: nếu server báo mà form không có ô thì `router.refresh()` và hiện `signup.departmentChanged`); `rate_limited` -> `AuthNotice error` `signup.rateLimited`; `accepted` -> màn thành công trong cùng thẻ: ô 56x56 như màn "Kiểm tra hộp thư" chứa `IconCheck` 26 màu `#f5b301` -> h1 `signup.doneTitle` -> p `signup.doneBody` -> `AuthGhostButton` về `/login` chữ `authSecurity.backToLogin`. Mật khẩu xoá khỏi state ngay khi gửi xong.
- [ ] **6.6 Trang `/dieu-khoan`** `app/[locale]/dieu-khoan/page.tsx` (server, NGOÀI nhóm `(auth)`, không có panel cẩu): `metadata.title` = `t('terms.title')`; khối `.glass` (CSS module `src/components/auth/terms.module.css`) rộng tối đa 760, padding 40 (mobile 24px 20px), bo 26, giữa màn, margin 24px auto; đầu thẻ `AuthBrand size="sm"`; h1 34/800; dòng `terms.updated`; 6 mục h2 17/700 + p 15/1.6; cuối trang link về `/login` (chữ `authSecurity.backToLogin`) và `/dang-ky` (chữ `authPage.createAccount`). Không đọc dữ liệu dự án, không gọi `requireUser`.
- [ ] **6.7 i18n** nhóm `signup` và `terms`:

  | Key | vi | en |
  |---|---|---|
  | `signup.eyebrow` | Tạo tài khoản | Create account |
  | `signup.title` | Bắt đầu cùng đồng nghiệp | Get started with your colleagues |
  | `signup.intro` | Dùng email công ty để tạo tài khoản, chỉ mất khoảng một phút. | Use your company email to create an account. It takes about a minute. |
  | `signup.fullName` | Họ và tên | Full name |
  | `signup.namePlaceholder` | Nguyễn Văn A | Nguyen Van A |
  | `signup.department` | Phòng ban | Department |
  | `signup.departmentPlaceholder` | Chọn phòng ban | Select a department |
  | `signup.companyEmail` | Email công ty | Company email |
  | `signup.emailHint` | Chỉ nhận email có đuôi @daidung.vn (chờ Q2) | Only @daidung.vn addresses are accepted |
  | `signup.emailDomainError` | Vui lòng dùng email công ty @daidung.vn (chờ Q2) | Please use your company email @daidung.vn |
  | `signup.passwordPlaceholder` | Tối thiểu 8 ký tự | At least 8 characters |
  | `signup.passwordTooLong` | Mật khẩu tối đa 128 ký tự | Password can be at most 128 characters |
  | `signup.nameError` | Vui lòng nhập họ và tên (tối đa 100 ký tự) | Please enter your full name (up to 100 characters) |
  | `signup.departmentError` | Vui lòng chọn phòng ban | Please select a department |
  | `signup.departmentChanged` | Danh sách phòng ban vừa thay đổi, vui lòng chọn lại. | The department list has changed, please select again. |
  | `signup.submit` | Tạo tài khoản | Create account |
  | `signup.terms` | Khi tạo tài khoản, bạn đồng ý với <link>Điều khoản sử dụng</link> của công ty. | By creating an account, you agree to the company's <link>Terms of use</link>. |
  | `signup.haveAccount` | Đã có tài khoản? | Already have an account? |
  | `signup.doneTitle` | Chào mừng bạn! | Welcome aboard! |
  | `signup.doneBody` | Đăng ký của bạn đã được ghi nhận. Khi tài khoản sẵn sàng, chúng tôi sẽ báo qua email công ty để bạn đăng nhập. | Your registration has been received. When your account is ready, we will let you know at your company email so you can sign in. |
  | `signup.rateLimited` | Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 giờ. | Too many requests. Please try again in an hour. |
  | `terms.title` | Điều khoản sử dụng | Terms of use |
  | `terms.updated` | Cập nhật lần cuối: 29/09/2026 | Last updated: 29 September 2026 |
  | `terms.intro` | Báo cáo quản trị là hệ thống nội bộ của Đại Dũng. Khi tạo tài khoản và sử dụng hệ thống, bạn đồng ý với các điều khoản dưới đây. | Management Reports is an internal system of Dai Dung. By creating an account and using the system, you agree to the terms below. |
  | `terms.s1Title` / `terms.s1Body` | 1. Phạm vi sử dụng / Hệ thống chỉ dùng cho công việc của Đại Dũng. Mỗi tài khoản dành cho một người, không dùng chung và không cho người khác mượn. | 1. Scope of use / The system is for Dai Dung work only. Each account belongs to one person and must not be shared or lent to others. |
  | `terms.s2Title` / `terms.s2Body` | 2. Tài khoản và mật khẩu / Bạn chịu trách nhiệm giữ bí mật mật khẩu và mọi thao tác thực hiện bằng tài khoản của mình. Nếu nghi mật khẩu bị lộ, hãy đổi mật khẩu ngay và báo cho quản trị viên. | 2. Account and password / You are responsible for keeping your password secret and for all actions taken with your account. If you suspect your password has leaked, change it immediately and tell an administrator. |
  | `terms.s3Title` / `terms.s3Body` | 3. Bảo mật dữ liệu dự án / Dữ liệu trên hệ thống là thông tin nội bộ. Không chia sẻ, chụp màn hình, sao chép hay xuất dữ liệu ra ngoài công ty khi chưa được phép. | 3. Project data confidentiality / Data in the system is internal information. Do not share, screenshot, copy or export it outside the company without permission. |
  | `terms.s4Title` / `terms.s4Body` | 4. Dữ liệu cá nhân / Hệ thống lưu họ tên, email, phòng ban và nhật ký đăng nhập, thao tác của bạn. Các thông tin này chỉ dùng để quản lý tài khoản, phân quyền và kiểm tra an toàn hệ thống. | 4. Personal data / The system stores your name, email, department and your sign-in and activity logs. This information is used only to manage accounts and permissions and to keep the system secure. |
  | `terms.s5Title` / `terms.s5Body` | 5. Quyền của công ty / Công ty có quyền khoá hoặc tắt tài khoản khi phát hiện vi phạm các điều khoản này, khi bạn không còn cần dùng hệ thống hoặc khi bạn nghỉ việc. | 5. Company rights / The company may lock or disable an account when these terms are breached, when you no longer need the system, or when you leave the company. |
  | `terms.s6Title` / `terms.s6Body` | 6. Liên hệ hỗ trợ / Cần hỗ trợ về tài khoản hoặc có câu hỏi về điều khoản này, vui lòng liên hệ [LIÊN HỆ]. | 6. Support / For account help or questions about these terms, please contact [LIÊN HỆ]. |

  Mỗi ô "a / b" là 2 key riêng (`...Title`, `...Body`). `[LIÊN HỆ]` giữ nguyên chữ, không tự bịa người liên hệ.
  Bản điều khoản là bản nháp: ghi vào `.bangiao/thay-doi.md` mục "CHỜ CHỦ DỰ ÁN DUYỆT TRƯỚC MERGE: nội dung /dieu-khoan".
- [ ] **6.8 Test** `actions-signup.test.ts` (mock `next/headers`, store bộ nhớ): gọi không đăng nhập vẫn chạy; lỗi hạ tầng giả (store ném) -> `accepted`, `console.error` chỉ nhận tên lỗi. `SignupForm.test.ts`: có/không có ô phòng ban theo `departments`, có link `/dieu-khoan`, có `autocomplete="new-password"`, không có ô nào `type="checkbox"`.
- [ ] **6.9 Chạy** toàn bộ test Task 6 -> PASS; `npx tsc --noEmit`; `npm test`.
- [ ] **6.10 Commit** `feat(p3f-3): trang dang ky cho admin bat + trang dieu khoan cong khai`.

### Task 7: Quản trị: đăng ký chờ, bật/từ chối, email, Phòng ban, nhắc admin + e2e

**Files:**
- Create: `src/server/actions-signup-admin.ts`, `src/components/admin/SignupRequestList.tsx`, `src/components/admin/DepartmentEditor.tsx`, `src/components/layout/SignupReminder.tsx`, `e2e/28-dang-ky.spec.ts`
- Modify: `app/[locale]/(app)/admin/page.tsx`, `app/[locale]/(app)/layout.tsx`, `src/server/auth-mail.ts` (thêm `signupMailer`), `vi.json`, `en.json`, `src/i18n/messages.test.ts`
- Test: `src/server/actions-signup-admin.test.ts`, `src/components/admin/SignupRequestList.test.ts`, `src/components/admin/DepartmentEditor.test.ts`, `src/server/auth-mail.test.ts` (thêm ca)

**Interfaces** (`'use server'`, mọi hàm gọi `requireRoleUser(['admin'])` của `src/server/action-guards.ts` đầu tiên, trả `Forbidden` nếu không phải admin; khuôn `src/server/actions-master.ts`):
```ts
export async function approveSignupAction(id: number, role: Role): Promise<{ ok: true; mailed: boolean } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'not_found' | 'duplicate_account' }>;
export async function rejectSignupAction(id: number): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'not_found' }>;
export async function saveDepartmentAction(input: { id?: number; name: string }): Promise<{ ok: true; id: number } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'duplicate_name' | 'not_found' }>;
export async function setDepartmentActiveAction(id: number, isActive: boolean): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'not_found' }>;
export async function deleteDepartmentAction(id: number): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'not_found' | 'in_use'; count?: number }>;
```
- `signupMailer` trong `src/server/auth-mail.ts`: `{ getSmtp: getAuthSmtpConfig, compose(locale, name, email, link): Promise<{ subject: string; text: string }>, queue: queueAuthEmail }`; `compose` dùng `getTranslations({ locale })` và key `signup.mailSubject`, `signup.mailBody`.

- [ ] **7.1 Test đỏ `actions-signup-admin.test.ts`**:
  - Không đăng nhập / vai trò khác admin -> `Forbidden` cho cả 5 hàm, store không bị gọi.
  - `id` không phải số nguyên dương, `role` ngoài 4 giá trị -> `Invalid input`.
  - Bật: gọi `approveRequest(id, { role, canViewFinance: role !== 'viewer' })`; `logActivity(admin, 'signup_approve', '<email>:<role>')`; có SMTP + `NEXTAUTH_URL` -> `queue` được gọi đúng 1 lần tới email người đăng ký, link `${NEXTAUTH_URL}/${locale}/login`, trả `mailed: true`; thiếu một trong hai -> không gửi, `mailed: false`, vẫn `ok`.
  - `not_found`, `duplicate_account` trả đúng, không ghi log, không gửi mail.
  - Từ chối: `logActivity(admin, 'signup_reject', email)`, KHÔNG gửi mail (quyết định 4).
  - Phòng ban: tên `trim` rỗng hoặc > 100 -> `Invalid input`; log `save_department`, `hide_department` / `show_department`, `delete_department`; `in_use` trả `count`.
  - Không dùng cache tag: trang Quản trị đọc thẳng từ store mỗi lần render, client gọi `router.refresh()` sau thao tác thành công.
- [ ] **7.2 Chạy** -> FAIL; viết `actions-signup-admin.ts` và `signupMailer`; chạy lại -> PASS.
- [ ] **7.3 `SignupRequestList({ requests }: { requests: SignupRequestRow[] })`** ('use client', khuôn bảng `src/components/admin/FactoryEditor.tsx`): bảng `tbl sticky` cột Họ tên, Email, Phòng ban (null -> "-"), Ngày gửi (`formatDate` theo locale), Vai trò khi bật (`<select>` 4 vai trò, nhãn `role.*`, chọn sẵn `viewer`), 2 nút "Bật tài khoản" (`btn`) và "Từ chối" (`btn ghost`, `window.confirm(t('signup.rejectConfirm', { email }))`).
  Kết quả hiện `sumbar good` / `sumbar bad` phía trên bảng: `signup.approvedMailed`, `signup.approvedNoMail`, `signup.errDuplicateAccount`, `signup.errNotFound`; thành công -> `router.refresh()`.
  Danh sách rỗng -> `signup.pendingEmpty`. Màn 390: bảng `minWidth: 760` cuộn ngang trong `.scroll`.
- [ ] **7.4 `DepartmentEditor({ departments }: { departments: DepartmentRow[] })`**: khuôn `FactoryEditor.tsx` (bảng + dòng thêm mới), cột Tên, Trạng thái (`department.active` / `department.hidden`), Số người dùng, nút Lưu / Ẩn hoặc Hiện lại / Xoá (Xoá chỉ hiện khi `userCount + pendingCount === 0`, có `window.confirm`); chú thích `department.hint` dưới bảng.
- [ ] **7.5 Trang Quản trị** `app/[locale]/(app)/admin/page.tsx`: đọc `const signup = getSignupStore()`, `pending = await signup.listPending()`, `departments = await signup.listDepartments()`.
  Thêm thẻ `<div id="dang-ky-cho"><Card className="overflow-visible"><CardHeader title={t('signup.pendingTitle', { n: pending.length })} action={<IconUser size={18} />} />...<SignupRequestList .../></Card></div>` ĐẦU trang (trước thẻ `admin.userRoles`), và thẻ `department.title` ngay SAU thẻ `factoryAdmin.title`.
- [ ] **7.6 Nhắc admin (chờ Q1, làm theo Đề xuất (a))**: `SignupReminder({ locale, count }: { locale: string; count: number })` (server, khuôn `src/components/layout/RateReminder.tsx`): `<div className="sumbar" data-signup-reminder="">{t('signup.reminder', { n: count })} <a href={\`/${locale}/admin#dang-ky-cho\`}>{t('signup.reminderLink')}</a></div>`.
  `app/[locale]/(app)/layout.tsx`: admin thì `pendingSignups = await getSignupStore().countPending()`, `> 0` thì render `SignupReminder` ngay sau `RateReminder`. Vai trò khác không truy vấn.
  Nếu Q1 = (b): thay bằng số đếm cạnh mục `/admin` trong `AppShell` (prop mới `pendingSignups: number` truyền từ layout, huy hiệu tròn nền `var(--gold)` chữ `#0a1f3d` 11/700). Nếu Q1 = (c): dừng, cần mock-up riêng.
- [ ] **7.7 i18n** bổ sung nhóm `signup`, thêm nhóm `department`, và CUỐI nhóm `activity`:

  | Key | vi | en |
  |---|---|---|
  | `signup.pendingTitle` | Đăng ký đang chờ ({n}) | Pending registrations ({n}) |
  | `signup.pendingEmpty` | Không có đăng ký nào đang chờ. | No pending registrations. |
  | `signup.colSubmitted` | Ngày gửi | Submitted |
  | `signup.colRole` | Vai trò khi bật | Role on activation |
  | `signup.approve` | Bật tài khoản | Activate account |
  | `signup.reject` | Từ chối | Decline |
  | `signup.rejectConfirm` | Từ chối đăng ký của {email}? Người đăng ký sẽ không nhận được email báo. | Decline the registration from {email}? No email will be sent to them. |
  | `signup.approvedMailed` | Đã bật tài khoản và gửi email báo cho {email}. | Account activated and {email} has been notified by email. |
  | `signup.approvedNoMail` | Đã bật tài khoản {email}. Chưa gửi được email vì hệ thống chưa cấu hình gửi email. | Account {email} activated. No email was sent because email sending is not configured. |
  | `signup.errDuplicateAccount` | Email này đã có tài khoản. Hãy từ chối đăng ký này. | This email already has an account. Please decline this registration. |
  | `signup.errNotFound` | Đăng ký này đã được xử lý. | This registration has already been handled. |
  | `signup.reminder` | Có {n} đăng ký mới đang chờ bật. | {n} new registrations are waiting for activation. |
  | `signup.reminderLink` | Xem trong Quản trị | Open Administration |
  | `signup.mailSubject` | Tài khoản của bạn đã sẵn sàng | Your account is ready |
  | `signup.mailBody` | Chào {name},\n\nTài khoản {email} trên hệ thống Báo cáo quản trị đã sẵn sàng. Bạn có thể đăng nhập tại:\n{link}\n\nNếu bạn không đăng ký tài khoản này, hãy báo cho quản trị viên. | Hello {name},\n\nYour account {email} on Management Reports is ready. You can sign in at:\n{link}\n\nIf you did not register for this account, please tell an administrator. |
  | `department.title` | Phòng ban | Departments |
  | `department.name` | Tên phòng ban | Department name |
  | `department.status` | Trạng thái | Status |
  | `department.users` | Số người dùng | Users |
  | `department.active` / `department.hidden` | Đang dùng / Đã ẩn | Active / Hidden |
  | `department.add` / `department.save` | Thêm / Lưu | Add / Save |
  | `department.hide` / `department.show` / `department.delete` | Ẩn / Hiện lại / Xoá | Hide / Show / Delete |
  | `department.confirmDelete` | Xoá phòng ban {name}? | Delete department {name}? |
  | `department.hint` | Danh mục này hiện trên form Đăng ký. Phòng ban đã có người dùng hoặc đăng ký đang chờ chỉ ẩn được, không xoá được. Danh mục trống thì form Đăng ký không hỏi phòng ban. | This list appears on the registration form. A department with users or pending registrations can only be hidden, not deleted. If the list is empty, the registration form does not ask for a department. |
  | `department.errDuplicate` | Tên phòng ban đã có | This department name already exists |
  | `department.errInvalid` | Tên phòng ban không hợp lệ (1-100 ký tự) | Invalid department name (1-100 characters) |
  | `department.errInUse` | Phòng ban đang được {count} người dùng hoặc đăng ký, chỉ ẩn được | Used by {count} users or registrations, can only be hidden |
  | `activity.signup_request` | Gửi đăng ký tài khoản | Account registration submitted |
  | `activity.signup_approve` | Bật tài khoản đăng ký | Registration activated |
  | `activity.signup_reject` | Từ chối đăng ký | Registration declined |
  | `activity.save_department` | Lưu phòng ban | Save department |
  | `activity.hide_department` / `activity.show_department` / `activity.delete_department` | Ẩn phòng ban / Hiện lại phòng ban / Xoá phòng ban | Hide department / Show department / Delete department |

  Họ tên, Email, Phòng ban trong bảng dùng lại `signup.fullName`, `signup.companyEmail`, `signup.department`.
- [ ] **7.8 e2e `e2e/28-dang-ky.spec.ts`** (email test `e2e-dangky-<Date.now()>@daidung.vn`, đổi đuôi theo Q2):
  1. Admin (storageState admin) thêm phòng ban `E2E PB <ts>` ở thẻ Phòng ban.
  2. Context chưa đăng nhập mở `/vi/dang-ky`: ô Phòng ban có tên vừa thêm; nhập email `ten@gmail.com` -> lỗi `signup.emailDomainError` ngay dưới ô, không gửi; nhập đúng, mật khẩu `Abcdef1!` thấy nhãn độ mạnh `authPage.strength4`; gửi -> thấy `signup.doneTitle`.
  3. Gửi lại đúng email đó lần 2 -> VẪN thấy `signup.doneTitle` (không lộ email đã đăng ký).
  4. Đăng nhập bằng email + mật khẩu đó -> `auth.invalidCredentials` (tài khoản chờ không vào được); mở thẳng `/vi/overview` -> bị đưa về `/vi/login`.
  5. Admin mở `/vi/overview` thấy `[data-signup-reminder]` (Q1 = a); vào `/vi/admin#dang-ky-cho` thấy dòng đăng ký, chọn vai trò `viewer`, bấm Bật -> thấy `signup.approvedNoMail` hoặc `signup.approvedMailed` (tuỳ DB C có SMTP), dòng biến mất.
  6. Người đăng ký đăng nhập lại -> vào `/vi/overview`.
  7. Đăng ký email thứ 2, admin Từ chối (chấp nhận `confirm` bằng `page.once('dialog', d => d.accept())`) -> dòng biến mất; đăng ký lại cùng email -> dòng mới xuất hiện (Q5 = a).
  8. Phòng ban đã có người dùng: không có nút Xoá; Ẩn -> form `/vi/dang-ky` không còn tên đó.
  9. `/vi/dieu-khoan` và `/en/dieu-khoan` mở được khi chưa đăng nhập, có `terms.title` và `[LIÊN HỆ]`; link Điều khoản trên form Đăng ký dẫn tới đó.
  10. Soi pixel `/vi/dang-ky` và màn thành công ở 1440x960 và 390x844, sáng/tối, `reducedMotion: 'reduce'`, lưu `.bangiao/anh-p3f/dang-ky-<trang-thai>-<rong>-<sang|toi>.png`; `/vi/dieu-khoan` 1440 và 390 sáng/tối lưu `dieu-khoan-...png`; không cuộn ngang ở 390; `[data-auth="showcase"]` rộng 696 ở 1440.
  11. `/vi/dang-ky` khi danh mục trống: dùng tên phòng ban riêng của test, ẩn hết phòng ban do test tạo rồi kiểm KHÔNG có `#signup-department` chỉ khi DB không còn phòng ban đang dùng nào khác (bỏ qua ca này nếu còn, ghi `test.skip` kèm lý do).
- [ ] **7.9 Soi pixel** ảnh Đăng ký cạnh `DangKy.dc.html`; sửa tới khi khớp. Soi trang Quản trị 1440/390 sáng/tối có 2 thẻ mới, không lệch.
- [ ] **7.10 Cổng cuối P3F**: `npx tsc --noEmit`, `npm test`, toàn bộ `npx playwright test` (26, 27, 28 và mọi spec cũ), build với font mock. Nhả `vi.json`, `en.json`.
- [ ] **7.11 Commit** `feat(p3f-3): quan tri duyet dang ky, phong ban, email bat tai khoan, nhac admin + e2e`.

**Tiêu chí xong P3F-3:** đăng ký chỉ nhận đuôi công ty (theo Q2), phản hồi giống hệt cho email mới và email đã có, giới hạn theo IP và email chạy, tài khoản chờ không vào được trang nào, admin bật (chọn vai trò) và từ chối được, bật thì có email (khi có SMTP), từ chối không gửi mail, Phòng ban thêm/đổi tên/ẩn/xoá đúng luật, admin được nhắc trong app, `/dieu-khoan` công khai, migration có rollback đã thử, toàn bộ cổng xanh.

---

## Trường hợp biên bắt buộc (security-reviewer đối chiếu)

- Email: hoa/thường, khoảng trắng đầu cuối, tên miền con, đuôi kéo dài, nhiều `@`, > 254 ký tự; kiểm ở server, form chỉ là lớp phụ.
- Đăng ký trùng (đã có tài khoản, đang chờ, 2 yêu cầu đồng thời cùng email): cùng phản hồi `accepted`, cùng việc băm, không tạo dòng thứ 2 (khoá `@unique` + bắt `P2002`).
- Hết lượt IP hoặc email: không băm, không ghi log, nhả chỗ IP khi email hết lượt.
- IP rỗng gom vào khoá `unknown`.
- Tài khoản chờ bật đăng nhập bằng mật khẩu hoặc Google: bị từ chối với thông báo chung như email lạ (không có dòng trong `user_roles`).
- 2 admin bật cùng lúc 1 đăng ký: đúng 1 lần tạo tài khoản, người kia thấy `signup.errNotFound`.
- Bật khi email đã có tài khoản (admin tạo tay trước đó): `duplicate_account`, không ghi đè mật khẩu.
- Phòng ban bị ẩn giữa lúc người dùng điền form: server trả `department`, form tải lại danh sách.
- Danh mục phòng ban trống: không có ô, gửi `null` hợp lệ; admin thêm phòng ban đầu tiên giữa chừng: server trả `department`, form tải lại.
- Đổi ngôn ngữ ở trang đặt lại mật khẩu giữ nguyên `?token=`.
- Không lộ dữ liệu dự án ở mọi trang công khai (minh hoạ tĩnh, `/dieu-khoan` tĩnh).
- Lỗi hạ tầng ở action công khai: trả phản hồi bình thường, chỉ log tên lỗi.
- Mật khẩu không nằm trong log, URL, localStorage; state form xoá mật khẩu sau khi gửi.

## Việc KHÔNG làm trong P3F

- Không thêm chuông thông báo mới trên thanh tiêu đề (trừ khi Q1 = c, khi đó dừng để làm mock-up).
- Không thêm cột icon cho giai đoạn (trừ khi Q6 = b).
- Không làm "Ghi nhớ đăng nhập" (trừ khi Q3 = b, tách Task riêng).
- Không đổi luồng Google, luật khoá tài khoản, giới hạn đăng nhập của P3E.
- Không sửa `PROGRESS.md`, `.serena/memories/` trong nhánh này.
