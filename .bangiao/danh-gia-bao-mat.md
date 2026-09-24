BAO MAT: DAT

# P1A — Đánh giá bảo mật vòng 2 (sau vòng sửa 1)

> Security-reviewer không có công cụ ghi file; chặng điều phối (ship) ghi nguyên văn nội dung trả về. Bản vòng 1 nằm trong git ở commit `02b77c7`.

Nhánh `feature/p1a-du-lieu-dung`, vòng sửa `4c22bce..6b725e9` (HEAD `02b77c7`), soát cả `main...HEAD` ở vùng đụng tới.
Skill: `security-review`, `security-audit` (guidance mode). DB `ddc_control_tower` chỉ SELECT. Không chạy app, chỉ đọc source và `node_modules`. Có chạy `npm audit --omit=dev` (kiểm TLS bật, qua NODE_EXTRA_CA_CERTS).

**Phán quyết:** DAT trong phạm vi P1A. F1, F2a, F2b, F3 đã đóng, vòng sửa không sinh lỗ hổng mới trong code.
**Cần chủ dự án quyết trước merge:** F10 (Critical, có điều kiện). Dòng Next 14.x còn CVE RCE khi host trên Windows; 14.x không có bản vá, phải nâng major (≥ 15.5.24).

## Bảng trạng thái

| # | Mức (v1) | Trạng thái v2 | Ghi chú |
|---|---|---|---|
| F1 | High | **ĐÃ ĐÓNG** | Magic byte + đuôi theo kind + nosniff/CSP sandbox |
| F2a | High | **ĐÃ ĐÓNG** | `nhap-lieu` tự redirect theo role, `financial` fail-closed, server action chặn độc lập |
| F2b | High | **ĐÃ ĐÓNG** | next 14.2.35 (package.json + lock + node_modules), đoạn xử lý `x-middleware-subrequest` đã bị gỡ |
| F3 | Medium | **ĐÃ ĐÓNG** (còn Low) | Content-Length kiểm trước `formData()`, không có đường vòng qua chunked/CL sai |
| F4 | Medium | GHI NỢ → P2A | `xlsx` 0.18.5, audit vẫn báo High, không có fix trên npm |
| F5 | Low | GHI NỢ → P5B | |
| F6 | Low | GHI NỢ → P3A | |
| F7 | Low | GHI NỢ → P5B | admin/data-entry luôn `canViewFinance=true` nên prop `project.contractValue` ở nhập liệu chưa khai thác được |
| F8 | Low | GHI NỢ, chờ chủ dự án | |
| F9 | Info | GHI NỢ → P5B | `/api/photos` chỉ kiểm đăng nhập (BOLA, uuid khó đoán); chưa rate-limit upload |
| F10 | **Critical (có điều kiện)** | **MỚI**, chờ chủ dự án | Next 14.2.35 còn CVE, xem dưới |
| F11 | Low | **MỚI** | next-auth 4.24.7 có advisory, vá được không cần major |
| F12 | Medium | **MỚI** (có từ trước) | next-intl 3.26.3 open redirect GHSA-8f24-v5vv-gm5j |

## Soát lại chi tiết

### F1 — ĐÃ ĐÓNG
- `src/lib/uploads.ts:33-39` `detectImageKind`: mỗi nhánh kiểm `header.length` trước khi đọc byte → file < 12 byte/0 byte trả `null` → 400. WEBP so `RIFF` byte 0-3 và `WEBP` byte 8-11 (đúng offset). `photo-service.ts:34` đọc `file.slice(0,12)` từ nội dung thật, sau kiểm quyền `canWriteProject` (dòng 23).
- Đuôi lưu lấy từ `EXT_BY_KIND[kind]` (`uploads.ts:69`), không từ `file.name`; tên gốc chỉ qua `sanitizePhotoName` (≤ 60 ký tự).
- `CONTENT_TYPE_BY_EXT` đã bỏ `.svg`/`.bmp`; đuôi lạ → `application/octet-stream`.
- `/api/photos` (`route.ts:18-27`) có `X-Content-Type-Options: nosniff` + `Content-Security-Policy: default-src 'none'; sandbox`.
- Polyglot (header ảnh + HTML/JS): lưu đuôi raster, phục vụ `image/*` + nosniff → không render HTML; `<script src>` bị nosniff chặn; mở trực tiếp thì sandbox → không script. Không còn rủi ro thực tế.
- Ảnh cũ `.svg`/`.bmp` (nếu có) → `application/octet-stream` + nosniff + sandbox, trình duyệt tải về. Thực tế: `project_photos` 4 bản ghi `url` rỗng (seed); `data/uploads/` không có svg/bmp/html.
- Hai đường vào (`addPhotoAction` `actions.ts:372` và `/api/photo-upload`) dùng chung `addPhotoForUser`.

### F2a — ĐÃ ĐÓNG
- `nhap-lieu/page.tsx:18-21`: chưa login → `/login`; role ngoài admin/data-entry → `homeForRole`; `redirect()` ném `NEXT_REDIRECT`.
- `financial` chỉ nạp khi `user.canViewFinance` (dòng 47-48), kiểm lần hai khi truyền prop (dòng 79). `canEditFinance` chỉ admin (dòng 95).
- `selectedId` chỉ lấy từ danh sách `all` đã lọc theo assignment (dòng 32-34) → data-entry không đổi `?project=` sang dự án khác được.
- Server `saveMonthlyData` (`actions.ts:69-75`): `requireProject` chỉ admin hoặc data-entry được gán; field tài chính chặn khi role ∉ admin/bod; bod không qua `requireProject` → thực tế chỉ admin ghi tài chính. Không dựa middleware.
- Info: `overview/page.tsx` vẫn dựa middleware để chặn data-entry — nay middleware không bị bỏ qua và tài chính lọc theo `canViewFinance`, không chặn.

### F2b — ĐÃ ĐÓNG (CVE-2025-29927)
- `package.json:16` `"next": "14.2.35"`; `package-lock.json:3473-3476` 14.2.35 có integrity; `node_modules/next/package.json` = 14.2.35.
- `next/dist/server/web/sandbox/sandbox.js` không còn đọc `x-middleware-subrequest`; grep toàn `next/dist` không còn chuỗi `middleware-subrequest`.
- Bằng chứng động của tester chỉ gửi `middleware` 1 lần; payload đúng cho 14.x là `middleware:middleware:middleware:middleware:middleware`. Code đã gỡ nên kết luận không đổi; nếu muốn bằng chứng động nên thử lại payload 5 lần.

### F3 — ĐÃ ĐÓNG, còn Low
- `app/api/photo-upload/route.ts:24-28` kiểm Content-Length trước `req.formData()`: thiếu/không phải số/> 5MB+64KB → 413.
- Không đường vòng: chunked không CL → `null` → 413; có cả CL lẫn TE → llhttp trả 400; CL khai nhỏ → Node chỉ đọc đúng số byte; CL khai lớn → treo tới timeout, không tốn RAM; CL `1e3`/âm → Node từ chối.
- Next không đệm body trước handler: matcher `middleware.ts:57` loại trừ `/api` → `getCloneableBody` không chạy cho route này.
- Còn lại (Low, gộp nợ F9/P5B): user đã login (kể cả viewer) gửi được body ≤ 5.06MB, bị đệm trước `canWriteProject`, chưa rate-limit → vá: `rateLimit('photo:' + user.email)` ngay sau kiểm login.

### Vòng sửa có sinh lỗ hổng mới không — KHÔNG
- `DataEntryForm.tsx` `catch` → `setSaveErr(e.message)`: production Next che lỗi server action (chỉ digest), không lộ stack.
- Test mới không đổi bề mặt tấn công.

## Phát hiện mới

### F10 — Critical có điều kiện — Next 14.2.35 (dòng 14.x hết hỗ trợ)
- `npm audit --omit=dev` với next 14.2.35: tổng 2 critical, 5 high. Advisory liên quan next:
  - **GHSA-p293-qw3h-jr36 (Critical):** RCE không cần đăng nhập khi server host trên Windows (App/Pages Router). `>=13.4.0 <15.5.24`, không có bản 14.x vá, không workaround.
  - **GHSA-2xp9-vwfh-vxw4 (Critical):** RCE qua Image Optimization xử lý AVIF (libheif/sharp).
  - **GHSA-m99w-x7hq-7vfj (High):** DoS CPU qua Server Actions.
  - **GHSA-h25m-26qc-wcjf (High):** DoS deserialize RSC.
  - **GHSA-89xv-2m56-2m9x (High):** SSRF trong Server Actions khi Host không cố định (`next start` 14.2+ đã cố định → thấp).
  - **GHSA-955p-x3mx-jcvp (Medium):** lộ ID server action (app đã kiểm quyền từng action → thấp).
- Khai thác: máy dev Windows, `"dev": "next dev"` (`package.json:6`) nghe mọi interface → người cùng LAN gửi request tới 3000/3001 được; theo advisory là đủ điều kiện RCE (chưa chạy PoC).
- Production dự kiến Vercel/Linux (`docs/DEPLOY.md`) → RCE Windows không áp dụng; DoS vẫn còn. (Lưu ý: lộ trình P6 là deploy VPS — cần kiểm OS VPS.)
- Cách vá: (1) ngay: `"dev": "next dev -H 127.0.0.1"`, không host production trên Windows khi còn Next 14; (2) task riêng nâng `next` ≥ 15.5.24 (hoặc 16.3.3+) — major: React 19, `params`/`cookies()` async, next-intl 4.x; gộp F12 và F4.
- Không tính là chặn P1A: có từ trước (14.2.15 cũng dính), không do vòng sửa gây ra; F2b đã đúng yêu cầu "bản 14.2.x mới nhất". Chủ dự án quyết thời điểm nâng major.

### F11 — Low — next-auth 4.24.7
- Audit báo critical GHSA-5jpx-9hw9-2fx4 và GHSA-7rqj-j65f-68wh — chỉ ảnh hưởng EmailProvider; `src/lib/auth.ts` chỉ dùng Credentials + Google → không áp dụng.
- Còn: GHSA-x445-f3h2-j279 (rất thấp, 1 OAuth provider), GHSA-xmf8-cvqr-rfgj (`getToken` ném lỗi với Bearer lỗi).
- Vá: `"next-auth": "4.24.15"` (không major).

### F12 — Medium — next-intl 3.26.3 open redirect
- GHSA-8f24-v5vv-gm5j (<4.9.1), ở middleware locale → link trông như của app nhưng chuyển ra ngoài (phishing). Chưa dựng PoC.
- Vá: next-intl ≥ 4.9.1 (major), gộp đợt nâng Next 15 (F10).

### Ngoài phạm vi, không chặn
- `postcss`, `prisma`/`deepmerge-ts`: chỉ build/CLI. `exceljs` → `uuid` bounds check: chỉ v3/v5/v6 khi có `buf`. `cookie` < 0.7: Low, theo next-auth.

## Việc trước merge
1. Không có gì bắt buộc cho P1A.
2. Chủ dự án quyết F10: tối thiểu `-H 127.0.0.1` cho script dev; mở task nâng Next ≥ 15.5.24 + next-intl 4 + next-auth 4.24.15 trước go-live.
