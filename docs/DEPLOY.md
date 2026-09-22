# DEPLOY — Supabase + Vercel (runbook)

> Làm sau khi có tài khoản Supabase + Vercel. Trước đó app chạy mock in-memory, không cần DB.

## 0. Trước khi bắt đầu (quan trọng)
- Mock in-memory **mất data khi restart/redeploy**. Chỉ xong bước này thì nhân viên mới nhập data thật.
- Auth dùng **next-auth + Google OAuth**. JWT của next-auth ≠ Supabase `auth.jwt()` → RBAC chính ở **app layer** (`src/server/actions.ts`: `requireRole`/`requireProject`). RLS (`prisma/rls.sql`) là phòng thủ thứ 2, dùng service-role connection.

## 1. Supabase — tạo 3 môi trường (spec §2)
Tạo 3 project: **Dev / Staging / Production**.
Lấy connection string mỗi project: Settings → Database → Connection string.

```env
# .env (dev)
DATABASE_URL="postgresql://...:<dbpass>@db.<ref>.supabase.co:5432/postgres"   # session pooler (port 5432)
DIRECT_URL="postgresql://...:<dbpass>@db.<ref>.supabase.co:5432/postgres"     # hoặc transaction pooler (port 6543)
```

## 2. Migrate + seed (Dev trước)
```bash
npx prisma migrate dev --name init
npx prisma db seed
npx prisma generate
```

Apply RLS:
```bash
# Mở Supabase SQL editor (Dev) chạy nội dung prisma/rls.sql
```

## 3. B1 — Async refactor (repo swap, làm cùng DB)
`mock-repo.ts` sync → `prisma-repo.ts` async. Đổi `queries.ts` + pages/widgets gọi sync → `await`.
Repo factory: có `DATABASE_URL` → Prisma, else mock. Test từng query với DB dev trước khi lên Staging.

## 4. Migrate Staging → Production (spec §9.1)
```bash
npx prisma migrate deploy   # Staging, duyệt bằng mắt
npx prisma migrate deploy   # Production (chỉ sau khi confirm Staging)
```
Thêm cột: có default/NULL hợp lý; xóa cột: đổi `_deprecated_` giữ ≥1 chu kỳ.

## 5. Google OAuth (production)
1. Google Cloud Console → OAuth consent → tạo OAuth Client (Web).
2. Redirect URI: `https://<vercel-domain>/api/auth/callback/google`.
3. Set env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ALLOWED_EMAIL_DOMAINS=daidung.com.vn`.

## 6. Deploy Vercel
1. `git init` + push GitHub.
2. Vercel → Import repo → set env (mục 5 + `DATABASE_URL`, `DIRECT_URL`, `ROLE_SEED`).
3. Deploy. (Production không còn dev-login — Google OAuth là cổng vào duy nhất.)

## 7. Test RBAC (spec §8.7)
- Login 3 role thật: Admin/BOD, Data-entry, Viewer.
- Data-entry chỉ sửa project mình PIC (`project_assignments`); Viewer không vào được `/nhap-lieu` (middleware).

## 8. Go-live reset
- Admin → "Xóa toàn bộ dữ liệu" (nút đã build) → xóa data fake → nhân viên nhập lại từ đầu.
- Trước khi nhập thật: cân nhắc nạp lịch sử Excel các tháng trước (script import lịch sử — chưa build).

## Lưu ý khác
- `dim_stage` / `dim_status` / `dim_date` chưa tạo (app không dùng — status derived, stage enum trong code). Thêm khi cần.
- FK constraint thật (relation Prisma) chưa thêm — hiện chỉ lưu FK id. Thêm qua migration khi cần.
- Full per-user RLS qua Supabase Auth = defer (phức tạp, optional).
