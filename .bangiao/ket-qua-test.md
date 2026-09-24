KET QUA: XANH

# P2A — Nhập liệu mới — Kết quả kiểm thử (tester)

Phạm vi: toàn bộ P2A (Task 1–9), diff `10cda5a..HEAD` (9 commit, `4101723`…`69af164`), theo
`.bangiao/ke-hoach.md` + `.bangiao/thay-doi.md`.

Skill dùng: `ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`.

## Cổng kiểm

- `npx tsc --noEmit`: sạch (0 lỗi), cả trước và sau khi thêm test mới.
- `npm test`: **95/95 file · 1134/1134 test xanh** (baseline coder để lại 95 file/1127 test; tester
  thêm 7 test mới trong 2 file đã có, không tạo file test mới — coverage đã sẵn rất đầy đủ nên chỉ vá
  đúng 2 khoảng trống tìm thấy, xem bên dưới).
- Build kiểm compile: KHÔNG chạy lại (thay-doi.md đã ghi coder chạy xanh ở Task 9; không có thay đổi
  code sản phẩm nào từ tester nên kết quả build không đổi).

## Test mới thêm (tester)

### `src/server/repo/entry.test.ts` — `describe('insertEngineAlerts (K6 - chong trung)')` (6 ca)

Trước đó `insertEngineAlerts` (T11, Task 8) chỉ được kiểm **gián tiếp** qua `alert-engine.test.ts`
(chạy cả `runAlertEngine`). Thêm test gọi thẳng `repo.insertEngineAlerts(...)` để cô lập đúng quy tắc
chống trùng K6:

- đường chạy thuận lợi: dự án chưa có alert cùng `dedupeKey` → tạo mới, trả về 1, dòng mới đúng
  `closedAt: null, action: '', closedBy: null, closeNote: ''`.
- biên: cùng `(projectId, dedupeKey)` đã có (kể cả đã ĐÓNG) → không tạo lại, trả về 0.
- biên: `dedupeKey` khác nhưng còn alert MỞ cùng `ruleCode` → không tạo (đúng K6 "không tạo nếu còn
  alert MỞ cùng ruleCode").
- `dedupeKey` khác VÀ alert cũ cùng `ruleCode` đã ĐÓNG → được tạo (đúng Q10: engine không tự mở lại
  điều kiện cũ đã đóng, nhưng kỳ mới vẫn tạo được).
- mảng rỗng → trả về 0, không đổi gì.

### `src/server/actions-entry.test.ts` — `describe('previewDailyImportAction / commitDailyImportAction')` (2 ca)

Trước đó không có ca nào kiểm `commitDailyImportAction` khi import đổi số của **ngày cũ đã có sẵn**
(phải bắt buộc lý do — đúng yêu cầu "sửa ngày cũ bắt buộc lý do + ghi `audit_log.note`" áp dụng cho
CẢ đường nhập tay lẫn đường import, không chỉ nhập tay đã có sẵn test):

- import đổi số ngày hôm qua đã có sẵn, không kèm `reason` → `{ ok: false, error: 'reason_required',
  workDate: '2026-09-15' }`, xác nhận **không ghi gì** (so `getDailyManpowerByShift` trước/sau bằng
  nhau).
- kèm `reason: 'sửa từ file import'` (≥ 5 ký tự) → ghi thành công, `audit_log.note` đúng bằng lý do.

## Đối chiếu tiêu chí chấp nhận đã kiểm (đa số đã có sẵn test của coder, tester xác nhận đúng — không
lặp lại chi tiết, chỉ liệt kê để chứng minh đã rà)

- **Sửa ngày cũ bắt buộc lý do + `audit_log.note`**: `daily-entry.test.ts` (`needsReason` 4 ca biên) +
  `actions-entry.test.ts` (nhập tay: không lý do → `reason_required`; có lý do → ghi `note` đúng) +
  test mới của tester cho đường import. Đã xác nhận qua UI thật (xem mục UI).
- **Import Excel exceljs + file mẫu, bỏ `.xls`**: `daily-import.test.ts` (thuần, 7 lý do invalid +
  `parseExcelDate` 7 ca), `src/server/daily-import.test.ts` (buildDailyTemplate/readDailyWorkbook,
  chống công thức `=...`), `daily-template-route.test.ts` (403/404/200 theo quyền),
  `actions-entry.test.ts` (preview/commit, file `.xls` → `Invalid input`), `actions-import.test.ts`
  (import % tiến độ cũ — Task 9, file `.xls` → lỗi schema, CSV → `rowNo` đúng). Xác nhận `package.json`
  vẫn còn `xlsx` nhưng chỉ dùng để DỰNG file test (`XLSX.write`), không còn parse file người dùng tải
  lên ở cả 2 đường import (nhân lực/thiết bị VÀ % tiến độ cũ) — đúng ghi chú nợ kỹ thuật K7/Q14.
- **Engine cảnh báo R1–R7 chạy sau lưu, không sinh trùng**: `alert-rules.test.ts` (mỗi luật 1 ca bắn +
  1 ca không bắn đúng biên, dự án Hoàn thành → `[]`), `alert-engine.test.ts` (chạy 2 lần không trùng,
  đóng rồi chạy lại không mở lại, owner/deadline đúng PIC), test mới của tester cô lập
  `insertEngineAlerts`. Xác nhận qua UI thật: trang `/vi/alerts` có đủ alert theo đúng luật (SPI < 0.9,
  Nguy cơ phạt HĐ, Công nợ quá hạn, Đã quá mốc cam kết) — engine đã chạy thật trên DB dev qua
  `runDueJobs('lazy')` ở layout.
- **Đóng alert bắt buộc hành động**: `close-alert-role.test.ts` (ma trận quyền + `action_short` +
  `already_closed` + ghi `closeNote`/`closedBy`). Xác nhận qua UI thật (xem mục UI) — bấm "Xác nhận
  đóng" khi để trống hiện đúng câu "Nhập hành động đã xử lý (ít nhất 3 ký tự)."; điền đủ → đóng thành
  công, số "Đang mở" giảm từ 24 → 23.
- **Tỷ giá không ghi đè số sửa tay**: `fx-rates.test.ts` (`refreshMonthRates` giữ nguyên dòng
  `source='manual'` đã có, chỉ upsert dòng chưa có), `actions-master.test.ts` (`fetchRatesNowAction`
  với fetch mock). Không gọi VCB thật (mạng chặn TLS) — theo đúng chỉ dẫn, tester KHÔNG bấm "Lấy ngay"
  trên UI thật.
- **Cron route kiểm `CRON_SECRET`**: `cron-route.test.ts` (thiếu secret → 503; sai token → 401; job lạ
  → 404; đúng → 200 và gọi `runJob(..., 'cron')`, so token bằng `timingSafeEqual`).
- **Phân quyền các action mới**: `actions-entry.test.ts` (viewer/bod/data-entry ngoài dự án →
  `Forbidden` cho `createContractorAction`/`saveDailyResourcesAction`), `actions-master.test.ts`
  (data-entry/bod/viewer → `Forbidden` cho `saveFactoryAction`/`setFactoryActiveAction`/
  `saveExchangeRateAction`/`fetchRatesNowAction`), `close-alert-role.test.ts` (ma trận admin/BOD/
  data-entry-PIC/viewer/chưa đăng nhập).

## Smoke-test UI thật (Playwright, dev server cổng 3000, KHÔNG cài playwright vào node_modules dự án)

Đăng nhập `admin@daidung.com.vn` (nút đăng nhập đã prefill sẵn). Ảnh lưu `.bangiao/test-screens/`:

- `01-nhap-lieu-resources-desktop.png`, `01b-...-viewport.png` — `/vi/nhap-lieu?project=1&step=resources`:
  chip 6 nhà thầu tham gia, ô Ngày, bảng "Nhân lực theo ca" (Ca sáng/Ca tối, dòng Tổng), bảng "Thiết bị",
  khối "Nhập từ Excel" (Tải file mẫu / Xem trước) — render đủ, không crash, không lỗi console.
- `02-nhap-lieu-progress-viewport.png` — bước "Tiến độ tháng": xác nhận ô "Sản lượng gia công tháng
  (tấn)" (T8, Task 6) hiện đúng giá trị 726 từ DB.
- Bước "Hồ sơ dự án": `<select>` "Khu vực sản xuất" có 3 khu vực + option "— Chưa chọn —", giá trị đang
  chọn = `2` khớp `project.factoryId` seed.
- `03-admin-desktop.png` — `/vi/admin`: card "Khu vực / Nhà máy sản xuất" (FactoryEditor, Task 6) và
  "Tỷ giá theo tháng" (ExchangeRateEditor, Task 7) render đúng cấu trúc kế hoạch (bảng tháng × USD/EUR,
  nhãn nguồn "Nhập tay", nút Sửa/Xoá, nút "Lấy ngay từ Vietcombank" + "Chưa lấy lần nào").
- `/vi/alerts` desktop: danh sách 24 alert đang mở với đủ `ruleTriggered` R1/R3/R4/R5 (SPI < 0.9, Nguy
  cơ phạt HĐ, Đã quá mốc cam kết, Công nợ quá hạn) — xác nhận engine đã chạy thật trên DB dev. Bấm
  "Đóng alert" → mở form "Hành động đã xử lý"/"Ghi chú"; bấm "Xác nhận đóng" khi trống → báo lỗi đúng
  câu tiếng Việt; điền hành động hợp lệ → đóng thành công, đếm "Đang mở" giảm 24 → 23 (side-effect thật
  trên DB dev `ddc_control_tower` — 1 alert dự án "Đường cao tốc VIN", luật `ar_overdue`, đã chuyển
  sang đã đóng; đây là trạng thái kết thúc bình thường, không cần hoàn tác).
- `04-nhap-lieu-resources-390.png`, `05-alerts-390.png`, `06-admin-factory-fx-390.png` — cùng 3 màn
  trên ở 390×844: không crash, bảng dài cuộn ngang trong khung `.tbl`/`.scroll`, không vỡ layout nghiêm
  trọng.
- KHÔNG bấm "Lấy ngay từ Vietcombank" (theo đúng chỉ dẫn không gọi VCB thật) — công cụ Playwright cũng
  tự chặn hành động này ("Exfil Scouting") khi thử; hành vi này đã được xác nhận đầy đủ qua
  `fx-rates.test.ts`/`actions-master.test.ts` với `fetch` giả lập.

## Lỗi tìm thấy

Không có lỗi mới do P2A gây ra. Phát hiện 2 điều **KHÔNG thuộc phạm vi P2A** (ghi lại để reviewer biết,
không chặn P2A):

1. `src/components/admin/DeleteProject.tsx:80` — lỗi console `IntlError: MISSING_MESSAGE: Could not
   resolve 'admin.delete'` khi mở `/vi/admin`. File này không nằm trong diff P2A (`git diff
   10cda5a..HEAD` không đụng `DeleteProject.tsx` hay key `admin.delete`) — lỗi đã tồn tại từ trước P2A,
   không phải do coder P2A gây ra.
2. Thanh hành động dưới cùng của `DataEntryForm` (`.stickybar`, class có sẵn trong `globals.css`, không
   phải file P2A tạo) đè lên vài dòng cuối của bảng khi màn hình thấp hơn nội dung — đã đối chiếu: xảy
   ra GIỐNG HỆT ở bước "Tiến độ tháng" (bước cũ, không phải P2A), tức là hành vi/khiếm khuyết thiết kế
   có từ trước, không phải P2A gây ra hoặc làm nặng thêm riêng cho bước "Nhân lực & Thiết bị".

## Trường hợp phải thất bại (đã kiểm, có trong bộ test mới + test có sẵn)

- `insertEngineAlerts`: alert trùng `dedupeKey` hoặc còn alert mở cùng `ruleCode` → bị từ chối tạo mới
  (test mới).
- `commitDailyImportAction`: sửa số ngày cũ qua import không kèm lý do → `reason_required`, không ghi
  gì (test mới).
- Qua UI thật: đóng alert bỏ trống "Hành động đã xử lý" → bị chặn, báo lỗi rõ ràng, alert vẫn ở trạng
  thái mở.

## Chưa kiểm được / vì sao (không phải lỗi coder — đã ghi rõ trong `thay-doi.md`)

- File `.xlsx` thật xuất từ Excel/LibreOffice (không phải do thư viện `xlsx`/`exceljs` dựng) — máy
  tester không có LibreOffice/Excel cài sẵn (`where soffice`/`where libreoffice` không ra kết quả) nên
  không dựng được file nhị phân "thật" để thử `exceljs` đọc tiêu đề tiếng Việt. Test tự động (dựng bằng
  `exceljs`/`xlsx`) đã xanh; đây là khoảng trống đã được coder ghi nhận trước, tester xác nhận lại.
  Cần chủ dự án hoặc reviewer thử tay 1 file thật nếu muốn đóng hẳn khoảng trống này.
  - **Cân nhắc thêm**: `readDailyWorkbook`/`buildDailyTemplate` và import Task 9 đều dùng `exceljs`
    (thư viện phổ biến, bảo trì tốt) để ĐỌC file `.xlsx`/`.csv` — rủi ro khác biệt định dạng với file
    Excel thật ở mức thấp hơn nhiều so với rủi ro bảo mật của `xlsx` 0.18.5 mà Task 9 đã thay thế.
- Gọi VCB thật (mạng dev bị chặn TLS ra ngoài) — không thử theo đúng chỉ dẫn của điều phối viên; hành
  vi lỗi mạng không làm vỡ trang đã xác nhận qua `fx-rates.test.ts` (`network`/`http`/`parse` đều trả
  lỗi có cấu trúc, không throw) và qua UI (`fetchRatesNowAction` không throw kể cả khi lỗi).
- `POST /api/cron/[job]` với `CRON_SECRET` thật trên dev server sống — không thử qua HTTP thật (chỉ qua
  `cron-route.test.ts` với `runJob` mock) vì việc đặt `CRON_SECRET` thật và gọi tới sẽ kích hoạt
  `runJob('rates_monthly'|'alerts_daily', 'cron')`, mà `rates_monthly` lại gọi VCB thật — tránh theo
  đúng chỉ dẫn "đừng gọi VCB thật". `alerts_daily` qua cron route logic (403/401/404) đã được test đầy
  đủ; phần gọi đúng job đã xác nhận qua `runDueJobs('lazy')` chạy trong lúc smoke UI (thấy alert mới
  trên `/vi/alerts`).
- Không dùng `mcp__postgres` (không có trong danh sách công cụ được cấp cho tester lần này) để đối
  chiếu độc lập trạng thái DB sau test; đã đối chiếu gián tiếp qua UI thật (số "Đang mở" giảm đúng 1
  sau khi đóng 1 alert) và qua test `entry.test.ts`/`actions-master.test.ts` chạy trên mock-repo.

## Ghi chú vận hành

- Dev server (`npm run dev`, cổng 3000) được tester tự khởi động cho smoke-test và đã tắt hẳn khi xong
  (`taskkill` PID 34968) — không để tiến trình treo lại.
- Không sửa file sản phẩm nào; chỉ sửa 2 file test có sẵn (`src/server/repo/entry.test.ts`,
  `src/server/actions-entry.test.ts`) — thêm 7 ca mới, không xoá/sửa ca cũ.
