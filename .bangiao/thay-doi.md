# P7-C2 - Thay đổi (coder ghi dần theo task)

## Task 7: Gỡ hằng giai đoạn cứng, bỏ chữ "7 giai đoạn"

- Xoá `STAGE_ORDER`, `STAGE_CALC_MODE`, `calcStageContributions` + `StageContribution` (`src/lib/stages.ts`), `VALUE_CHAIN_COLUMNS` (`value-chain-view.ts`), `stageKey` (`labels.ts`), re-export `STAGE_ORDER` ở `src/data/seed/erp.ts`.
- Tham số `order`/`weights` của `findCurrentStage`, `calcChainPctActual`, `chainFooterSummary`, `stage-timeline`, `evm` thành bắt buộc (không còn mặc định cứng).
- `src/server/actions.ts`: `stagesOrder` luôn là mảng (rỗng khi không có chain) để khớp `order` bắt buộc; hành vi không đổi.
- i18n: xoá nhóm `stage`; bỏ số "7" ở `form.stageSection`, `projectForm.steps.s5`, `projectForm.sec.weights.title`, `projectForm.help.projectType` (vi + en).
- Comment có "7 giai đoạn"/tên hằng cũ đã sửa (kể cả 1 dòng comment trong `app/globals.css`).
- Test gỡ: 5 test gắn với hằng đã xoá (3 test `calcStageContributions` trong `stages.test.ts`, 2 test `VALUE_CHAIN_COLUMNS` trong `value-chain-view.test.ts`); 4 test khác đổi tên cho khớp `order` truyền vào (1 ở `stages.test.ts`, 1 ở `value-chain-view.test.ts`, 2 ở `stage-timeline.test.ts`).
- Test mới: `src/lib/stages-nguon-dong.test.ts` (2 test tĩnh), chạy ĐỎ trước khi gỡ xong (7 file còn nhắc hằng cũ), sau đó XANH.
- Test dùng 7 mã cũ chuyển sang hằng cục bộ `LEGACY7_STAGE_CODES = SEED_STAGE_CODES.slice(0, 7)`.
- Kết quả: `npx tsc --noEmit` sạch; `npm test` 211 file / 2451 test XANH (trước Task 7: 210 / 2454).

## Task 8: Màn quản trị giai đoạn (CHƯA gắn vào trang /admin)

- Chủ dự án chọn (2026-09-27): A đang giữ mọi page `app/**` để nâng Next, nên Task 8 làm mọi phần không đụng page. Còn lại: chèn Card `StageEditor` vào `app/[locale]/(app)/admin/page.tsx` ngay sau Card `factoryAdmin` + e2e kịch bản 2-3, làm sau khi A merge Nâng Next vào `main`.
- `validation.ts`: `stageSchema` + kiểu `StageInputAdmin`.
- Repo (mock + Prisma): `saveStage`, `setStageActive`. Tạo mới trong 1 transaction: `dim_stage` mã `custom_<n>`, trọng số 0% áp dụng, audit `create`.
- `actions-master.ts`: `saveStageAction`, `setStageActiveAction` (chỉ admin, `Forbidden` trước khi parse), ghi activity `save_stage`/`activate_stage`/`deactivate_stage`, làm mới `profileTag` + `overviewTag`/`listTag` mọi tháng lịch sử.
- `src/components/admin/StageEditor.tsx` (khuôn `FactoryEditor`, không thêm CSS, chú thích dùng class `hintline` có sẵn).
- i18n: nhóm `stageAdmin` cuối file, 3 key `activity.*` cuối nhóm `activity` (vi + en). `messages.test.ts` thêm `StageEditor`.

Lệch so với kế hoạch (kỹ thuật):
- `setStageActive` trả `{ status: 'in_use', count }` thay cho chuỗi `'in_use'`, để action lấy được số dự án kèm thông báo (kế hoạch yêu cầu hiện số dự án nhưng chữ ký repo chưa mang số).
- Chèn trọng số 0% chỉ cho dự án ĐÃ có dòng trọng số (kế hoạch ghi "mọi dự án"). Lý do: dự án chưa có dòng nào đang dùng bộ mặc định qua `getStageWeights`; chèn 1 dòng lẻ sẽ làm mất bộ mặc định và %TT về 0. Trên DB `_c` cả 17/17 dự án đều có dòng nên kết quả như kế hoạch.
- Sửa gốc lỗi test rò trạng thái: `buildRepoData` (`src/data/seed/history.ts`) dùng chung mảng `stages`/`factories` của module seed, nên `repo.reset()` không khôi phục được sau khi admin sửa. Nay sao chép từng phần tử khi dựng dữ liệu.

Kiểm:
- Test ĐỎ trước khi code: 19 test (action 9, repo mock 5, repo Prisma 5) + `StageEditor.test.ts` không nạp được.
- Sau khi code: `npx tsc --noEmit` sạch; `npm test` 212 file / 2475 test XANH.
- Chạy thật repo Prisma trên DB `_c` (script tạm, đã dọn): tạo `custom_1` chèn 17/17 dòng trọng số 0%; trùng tên " kiểm THỬ c " bị chặn; sửa tên/bên/thứ tự/cách tính OK; ngừng dùng `fabrication` trả `in_use` 17 dự án; ngừng dùng rồi dùng lại `custom_1` OK. Sau đó xoá giai đoạn thử, trọng số và audit thử, còn 8 giai đoạn.

## Task 8 (phần còn lại) + Task 9, sau khi A merge Nâng Next

- `git merge main` (Next 15.5.26 @ `7b6603e`) = `3c6c06c`, không xung đột; trang Chi tiết giữ cả `ProjectDetailChartsLazy` của A lẫn cột giai đoạn của Task 6. `npm install`, xoá `.next`.
- `app/[locale]/(app)/admin/page.tsx`: Card `stageAdmin.title` (icon `IconChecklist`) ngay sau Card `factoryAdmin`, truyền `await repo.getStages()` (cả giai đoạn ngừng dùng).
- `src/server/admin-notify-page.test.ts`: thêm mock `StageEditor` như các editor khác (test render trang admin đỏ vì `useRouter` khi thiếu mock).
- `e2e/12-chuoi-gia-tri.spec.ts`: thêm kịch bản 2 (thêm giai đoạn bên trái, thấy cuối cột trái + dòng 0% ở bảng trọng số, ngừng dùng thì ẩn khỏi thẻ) và 3 (ngừng dùng "Gia công" bị chặn `in_use`). Chạy ĐỎ trước khi gắn Card (không tìm thấy thẻ), sau đó XANH. Thẻ chọn theo đúng tiêu đề `h3` vì thẻ Nhật ký hoạt động cũng có chữ "giai đoạn chuỗi giá trị".
- Task 9: mô tả `dim_stage` trong `schema-meta/docs.ts` đã có từ Task 2; `npm run docs:erd` không sinh khác biệt.

Sửa giao diện (soi ảnh 1440 và 390):
- `StageEditor`: bỏ giới hạn chiều cao 420px (dòng Thêm bị giấu, phải cuộn mới thấy); bảng `minWidth: 920` + ô Thứ tự rộng 72px để màn 390 cuộn ngang thay vì ép ô còn vài pixel.
- `FactoryEditor` (lỗi có sẵn): cột Vùng ở 390 bị ép còn khoảng 30px; thêm `minWidth: 760` cho bảng.
- `app/globals.css` `.stage .stagesub` (lỗi có sẵn): ở 390 chữ "tấn" rớt xuống dòng riêng; cho dòng phụ trải từ cột thanh tới hết cột % và không ngắt dòng. Ở 1440 không đổi.

Môi trường (không phải lỗi code): Next 15 dev chỉ chờ tải Google Font 3 giây; lần chạy đầu sau khi xoá `.next` bị quá giờ, webpack cache giữ luôn kết quả font dự phòng nên spec `10-ten-app` đỏ 2 test (chữ EN xuống 2 dòng). Xoá `.next`, bật lại với `NODE_EXTRA_CA_CERTS` thì Inter tải được và giữ trong cache. Khuyến nghị cho A/B: sau khi xoá `.next`, mở 1 trang và kiểm CSS có `src: url(...woff2)` trước khi chạy e2e.

Kiểm:
- `npx tsc --noEmit` sạch; `npm test` 212 file / 2487 test XANH; `npm run check:read` OK.
- e2e toàn bộ 83/83 XANH trên 3003 (sau khi sửa CSS chạy lại lần nữa, vẫn 83/83).
- Ảnh: `.bangiao/anh-task9/` (`project1-1440/390`, `project1-chuoi-1440/390`, `admin-giai-doan-1440/390`, `admin-khu-vuc-390`), chụp với font Inter thật.
