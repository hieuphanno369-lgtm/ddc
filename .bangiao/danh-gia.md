PHAN QUYET: CAN SUA

# Đánh giá cuối P2B — Biểu đồ & hiệu năng (nhánh `feature/p2b-bieu-do`, diff `10cda5a..HEAD`) — vòng 1

> Nội dung do subagent reviewer (vai chỉ đọc) trả về; điều phối viên lưu nguyên văn phần chính vào file này.

Skill đã dùng: `ddc-tower:code-review`.

## Cổng kiểm (reviewer tự chạy lại)
- `npx tsc --noEmit`: sạch. `npm test`: 95 file, **1088/1088 xanh**.
- `git diff 10cda5a..HEAD --stat -- prisma src/server/actions.ts src/server/repo/prisma-repo.ts app/globals.css src/server/project-queries.ts PROGRESS.md .serena`: **trống**. Bước 11 treo đúng.

## Tóm tắt
- Khớp kế hoạch và Q2–Q6; T14 lệch Q1 ở dòng chú thích (mục 2).
- Refactor `queries.ts` đúng ngữ nghĩa (test `queries-independent.test.ts` so giá trị với code gốc `10cda5a`).
- i18n: 2 nhóm mới `manpowerCharts`, `equipmentGantt` ở cuối file — đúng luật. Giữ `detail.manpowerTrend` chấp nhận được.
- Bảo mật: ĐẠT; L-1/L-2/L-3 không chặn merge nhưng vá L-1/L-2 trước lần `perf:seed` kế tiếp.
- Kết luận "1635 ms là cold-start": CHƯA THUYẾT PHỤC — không có đối chứng; `loadSpiCpiTrend`/`loadPortfolioSCurve` không theo tháng nên các request sau không phải cache-miss toàn phần; bench `month='all'` median 1789 ms / max 2384 ms (> 1500) chưa giải thích, EXPLAIN 3 câu chỉ 4–18 ms nên không phải chỗ chậm.

## CẦN SỬA TRƯỚC MERGE

1. **Chart tuần làm mất số liệu của nhà thầu đã tắt** — `src/server/manpower-queries.ts:48-51`.
   - `repo.getContractors()` chỉ trả nhà thầu `isActive: true` (`prisma-repo.ts:281-283`) → nhà thầu có số liệu cũ rồi bị tắt không có cột chồng, nhưng `actualAvg`/tooltip "Tổng TT" vẫn tính họ → chart tự mâu thuẫn.
   - Sửa: dựng `contractors` từ các `contractorId` có trong `totalActual`; tên lấy từ `getContractors()`, không có thì `#<id>` (như `manpower-charts.ts:49`); sort theo tổng actual giảm dần.
   - Xong khi: test trong `manpower-queries.test.ts` (spy `getContractors` trả thiếu 1 nhà thầu có dòng) ra `{ id, name: '#<id>' }`; tsc sạch, test xanh.

2. **Dòng chú thích Gantt đếm thiếu, lệch Q1** — `src/server/equipment-gantt-queries.ts:16`.
   - `readEquipmentUsageDays(projectId, minStart, maxFinish)` chỉ đọc trong khoảng plan → ngày dùng trước plan đầu/sau plan cuối bị bỏ, không vào `unplannedUsage`.
   - Sửa: đọc usage trên toàn bộ ngày của dự án (không cắt theo plan); `buildGantt` giữ nguyên, trục vẫn dựng từ plan.
   - Xong khi: test có 1 ngày dùng trước `minStart` → `unplannedUsage` tăng đúng N; trục `from/to` không đổi; tsc sạch, test xanh.

3. **Kết luận hiệu năng T1 khẳng định quá bằng chứng** — `.bangiao/hieu-nang.md` mục 4 (dòng 95–121), mục 6 (dòng 183–195); `.bangiao/thay-doi.md` "Lệch kế hoạch" số 3 (dòng 79–85). Chỉ sửa câu chữ, không sửa code:
   - (a) bỏ khẳng định "T1 đạt ở steady state"; ghi: "1/12 request vượt 1500 ms; cold-start là giả thuyết chưa kiểm chứng; bench `month='all'` median 1789 ms / max 2384 ms chưa rõ nút cổ chai";
   - (b) nêu cache `loadSpiCpiTrend`/`loadPortfolioSCurve` (không theo tháng) làm request sau không còn cache-miss toàn phần;
   - (c) quy trình đo lại có kiểm soát cho Bước 11: restart → gọi 1 URL làm nóng không thuộc overview → đo `overview?month=all` trước tiên → các tháng; đo riêng từng hàm nhánh `all` trong `perf:bench`.
   - Xong khi: `hieu-nang.md` không còn câu "tiêu chí nghiệm thu T1 đạt"; có mục "Chưa kết luận, chờ đo lại ở Bước 11" kèm quy trình (c).

4. **[YÊU CẦU CHỦ DỰ ÁN 2026-09-24, thêm vào vòng sửa] Thẻ "Chuỗi giá trị" trang Chi tiết dự án theo mock-up** —
   `app/[locale]/(app)/projects/[id]/page.tsx` (khối g2 "Value chain + EVM"); mock-up tham chiếu: `mockup-apple-glass.html`
   dòng 701-707 (`.stagegrid`, `.chainfoot` CSS dòng ~351) và `mockup-project-detail-v2.html` dòng 450-454.
   Lỗi hiện tại (ảnh chủ dự án gửi): thẻ ghép đôi với EVM nên hẹp; cột phải (Shop Drawing/Gia công/Lắp dựng) bị che mất
   thanh + %; ở Vật tư/Vận chuyển chữ "24.407/26.822 tấn" (P1B/T13) đẩy mất thanh tiến độ.
   Chủ dự án đã chốt:
   - (a) **Bỏ hẳn thẻ "Chỉ số EVM"**; Chuỗi giá trị thành thẻ **rộng hết hàng** (D-6), lưới 2 cột 7 giai đoạn như mock-up:
     tên · chip trọng số % · thanh · % HT (1 chữ số thập phân, dạng vi `100,0%`). Thanh luôn hiện đủ, không bị che ở mọi
     độ rộng (kiểm cả màn hẹp/điện thoại: xuống 1 cột).
   - (b) Số tấn TT/KH (T13) → **dòng chữ nhỏ màu xám ngay dưới thanh** của giai đoạn đó (Thiết kế/Nghiệm thu không có thì
     không hiện dòng).
   - (c) **Dòng chân tổng** (D-5): trái "Σ trọng số **X%** · %TT = Σ(trọng số × %HT giai đoạn)", phải = % tổng
     (vd 53,5%). X = tổng trọng số thật từ `project_stage_weight` (không ghi cứng 100; nếu ≠ 100 thì tô cảnh báo).
     %TT tính từ trọng số × %HT (giai đoạn "không áp dụng" xử lý nhất quán với `src/lib/stages.ts`), có unit test.
   - (d) Chip góc: **giữ cả hai** — chip "Toàn bộ 7 giai đoạn" (đổi thành tên giai đoạn đang chọn khi bấm chọn ở thẻ
     "Timeline của 7 giai đoạn" — nối với state chọn giai đoạn của `StageExplorer` nếu làm được mà không viết lại lớn;
     nếu không thì ghi rõ lý do trong thay-doi.md) + chip đỏ "Khâu nghẽn: …" cạnh bên; thanh giai đoạn nghẽn tô cam như mock-up.
   - Kiểm: phân quyền không đổi (bỏ EVM không làm lộ gì thêm); test render trang dự án cập nhật; i18n key mới trong nhóm
     riêng (vd `valueChainCard`); CSS mới ưu tiên file riêng, nếu phải sửa `app/globals.css` (file nóng) thì kiểm
     phien-A.md + ghi "Đang giữ". Chụp ảnh trước/sau vào `.bangiao/anh-test/`.

## Để sau (không chặn merge)

**Checklist merge P2A ↔ P2B** (khi `git merge main` sau khi P2A vào `main`):
- `src/server/audit-log-page.ts` chắc chắn conflict: A thêm `note: a.note` vào phần map mà B đã chuyển sang `read-prisma.ts:166-175` (`readAuditLogPage`) → đưa `note` vào `readAuditLogPage` (+ `read-mock.ts`).
- `src/server/repo/mock-repo.ts` cuối file: A đổi thành `const coreRepo = {…}` + `export const repo = { ...coreRepo, ...makeEntryMockRepo(...) }`; B thêm `Object.assign(repo, createReadMock(getData))` → giữ dòng của B sau dòng export của A.
- `vi.json`/`en.json`: giữ đủ 4 nhóm `contractorJoin`, `dailyEntry`, `manpowerCharts`, `equipmentGantt`.
- Schema P2A thêm bảng/cột → `docs.test.ts`, `erd-doc.test.ts` sẽ đỏ: bổ sung `TABLE_DOCS`/`ERD_LAYOUT` trong `src/lib/schema-meta/docs.ts`, chạy `npm run docs:erd`; sửa mô tả `docs.ts:105` (`'afternoon'` → A đổi sang `evening`).
- Sau merge: `prisma migrate deploy` + `generate` + `npm test` + `npm run check:read`, so KPI/donut/S-curve `/vi/overview` bằng mắt.

**Bảo mật script dev** (vá trước lần `perf:seed` kế tiếp): L-1 host loopback + `PERF_CONFIRM`; L-2 `AND "createdBy"='perf-seed'`; L-3 `PERF_BASE` chỉ localhost.

**Việc nhỏ khác:** tooltip "Tổng TT" (`WeeklyManpowerStackChart.tsx:142`) nên hiện `w.actualAvg`; dọn `detail.manpowerTrend` sau khi P2A merge; `/overview` gọi `getProjectSummaries` 6–8 lần/lượt render → cân nhắc `React.cache()` nếu đo lại cần; ghi chú có từ trước N-1/N-2/N-3 + thiếu key `admin.delete` chờ chủ dự án.

## Kết luận
Code P2B tốt. Sửa xong 3 mục, tsc sạch, test xanh thì CHỐT; merge `main` chờ chủ dự án đồng ý, kèm checklist merge ở trên.
