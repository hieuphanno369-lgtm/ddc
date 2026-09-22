# Hướng dẫn đọc project cho người NON-TECH

Tài liệu này giúp người không chuyên lập trình hiểu project "DDC Control Tower" đang hoạt động thế nào,
đọc code từ đâu, và khi app báo lỗi thì mò đến file nào.

---

## 1. Project này làm gì?

**DDC Control Tower** = web quản trị danh mục dự án kết cấu thép (cho Đại Dũng Corporation).

Nó giúp:
- Nhập liệu tiến độ dự án mỗi tháng (mấy con số % hoàn thành, chi phí).
- Tự tính ra các chỉ số quản trị (SPI, CPI, trễ tiến độ, nguy cơ phạt hợp đồng...).
- Hiển thị dashboard (bảng KPI, biểu đồ) cho lãnh đạo xem.

**Bản chất hiện tại:** đang là bản MOCK (chạy dữ liệu trong bộ nhớ + file JSON local),
CHƯA nối vào cơ sở dữ liệu thật. DB thật (Supabase/Postgres) là việc của "Phase 2" — chưa làm.

---

## 2. Cấu trúc thư mục (đọc từng thư mục để hiểu)

```
DDC_Control_Tower/
├── app/               ← CÁC MÀN HÌNH (route). Mỗi file page.tsx = 1 màn hình
├── src/               ← TOÀN BỘ CODE NGUỒN (xem chi tiết mục 3)
├── prisma/            ← Chuẩn bị database tương lai (chưa dùng)
├── docs/              ← Tài liệu (bạn đang đọc đây)
├── .data/             ← DỮ LIỆU ĐƯỢC LƯU (file JSON mock)
├── .env               ← THÔNG TIN BÍ MẬT (mật khẩu, key) — KHÔNG commit lên git
├── middleware.ts      ← "Cổng gác": chặn/phân quyền ai được vào trang nào
├── MASTER_PROMPT_DDC_Dashboard.md  ← SPEC GỐC (mô tả nghiệp vụ, đọc đầu tiên)
├── PROGRESS.md        ← Nhật ký tiến độ (đã làm gì, còn lỗi gì)
└── package.json       ← Danh sách thư viện dùng (không cần đọc)
```

### Thứ tự đọc dành cho non-tech (quan trọng)

1. **`MASTER_PROMPT_DDC_Dashboard.md`** — hiểu nghiệp vụ (dự án là gì, cần số gì).
2. **`PROGRESS.md`** — biết đã làm xong gì, đang dở gì, còn lỗi gì.
3. **`docs/DATA_WAREHOUSE_README.md`** — hiểu "dữ liệu" lưu thế nào (star schema, công thức EVM).
4. **`app/`** — liệt kê xem có những màn hình nào.
5. **`src/`** — mới cần đọc code (mục 3).

---

## 3. Bên trong `src/` là gì?

`src/` chứa toàn bộ code. Chia làm 4 nhóm:

| Thư mục | Chứa gì | Đọc khi nào |
|---|---|---|
| `src/components/` | Giao diện (UI): nút, bảng, form, biểu đồ | Muốn sửa giao diện |
| `src/lib/` | Logic & công thức (EVM, format số, đăng nhập) | Số tính sai / công thức |
| `src/server/` | "Phần sau": xử lý dữ liệu, lưu trữ | Nhập liệu / dữ liệu sai |
| `src/i18n/messages/` | Bản dịch tiếng Việt / tiếng Anh | Chữ hiển thị sai |

### Chi tiết `src/lib/` (não của app)

| File | Làm gì |
|---|---|
| `evm.ts` | **Công thức cốt lõi**: SPI, CPI, EAC, trạng thái, đúng/trễ tiến độ, nguy cơ phạt |
| `thresholds.ts` | Các ngưỡng (SPI < 0.9 → cảnh báo, v.v.) |
| `format.ts` | Định dạng số, tiền, %, ngày tháng |
| `auth.ts` | Đăng nhập, phân quyền |
| `session.ts` | Ai đang đăng nhập, vai trò gì |
| `password.ts` | Mã hóa mật khẩu |
| `data-schema.ts` | Sơ đồ dữ liệu (cho trang "Data Schema") |
| `data-dictionary.ts` | Từ điển giải thích thuật ngữ |

### Chi tiết `src/server/` (phần sau)

| File | Làm gì |
|---|---|
| `actions.ts` | Các thao tác lưu/nhập/xóa (server action) |
| `queries.ts` | Truy vấn tính toán cho dashboard |
| `validation.ts` | Kiểm tra dữ liệu nhập đúng/sai |
| `repo/mock-repo.ts` | **KHO DỮ LIỆU** (mock): nơi lưu + lấy dữ liệu |
| `repo/types.ts` | Định nghĩa kiểu dữ liệu (project, fact, finance...) |

---

## 4. Dữ liệu chạy và lưu thế nào?

```
Người dùng nhập liệu (form)
        ↓
src/server/actions.ts   (server action nhận dữ liệu)
        ↓
src/server/repo/mock-repo.ts   (lưu vào bộ nhớ + tính toán)
        ↓
persist() → .data/ddc-mock.json   (ghi ra file JSON trên máy)
```

**Lưu ý quan trọng:**
- Dữ liệu hiện lưu ở **bộ nhớ dev server + file `.data/ddc-mock.json`** (máy local).
- **CHƯA có database thật** → khi deploy lên server thật (Vercel), dữ liệu này sẽ MẤT.
- Đây chính là lý do có "Phase 2" (nối Supabase/Postgres) trong PROGRESS.md.

---

## 5. `src` có phải là "bảo mật" không?

**Không.** `src` là code nguồn bình thường (giao diện + logic), chạy phía server. Người dùng ngoài
KHÔNG truy cập được vào `src` — họ chỉ thấy website qua URL (ví dụ `localhost:3000/vi/overview`).

**Thứ thực sự bí mật** nằm ở file **`.env`** (không nằm trong `src`):
- `NEXTAUTH_SECRET` (khóa bảo mật đăng nhập)
- `DATABASE_URL` (khi nối DB)
- `GOOGLE_CLIENT_SECRET`...

File `.env` đã được cho vào `.gitignore` (không đẩy lên git). Code trong `src` thì công khai được.

**Bảo mật thực sự của app** nằm ở: `src/lib/auth.ts` + `middleware.ts` (kiểm tra đăng nhập + phân quyền).
Có một số lỗ hổng bảo mật đã phát hiện trong audit (xem mục "lỗi tồn đọng" ở PROGRESS.md) — chưa fix.

---

## 6. App báo lỗi → mò đến đâu?

Quy tắc: **lỗi ở đâu thì mò đúng file chỗ đó.**

| Triệu chứng | Mò đến file |
|---|---|
| Không vào được trang / bị chuyển hướng | `middleware.ts` + `src/lib/auth.ts` |
| Giao diện hiển thị sai, nút không chạy | `src/components/...` (component tương ứng) |
| Nhập liệu không lưu được | `src/server/actions.ts` + `src/server/repo/mock-repo.ts` |
| Số liệu trên dashboard sai | `src/lib/evm.ts` + `src/server/queries.ts` |
| Chữ hiển thị sai ngôn ngữ | `src/i18n/messages/vi.json` / `en.json` |
| Ngày tháng / số / % hiển thị sai | `src/lib/format.ts` |
| Màn hình nào đó (login, overview, nhập liệu...) | `app/[locale]/.../page.tsx` tương ứng |

### Cách đọc route (app/)

```
app/[locale]/(app)/
├── overview/page.tsx       → màn hình Tổng quan
├── projects/[id]/page.tsx  → màn hình Chi tiết dự án
├── nhap-lieu/page.tsx      → màn hình Nhập liệu
├── import/page.tsx         → màn hình Import
├── admin/page.tsx          → màn hình Quản trị
├── data-schema/page.tsx    → màn hình Sơ đồ dữ liệu
└── data-dictionary/page.tsx → màn hình Từ điển dữ liệu
```

Màn hình `overview` render ra từ `page.tsx`, gọi component trong `src/components/dashboard/`,
lấy số từ `src/server/queries.ts`, tính công thức từ `src/lib/evm.ts`.

---

## 7. Chạy app lên

```bash
npm run dev       # chạy bản dev → mở http://localhost:3000
npm run build     # đóng gói bản production
npm test          # chạy kiểm tra tự động (40 test)
npx tsc --noEmit  # kiểm tra lỗi code
```

**Tài khoản test:** `admin@daidung.com.vn / Admin@123` (xem đủ quyền).

---

## 8. Tóm tắt 1 dòng cho người bận

> Code giao diện ở `src/components`, công thức ở `src/lib/evm.ts`, dữ liệu lưu ở `src/server/repo/mock-repo.ts`
> (ra file `.data/ddc-mock.json`). Lỗi màn hình nào thì mở `app/.../page.tsx` chỗ đó. DB thật chưa có (Phase 2).
