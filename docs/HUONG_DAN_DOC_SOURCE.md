# Hướng dẫn đọc source code — DDC Control Tower

Tài liệu cho dev mới. Chỉ ra **file + path** cho từng mục. Bổ sung cho `docs/STRUCTURE.md` (phiên bản kỹ thuật, sâu hơn).

---

## 1. Công nghệ sử dụng

### 1.1 Stack đầy đủ (ngoài React)

| Công nghệ | Version | Vai trò | File tham chiếu |
|---|---|---|---|
| **Next.js** (App Router) | 14.2.15 | Framework fullstack — vừa render UI vừa chạy backend | `next.config.mjs`, `app/` |
| **React** | 18.3.1 | Thư viện UI | `react` + `react-dom` trong `package.json` |
| **TypeScript** | 5.5.4 | Ngôn ngữ, strict mode | `tsconfig.json` |
| **Tailwind CSS** | 3.4.10 | Styling + dark mode | `tailwind.config.ts`, `app/globals.css` |
| **next-intl** | 3.26.3 | Đa ngôn ngữ vi/en | `src/i18n/` |
| **next-auth** | 4.24.7 | Auth (email/password + Google OAuth) | `src/lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts` |
| **Prisma** | 6.19.3 | ORM (schema DB — chuẩn bị, chưa chạy) | `prisma/schema.prisma`, `src/server/db.ts` |
| **Recharts** | 2.12.7 | Biểu đồ (KPI, donut, bar, S-curve) | `src/components/dashboard/charts.tsx` |
| **exceljs** | 4.4.0 | Xuất Excel | `app/api/export/route.ts` |
| **xlsx** | 0.18.5 | Đọc file Excel import | `src/components/form/ImportPanel.tsx` |
| **Zod** | 4.6.5 | Validate input (server-side) | `src/server/validation.ts` |
| **bcryptjs** | 3.0.3 | Hash/verify mật khẩu | `src/lib/password.ts` |
| **Vitest** | 2.1.1 | Unit test | `vitest.config.ts`, `*.test.ts` |
| **tsx** | 4.23.13 | Chạy TS trực tiếp (seed Prisma) | `prisma/seed.ts` |

**Node**: v20+ (xem `package.json` → `engines`). Chạy: `npm run dev`.

### 1.2 Frontend gọi backend như thế nào?

App dùng **2 cơ chế**, KHÔNG có `fetch`/`axios` từ client:

**A. Server Actions (chính — cho mọi thao tác ghi)**

- Khai báo `"use server"` ở đầu `src/server/actions.ts`.
- Client component (`"use client"`) **import trực tiếp** hàm từ `@/server/actions` rồi `await` — không qua HTTP.

Ví dụ thật:
```ts
// src/components/form/CreateProjectForm.tsx:9
import { createDimValueAction, createProjectAction } from '@/server/actions';
const res = await createProjectAction({ ... });  // line 77
```

Mọi hàm ghi đều nằm `src/server/actions.ts`. Client chỉ gọi, không biết data lưu đâu.

**B. Route handlers (REST — cho auth / export / health)**

| Endpoint | File | Gọi từ |
|---|---|---|
| `POST /api/auth/...` | `app/api/auth/[...nextauth]/route.ts` | next-auth (login/Google) |
| `GET /api/export?...` | `app/api/export/route.ts` | tải Excel (mở URL trực tiếp) |
| `GET /api/health` | `app/api/health/route.ts` | kiểm tra server sống |

**Đọc dữ liệu** không qua API — Server Component gọi thẳng repo (xem mục 2).

### 1.3 State management — gồm thành phần nào?

**KHÔNG dùng Redux/Zustand/Context/useReducer.** Chỉ 3 thứ:

1. **React Server Components (RSC)** — data lấy ở server, render luôn. State "thật" nằm server.
   - `app/[locale]/(app)/overview/page.tsx` (async, gọi `repo` + `queries` trực tiếp).
2. **`useState` local** — state UI nhỏ trong client component (form, modal, filter).
   - Ví dụ: `src/components/form/DataEntryForm.tsx`, `src/components/dashboard/*`.
3. **URL searchParams** — filter/tháng/trang lưu trên URL (server component đọc `searchParams`).
   - `app/[locale]/(app)/overview/page.tsx` đọc `searchParams` → `DashboardFilters`.

**Session/auth** — đọc server-side qua `getCurrentUser()` (`src/lib/session.ts`), không phải state client.

### 1.4 Source front-end và back-end nằm đâu?

| Phần | Path | Ghi chú |
|---|---|---|
| **Frontend** (UI) | `app/[locale]/` + `src/components/` | trang + mảnh ghép UI |
| **Backend** (logic/ghi) | `src/server/` | repo, actions, queries, validation |
| **Logic thuần** (công thức) | `src/lib/` | EVM, thresholds, format, auth |
| **Data mock** | `src/data/seed/` | 17 dự án + lịch sử tháng |
| **DB thật (tương lai)** | `prisma/` | schema + rls + seed |
| **Middleware** | `middleware.ts` (root) | i18n + RBAC route-level |

> Next.js = fullstack 1 app. Không tách frontend/backend repo riêng.

### 1.5 Những thư viện đã cài

Xem đầy đủ: `package.json`.

- **dependencies**: `@prisma/client`, `bcryptjs`, `exceljs`, `next`, `next-auth`, `next-intl`, `react`, `react-dom`, `recharts`, `xlsx`, `zod`.
- **devDependencies**: `@types/*`, `autoprefixer`, `postcss`, `prisma`, `tailwindcss`, `tsx`, `typescript`, `vitest`.

### 1.6 Còn gì nữa (chưa nhắc ở trên)

| Mục | Giải thích | File |
|---|---|---|
| **Path alias** | `@/*` → `./src/*` | `tsconfig.json` → `compilerOptions.paths` |
| **i18n routing** | định nghĩa locale `vi`/`en`, prefix URL | `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navigation.ts` |
| **Middleware** | thêm locale vào URL + chặn role sai route | `middleware.ts` |
| **Cache + revalidate** | tag cache 30p, revalidate khi có thay đổi | `src/server/cache.ts` |
| **EVM (bộ não tính toán)** | SPI/CPI/EAC/VAC + trạng thái dự án | `src/lib/evm.ts` + test `src/lib/evm.test.ts` |
| **Ngưỡng đánh giá** | SPI/CPI < 0.9, công suất 85%… | `src/lib/thresholds.ts` |
| **Persistence mock** | lưu `.data/ddc-mock.json`, reload khi restart | `src/server/repo/mock-repo.ts` (`loadPersisted`/`persist`) |
| **Activity/audit log** | ghi login + thao tác | `src/lib/activity.ts` |
| **Rate limit** | chống spam login/export | `src/lib/rate-limit.ts` |
| **Data dictionary** | ý nghĩa + công thức từng field | `src/lib/data-dictionary.ts` + `src/lib/data-schema.ts` |
| **Role type mở rộng** | thêm `role`/`canViewFinance` vào session | `src/types/next-auth.d.ts` |
| **Đa ngôn ngữ string** | toàn bộ chữ vi/en | `src/i18n/messages/vi.json`, `en.json` |
| **Spec gốc** | yêu cầu nghiệp vụ + công thức chốt | `MASTER_PROMPT_DDC_Dashboard.md` (root) |

---

## 2. Mô hình hoạt động (các service)

App chạy trên **1 process Next.js**, bên trong gồm các "service" logic:

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Client)                                        │
│   • React components ("use client") — 26 file            │
│   • gọi Server Actions / mở URL export                   │
└───────────────┬─────────────────────────────────────────┘
                │ (Server Actions / Route Handler)
┌───────────────▼─────────────────────────────────────────┐
│  Next.js Server                                          │
│                                                          │
│  1. Middleware (middleware.ts) — i18n + RBAC route       │
│  2. Server Components (app/[locale]/.../page.tsx)        │
│     └─ đọc data qua repo + queries                       │
│  3. Server Actions (src/server/actions.ts)               │
│     └─ auth → validate → ghi → revalidate               │
│  4. Route Handlers (app/api/*) — auth / export / health  │
│                                                          │
│   ┌────────────┬──────────────┬──────────────────────┐   │
│   │ mock-repo  │  queries.ts  │  evm.ts + thresholds │   │
│   │ (data)     │  (tính KPI)  │  (công thức)         │   │
│   └─────┬──────┴──────────────┴──────────────────────┘   │
│         │ persist                                          │
│   ┌─────▼──────────────┐                                  │
│   │ .data/ddc-mock.json │  (file JSON, dev)                │
│   └────────────────────┘                                  │
└─────────────────────────────────────────────────────────┘
         │ (tương lai — Phase 2)
┌────────▼────────────────────────────────────────────────┐
│  Supabase / Postgres (Prisma + RLS)                      │
│   • prisma/schema.prisma                                 │
│   • prisma/rls.sql                                       │
└─────────────────────────────────────────────────────────┘
```

### Chi tiết từng service

| Service | File | Trách nhiệm |
|---|---|---|
| **Middleware** | `middleware.ts` | Chèn locale, redirect chưa login, chặn role sai route (`DENIED` map) |
| **Server Components** | `app/[locale]/(app)/*/page.tsx` | Render trang, đọc data trực tiếp (server-render, nhanh, không lộ API) |
| **Server Actions** | `src/server/actions.ts` | Mọi thao tác ghi. Luồng: `requireRole`/`requireProject` (auth) → Zod validate → gọi repo → `revalidateTag` → `logActivity` |
| **Repo (data layer)** | `src/server/repo/mock-repo.ts` | Singleton trong `globalThis`. Đọc/ghi in-memory + persist `.data/ddc-mock.json`. Đây là chỗ swap sang Prisma ở Phase 2 |
| **Queries (aggregation)** | `src/server/queries.ts` | Tính KPI, donut, list (filter/sort/phân trang server-side) |
| **EVM engine** | `src/lib/evm.ts` | SPI/CPI/EAC/VAC, trạng thái, nguy cơ phạt |
| **Thresholds** | `src/lib/thresholds.ts` | Ngưỡng đánh giá tập trung 1 chỗ |
| **Auth** | `src/lib/auth.ts` + `app/api/auth/[...nextauth]/route.ts` | Credentials + Google, JWT session, role mapping |
| **Session** | `src/lib/session.ts` | `getCurrentUser()` — đọc user + role + canViewFinance |
| **Export** | `app/api/export/route.ts` | Sinh file Excel (exceljs) |
| **Health** | `app/api/health/route.ts` | Trả `{status:"ok"}` |
| **DB (future)** | `src/server/db.ts` + `prisma/` | Prisma client — chưa active khi `DATABASE_URL` rỗng |

### Luồng dữ liệu tóm tắt

**Đọc**: Browser → `page.tsx` (Server Component) → `repo`/`queries` → HTML → Browser.
**Ghi**: Browser → `action.ts` (Server Action) → auth + validate → `repo` → `persist()` → `revalidateTag` → UI tự refresh.

---

## 3. Công cụ (IDE) debug đang dùng

| Công cụ | Dùng cho | Cấu hình |
|---|---|---|
| **VS Code** | IDE chính | chưa có `.vscode/launch.json` (không debug attach) |
| **Serena** (MCP) | Đọc code qua LSP (find symbol, reference, rename, edit) — dùng trong Claude Code | `.serena/project.yml` (định nghĩa language servers + project) |
| **Dev server console** | Log runtime, lỗi Next.js | `npm run dev` → xem terminal + `.dev.log` |
| **Vitest** | Chạy unit test | `npm test` (40 case) |
| **curl / api/health** | Kiểm tra endpoint thủ công | `GET /api/health` |

**Chưa có**: debugger Node attach (`.vscode/launch.json`), browser devtools automation, lint config riêng (ESLint default Next.js).

### Cách debug thực tế hiện tại

1. Chạy `npm run dev` → đọc log terminal (Next.js + server action lỗi hiện ra đây).
2. Test logic thuần bằng `npm test` (EVM, repo) — nhanh hơn bấm UI.
3. Kiểm tra auth/session bằng `curl` tới `/api/auth` + `/api/health`.
4. Đọc/định vị code bằng **Serena** (`find_symbol`, `find_referencing_symbols`).

---

> **Tóm tắt 1 dòng**: Next.js App Router fullstack — UI (`app/` + `src/components/`), logic (`src/lib/`), backend (`src/server/`), data mock (`src/data/seed/`) → tương lai `prisma/` (Supabase).
