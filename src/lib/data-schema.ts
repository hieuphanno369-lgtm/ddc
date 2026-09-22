/**
 * Data Schema - mô hình dữ liệu (star schema) dùng cho page Sơ đồ dữ liệu (ERD).
 * Mục đích: khi import, user biết cần field gì + join thế nào để đúng dữ liệu.
 * Mirror `src/server/repo/types.ts` - single source of truth là types.ts.
 */

export type SchemaKey = 'PK' | 'FK';

export interface SchemaField {
  name: string;
  type: string;
  key?: SchemaKey;
  ref?: string; // target khi key = FK
  desc?: string;
}

export type SchemaKind = 'dim' | 'project' | 'fact' | 'support';

export interface SchemaEntity {
  name: string;
  kind: SchemaKind;
  desc: string;
  fields: SchemaField[];
}

export const SCHEMA_ENTITIES: SchemaEntity[] = [
  {
    name: 'customers',
    kind: 'dim',
    desc: 'Khách hàng / chủ đầu tư (chuẩn hóa, có alias để gộp trùng).',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'name', type: 'string', desc: 'tên chuẩn (Vingroup, SunGroup…)' },
      { name: 'group', type: 'string' },
      { name: 'aliases', type: 'string[]', desc: 'tên cũ/đồng nghĩa' },
      { name: 'isActive', type: 'bool' },
      { name: 'mergedIntoId', type: 'int?', key: 'FK', ref: 'customers.id' },
    ],
  },
  {
    name: 'teams',
    kind: 'dim',
    desc: 'Team kinh doanh (P.KD 01…10, nội bộ).',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'name', type: 'string' },
      { name: 'picName', type: 'string' },
      { name: 'aliases', type: 'string[]' },
      { name: 'isActive', type: 'bool' },
      { name: 'mergedIntoId', type: 'int?', key: 'FK', ref: 'teams.id' },
    ],
  },
  {
    name: 'factories',
    kind: 'dim',
    desc: 'Nhà máy gia công.',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'name', type: 'string' },
      { name: 'region', type: 'string' },
      { name: 'capacityTonPerYear', type: 'number' },
    ],
  },
  {
    name: 'dim_stage',
    kind: 'dim',
    desc: '7 giai đoạn chuỗi giá trị - dimension thật (trước đây là hằng số trong code).',
    fields: [
      { name: 'code', type: 'string', key: 'PK', desc: 'design…handover' },
      { name: 'nameVi', type: 'string' },
      { name: 'nameEn', type: 'string' },
      { name: 'sortOrder', type: 'int', desc: 'thứ tự trong chuỗi giá trị' },
      { name: 'calcMode', type: 'string', desc: 'manual = nhập tay %HT · volume = suy từ sản lượng hạng mục' },
    ],
  },
  {
    name: 'dim_contractor',
    kind: 'dim',
    desc: 'Nhà thầu phụ (chuẩn hóa, gộp trùng qua mergedIntoId như dim_customer).',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'name', type: 'string' },
      { name: 'scopeOfWork', type: 'string', desc: 'phạm vi công việc' },
      { name: 'isActive', type: 'bool' },
      { name: 'mergedIntoId', type: 'int?', key: 'FK', ref: 'dim_contractor.id' },
    ],
  },
  {
    name: 'dim_equipment',
    kind: 'dim',
    desc: 'Nhóm thiết bị thi công.',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'name', type: 'string' },
      { name: 'unit', type: 'string', desc: 'đơn vị đếm (cái, bộ…)' },
      { name: 'isActive', type: 'bool' },
    ],
  },
  {
    name: 'currencies',
    kind: 'dim',
    desc: 'Đơn vị tiền tệ.',
    fields: [
      { name: 'code', type: 'string', key: 'PK' },
      { name: 'name', type: 'string' },
    ],
  },
  {
    name: 'exchange_rates',
    kind: 'dim',
    desc: 'Tỷ giá theo tháng.',
    fields: [
      { name: 'currencyCode', type: 'string', key: 'FK', ref: 'currencies.code' },
      { name: 'yearMonth', type: 'string (YYYY-MM)' },
      { name: 'rateToVnd', type: 'number' },
    ],
  },
  {
    name: 'projects',
    kind: 'project',
    desc: 'Hub trung tâm - 1 dòng = 1 dự án.',
    fields: [
      { name: 'id', type: 'int', key: 'PK', desc: 'khóa ghép chính cho mọi fact' },
      { name: 'masterCode', type: 'string', desc: 'mã surrogate (M-00001)' },
      { name: 'currentAliasCode', type: 'string', desc: 'mã hiện hành' },
      { name: 'projectName', type: 'string' },
      { name: 'customerId', type: 'int', key: 'FK', ref: 'customers.id' },
      { name: 'teamKdId', type: 'int', key: 'FK', ref: 'teams.id' },
      { name: 'marketCode', type: 'string', desc: 'TN | XK | NoiBo' },
      { name: 'projectType', type: 'string', desc: 'EPC | San_bay | Nha_xuong…' },
      { name: 'priority', type: 'string', desc: 'P0…P3' },
      { name: 'contractValue', type: 'number', desc: 'BAC - mốc ngân sách EVM' },
      { name: 'tonnage', type: 'number' },
      { name: 'currencyCode', type: 'string', key: 'FK', ref: 'currencies.code' },
      { name: 'contractDate', type: 'date?' },
      { name: 'plannedStartDate', type: 'date?' },
      { name: 'plannedFinishDate', type: 'date?' },
      { name: 'committedHandoverDate', type: 'date?', desc: 'mốc tính nguy cơ phạt HĐ' },
      { name: 'actualStartDate', type: 'date?' },
      { name: 'actualFinishDate', type: 'date?' },
      { name: 'penaltyValue', type: 'number?' },
      { name: 'penalized', type: 'bool' },
      { name: 'isActive', type: 'bool' },
      { name: 'createdAt', type: 'datetime' },
      { name: 'updatedAt', type: 'datetime' },
      { name: 'createdBy', type: 'string' },
      { name: 'updatedBy', type: 'string' },
    ],
  },
  {
    name: 'project_history',
    kind: 'support',
    desc: 'Snapshot hồ sơ dự án trước mỗi lần sửa (append-only, không ghi đè).',
    fields: [
      { name: 'at', type: 'datetime', desc: 'thời điểm snapshot' },
      { name: 'by', type: 'string', desc: 'người sửa' },
      { name: 'note', type: 'string', desc: 'mô tả thay đổi' },
      { name: 'snapshot', type: 'json (Project)', desc: 'bản chụp toàn bộ dự án' },
    ],
  },
  {
    name: 'fact_progress_monthly',
    kind: 'fact',
    desc: 'Tiến độ theo tháng (%KH nhập tay, %TT, PV/EV/AC) - append-only.',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'yearMonth', type: 'string (YYYY-MM)' },
      { name: 'pctPlan', type: 'number', desc: '% KH NGƯỜI DÙNG NHẬP TAY - chỉ để tra lịch sử. PV/SPI và "% Kế hoạch" hiển thị đều tính từ thời gian (Q2).' },
      { name: 'pctActual', type: 'number' },
      { name: 'actualStartDate', type: 'date?' },
      { name: 'actualFinishDate', type: 'date?' },
      { name: 'bac', type: 'number', desc: 'snapshot contractValue' },
      { name: 'pv', type: 'number' },
      { name: 'ev', type: 'number' },
      { name: 'ac', type: 'number' },
      { name: 'spi', type: 'number?', desc: 'EV/PV' },
      { name: 'cpi', type: 'number?', desc: 'EV/AC' },
      { name: 'bottleneckStage', type: 'string?' },
      { name: 'isLatest', type: 'bool', desc: 'true = bản mới nhất của (projectId, yearMonth)' },
      { name: 'manpowerPlanned', type: 'number', desc: 'số tháng nhập tay - scorecard nhân lực/thiết bị đọc bảng theo ngày (Q3)' },
      { name: 'manpowerActual', type: 'number', desc: 'số tháng nhập tay - scorecard nhân lực/thiết bị đọc bảng theo ngày (Q3)' },
      { name: 'equipmentPlanned', type: 'number', desc: 'số tháng nhập tay - scorecard nhân lực/thiết bị đọc bảng theo ngày (Q3)' },
      { name: 'equipmentActual', type: 'number', desc: 'số tháng nhập tay - scorecard nhân lực/thiết bị đọc bảng theo ngày (Q3)' },
      { name: 'snapshotLockedAt', type: 'datetime?', desc: 'khóa tháng (Trưởng phòng)' },
      { name: 'lockedBy', type: 'string?' },
      { name: 'version', type: 'int', desc: 'khoá chính gồm cả version - lịch sử KHÔNG bị ghi đè' },
      { name: 'changedBy', type: 'string' },
      { name: 'changedAt', type: 'datetime' },
      { name: 'changeNote', type: 'string', desc: 'auto: "pctActual: 45 → 50"' },
    ],
  },
  {
    name: 'fact_financial',
    kind: 'fact',
    desc: 'Tài chính theo tháng (doanh thu, chi phí, công nợ).',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'yearMonth', type: 'string (YYYY-MM)' },
      { name: 'revenuePeriod', type: 'number' },
      { name: 'revenueCumulative', type: 'number' },
      { name: 'costActualPeriod', type: 'number' },
      { name: 'costActualCumulative', type: 'number' },
      { name: 'grossProfit', type: 'number' },
      { name: 'grossMarginPct', type: 'number' },
      { name: 'backlog', type: 'number' },
      { name: 'arCollected', type: 'number' },
      { name: 'arOutstanding', type: 'number' },
      { name: 'arOverdue', type: 'number' },
      { name: 'version', type: 'int' },
      { name: 'isLatest', type: 'bool' },
      { name: 'changedBy', type: 'string' },
      { name: 'changedAt', type: 'datetime' },
      { name: 'changeNote', type: 'string' },
    ],
  },
  {
    name: 'fact_volume',
    kind: 'fact',
    desc: 'Sản lượng (tấn) theo nhà máy theo tháng.',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'factoryId', type: 'int', key: 'FK', ref: 'factories.id' },
      { name: 'yearMonth', type: 'string (YYYY-MM)' },
      { name: 'tonnageProcessed', type: 'number' },
    ],
  },
  {
    name: 'value_chain_progress',
    kind: 'fact',
    desc: '% hoàn thành từng khâu chuỗi giá trị.',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'stageCode', type: 'string', key: 'FK', ref: 'dim_stage.code' },
      { name: 'yearMonth', type: 'string (YYYY-MM)' },
      { name: 'pctComplete', type: 'number' },
      { name: 'applicable', type: 'bool', desc: 'false = dự án không có giai đoạn này' },
    ],
  },
  {
    name: 'project_stage_weight',
    kind: 'support',
    desc: 'Trọng số từng giai đoạn theo dự án. Tổng các giai đoạn áp dụng = 100.',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'stageCode', type: 'string', key: 'FK', ref: 'dim_stage.code' },
      { name: 'weightPct', type: 'number', desc: 'ĐIỂM phần trăm 0..100 (Gia công = 40), KHÔNG phải phân số' },
      { name: 'applicable', type: 'bool', desc: 'false = dự án không có giai đoạn này' },
    ],
  },
  {
    name: 'project_work_item',
    kind: 'support',
    desc: 'Hạng mục động theo dự án (Hệ giàn nâng … Hệ Walkaway).',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'name', type: 'string', desc: 'duy nhất trong 1 dự án' },
      { name: 'sortOrder', type: 'int' },
    ],
  },
  {
    name: 'fact_stage_work_item',
    kind: 'fact',
    desc: 'Sản lượng KH/TT (tấn) theo hạng mục × giai đoạn × tháng. Nguồn tính %HT giai đoạn định lượng.',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'stageCode', type: 'string', key: 'FK', ref: 'dim_stage.code' },
      { name: 'workItemId', type: 'int', key: 'FK', ref: 'project_work_item.id' },
      { name: 'yearMonth', type: 'string (YYYY-MM)' },
      { name: 'qtyPlan', type: 'number', desc: 'tấn' },
      { name: 'qtyActual', type: 'number', desc: 'tấn' },
    ],
  },
  {
    name: 'fact_stage_milestone',
    kind: 'fact',
    desc: 'Các mốc ngày của từng giai đoạn trong 1 dự án. "Ngày chênh lệch" KHÔNG phải cột: hệ thống tự tính = TT kết thúc − KH hoàn thành.',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'stageCode', type: 'string', key: 'FK', ref: 'dim_stage.code' },
      { name: 'plannedStart', type: 'date?' },
      { name: 'plannedFinish', type: 'date?' },
      { name: 'actualStart', type: 'date?' },
      { name: 'actualFinish', type: 'date?' },
      { name: 'forecastDate', type: 'date?', desc: 'ngày dự báo hoàn thành hiện tại' },
      { name: 'updatedAt', type: 'datetime' },
      { name: 'updatedBy', type: 'string' },
    ],
  },
  {
    name: 'project_key_milestone',
    kind: 'support',
    desc: 'Mốc chính của dự án - danh sách động, do người dùng tự định nghĩa.',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'name', type: 'string' },
      { name: 'sortOrder', type: 'int' },
      { name: 'plannedDate', type: 'date?' },
      { name: 'actualDate', type: 'date?', desc: 'null = chưa đạt mốc' },
    ],
  },
  {
    name: 'project_contractor',
    kind: 'support',
    desc: 'Nhà thầu tham gia dự án.',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'contractorId', type: 'int', key: 'FK', ref: 'dim_contractor.id' },
    ],
  },
  {
    name: 'fact_daily_manpower',
    kind: 'fact',
    desc: 'Nhân lực theo NGÀY theo nhà thầu.',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'contractorId', type: 'int', key: 'FK', ref: 'dim_contractor.id' },
      { name: 'workDate', type: 'date' },
      { name: 'plannedHeadcount', type: 'int' },
      { name: 'actualHeadcount', type: 'int' },
    ],
  },
  {
    name: 'fact_daily_equipment_usage',
    kind: 'fact',
    desc: 'Thiết bị theo NGÀY - bảng nối nhiều-nhiều giữa nhà thầu và nhóm thiết bị.',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'contractorId', type: 'int', key: 'FK', ref: 'dim_contractor.id' },
      { name: 'equipmentId', type: 'int', key: 'FK', ref: 'dim_equipment.id' },
      { name: 'workDate', type: 'date' },
      { name: 'qtyPlanned', type: 'int' },
      { name: 'qtyActual', type: 'int' },
    ],
  },
  {
    name: 'project_aliases',
    kind: 'support',
    desc: 'Mã hợp đồng cũ / nội bộ của dự án.',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'aliasCode', type: 'string', desc: 'khóa ghép khi import bằng mã cũ' },
      { name: 'aliasType', type: 'string', desc: 'Ma_CT | Ma_noi_bo' },
      { name: 'effectiveFrom', type: 'date' },
      { name: 'effectiveTo', type: 'date?' },
      { name: 'reason', type: 'string' },
      { name: 'approvedBy', type: 'string' },
    ],
  },
  {
    name: 'project_sap_codes',
    kind: 'support',
    desc: 'Mã SAP liên kết dự án - khóa ghép import chính.',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'sapCode', type: 'string', desc: 'khóa ghép: Excel SAP → projectId' },
      { name: 'sourceDocType', type: 'string' },
      { name: 'linkedAt', type: 'datetime' },
      { name: 'linkedBy', type: 'string' },
      { name: 'note', type: 'string' },
    ],
  },
  {
    name: 'project_photos',
    kind: 'support',
    desc: 'Ảnh tiến độ theo dự án theo tháng.',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'yearMonth', type: 'string (YYYY-MM)' },
      { name: 'url', type: 'string' },
      { name: 'caption', type: 'string' },
      { name: 'uploadedBy', type: 'string' },
      { name: 'uploadedAt', type: 'datetime' },
    ],
  },
  {
    name: 'project_assignments',
    kind: 'support',
    desc: 'Phân quyền PIC/Backup theo dự án.',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'userEmail', type: 'string', key: 'FK', ref: 'user_roles.email' },
      { name: 'roleInProject', type: 'string', desc: 'PIC | Backup' },
      { name: 'assignedBy', type: 'string' },
      { name: 'assignedAt', type: 'datetime' },
    ],
  },
  {
    name: 'user_roles',
    kind: 'support',
    desc: 'Tài khoản + quyền.',
    fields: [
      { name: 'email', type: 'string', key: 'PK' },
      { name: 'name', type: 'string' },
      { name: 'passwordHash', type: 'string' },
      { name: 'role', type: 'string', desc: 'admin | bod | data-entry | viewer' },
      { name: 'canViewFinance', type: 'bool' },
      { name: 'isActive', type: 'bool' },
      { name: 'createdAt', type: 'datetime' },
      { name: 'lastLoginAt', type: 'datetime?' },
    ],
  },
  {
    name: 'sap_queue',
    kind: 'support',
    desc: 'Hàng đợi mã SAP lạ chờ duyệt (staging import).',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'sapCode', type: 'string' },
      { name: 'sourceDocType', type: 'string' },
      { name: 'projectNameHint', type: 'string' },
      { name: 'status', type: 'string', desc: 'pending | resolved' },
      { name: 'projectId', type: 'int?', key: 'FK', ref: 'projects.id' },
      { name: 'detectedAt', type: 'datetime' },
    ],
  },
  {
    name: 'alert_log',
    kind: 'support',
    desc: 'Cảnh báo Red/Amber.',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'alertType', type: 'string', desc: 'Red | Amber' },
      { name: 'ruleTriggered', type: 'string' },
      { name: 'message', type: 'string' },
      { name: 'openedAt', type: 'datetime' },
      { name: 'closedAt', type: 'datetime?' },
      { name: 'owner', type: 'string' },
      { name: 'action', type: 'string' },
      { name: 'deadline', type: 'string' },
    ],
  },
  {
    name: 'audit_log',
    kind: 'support',
    desc: 'Nhật ký thay đổi dữ liệu.',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'tableName', type: 'string' },
      { name: 'recordId', type: 'string' },
      { name: 'field', type: 'string' },
      { name: 'oldValue', type: 'string' },
      { name: 'newValue', type: 'string' },
      { name: 'changedBy', type: 'string' },
      { name: 'changedAt', type: 'datetime' },
    ],
  },
  {
    name: 'activity_log',
    kind: 'support',
    desc: 'Nhật ký hoạt động người dùng (14 ngày).',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'userEmail', type: 'string' },
      { name: 'userName', type: 'string' },
      { name: 'action', type: 'string' },
      { name: 'detail', type: 'string' },
      { name: 'ip', type: 'string' },
      { name: 'userAgent', type: 'string' },
      { name: 'createdAt', type: 'datetime' },
    ],
  },
];

/** Khóa ghép import: nguồn ngoài (Excel) → khóa trong → join tiếp. */
export interface ImportMapping {
  source: string;
  sourceField: string;
  targetField: string;
  join: string;
}

export const IMPORT_MAPPING: ImportMapping[] = [
  {
    source: 'File Excel (SAP / khách)',
    sourceField: 'Mã SAP',
    targetField: 'project_sap_codes.sapCode',
    join: 'sapCode → projectId → projects.id',
  },
  {
    source: 'File Excel (mã hợp đồng cũ)',
    sourceField: 'Mã hợp đồng',
    targetField: 'project_aliases.aliasCode',
    join: 'aliasCode → projectId → projects.id',
  },
  {
    source: 'File Excel (mã hệ thống)',
    sourceField: 'Mã dự án',
    targetField: 'projects.masterCode / currentAliasCode',
    join: 'code → projects.id',
  },
  {
    source: 'Dim lookup',
    sourceField: 'Tên khách hàng / team',
    targetField: 'customers.name / teams.name (+ aliases)',
    join: 'normalize → customerId / teamKdId',
  },
  {
    source: 'Fact nối theo thời gian',
    sourceField: 'Tháng báo cáo (YYYY-MM)',
    targetField: 'fact_progress_monthly.yearMonth',
    join: 'projectId + yearMonth',
  },
];
