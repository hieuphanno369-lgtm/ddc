# PROGRESS — DDC Control Tower

## Giai đoạn hiện tại
**Redesign giao diện "Apple Glass" (nhánh `feature/apple-glass-redesign`, tạo từ `main` sau khi Run 1 merge) — ĐANG CHẠY (bắt đầu 2026-09-23).** Run 1 — ERP data model v2 đã CHỐT + merge vào `main` (local, chưa push). Phase 2 Part B: Postgres local (5433) + swap mock→Prisma HOÀN TẤT. 4 trang nghiệp vụ mới + vá bảo mật P1-P6 (2026-09-20).

### ✅ Redesign Apple Glass — CHỐT kỹ thuật + ĐÃ MERGE vào `main` (2026-09-23)
Coder 12/12 Task + mọi vòng vá đã xong. Dây chuyền ship 6 agent (planner→coder→tester→debugger→
security-reviewer→reviewer) đã CHỐT ở reviewer VÒNG 3 (vòng review chốt, sau 2 vòng CAN SUA đã dùng
hết 2/2). Commit code cuối trước merge: `1e34b26` (B-1..B-5). Chuỗi vá: `0c77fdd` CS-1/CS-2 →
`9941505` CS-3 motion → `1e34b26` B-1..B-5. Test 548/548, `tsc` sạch, `npm run build` sạch.

1. ✅ **reviewer VÒNG 3 = CHỐT** (2026-09-23, tự chạy lại tsc/test 548/548/build sạch ở `1e34b26`,
   ghi trong `.bangiao/danh-gia.md`). Dây chuyền ship redesign HOÀN TẤT về kỹ thuật.
2. ✅ **Dọn file + merge XONG** (release-manager, 2026-09-23, chủ dự án chốt trực tiếp "merge trước,
   làm phần mock-up còn thiếu sau"): che mật khẩu seed trong `.bangiao/` + `PROGRESS.md`, xoá
   `.bangiao/_test.md` (file rác), merge `feature/apple-glass-redesign` → `main` fast-forward —
   **local, CHƯA push**. `main` hiện ở HEAD `1ee7d9d`. `tsc` sạch + 548/548 test xanh xác nhận lại
   sau merge. Nhánh `feature/apple-glass-redesign` vẫn còn (trỏ cùng commit), chưa xoá.
3. **App CHƯA giống mock-up 100% — dù plan 12 Task đã xong** (đối chiếu class mock-up dòng 591-1135
   với code, 2026-09-23). Phần mock-up có mà app chưa có, trang Chi tiết dự án:
   - `.cdpanel` "Còn lại đến ngày HT kế hoạch" (đếm ngược) + `.tl` "Timeline kế hoạch vs thực tế"
     (vạch "Hôm nay") — mock-up dòng 636-663. Bị loại theo **Q8 mặc định (a)**, chủ dự án chưa từng
     trả lời Q8. Plan dòng 2033 đã ghi sẵn cách làm nếu chọn (b)/(c), dữ liệu có sẵn, không cần query mới.
   - 3 tag "Trọng tâm" (%TT, SPI, CPI) — app chỉ 1 tag theo **Q7 mặc định** (gắn ở SPI qua
     `hero heroTagLabel={t('kpi.focusTag')}`, `app/[locale]/(app)/projects/[id]/page.tsx:134`; %TT/CPI không có).
   - **Khối "Tracking huy động theo tuần — 7 ngày gần nhất"** (3 tab: Nhật ký theo ngày / Ma trận nhân
     lực / Theo thiết bị, mock-up dòng 770-787) — app không có UI. **Cập nhật quan trọng (2026-09-23):**
     data model đã CÓ SẴN từ Run 1 — `FactDailyManpower` (projectId/contractorId/workDate/
     plannedHeadcount/actualHeadcount) + `FactDailyEquipmentUsage` (+equipmentId/qtyPlanned/qtyActual,
     đúng quan hệ nhiều-nhiều nhà thầu×thiết bị theo ngày) + `ProjectContractor`, xem `prisma/schema.prisma`
     dòng ~560-624. KHÔNG cần vòng data-model riêng như đánh giá lúc trước — chỉ thiếu query + component
     UI 3 tab. Vẫn nên qua 1 vòng planner (thiết kế UI/API cho tính năng mới, không phải sửa CSS).
   - Cố ý khác, đã chốt: Q1 logo đỏ, Q5 không HUD FPS, Q6 quả cầu đứng yên.

   **ĐÃ CHỐT (2026-09-23): làm CẢ 3 phần trên**, cộng thêm 2 phát hiện mới khi chủ dự án yêu cầu rà
   soát rộng hơn (so `app/[locale]/(app)/projects/[id]/page.tsx` với mock-up dòng 621-788, và
   `src/components/form/CreateProjectForm.tsx` với mock-up dòng 866-1123, 2026-09-23):
   - **"Các mốc chính của dự án" (Key Milestones) chưa có UI ở đâu cả** — thiếu cả biểu đồ
     `kmChart`/`msChart` ("Timeline của 7 giai đoạn") ở Chi tiết dự án, LẪN bước 4 "Các mốc chính"
     trong form Tạo/Sửa dự án (grep `CreateProjectForm.tsx` không ra chữ "mốc"/milestone nào). Model
     `ProjectKeyMilestone` + `FactStageMilestone` cũng ĐÃ CÓ SẴN từ Run 1 (`schema.prisma` dòng
     ~504-537) — cùng dạng thiếu UI, không thiếu data, giống Tracking huy động.
   - **3 chart khác của Chi tiết dự án cũng chưa có:** "Biểu đồ so sánh theo hạng mục" (`cmpChart`,
     KH/TT theo tấn cho 1 giai đoạn) và "Nhân lực theo nhà thầu" + "Thiết bị theo nhóm" (`manChart`/
     `eqpChart` — breakdown theo nhà thầu/nhóm thiết bị, KHÁC với `ManpowerDailyChart` hiện có ở cuối
     trang vốn là biểu đồ trend theo ngày, không phải breakdown theo nhà thầu/nhóm).
   - **Chưa kiểm tra hết (làm tiếp khi resume):** đối chiếu từng field còn lại của form Tạo/Sửa dự án
     (mã gốc/mã CT tách bạch, nguyên tệ, mức ưu tiên, nhà thầu tham gia, PIC/backup, mã SAP...) với
     mock-up dòng 866-1123 — mới xem qua, chưa soát kỹ từng ô.

   **Việc thẩm mỹ tag vàng (mục 4 dưới) và lỗi avatar (mục 5 dưới) vẫn treo riêng**, không thuộc
   Đợt 2 trừ khi chủ dự án nói thêm.

   **Đợt 2 — tiến độ (2026-09-23):** nhánh `feature/apple-glass-mock-parity` (từ `main`). Planner
   XONG → `.bangiao/ke-hoach.md` (10 Task, không migration). Đã lưu hồ sơ redesign cũ vào
   `.bangiao/archive/apple-glass-redesign-2026-09-23/`. **Coder XONG cả 10/10 Task** (10 commit
   `feat(parity):` từ `8438794` đến `719b6bd`) — `tsc` sạch, **699/699 test xanh** (tăng 151 so với
   mốc 548 trước Đợt 2), `npm run build` sạch. Không lệch đáng kể so với plan. `.bangiao/thay-doi.md`
   đã có, cố ý CHƯA commit (để tester soát trước). Còn thiếu: kiểm mắt qua trình duyệt thật (sáng/tối
   + nhiều khổ màn hình) — coder không có trình duyệt, để tester tự làm.
   **Next: giao `ddc-tower:tester` cho Đợt 2**, rồi tiếp `ddc-tower:ship` (security-reviewer→
   reviewer) như bình thường. Mục "Rà soát form Tạo/Sửa dự án" trong `ke-hoach.md` (20 điểm G-1…G-20,
   nhiều điểm cần migration/luồng ghi mới) CỐ Ý để ngoài Đợt 2, chờ chủ dự án chọn hạng mục.
4. **Chủ dự án xem qua (thẩm mỹ, không chặn):** thẻ "Trọng tâm" ở `/overview` + `/report` giờ luôn
   hiện số màu VÀNG (2 trang truyền `tone="warn"` cố định) — giữ vàng, hay đổi về trắng như mock-up.
   Backlog reviewer thêm N-7: unit test `spring()`/`riseIn()` với rAF giả.
4. **Việc treo song song — lỗi avatar bị che góc phải topbar** (chủ dự án báo, có ảnh): CHƯA tái
   hiện được. Đã đo `getBoundingClientRect()` ở 1366/1518/1920/2560px, cả dev lẫn production build,
   và số đo console thật từ máy chủ dự án (`innerWidth 1518`, `devicePixelRatio ≈ 0.9` → Chrome
   zoom ~90%) — avatar luôn cách mép topbar đúng 20px, không tràn. Đang CHỜ chủ dự án: mở lại
   `npm run dev` + tab mới + Ctrl+Shift+R, xem còn bị che không. Nếu còn → xin ảnh chụp lúc TẮT
   DevTools + mức zoom Chrome, rồi mới sửa (đừng vá mù). Nếu chủ dự án muốn chống tràn phòng xa bất
   kể: hướng an toàn là cho `.search` (`app/globals.css:80`, đang `width:230px` cứng) co giãn
   (`min-width:0; flex:0 1 230px`) để nó nhường chỗ trước avatar (`AppShell.tsx:152` `shrink-0`).
5. **Lưu ý test animation:** pane trình duyệt của Claude khi bị ẩn sẽ ngừng `requestAnimationFrame`
   → thẻ KPI trông như "kẹt opacity" — đó là artefact môi trường test, KHÔNG phải lỗi (đã loại trừ).
6. **Backlog sau merge (không chặn):** modal đổi/reset mật khẩu bị giam trong sidebar
   (`SettingsMenu.tsx:234`, `UserEditor.tsx:163`) → cần `createPortal`; T-2/T-3 bảo mật; `/api/export`
   không auth (HIGH, nợ cũ). Rồi tới **Run 2** (5 REST endpoint).

### Trạng thái 12 Task (redesign) — cập nhật khi có commit `style(glass):` mới
| Task | Nội dung | Trạng thái |
|---|---|---|
| 1 | Token màu/blur/elevation + cơ chế theme + 2 test canh | XONG (`3e3cbe5`) |
| 2 | Shell (sidebar/topbar/progress bar) | XONG (`7fd7964`) |
| 3 | Card / chip / alert / skeleton + motion engine | XONG (`c3e6922`) |
| 4 | KPI + tag vàng "Trọng tâm" | XONG (`a11ac45`) — lệch nhỏ so với plan, xem `.bangiao/thay-doi.md` mục 3.1 |
| 5 | Bảng | XONG (`623f6e5`) |
| 6 | Form nền tảng + modal | XONG (`6143966`) |
| 7 | Wizard nhập liệu + import | XONG (`7e7de59`) |
| 8 | 5 editor quản trị | XONG (`a5b46aa`) |
| 9 | Recharts (màu series + tooltip kính) | XONG (`aae5f62`) |
| 10 | Tổng quan + Chi tiết dự án | XONG (`decc12c`) |
| 11 | 10 trang còn lại (gồm trang không có trong mock-up) | XONG (`aec8d86`) |
| 12 | Login + dọn sạch di sản | XONG (`4b515e1`) |

**Coder XONG cả 12/12 Task (2026-09-23).** 537/537 test xanh, `tsc` 0 lỗi.

**Tester XONG vòng 1 — KẾT LUẬN: FAIL (2026-09-23).** Xem bằng mắt qua Playwright thật, tìm ra
**2 lỗi thật do redesign gây ra** (chi tiết + bằng chứng trong `.bangiao/ket-qua-test.md`):
1. Tag vàng "Trọng tâm" đè chữ nhãn KPI ở màn hình hẹp (~360-410px, iPhone SE/12/13/14) — đo được
   chồng lấn 12.5-21.2px thật. Gốc: `.kpi .lb{padding-right:30px}` trong `app/globals.css` không
   đủ chỗ cho tag chữ (~75px), chỉ tính cho icon 26px.
2. Mất khoảng cách chữ (dính liền) ở `/vi/admin` ("Adminadmin@...") và `/vi/import` ("File Excel
   File .xlsx...") — do đổi class `.en` làm mất `margin-left` cũ. Có **test RED thật**:
   `src/components/admin/ActivityViewer.test.ts`.

`npm test`: 544/545 (1 rớt đúng lỗi #2 ở trên). 3 quan sát khác xác nhận có TỪ TRƯỚC redesign
(không phải lỗi mới, ngoài phạm vi): aria-label sai ở nút hamburger, thiếu key i18n `admin.delete`,
404 mặc định Next.js cho URL lạ (giới hạn kiến trúc, không phải bug).

**Debugger XONG vòng test-debug #1 (2026-09-23).** Cả 2 lỗi đã xác minh lại root cause bằng đo
Playwright thật (không tin sẵn chẩn đoán tester) rồi sửa tối thiểu, commit `e35a540`:
- Lỗi 1: root cause thật rộng hơn tester ban đầu tìm ra (đè tới 410px ở bản `en`, không phải chỉ
  390px) — do `.tag` neo `position:absolute` theo cạnh phải card trong khi nhãn có bề rộng cố định.
  Sửa bằng `@media(max-width:680px)` cho tag xuống dòng riêng thay vì đoán số padding.
- Lỗi 2: cách CSS `margin-left` tester gợi ý sẽ KHÔNG làm xanh được `ActivityViewer.test.ts` (test
  assert khoảng trắng thật trong chuỗi HTML) — debugger tự phát hiện, sửa bằng `{' '}` JSX tường
  minh ở đúng 2 chỗ vỡ (`ActivityViewer.tsx`, `ImportPanel.tsx`), xác nhận 2 chỗ dùng `.en` còn lại
  vẫn an toàn nhờ flex `gap`.
- `npx tsc --noEmit` sạch, **545/545 test xanh** (bao gồm `ActivityViewer.test.ts` ĐỎ→XANH).

**Đang chuyển lại tester (vòng xác nhận sau sửa)** để chạy lại toàn bộ + soi mắt xác nhận cả 2 lỗi
đã hết thật, không có hồi quy mới — resume ĐÚNG agent tester cũ `a045103b661032c7a` (không giao
tester mới, agent này đã có sẵn ngữ cảnh vòng 1). Đếm vòng test-debug: **1/2** đã dùng — quá 2 vòng
mà vẫn rớt thì dừng lại báo chủ dự án, không tự ý giao debugger sửa lần 3.

**Tester XONG vòng 2 — KẾT LUẬN: PASS (2026-09-23).** Tự đo lại độc lập bằng script/Playwright
riêng (không copy số của debugger) — cả 2 lỗi đã hết thật: hết đè chữ ở toàn dải 360-681px (cả
vi/en, cả 2 điểm biên sát ngưỡng 680px), khoảng trắng `/vi/admin` + `/vi/import` đúng 1 ký tự
`" "` thật trong DOM. `tsc` sạch, **545/545 test xanh**. Rà nhanh hồi quy diện rộng (overview
desktop, alerts) — không phát sinh gì mới. Chi tiết đầy đủ + số đo trong `.bangiao/ket-qua-test.md`
mục 7 "VÒNG 2" (giữ nguyên lịch sử vòng 1 FAIL phía trên).

**security-reviewer XONG (2026-09-23) — KẾT LUẬN AN TOÀN.** Không có lỗ hổng mới mức cao/trung.
3 ghi chú THẤP: T-1 (snapshot Playwright lộ mật khẩu seed, thư mục chưa gitignore — **ĐÃ VÁ ngay**,
thêm `.playwright-mcp/`+`.obsidian/` vào `.gitignore`, chưa commit), T-2/T-3 (nợ có từ trước, đưa
backlog). Chi tiết đầy đủ: `.bangiao/danh-gia-bao-mat.md`.

**reviewer vòng 1 XONG (2026-09-23) — PHÁN QUYẾT: CẦN SỬA.** Tự chạy lại `npx tsc --noEmit` (0 lỗi)
+ `npm test` (545/545 xanh) độc lập, không tin suông báo cáo trước. Chi tiết đầy đủ:
`.bangiao/danh-gia.md`. Tóm tắt:
- 🔴 **CS-1 (CHẶN MERGE):** BUG #1 ("Trọng tâm" đè chữ) **CHƯA hết thật** — bản vá debugger chỉ phủ
  ≤680px; suy từ chính số đo debugger/tester ra công thức hình học, lỗi vẫn còn ở desktop
  **1181–~1450px** (đúng dải laptop văn phòng 1280/1366 phổ biến), do lưới 6 cột không có container
  giới hạn rộng và tag vẫn `position:absolute`. Tester vòng 2 chỉ quét 360-720px rồi nhảy tới 1440px
  nên bỏ sót đúng dải lỗi.
- 🟡 **CS-2 (1 dòng, sửa cùng lượt):** `tailwind.config.ts:69` `transitionDuration` thiếu đơn vị
  (`fast:'180'` thay vì `var(--dur-fast)`) → CSS build ra `transition-duration:180` không hợp lệ,
  trình duyệt bỏ qua, token `--dur-*` vô hiệu ở 12 chỗ dùng.
- 🟡 **CS-3 (CẦN CHỦ DỰ ÁN QUYẾT, chưa giao coder):** Q4=(a) "port engine spring y hệt mock-up" —
  coder tạo đủ `src/components/ui/motion.ts` (210 dòng, đúng chữ plan) nhưng **không hook vào đâu**
  → UI không có hiệu ứng rise/press nào. 3 phương án: (1) bật thật (cần vá thêm cleanup rAF/timeout
  trước khi bật), (2) chấp nhận là hạ tầng để dành, (3) xoá cho tới khi cần.

**⚠️ NEXT STEP đang treo:** đã giao coder vá CS-1 + CS-2 (chạy nền, không đụng gì khác) → tester đo
lại `overlapX` thật bằng Playwright ở đúng "Điều kiện đóng CS-1" trong `danh-gia.md` (viewport
1181/1200/1280/1366/1440/1536/1920, sidebar mở+thu gọn, cả vi/en, cả `/overview` và `/report`) →
quay lại reviewer vòng 2. Đây là vòng CAN SUA #2 của redesign (vòng 1 là 2 lỗi UI đã xong ở
tester/debugger trước đó) — đếm vòng: **dùng 1/2**, quá 2 vòng vẫn rớt thì dừng báo chủ dự án.

**CS-3 XONG (2026-09-23):** chủ dự án chốt "bật thật" motion engine → coder gắn `useRise`/
`useHoverLift`/`usePressable` vào 4 lưới `.kpis`, `Card.tsx`, nút đăng nhập (commit `9941505`) →
tester PASS vòng 4 (rise-in/hover-lift/press hoạt động, tôn trọng `prefers-reduced-motion`, có 1
quan sát KHÔNG CHẶN: failsafe 900ms trong `riseIn()` có thể bị spring gốc ghi đè dưới tải nặng
dev/HMR).

**reviewer vòng 2 XONG (2026-09-23) — PHÁN QUYẾT: CẦN SỬA (vẫn chưa CHỐT).** Tự chạy lại
`npx tsc --noEmit` (0 lỗi) + `npm test` (546/546 xanh) độc lập. Xác nhận CS-1/CS-2/CS-3 đã đúng.
Nhưng soát lại TOÀN NHÁNH (không chỉ diff mới) phát hiện **5 thoái lui so với `main`** mà vòng 1
bỏ sót — chi tiết đầy đủ trong `.bangiao/danh-gia.md` mục "VÒNG 2":
- 🔴 **B-1:** `ProjectTable.tsx:99,104` — dự án CHƯA có SPI/CPI hiện chip xanh "ok" (trông như đang
  khoẻ, sai). Ngưỡng 0.9/1 gõ cứng, lệch với `THRESHOLDS` dùng chỗ khác (SPI 0.85 đỏ ở Tổng quan
  nhưng vàng ở Báo cáo — không đồng bộ).
- 🔴 **B-2:** `report/page.tsx:101,106` — cùng lỗi null→chip xanh, ở `main` là trung tính.
- 🟡 **B-3:** `KpiCard.tsx:61` — thẻ "Trọng tâm" luôn chữ trắng nên SPI 0.70 và 1.10 trông giống
  nhau ở `/projects/[id]` (không còn chỗ nào khác tô màu SPI trên trang đó). Vá: tô `var(--gold)`
  khi tone warn/danger. Hệ quả phụ cần biết: hero ở Tổng quan/Báo cáo cũng chuyển vàng theo — nếu
  muốn giữ trắng ở 2 trang đó thì bỏ `tone="warn"` (lựa chọn thẩm mỹ, không chặn).
- 🟡 **B-4:** `globals.css:100-107` — trạng thái sidebar thu gọn rò sang drawer mobile: thu gọn ở
  màn rộng rồi snap xuống ~960px thì drawer mở ra chỉ rộng 68px, không mở lại được. Vá: bọc trong
  `@media (min-width:1024px)`.
- 🟢 **B-5:** `motion.ts:117-126` — failsafe phải huỷ spring trước khi trả lại hiển thị (đúng quan
  sát failsafe-race của tester vòng 4; reviewer tính ra thẻ KPI cuối xong ở ~0.74s, cách mốc 900ms
  chỉ ~160ms nên dễ nhảy giữa chừng trên máy yếu). 1 dòng, gộp vào lượt vá.

**Điều kiện đóng vòng sau (reviewer yêu cầu):** chạy `npm run build` thật (lần cuối trước CS-3, tức
trước khi `Card`/`Rise` thành Client Component) + thêm 2 test hero vào `KpiCard.test.ts` + tester đo
lại B-1→B-5. **Đây là vòng CAN SUA 2/2 — quá 2 vòng vẫn rớt thì DỪNG, báo chủ dự án, không tự ý
giao coder vá lần 3.**

**B-1→B-5 XONG (2026-09-23):** coder vá (commit `1e34b26`) → tester PASS VÒNG 5 (đo thật cả 5
điểm, 548/548 test, `npm run build` sạch). **Next: reviewer vòng 3 chốt.**

**Ghi nhận thêm (có từ trước, không do đợt này, ưu tiên cao nhưng KHÔNG chặn merge):** modal đổi
mật khẩu (`SettingsMenu.tsx:234`) và modal reset mật khẩu (`UserEditor.tsx:163`) bị giam trong
khung sidebar hẹp (~204px, ~36px khi thu gọn) — cần `createPortal`. Đưa vào backlog.

**⚠️ ĐANG ĐIỀU TRA SONG SONG (chủ dự án báo 2026-09-23, CHƯA xác định root cause):** avatar tài
khoản ở topbar bị cắt/che ở góc phải màn hình trên máy chủ dự án (có ảnh chụp). Đã test kỹ ở
1366/1518/1920/2560px qua Playwright + đo `getBoundingClientRect()` thật — KHÔNG tái hiện được,
avatar luôn cách mép topbar đúng 20px ở mọi mốc test. Dữ liệu console thật từ máy chủ dự án:
`devicePixelRatio ~0.9` (bất thường, đang zoom/scale <100%), `innerWidth:1518` — nhưng số đo tại
đúng thời điểm đó cũng cho kết quả bình thường (không tràn), ngay sau dòng log
`[Fast Refresh] rebuilding/done` — nghi vấn ảnh lỗi gốc chụp TRƯỚC khi dev server tự cập nhật code
mới nhất. Đã yêu cầu chủ dự án Ctrl+Shift+R rồi chụp lại để xác nhận — CHƯA có kết quả (máy chủ dự
án shutdown giữa chừng). **Việc tiếp theo khi resume: xác nhận lại với chủ dự án xem hard-refresh
có hết chưa; nếu còn, cần thêm dữ liệu thật (zoom % Windows, độ phân giải màn hình, có mở DevTools
lúc chụp không) trước khi sửa code — tránh vá mù vì chưa tái hiện được lỗi.**

**8 quyết định Q1-Q8 đã chốt (2026-09-23, tóm tắt — chi tiết đầy đủ trong `ke-hoach.md`):**
Q1 logo: giữ `logo.png` đỏ trên nền trắng bo góc (KHÔNG dùng `.appicon` navy vẽ tay). Q2 công tắc
sáng/tối: giữ nguyên trong SettingsMenu, không thêm lên topbar. Q3 sidebar: giữ đủ cả 3 tính năng
hiện có (thu gọn/hamburger/drawer mobile), tự thiết kế kiểu kính. Q4 motion engine: port đủ engine
spring bằng JavaScript (không làm bản CSS xấp xỉ). Q5 HUD đo FPS: KHÔNG ship. Q6 nền động 4 quả
cầu mờ: giữ màu/vị trí, TẮT HẲN animation drift (đứng yên mọi trang). Q7 tag "Trọng tâm" (không
chặn): mặc định giữ hiện trạng (1 tag ở "Chậm tiến độ"). Q8 thêm đồng hồ đếm ngược/timeline (không
chặn): mặc định KHÔNG thêm, đúng phạm vi chỉ đổi giao diện.

### Trạng thái dây chuyền ship — Run 1 — **PHAN QUYET CUOI CUNG: CHOT** (kỹ thuật xong hết + 3 quyết định nghiệp vụ B-1/B-2/B-3 đã chốt 2026-09-23 — không cần vá code — chỉ còn merge/PR, xem "Next step")
Dây chuyền ship có đúng **6 agent**: planner, coder, tester, debugger, security-reviewer, reviewer.

| Chặng | Trạng thái | Bàn giao |
|---|---|---|
| 0. Check nhánh + dọn `.bangiao/` | XONG | — |
| 1. planner | XONG — plan đã chốt Q1-Q11, thêm Task 8 | `.bangiao/ke-hoach.md` (168KB, Task 0→8) |
| 2. coder | XONG — 6 commit, 316/316 test xanh, `tsc` 0 lỗi | `.bangiao/thay-doi.md` |
| 3. tester | XONG — 320/320 rồi 335/335 xanh (sau vòng CAN SUA #1); Task 8 UI đã verify bằng mắt qua Playwright, đăng nhập thật | `.bangiao/ket-qua-test.md` |
| 3b. debugger | không cần — không có test nào rớt suốt cả 2 vòng | — |
| 4. security-reviewer | XONG — vòng 1 phát hiện 1 lỗi **CAO** (migration FK trỏ bảng `dim_stage` rỗng, nguy cơ mất dữ liệu %HT); vòng 2 xác nhận đã đóng | `.bangiao/danh-gia-bao-mat.md` |
| 5. reviewer | XONG — vòng 1 **CAN SUA** (5 điểm A-1→A-5) → coder vá (commit `987c2e1`) → tester/security chạy lại → vòng 2 **CHOT** | `.bangiao/danh-gia.md` |

**Tóm tắt vòng CAN SUA #1 (2026-09-23):** reviewer yêu cầu vá A-1 (migration FK trỏ `dim_stage` rỗng — coder Run 1 gốc phải chạy tay UPDATE/DELETE không WHERE để né, rủi ro xoá sạch %HT nếu ai lặp lại ở prod), A-2 (bug mới do Run 1: KPI delta bịa số khi lọc "Tất cả" ở `/overview`), A-3 (`?month=abc` → 500 ở `/projects/[id]`), A-4 (`.env.example` bật sẵn `DDC_FAKE_TODAY`), A-5 (`resetAllData` không xoá `sap_queue`, mock/prisma lệch nhau). Coder vá 4.5/5 điểm (bỏ sót nửa A-5 ở hàm `removeProject`, đã khai báo trung thực trong `thay-doi.md`). Tester viết thêm 15 test tự verify RED→GREEN thật (không tautology). Security-reviewer rà lại xác nhận lỗ hổng CAO đã đóng, không có lỗ hổng mới. Reviewer vòng 2 CHỐT nhánh, kèm 2 ràng buộc cứng và sổ nợ kỹ thuật 8 mục (N-2→N-8) + 5 mục mang từ vòng 1 (B-1→B-5).

**6 quyết định chủ dự án đã chốt (đã nằm trong plan, mục "QUYẾT ĐỊNH ĐÃ CHỐT"):**
- Q1: mốc thứ 6 = "Ngày chênh lệch" = `actualFinish - plannedFinish`, tính runtime (`calcDayVariance`), không lưu cột.
- Q2: "% Kế hoạch" CHỈ dùng duration (`calcDurationPctComplete`), SPI tính lại theo đó; bỏ hẳn `fact.pctPlan` khỏi vai trò % kế hoạch.
- Q3: nguồn lực lấy theo NGÀY (không phải monthly); 2 scorecard có highlight ngày; thêm line chart cuối trang `/projects/[id]` (2 đường KH/TT, toggle tuần/tháng, nhãn X kiểu `21.09 - 27.09`, badge năm ở góc) → Task 8.
- Q4: `fact_daily_equipment_usage.qty` tách `qtyPlanned` + `qtyActual`.
- Q5: volume = shop/procurement/fabrication/transport/erection; manual = design/handover.
- Q6: giữ danh sách 10 hạng mục tạm ở Task 6.

## Đã xong
- Skeleton Next.js 14 + TS + Tailwind + next-intl (vi/en) + next-auth v4 + Recharts + exceljs + Vitest + Prisma 6 + Zod + bcryptjs.
- **Auth** email/password + Google OAuth (chưa bật CLIENT_ID). 4 role (Admin/BOD/Data-entry/Viewer). Quản lý tài khoản + đổi pass + activity tracking + seed 4 account.
- Overview đủ widget + detail + nhập liệu (wizard 4 bước) + import + reset go-live + Data Dictionary + Data Schema/ERD + SettingsMenu + Dark mode.
- **Postgres local (2026-09-18):** `localhost:5433` (PG 16.6), DB `ddc_control_tower`. Swap mock→Prisma (async `prisma-repo.ts` + barrel; giữ `mock-repo.ts` cho test). Append-only → upsert + audit_log/project_history.
- **Dây chuyền agent + skill (2026-09-19):** 4→6 agent + ship.md auto-loop `CAN SUA` (max 2 vòng) + gói skill portable → repo `my_skill`.
- **6 MCP global (2026-09-20):** playwright, filesystem, sequential-thinking, context7, postgres (read-only, pin `mcp<2`), github (pending PAT — OAuth không tương thích). Skill `security-audit` (Cloudflare) nối security-reviewer.
- **Feature tiến độ 7 giai đoạn (2026-09-20):** nhập % từng giai đoạn (Thiết kế→Nghiệm thu) + checkbox "áp dụng"; `%HT = sum(applicable)/count(applicable)`; `pctActual` suy từ giai đoạn. Migration `add_value_chain_applicable`. `src/lib/stages.ts`. Sửa CAN SUA: month-lock server-side, chặn trùng stageCode, `chainDirty`. Fix flaky `savePhotoFile` (`crypto.randomUUID()`).
- **Redesign UI Apple-style (2026-09-20):** sidebar+header đỏ `#B91C1C` + chữ vàng `#F5B301`, font Inter (next/font), card frosted (backdrop-blur) + hover lift, KpiCard gradient đỉnh + glow + icon, chart đỏ/vàng (sửa `#1e5eff`), bảng zebra, FilterBar mới (thay SidebarFilter), sidebar thu gọn 240↔68, login frosted. Bỏ 202 em-dash "—"→"-". Chart donut 1/3 + "Team KD" 2/3 + title đậm. Header h-16 khớp line trắng.
- **4 trang nghiệp vụ (2026-09-20):** `/report` (báo cáo BOD + Xuất Excel 3 sheet auth admin+bod), `/alerts` (đóng alert, BOD đóng được), `/compliance` (dự án Dang_trien_khai thiếu số liệu tháng), `/audit` (nhật ký thay đổi, admin). Sidebar 2 nhóm "Vận hành"/"Quản trị" thay "Hệ thống". +4 icon mới.
- **Bảo mật P1-P6 (2026-09-20):** `canViewFinance ?? false` (fail-closed), guard role server-side `/admin`+`/data-dictionary`+`/data-schema`, chặn data-entry ghi finance, import giới hạn size/type (10MB, .xlsx/.xls/.csv), lọc preview import theo assignment.
- **Run 1 — ERP data model v2 (2026-09-22/23), dây chuyền ship CHỐT:** 11 bảng ERP mới (enum, FK, fact append-only theo `version`/`isLatest`), mở khoá đồng hồ ứng dụng (`src/lib/clock.ts`, bỏ neo cứng theo seed), %TT chuyển sang tổng có trọng số (`calcChainPctActual`), %KH chuyển sang tính theo duration (`calcDurationPctComplete`, bỏ hẳn `fact.pctPlan`), nguồn lực theo ngày (2 scorecard KH/TT + biểu đồ Recharts cuối trang `/projects/[id]`, toggle tuần/tháng, đã verify UI bằng mắt qua Playwright đăng nhập thật). 7 commit tổng (6 Task 0-8 + 1 vá CAN SUA `987c2e1`). Test cuối: **335/335 xanh**, `tsc` 0 lỗi.
- **Vá N-4/N-5 (2026-09-23, sau khi dây chuyền CHOT):** `getPortfolioKpis()` trả `delta = 0` khi `yearMonth` sai format/miền giá trị, hoặc khi tháng đang xem HAY tháng liền trước chưa có dòng `fact_progress_monthly` nào — trước đây bịa ra KPI tăng/tụt giả. Vá đúng "quả bom nổ chậm" N-5 (từ 01/10/2026 `/overview` mặc định mở tháng chưa có fact). Commit `1a629c5`, kèm 2 test RED→GREEN mới + 3 file test tester viết ở vòng CAN SUA #1 lần 2 trước đó bị bỏ sót chưa commit (A-3, A-5). **338/338 xanh**, `tsc` 0 lỗi.
- **Vá N-3 (2026-09-23):** `?month=9999-12` (ĐÚNG format `YYYY-MM`, khớp regex, nhưng năm tràn số) từng vẫn ném RangeError ở `endOfMonth()` vì `isValidYearMonth()` trước đây chỉ check format, không check miền giá trị năm. `isValidYearMonth()` (`clock.ts`) giờ bound thêm năm 1900-2999; `resourceWindow()` (`project-queries.ts`) tự validate + fallback `currentMonth()` ngay tại nguồn, không phụ thuộc trang gọi đã validate hay chưa. Commit `020647f`.
- **Vá N-2 + N-8 (2026-09-23):** `removeProject()` giờ xoá cả `sap_queue` mồ côi (nửa còn lại của A-5, khớp `mock-repo`); `todayIso()` chỉ cho `DDC_FAKE_TODAY` có hiệu lực khi `NODE_ENV !== 'production'`, cảnh báo `console.warn` một lần nếu phát hiện lọt vào production. Commit `cd9123f`.
- **Vá N-7 (2026-09-23):** regex `yearMonth` ở đường GHI (`validation.ts`) từng lỏng hơn đường ĐỌC (`clock.ts`), chấp nhận `2026-00`/`2026-99`. Giờ dùng chung `isValidYearMonth()` - một nguồn định nghĩa duy nhất cho cả đọc/ghi. Commit `7f76131`.
- **Vá N-6 (2026-09-23):** 2 scorecard nguồn lực (nhân lực/thiết bị) từng dùng CHUNG 1 nhãn ngày (ngày mới hơn trong 2 ngày cuối) dù 2 bên có thể nhập lệch ngày - card có dữ liệu cũ hơn hiện nhầm ngày của card kia. `ResourceSnapshot` giờ trả `manpowerAsOfDate`/`equipmentAsOfDate` riêng biệt. Commit `a64ea69`.
- **Vá B-4 - BOLA/IDOR (2026-09-23):** viết `src/server/authz.ts` (`requireProjectRead()`) - phần đúng tên/đúng vị trí mà bản kế hoạch Run 1 đã liệt kê trong "Bản đồ file" nhưng chưa Task nào triển khai. Không phải đoán nghiệp vụ: seed (`buildAssignments()`, history.ts) đã có sẵn dữ liệu + ghi chú ý định từ trước ("viewer@ được gán Backup để có quyền đọc", "data-entry/viewer sẽ không đọc được dự án nào sau khi requireProjectRead có hiệu lực") - chỉ là hàm enforce chưa từng được viết. admin/bod xem mọi dự án; data-entry/viewer chỉ xem dự án có trong `project_assignments`. Gắn vào `/projects/[id]/page.tsx`. Commit `3c6c804`.
- **Vá B-5 (2026-09-23):** 4 FK trỏ tới `dim_contractor`/`dim_equipment` (dimension dùng chung mọi dự án) đang `ON DELETE CASCADE` - đổi `RESTRICT`, dùng `isActive=false` để xoá mềm. Migration `20260923025310_b5_dim_fk_restrict` đã kiểm chứng ĐỘC LẬP trên 1 DB Postgres tạm (tự tạo/tự xoá trong phiên, không đụng DB dev thật): áp từ đầu thành công + xác nhận RESTRICT chặn đúng DELETE khi còn lịch sử dùng. **CHƯA áp dụng lên DB dev thật** - xem N-1 ở "Next step". Commit `2178ef8`.
- **Test:** 366/366 pass. `tsc` 0 lỗi.

## Đang sửa / lỗi tồn đọng
- ⚠️ **HIGH: `/api/export` (route cũ) không auth** — ai cũng export được toàn bộ dự án gồm `contractValue`. Route mới `/api/report/export` đã auth đúng; route cũ cần vá.
- ~~BOLA/IDOR đọc `/projects/[id]`~~ **ĐÃ VÁ (2026-09-23, B-4, commit `3c6c804`)** — `src/server/authz.ts`.
- **KHÔNG có flow quên/reset mật khẩu (blocker pre-prod):** admin mất pass = chết cứng.
- **Bảo mật còn lại:** NEXTAUTH_SECRET hardcoded (đã set .env) · login không rate-limit · Excel formula injection (export mới đã safe, route cũ CSV cần check) · upload không giới hạn.
- **4 LOW (từ review 4 trang):** closeAlert thiếu validate alertId/action + guard alert tồn tại (P2025→500) · export mới thiếu rate-limit · `getUserRoles` trả `passwordHash`.
- **Chưa apply:** RLS (`rls.sql`) · Google OAuth (CLIENT_ID trống) · Supabase/Vercel deploy.
- **MCP → subagent:** wildcard `mcp__<server>` không cấp MCP cho subagent (Claude Code 2.1.278) — chưa điều tra.
- **i18n/a11y/UX:** vài label hardcode (`alert.type` dùng `common.status`, action "Đã xử lý" chưa i18n) · label thiếu htmlFor · silent fail.

## Next step

### ~~N-1~~ ĐÃ XONG (2026-09-23) — chủ dự án tự chạy UPDATE checksum + `prisma migrate deploy`
DB dev thật (`ddc_control_tower`) đã đồng bộ checksum + áp nốt `20260923025310_b5_dim_fk_restrict`.
`npx prisma migrate status` xác nhận **"Database schema is up to date!"**. Không còn việc kỹ thuật
nào treo cho Run 1.

### ~~Ưu tiên 1~~ B-1/B-2/B-3 ĐÃ CHỐT (2026-09-23, chủ dự án quyết định trực tiếp) — KHÔNG cần vá code
- **B-1/B-2:** chủ dự án xác nhận thực tế nghiệp vụ "lúc nào cũng có 2 ngày [kế hoạch] đấy" — tạo
  dự án mới luôn biết `plannedStartDate`/`plannedFinishDate` ngay từ đầu, tình huống thiếu gần như
  không xảy ra. Quyết định: **giữ nguyên hành vi hiện tại** — khi thiếu ngày kế hoạch, `onTrack`
  vẫn mặc định `true` (`queries.ts:86`). Không vá code.
- **B-3:** chủ dự án chốt **giữ "% Kế hoạch" tính theo hôm nay** (`today()`, đúng như plan gốc
  `ke-hoach.md:1182`), không đổi theo tháng đang xem. Không vá code.
- **Phát hiện thêm khi rà lại (LOW, không chặn merge, chưa vá):** ô "Ngày cam kết bàn giao" trên
  form Tạo/Sửa dự án có dấu `*` (gợi ý bắt buộc) nhưng KHÔNG được validate bắt buộc ở cả client
  (`DataEntryForm.tsx` — comment dòng ~179 "Thiếu field → cho submit, bổ sung sau") lẫn server
  (`createProjectSchema` ở `validation.ts:88` khai `committedHandoverDate: nullableDate`) — dấu
  `*` hiện chỉ mang tính hình thức. `plannedStartDate`/`plannedFinishDate` cũng vậy. Ghi nhận cho
  chủ dự án, chưa vá vì chưa được yêu cầu.
- **Việc còn lại của Run 1: merge nhánh `feature/erp-model-v2` vào `main` + mở PR** (đang chờ chủ
  dự án xác nhận trước khi push/tạo PR — xem quy tắc xác nhận hành động).

### Thứ tự ưu tiên tiếp theo (chủ dự án chốt 2026-09-23)
1. ~~Redesign giao diện theo `mockup-apple-glass.html`~~ **ĐANG CHẠY** — xem mục "Giai đoạn hiện
   tại" ở đầu file (nhánh, trạng thái 12 Task, resume nếu đứt phiên).
2. **Run 2** — 5 REST endpoint `GET /api/projects/[id]/{summary,value-chain,milestones,work-items,resources}`.
   `src/server/authz.ts` (`requireProjectRead()`, viết cho B-4) tái dùng được ngay — chỉ còn phần
   route handler + `authzError()` (401/403 JSON) chưa viết. Làm SAU khi redesign xong.

### Nợ cũ (trước Run 1, ưu tiên thấp hơn 2 việc trên trừ khi chủ dự án đổi ý)
- **Vá HIGH `/api/export`** (thêm auth) + 4 LOW (closeAlert validate, rate-limit, getUserRoles).
- **Thêm flow reset/forgot password** (pre-prod blocker).
- Apply RLS + bật Google OAuth + deploy Supabase/Vercel + go-live reset.
- Smoke UI bằng Playwright (redesign + 4 trang mới) — cần restart Claude Code để MCP nạp tool.
- Điều tra MCP không tới subagent.

### Ghi chú vận hành (2026-09-23, không phải bug code)
Dev server cổng 3000 (chủ dự án tự chạy `npm run dev` ở terminal ngoài phiên này) đang bị kẹt ở
trang đăng nhập — chunk `/_next/static/chunks/app/%5Blocale%5D/login/page.js` trả 404 liên tục,
đăng nhập không vào được. Nhiều khả năng do dev server chạy lâu qua nhiều lần sửa file chưa được
restart. Chưa tự ý tắt/khởi động lại vì đó là process chủ dự án đang chạy tay — chủ dự án restart
`npm run dev` nếu cần soi giao diện thật.

> Cập nhật: 2026-09-23 (dây chuyền ship Run 1 CHỐT qua scheduled task; vá tuần tự N-2→N-8 + B-4,
> B-5; N-1 chủ dự án tự chạy xong; B-1/B-2/B-3 chủ dự án chốt trực tiếp trong phiên — cả 3 đều
> GIỮ NGUYÊN, không cần vá code). **Run 1 kỹ thuật + nghiệp vụ đã xong 100%, chỉ còn merge/PR.**
> Thứ tự việc tiếp theo đã chốt: Run 1 merge → Redesign giao diện theo mock-up (nhánh riêng) →
> Run 2 (5 endpoint).
