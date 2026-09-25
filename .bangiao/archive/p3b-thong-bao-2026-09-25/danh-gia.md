PHAN QUYET: CHOT

# Đánh giá cuối P3B — thông báo webhook/email, e2e Playwright, N-3 chặn số tiền, Q6 quyền xem tiền từng người

> Nội dung do subagent reviewer (vai chỉ đọc) trả về; điều phối viên lưu vào file này.

Nhánh `feature/p3b-thong-bao`. Phạm vi `git diff d50db4c..HEAD`: 29 commit, 86 file, +7316/-124, commit cuối `8285857`. Skill `ddc-tower:code-review`; `git merge-tree` chỉ mô phỏng.

## Cổng kiểm (reviewer tự chạy, PowerShell)
- `npx tsc --noEmit` sạch; `npm test` **139 file / 1603 test xanh** (tester 1602 + 1 ca L-8 ở `8285857`).
- e2e: tin vòng 2 của tester 21/21 xanh + kiểm sống T-1/T-2/T-5.
- `git diff d50db4c..HEAD -- prisma/` rỗng — **không migration**.

## 1. Khớp kế hoạch — Có
- Task 1–9 có commit; Q6 bước riêng (`de6a344`); vòng sửa 1 (11 commit) + L-8/L-12 (`8285857`).
- Q1 nodemailer (lên `^10.0.10` + `overrides` do T-4, có ghi lý do); Q2 `@playwright/test@1.63.0` khớp `chromium-1243`; Q3 `isBlockedSmtpIp` (`email.ts:38-54`); Q4 `noticeFromAlert` thay message tiền bằng `ruleTriggered`; Q5 SPI/CPI/%/tấn vẫn hiện; Q6 `resolveAccess()` đọc cột DB, admin luôn true, UI `UserEditor.tsx`, audit, test; Q7 không đụng `DataEntryForm`/`nhap-lieu`; Q8 `.env.example` có `NOTIFY_*`, `E2E_*` không giá trị thật.
- **T-1 phương án tạm** (data-entry luôn `canViewFinance=true`): `auth.ts:41-54` (`alwaysOn`), `actions-user-finance.ts:29-33` (`DataEntryLocked`), `setUserRole` (`prisma-repo.ts:634-648`, `mock-repo.ts:423-437`) ép true; UI `UserEditor.tsx:133-137` chỉ badge. Đã ghi cho A (`phien-B.md` "LƯU Ý CHO A (2)", `thay-doi.md` Vòng sửa 1).
- Lệch có lý do, chấp nhận: sửa `prisma-repo.ts` (A đã ghi "không còn đang mở") để vá T-2 thay `actions.ts`; sửa `auth.ts` (Q6, T-5); thêm key lẻ vào nhóm `admin`/`activity` ngoài 2 nhóm mới cuối file.

## 2. Test — Có giá trị thật
- N-3 kiểm props client (`overview-finance-gate`, `projects-detail-finance-gate`, `finance-gate-pages`), Excel mở file thật (`export-finance-gate`); viewer không gọi `repo.getFinancial`. e2e 08 theo `innerText` + 403 → N-3 export do unit test đảm bảo — chấp nhận.
- Notify tiêm `lookup`/`request`/`createTransport` giả: kiểm không gọi `request` khi IP bị chặn, không theo 3xx, timeout, chống trùng khi claim 2 lần, retry dừng ở lần 3, gửi lại chỉ kênh lỗi, bí mật không vào `notifyError`/audit/kết quả.
- T-2/T-5: `qa-p3b-independent.test.ts` từng đỏ có chủ đích rồi xanh; `auth-access-recheck.test.ts` 7 ca; tester kiểm sống 2 BrowserContext.
- e2e 21 ca luồng thật cổng 3001; `global-setup` chặn cứng DB/cổng khác B rồi seed lại; chạy lặp được.

## 3. Bảo mật / hiệu năng / đúng đắn
- Bảo mật vòng 2 ĐẠT; reviewer rà `8285857`: L-8 escape thêm `\` và `` ` ~ # > `` (Teams), L-12 chỉ đặt `servername` khi host không là IP — đúng.
- Dispatch không chặn luồng lưu (`queueAlertNotifications` không await, chuỗi promise, `.catch`); `runDueJobs` gọi `void` (`layout.tsx:21`).
- Retry tối đa 3 lần/7 ngày/lô 50; alert chưa từng xếp hàng không gửi bù. Chống trùng `claimAlertNotify` có điều kiện; kênh OK ghi trong `notifyChannel`, bỏ qua khi thử lại (K5/K6).
- Webhook/SMTP resolve 1 lần, ghim IP, timeout cả lookup, `res.destroy()`.
- T-5 hiệu năng (L-11) chấp nhận cho merge: sau 5 phút đầu mỗi `getCurrentUser()` 2 truy vấn theo khoá chính `user_roles` (cookie không ghi lại trong RSC, không `SessionProvider`), ~2–4 lần/trang, vài ms với quy mô nội bộ.

## CAN SUA (chặn merge)
Không có.

## Để sau (không chặn merge)
1. **L-7** xoay khoá `NOTIFY_SECRET_KEY` (`v1:kid:` hoặc `NOTIFY_SECRET_KEY_OLD`).
2. **L-9** `secret-box.ts:85` hint `${hostname}/…` lộ token ở subdomain → che nhãn đầu khi ≥3 nhãn.
3. **L-10** (cần `actions.ts` của A) `setUserRoleAction` (`actions.ts:281` trên B, `:289` trên nhánh A) không truyền `changedBy` → audit `canViewFinance` ghi `'system'` → truyền `user.email` tham số thứ 4, làm khi A nhả `actions.ts`.
4. **L-11** `auth.ts:156-177`: (a) bọc `getCurrentUser` (`session.ts:15`) bằng React `cache()` hoặc dựng quyền từ `account`; (b) `resolveAccess` lỗi DB đang fallback `ROLE_SEED` → fail-closed; (c) middleware đọc `token.role` cũ tới 8h (chỉ chuyển hướng sai).
5. **Gỡ T-1** khi A gate xong `DataEntryForm`/`nhap-lieu` **và** `ho-so-du-an` (trang mới P3A, có `contractValue`) theo `canViewFinance`: gỡ ép true ở `auth.ts:41`, `actions-user-finance.ts:29-33`, `UserEditor.tsx:133-137`, `setUserRole` (`prisma-repo.ts:643` / `mock-repo.ts:432`) + sửa test. **Chủ dự án nên xác nhận T-1 phương án b** (thu hẹp Q6 với data-entry; do điều phối chọn).
6. Tài liệu lỗi thời — **ĐÃ SỬA khi archive** (điều phối): `thay-doi.md` "Lưu ý cho A" số 1 và docstring `actions-user-finance.ts:12` nay ghi đúng cơ chế T-5. Reviewer đã tự rà: mọi chỗ còn hiển thị tiền trong `app/` đều có gate.
7. Teredo `2001::/32` chưa trong blocklist; lên cloud thêm `fd00:ec2::254`, `100.100.100.200` vào blocklist SMTP.
8. Biến Windows User-level `NEXTAUTH_URL=http://localhost:3000` đè `.env` B → link thông báo local trỏ cổng 3000 (hạ tầng, chủ dự án xử lý).
9. N-1 (nâng Next ≥ 15.5.24) vẫn chặn go-live, không thuộc P3B.

## Checklist merge P3A↔P3B
Mô phỏng `git merge-tree HEAD feature/p3a-form-tao-sua` (A @ `e6a9807`, gốc chung `cfc1945`): 11 file trùng, git tự merge 5; **7 file xung đột**:
1. **`.bangiao/{ke-hoach,thay-doi,ket-qua-test,danh-gia-bao-mat}.md`** (add/add) → mỗi nhánh archive hồ sơ vào `.bangiao/archive/<phase>-2026-09-25/` trước khi merge `main` (gồm `danh-gia.md`, `anh-test/`); gốc `.bangiao/` trên `main` trống.
2. **`src/i18n/messages/vi.json`, `en.json`** 2 chỗ: (a) nhóm `activity` cả hai cùng nối sau `"save_key_milestones"` (dòng 593 trên B) → giữ key cả 2, sửa dấu phẩy; (b) cuối file sau `alertClose`: B `financeGate`, `notifyAdmin` (827+), A nhóm P3A → giữ đủ. Nhóm `admin` (`canViewFinanceOn/Off/Always`) tự merge. Xong khi `src/i18n/messages.test.ts` xanh + JSON hợp lệ.
3. **`src/server/repo/mock-repo.ts`** `export const repo` (B dòng 963-967) → `Object.assign({ ...coreRepo, ...makeEntryMockRepo({ getData, persist }), ...makeFormMockRepo({ getData, persist }) }, createReadMock(getData), makeNotifyMockRepo({ getData, persist }))`; giữ import `makeFormMockRepo` + `makeNotifyMockRepo, resetNotifyMock`; giữ `resetNotifyMock()` trong `reset()`.
4. **`src/server/repo/prisma-repo.ts`** tự merge (A dòng cuối `...formPrismaRepo`, B `setUserRole` dòng 634) → kiểm tay `setUserRole` còn bản T-2 của B; `repo/index.ts:11` vẫn `Object.assign(prismaRepo, readRepoPrisma, notifyRepoPrisma)` trên repo đã gồm `formPrismaRepo`.
5. **`app/[locale]/(app)/projects/[id]/page.tsx`** tự merge (A link `/ho-so-du-an`, B gate N-3) → kiểm còn cả link mới lẫn toàn bộ gate `canViewFinance`.
6. Ngữ nghĩa: `createAccountAction` của A (`actions.ts:346`, `canViewFinance: role !== 'viewer'`) khớp T-1/T-2; `ho-so-du-an/page.tsx` + `ProjectForm.tsx` của A hiện `contractValue` cho admin/data-entry — chưa lộ nhờ T-1, phải gate trước khi gỡ T-1.
7. Sau merge (bên merge sau): `npx prisma migrate deploy` (chỉ A có migration); `tsc` sạch; `npm test` xanh, số test ≥ tổng không trùng (B 139/1603, A 149/1652); `npm run test:e2e` cổng 3001 (e2e 04/05 chạm `nhap-lieu` P3A đã đổi; 03 có link `keyMs.edit`); chạy lại `qa-p3b-independent.test.ts`, `auth-access-recheck.test.ts`; `PROGRESS.md` + `.serena/memories/` chỉ trong lượt merge `main`.
8. Không push khi chủ dự án chưa bảo; không `--force`.

## Kết luận
CHỐT. Merge `main` theo quy-trinh.md mục 2; bên merge sau làm checklist trên.
