/**
 * Coder (vong sua 1, vong 2 - vá F-1 và N-1 theo `danh-gia-bao-mat.md` muc "Vong sua 1"):
 *  - F-1 (c), phong thu nhieu lop: nhanh KHONG nhap `currentAliasCode` (dung ma tu sinh 'M-<id>')
 *    truoc day KHONG khoa/khong kiem trung - gio phai khoa + kiem trung GIONG het nhanh co nhap ma.
 *  - N-1: `createProject` (prisma-repo.ts) bat P2002 map chung thanh `ProjectCodeTakenError` bat ke
 *    `meta.target` la gi. Gio chi map khi `target` lien quan mã CT (`masterCode` hoac
 *    `lower(currentAliasCode)` - da xac nhan dinh dang that qua $transaction tu rollback tren DB
 *    `ddc_control_tower`), con lai nem nguyen loi goc.
 * Harness mock giong `prisma-repo-create-project.qa.test.ts` (Tester), tach file rieng vi day la
 * test cua Coder cho vong vá nay.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const {
  projectCreate, projectUpdate, projectFindFirst, projectAliasCreate, projectAliasFindFirst,
  auditLogCreate, executeRaw,
} = vi.hoisted(() => {
  let nextId = 601;
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
  projectName: 'DU AN F-1 VONG 2', customerId: 1, teamKdId: 1, marketCode: 'TN',
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

describe('prisma-repo.createProject - F-1 (c), vong sua 1 vong 2: nhanh KHONG nhap ma cung phai khoa + kiem trung', () => {
  it('KHONG nhap currentAliasCode -> $executeRaw (khoa advisory) VAN duoc goi (truoc day chi khoa khi co nhap ma)', async () => {
    await repo.createProject({ ...BASE_INPUT }, 'admin@x');
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('KHONG nhap currentAliasCode, nhung ma tu sinh (M-<id>) da bi mot du an khac chiem qua dong alias cu -> nem ProjectCodeTakenError, KHONG goi project.update', async () => {
    projectAliasFindFirst.mockResolvedValueOnce({ id: 1, projectId: 999, aliasCode: 'M-00601' });

    await expect(repo.createProject({ ...BASE_INPUT }, 'admin@x')).rejects.toBeInstanceOf(ProjectCodeTakenError);
    expect(projectUpdate).not.toHaveBeenCalled();
    expect(projectAliasCreate).not.toHaveBeenCalled();
  });

  it('KHONG nhap currentAliasCode, ma tu sinh da bi mot du an khac chiem lam currentAliasCode -> nem ProjectCodeTakenError', async () => {
    projectFindFirst.mockResolvedValueOnce({ id: 999, masterCode: 'M-00999', currentAliasCode: 'M-00601' });

    await expect(repo.createProject({ ...BASE_INPUT }, 'admin@x')).rejects.toBeInstanceOf(ProjectCodeTakenError);
    expect(projectUpdate).not.toHaveBeenCalled();
  });
});

describe('prisma-repo.createProject - N-1, vong sua 1 vong 2: chi map P2002 thanh ProjectCodeTakenError khi meta.target dung index ma CT', () => {
  it('P2002 voi meta.target = ["lower(currentAliasCode)"] (dinh dang thuc te da xac nhan tren DB that) -> ProjectCodeTakenError', async () => {
    projectAliasCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('trung', {
      code: 'P2002', clientVersion: '6.19.3', meta: { modelName: 'Project', target: ['lower(currentAliasCode)'] },
    }));

    await expect(repo.createProject({ ...BASE_INPUT, currentAliasCode: 'CT-RACE-R2' }, 'admin@x'))
      .rejects.toBeInstanceOf(ProjectCodeTakenError);
  });

  it('P2002 voi meta.target = ["masterCode"] -> ProjectCodeTakenError', async () => {
    projectAliasCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('trung', {
      code: 'P2002', clientVersion: '6.19.3', meta: { modelName: 'Project', target: ['masterCode'] },
    }));

    await expect(repo.createProject({ ...BASE_INPUT, currentAliasCode: 'CT-RACE-R2B' }, 'admin@x'))
      .rejects.toBeInstanceOf(ProjectCodeTakenError);
  });

  it('P2002 voi meta.target KHONG lien quan ma CT (vd mot rang buoc khac) -> nem NGUYEN loi goc, KHONG bi nuot thanh ProjectCodeTakenError', async () => {
    projectAliasCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('trung khac', {
      code: 'P2002', clientVersion: '6.19.3', meta: { modelName: 'ProjectAlias', target: ['id'] },
    }));

    await expect(repo.createProject({ ...BASE_INPUT, currentAliasCode: 'CT-RACE-R2C' }, 'admin@x'))
      .rejects.not.toBeInstanceOf(ProjectCodeTakenError);
  });

  it('P2002 KHONG co meta.target (vd loi gia lap so sai, khong thuc te) -> nem NGUYEN loi goc thay vi doan bua', async () => {
    projectAliasCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('trung', { code: 'P2002', clientVersion: '6.19.3' }));

    await expect(repo.createProject({ ...BASE_INPUT, currentAliasCode: 'CT-RACE-R2D' }, 'admin@x'))
      .rejects.not.toBeInstanceOf(ProjectCodeTakenError);
  });
});
