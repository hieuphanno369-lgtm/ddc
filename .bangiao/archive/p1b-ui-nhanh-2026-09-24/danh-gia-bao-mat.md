PHAN QUYET BAO MAT: DAT

# Đánh giá bảo mật — P1B (nhánh feature/p1b-ui-nhanh, `git diff main...HEAD`, 10 commit)

> Ghi chú điều phối: security-reviewer không có công cụ ghi file; nội dung dưới đây do phiên ship lưu nguyên văn từ báo cáo của security-reviewer.

Skill đã dùng: `ddc-tower:security-review`. Rà theo hướng `security-audit` bằng tay (diff nhỏ, chỉ UI và đọc dữ liệu). Công cụ: git diff, `npx tsc --noEmit`, `npm audit --omit=dev`, `mcp__postgres` (read-only; lưu ý MCP đang trỏ DB `ddc_control_tower` của tài khoản A, chỉ chạy 1 lệnh SELECT đếm dòng).

## Kết luận
Không có lỗ hổng nghiêm trọng, cao hay trung bình nào do P1B gây ra. **Không chặn merge.** Riêng TB-1 (lỗi kiểu có thể làm hỏng `next build`) không phải lỗ hổng bảo mật, nhưng reviewer nên xem trước khi merge.

## Kiểm theo trọng tâm

### 1. Audit log — `src/server/audit-log-page.ts`, `app/[locale]/(app)/audit/page.tsx`, `app/[locale]/(app)/admin/page.tsx`, `src/components/admin/AuditMiniTable.tsx`
- **Phân quyền:** cả `/audit` (dòng 17-20) và `/admin` (dòng 19-22) vẫn giữ kiểm tra phía server `if (!user) redirect login; if (user.role !== 'admin') redirect home` như cũ. Chưa đăng nhập hoặc không phải admin thì không đọc được audit_log. ĐẠT.
- **Tham số URL:** `parseLogRange` (`src/lib/log-paging.ts:6-8`) chỉ nhận đúng 'all', mọi giá trị khác thành '14d'. `parsePage` (dòng 11-15): không phải chuỗi, không phải số nguyên hoặc nhỏ hơn 1 đều thành 1. `page=1e308` vẫn là số nguyên, nhưng `getAuditLogPage` (dòng 29-31) kẹp `page` vào [1, totalPages] **trước** khi tính `skip`, nên `skip` luôn nhỏ hơn hoặc bằng `total`. Không có skip khổng lồ, không có DoS. Truy vấn qua Prisma có tham số, không có SQL injection. ĐẠT.
- **Dữ liệu nhạy cảm trong giá trị cũ/mới:** mọi chỗ gọi `logAudit` (`prisma-repo.ts:792-980`) chỉ ghi dữ liệu nghiệp vụ (fact, tài chính, dim_project, mốc, alert, SAP). Không ghi mật khẩu hay token. `/audit` hiện giá trị cũ/mới như trước P1B, và chỉ admin thấy. `/admin` truyền cả `oldValue/newValue` vào `AuditMiniTable`, nhưng đó là server component (không có 'use client') nên không bị gửi xuống trình duyệt, và bảng không hiện 2 cột này. ĐẠT.

### 2. Task 8 — backlog trong `/report` và Excel (`src/server/report.ts`, `app/api/report/export/route.ts`)
- Route export (dòng 10-13) và trang `/report` (dòng 26-29) vẫn chỉ cho `admin`/`bod`. Hiện nay admin/bod luôn có `canViewFinance = true` (`actions.ts:311`: `role !== 'viewer'`), nên không lộ thêm cho ai.
- Backlog đổi từ `fact_financial.backlog` sang giá trị hợp đồng của dự án đang "Chuẩn bị". Đây vẫn là số tài chính, và vẫn chỉ admin/bod xem được. `getReportData` trước đây đã báo cáo toàn danh mục, không lọc team, nên không đổi phạm vi.
- `/overview`: `BacklogOverdueCard` vẫn nằm trong khối `canViewFinance &&` (`overview/page.tsx:110-117`). Thẻ KPI backlog trong `KpiGrid` vẫn có điều kiện `canViewFinance`. `getOverdueScorecard` lọc theo `getScopedProjectIds(filters)`, giữ lọc team như cũ. ĐẠT.

### 3. Task 1/2/3 — chi tiết dự án (`app/[locale]/(app)/projects/[id]/page.tsx`, `src/server/project-queries.ts`)
- `requireProjectRead(user, id)` (dòng 68) vẫn chạy trước mọi truy vấn. Dữ liệu mới (số nhà thầu, trọng số giai đoạn, tấn KH/TT) được lấy sau bước kiểm này. ĐẠT.
- P1B bỏ 2 thẻ EAC/VAC, vốn hiện cho mọi người xem dự án mà không che theo `canViewFinance`, nên giảm dữ liệu tài chính bị lộ. Tích cực.

### 4. SearchBox — `src/lib/search-box-nav.ts`, `src/components/layout/AppShell.tsx:172-176`
- Chỉ gọi `router.replace('?' + qs)` với querystring tương đối, dựng bằng `URLSearchParams` (tự mã hoá). Không đổi đường dẫn hay host, không có open redirect. Chèn `&x=...` vào ô tìm kiếm chỉ thành giá trị đã mã hoá của `search`. ĐẠT.

### 5. T7 — Combobox, ProjectSwitcher, SettingsMenu, HelpTip, `src/lib/list-nav.ts`
- Không có `dangerouslySetInnerHTML` mới (chỉ có sẵn ở `app/[locale]/layout.tsx:32`, P1B không đụng). Nhãn và nội dung render qua JSX nên được escape.
- Id sinh bằng `useId()` của React, không lấy từ input người dùng.
- ProjectSwitcher điều hướng `router.push('/projects/${id}')` với id số, và trang đích vẫn kiểm `requireProjectRead`. SettingsMenu dùng danh sách href cố định. ĐẠT.

## Danh sách phát hiện

### NGHIÊM TRỌNG / CAO
Không có.

### TRUNG BÌNH
**TB-1 (không phải bảo mật, liên quan cổng build) — `app/[locale]/(app)/audit/page.tsx:10-15`**
`npx tsc --noEmit` in lỗi `.next/types/app/[locale]/(app)/audit/page.ts(28,29): TS2344 ... Type 'undefined' is not assignable to type 'PageProps'`, do tham số có `= {}` mặc định ngoài cùng. Lệnh `tsc` vẫn trả mã 0 (lỗi nằm trong file tự sinh), nhưng `next build` chạy kiểm kiểu này và có thể hỏng.
Đề xuất: đổi thành `export default async function AuditPage({ searchParams = {} }: { searchParams?: Record<...> })`, bỏ `= {}` ngoài cùng. Nếu test render gọi `AuditPage()` không có đối số thì sửa test truyền `{}`. Giao reviewer và coder quyết.

### THẤP
**L-1 — `src/server/audit-log-page.ts:26-37`: `count()` và `findMany` với `range=all` quét cả bảng audit_log (chưa có index `changed_at`).** Chỉ admin gọi được, nên nguy cơ tự gây DoS thấp. Kế hoạch đã ghi rõ việc thêm index để sang P2B. Đề xuất: thêm index `audit_log(changed_at desc, id desc)` ở P2B.

**L-2 — `app/[locale]/(app)/admin/page.tsx:28-30`: đọc toàn bộ `activity_log` rồi mới lọc 14 ngày trong bộ nhớ.** Vì xoá lười chỉ chạy khi có ghi mới, bảng có thể phình khi lâu không ai ghi. Chỉ admin. Đề xuất: lọc `createdAt >= since` ngay trong truy vấn khi được sửa repo (file nóng).

**L-3 — `src/server/audit-log-page.ts:1`: gọi thẳng `prisma`, bỏ qua lớp `repo`, nên chế độ mock/không có DB cũng chạm Prisma.** Không phải lỗ hổng, nhưng lệch với kiểm soát truy cập dữ liệu tập trung ở repo. Đề xuất: khi mở khoá `prisma-repo.ts`, chuyển vào `repo.getAuditLogPage`.

### THÔNG TIN (việc của tài khoản A/P1A — P1B không làm tệ hơn)
- `session.user.canViewFinance = token.canViewFinance ?? true` (`src/lib/auth.ts:142`) và `user?.canViewFinance ?? true` (`projects/[id]/page.tsx:64`): giữ nguyên, không đổi trong P1B.
- `/api/report/export` hiện đã có kiểm tra admin/bod (route.ts:10-13). P1B chỉ đổi nguồn số backlog.
- `npm audit --omit=dev`: 11 lỗ hổng (2 critical, 5 high, 3 moderate, 1 low). P1B không đổi `package.json`/lockfile, nên đây là tồn tại từ trước, cần một đợt nâng cấp phụ thuộc riêng.
- `projects/[id]/page.tsx:80`: `(await repo.getAuditLog())[0]` vẫn đọc cả bảng audit chỉ để lấy thời điểm mới nhất (tồn tại từ trước, về hiệu năng).

## Kết luận merge
**Không chặn merge về mặt bảo mật.** Khuyến nghị reviewer xử lý hoặc chấp nhận TB-1 (kiểm kiểu của `next build`) trước khi merge vào `main`.

---

## Vòng 2 (commit 1c54a93)

PHAN QUYET BAO MAT: DAT

Skill đã dùng: `ddc-tower:security-review`. Phạm vi: `git show 1c54a93` và `git diff 9fdcd2b..HEAD` (chỉ có commit này). (Phiên ship lưu nguyên văn — security-reviewer không có công cụ ghi file.)

**Thay đổi:** `app/[locale]/(app)/audit/page.tsx` dòng 15 đổi từ `} = {}) {` thành `}) {`. Chỉ bỏ giá trị mặc định ở lớp ngoài cùng của tham số, vẫn giữ `searchParams = {}` trong destructuring. Hai file test chỉ đổi cách gọi thành `() => AuditPage({})`.

**Kết quả rà:**
- **Guard admin của /audit còn nguyên.** Vẫn gọi `getCurrentUser()` phía server; chưa đăng nhập → `redirect(/${locale}/login)`; `role !== 'admin'` → `redirect` về `homeForRole`. Cả hai chạy trước khi truy vấn dữ liệu, commit không đụng tới.
- **Parse `page`/`range` không đổi.** `parseLogRange` chỉ nhận `'all'`, còn lại thành `'14d'`. `parsePage` chỉ nhận số nguyên >= 1; rác, mảng, số âm về 1. `src/lib/log-paging.ts` không thay đổi.
- **Không có đường fail-open mới.** Next.js luôn truyền props có `searchParams`; gọi trực tiếp thiếu `searchParams` vẫn rơi về `{}` → page 1, range 14d.
- **Độ phủ test không giảm.** `pages-role-guard.test.ts` vẫn đủ 5 ca guard (chưa đăng nhập, admin, bod, data-entry, viewer); chỉ đổi cách gọi, expect giữ nguyên.
- Không thêm input, truy vấn, export/upload, không lộ secret.

**Lỗ hổng mới:** không có. Kết luận vòng 1 giữ nguyên.
