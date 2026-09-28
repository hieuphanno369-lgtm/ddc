import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findMany, mpFindMany, mpUpdate, mpCreate, eqFindMany, eqUpdate, eqCreate, auditCreate, transactionMock,
} = vi.hoisted(() => ({
  findMany: vi.fn(),
  mpFindMany: vi.fn(async (): Promise<unknown[]> => []),
  mpUpdate: vi.fn(async (_args: unknown) => ({})),
  mpCreate: vi.fn(async (_args: unknown) => ({})),
  eqFindMany: vi.fn(async (): Promise<unknown[]> => []),
  eqUpdate: vi.fn(async (_args: unknown) => ({})),
  eqCreate: vi.fn(async (_args: unknown) => ({})),
  auditCreate: vi.fn(async (_args: { data: { note: string } }) => ({})),
  transactionMock: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    factDailyManpower: { findMany, update: mpUpdate, create: mpCreate },
    factDailyEquipmentUsage: { findMany: eqFindMany, update: eqUpdate, create: eqCreate },
    auditLog: { create: auditCreate },
    shift: { findMany: vi.fn() },
    $transaction: transactionMock,
  },
}));

import { entryPrismaRepo } from './prisma-repo-entry';

beforeEach(() => {
  findMany.mockReset();
  mpFindMany.mockClear();
  mpUpdate.mockClear();
  mpCreate.mockClear();
  eqFindMany.mockClear();
  eqUpdate.mockClear();
  eqCreate.mockClear();
  auditCreate.mockClear();
  transactionMock.mockReset();
});

describe('prisma-repo-entry.getDailyManpowerByShift', () => {
  it('goi findMany voi workDate gte/lte 00:00Z va map workDate ve YYYY-MM-DD', async () => {
    findMany.mockResolvedValueOnce([
      {
        projectId: 1, contractorId: 1, workDate: new Date('2026-09-16T00:00:00.000Z'),
        shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4,
      },
    ]);

    const rows = await entryPrismaRepo.getDailyManpowerByShift(1, '2026-09-16', '2026-09-16');

    expect(findMany).toHaveBeenCalledWith({
      where: { projectId: 1, workDate: { gte: new Date('2026-09-16T00:00:00.000Z'), lte: new Date('2026-09-16T00:00:00.000Z') } },
      orderBy: [{ workDate: 'asc' }, { contractorId: 'asc' }, { shift: { sortOrder: 'asc' } }],
    });
    expect(rows).toEqual([
      { projectId: 1, contractorId: 1, workDate: '2026-09-16', shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4 },
    ]);
  });
});

describe('prisma-repo-entry.saveDailyResources', () => {
  it('$transaction goi callback voi tx mock; o doi -> update + auditLog.create 1 lan co note', async () => {
    transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        factDailyManpower: { findMany: mpFindMany, update: mpUpdate, create: mpCreate },
        factDailyEquipmentUsage: { findMany: eqFindMany, update: eqUpdate, create: eqCreate },
        auditLog: { create: auditCreate },
      }),
    );
    mpFindMany.mockResolvedValueOnce([
      { projectId: 1, contractorId: 1, workDate: new Date('2026-09-16T00:00:00.000Z'), shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4 },
    ]);

    const result = await entryPrismaRepo.saveDailyResources(
      1, '2026-09-16',
      { manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 9, actualHeadcount: 9 }], equipment: [] },
      'u@x', 'ly do',
    );

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(mpUpdate).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate.mock.calls[0][0].data.note).toBe('ly do');
    expect(result).toEqual({ created: 0, updated: 1, unchanged: 0 });
  });
});

/**
 * P7-C2 Task 8 + vong sua bao mat (T-1..T-4): tao/sua/ngung-dung giai doan CHAY TRONG 1
 * transaction co khoa advisory 'dim_stage' - doc (dup-check/too-many/not-found/in-use/last-active),
 * ghi va audit DIEN RA TRONG CUNG tx (khong con tach roi nhu truoc, dong khe ho TOCTOU khi 2 admin
 * cung thao tac dong thoi).
 */
describe('prisma-repo-entry.saveStage / setStageActive', () => {
  const input = { nameVi: 'Bảo hành', nameEn: 'Warranty', side: 'left' as const, sortOrder: 5, calcMode: 'manual' as const };

  /** Tx mock mac dinh (khong trung ten, chua qua 30, con giai doan khac dang dung...) - tung test ghi de field can thiet. */
  function makeTx(overrides: {
    stageFindMany?: ReturnType<typeof vi.fn>;
    stageFindUnique?: ReturnType<typeof vi.fn>;
    stageUpdate?: ReturnType<typeof vi.fn>;
    stageCreate?: ReturnType<typeof vi.fn>;
    stageCount?: ReturnType<typeof vi.fn>;
    pswCount?: ReturnType<typeof vi.fn>;
    pswFindMany?: ReturnType<typeof vi.fn>;
    pswCreateMany?: ReturnType<typeof vi.fn>;
    executeRaw?: ReturnType<typeof vi.fn>;
    audit?: ReturnType<typeof vi.fn>;
  } = {}) {
    return {
      $executeRaw: overrides.executeRaw ?? vi.fn(async () => 1),
      stage: {
        findMany: overrides.stageFindMany ?? vi.fn(async () => [] as { code: string; nameVi: string }[]),
        findUnique: overrides.stageFindUnique ?? vi.fn(async (): Promise<unknown> => null),
        update: overrides.stageUpdate ?? vi.fn(async (args: { where: { code: string }; data: Record<string, unknown> }) => ({ code: args.where.code, ...args.data })),
        create: overrides.stageCreate ?? vi.fn(async (args: { data: Record<string, unknown> }) => ({ ...args.data })),
        count: overrides.stageCount ?? vi.fn(async () => 1),
      },
      projectStageWeight: {
        count: overrides.pswCount ?? vi.fn(async () => 0),
        findMany: overrides.pswFindMany ?? vi.fn(async () => [] as { projectId: number }[]),
        createMany: overrides.pswCreateMany ?? vi.fn(async (_args: unknown) => ({ count: 0 })),
      },
      auditLog: { create: overrides.audit ?? vi.fn(async (_args: unknown) => ({})) },
    };
  }

  describe('saveStage', () => {
    it('tao moi: khoa advisory truoc khi doc, trong 1 transaction tao dim_stage custom_<n>, createMany 0% cho du an da co trong so, audit create', async () => {
      const tx = makeTx({
        stageFindMany: vi.fn(async () => [{ code: 'design', nameVi: 'Thiết kế' }, { code: 'custom_2', nameVi: 'Cũ' }]),
        pswFindMany: vi.fn(async () => [{ projectId: 1 }, { projectId: 3 }]),
      });
      transactionMock.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      const res = await entryPrismaRepo.saveStage(input, 'u@x');

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(res).toMatchObject({ code: 'custom_3', nameVi: 'Bảo hành', side: 'left', isActive: true });
      expect(tx.stage.create).toHaveBeenCalledWith({ data: expect.objectContaining({ code: 'custom_3', isActive: true }) });
      expect(tx.projectStageWeight.createMany).toHaveBeenCalledWith({
        data: [
          { projectId: 1, stageCode: 'custom_3', weightPct: 0, applicable: true },
          { projectId: 3, stageCode: 'custom_3', weightPct: 0, applicable: true },
        ],
        skipDuplicates: true,
      });
      expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tableName: 'dim_stage', recordId: 'custom_3', field: 'create' }) });
    });

    // T-1: truoc day dup-check/too-many chay TRUOC khi mo $transaction (doc thang qua prisma top-level)
    // nen 2 request gan nhu dong thoi co the CUNG khong thay trung roi CUNG tao -> trung ten hoac
    // vuot 30. Nay dup-check chay o TRONG transaction co khoa advisory 'dim_stage' - request thu 2
    // bat buoc cho request thu 1 xong roi moi doc, nen luon thay ket qua moi nhat.
    it('T-1: trung ten khong phan biet hoa thuong -> duplicate_name, kiem tra nay VAN chay TRONG transaction co khoa (khong con kiem truoc roi moi mo tx)', async () => {
      const tx = makeTx({ stageFindMany: vi.fn(async () => [{ code: 'design', nameVi: 'Thiết kế' }]) });
      transactionMock.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      expect(await entryPrismaRepo.saveStage({ ...input, nameVi: ' THIẾT KẾ ' }, 'u@x')).toBe('duplicate_name');

      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(tx.stage.create).not.toHaveBeenCalled();
    });

    it('T-1: du 30 giai doan -> too_many, kiem TRONG transaction co khoa', async () => {
      const tx = makeTx({ stageFindMany: vi.fn(async () => Array.from({ length: 30 }, (_, i) => ({ code: `custom_${i + 1}`, nameVi: `G${i}` }))) });
      transactionMock.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      expect(await entryPrismaRepo.saveStage(input, 'u@x')).toBe('too_many');

      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(tx.stage.create).not.toHaveBeenCalled();
    });

    it('sua code khong co -> not_found', async () => {
      const tx = makeTx({
        stageFindMany: vi.fn(async () => [{ code: 'design', nameVi: 'Thiết kế' }]),
        stageFindUnique: vi.fn(async () => null),
      });
      transactionMock.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      expect(await entryPrismaRepo.saveStage({ ...input, code: 'custom_9' }, 'u@x')).toBe('not_found');
      expect(transactionMock).toHaveBeenCalledTimes(1);
    });

    // T-2: truoc day `stage.update` va `audit(...)` la 2 lenh Prisma roi nhau NGOAI transaction -
    // audit that bai (vd mat ket noi giua 2 lenh) thi du lieu da doi ma khong co dau vet kiem toan.
    // Nay ca 2 chay trong CUNG 1 transaction (that bai 1 trong 2 thi rollback ca 2).
    it('T-2: sua thanh cong -> update va audit CUNG trong 1 transaction, khoa advisory truoc khi doc', async () => {
      const before = { code: 'custom_9', nameVi: 'Cu', nameEn: 'Old', side: 'left', sortOrder: 1, calcMode: 'manual' };
      const tx = makeTx({
        stageFindMany: vi.fn(async () => [{ code: 'design', nameVi: 'Thiết kế' }, { code: 'custom_9', nameVi: 'Cu' }]),
        stageFindUnique: vi.fn(async () => before),
      });
      transactionMock.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      const res = await entryPrismaRepo.saveStage({ ...input, code: 'custom_9' }, 'u@x');

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(tx.stage.update).toHaveBeenCalledWith({ where: { code: 'custom_9' }, data: expect.objectContaining({ nameVi: 'Bảo hành' }) });
      expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tableName: 'dim_stage', recordId: 'custom_9' }) });
      expect(res).toMatchObject({ code: 'custom_9', nameVi: 'Bảo hành' });
    });
  });

  describe('setStageActive', () => {
    it('ngung dung: dem trong so applicable > 0 -> in_use kem so du an, khong update, van trong transaction co khoa', async () => {
      const tx = makeTx({
        stageFindUnique: vi.fn(async () => ({ code: 'fabrication', isActive: true })),
        pswCount: vi.fn(async () => 12),
      });
      transactionMock.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      expect(await entryPrismaRepo.setStageActive('fabrication', false, 'u@x')).toEqual({ status: 'in_use', count: 12 });

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(tx.projectStageWeight.count).toHaveBeenCalledWith({ where: { stageCode: 'fabrication', applicable: true, weightPct: { gt: 0 } } });
      expect(tx.stage.update).not.toHaveBeenCalled();
    });

    // T-3: truoc day dem giai doan dang dung con lai va update la 2 lenh Prisma roi nhau NGOAI
    // transaction - 2 admin ngung dung 2 giai doan cuoi cung GAN NHU DONG THOI co the CA HAI deu
    // dem thay "con giai doan khac dang dung" (dem truoc khi ben kia kip update) roi CA HAI cung
    // update -> khong con giai doan nao dang dung. Nay dem va update chay TRONG CUNG 1 transaction
    // co khoa advisory, tuan tu hoa 2 yeu cau.
    it('T-3: ngung giai doan dang dung cuoi cung -> last_active, dem va update trong CUNG transaction co khoa', async () => {
      const tx = makeTx({
        stageFindUnique: vi.fn(async () => ({ code: 'design', isActive: true })),
        pswCount: vi.fn(async () => 0),
        stageCount: vi.fn(async () => 0),
      });
      transactionMock.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      expect(await entryPrismaRepo.setStageActive('design', false, 'u@x')).toBe('last_active');

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(tx.stage.count).toHaveBeenCalledWith({ where: { isActive: true, code: { not: 'design' } } });
      expect(tx.stage.update).not.toHaveBeenCalled();
    });

    it('ngung dung hop le -> update + audit CUNG 1 transaction, khong dong trong so nao them', async () => {
      const tx = makeTx({
        stageFindUnique: vi.fn(async () => ({ code: 'custom_1', isActive: true })),
        pswCount: vi.fn(async () => 0),
        stageCount: vi.fn(async () => 3),
      });
      transactionMock.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      expect(await entryPrismaRepo.setStageActive('custom_1', false, 'u@x')).toBe('ok');

      expect(tx.stage.update).toHaveBeenCalledWith({ where: { code: 'custom_1' }, data: { isActive: false } });
      expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tableName: 'dim_stage', recordId: 'custom_1', field: 'isActive' }) });
      expect(tx.projectStageWeight.createMany).not.toHaveBeenCalled();
    });

    // T-4 (chu du an chot): dung lai giong het luc tao moi (K10) - chen dong trong so 0% ap dung
    // cho du an DA CO dong khac nhung con thieu dong cua ma nay (vd du an duoc tao trong luc giai
    // doan dang ngung dung); `skipDuplicates` giu nguyen dong cu cua du an da tung co.
    it('T-4: dung lai -> chen lai dong trong so 0% ap dung cho du an da co dong khac (skipDuplicates)', async () => {
      const tx = makeTx({
        stageFindUnique: vi.fn(async () => ({ code: 'custom_1', isActive: false })),
        pswFindMany: vi.fn(async () => [{ projectId: 1 }, { projectId: 2 }]),
      });
      transactionMock.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      expect(await entryPrismaRepo.setStageActive('custom_1', true, 'u@x')).toBe('ok');

      expect(tx.stage.update).toHaveBeenCalledWith({ where: { code: 'custom_1' }, data: { isActive: true } });
      expect(tx.projectStageWeight.createMany).toHaveBeenCalledWith({
        data: [
          { projectId: 1, stageCode: 'custom_1', weightPct: 0, applicable: true },
          { projectId: 2, stageCode: 'custom_1', weightPct: 0, applicable: true },
        ],
        skipDuplicates: true,
      });
    });
  });
});