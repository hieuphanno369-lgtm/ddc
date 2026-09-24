'use client';

import type { IsoDate } from '@/lib/clock';
import type { Contractor, Equipment, FactDailyEquipmentUsage, FactDailyManpowerShift, Shift } from '@/server/repo/types';
import { ContractorJoinBlock } from './ContractorJoinBlock';

export interface ResourceEntryPanelProps {
  projectId: number;
  masterCode: string;
  date: IsoDate;
  today: IsoDate;
  entryWindow: { min: IsoDate | null; max: IsoDate };
  monthLocked: boolean;
  members: Contractor[];
  allContractors: Contractor[];
  shifts: Shift[];
  equipments: Equipment[];
  manpower: FactDailyManpowerShift[];
  equipment: FactDailyEquipmentUsage[];
}

/**
 * Bước "Nhân lực & Thiết bị" (B, ke-hoach.md P2A). Task 3: chỉ khối nhà thầu tham gia (G-18).
 * Task 4-5 thêm lưới nhập theo ngày/ca + import Excel (dùng các prop đã truyền sẵn ở đây).
 */
export function ResourceEntryPanel({ projectId, members, allContractors, monthLocked }: ResourceEntryPanelProps) {
  return (
    <div className="space-y-4">
      <ContractorJoinBlock
        projectId={projectId}
        members={members}
        allContractors={allContractors}
        disabled={monthLocked}
      />
    </div>
  );
}
