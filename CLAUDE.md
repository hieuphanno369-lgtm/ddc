# DDC Control Tower — luật làm việc cho Claude

Chủ dự án làm việc bằng **tiếng Việt**, tự quyết nghiệp vụ, điều phối qua dây chuyền subagent `ddc-tower:*`
(planner → coder → tester → security-reviewer → reviewer). Không tự quyết thay chủ dự án các câu hỏi nghiệp vụ.

## 1. Ba tài khoản chạy song song - xác định mình là ai

| Thư mục đang mở | Mình là | Cổng dev | Database |
|---|---|---|---|
| `D:\_project\DDC_Control_Tower` | **Tài khoản A** (CLI, `.claude-A`) | 3000 (`launch.json`: `ddc-control-tower`) | `ddc_control_tower` |
| `D:\_project\DDC_Control_Tower-B` | **Tài khoản B** (Claude Code VS Code / CLI, `~/.claude`) | 3001 (`launch.json`: `ddc-control-tower-B`) | `ddc_control_tower_b` |
| `D:\_project\DDC_Control_Tower-C` | **Tài khoản C** (CLI, `.claude-C`, thêm 2026-09-26) | 3003 (`launch.json`: `ddc-control-tower-C`) | `ddc_control_tower_c` |

Cổng 3002 dành cho worktree `D:\_project\DDC_Control_Tower-xem` (chỉ để xem `main`, không ai làm việc trong đó).
Mỗi thư mục là một git worktree với nhánh riêng. **Không bao giờ sửa file trong thư mục của bên khác.**
"Bên kia" trong file này nghĩa là **cả 2 tài khoản còn lại**.

## 2. Thư mục điều phối chung: `D:\_project\DDC_dieu-phoi\`

- `lo-trinh.md` — lộ trình các phase + trạng thái từng task (nguồn sự thật về "làm gì, ai làm").
- `phien-A.md`, `phien-B.md`, `phien-C.md` - trạng thái sống của từng tài khoản. **Chỉ ghi file của mình**, chỉ đọc file của 2 bên kia.
- `lenh-cho-<X>-*.md` - hàng đợi việc chủ dự án giao cho từng tài khoản.

**Đầu mỗi phiên (kể cả khi gõ "tiếp tục")**: dùng phần tóm tắt do hook SessionStart đưa vào (các mục chính của `phien-A.md`, `phien-B.md`, `phien-C.md` và bảng trạng thái của `lo-trinh.md`).
Không đọc lại toàn bộ các file đó, cũng không đọc `PROGRESS.md`, chỉ để "nắm tình hình" (tốn rất nhiều token mỗi phiên).
Chỉ mở file đầy đủ khi cần chi tiết: trước khi sửa file nóng, khi bắt đầu/kết thúc phase, khi merge, hoặc khi tóm tắt không đủ.
Nếu hook không chạy (không thấy tóm tắt), đọc `phien-<mình>.md` và mục "Đang giữ" của cả 2 file phiên bên kia.

Giữ file phiên ngắn: mỗi ý chính là một dòng `- **Tiêu đề:** ...` ở đầu file (hook chỉ lấy các dòng này), chi tiết dài để ở file lệnh/hồ sơ riêng.

**Sau MỖI commit**: cập nhật `phien-<mình>.md` - phase/task đang làm, nhánh, commit cuối, bước kế tiếp,
file nóng đang giữ, giờ cập nhật. Đây là checkpoint chính: phiên nào không chạy statusline thì không có
cảnh báo usage 90%, hết limit bất ngờ thì chỉ còn lại những gì đã commit + ghi vào file phiên.

## 3. File nóng — phải "giữ" trước khi sửa

`prisma/schema.prisma` + `prisma/migrations/`, `app/globals.css`, `src/i18n/messages/vi.json`, `en.json`,
`src/server/actions.ts`, `src/server/repo/prisma-repo.ts`, `src/server/queries.ts`, `src/server/project-queries.ts`.

- Trước khi sửa: đọc cả 2 file phiên bên kia - nếu một bên đang giữ file đó thì KHÔNG sửa, ghi chú lại và làm việc khác.
- Mỗi file nóng chỉ 1 bên giữ tại một thời điểm; ai ghi "Đang giữ" trước thì được trước.
- Ghi file vào mục "Đang giữ" trong file phiên của mình; bỏ ra khi đã commit xong phần sửa.
- **Migration Prisma: chỉ bên đang giữ `schema.prisma` được tạo.** Chạy `prisma migrate deploy` trên DB của mình.
- Key i18n mới đặt trong nhóm (object) riêng của tính năng, không chèn giữa các key có sẵn.

## 4. Hồ sơ dây chuyền `.bangiao/` và tài liệu dùng chung

- Trong nhánh phase, dây chuyền ship ghi `.bangiao/ke-hoach.md`, `thay-doi.md`... như bình thường.
- **Trước khi merge vào `main`**: chuyển các file đó vào `.bangiao/archive/<ten-phase>-<yyyy-mm-dd>/`
  để gốc `.bangiao/` trên `main` luôn trống (tránh 2 nhánh xung đột cùng tên file).
- **Không sửa `PROGRESS.md` và `.serena/memories/` trong nhánh phase** — chỉ cập nhật trong lượt merge vào `main`.

## 5. Merge

- Xong 1 phase (reviewer CHỐT + chủ dự án đồng ý) → merge vào `main`, push chỉ khi chủ dự án bảo.
- Mỗi lúc chỉ 1 bên merge vào `main` (ghi `ĐANG MERGE main` vào file phiên, xem `quy-trinh.md` mục 2).
- Các bên còn lại: trước khi bắt đầu task mới, `git merge main` vào nhánh mình và chạy `npx prisma migrate deploy`
  (nếu có migration mới) + `npm test`.
- Không `git push --force`, không xoá nhánh của bên khác.

## 6. Khi hết limit / chuyển giao

- Hết limit: không cần làm gì thêm nếu đã tuân mục 2. Khi limit reset, mở lại đúng thư mục, gõ "tiếp tục".
- Một bên rảnh muốn làm hộ: ghi `CHUYỂN GIAO: A→C lúc <giờ>` (đổi chữ cho đúng) vào file phiên của bên bị hết limit **và** của mình,
  rồi mới mở thư mục đó. Chỉ 1 phiên hoạt động trong 1 thư mục tại một thời điểm.

## 7. Kỹ thuật

- Next.js 14 app router + Prisma 6 + PostgreSQL (localhost:5433) + next-intl (vi/en) + Vitest.
- Cổng kiểm: `npx tsc --noEmit`, `npm test`. `npm run build` trên máy này lỗi tải Google Font do mạng
  (SELF_SIGNED_CERT) — dùng `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` trỏ tới file mock (xem
  `D:\_project\DDC_dieu-phoi\tools\font-mock.js`) chỉ để kiểm compile.
- Script PowerShell 5.1 trong `~/.claude` phải thuần ASCII.
- Tài liệu design cho phase redesign: `docs/design/apple-reference/`; Gantt mẫu: `docs/design/gantt-mau-cau-truc.png`.
