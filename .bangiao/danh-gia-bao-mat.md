PHAN QUYET BAO MAT: DAT

Phạm vi: 4 trang nghiệp vụ (report/alerts/compliance/audit) + sửa `closeAlertAction` + export route mới. Skill: `security-review`. Kết luận: giữ đúng RBAC server-side, không lỗ hổng cao/nghiêm trọng trong phạm vi. React auto-escape (0 `dangerouslySetInnerHTML`), Prisma parameterized, ExcelJS ghi string cell (không formula injection).

--- ĐÃ KIỂM ĐẠT ---
1. **closeAlertAction** (`actions.ts:325-335`): admin đóng mọi alert; bod đóng mọi alert (fallback `requireRole(['bod'])` — đúng chốt BOD=Trưởng phòng); data-entry chỉ alert dự án mình PIC; viewer Forbidden. Không leo quyền sang hành động khác.
2. **Export route mới** (`app/api/report/export/route.ts`): auth admin+bod (403 cho role khác), không input người dùng, ExcelJS string cell (không formula injection).
3. **4 page mới**: guard role TRƯỚC khi fetch (report/alerts/compliance=admin+bod; audit=admin), redirect login/homeForRole. Không leak cho role thấp.
4. **AlertList**: nút Đóng chỉ khi canClose (admin+bod); action gọi server `closeAlertAction` re-check role server-side.

--- LOW (nhỏ, nên vá nhưng không chặn) ---
- LOW-1: `closeAlertAction` không zod-validate `alertId`/`action` (chuỗi rác/dài → rác DB). Vá: `{ alertId: z.number().int().positive(), action: z.string().max(200) }`.
- LOW-2: không guard alert tồn tại → `alertId` rác gây `prisma.alertLog.update` ném P2025 → 500. Vá: `if (!alert) return { ok:false, error:'Not found' }`.
- LOW-3: export route mới thiếu rate-limit (route cũ `/api/export` có `rateLimit`). Vá: `rateLimit('report-export:'+email, 30, 60_000)`.
- LOW-4: `repo.getUserRoles()` trả cả `passwordHash` (compliance chỉ dùng name/email). Least-privilege: thêm method hẹp.

--- HIGH PRE-EXISTING (ngoài phạm vi, cần vá gấp) ---
- `app/api/export/route.ts:10` có TODO "thiếu auth check" — route cũ export toàn bộ dự án (gồm `contractValue` tài chính) KHÔNG cần login. Route mới `/api/report/export` đã đúng chuẩn; route cũ phải fix (thêm auth).
- `middleware.ts` DENY-list chưa thêm route mới (defense-in-depth; page guard đã chặn đủ, không phải lỗ hổng).
