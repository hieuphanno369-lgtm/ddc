PHAN QUYET: CAN SUA

# Đánh giá P3F (reviewer chặng cuối)

Nhánh `feature/p3f-dang-nhap-moi`, diff `2171d61..9195b03`, worktree C.
Skill: `ddc-tower:code-review`.
Đầu vào: `.bangiao/ke-hoach.md`, `thay-doi.md`, `ket-qua-test.md`, `bao-mat.md` (vòng 2 DAT), lệnh gốc `lenh-cho-B-2026-09-28-dang-nhap.md` (5 quyết định P3F-3, CHỐT thiết kế 2026-09-29) và các quyết định chủ dự án sau vòng bảo mật.

## Cổng kiểm reviewer tự chạy

- `npx tsc --noEmit`: exit 0.
- `npm test`: 257 file đạt, 2 skip; 2988 test đạt, 27 skip; exit 0.
- DB `ddc_control_tower_c` (chỉ đọc): migration `20260929023746_p3f_dang_ky_phong_ban` và `20260929120000_p3f_dang_ky_bo_mat_khau` đã áp, `rolled_back_at` null.
- `signup_request` còn 7 cột, không còn `passwordHash`.
- Không chạy lại e2e. Theo coder: 178/178 ở `431b1be`, e2e 28 và 29 được 26/26 sau `9195b03` (chưa có hồ sơ tester).

## 1. Code có khớp kế hoạch và quyết định chủ dự án không

Có.

- 7 task đúng phạm vi.
- Q1-Q6 theo phương án Đề xuất.
- 5 quyết định P3F-3 được giữ: đuôi email kiểm ở server, phòng ban admin tự quản và ẩn ô khi danh mục trống, nhắc admin trong app, từ chối không gửi mail, trang điều khoản công khai.
- Các quyết định sau vòng bảo mật đều đã làm:
  - Form Đăng ký bỏ ô mật khẩu (`SignupForm.tsx`, migration bỏ cột).
  - Bật tài khoản thì gửi link đặt mật khẩu 72 giờ (`actions-signup-admin.ts:29-43`, `SIGNUP_INVITE_TTL_MS`).
  - Thiếu SMTP hoặc `NEXTAUTH_URL` thì tắt form (`dang-ky/page.tsx:18-30`), chặn cả action (`actions-signup.ts:27`) và chặn cả nút bật (`actions-signup-admin.ts:61-63`).
  - Đăng ký chờ quá 14 ngày bị xoá (`jobs.ts`, `pruneStale`).
- K14 trong kế hoạch ("thiếu SMTP vẫn bật") đã được thay đúng bằng quyết định mới.
- Không thấy lan phạm vi. 3 sửa giao diện ngoài kế hoạch (ActivityViewer, UserEditor, RateReminder) nhỏ, có lý do pixel-perfect và đã ghi trong `thay-doi.md`.
- `app/globals.css` chỉ bị xoá lớp cũ, đúng kế hoạch.
- Style kính mờ bám mock-up đã chốt, không redesign ngoài phạm vi.

## 2. Test có giá trị thật không

Có.

- `src/server/signup-moi-dat-mat-khau.test.ts` kiểm hành vi thật:
  - Sau khi bật, mọi mật khẩu đoán đều bị `authorize` từ chối.
  - Link chỉ gửi tới email đăng ký.
  - Đặt qua link rồi mới đăng nhập được, link dùng lại thì hỏng.
  - Biên 72 giờ trước và sau.
  - Thiếu SMTP hoặc `NEXTAUTH_URL` thì không tạo tài khoản và đăng ký vẫn còn.
  - Link hết hạn thì "Quên mật khẩu" vẫn lấy được link mới.
- Test T2 và T3 được viết đỏ trước khi sửa.
- e2e 28 bước 6 thay token bằng token tự sinh vì không đọc được hộp thư. Chấp nhận được, định dạng link đã có test đơn vị bao.
- Timeout Playwright (`expect.timeout` 15s, `setTimeout` ở e2e 12, 23, 28 bước 10, chờ 20s ở e2e 20): hợp lý trên máy chạy 3 dev server. Test rớt đổi chỗ giữa các lần chạy, chạy riêng đều xanh, và không chỗ nào bị giảm bớt phép kiểm.
- Theo dõi sau P3F (không chặn):
  - e2e 07 (admin) chưa rõ gốc. Trang admin nay nặng hơn, nên chạy riêng 07 lặp nhiều lần để loại trừ.
  - `e2e/helpers/login.ts` chờ `networkidle` đang che một điểm UX có từ trước: bấm gửi trước khi hydrate thì form nạp lại và mất chữ đã gõ. Không lộ mật khẩu vì ô không có `name`.

## 3. Bảo mật, hiệu năng, tính đúng đắn

- Bảo mật: đồng ý với `bao-mat.md` vòng 2. T2 và T3 đã vá đúng ở `9195b03`:
  - Regex `src/lib/signup-policy.ts:16`, chuẩn hoá NFC và gộp khoảng trắng Zs dùng ở cả form lẫn server.
  - `sendInvite` chạy trước `logActivity`, lỗi nhật ký chỉ ghi log.
- T1: đồng ý để lại.
  - Không ai chiếm được tài khoản, email mới hơn vẫn dùng được, trang link hỏng có nút xin link mới.
  - Sửa gốc phải thêm cột `purpose` kèm migration, không đáng so với rủi ro.
  - Ghi thành giới hạn đã biết.
- Hiệu năng:
  - Layout chỉ thêm 1 `count` cho admin.
  - Trang admin thêm 2 truy vấn nhỏ.
  - Không có N+1.
- Đúng đắn:
  - `approveRequest` xoá rồi tạo trong 1 giao dịch, 2 admin bật cùng lúc thì chỉ 1 người thắng.
  - `deleteDepartment` bắt P2003.
  - `pruneAuthData` dọn theo hạn dùng nên không huỷ lời mời còn hạn.
- Migration và rollback:
  - Migration 1 tạo `passwordHash`, migration 2 xoá. Giữ cả hai là trung thực với lịch sử DB `_c`, không cần gộp.
  - Rollback của từng migration nằm trong giao dịch và xoá dấu vết `_prisma_migrations`. Muốn quay lui cả hai thì chạy file 2 trước rồi file 1.
  - Rollback 2 xoá đăng ký chờ trước khi thêm lại cột `NOT NULL`, đúng.
- `docs/DATA_WAREHOUSE_README.md` khớp schema: có `dim_department`, `signup_request`, `user_roles.departmentId`, 2 quan hệ mới, không còn `passwordHash`.
- i18n:
  - vi và en đủ key như nhau, không lệch.
  - Nhóm mới `authPage`, `signup`, `terms`, `department` nằm cuối file. Key activity mới nằm cuối nhóm `activity`.
  - `passwordPlaceholder` và `passwordTooLong` của form đăng ký đã xoá.
  - Rà từng key của 4 nhóm mới: đều được dùng. Key động `authPage.stage*` và `authPage.strength*` được `GanttArt` và `PasswordStrength` dùng.

## Cần sửa trước khi CHỐT

1. `.bangiao/ket-qua-test.md` (cả file)
   - Lý do: còn là bản "lần 3", ghi trước vòng sửa S1. Thiếu kết quả sau `592f136`, `431b1be` và `9195b03`, nên hồ sơ archive không phản ánh bản sẽ merge.
   - Cách sửa: thêm mục "Vòng sửa bảo mật" với số liệu thật: `npm test`, e2e toàn bộ, e2e 28 và 29, các bước còn skip và lý do.
2. `src/lib/schema-meta/docs.ts:507` và `:512`
   - Lý do: mô tả `password_reset_token` ghi "hết hạn 30 phút". Nay token lời mời sống 72 giờ và có `requestIp` rỗng. Mô tả này hiện trên `/data-dictionary` và `/data-schema`, nên người dùng đang thấy sai.
   - Cách sửa: ghi "30 phút (quên mật khẩu) hoặc 72 giờ (lời mời khi admin bật đăng ký)", thêm ghi chú `requestIp` rỗng với lời mời, và ghi việc dọn theo `expiresAt`/`usedAt`. Chạy `npm run docs:erd` để chắc README không lệch.
3. `src/server/signup.ts:32`
   - Lý do: comment "Phần còn lại sau khi băm mật khẩu" sai sau S1, form không còn mật khẩu.
   - Cách sửa: đổi thành "Phần còn lại sau khi đặt chỗ throttle".

## Câu hỏi nghiệp vụ cho chủ dự án

1. **Duyệt nội dung `/dieu-khoan` trước khi merge** (quyết định 5, bắt buộc).
   Điền `[LIÊN HỆ]` ở `vi.json:1341` và `en.json:1341`; bản en nên dùng chữ tiếng Anh.
2. **Nhãn "Chưa đặt mật khẩu" cho tài khoản vừa bật.**
   - (a) Để như hiện tại. **Đề xuất**: cột "Lần đăng nhập cuối" trống đã báo hiệu người dùng chưa vào, không phải đổi schema.
   - (b) Thêm nhãn. Muốn phân biệt đúng với tài khoản admin tạo tay thì phải thêm cột đánh dấu, tức là thêm migration.
   - (c) Để sau, kèm nút "Gửi lại link" cho admin.
3. **Nút "Tiếp tục với Google" trên trang Đăng ký.**
   Người chưa có tài khoản bấm vào sẽ bị từ chối, vì Google không tự tạo tài khoản, nên dễ hiểu nhầm.
   - (a) Giữ theo mock-up.
   - (b) Bỏ nút này khỏi trang Đăng ký, giữ ở trang Đăng nhập. **Đề xuất**.
4. **Tiêu đề email và trang khi mở link lời mời**, không gấp.
   Hiện dùng chữ "Đặt lại mật khẩu". Có đổi thành "Đặt mật khẩu" cho người mới không?

## Trước khi merge

- Chuyển các file hồ sơ vào `.bangiao/archive/p3f-dang-nhap-moi-2026-09-29/`.
- `.bangiao/anh-p3f/` (chưa commit) để ngoài commit.
- Ghi T1 và theo dõi e2e 07 vào lộ trình.

## Sau đánh giá (C ghi, không phải phán quyết của reviewer)

- Cần sửa 1: `.bangiao/ket-qua-test.md` đã thêm mục "Vòng sửa bảo mật và sau reviewer" với số liệu thật (e2e toàn bộ 178/178 trên `d7ed919`).
- Cần sửa 2 và 3: đã sửa ở `b6c6ecc`.
- Câu hỏi nghiệp vụ, chủ dự án chốt 2026-09-29: (1) liên hệ `/dieu-khoan` là `hieupt1@daidung.vn` (`a600dfb`); (2) không thêm nhãn "chưa đặt mật khẩu"; (3) bỏ nút Google ở trang Đăng ký (`d7ed919`); (4) link lời mời dùng chữ "Đặt mật khẩu" (`d7ed919`).
- Reviewer chưa chạy lại vòng 2 sau các sửa trên; chủ dự án đồng ý merge `main`.
- Giới hạn đã biết: T1 (Quên mật khẩu huỷ link lời mời còn hạn); theo dõi e2e 07.
