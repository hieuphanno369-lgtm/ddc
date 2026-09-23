PHAN QUYET: CHOT

# Đánh giá cuối — Redesign "Apple Glass" (12 Task, nhánh `feature/apple-glass-redesign`)

> **Lịch sử phán quyết:** VÒNG 1: CẦN SỬA (HEAD `70965f6`) → VÒNG 2: CẦN SỬA (HEAD `9941505`) → **VÒNG 3: CHỐT** (HEAD `1e34b26`).
> Kết luận mới nhất nằm ở mục **"VÒNG 2" cuối file**. Phần VÒNG 1 bên dưới giữ nguyên văn để tham khảo.

---

# VÒNG 1: CẦN SỬA (lịch sử, giữ nguyên văn)

Skill đã dùng: `ddc-tower:code-review`. Chỉ đọc, không sửa file nào.
Diff đã soát: `950359f` (merge-base với `main`) → `HEAD 70965f6`. 59 file, +3008/-1474.
Tự chạy lại (không lấy số trong báo cáo): `npx tsc --noEmit` → 0 lỗi. `npm test` → **545/545 xanh, 31/31 file**.

Căn cứ đã đọc: `ke-hoach.md` (Q1–Q8, Global Constraints, Task 3/4), `thay-doi.md` (gồm mục 7 của Debugger),
`ket-qua-test.md` (vòng 1 + vòng 2), `danh-gia-bao-mat.md` (= **DAT**, không phải LO HONG, nên không bị ép thành CAN SUA).

---

## 1) Code có khớp bản kế hoạch không? — CÓ, trừ Q4 (khoảng trống của plan)

**Constraint #1 (thuần giao diện) — ĐẠT, đã tự kiểm:**
- `git diff --name-only 950359f..HEAD` trên `src/server src/lib prisma src/data app/api middleware.ts
  next.config.* package*.json postcss.config.js vitest.config.ts` → **0 file**.
- i18n: đúng 1 khoá `kpi.focusTag`, có ở cả `vi.json` lẫn `en.json`.
- Tôi tự lọc các dòng mang hành vi (`on*=`, `value=`, `checked=`, `disabled=`, `type=`, `accept=`, `*Action(`,
  `.map(`) ở DataEntryForm, CreateProjectForm, ImportPanel, UserEditor, FieldEditor, projects/[id], admin.
  Kết quả: các dòng -/+ khớp nhau từng cặp.
- `app/tokens.css`: `diff -w` với `mockup-apple-glass.html` dòng 16–128 → **giống hệt**, chỉ khác comment đầu file.

**8 quyết định:**

| Q | Chốt | Thực tế | Kết luận |
|---|---|---|---|
| Q1 | (b) logo.png đỏ trên nền trắng | `AppShell.tsx` `.appicon.is-brand` + `login/page.tsx:18-20`, `globals.css:126` | Đúng |
| Q2 | (c) giữ 3 lựa chọn trong SettingsMenu | `SettingsMenu.tsx:34-38` còn đủ light/dark/system, topbar không có `.seg` | Đúng |
| Q3 | (a) giữ thu gọn/hamburger/drawer | `globals.css:100-123`, `AppShell.tsx:100`; tester đã bấm thử thật | Đúng |
| Q4 | (a) port engine spring, "làm y hệt mock-up" | `src/components/ui/motion.ts` có đủ 210 dòng nhưng **không được import ở đâu** → UI không có rise/press nào | **Chưa hiện thực** (xem CS-3) |
| Q5 | (a) không ship `.hud` | Không còn `.hud` | Đúng |
| Q6 | (b) quả cầu đứng yên | `globals.css:33-39`, không có `@keyframes` drift | Đúng |
| Q7 | (a) 1 tag | `OverviewWidgets.tsx:59`, `report/page.tsx:50` (behindSchedule), `projects/[id]/page.tsx:133` (SPI), khớp ghi chú plan dòng 1081 | Đúng |
| Q8 | (a) không thêm `.cdpanel`/`.tl` | Không có | Đúng |

**Các chỗ lệch coder đã khai (`thay-doi.md` mục 3):**
- `heroTagLabel` (mục 3.1): chấp nhận. Lý do kỹ thuật xác đáng, vì cả `'use client'` lẫn async component đều làm
  vỡ test render trang thật. Thay đổi tối thiểu.
- `sr-only h1` ở report, bỏ khối scrollbar trùng, đổi inline border sang utility (mục 3.3): chấp nhận, hợp lý.

## 2) Test có giá trị thật hay viết cho có? — CÓ GIÁ TRỊ, nhưng không phủ được loại lỗi đang còn

- `design-tokens.test.ts` (118 test): hợp đồng token thật. Đã tự xác nhận tokens.css khớp nguyên văn mock-up.
- `legacy-style-guard.test.ts` (53 test): có giá trị, chặn quay lại bảng màu cũ. Hai giới hạn:
  (1) chỉ quét `.tsx`; (2) **không kiểm được class Tailwind sinh ra CSS hỏng**. Bằng chứng là CS-2 lọt qua.
- `ActivityViewer.test.ts` (1 test): test hồi quy thật. Vòng 1 ghi lại output ĐỎ, vòng 2 XANH mà không sửa test.
  ImportPanel cùng gốc rễ nhưng không có test riêng — thiếu nhỏ.
- `KpiCard.test.ts` (7 test): mức trung bình, kiểm ở mức markup. Case `KpiCard.test.ts:84-92` chỉ khoá lại
  một hành vi thoái hoá (tag vàng rỗng khi quên `heroTagLabel`) thay vì ngăn nó xảy ra.
- **Điểm mấu chốt:** BUG #1 là lỗi hình học. Vitest chạy môi trường `node`, không bắt được lỗi này. Việc xác minh
  dựa hoàn toàn vào đo tay bằng Playwright, và **vùng đo đã bỏ sót đúng dải lỗi** (xem CS-1).
  Test xanh ở đây không có nghĩa là đúng.

## 3) Bảo mật / hiệu năng / tính đúng đắn

Bảo mật: đồng ý với `danh-gia-bao-mat.md` (DAT). Không có phát hiện bảo mật mới.

### 🔴 CS-1 (CHẶN MERGE) — BUG #1 chưa hết: tag "Trọng tâm"/"Focus" vẫn đè nhãn ở desktop 1181–~1450px

**Vị trí:**
- `app/globals.css:236-237`: `.kpi .lb{…padding-right:30px}`
- `app/globals.css:251-252`: `.kpi.key .tag{position:absolute;right:13px;top:13px…}`
- Bản vá `app/globals.css:262-265` chỉ chạy trong `@media(max-width:680px)`.

**Trang bị ảnh hưởng:**
- `/report` (`report/page.tsx:50`, lưới `.kpis` luôn 6 thẻ).
- `/overview` với role `canViewFinance` (`OverviewWidgets.tsx:56-63`, 6 thẻ).
- Role không xem tài chính (`.kpis.k5`, 5 thẻ) cũng đè nhẹ ở khoảng 1181–~1230px.

**Chứng minh.** Suy ra từ chính số đo của tester/debugger:
- Công thức phần chữ bị đè: `overlapX = K − rộng thẻ`, với K = 15 + rộng nhãn + 13 + rộng tag.
- Số đo debugger (vi): 390px → 8.2, 410px → −1.8. Thẻ rộng thêm 10px thì bớt đè đúng 10px, khớp công thức.
  Suy ra K_vi ≈ 177–181px, K_en ≈ 186px.
- Ở ≥1181px, lưới có 6 cột. Sidebar mở 236px theo mặc định (`AppShell.tsx:68` `useState(false)`),
  `.page` padding 20px, gap 12px. Không có container nào giới hạn độ rộng.
  Suy ra **rộng thẻ = (viewport − 336) / 6**.

| Viewport | Rộng thẻ | Đè (vi) | Đè (en) |
|---|---|---|---|
| 1181 | ~141px | ~36–40px | nhãn bị ellipsis + đè ~16px |
| 1280 | ~157px | ~20–24px | ~29px |
| 1366 | ~172px | ~5–10px | ~14px |
| 1440 | ~184px | hết (còn dư ~2–7px) | ~2px |

Khớp quan sát "1440px y nguyên" của tester vòng 2, vì 1440 nằm ngay ngoài vùng lỗi. Hai lý do vùng lỗi bị bỏ sót:
- Tester vòng 2 chỉ quét 360–720px, rồi nhìn thêm 1440px bản vi.
- Debugger có đo ở 1200px nhưng chỉ ghi lại `position`, không đo `overlapX` (`thay-doi.md` dòng 280-282).

Tag là phần tử `position:absolute` nên đè lên phần cuối nhãn "TRỄ TIẾN ĐỘ". Đây chính là lỗi mà vòng 1
đã đánh FAIL, nay xuất hiện trên laptop văn phòng 1280/1366 — nhóm người dùng chính của trang Tổng quan/Báo cáo.

**Cách sửa đề xuất** (coder chọn một):
- (a) **Khuyến nghị:** đặt điều kiện theo **bề rộng thẻ**, không theo viewport. Gốc rễ là thẻ hẹp; viewport chỉ
  là đại lượng gián tiếp, và sai khi sidebar thu gọn 68px.
  ```css
  .kpi.key{container-type:inline-size}
  @container (max-width: 210px){   /* K_max ~186px (en) + biên an toàn */
    .kpi.key .tag{position:static;display:inline-block;margin:0 0 6px}
    .kpi.key .lb{padding-right:0}
  }
  ```
  Khối `@media(max-width:680px)` ở dòng 262-265 có thể thay bằng khối trên. Ở ≤430px thẻ hẹp hơn 210px nên vẫn được phủ.
- (b) Cho tag ở thẻ `.key` luôn nằm trong luồng (không absolute) ở mọi bề rộng. Không cần ngưỡng, bền nhất,
  nhưng lệch góc tag của mock-up trên desktop → cần chủ dự án đồng ý.
- **Không** nên chỉ nới thêm `@media` theo viewport: sai khi sidebar thu gọn.

**Điều kiện đóng CS-1:** tester đo `overlapX` bằng Playwright (không chỉ nhìn `position`), trên:
- `/vi` và `/en` `/overview` (admin, 6 thẻ) và `/report`;
- viewport 1181 / 1200 / 1280 / 1366 / 1440 / 1536 / 1920;
- sidebar **mở và thu gọn**;
- quét lại 360–720px để chắc không hồi quy;
- thêm 1181–1230px cho role không xem tài chính (k5).

### 🟡 CS-2 (nên sửa cùng lượt, 1 dòng) — `duration-fast/base/slow` sinh CSS không hợp lệ

- **Vị trí:** `tailwind.config.ts:69` — `transitionDuration: { fast: '180', base: '320', slow: '520' }` thiếu đơn vị.
- **Bằng chứng từ CSS build thật:** `.next/static/css/app/[locale]/layout.css:1712-1713` có
  `.duration-fast { transition-duration: 180; }`. Trình duyệt bỏ khai báo này, nên token `--dur-*` không có tác dụng.
- **12 chỗ dùng:** `data-dictionary/page.tsx:31`, `data-schema/page.tsx:144`, `projects/[id]/page.tsx:90`,
  `UserEditor.tsx:172`, `ChartLabels.tsx:15`, `DrillCharts.tsx:51`, `DataEntryForm.tsx:614`, `ImportPanel.tsx:82`,
  `ChangePasswordModal.tsx:57`, `SettingsMenu.tsx:133,143`, `PasswordInput.tsx:44`.
- **Tác động hiện tại:** nhỏ, vì rơi về 150ms mặc định của `transition-colors`. Nhưng là một hợp đồng token
  đang hỏng mà không ai biết.
- **Sửa:** `transitionDuration: { fast: 'var(--dur-fast)', base: 'var(--dur-base)', slow: 'var(--dur-slow)' }`.

### 🟡 CS-3 (cần CHỦ DỰ ÁN quyết, chưa giao coder) — Q4=(a) chưa được hiện thực

- Plan Task 3 (`ke-hoach.md:819`) chỉ yêu cầu *tạo* `motion.ts`, không có bước nào gắn hook vào component. Coder làm
  đúng chữ plan (`thay-doi.md` mục 4). Kết quả: 210 dòng code chết, UI không có hiệu ứng rise-in/press nào,
  trái với ý "làm y hệt mock-up" của Q4=(a).
- Ba lựa chọn cho chủ dự án:
  1. Bật thật: một client wrapper nhỏ gọi `useRise` quanh `.kpis`/`.page`.
  2. Chấp nhận là "hạ tầng để dành", ghi vào PROGRESS.md.
  3. Xoá `motion.ts` cho tới khi cần.
- Nếu chọn 1, phải vá trước khi bật:
  - `spring()` (`motion.ts:38-82`) không trả về hàm huỷ. Vòng rAF chạy tiếp sau khi unmount. Hai spring chồng nhau
    khi bấm/rê nhanh sẽ tranh nhau ghi `el.style.transform`.
  - `setTimeout` 900ms (`motion.ts:95`) không được clear.
  - Transform inline từ `useHoverLift`/`usePressable` sẽ đè vĩnh viễn `.card-hover:hover` (`globals.css:211`).

### 🟢 Ghi chú nhỏ (không chặn)

- `charts.tsx:53`: `const c = useChartTokens()` trong `StatusDonut` không dùng tới, chỉ đăng ký listener thừa.
- `KpiCard.tsx:22`: `heroTagLabel?` là tuỳ chọn, nên `hero` mà thiếu nhãn sẽ ra tag vàng rỗng. Nên dùng union type
  bắt buộc có nhãn khi `hero: true`.
- `globals.css:34-35`: `.wall b{will-change:transform}` không còn cần vì Q6 đã tắt animation. Vẫn giữ 4 layer
  blur lớn trên GPU.
- `globals.css:433-434`: `.stage{cursor:pointer}` chép từ mock-up, nhưng hàng giai đoạn ở `DataEntryForm.tsx:481`
  và `projects/[id]/page.tsx:197` không bấm được → con trỏ gây hiểu nhầm.
- Hiệu năng (quan sát): mỗi card/kpi có `backdrop-filter` và cuộn trên nền `.wall` cố định, nên phải blur lại mỗi
  khung hình khi cuộn trang Tổng quan (~15 bề mặt, cộng topbar và sidebar blur 44px). Đây là bản chất thiết kế
  kính đã được chốt. Khuyến nghị đo bằng `ddc-tower:benchmark` trên một laptop văn phòng yếu trước go-live.

### Backlog có TỪ TRƯỚC (không tính vào phán quyết)

- 3 quan sát ở `ket-qua-test.md` mục 3: `aria-label={t('common.filter')}` trên nút menu; thiếu key `admin.delete`;
  404 gốc của Next.js.
- `TopProgressBar` bị render 2 lần: `app/[locale]/(app)/layout.tsx:17` và `AppShell.tsx:97`.
- T-2, T-3 và mục 5 của `danh-gia-bao-mat.md`.

---

## 4) Bước tiếp theo (điều phối quyết định — reviewer không tự giao việc)

1. **Coder** vá CS-1 (bắt buộc) và CS-2 (1 dòng). Không đụng gì khác.
2. **Chủ dự án** chọn phương án cho CS-3. Nếu chọn "bật thật" thì cần một Task bổ sung vào plan kèm các vá ở CS-3.
3. **Tester** đo lại theo "Điều kiện đóng CS-1" ở trên. Phải có số `overlapX`, không chỉ ảnh chụp.
4. Quay lại reviewer. Nếu CHỐT:
   - commit bản vá `.gitignore` (T-1) — hiện **đang nằm ở working tree, chưa commit**;
   - thống nhất việc commit hay bỏ các file `.bangiao/*.md` đang untracked
     (`ke-hoach.md`, `ket-qua-test.md`, `danh-gia-bao-mat.md`, `checkpoint.md`), vì `thay-doi.md` thì đã commit;
   - sau đó merge vào `main`.

---

# VÒNG 2: CẦN SỬA

Skill đã dùng: `code-review` (mức high, soát toàn bộ diff `main...HEAD`). Skill trả về 10 phát hiện **chưa kiểm chứng**;
tôi tự kiểm từng cái bằng đọc code + `git show main:<file>`, kết quả ở mục 4. Chỉ đọc, không sửa code, chỉ ghi file này.

- Diff đã soát: `70965f6..9941505` (2 commit mới: `0c77fdd` CS-1+CS-2, `9941505` CS-3). Soát lại cả `950359f..HEAD` để tìm chỗ vòng 1 bỏ sót.
- Tự chạy lại: `npx tsc --noEmit` → exit 0. `npm test` → **31/31 file, 546/546 xanh**.
- Căn cứ đã đọc:
  - `ke-hoach.md`: Global Constraints, Q4, Task 3/4/5/11.
  - `thay-doi.md` mục 8, 9.
  - `ket-qua-test.md` VÒNG 3, VÒNG 4.
  - `danh-gia-bao-mat.md` = AN TOÀN (DAT, không phải LO HONG).

**Tóm tắt:**
- CS-1, CS-2, CS-3 **đã đóng đúng ý vòng 1**.
- Soát lại toàn nhánh, tôi thấy **4 chỗ thoái lui so với `main`** mà vòng 1 bỏ sót. Đây là lỗi của tôi ở vòng 1.
- Cộng thêm 1 bản vá 1 dòng cho failsafe.
- Cả 5 điểm đều nhỏ, sửa cơ học. Nhưng chúng là lỗi hiển thị sai trạng thái hoặc sai hành vi mà người dùng nhìn thấy, nên chưa CHỐT.

## 1) Đối chiếu 3 điểm vòng 1 — đã đóng cả 3

| Điểm | Đã kiểm trong code thật | Kết luận |
|---|---|---|
| CS-1 | `app/globals.css:270-274`: `.kpi.key{container-type:inline-size}` + `@container (max-width: 210px){…}`, đúng phương án (a). Khối `@media(max-width:680px)` cũ đã được thay (không còn trùng). `.tag`/`.lb` là con của container nên query áp đúng. | **Đóng.** VÒNG 3 của tester đo độc lập 90 điểm bằng Playwright thật, đủ ma trận tôi yêu cầu, không ô nào dương. |
| CS-2 | `tailwind.config.ts:69` = `var(--dur-fast/base/slow)`; `app/tokens.css:40` có đủ 3 biến. Tester đo được `transitionDuration === "0.18s"`. | **Đóng.** |
| CS-3 | Xem mục 2. | **Đóng**, còn 1 lỗ nhỏ ở failsafe (B-5). |

## 2) CS-3 — đọc code thật, không tin báo cáo

**Gắn hook đúng như báo cáo:**
- `useRise` qua `src/components/ui/Rise.tsx` ở đúng 4 lưới: `OverviewWidgets.tsx:57`, `report/page.tsx:48`, `projects/[id]/page.tsx:133` và `:143`.
- `.kpis` duy nhất không được bọc là `KpiSkeleton` (`overview/page.tsx:31`). Đúng, vì skeleton không có `.rise`.
- `useHoverLift` ở `Card.tsx:22-24`.
- `usePressable` ở `LoginForm.tsx:20-21`, `ref` tại `:60`.

**3 lỗi kỹ thuật vòng 1 đã vá đúng:**
- `spring()` (`motion.ts:66-100`) trả hàm huỷ: có cờ `cancelled` + `cancelAnimationFrame(rafId)`, và `rafId` được cập nhật ở mọi nhánh gọi rAF.
- `riseIn()` (`:148-151`) clear timeout và huỷ mọi spring con. `useRise` trả về `riseIn(...)` (`:159`).
- `usePressable`/`useHoverLift` huỷ spring cũ trước khi tạo spring mới, và huỷ khi unmount (`:177,188,206` và `:228,239,253`).
- Chạy đúng cả dưới StrictMode (mount → cleanup → mount).

**CSS `.card-hover`** (`globals.css:210-213`) chỉ còn `box-shadow`. Class `card-hover` chỉ dùng ở `Card.tsx:24`, nên không nơi nào khác mất hiệu ứng.

**Ranh giới RSC:**
- `Card`/`Rise` giờ là Client Component. Tôi đã grep nhiều dòng: không Server Component nào truyền hàm (`on*=`) vào `Card`/`CardBody`/`Rise`.
- **Nhưng lần `npm run build` cuối cùng diễn ra trước CS-3**: `thay-doi.md` mục 8.3 có build, mục 9.4 thì không. Phải build lại trước merge (mục 6).

**Lệch mock-up đã khai (chấp nhận, không chặn):** mock-up gắn `hoverLift` cho `.kpi` (`mockup-apple-glass.html:2283,2338`), còn app gắn cho `Card`. Đây là chỉ đạo của điều phối, coder đã ghi ở `thay-doi.md` 9.5 mục 2.

## 3) Quan sát failsafe-race của tester — đồng ý "không chặn" nếu đứng riêng, nhưng gộp vá luôn (B-5)

**Cơ chế (đã tự xác minh ở `motion.ts:117-125`):** failsafe 900ms chỉ xoá `style`, **không huỷ spring**. Spring còn sống nên ghi đè lại ở khung rAF kế tiếp. Tester mô tả đúng.

**Biên an toàn (tôi tính thêm):**
- Spring `smooth` (k=260, c=28, ζ≈0.87) cần ≈0.55s *thời gian mô phỏng* để lọt ngưỡng dừng.
- Thẻ thứ 6 trễ thêm 0.175s. Ở 60fps, thẻ cuối xong ở ≈0.74s, tức **chỉ cách mốc 900ms khoảng 160ms**.
- `dt` bị kẹp ở 1/30s, nên mỗi long-task ngay sau hydrate đều ăn vào biên này. Long-task như vậy có thật: các chart `dynamic(ssr:false)` render ngay lúc đó.
- Vì thế failsafe sẽ **kích hoạt giữa chừng khá thường xuyên** trên laptop văn phòng yếu. Chỉ là khi đó opacity thường đã ~0.99, mắt khó thấy.
- Hiện tượng chớp-rồi-mờ rõ rệt chỉ xảy ra khi main thread nghẽn nặng (≥~600ms), như ca dev/HMR của tester.

**Kết luận:** nếu chỉ có mình lỗi này thì đồng ý mức "không chặn". Nhưng vòng này đã phải CẦN SỬA vì lý do khác, bản vá chỉ 1 dòng và không có rủi ro, nên **gộp vào lượt vá này** (B-5) thay vì để thành nợ.

## 4) Kiểm chứng 10 phát hiện của skill `code-review`

| # | Phát hiện | Tự kiểm (so với `main`) | Xếp loại |
|---|---|---|---|
| 1 | Hero bỏ qua `tone` | `KpiCard.tsx:61`. Ở `main`, giá trị hero được tô màu theo tone (`${s.text}`). | **Thoái lui thật → B-3** |
| 2 | SPI/CPI null ra chip xanh `ok`; ngưỡng 0.9/1 gõ cứng | Ở `main`, null là `text-slate-700` (trung tính), chỉ <0.9 mới amber, ở cả 2 trang. | **Thoái lui thật → B-1, B-2** |
| 3 | Trạng thái `.is-collapsed` rò sang drawer mobile | `main` giới hạn bằng tiền tố `lg:`. | **Thoái lui thật → B-4** |
| 4 | Modal đổi mật khẩu bị giam trong sidebar | Ở `main`, `aside` có `lg:translate-x-0` (transform khác `none`), nên cũng bị giam y hệt. | Có từ trước → backlog P-1 |
| 5 | `riseIn` chớp khi hydrate | Đúng cơ chế. Nguyên nhân là plan yêu cầu không ẩn `.rise` bằng CSS (`ke-hoach.md:819`). | Nợ kỹ thuật N-3 |
| 6 | `onLeave` luôn `from:1` | Đúng, nhưng mock-up cũng làm vậy (`mockup:1227`). | Nợ kỹ thuật N-1 |
| 7 | `StatusDonut` gọi thừa `useChartTokens` | Đã ghi ở vòng 1. | Ghi chú nhỏ |
| 8 | `formatPct(pct)` thiếu locale | `DataEntryForm.tsx:485` là dòng mới, chép theo dòng 518 (dòng 518 thiếu locale từ trước). | Nợ nhỏ N-2 |
| 9 | `useChartTokens` đọc style riêng cho mỗi chart | Đúng, chỉ ảnh hưởng hiệu năng. | Nợ nhỏ N-4 |
| 10 | Các `.card` dựng tay không có hover | Trước CS-3 cũng đã không có `card-hover`. | Nợ nhỏ N-5 |

## 5) CẦN SỬA — 5 điểm, đều nhỏ và cơ học

**Nguyên tắc:** Global Constraint #1 (`ke-hoach.md:58`: "không đụng nghiệp vụ… áp cho mọi Task") đứng trên chữ của từng Task.
B-1, B-2, B-3 là những chỗ **plan tự mâu thuẫn với Constraint #1**:
- `ke-hoach.md:1168` lấy ngưỡng từ mock-up;
- `:2102` lại dùng `THRESHOLDS`;
- `:1052` để hero luôn chữ trắng.

Coder làm đúng chữ plan. Lỗi nằm ở plan, và ở chính tôi vì vòng 1 đã bỏ sót.

### B-1 — `src/components/dashboard/ProjectTable.tsx:99` và `:104`: chip SPI/CPI sai nghĩa và lệch ngưỡng với toàn app

**Hiện tại:** `s.spi != null && s.spi < 0.9 ? 'danger' : s.spi != null && s.spi < 1 ? 'warn' : 'ok'`

**Sai 1 — null ra xanh:** dự án **chưa có SPI** hiện chip **xanh "ok"** với chữ "-", trông như đang khoẻ. Ở `main` là trung tính.

**Sai 2 — ngưỡng riêng:**
- Code thêm mức `danger` <0.9 và mức mới 1.0. Cả hai không có trong `src/lib/thresholds.ts` (chỉ có `spiWarn: 0.9`).
- Mọi chỗ khác đều dùng `THRESHOLDS`: `Watchlist.tsx:13-14` (ngay trên cùng trang Tổng quan), `report/page.tsx:101`, `DataEntryForm.tsx:527`, `projects/[id]/page.tsx:134`.
- Hệ quả: SPI 0.85 hiện **đỏ** ở Tổng quan nhưng **vàng** ở Báo cáo; SPI 0.95 hiện **vàng** ở Tổng quan nhưng **xanh** ở Báo cáo.

**Sửa:**
```tsx
import { THRESHOLDS } from '@/lib/thresholds';
<Badge tone={s.spi == null ? 'neutral' : s.spi < THRESHOLDS.spiWarn ? 'warn' : 'ok'}>
<Badge tone={s.cpi == null ? 'neutral' : s.cpi < THRESHOLDS.cpiWarn ? 'warn' : 'ok'}>
```
`Badge` có sẵn tone `neutral` (→ `c-plain`). Nếu chủ dự án muốn 3 mức thì đó là thay đổi nghiệp vụ: phải thêm `spiDanger` vào `thresholds.ts`
và áp đồng thời cho mọi trang, làm ở một đợt riêng.

### B-2 — `app/[locale]/(app)/report/page.tsx:101` và `:106`: null ra chip xanh

**Hiện tại:** `r.spi != null && r.spi < THRESHOLDS.spiWarn ? 'warn' : 'ok'`, nên null thành `ok`. Ở `main` là trung tính.

**Sửa:** `tone={r.spi == null ? 'neutral' : r.spi < THRESHOLDS.spiWarn ? 'warn' : 'ok'}`, làm tương tự cho CPI.

### B-3 — `src/components/dashboard/KpiCard.tsx:61`: thẻ "Trọng tâm" mất tín hiệu cảnh báo SPI ở trang chi tiết dự án

**Hiện tại:** `style={hero ? undefined : { color: TONE_VALUE[tone] }}`, nên hero luôn chữ trắng.

**Hậu quả:**
- `projects/[id]/page.tsx:134` truyền `tone` có điều kiện: SPI < `spiWarn` thì là `warn`. Ở `main`, giá trị này được tô amber.
- Giờ SPI 0.70 và SPI 1.10 trông **giống hệt nhau**.
- Trên trang đó không còn chỗ nào khác tô màu SPI (`EvmRow` ở `:220` không có màu).
- Tức là mất đúng tín hiệu mà thẻ "Trọng tâm" sinh ra để báo.

**Sửa mặc định** (coder tự làm được, không cần hỏi):
```tsx
const heroAlert = hero && (tone === 'warn' || tone === 'danger');
<div className="vl" style={hero ? (heroAlert ? { color: 'var(--gold)' } : undefined) : { color: TONE_VALUE[tone] }}>
```
- Dùng `--gold` vì `--warn` bản sáng (`#b25000`) không đọc được trên nền navy.
- Chữ `title1` đậm trên gradient ước tính đạt ≈3–4:1, đủ AA cho chữ lớn.
- `KpiCard` vẫn là hàm đồng bộ, không ảnh hưởng test render trang.

**Hệ quả phụ, cần chủ dự án nhìn:**
- Hero ở `OverviewWidgets.tsx:60` và `report/page.tsx:51` truyền `tone="warn"` cố định, nên giá trị ở 2 trang này sẽ chuyển vàng. Điều này khớp ngữ nghĩa cũ ở `main` (amber).
- Nếu chủ dự án muốn giữ chữ trắng như mock-up ở 2 trang đó thì bỏ `tone="warn"` ở 2 dòng này. Đây là lựa chọn thẩm mỹ, không chặn.

**Test:** thêm 2 case vào `src/components/dashboard/KpiCard.test.ts`:
- hero + `warn` phải có `var(--gold)`;
- hero + `ok` không có màu inline.

### B-4 — `app/globals.css:100-107`: trạng thái thu gọn rò sang drawer mobile (thoái lui so với Q3)

**Hiện tại:** các rule `.side.is-collapsed …` không nằm trong media query nào. `main` giới hạn chúng bằng `lg:`.

**Tái hiện:**
1. Thu gọn sidebar ở bề rộng ≥1024px.
2. Thu cửa sổ xuống <1024px, ví dụ snap nửa màn hình 1920px trên Windows (còn 960px), hoặc xoay tablet.
3. Bấm hamburger: drawer mở ra chỉ rộng 68px, mất hết nhãn và tên nhóm.
4. Ở bề rộng này nút chỉ bật/tắt `open` (`AppShell.tsx:141`), nên không có cách nào mở rộng lại.

**Sửa:** bọc nguyên khối dòng 100-107 trong `@media (min-width: 1024px) { … }`.

### B-5 — `src/components/ui/motion.ts:117-126`: failsafe phải huỷ spring trước khi trả lại hiển thị

**Sửa:**
- Chuyển `const cancelSprings` (hiện ở dòng 126) lên trước `setTimeout`.
- Trong vòng lặp failsafe, đổi thành `els.forEach((el, i) => …)` và gọi `cancelSprings[i]?.()` trước khi xoá `opacity`/`transform`.

## 6) Điều kiện đóng vòng này (tester đo độc lập)

1. `npx tsc --noEmit` sạch; `npm test` xanh, có thêm 2 case của B-3.
2. **`npm run build` thành công.** Đây là lần build đầu tiên kể từ khi `Card`/`Rise` thành Client Component.
3. B-1/B-2: trên `/vi/overview` và `/vi/report`, cùng một dự án phải có cùng màu chip. Dự án không có SPI/CPI phải là chip `c-plain`.
4. B-3: `/vi/projects/<id>` có SPI < 0.9 thì giá trị màu vàng; SPI ≥ 0.9 thì màu trắng. Kiểm cả light lẫn dark. Chụp thêm thẻ hero ở `/vi/overview` để chủ dự án chọn giữ vàng hay trắng.
5. B-4: thu gọn ở 1280px → thu còn 960px và 768px → mở drawer: drawer phải rộng 236px, đủ nhãn. Kéo lại lên 1280px thì vẫn đang thu gọn.
6. B-5: dùng Playwright với `Emulation.setCPUThrottlingRate` (≥6x) trên `/vi/overview`. Sau mốc 900ms không còn lần ghi `opacity` < 1 nào; cả 6 thẻ kết thúc với `style.opacity === ''`.
7. Soát nhanh không hồi quy CS-1 (1280/1366px) và `prefers-reduced-motion`.

**Đếm vòng:** theo quy tắc trong `PROGRESS.md`, đây là vòng CAN SUA thứ **2/2**. Nếu vòng sau vẫn rớt thì dừng và báo chủ dự án, không lặp tiếp.

## 7) Bảo mật / hiệu năng

**Bảo mật:**
- `danh-gia-bao-mat.md` kết luận AN TOÀN, nhưng được chấm ở `70965f6`, tức **trước CS-3**. Vì vậy tôi tự soát phần delta CS-3.
- `motion.ts` chỉ ghi các số tự tính vào `style`, không nhận đầu vào nào từ người dùng, URL hay DB.
- `Rise` spread `...props`, nhưng mọi nơi gọi chỉ truyền `className` tĩnh.
- Không có endpoint hay dependency mới.
- **Phán quyết bảo mật giữ nguyên: AN TOÀN.**

**Hiệu năng:**
- Sau khi rê chuột qua, `useHoverLift` để lại `translate3d(0,0.00px,0)` inline vĩnh viễn trên mỗi Card. Tác động nhỏ, vì `.card` vốn đã là layer riêng do `backdrop-filter`. Gộp vào N-1.
- Khuyến nghị đo bằng `ddc-tower:benchmark` từ vòng 1 vẫn còn nguyên giá trị.

## 8) Test có giá trị thật không?

- **VÒNG 3 (CS-1): giá trị cao.** Đo `overlapX` bằng `Range` trên chữ thật, 90 điểm, độc lập với số của coder, đủ ma trận tôi yêu cầu.
- **VÒNG 4 (CS-3): có giá trị.** Vết `MutationObserver` là bằng chứng thật cho thấy spring đang chạy, và phát hiện failsafe-race là phát hiện tốt. Còn 2 khoảng hở:
  - không kiểm trạng thái **trước khi hydrate** (N-3);
  - không kiểm việc rời chuột **khi thẻ đang nhấc dở** (N-1).
- **Unit test:** số test tăng từ 545 lên 546, nhưng test mới chỉ là `legacy-style-guard` tự quét thêm file `Rise.tsx`. Nó **không kiểm hành vi motion**.
  - `spring()` đã được export, nên thử được trong env `node` bằng `vi.stubGlobal('requestAnimationFrame'/'cancelAnimationFrame')`.
  - Nên có một test kiểu "gọi hàm huỷ xong thì `onUpdate` không còn được gọi". Khuyến nghị, không bắt buộc.
- **B-1..B-4 lọt qua mọi vòng test:**
  - không test nào khẳng định màu chip hay màu thẻ hero theo dữ liệu;
  - không ai thử kịch bản thu gọn sidebar rồi thu hẹp cửa sổ.

  Test xanh ở đây không có nghĩa là đúng.

## 9) Nợ kỹ thuật / backlog (không chặn)

**Do đợt này tạo ra:**
- **N-1** `motion.ts:238-247`: `onLeave` luôn bắt đầu từ `from: 1`. Rời chuột khi thẻ đang nhấc dở thì thẻ giật lên -3px rồi mới hạ xuống. Sửa: giữ giá trị `p` hiện tại trong closure và dùng làm `from`; trong `onDone` đặt `transform = ''`.
- **N-2** `DataEntryForm.tsx:485` (và `:518`, có từ trước): `formatPct` thiếu `locale`.
- **N-3** `motion.ts:127-129`: KPI do server render hiện đầy đủ, bị ẩn đi lúc hydrate, rồi mới trồi lên.
  - Nguyên nhân: plan chủ ý không ẩn `.rise` bằng CSS (`ke-hoach.md:819`).
  - Hướng xử lý: dùng script theme có sẵn ở `app/[locale]/layout.tsx:33` gắn một class lên `<html>` khi JS chạy và không bật reduced-motion, rồi dùng CSS ẩn `.rise` dưới class đó.
  - Cần cân nhắc rủi ro "hydrate lỗi thì KPI vô hình". Nên để thành một quyết định riêng.
- **N-4** `useChartTokens.ts`: mỗi chart tự đọc `getComputedStyle` và gắn listener riêng. Ở dark mode có thể chớp bảng màu sáng trước.
- **N-5** Nhiều `<div className="card">` dựng tay, không dùng `<Card>`, nên không có hover. Prop `padded` không nơi nào dùng.
- **N-6** Thẩm mỹ: tag "Trọng tâm" nằm trong luồng ở dải 1181–~1595px (tester VÒNG 3 mục 5). Chủ dự án nên nhìn qua một lần.

**Có từ trước (không do đợt này gây ra), nhưng nên ưu tiên cao:**
- **P-1** Modal bị giam trong sidebar:
  - `SettingsMenu.tsx:234` → `ChangePasswordModal.tsx:45`: modal `position:fixed` render **bên trong `aside.side`**. `aside` có `backdrop-filter` (ở `main` là `transform`), nên scrim và modal bị giam trong sidebar: rộng ≈204px, còn ≈36px khi thu gọn, và không làm mờ trang.
  - `UserEditor.tsx:163` bị tương tự (modal nằm trong `Card`).
  - Sửa: `createPortal(…, document.body)`.
- **P-2** `SettingsMenu.tsx:150`: popover `right-0 w-56` tràn ra ngoài mép trái màn hình khi sidebar thu gọn còn 68px. `main` cũng y hệt.
- Backlog vòng 1 vẫn còn nguyên: `aria-label={t('common.filter')}`, thiếu key `admin.delete`, trang 404 gốc, `TopProgressBar` render 2 lần, T-2, T-3, mục 5 của `danh-gia-bao-mat.md`.

## 10) Việc còn lại trước khi merge (điều phối làm; reviewer không tự commit hay merge)

1. Coder vá B-1..B-5, chỉ đúng các dòng nêu trên. Tester đóng theo mục 6. Sau đó quay lại reviewer.
2. Khi đã CHỐT:
   - **Commit `.gitignore`** (vá T-1: thêm `.playwright-mcp/`, `.obsidian/`). File này hiện **đang sửa ở working tree, chưa commit**, nên commit trước mọi lệnh `git add` rộng. `PROGRESS.md` cũng đang sửa dở.
   - **Quyết định với các file untracked:**
     - `.bangiao/ke-hoach.md`, `ket-qua-test.md`, `danh-gia-bao-mat.md`, `danh-gia.md`: nên commit cho đồng bộ với `thay-doi.md` (đã commit). Lưu ý T-2: `ket-qua-test.md` có 3 chỗ ghi mật khẩu seed (`Admin@***`, `Viewer@***`), nên che đi trước khi commit.
     - `.bangiao/checkpoint.md`: **không nên commit**. Đây là file do Stop-hook tự sinh, đã cũ (ghi ngày 2026-09-22 cho nhánh `feature/erp-model-v2`, session `test-123`), không liên quan đợt này. Nên xoá hoặc ignore.
     - `.bangiao/archive/`: điều phối quyết định.
   - Sau đó mới merge `feature/apple-glass-redesign` vào `main`.

---

# VÒNG 3: CHỐT

Skill đã dùng: `code-review` (ddc-tower). Tôi chỉ đọc, không sửa code, chỉ ghi file này.

- Diff đã soát: `9941505..1e34b26`, 1 commit, 7 file. Trong đó 6 file code/test nằm **đúng phạm vi B-1..B-5**, file còn lại là `.bangiao/thay-doi.md` (mục 10). Không đụng file nào ngoài phạm vi.
- Working tree hiện chỉ có `.gitignore` và `PROGRESS.md` đang sửa. Không có code nào chưa commit.
- Tự chạy lại ở HEAD `1e34b26`:
  - `npx tsc --noEmit` → exit 0.
  - `npm test` → **31/31 file, 548/548 xanh** (546 + 2 case B-3).
  - `npm run build` → **exit 0**. Lúc chạy không có dev server nào ở cổng 3000, nên không bị EPERM. Đây là lần build thứ 3 độc lập, sau coder và tester, và là build đầu tiên tôi tự chạy từ khi `Card`/`Rise` thành Client Component.
- `danh-gia-bao-mat.md` = `DAT` (không phải LO HONG). Delta vòng này chỉ gồm tone chip, màu inline hằng số, CSS media query và thứ tự huỷ spring. Không có đầu vào người dùng, không có endpoint hay dependency mới. **Bảo mật giữ nguyên AN TOÀN.**

## 1) Đối chiếu 5 điểm vòng 2 với code thật

| Điểm | Code thật ở `1e34b26` | Kết luận |
|---|---|---|
| B-1 | `ProjectTable.tsx:9` import `THRESHOLDS`; `:100` và `:105` = `x == null ? 'neutral' : x < THRESHOLDS.xWarn ? 'warn' : 'ok'`. Đã bỏ mức `danger` và mức 1.0 tự đặt. Grep toàn `src`/`app` không còn ngưỡng `0.9`/`1` gõ cứng cho SPI/CPI. `Badge` có tone `neutral` → `c-plain` (`Badge.tsx:3,10`). | **Đóng** |
| B-2 | `report/page.tsx:101` và `:106` dùng đúng cùng công thức với B-1. Hai trang giờ dùng chung một ngưỡng. | **Đóng** |
| B-3 | `KpiCard.tsx:52` `heroAlert = hero && (warn\|danger)`; `:65` chỉ tô `var(--gold)` khi `heroAlert`. Nhánh không phải hero giữ nguyên `TONE_VALUE[tone]`. 2 test mới ở `KpiCard.test.ts:94-112` khẳng định có/không có style inline trên markup thật, nên sẽ bắt được nếu có ai hoàn tác. | **Đóng** |
| B-4 | `globals.css:103-112`: toàn khối `.side.is-collapsed` nằm trong `@media (min-width: 1024px)`. Khối này khớp đúng với `@media (max-width: 1023px)` ngay dưới và với nhánh JS `window.innerWidth >= 1024` (`AppShell.tsx:141`). Không lệch breakpoint. | **Đóng** |
| B-5 | `motion.ts:117`: `cancelSprings` được khai báo trước `setTimeout`. `:124`: gọi `cancelSprings[i]?.()` trước khi xoá style. Hàm huỷ (`:97-100`) bật cờ `cancelled` và `frame()` kiểm cờ ngay dòng đầu (`:71`), nên kể cả spring đang trong giai đoạn `delay` (delay chạy bằng rAF, không dùng timer riêng) cũng dừng hẳn. Chỉ số `i` khớp nhau vì `push` chạy đồng bộ theo đúng thứ tự `els`, trước khi timeout có thể nổ. | **Đóng**, đúng gốc rễ |

**Không có thoái lui mới:**
- Nhánh reduced-motion của `riseIn` không đổi.
- Cleanup khi unmount vẫn clear timeout và huỷ toàn bộ spring.
- Phần tử đã chạy xong (opacity `''`) hoặc đang vượt ngưỡng (`min(1,p) = 1`) không bị failsafe đụng vào, nên spring của nó vẫn chạy tiếp tự nhiên.

## 2) Test có giá trị thật không?

- **VÒNG 5 của tester: giá trị cao.**
  - B-1/B-2 dùng dữ liệu seed thật, lấy từ Postgres: dự án id 17 có CPI null thật, và cả SPI lẫn CPI đều null ở tháng 2025-10; dự án id 8 có SPI 0.95 nằm sát ngưỡng. Tester đọc `className` chip trên cả 2 trang, không đoán.
  - Tester cũng tự khai khoảng hở: `/report` không có tham số tháng, nên chỉ kiểm được ca CPI null ở đó. Tôi chấp nhận, vì 2 trang giờ dùng cùng một biểu thức.
  - B-3 đo `computedColor` ở cả light và dark. B-4 tái hiện đúng kịch bản lỗi cũ, qua lại ranh giới 1024px theo cả hai chiều.
- **B-5 là phần yếu nhất**, nhưng không ảnh hưởng phán quyết. Số đo ở throttle 8x có nhiễu, tester đã tự khai. Kết luận B-5 đứng được chủ yếu nhờ đọc code, và tôi đã tự đọc lại ở mục 1. Khuyến nghị cũ vẫn còn: một unit test cho `spring()` với rAF giả (N-7, không bắt buộc).
- **Unit test mới (2 case B-3): có giá trị.** Test render markup thật và khẳng định đúng hành vi đã sửa. B-1, B-2, B-4 vẫn chưa có unit test màu chip hay CSS. Chấp nhận, vì đã có bằng chứng đo trực tiếp bằng Playwright.

## 3) Bảo mật / hiệu năng / tính đúng đắn

Không có phát hiện chặn. Hai ghi chú nhỏ, không chặn:
- 🟢 **Thẩm mỹ, chủ dự án xem:** hero ở `/overview` và `/report` truyền `tone="warn"` cố định (`OverviewWidgets.tsx:60`, `report/page.tsx:51`), nên số ở thẻ "Trọng tâm" luôn màu vàng, kể cả khi đang tốt. Điều này khớp ngữ nghĩa amber ở `main`. Nếu muốn chữ trắng như mock-up thì bỏ `tone="warn"` ở 2 dòng đó.
- 🟢 `.bangiao/_test.md` là file rác, đã bị commit từ trước, có dòng `PHAN QUYET: CAN SUA`. Công cụ nào quét `PHAN QUYET` trong `.bangiao/` có thể đọc nhầm file này. Nên `git rm` trong lượt dọn dẹp.

**Backlog giữ nguyên như VÒNG 2 mục 9:** N-1..N-6, P-1 (modal bị giam trong sidebar, ưu tiên cao), P-2, cộng backlog vòng 1. Thêm **N-7**: unit test hành vi `spring()`/`riseIn()` với rAF giả.

## 4) Phán quyết: CHỐT

Code khớp kế hoạch, đã tính cả các chỉnh sửa theo Global Constraint #1 ở vòng 2. Cả 5 điểm B-1..B-5 đã đóng đúng gốc rễ. tsc, test và build đều sạch, do tôi tự chạy lại. Không có thoái lui, không có lỗ bảo mật.

## 5) Việc điều phối cần làm trước khi merge (reviewer không tự commit hay merge)

1. **Commit `.gitignore` trước tiên**, riêng một commit. File này đang thêm `.playwright-mcp/` và `.obsidian/` (vá T-1). Phải commit xong trước mọi lệnh `git add` rộng, để snapshot Playwright chứa mật khẩu không lọt vào repo.
2. **Commit `PROGRESS.md`**: cập nhật trạng thái thành "Reviewer VÒNG 3 CHỐT".
3. **Các file `.bangiao/` nên commit** (để đồng bộ với `thay-doi.md` đã commit):
   - `ke-hoach.md`, `danh-gia.md`, `danh-gia-bao-mat.md`.
   - `ket-qua-test.md`, **nhưng phải che mật khẩu seed trước**. Có 3 chỗ: dòng **407** (`Admin@***`), **409** (`Viewer@***`), **615** (`Admin@***`). Đổi thành kiểu "xem `src/data/seed`". Sau khi che, grep lại để chắc không còn sót mật khẩu thật nào.
   - Ngoài phạm vi yêu cầu nhưng cùng loại: `thay-doi.md:175` (**đã commit** trên nhánh) cũng ghi `Admin@***`. Nên che luôn trong cùng lượt. Nếu cần xoá khỏi lịch sử git thì đó là việc riêng của chủ dự án. Mật khẩu này đằng nào cũng đã có sẵn trong `src/data/seed/history.ts`, nên điều quan trọng là đổi mật khẩu hoặc khoá tài khoản seed trước khi go-live (T-2).
4. **Không commit:**
   - `.bangiao/checkpoint.md`: file cũ do Stop-hook sinh ra cho nhánh `feature/erp-model-v2`. Nên xoá hoặc thêm vào ignore.
   - `.bangiao/archive/`: chỉ chứa `run1-erp-model-2026-09-23`, thuộc Run 1, không phải đợt này. Điều phối quyết định, mặc định là không commit vào nhánh redesign.
5. Tuỳ chọn: `git rm .bangiao/_test.md` (xem mục 3).
6. Merge `feature/apple-glass-redesign` → `main`. Chưa push nếu chủ dự án chưa yêu cầu. Trước đó chủ dự án nên xem ghi chú thẩm mỹ ở mục 3 (hero vàng hay trắng) và N-6.
