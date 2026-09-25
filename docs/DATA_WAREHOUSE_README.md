# Data Warehouse — DDC Control Tower

> **Nguồn sự thật:** trang `/data-schema` và `/data-dictionary` (sinh từ `prisma/schema.prisma`). Mục 1 (ERD) sinh tự động; các mục khác viết tay ngày 2026-09 trở về trước, **có thể đã cũ** — khi lệch, tin trang web.

Tài liệu cho Data Engineer/Analyst hiểu lại hệ thống mà không cần đọc toàn bộ code.
**Trạng thái hiện tại:** Runtime dùng Prisma + PostgreSQL (`src/server/repo/prisma-repo.ts`); mock chỉ dùng cho test.

---

## 1. ERD (Star Schema)

<!-- ERD:BEGIN (sinh tu dong: npm run docs:erd) -->
```mermaid
erDiagram
    dim_project ||--o{ alert_log : "projectId"
    dim_contractor |o--o{ dim_contractor : "mergedIntoId"
    dim_customer |o--o{ dim_customer : "mergedIntoId"
    dim_currency ||--o{ dim_exchange_rate : "currencyCode"
    dim_currency ||--o{ dim_project : "currencyCode"
    dim_customer ||--o{ dim_project : "customerId"
    dim_factory |o--o{ dim_project : "factoryId"
    dim_team_kd ||--o{ dim_project : "teamKdId"
    dim_project ||--o{ dim_project_alias : "projectId"
    dim_team_kd |o--o{ dim_team_kd : "mergedIntoId"
    dim_contractor ||--o{ fact_daily_equipment_usage : "contractorId"
    dim_equipment ||--o{ fact_daily_equipment_usage : "equipmentId"
    dim_project ||--o{ fact_daily_equipment_usage : "projectId"
    dim_contractor ||--o{ fact_daily_manpower : "contractorId"
    dim_project ||--o{ fact_daily_manpower : "projectId"
    dim_shift ||--o{ fact_daily_manpower : "shiftCode"
    dim_project ||--o{ fact_financial : "projectId"
    dim_stage |o--o{ fact_progress_monthly : "bottleneckStage"
    dim_project ||--o{ fact_progress_monthly : "projectId"
    dim_project ||--o{ fact_stage_milestone : "projectId"
    dim_stage ||--o{ fact_stage_milestone : "stageCode"
    dim_project ||--o{ fact_stage_work_item : "projectId"
    dim_stage ||--o{ fact_stage_work_item : "stageCode"
    project_work_item ||--o{ fact_stage_work_item : "workItemId"
    dim_project ||--o{ fact_value_chain_progress : "projectId"
    dim_stage ||--o{ fact_value_chain_progress : "stageCode"
    dim_factory ||--o{ fact_volume : "factoryId"
    dim_project ||--o{ fact_volume : "projectId"
    notify_channel ||--o{ notify_recipient : "channelId"
    dim_project ||--o{ project_assignments : "projectId"
    dim_contractor ||--o{ project_contractor : "contractorId"
    dim_project ||--o{ project_contractor : "projectId"
    dim_equipment ||--o{ project_equipment_plan : "equipmentId"
    dim_project ||--o{ project_equipment_plan : "projectId"
    project_work_item |o--o{ project_equipment_plan : "workItemId"
    dim_project ||--o{ project_history : "projectId"
    dim_project ||--o{ project_key_milestone : "projectId"
    dim_project ||--o{ project_photos : "projectId"
    dim_project ||--o{ project_sap_codes : "projectId"
    dim_project ||--o{ project_stage_weight : "projectId"
    dim_stage ||--o{ project_stage_weight : "stageCode"
    dim_project ||--o{ project_work_item : "projectId"
    dim_project |o--o{ sap_queue : "projectId"

    activity_log {
      Int id PK
      String userEmail
      String userName
      String action
      String detail
      String ip
      String userAgent
      DateTime createdAt
    }
    alert_log {
      Int id PK
      Int projectId FK
      AlertType alertType
      String ruleTriggered
      String message
      DateTime openedAt
      DateTime closedAt
      String owner
      String action
      String deadline
      String ruleCode
      String dedupeKey
      String closedBy
      String closeNote
      String notifyChannel
      DateTime notifySentAt
      String notifyError
      Int notifyAttempts
    }
    audit_log {
      Int id PK
      String tableName
      String recordId
      String field
      String oldValue
      String newValue
      String changedBy
      DateTime changedAt
      String note
    }
    dim_contractor {
      Int id PK
      String name
      String scopeOfWork
      Boolean isActive
      Int mergedIntoId FK
    }
    dim_currency {
      String code PK
      String name
    }
    dim_customer {
      Int id PK
      String name
      String group
      StringArray aliases
      Boolean isActive
      Int mergedIntoId FK
    }
    dim_date {
      Date date PK
      String yearMonth
      Int isoYear
      Int isoWeek
      Date weekStart
      Int dayOfWeek
    }
    dim_equipment {
      Int id PK
      String name
      String unit
      Boolean isActive
    }
    dim_exchange_rate {
      String currencyCode PK,FK
      String yearMonth PK
      Float rateToVnd
      String source
      String updatedBy
      DateTime updatedAt
    }
    dim_factory {
      Int id PK
      String name
      String region
      Float capacityTonPerYear
      Boolean isActive
    }
    dim_project {
      Int id PK
      String masterCode
      String currentAliasCode
      String projectName
      Int customerId FK
      Int teamKdId FK
      MarketCode marketCode
      ProjectTypeCode projectType
      PriorityCode priority
      Float contractValue
      Float tonnage
      String currencyCode FK
      DateTime contractDate
      DateTime plannedStartDate
      DateTime plannedFinishDate
      DateTime committedHandoverDate
      DateTime actualStartDate
      DateTime actualFinishDate
      Float penaltyValue
      Boolean penalized
      Boolean isActive
      Int factoryId FK
      Float contractValueOriginal
      DateTime createdAt
      DateTime updatedAt
      String createdBy
      String updatedBy
    }
    dim_project_alias {
      Int id PK
      Int projectId FK
      String aliasCode
      String aliasType
      DateTime effectiveFrom
      DateTime effectiveTo
      String reason
      String approvedBy
    }
    dim_shift {
      String code PK
      String nameVi
      String nameEn
      Int sortOrder
      Boolean isActive
    }
    dim_stage {
      String code PK
      String nameVi
      String nameEn
      Int sortOrder
      StageCalcMode calcMode
    }
    dim_team_kd {
      Int id PK
      String name
      String picName
      StringArray aliases
      Boolean isActive
      Int mergedIntoId FK
    }
    fact_daily_equipment_usage {
      Int projectId PK,FK
      Int contractorId PK,FK
      Int equipmentId PK,FK
      Date workDate PK
      Int qtyPlanned
      Int qtyActual
      DateTime updatedAt
      String updatedBy
    }
    fact_daily_manpower {
      Int projectId PK,FK
      Int contractorId PK,FK
      Date workDate PK
      String shiftCode PK,FK
      Int plannedHeadcount
      Int actualHeadcount
      DateTime updatedAt
      String updatedBy
    }
    fact_financial {
      Int projectId PK,FK
      String yearMonth PK
      Int version PK
      Boolean isLatest
      Float revenuePeriod
      Float revenueCumulative
      Float costActualPeriod
      Float costActualCumulative
      Float grossProfit
      Float grossMarginPct
      Float backlog
      Float arCollected
      Float arOutstanding
      Float arOverdue
      String changedBy
      DateTime changedAt
      String changeNote
    }
    fact_progress_monthly {
      Int projectId PK,FK
      String yearMonth PK
      Int version PK
      Boolean isLatest
      Float pctPlan
      Float pctActual
      DateTime actualStartDate
      DateTime actualFinishDate
      Float bac
      Float pv
      Float ev
      Float ac
      Float spi
      Float cpi
      String bottleneckStage FK
      Int manpowerPlanned
      Int manpowerActual
      Int equipmentPlanned
      Int equipmentActual
      DateTime snapshotLockedAt
      String lockedBy
      String changedBy
      DateTime changedAt
      String changeNote
    }
    fact_stage_milestone {
      Int projectId PK,FK
      String stageCode PK,FK
      DateTime plannedStart
      DateTime plannedFinish
      DateTime actualStart
      DateTime actualFinish
      DateTime forecastDate
      DateTime updatedAt
      String updatedBy
    }
    fact_stage_work_item {
      Int projectId PK,FK
      String stageCode PK,FK
      Int workItemId PK,FK
      String yearMonth PK
      Float qtyPlan
      Float qtyActual
    }
    fact_value_chain_progress {
      Int projectId PK,FK
      String stageCode PK,FK
      String yearMonth PK
      Float pctComplete
      Boolean applicable
    }
    fact_volume {
      Int projectId PK,FK
      String yearMonth PK
      Int factoryId PK,FK
      Float tonnageProcessed
      DateTime updatedAt
      String updatedBy
    }
    job_run {
      Int id PK
      String jobName
      String trigger
      String status
      String detail
      DateTime startedAt
      DateTime finishedAt
      String startedBy
    }
    notify_channel {
      Int id PK
      NotifyKind kind
      String name
      Boolean isEnabled
      AlertType minSeverity
      Json settings
      String secretEnc
      String secretHint
      DateTime updatedAt
      String updatedBy
    }
    notify_recipient {
      Int id PK
      Int channelId FK
      String email
      AlertType minSeverity
      Boolean isEnabled
    }
    project_assignments {
      Int projectId PK,FK
      String userEmail PK
      RoleInProject roleInProject
      String assignedBy
      DateTime assignedAt
    }
    project_contractor {
      Int projectId PK,FK
      Int contractorId PK,FK
    }
    project_equipment_plan {
      Int id PK
      Int projectId FK
      Int equipmentId FK
      Int unitNo
      Int workItemId FK
      Date plannedStart
      Date plannedFinish
      String note
      DateTime updatedAt
      String updatedBy
    }
    project_history {
      Int id PK
      Int projectId FK
      DateTime at
      String by
      String note
      Json snapshot
    }
    project_key_milestone {
      Int id PK
      Int projectId FK
      String name
      Int sortOrder
      DateTime plannedDate
      DateTime actualDate
    }
    project_photos {
      Int id PK
      Int projectId FK
      String yearMonth
      String url
      String caption
      String uploadedBy
      DateTime uploadedAt
    }
    project_sap_codes {
      Int id PK
      Int projectId FK
      String sapCode
      String sourceDocType
      DateTime linkedAt
      String linkedBy
      String note
    }
    project_stage_weight {
      Int projectId PK,FK
      String stageCode PK,FK
      Float weightPct
      Boolean applicable
    }
    project_work_item {
      Int id PK
      Int projectId FK
      String name
      Int sortOrder
    }
    sap_queue {
      Int id PK
      String sapCode
      String sourceDocType
      String projectNameHint
      SapQueueStatus status
      Int projectId FK
      DateTime detectedAt
    }
    user_roles {
      String email PK
      String name
      String passwordHash
      String role
      Boolean canViewFinance
      Boolean isActive
      DateTime createdAt
      DateTime lastLoginAt
    }
```
<!-- ERD:END -->

**Nguyên tắc khóa:** mọi fact JOIN qua `project_id` (surrogate int), KHÔNG qua mã dự án text — vì mã đổi qua các kỳ (`dim_project_alias`) gây gãy trend.

---

## 2. Công thức cột derived (tính ở đâu)

| Cột | Công thức | Nguồn | Nơi tính |
|---|---|---|---|
| `pv` | `%KH × BAC (contract_value)` | fact_progress_monthly | `src/lib/evm.ts` → `calcPv` |
| `ev` | `%TT × BAC` | fact_progress_monthly | `evm.ts` → `calcEv` |
| `spi` | `EV / PV` | — | `evm.ts` → `calcSpi` |
| `cpi` | `EV / AC` | — | `evm.ts` → `calcCpi` |
| `eac` | `BAC / CPI` | — | `evm.ts` → `calcEac` |
| `vac` | `BAC − EAC` | — | `evm.ts` → `calcVac` |
| `sv` / `cv` | `EV − PV` / `EV − AC` | — | `evm.ts` |
| Trạng thái dự án | Chuẩn bị / Đang / Hoàn thành (theo ngày BĐ/KT + %TT) | dim_project + fact | `evm.ts` → `deriveStatus` |
| Đúng/Trễ tiến độ | `%TT ≥ %KH − 5%` → Đúng | — | `evm.ts` → `isOnTrack` |
| Nguy cơ phạt | `(cam kết − hôm nay) ≤ 30 ngày ∧ %TT < 100% ∧ chưa phạt` | — | `evm.ts` → `penaltyState` |
| Khâu nghẽn | Stage đầu tiên (Thiết kế→…→Nghiệm thu) có %HT < 100% | fact_value_chain_progress | `evm.ts` → `findBottleneck` |
| Backlog | `SUM(contract_value)` khi trạng thái = Chuẩn bị | — | `queries.ts` |
| Cảnh báo công nợ | `ar_overdue > 5% × contract_value` | fact_financial | `evm.ts` → `isOverdueWarning` |
| Cảnh báo dồn tải | `tonnage_tháng > 85% × (capacity/12)` | fact_volume | `evm.ts` → `isCapacityWarning` |

**Nơi sửa công thức/ngưỡng (KHÔNG rải rác):**
- Công thức tính → `src/lib/evm.ts`.
- Ngưỡng đánh giá → `src/lib/thresholds.ts` (SPI 0.9, biên 5%, 30 ngày, 85%, 5%, 80%).
- (Khi lên DB thật: `v_project_metrics` view chứa SPI/CPI/EAC/Backlog/trạng thái đã tính sẵn — hiệu năng Overview.)

---

## 3. Quy tắc NULL

| Cột | NULL nghĩa là | Xử lý hiển thị |
|---|---|---|
| `spi`/`cpi`/`eac`/`vac` | chưa đủ dữ liệu (PV/AC = 0) | `—` (KHÔNG mặc định 0) |
| `contract_date`, các `*_date` | chưa nhập | `—` |
| `ar_overdue` | **LỖI** — phải có (mặc định 0) | hiển thị 0, coi là bug nếu null |
| `pct_plan`/`pct_actual` | **LỖI** đối với dự án Đang triển khai | block submit |
| `committed_handover_date` | **LỖI** khi trạng thái = Đang triển khai | block submit (validate) |

Cột tài chính NULL ≠ 0. Công nợ NULL không được hiểu là "công nợ 0".

---

## 4. ETL / Data flow

```mermaid
flowchart LR
    A[PM nhập form Nhập liệu] --> B[Validate client + server Zod]
    B --> C[Server Action ghi fact table]
    C --> D[recompute EVM: evm.ts]
    D --> E[revalidatePath/tag hẹp]
    E --> F[Dashboard đọc pre-aggregated]
    I[Import Excel] --> J[resolve mã SAP qua project_sap_codes]
    J -->|SAP đã biết| C
    J -->|SAP lạ| K[sap_queue chờ Trưởng phòng duyệt]
    K -->|duyệt → project_id| J
    L[Trưởng phòng khóa tháng] --> M[snapshot_locked_at → chặn sửa retroactive]
```

**Real-time:** Instant-on-submit — Server Action ghi → `revalidatePath` → trang load lại, không WebSocket.

---

## 5. Data lineage (trường chính → dim/fact)

| Nguồn MasterData | Đích | Transform |
|---|---|---|
| Mã dự án (CCM/TCTN) | `dim_project.current_alias_code` + `dim_project_alias` (SCD2) | resolve qua alias |
| Mã SAP | `project_sap_codes.sap_code` | 1-nhiều, không thay thế |
| Tên dự án / Khách hàng / Team KD | `dim_project` + `dim_customer`/`dim_team_kd` | chuẩn hóa |
| Loại hình / Thị trường / Priority | `dim_project` | enum |
| % KH / % TT lũy kế | `fact_progress_monthly.pct_plan/pct_actual` | % ∈ [0, 1.5] |
| AC lũy kế | `fact_progress_monthly.ac` | tỷ VNĐ |
| PV/EV/SPI/CPI/EAC/VAC | derived | tính qua `evm.ts` |
| % HT Shop/Vật tư/… | `fact_value_chain_progress.pct_complete` (theo stage) | map stage |
| Doanh thu / Chi phí / Công nợ | `fact_financial` | lũy kế + kỳ |
| Khối lượng (tấn) | `fact_volume.tonnage_processed` | theo factory |
