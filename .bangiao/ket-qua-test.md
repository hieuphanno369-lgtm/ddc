KET QUA: XANH

# P2A — Nhập liệu mới — Kết quả tester VÒNG 2 (sau vòng sửa 1)

Nhánh `feature/p2a-nhap-lieu`, HEAD `e267569`, phạm vi soi `git diff e693f8b..HEAD`.
Skill dùng: `ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`.
Chỉ tạo/sửa file test — không đụng code sản phẩm, PROGRESS.md, .serena/memories/, thư mục -B.

## 1. Cổng kiểm chung

- `npx tsc --noEmit`: sạch (0 lỗi).
- `npm test`: **97/97 file · 1157/1157 test xanh** (1140 cũ + 17 test độc lập mới của vòng 2).
- Dev server tự bật cổng 3000 để test UI, đã tắt (`taskkill`) sau khi xong; không có tiến trình
  `next dev` nào còn treo cổng 3000.

## 2. Xác minh độc lập H-1a/H-1b/H-1c (khác file độc hại với coder)

File mới `src/server/daily-import-v2.test.ts` (13 test) + `src/server/actions-import-v2.test.ts`
(4 test) — dùng file độc hại KHÁC với `daily-import.test.ts`/`actions-import.test.ts`/
`actions-entry.test.ts` của coder:

- **Biên rowCount/colCount đọc trực tiếp `readBoundedSheet`**: đúng biên `maxRows` → ok; vượt 1
  dòng → `too_many_rows`; đúng biên `SHEET_MAX_COLS` (64 cột) → ok; vượt 1 cột (65) → `too_many_cols`;
  sheet trống, `ws` undefined → không crash.
- **Sheet ThietBi (equipment) thưa nhưng có 1 ô ở dòng 6000** (khác kiểu tấn công XFD1/A1048576 của
  coder trên sheet NhanLuc) → `too_many_rows`, dưới 500ms (đơn vị) / dưới 2s (qua `readDailyWorkbook`
  và qua `importExcelAction`).
- **Zip bomb dựng tay bằng JSZip** (không qua exceljs) với `xl/sharedStrings.xml` nén cực mạnh —
  30MB giải nén, file nén chỉ ~30KB — bị `assertXlsxInflatedSize` chặn (`false`), `readDailyWorkbook`
  và `importExcelAction` trả `ok:false` nhanh (< 2s), không tự `wb.xlsx.load` giải nén toàn bộ.
- **File `.xlsx` giả** (buffer nhị phân ngẫu nhiên đổi đuôi, không phải cấu trúc zip/PK) → `bad_file`
  / `'Invalid file'` ở cả 2 tầng (`readDailyWorkbook`, `importExcelAction`), không ném lỗi 500, dưới 2s.
- **File hợp lệ vẫn đúng sau các chặn H-1**: `buildDailyTemplate` đọc lại đúng qua
  `readDailyWorkbook`; file `.xlsx` dựng bằng `XLSX.write` (thư viện `xlsx`, không phải exceljs)
  qua `importExcelAction` vẫn map đúng (`mapped: 1, invalid: 0`).
- **`rowNo` không lệch khi `eachRow({includeEmpty:false})` bỏ dòng trống ở giữa** (khác cách dựng
  file của coder — ở đây ghi trực tiếp `ws.getRow(N)`, không dùng `addRow` tuần tự, dòng trắng ở
  giữa CHƯA TỪNG được chạm tới): dòng 2 hợp lệ, dòng 3 hoàn toàn trắng, dòng 4 nhà thầu lạ →
  `previewDailyImportAction` báo đúng `rowNo` 2 và 4 (không có dòng 3, không bị lệch xuống 3).
- Trường hợp phải thất bại: `assertXlsxInflatedSize` với buffer rác không được coi mặc định là hợp
  lệ (`false`).

Kết quả: cả 17 test độc lập trên đều XANH → xác nhận H-1a/H-1b/H-1c của coder chặn đúng, không chỉ
đúng với 2 file mẫu trong bộ test gốc.

## 3. Kiểm UI bằng Playwright (dev cổng 3000, đăng nhập `admin@daidung.com.vn` / `Admin@123`)

### ExchangeRateEditor (`/vi/admin`)
- Nhập `0` (≤0) rồi Lưu → hiện `Tỷ giá phải là số > 0, tháng không ở tương lai.` với class
  `sumbar bad` (xác nhận bằng `browser_evaluate`). Ảnh: `v2-fxrates-invalid-desktop.png`.
- Sửa lại số hợp lệ (26100) rồi Lưu → dòng lỗi biến mất, bảng cập nhật "26.100 · Nhập tay".
- Bấm "Sửa" ở ô khác (chưa lưu) khi đang có lỗi → lỗi cũ biến mất ngay (đúng hành vi `setRowErr(null)`
  khi mở ô sửa mới).
- 390px: nhập `0` cho EUR → cùng câu lỗi hiện đúng, không vỡ layout. Ảnh: `v2-fxrates-invalid-390.png`.
- Đã dọn dữ liệu test (xoá tỷ giá USD 2026-08 vừa tạo) để không để lại rác trên DB dev.

### Import Excel (`/vi/nhap-lieu`, bước "Nhân lực & Thiết bị")
- File `XFD1`+`A1048576` (giống kiểu tấn công coder đã chặn) → preview hiện `File quá 5000 dòng.`
  (class `sumbar bad`), request POST trả 200 (không phải 500). Ảnh: `v2-import-malicious-desktop.png`.
- File zip bomb (JSZip dựng tay, `xl/sharedStrings.xml` 30MB giải nén) → preview hiện
  `File không đọc được hoặc không phải .xlsx.`, POST 200, phản hồi tức thì (không treo trình duyệt).
- File mẫu tải thật qua link "Tải file mẫu" (`buildDailyTemplate` thật, không phải dựng tay trong
  test) + thêm 1 dòng hợp lệ (nhà thầu có thật của dự án) → preview đúng `1 dòng hợp lệ · 0 dòng lỗi`,
  dòng hiện "Hợp lệ". Ảnh: `v2-import-valid-desktop.png`. Xác nhận H-1 không chặn nhầm file thật.

## 4. Ghi nhận ngoài phạm vi (không chặn XANH)

- Console lỗi `IntlError: MISSING_MESSAGE: Could not resolve 'admin.delete'` (nút xoá dự án,
  `DeleteProject.tsx`) và `'activity.save_exchange_rate'` (nhãn hoạt động trong `ActivityViewer.tsx`
  khi lưu tỷ giá) — cả hai là khoảng trống i18n có TRƯỚC vòng sửa 1 (không nằm trong file bị đổi ở
  `git diff e693f8b..HEAD`; `save_exchange_rate` đến từ `actions-master.ts` của Task 7, `admin.delete`
  không thuộc P2A). Không phải lỗi của vòng sửa 1, không chặn XANH — ghi lại để điều phối viên cân
  nhắc thêm vào "ĐỂ SAU" nếu muốn.

## 5. File test đã tạo (vòng 2)

- `src/server/daily-import-v2.test.ts` (mới, 13 test)
- `src/server/actions-import-v2.test.ts` (mới, 4 test)
- `.bangiao/test-screens/v2-fxrates-invalid-desktop.png`
- `.bangiao/test-screens/v2-fxrates-invalid-390.png`
- `.bangiao/test-screens/v2-import-malicious-desktop.png`
- `.bangiao/test-screens/v2-import-valid-desktop.png`

Không sửa file test cũ của coder (`daily-import.test.ts`, `actions-import.test.ts`,
`actions-entry.test.ts`) — chỉ thêm file mới để giữ độc lập với bộ test vòng 1.

## Kết luận

XANH. tsc sạch, 1157/1157 test xanh (bao gồm 17 test độc lập vòng 2), UI xác nhận đúng hành vi báo
lỗi/xoá lỗi của `ExchangeRateEditor` và import Excel từ chối file độc hại một cách thân thiện, nhanh,
không crash. Đề nghị chạy lại security-reviewer như `danh-gia.md` yêu cầu.
