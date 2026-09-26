/**
 * Tester (vong sua 1, muc 1 + muc 6, kiem thu doc lap): `createProject` (prisma-repo.ts) hien la
 * ham DUY NHAT chua duoc unit-test bang prisma mock truoc do (chi kiem qua mock-repo/form.test.ts va
 * smoke DB that). Mock thang `@/server/db` (giong prisma-repo-save.test.ts) de kiem 2 dieu:
 *  - Muc 1 (dong ho ao): dong `dim_project_alias` tao luc tao du an dung `todayIso()` (DDC_FAKE_TODAY),
 *    KHONG dung gio may that (`new Date()`), bang cach doi DDC_FAKE_TODAY sang 1 moc RO RANG KHAC
 *    voi ca gio may that lan moc mac dinh cua vitest.config.ts (2026-09-16).
 *  - Muc 6 (S-2): trung ma trong `tx` (kiem lai sau khoa advisory) -> nem `ProjectCodeTakenError`,
 *    KHONG goi `project.update`/`projectAlias.create`; P2002 tu Postgres (race hiem) cung duoc bat
 *    va nem lai thanh `ProjectCodeTakenError` (khong lo loi tho 500).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const {
  projectCreate, projectUpdate, projectFindFirst, projectAliasCreate, projectAliasFindFirst,
  auditLogCreate, executeRaw,
} = vi.hoisted(() => {
  let nextId = 501;
  const projectCreate = vi.fn(async (args: { data: Record<string, unknown> }) => ({
    id: nextId++,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    isActive: true,
    contractDate: null, plannedStartDate: null, plannedFinishDate: null, committedHandoverDate: null,
    actualStartDate: null, actualFinishDate: null, penaltyValue: null, penalized: false,
    factoryId: null, contractValueOriginal: null,
    ...args.data,
  }));
  const projectUpdate = vi.fn(async (args: { where: { id: number }; data: Record<string, unknown> }) => ({
    id: args.where.id,
    createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'),
    isActive: true, contractDate: null, plannedStartDate: null, plannedFinishDate: null,
    committedHandoverDate: null, actualStartDate: null, actualFinishDate: null, penaltyValue: null,
    penalized: false, factoryId: null, contractValueOriginal: null,
    ...args.data,
  }));
  const projectFindFirst = vi.fn(async () => null as unknown);
  const projectAliasCreate = vi.fn(async (args: { data: Record<string, unknown> }) => args.data);
  const projectAliasFindFirst = vi.fn(async () => null as unknown);
  const auditLogCreate = vi.fn(async () => ({}));
  const executeRaw = vi.fn(async () => 1);
  return { projectCreate, projectUpdate, projectFindFirst, projectAliasCreate, projectAliasFindFirst, auditLogCreate, executeRaw };
});

vi.mock('@/server/db', () => ({
  prisma: {
    project: { create: projectCreate, update: projectUpdate, findFirst: projectFindFirst },
    projectAlias: { create: projectAliasCreate, findFirst: projectAliasFindFirst },
    auditLog: { create: auditLogCreate },
    $executeRaw: executeRaw,
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        project: { create: projectCreate, update: projectUpdate, findFirst: projectFindFirst },
        projectAlias: { create: projectAliasCreate, findFirst: projectAliasFindFirst },
        $executeRaw: executeRaw,
      })),
  },
}));

import { ProjectCodeTakenError } from '@/lib/project-code';
import { repo } from './prisma-repo';
import type { CreateProjectInput } from './types';

const BASE_INPUT: CreateProjectInput = {
  projectName: 'DU AN QA VONG SUA 1', customerId: 1, teamKdId: 1, marketCode: 'TN',
  projectType: 'EPC', priority: 'P1', contractValue: 10, tonnage: 100,
};

beforeEach(() => {
  projectCreate.mockClear();
  projectUpdate.mockClear();
  projectFindFirst.mockReset().mockResolvedValue(null);
  projectAliasCreate.mockClear();
  projectAliasFindFirst.mockReset().mockResolvedValue(null);
  auditLogCreate.mockClear();
  executeRaw.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('prisma-repo.createProject - muc 1 (vong sua 1): dong alias dung dong ho ao, khong dung gio that', () => {
  it('DDC_FAKE_TODAY doi sang 1 moc xa (khac ca gio may that lan mac dinh vitest) -> effectiveFrom bam dung moc do', async () => {
    vi.stubEnv('DDC_FAKE_TODAY', '2031-03-20');

    await repo.createProject({ ...BASE_INPUT, currentAliasCode: 'CT-QA-CLOCK-1' }, 'admin@x');

    expect(projectAliasCreate).toHaveBeenCalledTimes(1);
    const args = projectAliasCreate.mock.calls[0][0] as { data: { effectiveFrom: Date } };
    expect(args.data.effectiveFrom.toISOString()).toBe('2031-03-20T00:00:00.000Z');
  });

  it('KHONG dat currentAliasCode -> khong tao dong alias nao (giu hanh vi cu)', async () => {
    await repo.createProject({ ...BASE_INPUT }, 'admin@x');
    expect(projectAliasCreate).not.toHaveBeenCalled();
  });
});

describe('prisma-repo.createProject - muc 6 (S-2, vong sua 1): trung ma trong tx -> ProjectCodeTakenError', () => {
  it('tx.project.findFirst tra ve 1 du an khac trung ma -> nem ProjectCodeTakenError, KHONG goi project.update/projectAlias.create', async () => {
    projectFindFirst.mockResolvedValueOnce({ id: 999, masterCode: 'M-00999', currentAliasCode: 'CT-DA-CO' });

    await expect(repo.createProject({ ...BASE_INPUT, currentAliasCode: 'CT-DA-CO' }, 'admin@x'))
      .rejects.toBeInstanceOf(ProjectCodeTakenError);

    expect(projectUpdate).not.toHaveBeenCalled();
    expect(projectAliasCreate).not.toHaveBeenCalled();
  });

  it('tx.projectAlias.findFirst tra ve 1 alias cu trung (khong phai currentAliasCode) -> cung nem ProjectCodeTakenError', async () => {
    projectAliasFindFirst.mockResolvedValueOnce({ id: 1, projectId: 999, aliasCode: 'CT-ALIAS-CU' });

    await expect(repo.createProject({ ...BASE_INPUT, currentAliasCode: 'CT-ALIAS-CU' }, 'admin@x'))
      .rejects.toBeInstanceOf(ProjectCodeTakenError);
  });

  it('P2002 tu Postgres (race hiem, 2 request gan nhu dong thoi) -> bat va nem lai ProjectCodeTakenError, khong phai loi tho', async () => {
    projectAliasCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('trung', { code: 'P2002', clientVersion: '6.19.3', meta: { target: ['lower(currentAliasCode)'] } }));

    await expect(repo.createProject({ ...BASE_INPUT, currentAliasCode: 'CT-RACE' }, 'admin@x'))
      .rejects.toBeInstanceOf(ProjectCodeTakenError);
  });

  it('loi Prisma KHAC P2002 (vd P2025) -> nem nguyen loi goc, khong bi nuot thanh ProjectCodeTakenError', async () => {
    projectAliasCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('khac', { code: 'P2025', clientVersion: '6.19.3' }));

    await expect(repo.createProject({ ...BASE_INPUT, currentAliasCode: 'CT-LOI-KHAC' }, 'admin@x'))
      .rejects.not.toBeInstanceOf(ProjectCodeTakenError);
  });

  it('ma KHONG trung ai -> tao thanh cong, co khoa advisory ($executeRaw) truoc khi kiem trung', async () => {
    const res = await repo.createProject({ ...BASE_INPUT, currentAliasCode: 'CT-QA-MOI-HOAN-TOAN' }, 'admin@x');
    expect(res.currentAliasCode).toBe('CT-QA-MOI-HOAN-TOAN');
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(projectAliasCreate).toHaveBeenCalledTimes(1);
  });
});
