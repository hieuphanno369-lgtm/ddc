# P3E - Đăng nhập an toàn + gọn app: tóm tắt thay đổi

> Ghi theo Task, coder cập nhật sau mỗi commit. Tester/reviewer/security-reviewer đọc file này trước khi soi code.

## Task 1: D4 - Tỷ giá chỉ nhập tay (`6139f72`)

Xem chi tiết đầy đủ trong nội dung commit `6139f72` (không có mục riêng trong file này lúc commit).
Tóm tắt: xoá `src/lib/vcb-rates.ts(.test)`, `src/server/fx-rates.ts(.test)`, nút "Lấy ngay"; `runJob` chỉ còn nhánh `alerts_daily`; cron `rates_monthly` trả 404; i18n `fxRates.hint` đổi theo Q7.

**Lệch kế hoạch:** `app/[locale]/(app)/admin/page.tsx` do tài khoản C giữ (Task 9 của C) nên CHƯA thu hẹp `JobName` xuống chỉ `'alerts_daily'` tại nơi gọi từ trang admin, và `ExchangeRateEditorProps.lastRun` còn giữ (tuỳ chọn, không dùng ở UI) để tương thích cho tới khi C nhả khoá. Sẽ dọn khi C nhả.

---

## Task 2: D5 - Gỡ code ảnh hiện trường (giữ bảng) (`b6056a0`)

**File đã xoá:** `app/api/photo-upload/route.ts`, `app/api/photos/[...path]/route.ts`, `src/lib/uploads.ts(.test)`, `src/lib/photo-upload.ts(.test)`, `src/server/photo-service.ts`, `src/server/photo-upload-route.test.ts`, `src/server/photo-route.test.ts`, `src/server/repo/photo.test.ts`, `src/components/form/PhotoDropzone.tsx`.

**File đã sửa (gỡ phần liên quan ảnh, giữ phần khác nguyên vẹn):**
- `src/server/actions.ts`: xoá `addPhotoAction`, `deletePhotoAction` + import liên quan.
- `src/server/actions.test.ts`: xoá 2 describe test ảnh, giữ describe `saveMonthlyData`.
- `src/server/validation.ts`/`validation.test.ts`: xoá `PHOTO_MAX_BYTES`, `photoFileSchema`, `addPhotoSchema`, `deletePhotoSchema` và test tương ứng.
- `src/server/repo/prisma-repo.ts`, `src/server/repo/mock-repo.ts`: xoá `getPhotos`, `getPhotoById`, `addPhoto`, `deletePhoto`; `mock-repo.ts` bỏ luôn dòng lọc `d.photos` khi xoá dự án.
- `src/server/repo/types.ts`: xoá `interface ProjectPhoto`.
- `src/data/seed/history.ts`: xoá `buildPhotos`, field `photos` khỏi `RepoData` và chỗ gán.
- `prisma/seed.ts`: xoá đoạn `createMany` ảnh; GIỮ `await prisma.projectPhoto.deleteMany();` và `'project_photos'` trong `syncSequences` (bảng DB còn tới Task 5, đúng kế hoạch).
- `src/components/form/DataEntryForm.tsx`: bỏ bước wizard `'extras'` (`DataEntryStep` chỉ còn `'progress' | 'finance' | 'profile' | 'resources'`), bỏ prop `photos`, hàm `removePhoto`, import `PhotoDropzone`/`ProjectPhoto`/`deletePhotoAction`/`IconProject` (không còn nơi dùng trong file này).
- `app/[locale]/(app)/nhap-lieu/page.tsx`: bỏ `repo.getPhotos`, prop `photos`, `'extras'` khỏi `STEPS`.
- `app/[locale]/(app)/projects/[id]/page.tsx`: bỏ `repo.getPhotos(id)` trong `Promise.all`, biến `photos`, thẻ Card "Photos"; `IconProject` vẫn còn dùng ở 2 chỗ khác trong file nên giữ import.
- `src/server/api-routes-guard.test.ts`: bỏ 2 dòng đăng ký `photo-upload/route.ts`, `photos/[...path]/route.ts`.
- `e2e/09-chan-chua-dang-nhap.spec.ts`: bỏ 2 dòng kiểm `/api/photos`, `/api/photo-upload`.
- `e2e/04-data-entry.spec.ts`: bỏ `vi('form.stepExtras')` khỏi mảng nhãn bước wizard.
- `scripts/perf/bench-data.ts`: bỏ `repo.getPhotos(projectId)` khỏi benchmark.
- `src/i18n/messages/vi.json`, `en.json`: xoá `detail.photos`, `form.tabPhotos`, `form.stepExtras`, `form.photoUploadError`, `form.confirmDeletePhoto`, cả object `dataGuard.photo`. GIỮ `activity.add_photo`, `activity.delete_photo` (nhật ký cũ 14 ngày còn 2 action này).
- Đã xoá thư mục `data/uploads` (không nằm trong git, chỉ dọn máy cục bộ).

**File mới:** `src/server/no-photo-feature.test.ts` (test khoá hồi quy) - viết SAU khi một phần việc gỡ code đã làm dở từ phiên trước (đã đối chiếu phần gỡ dở đó khớp đúng danh sách kế hoạch trước khi viết test và làm tiếp), nên không phải RED-GREEN thuần theo đúng trình tự chuẩn; đã xác nhận test đỏ đúng 2/3 case trước khi gỡ nốt phần còn lại, rồi xanh cả 3 sau khi gỡ xong.

**Cổng kiểm:**
- `npx tsc --noEmit`: sạch (phải xoá `.next/` cũ trước vì file type sinh tự động còn trỏ tới 2 route API đã xoá).
- `npm test`: 204 file / 2293 test xanh (mốc trước Task 1 = 208/2388; giảm đúng 4: xoá 5 file test ảnh, thêm 1 file `no-photo-feature.test.ts`).
- `npm run build` (font mock): qua, danh sách route không còn `photo-upload`/`photos/[...path]`.
- `npm run test:e2e:a -- e2e/03-project-detail.spec.ts e2e/04-data-entry.spec.ts e2e/09-chan-chua-dang-nhap.spec.ts`: 46/46 xanh.

**Chỗ Tester/Reviewer nên soi kỹ:**
- `DataEntryForm.tsx` xoá 1 bước wizard (`extras`) - kiểm điều hướng Tiếp/Lùi giữa các bước còn lại không lệch, link cũ `?step=extras` phải rơi về bước mặc định (STEPS.includes đã lọc ở `nhap-lieu/page.tsx`).
- `GET /api/photos/x` giờ phải trả 404 (route không còn tồn tại) thay vì hành vi cũ; đã có test e2e 09 xác nhận không còn 2 route này trong danh sách API tự chặn.
- Bảng `project_photos` trong DB VẪN CÒN (không đụng schema), chỉ gỡ code truy cập - dữ liệu ảnh cũ (nếu có) không hiển thị ở đâu nữa nhưng chưa mất, dự kiến xoá bảng ở Task 5.
- Nhật ký hoạt động cũ (trong 14 ngày) có thể còn dòng action `add_photo`/`delete_photo` - key i18n 2 dòng này vẫn giữ nguyên, không lỗi hiển thị.
