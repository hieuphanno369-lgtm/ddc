# Cấu trúc dự án — giải thích cho người không chuyên

Đây là **DDC Control Tower** — web app quản lý danh mục dự án kết cấu thép cho phòng KHDATT, Đại Dũng Corporation. Nó thay file Excel thủ công: nhân viên nhập số liệu, hệ thống tự tính toán và vẽ dashboard (biểu đồ) để BOD/Trưởng phòng nhìn là hiểu ngay tình hình.

## Bức tranh tổng thể (3 tầng)

| Tầng | Làm gì | Nằm ở đâu |
|---|---|---|
| **Giao diện (UI)** | Nút bấm, biểu đồ, form nhập liệu — cái người dùng nhìn thấy | `app/` + `src/components/` |
| **Xử lý (logic)** | Công thức tính SPI/CPI/EAC, phân quyền, validate | `src/server/` + `src/lib/` |
| **Dữ liệu (data)** | Lưu dự án, số liệu tháng, tài chính | `src/data/seed/` (mock) + `prisma/` (DB thật sau này) |

Hiện tại app đang dùng **data giả (mock)** trong bộ nhớ — tắt server là mất. Sau khi có Supabase (Postgres) thì chuyển sang lưu thật (đã chuẩn bị sẵn trong `prisma/`).

---

## Cây thư mục — từng chỗ làm gì

### `app/` — các "trang" của web (Next.js App Router)

| Đường dẫn | Làm gì |
|---|---|
| `app/globals.css` | CSS toàn cục + **chế độ tối** (dark mode). Tất cả màu sáng/tối override tập trung 1 chỗ |
| `app/[locale]/layout.tsx` | Khung gốc của mọi trang: `<html>`, `<body>`, đa ngôn ngữ, và đoạn script **chống nháy sáng khi bật dark mode** |
| `app/[locale]/page.tsx` | Trang chủ — tự chuyển hướng sang `/vi` |
| `app/[locale]/login/` | Trang đăng nhập (Google OAuth + dev-login chọn role) |
| `app/[locale]/not-found.tsx` | Trang 404 |
| `app/[locale]/(app)/layout.tsx` | Khung của khu vực **đã đăng nhập**: sidebar trái + header đỏ + thanh tiến độ `TopProgressBar`. Chưa login thì bị đẩy về login |
| `app/[locale]/(app)/overview/page.tsx` | **Dashboard tổng quan** — bây giờ chỉ là "khung mỏng", mỗi biểu đồ là 1 khối riêng (tải độc lập, không chờ nhau) |
| `app/[locale]/(app)/projects/[id]/page.tsx` | **Chi tiết 1 dự án**: S-curve 12 tháng, chuỗi giá trị, EVM, cảnh báo, tài chính, ảnh, What-if |
| `app/[locale]/(app)/projects/page.tsx` | Chuyển hướng thẳng vào dự án đầu tiên (đã bỏ trang list) |
| `app/[locale]/(app)/nhap-lieu/page.tsx` | **Module nhập liệu** — nơi nhân viên thêm dự án + nhập số liệu tháng |
| `app/[locale]/(app)/import/page.tsx` | **Import Excel** — kéo file .xlsx vào, hệ thống ghép mã SAP → dự án |
| `app/[locale]/(app)/admin/page.tsx` | **Quản trị** — xem danh mục nền (khách hàng, team, nhà máy) + audit log + nút "Xóa toàn bộ dữ liệu" |
| `app/[locale]/(app)/data-dictionary/page.tsx` | **Từ điển dữ liệu** — giải thích ý nghĩa + công thức từng field, cách đọc chart |
| `app/api/` | Các API nhỏ: `auth` (Google login), `export` (xuất Excel), `health` (kiểm tra server sống) |

### `src/components/` — các "mảnh ghép" giao diện

| Thư mục | Làm gì |
|---|---|
| `layout/` | `AppShell` (sidebar + header), `SidebarFilter` (bộ lọc trái), `SettingsMenu` (bánh răng: theme + ngôn ngữ + user + logout), `TopProgressBar` (thanh 0-100%), `LoginForm` |
| `dashboard/` | `KpiCard` (thẻ số), `charts.tsx` (tất cả biểu đồ Recharts), `DrillCharts` (donut/bar click lọc), `OverviewWidgets` (11 khối của dashboard, mỗi khối tự tải data), `Watchlist`, `ProjectTable` (bảng dự án) |
| `form/` | `DataEntryForm` (form nhập liệu 6 tab), `CreateProjectForm` (thêm dự án mới), `ImportPanel` (import Excel) |
| `project/` | `ProjectSwitcher` (ô tìm kiếm dự án), `WhatIf` (thử "nếu tháng sau tăng %HT") |
| `ui/` | `Card`, `Badge`, `Skeleton` (khung xám khi đang tải), `Badges` (nhãn trạng thái/ưu tiên) |
| `icons/` | Bộ icon SVG tự vẽ (24×24, đổi màu theo theme) |

### `src/server/` — phần "backend" (chạy trên server, người dùng không thấy)

| File | Làm gì |
|---|---|
| `repo/mock-repo.ts` | **Kho dữ liệu giả** — toàn bộ 17 dự án + số liệu nằm trong bộ nhớ. Tất cả thao tác đọc/ghi đều qua đây |
| `repo/types.ts` | **Định nghĩa kiểu dữ liệu** — 1 dự án có những trường gì, 1 bản ghi tháng có gì. Đây là "hợp đồng" giữa UI và data |
| `queries.ts` | **Tính toán tổng hợp** — từ data thô chạy ra KPI, donut, bảng list (filter/sort/phân trang ở server) |
| `actions.ts` | **Các thao tác ghi** — lưu số liệu, đóng cảnh báo, thêm mã SAP, khóa tháng, import, reset. Kèm **phân quyền** (viewer không ghi được, data-entry chỉ sửa dự án mình phụ trách) |
| `cache.ts` | **Cache + tag** — nhớ kết quả đã tính, chỉ làm lại khi có thay đổi (tránh chậm) |
| `validation.ts` | **Validate bằng Zod** — chặn nhập số sai (vd % phải 0–1.5) ở tận server, không tin client |
| `db.ts` | **Kết nối DB thật (Prisma)** — đang bật sẵn, chưa dùng vì chưa có Postgres |

### `src/lib/` — "công thức" thuần túy (dễ test)

| File | Làm gì |
|---|---|
| `evm.ts` | **Công thức EVM** — SPI, CPI, EAC, VAC, trạng thái dự án, nguy cơ phạt. Đây là "bộ não" tính toán |
| `thresholds.ts` | **Ngưỡng đánh giá** — SPI/CPI < 0.9, công suất 85%, công nợ 5%... Sửa 1 chỗ là đổi toàn hệ thống |
| `auth.ts` | **Đăng nhập Google** + phân role (admin/data-entry/viewer) + giới hạn domain email công ty |
| `session.ts` | Lấy user hiện tại (Google hoặc dev-login) |
| `format.ts` | Định dạng tiền (tỷ), %, ngày cho dễ đọc |
| `labels.ts` | Bản đồ mã ↔ nhãn tiếng Việt (vd `Dang_trien_khai` → "Đang triển khai") |
| `data-dictionary.ts` | **Nội dung từ điển dữ liệu** (song ngữ) |
| `rate-limit.ts` | Giới hạn số lần gọi API (chống spam) |

### `src/data/seed/` — data giả (17 dự án thật)

| File | Làm gì |
|---|---|
| `projects.ts` | Danh sách 17 dự án thật (tên, khách hàng, team, giá trị HĐ, khối lượng...) |
| `dims.ts` | Danh mục nền: khách hàng, team KD, nhà máy, tiền tệ, tỷ giá |
| `history.ts` | Sinh **lịch sử theo tháng** cho từng dự án (PV/EV/AC/SPI/CPI theo thời gian) — đây là nguồn của dashboard |

### `src/i18n/` — đa ngôn ngữ

| File | Làm gì |
|---|---|
| `messages/vi.json` | Toàn bộ chữ tiếng Việt |
| `messages/en.json` | Toàn bộ chữ tiếng Anh |

### `prisma/` — chuẩn bị cho database thật (Supabase)

| File | Làm gì |
|---|---|
| `schema.prisma` | **Sơ đồ bảng dữ liệu** — mirror đúng `types.ts`, 17 bảng (dự án, số liệu tháng, tài chính, phân quyền...) |
| `rls.sql` | **Row Level Security** — chính sách phân quyền ở tầng database |
| `seed.ts` | Nạp 17 dự án + data vào database thật (chạy sau khi có DB) |

### Các file gốc (root)

| File | Làm gì |
|---|---|
| `middleware.ts` | Chặn ở tầng "đường đi": thêm tiếng Việt vào URL, chặn viewer vào trang nhập liệu |
| `MASTER_PROMPT_DDC_Dashboard.md` | **Spec gốc** — toàn bộ yêu cầu nghiệp vụ + công thức chốt |
| `PROGRESS.md` | Tiến độ hiện tại — đã xong gì, đang dở gì, next step |
| `docs/DATA_WAREHOUSE_README.md` | Sơ đồ ERD + data lineage (cho người hiểu data) |
| `docs/DEPLOY.md` | Runbook deploy Supabase + Vercel (sau khi có DB) |
| `docs/STRUCTURE.md` | File này — cấu trúc dự án |
| `README.md` | Hướng dẫn chạy + stack + cách đăng nhập |

---

## Luồng dữ liệu (nhân viên nhập → BOD xem)

1. Nhân viên vào **Nhập liệu** → thêm dự án mới / chọn dự án → nhập %KH, %TT, chi phí, tài chính.
2. Bấm Lưu → `actions.ts` kiểm tra quyền + validate → ghi vào `mock-repo` (sau này ghi DB).
3. Hệ thống tự tính lại SPI/CPI/EAC bằng công thức `evm.ts`.
4. Dashboard **Overview** đọc data qua `queries.ts` → vẽ 6 KPI card + biểu đồ.
5. BOD/Trưởng phòng mở Overview → thấy ngay dự án nào trễ, nguy cơ phạt, backlog.

## Tóm tắt bằng 1 câu

> **`app/` là mặt tiền, `src/lib/` là bộ não tính toán, `src/server/` là tay chân xử lý, `src/data/seed/` là kho data giả, `prisma/` là kho data thật sắp dùng.**
