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

## Vòng sửa theo security-reviewer (T-1..T-4, `.bangiao/bao-mat.md`)

Chủ dự án chốt 2026-09-27: vá cả T-1, T-2, T-3 (nguyên tử + an toàn đồng thời) và T-4 (giữ trọng số của giai đoạn ngừng dùng). Không cần migration (không thêm cột/bảng nào).

**Cách vá T-1/T-2/T-3 (`src/server/repo/prisma-repo-entry.ts` - `saveStage`, `setStageActive`):**
- Gộp TOÀN BỘ thân 2 hàm (đọc kiểm trùng tên/giới hạn 30/đếm dự án đang dùng/đếm giai đoạn cuối cùng, ghi, audit) vào 1 `prisma.$transaction`, câu lệnh đầu tiên trong transaction là khoá advisory `SELECT pg_advisory_xact_lock(hashtext('dim_stage'))`.
- Lý do chọn advisory lock thay vì Serializable + thử lại hoặc unique index: (1) đúng khuôn đã có sẵn trong repo cho tình huống y hệt - trùng mã dự án khi tạo (`prisma-repo.ts:1083`, `pg_advisory_xact_lock(hashtext(lower(...)))`) - không phát minh cách mới; (2) khoá advisory là mutex thật của Postgres, độc lập với MVCC, nên không cần vòng lặp bắt lỗi serialization và thử lại như Serializable; (3) không cần migration (không thêm unique index), giảm rủi ro trên DB `_c` đang có dữ liệu thật; (4) 2 hàm dùng CHUNG 1 tên khoá `'dim_stage'` nên mọi thao tác ghi giai đoạn (tạo, sửa, ngừng/dùng lại) từ nhiều admin bị tuần tự hoá với nhau, đóng cả khe hở giữa các hàm (vd 1 admin đang tạo giai đoạn thứ 30 trong khi admin khác cũng tạo).
- T-2 (audit tách rời update): giờ `stage.update` và `audit(...)` là 2 lệnh trong CÙNG 1 transaction - audit lỗi thì rollback cả update, không còn dữ liệu đổi mà thiếu dấu vết.
- T-3 (TOCTOU ngừng dùng): đếm "còn dự án đang dùng", đếm "còn giai đoạn khác đang dùng" (last_active), `stage.update` và audit đều trong CÙNG transaction có khoá - 2 admin ngừng dùng 2 giai đoạn cuối cùng cùng lúc thì người thứ 2 luôn thấy kết quả của người thứ 1 (không còn 2 request cùng đọc "còn giai đoạn khác" rồi cùng ghi).
- Repo mock (`mock-repo-entry.ts`): mock chạy đồng bộ, không có `await` xen giữa các bước đọc/ghi nên đã tự nguyên tử theo đúng nghĩa (JS đơn luồng) - không cần thêm khoá, chỉ thêm comment giải thích để khớp hành vi bản Prisma (yêu cầu "giữ repo mock hành vi tương đương").

**Cách vá T-4 (giữ trọng số của giai đoạn ngừng dùng):**
- `replaceStageWeights` (`prisma-repo-form.ts` và bản mock `mock-repo-form.ts`): trước đây xoá TOÀN BỘ dòng trọng số của dự án rồi chỉ tạo lại đúng các dòng gửi lên (form chỉ gửi giai đoạn đang dùng) - dòng của giai đoạn đã ngừng dùng bị xoá vĩnh viễn. Nay CHỈ xoá đúng các mã có trong `rows` gửi lên (Prisma: `deleteMany({ where: { projectId, stageCode: { in: rows.map(r => r.stageCode) } } })`; mock: lọc theo cùng tập mã) - dòng của giai đoạn không nằm trong `rows` (đang ngừng dùng) được giữ nguyên.
- `setStageActive(code, true, ...)` (dùng lại giai đoạn, cả Prisma lẫn mock): thêm bước chèn lại dòng trọng số 0% áp dụng cho MỌI dự án đã có ít nhất 1 dòng trọng số nhưng còn thiếu dòng của mã này, y hệt logic lúc tạo giai đoạn mới (K10), dùng `skipDuplicates: true` nên dự án đã có dòng (kể cả dòng vừa được T-4 giữ lại) không bị ghi đè. Xử lý đúng câu hỏi "giai đoạn chưa từng có dòng cho một dự án mà dự án đó đã có dòng trọng số khác" -> chèn dòng 0% giống lúc tạo mới.
- Đã rà các chỗ khác có thể xoá/ghi đè dòng trọng số: `createProject` (Prisma lẫn mock) không tự tạo dòng trọng số nào (chỉ gọi `replaceStageWeights` cho dự án mới, không có gì để xoá); `saveMonthlyData` không đụng bảng `project_stage_weight` (chỉ ghi `fact_value_chain_progress`) - không có nơi nào khác cần vá.

**TDD:**
- Viết ĐỎ trước: `git stash` tạm 4 file nguồn đã sửa (giữ nguyên test mới), chạy `prisma-repo-entry.test.ts` + `prisma-repo-form.test.ts` + `form.test.ts` -> **11 test đỏ đúng theo T-1..T-4** (dup-check/too-many không còn ở trong transaction nên `tx` mock rỗng gây lỗi runtime; TOCTOU/T-3 tương tự; `replaceStageWeights` xoá cả dòng `settlement` không nằm trong `rows`). `git stash pop` khôi phục bản vá, chạy lại XANH toàn bộ.
- Kiểm thêm trên DB thật `_c` (script tạm `scripts/tmp-concurrency-check.ts`, đã xoá sau khi chạy): 2 lệnh `saveStage()` cùng tên "KIEM TRA DONG THOI T1 TAM" gọi đồng thời (`Promise.all`) -> đúng 1 thành công (`custom_1`), 1 `duplicate_name`, `dim_stage` chỉ còn đúng 1 dòng tên đó. Dữ liệu tạo ra đã tự dọn trong script (xoá `project_stage_weight`, `audit_log`, `dim_stage` của mã tạm); `npm run check:read` sau đó vẫn OK.
- Không vá T-3 bằng cách deactivate thật 6/8 giai đoạn thật trên DB `_c` để dựng kịch bản "2 giai đoạn cuối cùng" (rủi ro cho dữ liệu chung), dựa vào test mock đã chứng minh: cùng 1 khoá advisory với T-1, cùng cơ chế transaction, đã RED/GREEN đầy đủ.

**Test cũ phải sửa cho khớp hành vi mới (behavior thay đổi có chủ đích, không phải regression):**
- `prisma-repo-entry.test.ts`: viết lại toàn bộ describe `saveStage / setStageActive` (trước đây dup-check/too-many/not-found/in-use test bằng mock top-level `prisma.stage.*`, giờ mọi thứ chạy qua `tx` do `transactionMock` cấp - thêm helper `makeTx()` dùng chung). Bỏ 2 mock top-level `stageFindMany`/`stageFindUnique`/`stageCount`/`stageUpdate`/`pswCount` không còn được gọi trực tiếp.
- `prisma-repo-form.test.ts`: `deleteMany` giờ có thêm điều kiện `stageCode: { in: [...] }` thay vì chỉ `{ projectId }`.
- `form.test.ts` (mock): test "thay toàn bộ 7 dòng" đổi thành 8 dòng (thêm `settlement`, khớp 8 giai đoạn hiện có, nếu không giai đoạn `settlement` có sẵn của dự án 1 sẽ được GIỮ LẠI theo đúng T-4 nên tổng số dòng đọc lại thành 8 chứ không phải 7); thêm 1 test mới xác nhận rõ hành vi T-4 (mã không gửi lên được giữ nguyên).

**Cổng kiểm:**
- `npx tsc --noEmit` sạch.
- `npm test` **215 file / 2502 test XANH** (mốc trước vòng sửa 215/2497; +5 test ròng: thêm test T-1/T-2/T-3/T-4 mock+prisma, bớt/gộp 1 vài test cũ theo hành vi mới).
- `npm run check:read` OK trên DB `_c` (đã dọn dữ liệu tạm dùng để kiểm T-1 thật).
- `npx playwright test e2e/12-chuoi-gia-tri.spec.ts` trên 3003: **7/7 XANH** (3 setup đăng nhập + 4 kịch bản chuỗi giá trị/quản trị giai đoạn).

**Chỗ Tester nên soi kỹ:**
- 2 admin bấm "Thêm" giai đoạn gần như cùng lúc (nhất là khi form đã điền sẵn tên giống nhau, ví dụ đều để mặc định rồi gõ nhanh) - chỉ 1 tạo được, người còn lại nhận `stageAdmin.err.duplicate_name` thay vì lỗi 500.
- Ngừng dùng 1 giai đoạn, dùng lại, rồi lưu trọng số dự án nhiều lần xen kẽ - dòng trọng số của giai đoạn đó không được biến mất kể cả khi form không hiển thị nó lúc đang ngừng dùng.
- Dự án được tạo TRONG LÚC 1 giai đoạn đang ngừng dùng (nên không có dòng trọng số cho giai đoạn đó) - sau này admin dùng lại giai đoạn, dự án đó phải có dòng 0% mới, không lỗi khi tính %TT.
- Không còn migration mới trong vòng sửa này (`prisma/schema.prisma` không đổi).
