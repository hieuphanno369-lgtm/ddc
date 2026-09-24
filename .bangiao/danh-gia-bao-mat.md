KET LUAN BAO MAT: KHONG DAT

# Đánh giá bảo mật — P2A VÒNG 2 (`feature/p2a-nhap-lieu`, `git diff e693f8b..HEAD`, HEAD `4872877`)

> Điều phối viên lưu hộ từ báo cáo security-reviewer (vai chỉ đọc). Bản vòng 1 xem git `e267569`.
> Điều phối viên đã tự đối chiếu `src/server/daily-import.ts:61-100` và `node_modules/exceljs/lib/xlsx/xlsx.js:278-312`:
> H-1b-1 và H-1b-2 đúng như mô tả.

Skill: `ddc-tower:security-review`, `ddc-tower:security-audit`. Chỉ đọc code, không chạy PoC. Điểm chưa xác minh xong
đánh dấu "cần xác minh".

## Trạng thái H-1

### H-1a (chặn dòng/cột): ĐÃ ĐÓNG
- `readBoundedSheet` (`src/server/daily-import.ts` ~43-55) chặn `rowCount > maxRows+1` và `getRow(1).cellCount > 64` trước
  mọi vòng lặp, duyệt `eachRow({includeEmpty:false})`; dùng ở cả `readDailyWorkbook` và `importExcelAction` (`actions.ts` ~474).
- `rowCount` = `_lastRowNumber` (`exceljs/lib/doc/worksheet.js:374`), không lấy từ `<dimension>` → `<dimension>` giả vô hại.
- `readSheet` dựng lại `rows[r.rowNo-2]` bị chặn bởi `maxRows` → an toàn.
- Giới hạn: lớp này chỉ tác dụng SAU `wb.xlsx.load`; bộ nhớ lúc load chỉ được chặn nhờ H-1b.

### H-1b (chống zip bomb): CHƯA ĐÓNG — mức Cao

**H-1b-1. Chỉ đo một phần các entry mà exceljs giải nén.**
- `src/server/daily-import.ts` ~71-73: regex `/^xl\/(worksheets\/[^/]+\.xml|sharedStrings\.xml)$/`.
- `exceljs/lib/xlsx/xlsx.js:280-310` giải nén trọn vào RAM MỌI entry không phải thư mục (`entry.async('string'|'nodebuffer')`),
  kể cả `xl/styles.xml`, `docProps/*`, `xl/theme/*`, `xl/media/*`, tên bất kỳ; bỏ `/` đầu tên (`:284`) nên
  `/xl/worksheets/sheetN.xml` vẫn đọc như worksheet dù không khớp regex.
- Hậu quả: cùng loại DoS như H-1 vòng 1. Khai thác qua `importExcelAction` (`actions.ts:462-468`, admin/data-entry) và
  `previewDailyImportAction` → `readDailyWorkbook` (`daily-import.ts:124-128`). Không rate-limit.

**H-1b-2. Ngưỡng tính riêng từng entry, không cộng dồn.**
- `daily-import.ts` ~76: `let total = 0` nằm trong promise từng entry → mỗi entry 20MB, tổng không trần. JSDoc (~57) ghi
  "đo tổng dung lượng" — không khớp code.

**H-1b-3. Không giới hạn số entry.**
- `JSZip.loadAsync` (`:65`) không trần số entry; không kiểm entry dùng chung vùng dữ liệu.

**Cách vá (giữ trong `assertXlsxInflatedSize`):**
1. Đo MỌI entry không phải thư mục, không lọc theo tên (chuẩn hoá bỏ `/` đầu nếu còn kiểm theo tên ở đâu đó).
2. MỘT biến `total` cộng dồn toàn bộ entry; trần tổng ~20MB (cân nhắc 10MB vì exceljs phình bộ nhớ vài chục lần so với XML).
3. Chặn số entry (vd `Object.keys(zip.files).length > 200` → từ chối).
4. (Tuỳ chọn) tránh giải nén 2 lần: dùng `ExcelJS.stream.xlsx.WorkbookReader` có dừng sớm, hoặc tái dùng zip đã kiểm.
5. Test hồi quy: (a) nội dung lớn ở entry ngoài regex cũ, vd `xl/styles.xml`; (b) tên có `/` đầu; (c) nhiều entry mỗi cái
   dưới ngưỡng nhưng tổng vượt; (d) số entry vượt trần. Cả 4 bị từ chối nhanh, trước `wb.xlsx.load`.

**Cần xác minh:** sau `stream.pause()` (~86) worker giải nén JSZip có dừng thật không (thêm assert thời gian trong test (c));
chi phí `JSZip.loadAsync` theo số entry (trần ở bước 3 bao luôn).

### CSV path: ĐẠT (với giới hạn hiện tại)
- `next.config.mjs` không đặt `serverActions.bodySizeLimit` → body 1MB; CSV không nén; `readBoundedSheet` chặn sau đó.
- Comment `IMPORT_MAX_BYTES = 10MB` (`validation.ts:~157`) không phản ánh giới hạn thực 1MB; nếu nâng `bodySizeLimit` phải xem lại.

### Đường đọc Excel khác
- Chỉ 2 đường đọc: `actions.ts:463-468`, `daily-import.ts:126-128` — cả hai gọi `assertXlsxInflatedSize` (CSV bỏ qua).
- `app/api/export/route.ts:44`, `app/api/report/export/route.ts:17` chỉ ghi. Không còn code production import `xlsx`.

## Trạng thái L-1…L-7 (không chặn merge)
- L-1 (`fx-rates.ts:21,63`): còn nguyên.
- L-2: ĐÃ VÁ (`validation.ts:~282` `.min(1).max(DAILY_IMPORT_MAX_DAYS)`).
- L-3 (`app/api/cron/[job]/route.ts:25-31`): còn nguyên.
- L-4 (`src/lib/secret-box.ts`): còn nguyên.
- L-5 (`app/api/templates/daily-resources/route.ts:35`): còn nguyên.
- L-6 (migration xoá AUD/SAR): còn nguyên.
- L-7 (`xlsx` trong `dependencies`): còn nguyên; diff chỉ thêm `jszip ^3.10.2`.

## Phát hiện mới
- N-1 (thông tin, không chặn): `ExchangeRateEditor.tsx:~71` hiển thị `res.error` thô qua `t('dailyEntry.err.generic', { msg })`.
  Qua React nên không XSS, nhưng lỗi nội bộ (Prisma) có thể lộ ra UI admin. Vá: action trả mã lỗi cố định, UI map sang i18n.
- `previewDailyImportAction` trả `wb.error` (mã cố định) — ĐẠT.
- Không có SQL thô mới; RBAC action import không đổi.

## Kết luận
KHONG DAT. H-1a đóng. H-1b đóng một phần: bỏ sót entry exceljs vẫn giải nén (lọc theo tên, tên có `/` đầu), ngưỡng không
cộng dồn, không trần số entry. Vá 3 điểm ở `assertXlsxInflatedSize` + 4 test hồi quy là đủ chuyển DAT.
