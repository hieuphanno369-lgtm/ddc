/**
 * Từ điển dữ liệu - giải thích ý nghĩa + công thức từng field, ngôn ngữ dễ hiểu cho người non-tech.
 * Hiển thị trong modal Data Dictionary ở phần Settings.
 */
import { THRESHOLDS } from './thresholds';

export interface DictEntry {
  fieldVi: string;
  fieldEn: string;
  meaningVi: string;
  meaningEn: string;
  formulaVi?: string;
  formulaEn?: string;
}

export interface DictSection {
  titleVi: string;
  titleEn: string;
  entries: DictEntry[];
}

export const DATA_DICTIONARY: DictSection[] = [
  {
    titleVi: 'Hồ sơ dự án',
    titleEn: 'Project Profile',
    entries: [
      { fieldVi: 'Mã dự án', fieldEn: 'Project code', meaningVi: 'Mã định danh dự án trong hệ thống. Không sửa trực tiếp.', meaningEn: 'System identifier for the project. Not editable directly.' },
      { fieldVi: 'Tên dự án', fieldEn: 'Project name', meaningVi: 'Tên đầy đủ của dự án kết cấu thép.', meaningEn: 'Full name of the steel-structure project.' },
      { fieldVi: 'Khách hàng', fieldEn: 'Customer', meaningVi: 'Chủ đầu tư / đơn vị đặt hàng.', meaningEn: 'Investor / client.' },
      { fieldVi: 'Team KD', fieldEn: 'Team KD', meaningVi: 'Nhóm kinh doanh phụ trách dự án (P.KD 01-10, Nội bộ).', meaningEn: 'Sales team in charge (P.KD 01-10, Internal).' },
      { fieldVi: 'Loại hình', fieldEn: 'Project type', meaningVi: 'EPC, Sân vận động, Sân bay, Nhà xưởng, Cầu cảng, Cao tầng, Đóng tàu, Cầu giao thông, Khác.', meaningEn: 'EPC, Stadium, Airport, Factory, Port, High-rise, Shipyard, Bridge, Other.' },
      { fieldVi: 'Độ ưu tiên', fieldEn: 'Priority', meaningVi: 'P0 = quan trọng nhất, P3 = thấp nhất.', meaningEn: 'P0 = highest, P3 = lowest.' },
      { fieldVi: 'Thị trường', fieldEn: 'Market', meaningVi: 'Trong nước (TN), Xuất khẩu (XK), Nội bộ.', meaningEn: 'Domestic (TN), Export (XK), Internal.' },
      { fieldVi: 'Tiền tệ', fieldEn: 'Currency', meaningVi: 'Đơn vị ghi giá trị hợp đồng. Dự án xuất khẩu có thể dùng USD/EUR/AUD/SAR.', meaningEn: 'Currency of the contract value. Export projects may use USD/EUR/AUD/SAR.' },
      { fieldVi: 'Giá trị HĐ (BAC)', fieldEn: 'Contract value (BAC)', meaningVi: 'Tổng giá trị hợp đồng trước VAT (tỷ). Đây là mốc ngân sách BAC để tính EVM.', meaningEn: 'Total contract value before VAT (billion). This is the BAC budget baseline for EVM.', formulaVi: 'BAC = Giá trị hợp đồng', formulaEn: 'BAC = Contract value' },
      { fieldVi: 'Khối lượng (tấn)', fieldEn: 'Tonnage (ton)', meaningVi: 'Tổng khối lượng kết cấu thép phải gia công.', meaningEn: 'Total steel structure tonnage to fabricate.' },
      { fieldVi: 'Ngày ký HĐ', fieldEn: 'Contract date', meaningVi: 'Ngày ký kết hợp đồng.', meaningEn: 'Contract signing date.' },
      { fieldVi: 'Ngày BĐ kế hoạch', fieldEn: 'Planned start', meaningVi: 'Ngày dự kiến bắt đầu theo kế hoạch.', meaningEn: 'Planned start date.' },
      { fieldVi: 'Ngày KH hoàn thành', fieldEn: 'Planned finish', meaningVi: 'Ngày dự kiến hoàn thành theo kế hoạch.', meaningEn: 'Planned finish date.' },
      { fieldVi: 'Ngày cam kết bàn giao', fieldEn: 'Committed handover', meaningVi: 'Mốc phải bàn giao cho khách. Dùng để tính nguy cơ phạt hợp đồng. Bắt buộc khi dự án đang triển khai.', meaningEn: 'Deadline to hand over to client. Used to compute penalty risk. Required when in progress.' },
      { fieldVi: 'Ngày BĐ thực tế', fieldEn: 'Actual start', meaningVi: 'Ngày thực tế bắt đầu. Có ngày này = dự án chuyển sang "Đang triển khai".', meaningEn: 'Actual start date. Once set, project becomes "In progress".' },
      { fieldVi: 'Ngày KT thực tế', fieldEn: 'Actual finish', meaningVi: 'Ngày thực tế kết thúc. Cùng %TT ≥ 100% = dự án "Hoàn thành".', meaningEn: 'Actual finish date. With % actual ≥ 100% = "Completed".' },
      { fieldVi: 'Giá trị phạt ước tính', fieldEn: 'Estimated penalty', meaningVi: 'Số tiền phạt dự kiến nếu chậm bàn giao (tỷ).', meaningEn: 'Estimated penalty if handover is late (billion).' },
      { fieldVi: 'Đã bị phạt', fieldEn: 'Penalized', meaningVi: 'Đã có quyết định phạt chính thức chưa.', meaningEn: 'Whether an official penalty has been issued.' },
    ],
  },
  {
    titleVi: 'Số liệu tháng',
    titleEn: 'Monthly Data',
    entries: [
      { fieldVi: '% KH lũy kế', fieldEn: '% Plan (cumulative)', meaningVi: 'Phần trăm hoàn thành theo kế hoạch, cộng dồn từ đầu dự án đến tháng này.', meaningEn: 'Planned completion %, cumulative from project start to this month.' },
      { fieldVi: '% TT lũy kế', fieldEn: '% Actual (cumulative)', meaningVi: 'Phần trăm hoàn thành thực tế, cộng dồn đến tháng này. Nhập dạng 0..1 (vd 0.5 = 50%).', meaningEn: 'Actual completion %, cumulative to this month. Enter 0..1 (e.g. 0.5 = 50%).' },
      { fieldVi: 'AC - Chi phí thực tế', fieldEn: 'AC - Actual cost', meaningVi: 'Tổng chi phí đã bỏ ra đến tháng này (tỷ).', meaningEn: 'Total cost actually spent to this month (billion).' },
      { fieldVi: 'Huy động thiết bị', fieldEn: 'Equipment mobilised', meaningVi: 'Số thiết bị thực tế huy động cho công trường tháng này.', meaningEn: 'Number of equipment actually mobilised this month.' },
    ],
  },
  {
    titleVi: 'Chuỗi giá trị & trọng số',
    titleEn: 'Value chain & weights',
    entries: [
      { fieldVi: 'Trọng số giai đoạn', fieldEn: 'Stage weight', meaningVi: 'Mức quan trọng của từng giai đoạn trong tổng tiến độ, tính bằng ĐIỂM phần trăm. Mặc định: Thiết kế 5, Shop Drawing 10, Vật tư 10, Gia công 40, Vận chuyển 5, Lắp dựng 27, Nghiệm thu & Bàn giao 3. Tổng các giai đoạn áp dụng phải bằng 100.', meaningEn: 'How much each stage counts toward overall progress, in percentage points. Default: Design 5, Shop Drawing 10, Materials 10, Fabrication 40, Transport 5, Erection 27, Handover 3. Applicable stages must total 100.' },
      { fieldVi: '% TT tổng thể', fieldEn: '% Actual (overall)', meaningVi: 'Tiến độ chung của dự án = tổng có trọng số của 7 giai đoạn. Xong Gia công (trọng số 40) đóng góp nhiều gấp 8 lần xong Thiết kế (trọng số 5).', meaningEn: 'Overall project progress = weighted sum across the 7 stages. Finishing Fabrication (weight 40) counts 8× more than finishing Design (weight 5).', formulaVi: '% TT = Σ(trọng số × %HT giai đoạn) / Σ(trọng số áp dụng)', formulaEn: '% Actual = Σ(weight × stage %) / Σ(applicable weights)' },
      { fieldVi: 'Cách tính giai đoạn', fieldEn: 'Stage calc mode', meaningVi: 'Nhập tay = người dùng gõ %HT · Theo sản lượng = hệ thống tự tính từ khối lượng hạng mục đã làm.', meaningEn: 'Manual = user types the % · Volume = system computes it from completed work-item tonnage.', formulaVi: '%HT (theo sản lượng) = Σ khối lượng TT / Σ khối lượng KH', formulaEn: '% (volume) = Σ actual qty / Σ planned qty' },
      { fieldVi: 'Đóng góp vào tổng', fieldEn: 'Contribution', meaningVi: 'Phần điểm mà một giai đoạn đang góp vào % TT tổng thể. Cộng cả 7 dòng ra đúng % TT.', meaningEn: 'How many points a stage currently contributes to overall % actual. The 7 rows sum to % actual.', formulaVi: 'Đóng góp = trọng số × %HT / Σ trọng số áp dụng', formulaEn: 'Contribution = weight × stage % / Σ applicable weights' },
      { fieldVi: '% Kế hoạch', fieldEn: '% Plan', meaningVi: 'Theo lịch thì lẽ ra đã xong bao nhiêu phần trăm, tính bằng số ngày đã trôi so với tổng số ngày kế hoạch. Đây là ĐỊNH NGHĨA DUY NHẤT của "% Kế hoạch" trên toàn hệ thống. Thiếu ngày KH bắt đầu/kết thúc thì để trống.', meaningEn: 'How much should be done by the calendar: days elapsed over total planned days. This is the ONLY definition of "% Plan" in the system. Blank when planned start/finish is missing.', formulaVi: '% KH = (Ngày xét − Ngày BĐ KH) / (Ngày KT KH − Ngày BĐ KH), kẹp trong [0, 1]', formulaEn: '% Plan = (Date in question − Planned start) / (Planned finish − Planned start), clamped to [0, 1]' },
      { fieldVi: '% KH nhập tay', fieldEn: '% Plan (manual entry)', meaningVi: 'Con số % kế hoạch do người nhập liệu tự gõ trong form hàng tháng. Chỉ lưu để tra lịch sử và đối chiếu; hệ thống KHÔNG dùng nó để tính PV/SPI hay để hiển thị "% Kế hoạch".', meaningEn: 'The plan % typed by the data-entry user in the monthly form. Stored for history and reconciliation only; it is NOT used for PV/SPI or to display "% Plan".' },
      { fieldVi: 'PV (Giá trị kế hoạch)', fieldEn: 'PV (Planned Value)', meaningVi: 'Phần giá trị hợp đồng lẽ ra đã phải làm xong tính đến thời điểm xét, suy từ % Kế hoạch theo thời gian.', meaningEn: 'The share of contract value that should have been earned by the date in question, derived from the duration-based % Plan.', formulaVi: 'PV = % KH (theo thời gian) × BAC · SPI = EV / PV', formulaEn: 'PV = duration-based % Plan × BAC · SPI = EV / PV' },
    ],
  },
  {
    titleVi: 'Sản lượng, mốc & nguồn lực',
    titleEn: 'Volume, milestones & resources',
    entries: [
      { fieldVi: 'Hạng mục', fieldEn: 'Work item', meaningVi: 'Cụm kết cấu được theo dõi riêng trong dự án (Hệ giàn nâng, Hệ Walkaway…). Danh sách do từng dự án tự định nghĩa.', meaningEn: 'A structural package tracked separately (lifting frame, walkway…). Each project defines its own list.' },
      { fieldVi: 'Sản lượng KH / TT', fieldEn: 'Planned / actual qty', meaningVi: 'Khối lượng thép (tấn) theo kế hoạch và đã làm được, ghi theo từng hạng mục × giai đoạn × tháng.', meaningEn: 'Steel tonnage planned vs completed, recorded per work item × stage × month.' },
      { fieldVi: 'Mốc ngày giai đoạn', fieldEn: 'Stage milestones', meaningVi: 'Mỗi giai đoạn có 6 mốc: KH bắt đầu, KH kết thúc, TT bắt đầu, TT kết thúc, ngày dự báo hoàn thành, và Ngày chênh lệch.', meaningEn: 'Each stage has 6 markers: planned start/finish, actual start/finish, forecast date, and day variance.' },
      { fieldVi: 'Ngày chênh lệch', fieldEn: 'Day variance', meaningVi: 'Giai đoạn kết thúc trễ (số dương) hay sớm (số âm) bao nhiêu ngày so với kế hoạch. Hệ thống tự tính, không ai nhập. Chưa có ngày kết thúc thực tế thì để trống - khác với 0 nghĩa là đúng hạn.', meaningEn: 'How many days the stage finished late (positive) or early (negative) versus plan. Computed, never entered. Blank until there is an actual finish date - different from 0, which means exactly on time.', formulaVi: 'Ngày chênh lệch = Ngày KT thực tế − Ngày KH hoàn thành', formulaEn: 'Day variance = Actual finish − Planned finish' },
      { fieldVi: 'Mốc chính', fieldEn: 'Key milestone', meaningVi: 'Cột mốc quan trọng của dự án do người dùng tự thêm, có ngày kế hoạch và ngày thực tế. Chưa có ngày thực tế = chưa đạt mốc.', meaningEn: 'A user-defined project milestone with planned and actual dates. No actual date = not reached yet.' },
      { fieldVi: 'Nhà thầu', fieldEn: 'Contractor', meaningVi: 'Nhà thầu phụ tham gia dự án, kèm phạm vi công việc.', meaningEn: 'Subcontractor on the project, with its scope of work.' },
      { fieldVi: 'Nhân lực theo ngày', fieldEn: 'Daily manpower', meaningVi: 'Số người kế hoạch và thực tế có mặt mỗi ngày, tách theo từng nhà thầu.', meaningEn: 'Planned vs actual headcount per day, split by contractor.' },
      { fieldVi: 'Thiết bị theo ngày', fieldEn: 'Daily equipment', meaningVi: 'Số lượng từng nhóm thiết bị huy động mỗi ngày. Một nhà thầu dùng nhiều nhóm thiết bị và một nhóm thiết bị có thể dùng chung bởi nhiều nhà thầu.', meaningEn: 'Quantity of each equipment group mobilised per day. One contractor uses many groups; one group can be shared by many contractors.' },
      { fieldVi: 'Tổng nguồn lực', fieldEn: 'Resource totals', meaningVi: 'Con số tổng nhân lực/thiết bị luôn lấy từ bảng THEO NGÀY và là ẢNH CHỤP CỦA NGÀY GẦN NHẤT CÓ DỮ LIỆU, KHÔNG phải cộng dồn cả khoảng (cộng dồn 7 ngày sẽ ra số người gấp 7 lần). Ngày của số liệu luôn được ghi ngay dưới con số.', meaningEn: 'Manpower/equipment totals always come from the DAILY tables and are a SNAPSHOT OF THE LATEST DAY WITH DATA, not a sum over the range (summing 7 days would multiply headcount by 7). The date behind the number is always shown under it.' },
      { fieldVi: 'Nhân lực theo tuần / tháng', fieldEn: 'Manpower by week / month', meaningVi: 'Khi xem biểu đồ nhân lực theo tuần hoặc theo tháng, mỗi điểm là SỐ NGƯỜI TRUNG BÌNH MỖI NGÀY trong khoảng đó, không phải tổng lượt người.', meaningEn: 'In the weekly/monthly manpower chart each point is the AVERAGE HEADCOUNT PER DAY in that bucket, not a sum of person-days.' },
    ],
  },
  {
    titleVi: 'Tài chính',
    titleEn: 'Finance',
    entries: [
      { fieldVi: 'Doanh thu lũy kế', fieldEn: 'Revenue (cumulative)', meaningVi: 'Doanh thu ghi nhận cộng dồn đến tháng này (tỷ).', meaningEn: 'Recognised revenue, cumulative (billion).' },
      { fieldVi: 'Chi phí thực tế lũy kế', fieldEn: 'Actual cost (cumulative)', meaningVi: 'Chi phí thực tế cộng dồn (tỷ).', meaningEn: 'Actual cost, cumulative (billion).' },
      { fieldVi: 'Công nợ đã thu', fieldEn: 'Collected', meaningVi: 'Tiền khách đã thanh toán (tỷ).', meaningEn: 'Amount already collected from client (billion).' },
      { fieldVi: 'Công nợ chưa thu', fieldEn: 'Outstanding', meaningVi: 'Tiền khách còn nợ, chưa đến hạn (tỷ).', meaningEn: 'Amount not yet collected, not yet due (billion).' },
      { fieldVi: 'Công nợ quá hạn', fieldEn: 'Overdue', meaningVi: 'Tiền khách nợ đã quá hạn thanh toán (tỷ).', meaningEn: 'Amount overdue for payment (billion).' },
    ],
  },
  {
    titleVi: 'Chỉ số EVM (hệ thống tự tính)',
    titleEn: 'EVM Metrics (auto-calculated)',
    entries: [
      { fieldVi: 'PV - Giá trị kế hoạch', fieldEn: 'PV - Planned value', meaningVi: 'Số tiền lẽ ra đã "kiếm được" theo kế hoạch.', meaningEn: 'Value that should have been earned per plan.', formulaVi: 'PV = % KH × Giá trị HĐ', formulaEn: 'PV = % Plan × BAC' },
      { fieldVi: 'EV - Giá trị đạt được', fieldEn: 'EV - Earned value', meaningVi: 'Số tiền thực tế đã "kiếm được" theo % hoàn thành.', meaningEn: 'Value actually earned by completion %.', formulaVi: 'EV = % TT × Giá trị HĐ', formulaEn: 'EV = % Actual × BAC' },
      { fieldVi: 'SPI - Chỉ số tiến độ', fieldEn: 'SPI - Schedule index', meaningVi: 'Đang nhanh hay chậm so với kế hoạch. >1 nhanh, =1 đúng, <1 chậm.', meaningEn: 'Ahead or behind schedule. >1 ahead, =1 on track, <1 behind.', formulaVi: 'SPI = EV / PV', formulaEn: 'SPI = EV / PV' },
      { fieldVi: 'CPI - Chỉ số chi phí', fieldEn: 'CPI - Cost index', meaningVi: 'Đang tiêu ít hay nhiều so với dự kiến. >1 tiết kiệm, <1 vượt chi phí.', meaningEn: 'Over or under budget. >1 under, <1 over budget.', formulaVi: 'CPI = EV / AC', formulaEn: 'CPI = EV / AC' },
      { fieldVi: 'EAC - Dự báo tổng chi phí', fieldEn: 'EAC - Estimate at completion', meaningVi: 'Dự báo tổng chi phí khi hoàn thành, dựa trên CPI hiện tại.', meaningEn: 'Forecast total cost at completion, based on current CPI.', formulaVi: 'EAC = BAC / CPI', formulaEn: 'EAC = BAC / CPI' },
      { fieldVi: 'VAC - Chênh lệch ngân sách', fieldEn: 'VAC - Variance at completion', meaningVi: 'Chênh lệch giữa ngân sách và dự báo. Âm = dự kiến vượt chi phí.', meaningEn: 'Gap between budget and forecast. Negative = over budget.', formulaVi: 'VAC = BAC − EAC', formulaEn: 'VAC = BAC − EAC' },
      { fieldVi: 'SV / CV', fieldEn: 'SV / CV', meaningVi: 'Chênh lệch tiến độ (SV) và chi phí (CV) bằng tiền.', meaningEn: 'Schedule and cost variance in money.', formulaVi: 'SV = EV − PV · CV = EV − AC', formulaEn: 'SV = EV − PV · CV = EV − AC' },
    ],
  },
  {
    titleVi: 'Trạng thái & cảnh báo',
    titleEn: 'Status & Alerts',
    entries: [
      { fieldVi: 'Trạng thái dự án', fieldEn: 'Project status', meaningVi: 'Chuẩn bị = chưa có ngày BĐ thực tế · Đang triển khai = có BĐ thực tế + %TT<100% · Hoàn thành = %TT≥100% + có KT thực tế · Tạm dừng.', meaningEn: 'Preparation = no actual start · In progress = has actual start + %actual<100% · Completed = %actual≥100% + has actual finish · Paused.' },
      { fieldVi: 'Đúng / Trễ tiến độ', fieldEn: 'On track / Behind', meaningVi: 'So %TT với %KH (biên 5%). %TT ≥ %KH − 5% → Đúng, thấp hơn → Trễ.', meaningEn: 'Compares %actual vs %plan (5% tolerance). On track if within 5%.', formulaVi: 'Đúng nếu %TT ≥ %KH − 5%', formulaEn: 'On track if %Actual ≥ %Plan − 5%' },
      { fieldVi: 'Nguy cơ phạt HĐ', fieldEn: 'Penalty risk', meaningVi: 'Còn ≤30 ngày đến mốc bàn giao mà %TT chưa đạt 100%.', meaningEn: '≤30 days to handover deadline and %actual < 100%.' },
      { fieldVi: 'Đã phạt HĐ', fieldEn: 'Penalized', meaningVi: 'Đã quá mốc bàn giao chưa nghiệm thu + có quyết định phạt.', meaningEn: 'Past handover deadline without acceptance + penalty issued.' },
      { fieldVi: 'Khâu nghẽn', fieldEn: 'Bottleneck', meaningVi: 'Khâu đầu tiên trong chuỗi (Thiết kế→Shop→Vật tư→Gia công→Vận chuyển→Lắp dựng→Nghiệm thu) chưa đạt 100%.', meaningEn: 'First stage in the chain not yet at 100%.' },
      { fieldVi: 'Backlog', fieldEn: 'Backlog', meaningVi: 'Tổng giá trị HĐ của các dự án đang "Chuẩn bị" (việc sắp tới).', meaningEn: 'Total contract value of projects in "Preparation" (upcoming work).' },
    ],
  },
  {
    titleVi: 'Ngưỡng đánh giá & màu',
    titleEn: 'Thresholds & Colors',
    entries: [
      { fieldVi: `SPI / CPI < ${THRESHOLDS.spiWarn}`, fieldEn: `SPI / CPI < ${THRESHOLDS.spiWarn}`, meaningVi: 'Cảnh báo Amber (Vàng) - gửi nhóm KHDATT.', meaningEn: 'Amber alert - sent to KHDATT team.' },
      { fieldVi: 'Quá hạn / nguy cơ phạt', fieldEn: 'Overdue / penalty risk', meaningVi: 'Cảnh báo Red (Đỏ) - báo BOD.', meaningEn: 'Red alert - escalated to BOD.' },
      { fieldVi: 'Dồn tải xưởng', fieldEn: 'Factory overload', meaningVi: 'Sản lượng tháng > 85% công suất tháng của nhà máy.', meaningEn: 'Monthly output > 85% of factory monthly capacity.' },
      { fieldVi: 'Công nợ quá hạn', fieldEn: 'Overdue receivables', meaningVi: 'Công nợ quá hạn > 5% giá trị HĐ → cảnh báo đỏ.', meaningEn: 'Overdue > 5% of contract value → red alert.' },
      { fieldVi: 'Huy động thiết bị', fieldEn: 'Equipment mobilisation', meaningVi: 'Thực tế < 80% kế hoạch → thiếu nguồn lực.', meaningEn: 'Actual < 80% of plan → under-resourced.' },
    ],
  },
  {
    titleVi: 'Cách đọc từng chart',
    titleEn: 'How to read each chart',
    entries: [
      { fieldVi: 'KPI card', fieldEn: 'KPI cards', meaningVi: '6 con số tổng quan + mũi tên so tháng trước (▲ tăng, ▼ giảm). Đọc nhanh: bao nhiêu dự án đang chạy, bao nhiêu trễ, bao nhiêu nguy cơ phạt.', meaningEn: '6 headline numbers + arrow vs last month (▲ up, ▼ down). Quick read: how many running, behind, at penalty risk.' },
      { fieldVi: 'Donut trạng thái', fieldEn: 'Status donut', meaningVi: 'Tỷ lệ dự án theo trạng thái. Click 1 lát để lọc bảng dưới.', meaningEn: 'Project mix by status. Click a slice to filter the table below.' },
      { fieldVi: 'Bar Lượng & Trị (Team KD)', fieldEn: 'Bar Tonnage & Value', meaningVi: 'Cột = Trị (tỷ, trục trái), đường = Lượng (tấn, trục phải). So sánh quy mô giữa các nhóm kinh doanh.', meaningEn: 'Bars = value (billion, left axis), line = tonnage (right axis). Compare scale across sales teams.' },
      { fieldVi: 'Bar Sản lượng vs Công suất', fieldEn: 'Bar Output vs Capacity', meaningVi: 'Cột xám = công suất tháng của nhà máy, cột màu = sản lượng thực tế. Cột vàng/cam = quá tải (>85%).', meaningEn: 'Grey bar = monthly factory capacity, colored = actual output. Amber = overloaded (>85%).' },
      { fieldVi: 'Line SPI/CPI trend', fieldEn: 'SPI/CPI line', meaningVi: `2 đường theo 6 tháng. Đường ngang ${THRESHOLDS.spiWarn} là ngưỡng - dưới ${THRESHOLDS.spiWarn} là cần chú ý.`, meaningEn: `2 lines over 6 months. The ${THRESHOLDS.spiWarn} horizontal line is the threshold - below it needs attention.` },
      { fieldVi: 'Đường cong S (S-curve)', fieldEn: 'S-curve', meaningVi: 'PV/EV/AC cộng dồn theo tháng. EV nằm dưới PV = chậm tiến độ; AC nằm trên EV = đang tiêu nhiều hơn giá trị làm ra.', meaningEn: 'Cumulative PV/EV/AC. EV below PV = behind; AC above EV = spending more than earned.' },
      { fieldVi: 'Sparkline (đường nhỏ)', fieldEn: 'Sparkline', meaningVi: 'Đường trend nhỏ 6 kỳ của Backlog và Công nợ quá hạn - thấy xu hướng tăng/giảm nhanh.', meaningEn: 'Small 6-period trend of Backlog and Overdue - quick up/down trend.' },
      { fieldVi: 'Watchlist', fieldEn: 'Watchlist', meaningVi: 'Dự án đang trễ/nguy cơ - cần xử lý trước. Click mở chi tiết.', meaningEn: 'Projects behind or at risk - act first. Click to open detail.' },
      { fieldVi: 'Bảng danh sách dự án', fieldEn: 'Project list', meaningVi: 'Lọc theo tháng/trạng thái/team/priority/thị trường/loại hình. Nút "Xuất Excel" tải đúng bảng đang lọc.', meaningEn: 'Filter by month/status/team/priority/market/type. "Export Excel" downloads the filtered table.' },
    ],
  },
  {
    titleVi: 'What-if (%HT tháng sau)',
    titleEn: 'What-if (next month % complete)',
    entries: [
      { fieldVi: 'What-if là gì', fieldEn: 'What it is', meaningVi: 'Thanh trượt trên trang Chi tiết dự án: thử "nếu tháng sau % hoàn thành tăng thêm X% thì EAC/VAC còn bao nhiêu".', meaningEn: 'A slider on the Project Detail page: try "if next month % complete rises X more, what becomes EAC/VAC?".' },
      { fieldVi: 'Tại sao có chỗ này', fieldEn: 'Why it exists', meaningVi: 'Để ước lượng nhanh tác động của việc đẩy tiến độ lên chi phí cuối, mà KHÔNG phải nhập liệu thật vào hệ thống. Chỉ là phép thử tức thời.', meaningEn: 'To quickly estimate how pushing progress affects final cost, WITHOUT writing real data. It is only an instant trial.' },
      { fieldVi: 'Giúp ra quyết định gì', fieldEn: 'What decision it supports', meaningVi: '1) Cần đẩy thêm bao nhiêu % để SPI/CPI về ngưỡng an toàn. 2) Thêm nguồn lực (người/thiết bị) có đáng so với mức giảm EAC không. 3) Dự báo chi phí cuối kỳ (EAC) và chênh lệch ngân sách (VAC) trước khi cam kết với BOD.', meaningEn: '1) How much more % to push to bring SPI/CPI to safe zone. 2) Whether adding resources is worth the EAC reduction. 3) Forecast final cost (EAC) and budget variance (VAC) before committing to BOD.' },
      { fieldVi: 'Cách đọc kết quả', fieldEn: 'How to read the result', meaningVi: 'EAC mới < EAC hiện tại = đẩy nhanh giúp giảm tổng chi phí dự kiến. VAC càng dương = càng có lãi so với ngân sách.', meaningEn: 'New EAC < current EAC = going faster cuts the forecast total cost. The more positive VAC, the better vs budget.' },
    ],
  },
];
