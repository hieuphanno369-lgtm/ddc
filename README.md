# DDC Control Tower

Web app quản trị danh mục dự án kết cấu thép — Phòng KHDATT, Đại Dũng Corporation (DDC).
Single source of truth thay cho Excel thủ công, chuẩn EVM (SPI/CPI/EAC theo PMBOK), cảnh báo sớm rủi ro phạt hợp đồng.

> **Built by Buffalo Tech**

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- next-intl (i18n: `vi` / `en`, default `vi`)
- next-auth v4 (Google OAuth, JWT session, domain allowlist)
- Recharts
- exceljs (export Excel server-side)
- Vitest (unit test EVM)

## Chạy localhost

```bash
npm install
npm run dev
```

Mở http://localhost:3000 → tự redirect `/vi`.

### Đăng nhập (localhost)

Chưa cấu hình Google OAuth → dùng **Đăng nhập Dev** (chỉ hiện ở `NODE_ENV=development`), chọn 1 trong 3 role:

| Role | Điểm vào | Quyền |
|---|---|---|
| `admin` (Admin/BOD/Trưởng phòng) | `/vi/overview` | Full: Overview, Nhập liệu, Quản trị |
| `data-entry` (PM/PIC) | `/vi/nhap-lieu` | Chỉ Nhập liệu (middleware chặn `/overview`, `/admin`) |
| `viewer` | `/vi/overview` | Chỉ Overview (chặn `/nhap-lieu`, `/admin`) |

Dev-login set cookie `ddc_dev_role`, middleware + server đọc cookie này (chỉ dev).

### Google SSO (production)

Tạo `.env` từ `.env.example`:

```env
NEXTAUTH_SECRET=<random>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
```

- Tạo OAuth Client theo `docs/HUONG_DAN_GOOGLE_OAUTH.md`. Redirect URI: `http://localhost:3000/api/auth/callback/google` (local) hoặc domain Vercel.
- Ai vào được do admin quyết: chỉ email đã được thêm ở trang Quản trị (bất kỳ domain nào, kể cả Gmail cá nhân) mới đăng nhập Google được; email lạ bị từ chối.
- Session tối đa 8 giờ.

## Cấu trúc

```
app/[locale]/            # next-intl routing (vi/en)
  (app)/                 # shell (sidebar + header, require auth)
    overview/            # Dashboard Overview
    projects/[id]/       # Dashboard Detail
    nhap-lieu/           # Module CRM nhập liệu
    admin/               # Quản trị danh mục nền
  login/
  api/auth/[...nextauth]/
middleware.ts            # locale + RBAC route-level
src/
  lib/evm.ts             # SPI/CPI/EAC/VAC/trạng thái/nguy cơ phạt (pure)
  lib/thresholds.ts      # MỌI ngưỡng đánh giá — sửa 1 chỗ
  lib/format.ts          # format tiền tệ/%
  lib/auth.ts            # authOptions + role map + domain allowlist
  lib/session.ts         # getCurrentUser (Google + dev fallback)
  server/repo/           # data layer (mock in-memory)
  server/queries.ts      # aggregation + list (filter/sort/pagination ở server)
  server/actions.ts      # server actions (save/close alert/add SAP)
  data/seed/             # 17 dự án thật + dim tables
  components/icons/      # BỘ ICON KỸ THUẬT RIÊNG (SVG stroke, theme-aware)
```

## Bộ icon

`src/components/icons/index.tsx` — icon SVG kỹ thuật thống nhất: 24×24 viewBox, stroke `currentColor`, strokeWidth 1.7. Thêm icon mới bám đúng style này (nav / domain thép / metric / action).

## Business logic (chốt cứng)

- `src/lib/evm.ts` — PV/EV/SPI/CPI/EAC/VAC, trạng thái (Chuẩn bị/Đang/Hoàn thành), Đúng/Trễ (biên 5%), nguy cơ phạt (≤30 ngày), khâu nghẽn, công nợ/đồn tải/huy động.
- `src/lib/thresholds.ts` — ngưỡng SPI 0.9, biên 5%, 30 ngày, 85% công suất, 5% công nợ, 80% huy động. Sửa 1 chỗ.

## Test

```bash
npm test            # unit test EVM + seed data (28 cases)
npm run build       # type-check + build production
```

## Deferred (Phase 2)

- Supabase/Postgres + Prisma + RLS (swap `src/server/repo/mock-repo.ts`).
- Import Excel thật (file parser + preview/validate).
- Upload ảnh thật (storage).
- Email alert (Resend/SendGrid).
- `docs/DATA_WAREHOUSE_README.md` (ERD Mermaid, data lineage) — viết khi lên DB thật.
- Small multiples (SPI/CPI mini grid theo Team KD), forecast SPI.
