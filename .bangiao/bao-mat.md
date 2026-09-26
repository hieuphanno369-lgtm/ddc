# P3C-B - Rà soát bảo mật

PHÁN QUYẾT BẢO MẬT: **ĐẠT** cho diff P3C-B (Bước 1-10, `git diff main...HEAD`).
Bước 11 thuộc tài khoản A, ngoài phạm vi.
Security-reviewer kiểm tĩnh và đọc payload thật trên dev server cổng 3001 bằng cookie viewer, admin và không cookie.

## Đã kiểm, ổn

1. **N-3 thẻ Top dự án trọng điểm** (`OverviewWidgets.tsx` `TopPriorityCard`): gọi `maskProjectSummaries(items, canViewFinance)` trước khi truyền cho client; `canViewFinance` mặc định false.
   Payload RSC `/vi/overview` vai viewer: 0 giá trị số cho `contractValue`/`eac`/`vac`; admin có số.
2. **Cache `loadTopPriority`**: cache giữ bản chưa che ở server, che theo từng request sau khi đọc cache nên không trộn quyền; khoá gồm tháng + bộ lọc; tag giống các loader khác.
3. **`readManpowerActualByMonth`** (`read-prisma.ts`): `Prisma.sql` tham số hoá, không nối chuỗi; mock lọc đúng `projectId`; hiện chỉ `check-read-parity` gọi.
4. **Chart** (`EquipmentPlanGantt`, `ManpowerMonthChart`, `WeeklyManpowerStackChart`): không có `dangerouslySetInnerHTML`/`innerHTML`; chữ do React escape; màu lấy từ bảng cố định.
5. **i18n**: chỉ placeholder `{n}`, `{date}` do code tạo; không có rich-text.
6. Không có secret, endpoint, upload hay export mới.

## Phát hiện

### S-1 (CAO, có sẵn trên `main`, không do P3C-B tạo ra): người chưa đăng nhập đọc được dữ liệu dự án

- Vị trí: `middleware.ts` (`if (!role) return intlResp;` cho qua khi không có token); `app/[locale]/(app)/layout.tsx` chỉ kiểm đăng nhập ở layout; page không tự kiểm.
- Nguyên nhân: Next.js render layout và page song song, `redirect()` ở layout không ngăn page stream dữ liệu các khối Suspense.
- Tái hiện (điều phối xác nhận lại 2026-09-26, không cookie, header `RSC: 1`): `/vi/overview` trả 200, 61.461 byte, 13 `masterCode`, 15 `projectName`; `/vi/projects/1` và `/vi/projects` cũng có `projectName`.
  Lộ: mã, tên dự án, khách hàng, nhóm, ưu tiên, trạng thái, khối lượng, % KH/TT, SPI/CPI. Số tiền vẫn null.
- Tác động: ai biết URL cũng lấy được danh mục dự án và khách hàng. **Chặn deploy.**
- Cách vá (dây chuyền riêng, test đỏ trước): (a) middleware: không có token và không phải trang public thì redirect `/{locale}/login`; (b) phòng thủ nhiều lớp: page trong `(app)` tự `requireUser()` trước Suspense; (c) e2e: request không cookie tới `/vi/overview`, `/vi/projects/1` không chứa `projectName`/`masterCode`.
- Không chặn merge P3C-B (Watchlist cũ lộ y như vậy).

### S-2 (THẤP): client component nhận thừa trường

- `TopPriorityList` chỉ dùng id, projectName, status, onTrack, pctActual, pctPlan nhưng nhận cả `SafeProjectSummary` (customerName, teamName, tonnage, spi, cpi... vẫn nằm trong payload). Không lộ tiền.
- Cách vá: `TopPriorityCard` map sang kiểu hẹp trước khi truyền.
- **ĐÃ SỬA** (chủ dự án chốt sửa trong P3C-B): `toTopPriorityItem` + kiểu `TopPriorityItem` ở `src/lib/top-priority.ts`; `TopPriorityCard` che tiền rồi cắt còn 6 trường. Payload RSC thật (admin) của thẻ chỉ còn id, projectName, status, onTrack, pctActual, pctPlan. Test cập nhật: `overview-finance-gate.test.ts`, `top-priority-mask.qa.test.ts`.
- **S-1:** chủ dự án chốt B vá ngay ở phase riêng P3D-B, merge ngay sau P3C-B.

### S-3 (THÔNG TIN, cho A ở Bước 11)

- `readManpowerActualByMonth` không kiểm quyền: khi nối vào trang Chi tiết phải kiểm `projectId` là số nguyên dương và trang tự kiểm đăng nhập (liên quan S-1).
