# DDC Control Tower — luật làm việc cho Claude

Chủ dự án làm việc bằng **tiếng Việt**, tự quyết nghiệp vụ, điều phối qua dây chuyền subagent `ddc-tower:*`
(planner → coder → tester → security-reviewer → reviewer). Không tự quyết thay chủ dự án các câu hỏi nghiệp vụ.

## 1. Hai tài khoản chạy song song — xác định mình là ai

| Thư mục đang mở | Mình là | Cổng dev | Database |
|---|---|---|---|
| `D:\_project\DDC_Control_Tower` | **Tài khoản A** (Claude desktop) | 3000 (`launch.json`: `ddc-control-tower`) | `ddc_control_tower` |
| `D:\_project\DDC_Control_Tower-B` | **Tài khoản B** (Claude Code VS Code) | 3001 (`launch.json`: `ddc-control-tower-B`) | `ddc_control_tower_b` |

Mỗi thư mục là một git worktree với nhánh riêng. **Không bao giờ sửa file trong thư mục của bên kia.**

## 2. Thư mục điều phối chung: `D:\_project\DDC_dieu-phoi\`

- `lo-trinh.md` — lộ trình các phase + trạng thái từng task (nguồn sự thật về "làm gì, ai làm").
- `phien-A.md`, `phien-B.md` — trạng thái sống của từng tài khoản. **Chỉ ghi file của mình**, chỉ đọc file bên kia.

**Đầu mỗi phiên (kể cả khi gõ "tiếp tục")**: đọc `phien-A.md`, `phien-B.md`, `lo-trinh.md` trước khi làm gì.

**Sau MỖI commit**: cập nhật `phien-<mình>.md` — phase/task đang làm, nhánh, commit cuối, bước kế tiếp,
file nóng đang giữ, giờ cập nhật. Đây là checkpoint chính: desktop không chạy statusline nên không có
cảnh báo usage 90%, hết limit bất ngờ thì chỉ còn lại những gì đã commit + ghi vào file phiên.

## 3. File nóng — phải "giữ" trước khi sửa

`prisma/schema.prisma` + `prisma/migrations/`, `app/globals.css`, `src/i18n/messages/vi.json`, `en.json`,
`src/server/actions.ts`, `src/server/repo/prisma-repo.ts`, `src/server/queries.ts`, `src/server/project-queries.ts`.

- Trước khi sửa: đọc file phiên bên kia — nếu bên kia đang giữ file đó thì KHÔNG sửa, ghi chú lại và làm việc khác.
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
- Bên còn lại: trước khi bắt đầu task mới, `git merge main` vào nhánh mình và chạy `npx prisma migrate deploy`
  (nếu có migration mới) + `npm test`.
- Không `git push --force`, không xoá nhánh của bên kia.

## 6. Khi hết limit / chuyển giao

- Hết limit: không cần làm gì thêm nếu đã tuân mục 2. Khi limit reset, mở lại đúng thư mục, gõ "tiếp tục".
- Bên kia rảnh muốn làm hộ: ghi `CHUYỂN GIAO: A→B lúc <giờ>` vào file phiên của bên bị hết limit **và** của mình,
  rồi mới mở thư mục đó. Chỉ 1 phiên hoạt động trong 1 thư mục tại một thời điểm.

## 7. Kỹ thuật

- Next.js 14 app router + Prisma 6 + PostgreSQL (localhost:5433) + next-intl (vi/en) + Vitest.
- Cổng kiểm: `npx tsc --noEmit`, `npm test`. `npm run build` trên máy này lỗi tải Google Font do mạng
  (SELF_SIGNED_CERT) — dùng `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` trỏ tới file mock (xem
  `D:\_project\DDC_dieu-phoi\tools\font-mock.js`) chỉ để kiểm compile.
- Script PowerShell 5.1 trong `~/.claude` phải thuần ASCII.
- Tài liệu design cho phase redesign: `docs/design/apple-reference/`; Gantt mẫu: `docs/design/gantt-mau-cau-truc.png`.
