PHAN QUYET BAO MAT: DAT

# P4 - Đánh giá bảo mật (logic số liệu, lọc kỳ, mốc thời gian, nhập bù)

Nhánh `feature/p4-logic-bo-loc` @ `5d79495`, so với `main` @ `2c20a95` (`git diff 2c20a95..HEAD`).
Tài khoản C, DB `ddc_control_tower_c`.
Skill đã dùng: `security-review` (ddc-tower).
Không gọi `security-audit`, `api-security-testing` hay các skill Strix: phạm vi là rà soát white-box một nhánh, không phải pentest trên app đang chạy.
Không sửa code sản phẩm.

## Kết luận

ĐẠT.
Không có lỗ hổng mức cao hay trung bình.
Có 2 phát hiện mức thấp (S-1, S-2) và 2 ghi chú thông tin (S-3, S-4), không chặn merge; nên vá S-1 và S-2 trong một vòng nhỏ hoặc đưa vào nợ kỹ thuật.

## Cách kiểm

- Đọc `.bangiao/ke-hoach.md` (mục 0, 4, 5, nhóm F), `.bangiao/thay-doi.md` (đợt 1, 2, 3 và các vòng sửa), `.bangiao/ket-qua-test.md`.
- Đọc diff và code: `actions-backfill.ts`, `actions-entry.ts`, `actions.ts` (`saveMonthlyData`, `commitImportAction`), `daily-entry.ts`, `monthly-entry.ts`, `backfill.ts`, `prisma-repo-backfill.ts`, migration `20260929165146_p4_backfill_window`, `period.ts`, `overview-params.ts`, `cache.ts`, `detail-time.ts`, `read-prisma.ts`, trang Tổng quan, Chi tiết, Báo cáo, Nhập liệu, Hồ sơ dự án, `/api/export`, `/api/report/export`.
- Tìm mẫu nguy hiểm trong phần thêm của diff (`$queryRawUnsafe`, `$executeRawUnsafe`, `Prisma.raw`, `dangerouslySetInnerHTML`, `innerHTML`, `eval(`): không có.
- Chạy 13 file test liên quan với `DATABASE_URL` của DB `_c` (gồm real-db nhập bù và tester QA): 13 file, 179 test xanh, 0 đỏ.
- Kiểm DB `_c` sau khi chạy (MCP postgres chỉ đọc): 0 dự án `test-p4-`, 0 dòng `audit_log` của `test-p4-`, không còn khoảng nhập bù nào đang hiệu lực.
  Một dòng khoảng đã tắt còn lại là của e2e `35-nhap-bu` chạy trước đó bằng tài khoản admin e2e, không phải do lượt này.
- `middleware.ts`, `next.config.mjs`, `src/server/authz.ts`, `src/lib/require-user.ts`, `src/lib/session.ts`, `package.json`, `package-lock.json`: không đổi trong diff, nên middleware/CSP của B không bị hồi quy, không thêm thư viện.

## Phát hiện

### S-1 (thấp): khoá `unstable_cache` của Tổng quan vẫn có không gian giá trị rất lớn

- File: `src/server/cache.ts` dòng 36-99 (khoá `key(periodKey(period), filters)`), `src/lib/period.ts` dòng 29-39 (`parsePeriod` nhận mọi cặp ngày hợp lệ năm 2000-2999, kỳ tối đa 120 tháng), `src/lib/overview-params.ts` dòng 37-39 và 63-64 (`team`, `customer` nhận mọi số nguyên dương, không đối chiếu dims).
- Kế hoạch mục 4 ghi "khoá cache không phình"; giá trị rác bị chặn đúng, nhưng giá trị HỢP LỆ vẫn gần như vô hạn.
  Mỗi cặp `from`/`to` khác nhau (khoảng 10^9 tổ hợp), mỗi `to` ở tương lai (cùng kết quả vì mốc là `min(to, hôm nay)`), mỗi `team=N` hay `customer=N` đều sinh khoá mới cho cả 10 loader.
- Next 15 tự host ghi `unstable_cache` xuống `.next/cache` trên đĩa, trang `/overview` không có rate limit.
- Phần `team`/`customer` không chặn là có từ trước P4 (main dùng `Number(p(sp,'team'))`); P4 làm rộng thêm qua `from`/`to`.
- Cách khai thác: một tài khoản đăng nhập bất kỳ (kể cả viewer) chạy vòng lặp `GET /vi/overview?from=2020-01-01&to=2029-01-<n>` hoặc `?team=<n>` với n tăng dần.
  Mỗi request tính lại truy vấn kỳ (tới 120 tháng) và ghi thêm một mục cache, làm đầy đĩa và tăng tải DB.
  Không có cache poisoning chéo quyền: dữ liệu trong cache không phụ thuộc user, phần tiền bị che ở tầng render theo `canViewFinance`.
- Đề xuất vá:
  1. `parseDashboardFilters` nhận thêm danh sách id team/customer thật (như đã làm với `teamNames` cho `groupKey`), id lạ về `'all'`.
  2. Chỉ đi qua `unstable_cache` khi kỳ là kỳ mặc định hoặc kỳ trọn tháng (from là ngày 01, to là cuối tháng hoặc hôm nay); kỳ tuỳ ý thì chỉ dùng React `cache` trong request. Hoặc chuẩn hoá `to` sau hôm nay trong khoá khi không làm đổi kết quả.
  3. Cân nhắc đặt `cacheMaxMemorySize` hoặc cache handler có giới hạn dung lượng.

### S-2 (thấp): `/api/report/export` không có rate limit, nay nhận kỳ tới 120 tháng

- File: `app/api/report/export/route.ts` dòng 12-25.
- `/api/export` có `rateLimit('export:<ip>', 30, 60_000)`, còn `/api/report/export` thì không (thiếu từ trước P4).
  P4 cho truyền `from`/`to`, nên mỗi request có thể là kỳ 120 tháng, dựng workbook ExcelJS trong bộ nhớ.
- Kiểm quyền đúng: chỉ admin và bod; cột tiền che theo `canViewFinance`; tên file cố định nên không có header injection; ô chữ qua `safeCell`.
- Cách khai thác: tài khoản bod gọi song song nhiều lần `GET /api/report/export?from=2016-10-01&to=2026-09-30` để chiếm CPU và bộ nhớ.
- Đề xuất vá: thêm `rateLimit` theo `clientIpFrom(req.headers)` (ví dụ khoá `report-export:<ip>`, 30 lần mỗi 60 giây) như `/api/export`, trả 429 kèm `Retry-After`.

### S-3 (thông tin): nhật ký nhập bù khó truy theo dự án, nhãn nhập bù ghi ngoài transaction

- `src/server/repo/prisma-repo-backfill.ts` dòng 67 và 79: dòng `audit_log` bật/tắt dùng `recordId` là id khoảng, không chứa `projectId`.
  `readProjectAuditTrail` (`src/server/repo/prisma-repo-form.ts` dòng 288-301) không lấy bảng `project_backfill_window`, nên thẻ nhật ký ở Hồ sơ dự án không hiện lần bật/tắt của chính dự án đó (chỉ thấy ở nhật ký toàn hệ thống).
  Đề xuất: `recordId` dạng `<projectId>/<windowId>` và thêm `project_backfill_window` vào danh sách `prefixed`.
- `src/server/actions-entry.ts` dòng 153 và 261, `src/server/actions.ts` dòng 237 và 770: dòng `audit_log` nhãn "nhap bu" ghi sau khi số đã lưu, ngoài transaction lưu số.
  Nếu tiến trình lỗi giữa chừng thì số vẫn lưu mà thiếu nhãn (số cũ/mới vẫn có audit riêng; `activity_log` cũng ghi sau).
  Đề xuất: truyền cờ nhập bù vào repo để ghi nhãn trong cùng transaction, hoặc chấp nhận và ghi rõ trong tài liệu.

### S-4 (thông tin): khoảng hở giữa kiểm cửa sổ và ghi số

- `checkDailyPayload` (`src/server/actions-entry.ts` dòng 82-84) và `saveMonthlyData` (`src/server/actions.ts` dòng 109-110) đọc khoảng nhập bù rồi mới ghi, không khoá.
  Admin tắt khoảng đúng lúc PIC đang lưu thì lần lưu đó vẫn qua.
  Cửa sổ vài mili giây, PIC vẫn phải được gán dự án, có audit, tháng khoá sổ vẫn chặn; chấp nhận được, không cần vá.

## Các điểm đã kiểm và đạt

- Chỉ admin bật/tắt nhập bù: `enableBackfillAction` và `disableBackfillAction` gọi `requireRoleUser` với danh sách chỉ gồm admin, ở server, trước mọi việc khác.
  Thẻ `BackfillPanel` chỉ render khi `user.role === 'admin'` (Hồ sơ dự án dòng 81), danh sách khoảng (có ghi chú) chỉ đọc cho admin.
  Test `actions-backfill.test.ts` và `backfill-tester.qa.test.ts` phủ bod, viewer, data-entry, chưa đăng nhập: đều `Forbidden`.
- Validate đầu vào: `projectId`/`windowId` số nguyên dương (zod), ghi chú 5-500 ký tự sau trim, ngày qua `isValidIsoDate` (regex và round-trip), `from <= to <= hôm nay`, tối đa 24 tháng lịch, `expiresAt` bằng lúc bật cộng 30 ngày tính ở server, client không truyền được.
- IDOR: `saveDailyResourcesAction`, `previewDailyImportAction`, `commitDailyImportAction` gọi `requireWriteProject` trước khi đọc khoảng nhập bù; `saveMonthlyData` gọi `requireProject`; `commitImportAction` lọc `owned` trước luật tháng; khoảng nhập bù chỉ đọc theo đúng `projectId` đã qua kiểm quyền.
  Data-entry không được gán dự án B vẫn `Forbidden` dù B có khoảng nhập bù (có test ở lưu ngày, lưu tháng, Excel ngày, Excel tháng).
- Luật ngày: `isInWindow` vẫn chặn ngày sau `max` (hôm nay cộng 30) kể cả khi nằm trong khoảng; admin không đổi; `isBackfillOnly` chỉ gắn nhãn, không mở quyền.
- Luật tháng (Q9 = b): data-entry chỉ được tháng hiện tại, tháng trước, hoặc tháng giao khoảng đang hiệu lực; tháng tương lai bị chặn vì khoảng luôn kết thúc không sau hôm nay; `month` đã qua `yearMonth` của zod trước khi xét.
- Tháng khoá sổ vẫn chặn (`isMonthLocked` ở cả luồng ngày và tháng, trước khi ghi); nhập bù không vượt khoá sổ (Q10).
- Hết hạn và tắt: điều kiện "đang hiệu lực" (chưa tắt, và chưa có hạn hoặc hạn còn sau thời điểm hiện tại) tính ở server mỗi lần lưu; tắt dùng `updateMany` có điều kiện `disabledAt` rỗng nên không tắt hai lần.
- Race kiểm trùng: khoá `FOR UPDATE` dòng `dim_project` trong transaction tương tác trước khi kiểm trùng, đúng về lý thuyết với READ COMMITTED; tham số qua tagged template, không nối chuỗi.
- SQL injection: mọi `$queryRaw` mới trong `read-prisma.ts` (LATERAL, `unnest`, `readLastDailyDate`) và `prisma-repo-backfill.ts` dùng `Prisma.sql` tham số hoá; tên bảng trong `readLastDailyDate` chọn bằng nhánh cố định, không lấy từ input.
- Log injection và XSS: nội dung `activity_log` mới chỉ gồm id và ngày đã validate; ghi chú admin lưu ở `audit_log.note` và hiện bằng JSX, không có `dangerouslySetInnerHTML`; không có route xuất audit ra Excel/CSV nên không có formula injection từ ghi chú.
- Kỳ báo cáo: `parsePeriod`/`parsePeriodChecked` không ném lỗi với rác, `?month=all`, ngày 30/02, năm 9999, chuỗi dài; kỳ bị kẹp tối đa 120 tháng; `parseDashboardFilters` chỉ nhận enum, `groupKey` tối đa 100 ký tự và phải thuộc tập nhóm thật.
- Trang Chi tiết: `requireUser`, kiểm id bằng regex số nguyên dương, `requireProjectRead` trước `getProject`, `getFacts` và mọi truy vấn mốc/ngày; `month`, `day`, `from`, `to` qua `resolveDetailTime` (validate và kẹp vào kỳ).
- Che tiền: Tổng quan chỉ render thẻ HĐ chưa khởi công, doanh thu trong kỳ, S-curve, công nợ quá hạn khi `canViewFinance`; `GroupBar` và danh sách qua `maskGroupRows`/`maskProjectSummaries`.
  Chi tiết không đọc `getFinancial`, không dựng dữ liệu S-curve và What-if khi không có quyền; Báo cáo và hai route export bỏ cột/dòng tiền theo `canViewFinance`.
  Test `overview-finance-gate`, `export-finance-gate`, `projects-detail-finance-gate`, `report-export-route` xanh.
- Route export: kỳ rác rơi về mặc định (không 500), `Content-Disposition` là tên cố định, ô chữ qua `safeCell`, dòng "Kỳ báo cáo" chỉ chứa ngày đã validate.
- Migration: chỉ tạo bảng mới `project_backfill_window` có FK tới `dim_project` và index, không đụng dữ liệu cũ.
- `DateField`, `date-input.ts`, `HelpTip`: chỉ là giao diện; mọi ngày gửi lên server đều validate lại bằng zod hoặc `isValidIsoDate`; `HelpTip` hiện chuỗi i18n bằng JSX.

## Việc chưa làm

- Không chạy pentest trên dev server (không khởi động app ở lượt này); S-1 và S-2 kết luận từ đọc code, chưa đo dung lượng cache thật.
- Không chạy `npm audit` vì diff không đổi `package.json`/`package-lock.json`.
