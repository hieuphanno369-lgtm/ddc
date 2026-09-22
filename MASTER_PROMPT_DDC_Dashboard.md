# MASTER PROMPT — Web App Quản Trị Danh Mục Dự Án (DDC)
> Paste nguyên văn file này vào Claude Code làm system/kickoff prompt.

---

## 0. VAI TRÒ & CÁCH LÀM VIỆC

Bạn là Lead Full-stack Engineer, chịu trách nhiệm build từ đầu đến cuối một web app quản trị nội bộ cho phòng KHDATT — Đại Dũng Corporation (DDC), ngành kết cấu thép. App phục vụ 100-200 người dùng (BOD, Trưởng phòng, PM/PIC), là hệ thống **vận hành thật**, không phải demo.

**Quy tắc bắt buộc:**
1. KHÔNG code ngay. Bước đầu tiên: đọc toàn bộ spec bên dưới → viết ra (a) Technical Spec, (b) Sơ đồ ERD/schema, (c) Cấu trúc thư mục, (d) Danh sách câu hỏi còn mơ hồ (nếu có) → chờ tôi confirm từng phần trước khi code.
2. Mỗi module xong phải tự chạy test + báo cáo lại: đã test gì, pass/fail, còn rủi ro gì.
3. Không tự ý đổi schema/business rule đã chốt trong tài liệu này. Nếu thấy bất hợp lý → hỏi lại, không tự sửa.
4. Ưu tiên đúng và chắc hơn nhanh. Đây là dữ liệu tài chính + hợp đồng, sai số kéo theo quyết định sai của BOD.
5. Dùng TodoWrite (hoặc tương đương) để track tiến độ qua nhiều session — vì dự án này build nhiều ngày, không phải 1 lần chat.

---

## 1. BỐI CẢNH & MỤC TIÊU

Phòng KHDATT hiện quản lý ~19-968 dự án kết cấu thép (EPC, sân vận động, nhà xưởng, cầu cảng, cao tầng...) qua Excel thủ công, độ trễ báo cáo BOD ~1 tuần, dễ sai lệch số, mã dự án đổi qua các kỳ gây gãy trend.

**Mục tiêu app:** Single source of truth — PM nhập liệu qua form CRM có validate chặt → dữ liệu đẩy thẳng vào Postgres → Dashboard 2 trang (Overview + Detail) phản ánh ngay lập tức, đúng chuẩn EVM (SPI/CPI theo PMBOK), có cảnh báo sớm rủi ro phạt hợp đồng.

**Northstar metrics:**
- % Dự án đúng tiến độ (On-Schedule Rate) = COUNT(SPI≥0.9, Đang triển khai) / COUNT(Đang triển khai)
- % Doanh thu kỳ / Kế hoạch năm

---

## 2. TECH STACK (ĐÃ CHỐT)

- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes / Server Actions (không cần service riêng ở Phase 1)
- **Database:** PostgreSQL (Supabase) — chọn Supabase vì có Auth + Row Level Security (RLS) built-in, khớp thẳng với yêu cầu phân quyền bên dưới
- **Auth:** NextAuth.js (Auth.js) + Google OAuth provider, giới hạn domain email công ty
- **ORM:** Prisma (schema-first, migration rõ ràng, dễ audit thay đổi)
- **Charts:** Recharts hoặc Tremor (dashboard component sẵn, đẹp kiểu Apple-clean)
- **Deploy:** Vercel (frontend + API) + Supabase (DB managed, có backup tự động)
- **State/data fetching:** React Server Components + Server Actions là chính; dùng SWR/React Query cho phần cần refetch client-side sau submit

**Lý do chọn nền này:** deploy nhanh, 1 người vận hành/bảo trì được (đúng yêu cầu "dễ control"), Supabase tự lo backup + RLS + auth infra thay vì tự build, chi phí thấp/predictable cho quy mô 100-200 user.

**Bắt buộc tách 3 môi trường — không migrate thẳng vào production để test:**
- **Dev**: Supabase project riêng (free tier đủ), Claude Code tự do migrate/test schema ở đây trong lúc build
- **Staging**: Supabase project riêng thứ 2, dùng data giả lập giống production để bạn duyệt trước khi lên thật
- **Production**: chỉ merge/migrate lên đây sau khi bạn confirm ở Staging — đây là DB chứa số liệu tài chính thật, 1 lỗi schema ảnh hưởng trực tiếp số BOD đang xem
- Biến môi trường (`DATABASE_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`...) tách riêng theo từng môi trường, không dùng chung 1 file `.env`

---

## 3. KIẾN TRÚC DỮ LIỆU (Star Schema — build đủ ngay từ đầu, kể cả field Phase 1 chưa dùng tới)

### Bảng Dimension
```
dim_project (PK: project_id serial)
  - master_code (varchar, unique, surrogate — KHÔNG dùng mã CCM làm khóa)
  - current_alias_code (varchar) — mã hiện hành, resolve qua dim_project_alias
  - project_name, customer_id (FK), team_kd_id (FK), market_code (TN/XK/NoiBo)
  - project_type (EPC/San_van_dong/Nha_xuong/Cau_cang/Cao_tang/Dong_tau/Khac)
  - priority (P0/P1/P2/P3)
  - contract_value (numeric, tỷ VNĐ, trước VAT)
  - contract_date, planned_start_date, planned_finish_date, committed_handover_date
  - is_active (bool) — KHÔNG cho phép hard delete, chỉ archive
  - created_at, updated_at, created_by, updated_by

dim_project_alias (SCD Type-2 — lưu lịch sử đổi mã, CHỈ dùng cho mã có tính chất "1 mã active tại 1 thời điểm")
  - project_id (FK), alias_code, alias_type (Ma_CT/Ma_noi_bo)
  - effective_from, effective_to, reason, approved_by
  -- KHÔNG chứa mã SAP ở đây — xem bảng project_sap_codes bên dưới, vì mã SAP có thể NHIỀU mã cùng tồn tại đồng thời, không phải kiểu "mã cũ hết hiệu lực khi có mã mới"

project_sap_codes (many-to-one: 1 dự án có nhiều mã SAP, 1 mã SAP chỉ trỏ về đúng 1 dự án)
  - id (PK), project_id (FK)
  - sap_code (varchar, UNIQUE — 1 mã SAP không được gán nhầm cho 2 dự án khác nhau)
  - source_doc_type (VD: Hợp đồng con/PO/Đợt nghiệm thu — ghi rõ mã này phát sinh từ hồ sơ nào)
  - linked_at, linked_by, note
  -- Không có effective_to: mã SAP một khi đã gán thì vẫn còn hiệu lực, KHÔNG bị "thay thế" như alias — nhiều mã cùng sống song song bình thường

dim_customer (customer_id PK, name, group)
dim_team_kd (team_id PK, name, pic_name)  -- P.KD 01-10, Nội bộ
dim_factory (factory_id PK, name, region, capacity_ton_per_year)
dim_stage (stage_code PK, name, sort_order)  -- Thiết kế→Shop→Gia công→Vận chuyển→Lắp dựng→Nghiệm thu→Đóng mã
dim_status (status_code PK)  -- Chuẩn bị / Đang triển khai / Hoàn thành / Tạm dừng
dim_date (date_id PK, calendar table chuẩn cho time intelligence)
dim_currency (currency_code PK, currency_name)  -- danh mục tiền tệ hợp lệ: VND, USD, EUR, AUD, SAR — bảng cha cho dim_exchange_rate bên dưới

project_assignments (project_id + user_id, PK compound)
  - role_in_project (PIC/Backup) -- PHÂN QUYỀN THEO PIC TỪNG DỰ ÁN, KHÔNG phải theo cả team_kd_id
  - assigned_by, assigned_at
  -- RLS dùng bảng này làm nguồn phân quyền chính cho role Data-entry, KHÔNG dùng team_kd_id để chặn
  -- (team_kd_id chỉ để nhóm/lọc hiển thị, không phải cơ chế phân quyền)
```

### Bảng Fact (mỗi bảng grain rõ, snapshot theo tháng — KHÔNG overwrite lịch sử)
```
fact_progress_monthly (project_id + year_month, PK compound)
  - pct_plan, pct_actual, actual_start_date, actual_finish_date
  - pv, ev, ac  (tính theo mục 4)
  - spi, cpi (generated hoặc tính ở app layer, lưu cached để trend nhanh)
  - bottleneck_stage (tính tự động — xem mục 4)
  - equipment_planned, equipment_actual  -- huy động thiết bị
  - snapshot_locked_at, locked_by  -- khóa số liệu cuối tháng, không cho sửa retroactive trừ có approval
  - row_version (int, default 1)  -- optimistic locking: mỗi lần save phải check row_version khớp mới cho ghi, sai thì báo "dữ liệu đã bị người khác sửa, tải lại trang"

fact_value_chain_progress (project_id + stage_code + year_month)
  - pct_complete

fact_financial (project_id + year_month)
  - revenue_period, revenue_cumulative, cost_actual_period, cost_actual_cumulative
  - gross_profit, gross_margin_pct
  - backlog, ar_collected, ar_outstanding, ar_overdue

fact_volume (project_id + year_month)
  - factory_id (FK), tonnage_processed

alert_log (append-only)
  - project_id, alert_type (Red/Amber), rule_triggered, message, opened_at, closed_at, owner, action, deadline

audit_log (append-only, MỌI thay đổi dữ liệu phải ghi vào đây)
  - table_name, record_id, field, old_value, new_value, changed_by, changed_at

dim_exchange_rate (currency_code + year_month, PK compound)
  - rate_to_vnd, updated_by, updated_at  -- currency_code (FK → dim_currency), xem rule quy đổi tiền tệ ở mục 4

project_photos (append-only)
  - project_id (FK), year_month, storage_url, caption, uploaded_by, uploaded_at
```

**Nguyên tắc bắt buộc:** mọi Fact chỉ JOIN qua `project_id` (surrogate int), KHÔNG bao giờ join trực tiếp qua mã dự án text — vì mã đổi liên tục qua các kỳ (xem bảng `dim_project_alias`). Đây là root-cause fix cho lỗi "trend gãy" đang gặp ở bản Excel hiện tại.

**Index bắt buộc riêng cho pattern "1 tháng × tất cả dự án" (Overview dùng pattern này liên tục):**
- PK compound `(project_id, year_month)` trên các bảng fact chỉ tối ưu khi lookup theo `project_id` trước — KHÔNG tối ưu cho query kiểu "lấy dữ liệu tháng T cho toàn bộ danh mục" (chính là query nền của mọi KPI card/chart ở Overview).
- Phải thêm index riêng dẫn đầu bằng `year_month` trên `fact_progress_monthly`, `fact_financial`, `fact_volume` (VD: `CREATE INDEX ON fact_progress_monthly (year_month, project_id)`), song song với PK — không dùng chung 1 index cho cả 2 chiều truy vấn.
- Cột dùng để SORT bảng danh sách dự án (priority, team_kd_id, market_code...) cũng phải có index riêng, không mặc định "có index filter là đủ" — filter và sort là 2 pattern truy vấn khác nhau.

---

## 4. BUSINESS RULES & CÔNG THỨC (chốt cứng — implement y nguyên, không diễn giải lại)

| Chỉ tiêu | Công thức |
|---|---|
| PV (tỷ) | % KH lũy kế × Giá trị HĐ (BAC) |
| EV (tỷ) | % TT lũy kế × Giá trị HĐ (BAC) |
| SPI | EV / PV |
| CPI | EV / AC lũy kế |
| EAC (tỷ) | BAC / CPI |
| VAC (tỷ) | BAC − EAC |
| Trạng thái dự án | Chuẩn bị triển khai: chưa có ngày BĐ thực tế · Đang triển khai: có ngày BĐ thực tế và %TT<100% · Hoàn thành: %TT≥100% và có ngày KT thực tế |
| Đúng tiến độ / Trễ tiến độ | %TT ≥ %KH − 5% → Đúng · %TT < %KH − 5% → Trễ (chỉ áp dụng dự án Đang triển khai) |
| Nguy cơ phạt HĐ | (Ngày cam kết BG − hôm nay) ≤ 30 ngày VÀ %TT dự kiến không đạt 100% đúng hạn VÀ chưa bị phạt chính thức |
| Đã bị phạt HĐ | Đã quá ngày cam kết BG mà chưa nghiệm thu, VÀ có văn bản/quyết định phạt |
| Khâu nghẽn | Stage ĐẦU TIÊN trong chuỗi Thiết kế→Shop→Gia công→Vận chuyển→Lắp dựng có %HT < 100% |
| Backlog | SUM(Giá trị HĐ) khi Trạng thái = "Chuẩn bị triển khai" |
| Cảnh báo công nợ | Công nợ quá hạn > 5% giá trị HĐ → cảnh báo đỏ |
| Cảnh báo dồn tải xưởng | Sản lượng tháng > 85% × (Công suất năm/12) |
| Alert severity | SPI/CPI < 0.9 → Amber (Teams nhóm KHDATT) · Quá hạn/nguy cơ phạt → Red (Email BOD + Teams) |

**Rule quy đổi tiền tệ (bắt buộc — chặn lỗi âm thầm khi cộng dồn):**
- Dự án Xuất khẩu (`market_code = XK`) có thể ghi nhận giá trị HĐ/doanh thu bằng USD/EUR/AUD/SAR (xem `dim_Currency`). **Mọi KPI tổng hợp (Backlog, Tổng giá trị HĐ, Doanh thu toàn danh mục...) BẮT BUỘC quy đổi về VNĐ trước khi SUM — không bao giờ cộng thẳng số gốc khác đơn vị tiền tệ.**
- Thêm bảng `dim_exchange_rate (currency_code, year_month, rate_to_vnd)` — cập nhật thủ công hàng tháng bởi Admin, dùng tỷ giá VCB mua chuyển khoản ngày cuối tháng (theo đề xuất mặc định trong tài liệu Onboarding, mục C.5).
- Mọi bảng/card hiển thị giá trị gốc (USD/EUR...) phải hiển thị kèm đơn vị rõ ràng, KHÔNG ngầm định là VNĐ.
- Nếu thiếu tỷ giá của tháng đó khi tính KPI tổng hợp → không tính, hiển thị badge "Thiếu tỷ giá T[x]" thay vì tự động fallback về tỷ giá cũ (fallback âm thầm gây sai số tích lũy).

**Rule xử lý mã SAP (bắt buộc — mỗi dự án có thể phát sinh nhiều mã SAP theo thời gian):**
- Khi import dữ liệu (Excel/CCM feed) có chứa mã SAP: hệ thống resolve về `project_id` qua bảng `project_sap_codes` — KHÔNG qua `dim_project_alias` (2 bảng khác mục đích, xem ghi chú ở mục 3).
- Nếu mã SAP trong file import **đã tồn tại** trong `project_sap_codes` → map thẳng vào đúng `project_id`, không hỏi lại.
- Nếu mã SAP **chưa từng thấy** (không có trong `project_sap_codes`) → **KHÔNG tự tạo dự án mới, KHÔNG tự đoán gán vào dự án nào** — dừng dòng đó lại, đẩy vào hàng đợi "Mã SAP chưa xác định" ở tab "Mã dự án" (5.1), chờ Trưởng phòng xác nhận thủ công nó thuộc dự án nào rồi mới ghi `project_sap_codes` và tiếp tục import dòng đó. Đây là nguyên tắc ETL đã có sẵn trong tài liệu gốc ("khi mã mới xuất hiện trong CCM chưa có trong Alias → alert Trưởng phòng approve"), áp dụng y hệt cho mã SAP.
- 1 mã SAP KHÔNG được gán cho 2 dự án khác nhau (ràng buộc UNIQUE ở `project_sap_codes.sap_code`) — nếu hệ thống phát hiện mã SAP đã gán cho project A mà giờ xuất hiện lại gắn với dữ liệu của project B → chặn, báo lỗi rõ ràng, không âm thầm ghi đè.

**Validate input (bắt buộc — chặn submit nếu sai):**
- % hoàn thành phải ∈ [0, 1.5] (chặn nhập "50" thay vì "0.5")
- Ngày cam kết bàn giao: **bắt buộc** nếu Trạng thái = "Đang triển khai" (thiếu → không cho submit, không phải chỉ cảnh báo)
- Mã dự án: **không cho sửa trực tiếp** trong form nhập liệu định kỳ — đổi mã phải qua flow riêng (ghi vào `dim_project_alias`, cần approval Trưởng phòng)
- Không cho xóa dự án (no hard delete) — chỉ set `is_active = false` (archive)
- Giá trị HĐ, khối lượng: phải là số dương, có định dạng rõ đơn vị (tỷ VNĐ, tấn)

---

## 5. TÍNH NĂNG BẮT BUỘC (Phase 1 — KHÔNG build thêm ngoài phạm vi này)

### 5.1 Module CRM nhập liệu (theo đúng ảnh mockup đã duyệt — sidebar trái: Overview / Chi tiết dự án / Nhập liệu / Quản trị)
Form nhập liệu chia tab, **submit phải validate đủ dữ liệu bắt buộc mới cho lưu**:
- Tab "Hồ sơ dự án": tạo mới / sửa dự án đang có (mã DA, tên, khách hàng, Team KD, loại hình, priority, trạng thái, ngày ký HĐ, mốc bàn giao kế hoạch, giá trị phạt ước tính)
- Tab "Số liệu tháng": %HT KH/TT, ngày BĐ/KT thực tế, huy động thiết bị
- Tab "Tài chính": doanh thu, chi phí AC, công nợ đã thu/chưa thu/quá hạn
- Tab "Alert/Action": xem alert đang mở, đóng alert kèm ghi chú action đã xử lý
- Tab "Mã dự án": xem lịch sử alias, đề xuất đổi mã (cần approval); **quản lý mã SAP liên kết** (xem/thêm mã SAP cho dự án, xử lý hàng đợi "Mã SAP chưa xác định" — xem rule ở mục 4)
- Tab "Danh mục nền": quản lý dim tables (customer, team KD, factory...) — chỉ Admin
- Tab "Import data": import Excel hàng loạt, có preview + validate trước khi commit, báo lỗi dòng nào sai gì (không âm thầm bỏ qua)
- Tab "Ảnh hiện trường": upload ảnh theo tháng (giới hạn dung lượng/định dạng theo mục 7 #1), ghi vào `project_photos`, hiển thị lại ở Detail page (5.3)

**Yêu cầu bổ sung bắt buộc cho module này:**
- **Draft auto-save**: form tự lưu nháp vào localStorage mỗi vài giây khi PM đang gõ (chưa submit) — nếu mất mạng/đổi tab/đóng nhầm, mở lại form phải khôi phục được dữ liệu đang gõ dở. Đây là fix trực tiếp cho vấn đề "mạng chập chờn giữa lúc nhập liệu" đã nêu ở mục 7.
- **Responsive bắt buộc**: form nhập liệu phải dùng tốt trên điện thoại/tablet, không chỉ desktop — PM thường nhập tại công trường.
- **Import lịch sử 1 lần trước go-live** (khác với tab "Import data" định kỳ ở trên): trước khi PM bắt đầu nhập liệu thật, cần 1 script/flow riêng để nạp toàn bộ dữ liệu Excel lịch sử các tháng trước vào `fact_progress_monthly`/`fact_financial`/`fact_volume` — nếu thiếu bước này, dashboard ngày go-live sẽ trống hoặc gãy trend do không có baseline lịch sử. Claude Code phải hỏi rõ: dữ liệu lịch sử có bao nhiêu tháng, định dạng file nào, trước khi build script này.

### 5.2 Dashboard — Page Overview
Đúng bố cục ảnh mockup đã duyệt:
- 6 KPI card: Tổng số DA, Đang triển khai, Trễ tiến độ, Nguy cơ phạt, Đã phạt, Backlog — **mỗi card kèm delta % so với tháng liền trước** (ví dụ "Đang triển khai: 15 ▲2 so T07"), lấy từ `fact_progress_monthly` của tháng trước đó, không cần thêm bảng mới
- Donut cơ cấu trạng thái danh mục
- Bar chart Lượng (tấn) & Trị (tỷ) theo Team KD
- Bar so sánh Sản lượng gia công vs Công suất nhà máy khu vực (có cảnh báo >85%)
- Card Backlog & Công nợ quá hạn kèm sparkline trend 6 kỳ
- Line chart SPI/CPI trend 6 tháng với ngưỡng tham chiếu 0.9
- **S-curve**: chart PV/EV/AC lũy kế theo tháng (không chỉ tỷ số SPI/CPI mà cả giá trị tuyệt đối) — cho toàn danh mục, trực quan hơn cho BOD không rành EVM, dữ liệu lấy sẵn từ `fact_progress_monthly`/`fact_financial`, không cần nguồn mới
- Bảng "Dự án cần lưu ý" (watchlist) — click để mở Detail
- Bảng danh sách đầy đủ dự án, filter theo Tháng/Trạng thái/Team KD/Priority/Thị trường/Loại hình, **có nút "Export Excel" xuất đúng bảng đang filter** (dùng thư viện exceljs hoặc tương tự, xuất phía server để không lộ toàn bộ dataset ra client). **Filter + sort + pagination của bảng này BẮT BUỘC thực thi ở server/query (WHERE + ORDER BY + LIMIT/OFFSET trong SQL)** — cấm pattern fetch hết rồi lọc/sort ở client, kể cả khi data còn nhỏ (~19-50 dự án), để không phải refactor khi danh mục lên vài trăm dự án. Đổi filter phải giữ nguyên chiều cao khung bảng (skeleton khi đang tải) để tránh giật layout.
- **Alert banner khi BOD/Trưởng phòng login**: nếu có dự án P0 đang ở trạng thái Red (đã phạt/nguy cơ phạt) mà alert chưa đóng, hiện banner/modal tóm tắt ngay khi vào Overview (không chỉ nằm im trong bảng watchlist) — đóng banner không tự đóng alert, phải vào Detail xử lý mới đóng được
- **Card/bảng "Chưa nộp số liệu tháng này"**: liệt kê dự án nào (đang Đang triển khai) chưa có bản ghi `fact_progress_monthly` cho tháng hiện tại — khác với validate lúc submit (chỉ bắt khi PM đã mở form), đây là bắt trường hợp PM **quên nhập luôn cả tháng**. Chỉ Admin/Trưởng phòng thấy mục này, không phải KPI card công khai.
- **Tooltip đầy đủ trên mọi chart** (donut, bar, line, S-curve): hover hiện giá trị chính xác + đơn vị, dùng tooltip built-in của Recharts/Tremor, không cần custom riêng
- **Drill-through mở rộng**: không chỉ click watchlist → Detail (đã có sẵn), mà click 1 thanh trong bar chart "Lượng & Trị theo Team KD" hoặc 1 lát donut trạng thái → tự động nhảy xuống bảng danh sách dự án phía dưới đã filter sẵn theo Team KD/trạng thái đó (dùng chung state filter đã có, không cần logic mới)
- **Field parameter (bản rút gọn)**: 1 dropdown "Nhóm theo" trên bar chart Team KD, cho đổi trục nhóm giữa Team KD / Loại hình / Thị trường — chỉ là re-group data theo field khác, không cần parameter engine
- **Bookmark (qua URL, không cần bảng riêng)**: mọi filter (Tháng/Trạng thái/Team KD/Priority/Thị trường/Loại hình, và field parameter ở trên) phải phản ánh vào URL query string — để BOD copy link chia sẻ đúng view đang xem cho nhau, không cần build "Save view" UI riêng ở Phase 1

### 5.3 Dashboard — Page Detail (chọn 1 dự án)
Đúng ảnh mockup: header thông tin dự án → 6 KPI card riêng dự án → Timeline kế hoạch vs thực tế → Chuỗi giá trị (stacked progress qua từng khâu, highlight khâu nghẽn) → bảng EVM Metrics đầy đủ (PV/EV/AC/SV/CV/SPI/CPI/EAC) → **S-curve PV/EV/AC lũy kế 12 tháng của riêng dự án này** (đặt cạnh chart SPI/CPI trend 12 tháng đã có, không thay thế) → bảng lịch sử mã dự án (alias) → panel Alert/Action đang mở → bảng tài chính chi tiết (kỳ này/lũy kế/kế hoạch năm/% đạt) → **thư viện ảnh hiện trường theo tháng** (grid ảnh từ `project_photos`, PM upload qua tab Nhập liệu, chỉ xem + upload, không cần AI phân tích — **grid chỉ load ảnh của tháng đang chọn, không load toàn bộ lịch sử ảnh của dự án 1 lần**; ảnh nén về kích thước hiển thị hợp lý ngay lúc upload, render bằng `next/image` với lazy loading)

### 5.4 Quản trị & Bảo mật
- Auth: Google SSO, giới hạn domain công ty
- 3 role:
  - **Admin/BOD**: full access, xem tất cả, sửa danh mục nền, không giới hạn
  - **Data-entry (PM/PIC)**: chỉ nhập/sửa dự án mà mình có mặt trong `project_assignments` (KHÔNG phải cả team_kd_id — xem ghi chú ở mục 3), KHÔNG xóa, KHÔNG sửa dữ liệu dự án khác
  - **Viewer**: chỉ xem dashboard, không có quyền vào module Nhập liệu
- **Chốt rõ "Trưởng phòng" = thuộc role Admin/BOD** (không phải role thứ 4 riêng) — mọi quyền hạn gán cho "Trưởng phòng" trong tài liệu này (khóa snapshot ở mục 6, duyệt đổi mã/mã SAP ở mục 4, duyệt migration ở mục 9.1, xem bảng "chưa nộp số liệu" ở mục 5.2) đều nằm trong quyền của role Admin/BOD. Nếu sau này cần tách quyền chi tiết hơn (VD: Trưởng phòng duyệt được nhưng không sửa được danh mục nền như BOD) thì để Phase 2, Phase 1 gộp chung 1 role cho đơn giản.
- Implement bằng Supabase RLS (Row Level Security) ở tầng DB, không chỉ chặn ở UI — vì UI check có thể bị bypass qua API trực tiếp
- Mọi hành động ghi/sửa/archive đều log vào `audit_log`
- **Session expiry**: chốt cứng — session sống tối đa 8 giờ hoặc hết ngày làm việc (auto logout), refresh token gia hạn khi còn hoạt động. Không để mặc định thư viện tự chọn (dễ bị quá lỏng).

**Điều hướng theo role — vẫn 1 domain, không tách deploy/subdomain riêng cho từng nhóm user:**

1. Auto-redirect theo role ngay sau khi login Google SSO — không cần nhân viên nhớ "link nào của tôi":
   - Role Data-entry → tự động vào thẳng `/nhap-lieu`, không thấy trang Overview
   - Role BOD/Viewer → tự động vào `/overview`
   - Middleware chặn luôn: PM gõ tay URL `/overview` cũng bị redirect ngược lại `/nhap-lieu` (không phải ẩn nút — chặn thật ở route level, vì RLS ở mục trên chỉ chặn dữ liệu, còn route-level middleware mới chặn được cả việc vào nhầm màn hình)
2. Ẩn hẳn item sidebar ngoài quyền — PM không thấy "Overview", "Quản trị" trong menu. Đây là để đỡ rối/đỡ bấm nhầm, KHÔNG phải lớp bảo mật (bảo mật thật đã nằm ở RLS + middleware phía trên).
3. Nếu muốn tiện cho PM bookmark trên điện thoại (PWA "Add to Home Screen") — cho họ 1 deep-link thẳng tới `/nhap-lieu` để add home screen, icon riêng ghi "DDC — Nhập liệu". Vẫn cùng 1 app, cùng domain, cùng auth — chỉ là điểm vào khác nhau, không phải app khác, không phải deploy khác.

*(Lý do không tách domain/deploy riêng: một đường dẫn "riêng cho nhân viên" nghe gọn nhưng không phải bảo mật thật — bảo mật thật nằm ở RLS + middleware. Tách domain/deploy chỉ tạo thêm 2 codebase/cấu hình auth phải đồng bộ tay, đi ngược yêu cầu "dễ control và bảo trì".)*

---

## 6. REAL-TIME & DATA FLOW

**Định nghĩa đã chốt:** Instant-on-submit — không cần WebSocket/polling. PM submit form → Server Action ghi DB → `revalidatePath()`/`revalidateTag()` Next.js → trang dashboard load lại thấy số mới ngay (không cần F5 thủ công, nhưng cũng không cần multi-user live sync qua socket). Đây là mức phù hợp nhất với quy mô 100-200 user, chi phí thấp, không cần thêm hạ tầng realtime.

**Snapshot tháng:** Cuối mỗi kỳ (chốt trước ngày làm việc thứ 3 tháng kế), Trưởng phòng khóa số liệu (`snapshot_locked_at`) — sau khi khóa, sửa retroactive phải qua flow riêng có ghi audit rõ lý do, không âm thầm ghi đè.

---

## 7. YÊU CẦU KỸ THUẬT PHI CHỨC NĂNG (bắt buộc, build sẵn từ đầu — không phải optional polish)

Đây là các nguyên tắc kỹ thuật chuẩn công nghiệp, áp dụng thẳng chứ không cần bàn luận lại:

1. **Input ngoài kịch bản**: validate cả client (UX nhanh) lẫn server (bắt buộc, không tin client). Giới hạn upload file (size, type). Debounce/disable nút submit khi đang gửi (chặn double-submit). Rate limit theo user+IP ở API routes.
2. **Lỗi mạng/DB timeout**: mọi Server Action bọc try/catch, timeout rõ ràng, retry có giới hạn (không retry vô hạn), hiển thị lỗi rõ ràng cho user thay vì màn hình trắng. Optimistic UI kèm rollback nếu request fail.
3. **Xử lý sự cố có kiểm soát**: health check endpoint, Sentry (hoặc tương đương) để log lỗi production, alert khi error rate bất thường. Backup DB tự động hàng ngày (Supabase point-in-time recovery), retention ≥30 ngày.
4. **Bảo mật**: password không tự quản (dùng Google SSO, không lưu password). Secrets qua env vars, không hardcode. HTTPS bắt buộc. RLS ở DB như mục 5.4.
5. **API validate dữ liệu**: dùng Zod (hoặc tương đương) validate schema mọi input ở API layer trước khi chạm DB — không tin dữ liệu từ client dù đã validate ở form.
6. **Quy mô dữ liệu**: index đúng trên các cột join/filter thường dùng (project_id, year_month, team_id). Pagination cho bảng danh sách dự án, không load hết 1 lần.
7. **Traffic tăng/chi phí**: Vercel + Supabase free/pro tier đủ cho 100-200 user nội bộ — không cần lo auto-scale phức tạp ở Phase 1. Set alert billing threshold trên Vercel/Supabase dashboard.
8. **Deploy & log**: CI/CD qua GitHub → Vercel auto-deploy khi merge main. Logs xem qua Vercel dashboard + Supabase logs, không cần tự dựng ELK ở quy mô này.
9. **Backup & khôi phục**: Supabase daily backup, restore point-in-time trong vài phút — không cần tự build cơ chế backup riêng.
10. **Testing**: unit test cho các hàm tính SPI/CPI/EAC/trạng thái/nguy cơ phạt (business logic dễ sai nhất). Integration test cho form submit + validate. Không cần 100% coverage — ưu tiên test đúng phần công thức tài chính.
11. **Kiểm thử trước khi coi là "xong"**: mọi tính năng phải có ít nhất 1 test case chứng minh chạy đúng số — không chỉ "code chạy không lỗi cú pháp".

*(Ghi chú: câu hỏi về quy tắc 90/90 trong dev — đây là nguyên lý "90% code đầu làm trong 90% thời gian, 10% code còn lại (edge case, integration, hardening) tốn thêm 90% thời gian nữa". Áp dụng ở đây bằng cách: đừng coi module "xong" khi UI chạy đẹp — chỉ coi xong khi qua được mục 7 phía trên.)*

---

## 7b. HIỆU NĂNG TẦNG UI KHI DỮ LIỆU TĂNG (bắt buộc — không phải optional polish, coi ngang mục 7)

Mục 7 đã lo phần DB/query (index, pagination). Mục này lo riêng phần **UI/render** — vì 2 tầng này lag độc lập với nhau: query nhanh mà render đồng bộ/không cache đúng cách thì Overview vẫn giật khi danh mục lên vài trăm dự án.

12. **Nguồn dữ liệu Overview PHẢI là pre-aggregated, không tính live mỗi request:**
    - Dùng `v_project_metrics` (mục 9.2) làm nguồn duy nhất cho 6 KPI card/donut/bar/line/S-curve — refresh view (hoặc REFRESH MATERIALIZED VIEW nếu chọn materialized) ngay sau khi Server Action ghi fact table thành công. Overview KHÔNG được JOIN trực tiếp nhiều fact table mỗi lần render.

13. **`revalidatePath`/`revalidateTag` phải có phạm vi hẹp:**
    - Dùng `revalidateTag` theo key cụ thể (VD: `metrics-{year_month}`) thay vì `revalidatePath('/overview')` toàn cục — tránh 1 PM submit làm mọi user khác đang xem Overview phải load lại full query từ đầu.

14. **Suspense boundary riêng cho từng widget ở Overview, không render đồng bộ 1 khối:**
    - Mỗi khối (6 KPI card / donut / 2 bar chart / line SPI-CPI / S-curve / watchlist / bảng full list) bọc `<Suspense>` + skeleton riêng, để 1 query nặng (bảng full list) không block phần KPI card đáng lẽ hiện ngay.
    - Trong cùng 1 request, nếu nhiều Server Component cần đọc chung 1 nguồn (VD: cùng `v_project_metrics` của tháng đang chọn) → bọc hàm query bằng `React.cache()` để dedupe, không bắn nhiều query trùng nhau cho cùng 1 lần render trang.

15. **Filter + sort + pagination của bảng danh sách dự án BẮT BUỘC chạy ở server/query** (đã ghi rõ ở mục 5.2) — cấm fetch hết rồi lọc/sort client, áp dụng ngay từ đầu kể cả khi data còn nhỏ.

16. **Debounce 200-300ms** cho mọi thao tác đổi filter (Tháng/Trạng thái/Team KD/Priority/Thị trường/Loại hình, field parameter "Nhóm theo") trước khi cập nhật URL query / trigger refetch — tránh request storm khi user đổi liên tiếp nhiều filter.

17. **Ảnh hiện trường**: nén khi upload + lazy load + chỉ tải ảnh của tháng đang xem (đã ghi rõ ở mục 5.3), không load toàn bộ lịch sử ảnh dự án 1 lần.

18. **Code-splitting cho thư viện chart**: `dynamic import` (`next/dynamic`, `ssr: false` nếu cần) cho các component Recharts/Tremor không nằm ngay above-the-fold, để giảm bundle JS tải lần đầu — quan trọng vì user PM/BOD dùng laptop văn phòng phổ thông, không phải máy dev mạnh.

19. **Index cho pattern "1 tháng × toàn danh mục"**: đã chốt ở mục 3 — nhắc lại ở đây vì đây là nguyên nhân phổ biến nhất khiến Overview chậm dần khi số dự án tăng mà không ai để ý (PK compound tối ưu sai chiều truy vấn).

---

## 8. QUY TRÌNH LÀM VIỆC BẮT BUỘC

1. Đọc toàn bộ prompt này → viết Technical Spec + phác thảo ERD/schema sơ bộ + cấu trúc thư mục → **dừng lại, trình tôi duyệt** (đây là bản phác thảo nhanh để duyệt hướng đi, KHÁC với README Data Warehouse chi tiết ở bước 8)
2. Setup 3 môi trường Dev/Staging/Production (mục 2) → setup project skeleton (Next.js + Prisma schema + Supabase connection + Auth) ở Dev → chạy thử, xác nhận connect DB OK → báo tôi
3. Viết script import dữ liệu lịch sử (5.1) từ Excel hiện có vào Dev, bao gồm resolve mã SAP qua `project_sap_codes` (mục 4) → báo tôi số dòng import thành công/lỗi/hàng đợi chờ xác nhận
4. Build module Nhập liệu (5.1) — vì không có input thì dashboard không có gì để hiển thị → test kỹ validate rules (mục 4), draft auto-save, responsive → báo tôi
5. Build Dashboard Overview (5.2) → so khớp trực quan với ảnh mockup đã duyệt → báo tôi
6. Build Dashboard Detail (5.3) → báo tôi
7. Auth + RBAC (5.4) → test cả 3 role thực tế (Admin/BOD, Data-entry, Viewer), xác nhận `project_assignments` chặn đúng theo PIC từng dự án (không chặn theo cả team) → báo tôi
8. Hardening theo mục 7 VÀ mục 7b (hiệu năng UI) → checklist từng mục, báo cái nào đã làm/chưa làm → viết `docs/DATA_WAREHOUSE_README.md` theo mục 9.2 (ERD Mermaid đầy đủ, data lineage, quy tắc NULL, nơi công thức/ngưỡng nằm)
9. Migrate schema lên Staging → tôi duyệt bằng mắt → migrate lên Production theo quy trình mục 9.1
10. Seed data mẫu (dùng dữ liệu ví dụ giống ảnh mockup: SVĐ Hùng Vương, Cầu cảng Cái Mép...) để tôi demo thử trước khi PM thật nhập liệu

**Ở mỗi bước, nếu gặp quyết định ảnh hưởng kiến trúc (không phải chi tiết UI nhỏ) — DỪNG LẠI VÀ HỎI, không tự quyết rồi báo sau.**

---

## 9. QUẢN TRỊ THAY ĐỔI SCHEMA & DATA WAREHOUSE (quy tắc chuẩn Data Engineer)

### 9.1 Quy trình khi cần thêm/xóa/sửa cột trong database
Không cho phép Claude Code tự ý `ALTER TABLE` thẳng vào production. Quy trình bắt buộc:
1. Đổi schema trong Prisma schema file trước (source of truth duy nhất — không sửa tay trực tiếp trên Supabase dashboard)
2. Chạy `prisma migrate dev` ở môi trường **Dev** trước, kiểm tra kỹ
3. Nếu là **thêm cột**: phải có giá trị mặc định hợp lý hoặc cho phép NULL — không được làm gãy dữ liệu cũ
4. Nếu là **xóa cột**: bắt buộc trước tiên đổi tên cột thành `_deprecated_<tencot>` và giữ ít nhất 1 chu kỳ release, KHÔNG xóa thẳng — phòng trường hợp cần rollback hoặc có chỗ nào đó (report, export) còn phụ thuộc cột này mà chưa rà hết
5. Migrate lên **Staging** → bạn duyệt bằng mắt (so dữ liệu trước/sau) → mới migrate lên **Production**
6. Mọi migration phải có file migration log kèm mô tả lý do đổi (Prisma tự tạo file migration, nhưng cần thêm comment rõ lý do nghiệp vụ, không chỉ mô tả kỹ thuật)

### 9.2 Yêu cầu bắt buộc: README chi tiết cho Data Warehouse
Claude Code phải xuất ra 1 file `docs/DATA_WAREHOUSE_README.md` (không phải README chung của repo) gồm:
- **Sơ đồ ERD đầy đủ** (dùng Mermaid, render được thẳng trên GitHub) — vẽ toàn bộ dim/fact/bảng phụ ở mục 3, quan hệ khóa ngoại rõ ràng
- **Với MỖI cột tính toán (derived — không phải cột nhập tay)**: công thức chính xác, cột nguồn nào, tính ở đâu (DB view/trigger hay tính ở app layer khi query) — liệt kê dạng bảng, không viết prose
- **Quy tắc xử lý NULL cho từng cột**: cột nào cho phép NULL nghĩa là "chưa có dữ liệu" (hiển thị "—" hoặc badge "Thiếu dữ liệu"), cột nào NULL phải coi là lỗi (không được xảy ra, nếu xảy ra là bug). Không được tự ý mặc định NULL = 0 cho các cột tài chính (VD: công nợ NULL ≠ công nợ 0, dễ hiểu sai).
- **Nơi admin can thiệp công thức**: TẤT CẢ công thức (SPI/CPI/EAC, ngưỡng đánh giá, rule quy đổi tiền tệ...) phải nằm tập trung ở 1 nơi duy nhất trong code — KHÔNG rải rác copy-paste công thức ở nhiều component. Cụ thể: **`v_project_metrics` là DB view (không phải "app layer hoặc view" tùy chọn nữa — xem lý do hiệu năng ở mục 7b) chứa sẵn SPI/CPI/EAC/Backlog/trạng thái đã tính**, còn ngưỡng đánh giá (VD: ngưỡng SPI 0.9) đặt ở `/lib/thresholds.ts` để sửa 1 chỗ không đụng SQL. README phải chỉ rõ 2 đường dẫn này.
- **Data lineage**: với mỗi trường trong Data Dictionary gốc (44 trường), map rõ nó đi vào dim/fact nào, có bị biến đổi (transform) gì không từ lúc PM nhập đến lúc lên dashboard
- **Sơ đồ workflow ETL/data flow dạng Mermaid** (khác sơ đồ ERD) — vẽ luồng: Form nhập liệu → validate → ghi fact table → tính derived metrics → cache/hiển thị dashboard, giống tinh thần sơ đồ đã thảo luận ở phần trước nhưng chi tiết hơn ở mức kỹ thuật (tên bảng, tên hàm/view thật, không phải sơ đồ khái niệm)

File README này là bắt buộc, không phải optional polish — vì đây là cách duy nhất để 1 Data Engineer/Analyst khác (hoặc chính bạn sau vài tháng) hiểu lại hệ thống mà không phải đọc lại toàn bộ code.

---

## 10. GHI CHÚ CHO PHASE 2 (không làm ở Phase 1 — chỉ để không quên khi lên kế hoạch tiếp)

- **What-if parameter**: slider cho BOD thử "nếu %HT tháng sau tăng X% thì EAC còn bao nhiêu" — vì công thức SPI/CPI/EAC đã xác định sẵn (không cần ML), chỉ cần tính lại công thức ngay trên client khi kéo slider, KHÔNG cần dựng simulation engine.
- **Small multiples**: mini SPI/CPI trend chart lặp lại cho từng Team KD đặt cạnh nhau trong 1 grid — giá trị tăng dần khi số lượng Team KD/dự án nhiều hơn quy mô hiện tại (19 dự án).
- **Alert gửi mail thật** (đã bàn ở phần trước) — dùng transactional email service (Resend/SendGrid), không dùng Gmail cá nhân. Đã chuẩn bị sẵn 2 cột `notify_channel`, `notify_sent_at` trong `alert_log` (mục 3) để không phải migrate schema sau.
- **Forecast SPI cuối kỳ**: cần tối thiểu 6-12 tháng lịch sử snapshot thật mới đủ dữ liệu làm có ý nghĩa — Phase 1 chưa có.
- **VO/Claim log**: domain nghiệp vụ mới, cần bảng riêng, không tái dùng schema hiện tại.
- **Không build** (đã cân nhắc và loại hẳn, không phải "để sau"): Decomposition tree, Key influencers — 2 tính năng này của Power BI dựa vào engine phân tích/AI có sẵn, tự build tốn công ngang 1 module riêng trong khi quy mô dữ liệu hiện tại (19-50 dự án) chưa đủ lớn để giá trị tương xứng chi phí; Key influencers còn rủi ro gây hiểu sai vì mẫu dữ liệu quá nhỏ cho phân tích thống kê.

---

## 11. THAM CHIẾU

- Data Dictionary đầy đủ 44 trường: xem file `DDC_Onboarding_QTDMDA.xlsx` (sheet "Data Dictionary")
- Ngưỡng đánh giá chính thức: xem file `QuyUoc_DinhNghia_NguongDanhGia.docx`
- Cấu trúc báo cáo BOD tham chiếu: xem file `DDC_De_Bai_QTDMDA.docx`
- Mockup UI đã duyệt: các ảnh screenshot đính kèm (giao diện kiểu Apple, theme Navy/Blue, card bo góc mềm)
