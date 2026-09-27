# Nâng Next >= 15.5.24 - nhật ký thay đổi (coder)

Nhánh `feature/nang-next15`, từ `main` @ `54ac9bf` (**BASE**, dùng để rollback nếu cần).

## Task 0: mốc nền trên Next 14

- Nhánh đã đúng `feature/nang-next15`, cây làm việc sạch (chỉ có `.bangiao/ke-hoach.md` chưa track).
- `npx tsc --noEmit`: **sạch**.
- `npm test`: **210 file / 2407 test xanh** (đúng mốc tham chiếu).
- `npm run test:e2e:a` (cổng 3010, DB tạm `ddc_control_tower_e2e_a`): **74/74 xanh**, không spec nào đỏ hay chập chờn ở lần chạy này (kể cả `02-overview`).

### Audit trước (Task 0 Bước 3)

`npm audit --omit=dev` (11 vulnerabilities: 1 low, 3 moderate, 5 high, 2 critical):

| Gói | Mức | Advisory | Ghi chú |
|---|---|---|---|
| `next` (14.2.35) | critical | GHSA-p293-qw3h-jr36 (RCE trên Windows), GHSA-2xp9-vwfh-vxw4 (RCE AVIF Image Optimization), + ~20 advisory khác của nhánh 9.3.4-16.3.0 | Mục tiêu chính của phase này |
| `next-intl` (3.26.3) | moderate | GHSA-8f24-v5vv-gm5j (open redirect), GHSA-4c35-wcg5-mm9h (prototype pollution `experimental.messages.precompile`, repo không dùng flag này) | Mục tiêu Task 3 |
| `cookie` (0.5.0, qua `next-auth` 4.24.7) | low | GHSA-pxg6-pf52-xh8x | Gỡ qua nâng `next-auth` (Task 2) |
| `postcss` (<=8.5.22, kéo theo bởi `next` cũ) | high | GHSA-qx2v-qp2m-jg93 + 3 advisory path traversal source map | Tự gỡ khi `next` lên bản mới (bundled `postcss` mới hơn) |
| `deepmerge-ts` (qua `@prisma/config`/`prisma`) | high | GHSA-ggr8-5vv4-36mx | NGOÀI PHẠM VI (không đụng Prisma trong phase này) |
| `uuid` (<11.1.1, qua `exceljs`) | moderate | GHSA-w5hq-g745-h8pq | NGOÀI PHẠM VI |
| `xlsx` (*) | high | GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9 | NGOÀI PHẠM VI, không có bản vá (No fix available) |

`npm ls cookie` trước khi nâng: `next-auth@4.24.7 overridden -> cookie@0.5.0`.

### Bảng phiên bản đã chốt (Task 0 Bước 4)

| Gói | Bản cũ | Bản mới | Lý do chọn |
|---|---|---|---|
| `next` | 14.2.35 | **15.5.26** | Bản 15.x ổn định cao nhất hiện có trên npm (>= 15.5.24 theo yêu cầu); gỡ RCE Windows + AVIF |
| `react` | 18.3.1 | **19.3.0** | Bản 19.x ổn định cao nhất, nằm trong dải peer `^19.0.0` của `next@15.5.26` |
| `react-dom` | 18.3.1 | **19.3.0** | Khớp đúng bản `react` (bản 19.3.0 tồn tại trên npm) |
| `@types/react` | 18.3.5 | **19.3.0** | Cao nhất khớp React 19 |
| `@types/react-dom` | 18.3.0 | **19.3.0** | Cao nhất khớp React 19 |
| `next-auth` | 4.24.7 | **4.24.15** | Cao nhất nhánh 4.x; peer có `next: ^12...^15...^16`, `react: ^17...^18...^19`; `dependencies.cookie: ^0.7.0` (gỡ advisory `cookie`) |
| `recharts` | 2.12.7 | **2.15.4** | Cao nhất nhánh 2.x (giữ nguyên nhánh theo quyết định kỹ thuật #2 của kế hoạch); peer `react: ^16...^18 || ^19.0.0` |
| `react-is` | (kéo theo `recharts`, không ghim) | **19.3.0** | Ghim cùng bản React: `recharts@2.15.4` khai `react-is: ^18.3.1` trong `dependencies`, React 19 đổi `$$typeof` của element nên `react-is` 18 nhận sai (Tooltip/Legend biến mất) |
| `next-intl` | 3.26.3 | **4.14.7** | Cao nhất nhánh 4.x (nhánh đang bảo trì); peer `next: ^12...^15...^16` |

## Task 1: dời `dynamic({ ssr: false })` ra client component

(cập nhật khi hoàn thành)

## Task 2: nâng Next 15 + React 19 + next-auth + recharts, chuyển request API sang async

(cập nhật khi hoàn thành)

## Task 3: nâng next-intl 4.x

(cập nhật khi hoàn thành)

## Task 4: cổng đầy đủ + kiểm trình duyệt

(cập nhật khi hoàn thành)

## Cần hỏi

(chưa có mục nào)

## Để sau

(cập nhật khi hoàn thành Task 2 Bước 6)
