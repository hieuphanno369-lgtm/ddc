KET QUA: XANH

# P2A — Nhập liệu mới — Kết quả tester VÒNG 3 (sau vòng sửa 2)

Nhánh `feature/p2a-nhap-lieu`, HEAD `fd3557e`, phạm vi soi `git diff 4872877..HEAD`.
Skill dùng: `ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`.
Chỉ tạo file test mới — không đụng code sản phẩm, PROGRESS.md, `.serena/memories/`, thư mục `-B`.

## 1. Cổng kiểm chung

- `npx tsc --noEmit`: sạch (0 lỗi).
- `npm test`: **98/98 file · 1177/1177 test xanh** (1168 cũ + 9 test độc lập mới của vòng 3).
- Dev server (`npx next dev -p 3000`) tự bật để smoke UI, đã dừng hẳn sau khi xong (xác nhận bằng
  `Get-NetTCPConnection -LocalPort 3000` không còn tiến trình lắng nghe).

## 2. Xác minh độc lập H-1b (file test MỚI, payload KHÁC hẳn test của coder)

File mới `src/server/h1b-independent.test.ts` (9 test), payload cố tình khác `daily-import.test.ts`
(coder dùng `xl/styles.xml`, `/xl/worksheets/sheet1.xml`) và `actions-import.test.ts`:

- `docProps/core.xml` phình 30MB → `assertXlsxInflatedSize` false; `readDailyWorkbook`
  `{ok:false,error:'bad_file'}`, < 2s.
- `xl/media/image1.png` phình 30MB → qua đường `importExcelAction` → `{ok:false,error:'Invalid file'}`,
  < 2s.
- `[Content_Types].xml` phình 30MB → false, < 2s.
- Entry tên lạ `abc/def.bin` (không giống cấu trúc file thật) phình 30MB → false.
- Tên có `/` đầu khác entry coder đã thử (`/docProps/app.xml`) → false.
- Cộng dồn qua nhiều entry nhỏ: 10 entry × 8KB (tổng 80KB, trần 64KB) → false; đối chứng 7 entry × 8KB
  (tổng 56KB, dưới trần) → true.
- Biên số entry: đúng `XLSX_MAX_ENTRIES` (200) → true; `XLSX_MAX_ENTRIES + 1` (201) → false.
- File `.xlsx` THẬT hợp lệ (`buildDailyTemplate` qua ExcelJS thật, có sẵn `styles`, `theme`/`docProps`
  ngoài `worksheets`/`sharedStrings`) → `assertXlsxInflatedSize` true, qua ĐƯỢC cả 2 đường
  `readDailyWorkbook` (ok:true) và `importExcelAction` (ok:true) — xác nhận vá không chặn nhầm file
  thật có nhiều entry phụ.

**Xác minh test có giá trị (red-green thật, không chỉ chạy 1 lần):** tạm thời thay nội dung
`src/server/daily-import.ts` bằng bản TRƯỚC vòng sửa 2 (`git show 4872877:...`, dùng regex lọc tên
entry + `total` tính riêng từng entry, không trần số entry) rồi chạy lại đúng file test này — **6/9
test RỚT** đúng như kỳ vọng (docProps/core.xml, Content_Types.xml, abc/def.bin, tên "/" đầu,
cộng dồn 10×8KB, biên 201 entry — toàn bộ payload nằm ngoài regex cũ hoặc dựa vào lỗi cộng dồn/thiếu
trần entry). Phục hồi lại đúng file vá của coder (`git status` xác nhận không còn diff trên
`daily-import.ts`), chạy lại → cả 9 test xanh. Kết luận: bộ test độc lập này THẬT SỰ bắt được lỗ hổng
H-1b nếu vá sai, không phải test giả xanh.

## 3. Xác minh mục 2 (14 key i18n `activity.*`) bằng Playwright trên dev cổng 3000

Đăng nhập sẵn `admin@daidung.com.vn` (session có sẵn từ trước).

### `/vi/admin`
- Bấm "Ngừng dùng" ở khu vực sản xuất "Nhà máy Hà Tĩnh" → dòng "Lịch sử hoạt động" mới nhất hiện
  **"Tắt khu vực sản xuất"** (không phải `activity.deactivate_factory` thô).
- Bấm "Dùng lại" (bật lại) → dòng mới nhất hiện **"Bật khu vực sản xuất"** (`activate_factory`).
  Đã khôi phục khu vực về trạng thái "Đang dùng" ban đầu — không để lại rác.
- Log sẵn có từ trước (không do tester tạo) đã hiện đúng **"Lưu tỷ giá"**, **"Xoá tỷ giá"**,
  **"Đóng cảnh báo"**, **"Đăng nhập"** — không có chuỗi `activity.xxx` thô nào trong bảng.
- Console lỗi: CHỈ có `IntlError: MISSING_MESSAGE: Could not resolve 'admin.delete'` (nút "Xóa" ở
  card "Xóa dự án", `DeleteProject.tsx`) — đúng như ghi chú "thiếu từ trước, không tính vòng này"
  trong `danh-gia.md`/`thay-doi.md`. Không có MISSING_MESSAGE nào khác cho `activity.*`.
- Ảnh: `.bangiao/test-screens/v3-admin-vi-activity-section.png`,
  `.bangiao/test-screens/v3-admin-vi-activity.png`.

### `/en/admin`
- Bảng "Activity log" hiện đúng nhãn tiếng Anh: "Activate factory", "Deactivate factory",
  "Save exchange rate", "Delete exchange rate", "Close alert", "Sign in" — không có chuỗi thô.
- Console lỗi: chỉ `admin.delete` (locale `en`), giống vi.
- Ảnh: `.bangiao/test-screens/v3-admin-en-activity-section.png`.

### Dọn dữ liệu
- Khu vực sản xuất "Nhà máy Hà Tĩnh" đã bật lại về "Đang dùng" (trạng thái ban đầu trước khi test).
- Không tạo thêm tỷ giá/entry nào khác trên DB dev.

## 4. Trường hợp phải thất bại (bắt buộc theo yêu cầu)

- `assertXlsxInflatedSize` với 201 entry nhỏ → phải `false` (test có, xanh).
- Test red-green ở mục 2: khi phục hồi code về bản CHƯA vá H-1b vòng 2, 6/9 test RỚT đúng kỳ vọng —
  chứng minh bộ test không phải kiểu "luôn xanh dù code sai".

## 5. File test đã tạo/sửa (vòng 3)

- `src/server/h1b-independent.test.ts` (mới, 9 test) — không sửa file test nào khác.
- `.bangiao/test-screens/v3-admin-vi-activity-section.png`
- `.bangiao/test-screens/v3-admin-vi-activity.png`
- `.bangiao/test-screens/v3-admin-en-activity-section.png`

Không sửa `src/server/daily-import.ts` hay bất kỳ file sản phẩm nào (đã đối chiếu `git status` +
`git diff` sau khi thử-red-rồi-phục-hồi ở mục 2 — không còn thay đổi nào trên file sản phẩm).

## Kết luận

XANH. tsc sạch, 1177/1177 test xanh (98/98 file). H-1b được xác minh độc lập bằng payload khác hẳn
test của coder (docProps/core.xml, xl/media/image1.png, [Content_Types].xml, tên lạ, tên "/" đầu khác,
cộng dồn nhiều entry nhỏ, đúng biên 200/201 entry, file .xlsx thật có styles/theme/docProps vẫn qua)
trên cả 2 đường `readDailyWorkbook` và `importExcelAction`, đều < 2s; xác nhận bằng red-green thật
(revert tạm về code trước vá → 6/9 rớt → phục hồi → xanh lại). 14 key i18n `activity.*` render đúng
nhãn tiếng Việt/Anh trên UI thật (`/vi/admin`, `/en/admin`) sau khi lưu tỷ giá / bật-tắt khu vực sản
xuất, không còn console MISSING_MESSAGE nào cho `activity.*` (chỉ còn `admin.delete` đã ghi nhận từ
trước, không chặn). Đề nghị chuyển reviewer chốt vòng 3.
