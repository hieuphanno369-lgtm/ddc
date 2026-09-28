PHAN QUYET: CAN SUA

# P3E - Đánh giá cuối lượt kiểm trước một phần (Task 1-4)

Người đánh giá: reviewer (chỉ đọc), skill `ddc-tower:code-review`; điều phối viên ghi lại.
Kết luận: **CHƯA CHỐT** cho phạm vi Task 1-4.
Code đúng kế hoạch, đúng các quyết định chủ dự án, test có giá trị thật, bảo mật vòng 4 ĐẠT.
Chưa chốt vì hồ sơ bàn giao cho Task 5-8 còn thiếu và còn mâu thuẫn: `ke-hoach.md` mục Task 5-7 chưa có G3-G7, R6, R7 phần 3, nên người làm Task 5 ở phiên sau rất dễ bỏ sót.
Mọi việc phải sửa đều nằm trong tài liệu và chú thích hợp đồng, không phải sửa logic code.
Sửa xong thì không cần security-reviewer rà lại; reviewer chỉ cần đối chiếu lại danh sách dưới đây là chốt được.

## 1. Cổng kiểm reviewer tự chạy

- `npx tsc --noEmit`: exit 0, không lỗi.
- `npm test`: 218 file / 2434 test xanh, exit 0.
- Không chạy lại build và e2e; theo `ket-qua-test.md`, tester đã chạy build qua và e2e 56/56 trên các spec 01, 03, 04, 07, 09, 20.
- `git status` sạch, nhánh `feature/p3e-dang-nhap`, 22 commit so với `main`.

## 2. Code có khớp kế hoạch không

- Task 1 (D4): khớp. `runJob` chỉ còn `alerts_daily`, cron `rates_monthly` trả 404, không còn `fetch` ra VCB, `fxRates.hint` đúng nguyên văn Q7.
- Lệch có ghi nhận: `app/[locale]/(app)/admin/page.tsx:107` vẫn đọc `getRecentJobRuns('rates_monthly')`, `JobName` (`src/server/repo/types.ts:479`) chưa thu hẹp, vì C đang giữ `admin/page.tsx`. Chỉ đọc nên vô hại; Task 8.1 sẽ bắt được.
- Task 2 (D5): khớp. Route, action, component ảnh đã gỡ; `no-photo-feature.test.ts` khoá hồi quy; bảng `project_photos` và `projectPhoto.deleteMany` trong seed vẫn giữ tới Task 5.
- Task 3 (D1): khớp Q3=a, Q4=a, K14, K15.
- Task 4: khớp luật `checkCredentials` và `requestPasswordReset` đã sửa qua 4 vòng bảo mật (L1-L8, R1-R7, N1-N4, G2).
- Quyết định L7=(b), L2, R4=(a), L1=(b) của chủ dự án đều thể hiện đúng trong code.

## 3. Test có giá trị thật không

Có.
Test gọi thẳng `authorize()` thật của next-auth và callback `signIn`/`jwt` thật, không mock lại logic.
Các test bảo mật đều được xác nhận đỏ trước khi sửa.
Giới hạn cần biết: mọi test đồng thời chạy trên kho bộ nhớ nên chưa chứng minh tính nguyên tử trên Postgres; bằng chứng thật thuộc Task 5.

## 4. Bảo mật, hiệu năng, tính đúng đắn

- Không thấy lỗi đúng đắn hay lỗ hổng mới trong Task 1-4. Code mới chưa nối vào đăng nhập thật.
- Hiệu năng: `verifyPassword` là bcrypt đồng bộ, chặn event loop khoảng 50-100 ms mỗi lượt; có từ trước, ghi để Task 6 cân nhắc.
- Gọn code (không chặn): cờ `ipSlotReleased` và closure `releaseIpSlot` ở `src/server/login-guard.ts:70-75` thừa.

## 5. Việc phải sửa (CAN SUA)

### 5.1 [chặn chốt] `ke-hoach.md` mục Task 5 thiếu hợp đồng throttle và ghi chú G3

- File: `.bangiao/ke-hoach.md:552-566`.
- Thêm vào Interfaces của Task 5: `prismaAuthStore.reserveThrottle` chạy trong `prisma.$transaction(async (tx) => ...)`, mọi câu gọi qua `tx`, mở đầu bằng `tx.$executeRaw` với `pg_advisory_xact_lock(hashtext(kind || ':' || key))`, đếm `createdAt >= sinceIso`, `create` và trả `id`.
- `releaseThrottle(id)`: `deleteMany({ where: { id } })` (không dùng `delete` vì ném P2025 khi dòng đã bị prune).
- Bước 5.5 thêm test DB thật: 30 lời gọi song song limit 20 ra đúng 20 id; 2 dòng trùng `createdAt` chỉ xoá 1; `consumeResetToken` `ok: false` khi tài khoản tắt hoặc chỉ Google (L5); `resetFailedLogin` `false` khi đã khoá (L3); 5 `registerFailedLogin` song song cho `justLocked` đúng 1 lần.

### 5.2 [chặn chốt] R7 phần 3 và G4 chưa có bước nào trong kế hoạch

- Task 5 thêm `'google_denied'` vào `ThrottleKind` và hằng giới hạn trong `login-policy.ts` (planner đề xuất ngưỡng kèm lý do).
- Task 6 bước 6.3: `reserveThrottle('google_denied', ...)` trước `logActivity`, hết chỗ thì vẫn `return false` nhưng không ghi log; kèm test.
- Sửa comment "R7 (chưa làm, để Task 5)" ở `src/lib/auth.ts` bỏ gợi ý dùng `login_fail_unknown_email`.

### 5.3 [chặn chốt] G5 và R6 chưa vào kế hoạch Task 5-7

- Bước 6.2: bọc `checkCredentials` trong try/catch, chỉ ném lại `Error('locked')`, `Error('ip_limited')`; lỗi khác `console.error` với `e.name`/mã lỗi rồi trả `null`; test "store ném lỗi thì `authorize` trả `null`, không lộ message".
- Task 7: `requestPasswordResetAction`, `submitPasswordResetAction` bọc lỗi thành phản hồi chung, có test.
- R6: Task 5 thêm `src/server/password-reset.ts` vào danh sách Modify để đổi `e.message` (dòng 158) sang `e.name`/`code`.

### 5.4 [chặn chốt] Khối Interfaces Task 4 lỗi thời

- `.bangiao/ke-hoach.md:291`, `:320-338`: `resetFailedLogin` ghi `Promise<void>` trái code (`Promise<boolean>`), thiếu `reserveThrottle`/`releaseThrottle`.
- Cập nhật theo `src/server/repo/types.ts:600-673` hoặc thay bằng "nguồn sự thật là `types.ts`".

### 5.5 [nên sửa ngay] JSDoc hợp đồng `AuthStore` trong `types.ts`

- `registerFailedLogin`: phải nguyên tử (`increment`, khoá bằng điều kiện `lockedAt IS NULL`), `justLocked` đúng 1 lời gọi dù song song; đã khoá thì vẫn tăng nhưng `justLocked=false`.
- `reserveThrottle`: cửa sổ `createdAt >= sinceIso` (tính cả biên).
- `pruneAuthData`: thêm JSDoc (xoá throttle và token có `createdAt < beforeIso`, token bất kể đã dùng).
- Ghi rõ ai chuẩn hoá email.
- Chuyển khối JSDoc R1 lơ lửng (`:582-587`) lên trên `ThrottleKind`.

### 5.6 [nên sửa ngay] Chữ cũ mâu thuẫn trong `ke-hoach.md`

- `:88` K13: thêm "(ĐÃ THAY bởi L2)".
- `:444` bước 4.2: mô tả test `client-ip` theo hành vi hiện tại (`TRUSTED_PROXY_HOPS` từ phải, không có thì `'unknown'`).
- `:626` bước 6.10: kiểm `activity_log.ip` khác `'unknown'` và `/api/health` trả `clientIpResolved: true`.
- `:697` bước 8.4: giới hạn đã biết đổi thành (K6, K12, G1, khoá chung `'unknown'` của R4, L1 phương án b).

### 5.7 [nên sửa ngay] `thay-doi.md` mâu thuẫn và thiếu mục

- `:95`, `:97`: ghi chú "đã thay ở vòng sửa bảo mật 1-2".
- `:221`, `:224` (R2): ghi "đã thay bởi N2".
- `:304`, `:337`: đúng sau khi làm 5.1; sửa "cho C làm sau" thành tài khoản A làm Task 5 sau khi C nhả khoá.
- Thêm mục "Vòng 4": quyết định L1=(b), test L2 `c1a6c48`, cổng kiểm 218/2434.

## 6. Có nên merge `main` ở trạng thái Task 1-4 không

Khuyến nghị: được merge sau khi sửa xong mục 5 và reviewer chốt, nhưng phải có chủ dự án đồng ý rõ ràng, vì `CLAUDE.md` mục 5 quy định merge khi xong 1 phase.
An toàn khi merge: `main` không vỡ; đăng nhập mật khẩu thật chưa dùng code mới (không phải hồi quy); phần đăng nhập đã đổi đều chặt hơn; hạ tầng Task 4 chưa được gọi; bảng `project_photos` còn nguyên, không có migration.
Nên merge sớm vì nhánh đang sửa file nóng `vi.json`, `en.json`, `actions.ts`, `prisma-repo.ts`, để lâu xung đột với B và C càng lớn.
Điều kiện trước khi merge: chạy `npm run test:e2e:a` toàn bộ; build với font mock; chuyển hồ sơ vào `.bangiao/archive/p3e-phan1-2026-09-28/` rồi sau merge chép lại `ke-hoach.md` về nhánh P3E; ghi `ĐANG MERGE main` vào `phien-A.md`.

## 7. Việc còn treo (không thuộc Task 1-4, đã có chủ)

- Task 5: schema, migration xoá `project_photos`, kho Prisma, `getAuthStore`, prune trong `alerts_daily`, kiểm concurrency thật.
- Task 6: nối `checkCredentials` vào `authorize`, `lockedAt` thật cho Google, trang quản trị mở khoá, dọn `rates_monthly` ở `admin/page.tsx`.
- Task 7: trang quên và đặt lại mật khẩu, `pwdAt`, key `mailSubject`/`mailBody`.
- Lượt bảo mật sau Task 5-8 phải kiểm lại S1, S2, S4-S6 trên Prisma, S8, S11, S12, S15, e2e 21 và 22.
