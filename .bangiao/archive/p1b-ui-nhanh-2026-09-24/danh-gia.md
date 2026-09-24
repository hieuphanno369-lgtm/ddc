PHAN QUYET: CHOT

# Đánh giá cuối — P1B (nhánh `feature/p1b-ui-nhanh`), vòng 2

> Ghi chú điều phối: reviewer không có công cụ ghi file; phiên ship lưu nguyên văn từ báo cáo reviewer (vòng 2).

Skill đã dùng: `ddc-tower:code-review`.
Đã đọc: `.bangiao/danh-gia.md` (vòng 1: CAN SUA), `.bangiao/thay-doi.md` mục "Sửa theo review vòng 1", `.bangiao/ket-qua-test.md` mục "Vòng 3", `.bangiao/danh-gia-bao-mat.md` (vòng 1 DAT, mục "Vòng 2": DAT).
Lệnh chỉ đọc đã chạy: `git show 1c54a93`, `git log main..HEAD` (kiểm trailer), `git diff main...HEAD --stat` trên các file cấm, `npx tsc --noEmit` (có `.next/types`, KHÔNG xoá `.next`), `npm test`.

## Kết quả vòng 2

### Mục 1 vòng 1 (TB-1: kiểu tham số AuditPage làm hỏng `next build`): ĐÃ SỬA ĐÚNG
- `app/[locale]/(app)/audit/page.tsx:15`: đổi `} = {}) {` thành `}) {`. Vẫn giữ `searchParams = {}` trong destructuring, nên gọi mà thiếu `searchParams` thì trang rơi về page 1, range 14d.
- 9 chỗ gọi trong test đã sửa đúng như vòng 1 chỉ ra: `src/server/operation-pages-render.test.ts` 204/215/230/242 và `src/server/pages-role-guard.test.ts` 128/133/138/143/148, đổi thành `() => AuditPage({})`. Các `expect` giữ nguyên, nên độ phủ guard không đổi: vẫn đủ 5 ca (chưa đăng nhập, admin, bod, data-entry, viewer).
- Reviewer tự xác minh: có `.next/types/app/[locale]/(app)/audit/page.ts`, chạy `npx tsc --noEmit` thoát mã 0. `npm test` được 62 file, 802/802 pass.
- `next build` exit 0 (có route `ƒ /[locale]/audit`, không còn TS2344): theo `thay-doi.md` và `ket-qua-test.md` Vòng 3. Reviewer không chạy lại build.
- Không trang nào khác trong `app/**/page.tsx` còn dạng `} = {}) {`.

### Mục 2 vòng 1 (archive `.bangiao`): không phải việc còn nợ của nhánh
Chủ dự án tự làm lúc merge (xem Thủ tục trước merge ở dưới).

### Bảo mật
Đồng ý với `danh-gia-bao-mat.md` Vòng 2: DAT. Commit chỉ đổi chữ ký hàm. Guard admin ở /audit vẫn chạy trước khi đọc dữ liệu, cách parse `page`/`range` không đổi, không có đường fail-open mới.

### Tuân thủ
- Cả 11 commit `main..HEAD` đều có `Co-Authored-By`: ĐẠT.
- Không đụng `prisma/`, `app/globals.css`, `src/server/actions.ts`, `src/server/repo/prisma-repo.ts`, `PROGRESS.md`, `.serena/`: ĐẠT.
- Commit sửa đúng phạm vi mục 1, không lan sang các mục "Để sau": ĐẠT.

Kết luận vòng 1 cho 3 câu hỏi vẫn giữ: code khớp kế hoạch, test phần lớn có giá trị thật, không có vấn đề bảo mật chặn merge.

## Thủ tục trước merge vào `main` (chủ dự án làm)
1. Archive (CLAUDE.md mục 4): chuyển `.bangiao/ke-hoach.md`, `thay-doi.md`, `ket-qua-test.md`, `danh-gia-bao-mat.md`, `danh-gia.md` vào `.bangiao/archive/p1b-ui-nhanh-<yyyy-mm-dd>/`, để gốc `.bangiao/` trên `main` trống. Nếu không chuyển thì `.bangiao/thay-doi.md` sẽ xung đột add/add với nhánh A.
2. Xung đột i18n với nhánh A (`feature/p1a-du-lieu-dung`): `src/i18n/messages/vi.json` và `en.json` đều thêm nhóm mới ở cuối file (B thêm `resourceKpi`/`valueChainAbs`/`logPaging`, A thêm `dataGuard`). Cách giải: giữ cả 2 phía, mỗi nhóm là một object top-level riêng, sửa dấu phẩy. Sau đó chạy `npx vitest run src/i18n/messages.test.ts`, `npx tsc --noEmit`, `npm test`.
3. Sau merge: chạy lại `npx tsc --noEmit` khi đang có `.next/types` (không xoá `.next`) và nếu được thì chạy `next build` với font mock, để bắt lớp lỗi kiểu kiểu TB-1. Lần sau nhớ ghi "Đang giữ" `vi.json/en.json` vào file phiên trước khi sửa.

## Để sau (không chặn merge, giữ từ vòng 1)
1. `src/components/form/Combobox.tsx:57-60`, `src/components/project/ProjectSwitcher.tsx:46-49`: ô đang đóng mà bấm ↓ thì mở ra nhưng không sáng mục 0, vì effect reset `active` theo `[query, open]` chạy sau khi đã đặt active. Cách sửa: bỏ `open` khỏi deps, reset trong `onChange`/khi đóng.
2. `src/server/report.ts:30-44`: gọi `getLatestFact` 2 lần cho mỗi dự án, thành 2N truy vấn. Nên dùng lại fact hoặc summary.
3. `app/[locale]/(app)/admin/page.tsx:28-30`: đọc toàn bộ `activity_log` rồi mới lọc 14 ngày trong bộ nhớ (L-2). Chuyển điều kiện lọc vào repo khi mở khoá `prisma-repo.ts`.
4. `src/server/audit-log-page.ts`: gọi `prisma` trực tiếp, bỏ qua lớp repo (L-3). Chưa có index `audit_log(changed_at desc, id desc)` (L-1). Để P2B.
5. `src/components/ui/HelpTip.tsx:32`: đổi tên `hide` thành `restore`.
6. `projects-detail-page-render.test.ts` (T13b): nên assert con số tấn cụ thể của 1 giai đoạn, và assert Thiết kế không có span.
