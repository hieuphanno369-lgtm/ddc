# P3C-B — Chart T1/T2/T4/T5: thay đổi cho Tester

## Mốc đầu phase
`npx tsc --noEmit` sạch. `npm test` = **140 file / 1605 test xanh** (trước khi có bất kỳ sửa đổi nào của P3C-B).

## Bước đã làm

### Bước 1 — Kiểu tạm hợp đồng P3C + test chống lệch
- `src/lib/p3c-contract.ts` (mới): chép nguyên văn 4 interface hợp đồng (`EquipmentPlanSegment`,
  `EquipmentQuota`, `ManpowerPlanMonthRow`, `ShiftRatio`) từ
  `D:\_project\DDC_dieu-phoi\hop-dong-du-lieu-P3C.md`.
- `src/lib/p3c-contract.test.ts` (mới): `fieldsOf()` đọc mã nguồn dạng chữ, so khớp trường của
  `p3c-contract.ts` với `src/server/repo/types.ts` (file của A). Hiện A chưa merge P3C-A nên
  `types.ts` chưa có 4 kiểu này — test 2 ("khớp trường với types.ts") bỏ qua từng tên khi
  `fieldsOf(typesSrc, name) === null`. **Tester nên soi:** sau khi A merge P3C-A, chạy lại
  `npx vitest run src/lib/p3c-contract.test.ts` — nếu FAIL nghĩa là A đổi tên/kiểu trường khác
  hợp đồng, báo điều phối chứ không tự sửa.

_(các bước tiếp theo sẽ bổ sung tại đây)_

## Việc chờ / treo
- Bước 9–10: chờ A nhả `vi.json`/`en.json` (khoá bởi P3A vòng sửa 1, xem `phien-A.md`).
- Bước 11: TREO, chờ A merge P3C-A vào `main`.
