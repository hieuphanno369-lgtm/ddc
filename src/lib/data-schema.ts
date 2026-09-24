/**
 * Import mapping cho page Sơ đồ dữ liệu (ERD) - khoá ghép & join khi nhập Excel.
 * Danh sách bảng/cột (ERD, từ điển) SINH TỪ `Prisma.dmmf.datamodel` qua `src/lib/schema-meta/`
 * (không viết tay nữa, xem `build.ts`/`docs.ts`) - tránh lệch với schema thật.
 */

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
    join: 'sapCode → projectId → dim_project.id',
  },
  {
    source: 'File Excel (mã hợp đồng cũ)',
    sourceField: 'Mã hợp đồng',
    targetField: 'dim_project_alias.aliasCode',
    join: 'aliasCode → projectId → dim_project.id',
  },
  {
    source: 'File Excel (mã hệ thống)',
    sourceField: 'Mã dự án',
    targetField: 'dim_project.masterCode / currentAliasCode',
    join: 'code → dim_project.id',
  },
  {
    source: 'Dim lookup',
    sourceField: 'Tên khách hàng / team',
    targetField: 'dim_customer.name / dim_team_kd.name (+ aliases)',
    join: 'normalize → customerId / teamKdId',
  },
  {
    source: 'Fact nối theo thời gian',
    sourceField: 'Tháng báo cáo (YYYY-MM)',
    targetField: 'fact_progress_monthly.yearMonth',
    join: 'projectId + yearMonth',
  },
];
