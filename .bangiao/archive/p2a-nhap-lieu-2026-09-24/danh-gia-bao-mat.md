KET LUAN BAO MAT: DAT

# Đánh giá bảo mật P2A — VÒNG 3 (`feature/p2a-nhap-lieu`, `git diff 4872877..HEAD`, HEAD `b3d1445`)

> Điều phối viên lưu hộ từ báo cáo security-reviewer (vai chỉ đọc). Vòng 1 xem git `e267569`, vòng 2 (KHONG DAT) xem `fd3557e`.
> Skill: `ddc-tower:security-review`, `ddc-tower:security-audit` (guidance, rà có trọng tâm). Chỉ đọc source + `node_modules`,
> không chạy PoC; kết quả chạy lấy từ `.bangiao/ket-qua-test.md` (vòng 3: 1177/1177; red-green 6/9 test độc lập rớt với code cũ).

## 1. H-1b (chống zip bomb): ĐÃ ĐÓNG
Code: `src/server/daily-import.ts:67-105` (`assertXlsxInflatedSize`, `60aedc1`).

- **H-1b-1 lọc theo tên — ĐÓNG:** `:75` `Object.values(zip.files).filter((f) => !f.dir)`, khớp đúng tập exceljs giải nén
  (`exceljs/lib/xlsx/xlsx.js:279-283`). Tên `/` đầu không còn là khe (hàm đo không xét tên).
- **H-1b-2 không cộng dồn — ĐÓNG:** `:78` `let total = 0` ngoài vòng `for`; `:91-92` cộng mọi chunk, so `limitBytes` (20MB). JSDoc khớp.
- **H-1b-3 không trần số entry — ĐÓNG:** `:76` `entries.length > XLSX_MAX_ENTRIES` (200) → `false`, trước khi inflate.

### 1.1 `stream.pause()` dừng thật: CÓ
`StreamHelper.pause` (`stream/StreamHelper.js:188`) → `GenericWorker.pause` (`:168-178`) lan về `DataWorker`; `_tickAndRepeat`/`_tick`
kiểm `isPaused` trước mỗi khối 16KB. Vượt tối đa sau pause ≈ inflate 1 khối 16KB (~16MB lý thuyết), pako đẩy chunk 16KB không tích
luỹ, handler bỏ chunk sau `settled` → GC thu được. Worker pause không resume, GC khi hàm return. Đo thực ~600ms (3 × 15MB).

### 1.2 Tập entry lúc đo = tập exceljs giải nén: KHỚP
Chỉ 1 bản jszip 3.10.2; cả hai `JSZip.loadAsync(buf)` cùng buffer, options mặc định → `zip.files` tất định giống nhau.
`Object.create(null)` nên `__proto__` vô hại. Entry dir / `uncompressedSize === 0` → data `""` ở cả hai lần. Đếm byte stream thật,
không tin header; header lệch → lỗi → `finish(false)`.

### 1.3 Chi phí `JSZip.loadAsync` mục lục lớn (body ≤ 1MB): CHẤP NHẬN
≤ ~22 nghìn bản ghi CD (46 byte/bản), parse O(n), `slice` không copy, `createFolders:false` → không khuếch đại. Trần 200 chặn trước inflate.

### 1.4 Entry trùng vùng dữ liệu: KHÔNG VƯỢT `total`
Mỗi entry inflate riêng và cộng vào `total` → tổng vẫn ≤ 20MB (+ phần vượt 1 khối).

### 1.5 Đường gọi
`src/server/actions.ts:462` (`importExcelAction`, `requireRole(['admin','data-entry'])` `:449`) và `src/server/daily-import.ts:128`
(`readDailyWorkbook`) đều gọi `assertXlsxInflatedSize` trước `wb.xlsx.load`. Test phủ: `xl/styles.xml`, `docProps/core.xml`,
`xl/media/image1.png`, `[Content_Types].xml`, `abc/def.bin`, 2 biến thể tên `/` đầu, cộng dồn, biên 200/201, file thật không chặn nhầm.

## 2. Thay đổi i18n (`ff8bafe`): KHÔNG MỞ LỖ
14 chuỗi tĩnh cuối object `activity`, không placeholder/HTML/ICU. `ActivityViewer.tsx:56` render qua React trong `<Badge>`, không
`dangerouslySetInnerHTML`; `action` là literal server ghi. `messages.test.ts` chỉ chạy lúc test.

## 3. Rủi ro còn lại (không chặn merge)

### N-2 (MỚI, trung-thấp, cần xác minh): khuếch đại bộ nhớ exceljs trong trần 20MB
- `daily-import.ts:67` (`limitBytes = 20MB`) + `readBoundedSheet` (`:43-57`) chỉ chạy SAU `wb.xlsx.load`.
- File ≤ 1MB, sheet XML ~20MB (~1 triệu ô) → exceljs dựng toàn bộ Row/Cell trước khi chặn `rowCount > 5000` — ước vài trăm MB heap
  mỗi request (chưa đo); không rate-limit, vài request đồng thời có thể chạm trần heap. Cần vai admin/data-entry; khuếch đại có trần (~20× body).
- Vá: hạ `limitBytes` mặc định ~5MB (đo file mẫu lớn nhất 5000 dòng × ≤64 cột trước khi chốt); hoặc trần riêng cho `xl/worksheets/*`
  và `sharedStrings`; lâu dài dùng `ExcelJS.stream.xlsx.WorkbookReader` dừng ở 5001 dòng.

### N-1 (thông tin, còn nguyên)
`ExchangeRateEditor.tsx:~71` hiển thị `res.error` qua `t('dailyEntry.err.generic', { msg })` — không XSS; reviewer v2 xác nhận
`res.error` là union mã cố định nên thực tế vô hại.

### L-1…L-7

| Mục | Vị trí | Trạng thái |
|---|---|---|
| L-1 | `src/server/fx-rates.ts:21,63` | còn nguyên |
| L-2 | `validation.ts:~282` | ĐÃ VÁ (vòng 2) |
| L-3 | `app/api/cron/[job]/route.ts:25-31` | còn nguyên |
| L-4 | `src/lib/secret-box.ts` | còn nguyên |
| L-5 | `app/api/templates/daily-resources/route.ts:35` | còn nguyên |
| L-6 | migration xoá AUD/SAR | còn nguyên |
| L-7 | `xlsx` trong `dependencies` | còn nguyên |

Ghi chú: `IMPORT_MAX_BYTES = 10MB` (`validation.ts:~157`) không phản ánh trần thực 1MB; nếu nâng `serverActions.bodySizeLimit` phải
xem lại N-2 và trần 20MB.

## 4. Kết luận
**DAT (vòng 3).** H-1a đóng từ vòng 2; H-1b đóng đủ 3 điểm; `pause()` dừng thật; tập entry đo = tập exceljs giải nén; overlapping
không vượt `total`; i18n an toàn. Còn N-2 (nên hạ trần ~5MB ở phase sau), N-1, L-1, L-3…L-7 — không chặn merge.
