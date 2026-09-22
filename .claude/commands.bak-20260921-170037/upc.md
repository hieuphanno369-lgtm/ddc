---
description: Cập nhật tiến độ dự án hiện tại vào PROGRESS.md + memory
argument-hint: "[ghi chú ngắn — optional]"
---

Cập nhật trạng thái dự án hiện tại vào 2 file. Làm tuần tự, ngắn gọn.

Ghi chú từ user (nếu có): $ARGUMENTS

## 1. Khảo sát ngữ cảnh
- Đọc `PROGRESS.md` (root) nếu tồn tại.
- Đọc `C:\Users\hieupt1\.claude\projects\D---project-DDC-Control-Tower\memory\MEMORY.md` + `ddc-control-tower-project.md`.
- Nhìn trạng thái: file thay đổi gần đây, lỗi đang dở, deferred (xem `README.md` mục "Deferred" + `MASTER_PROMPT_DDC_Dashboard.md` mục 10 "Phase 2").

## 2. Ghi `PROGRESS.md` (root repo)
Overwrite, giữ cấu trúc cố định:
```
## Giai đoạn hiện tại
## Đã xong
## Đang sửa / lỗi tồn đọng
## Next step
> Cập nhật: <ngày hôm nay>
```
Gạch đầu dòng, tóm tắt. Không chép code.

## 3. Ghi memory
- Viết/update file `ddc-progress.md` trong
  `C:\Users\hieupt1\.claude\projects\D---project-DDC-Control-Tower\memory\`
  frontmatter: `name: ddc-progress`, `description`, `metadata.type: project`.
  Nội dung: giai đoạn + đã xong + đang sửa + next step (ngắn). Link `[[ddc-control-tower-project]]`.
- Update `MEMORY.md`: thêm/sửa 1 dòng index `- [DDC progress](ddc-progress.md) — <hook>`.

## 4. Báo lại
1 dòng: đã cập nhật gì vào 2 file.
