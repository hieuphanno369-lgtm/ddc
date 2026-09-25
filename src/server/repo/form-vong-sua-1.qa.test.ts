import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from './mock-repo';
import { ProjectCodeTakenError, isReservedProjectCode } from '@/lib/project-code';
import { todayIso } from '@/lib/clock';

/**
 * Tester (vong sua 1, muc 6-7, kiem thu doc lap): bo sung cac bien the CHUA duoc coder/tester
 * vong 1 cham toi o tang mock-repo:
 *  - isProjectCodeTaken trung voi MASTERCODE (khong phai currentAliasCode/alias) cua du an khac.
 *  - createProject (mock) voi currentAliasCode trung masterCode cua du an khac -> ProjectCodeTakenError.
 *  - changeProjectCode (mock) doi sang dung masterCode cua du an khac -> 'taken'.
 *  - setProjectMember (mock): du an CHUA CO PIC nao (moi tao) van bi chan khi gan PIC thu 2 GAN NHU
 *    dong thoi (khong chi ca "da co san 1 PIC tu seed" nhu form.test.ts cua coder).
 */
beforeEach(() => repo.reset());

const BASE_INPUT = {
  projectName: 'DU AN QA VONG SUA 1 FORM', customerId: 1, teamKdId: 1, marketCode: 'NoiBo' as const,
  projectType: 'Khac' as const, priority: 'P2' as const, contractValue: 10, tonnage: 100,
  plannedStartDate: '2026-10-01', plannedFinishDate: '2027-06-30', committedHandoverDate: '2027-07-31',
};

describe('isProjectCodeTaken - trung MASTERCODE cua du an khac (chua duoc test rieng truoc do)', () => {
  it('dung masterCode cua du an 2 lam ma moi cho du an 1 -> bi coi la trung', () => {
    const p2 = repo.getProject(2)!;
    expect(repo.isProjectCodeTaken(p2.masterCode, 1)).toBe(true);
    expect(repo.isProjectCodeTaken(p2.masterCode.toLowerCase(), 1)).toBe(true);
  });

  it('dung masterCode CUA CHINH du an 1 (loai tru boi exceptProjectId) -> khong bi coi la trung', () => {
    const p1 = repo.getProject(1)!;
    expect(repo.isProjectCodeTaken(p1.masterCode, 1)).toBe(false);
  });
});

describe('createProject (mock-repo) - currentAliasCode trung masterCode cua du an khac -> ProjectCodeTakenError', () => {
  it('nem ProjectCodeTakenError, KHONG tao du an moi (danh sach du an khong doi)', () => {
    const before = repo.listProjects().length;
    const p2 = repo.getProject(2)!;
    expect(() => repo.createProject({ ...BASE_INPUT, currentAliasCode: p2.masterCode }, 'admin@x'))
      .toThrow(ProjectCodeTakenError);
    expect(repo.listProjects()).toHaveLength(before);
  });

  it('currentAliasCode HOAN TOAN moi -> tao thanh cong binh thuong (doi chung, khong chan oan)', () => {
    const created = repo.createProject({ ...BASE_INPUT, currentAliasCode: 'CT-QA-FORM-MOI-HOAN-TOAN' }, 'admin@x');
    expect(created.currentAliasCode).toBe('CT-QA-FORM-MOI-HOAN-TOAN');
  });
});

describe('changeProjectCode (mock-repo) - doi sang dung masterCode cua du an khac -> "taken"', () => {
  it('khong doi duoc, currentAliasCode giu nguyen', () => {
    const p2 = repo.getProject(2)!;
    const before = repo.getProject(1)!.currentAliasCode;
    const res = repo.changeProjectCode(1, p2.masterCode, 'ly do doi ma hop le qa', 'admin@x', todayIso());
    expect(res).toBe('taken');
    expect(repo.getProject(1)!.currentAliasCode).toBe(before);
  });
});

describe('setProjectMember (mock-repo) - S-6: du an MOI TAO (chua co PIC tu seed) van bi chan khi gan PIC thu 2', () => {
  it('gan PIC dau tien -> "added"; gan PIC thu 2 (nguoi khac) ngay sau -> "pic_exists", du an van chi 1 PIC', () => {
    const created = repo.createProject(BASE_INPUT, 'admin@x');
    const first = repo.setProjectMember(created.id, 'pm@daidung.com.vn', 'PIC', 'admin@x');
    expect(first).toBe('added');

    const second = repo.setProjectMember(created.id, 'viewer@daidung.com.vn', 'PIC', 'admin@x');
    expect(second).toBe('pic_exists');

    const pics = repo.getProjectMembers(created.id).filter((m) => m.roleInProject === 'PIC');
    expect(pics).toHaveLength(1);
    expect(pics[0]!.userEmail).toBe('pm@daidung.com.vn');
  });

  it('doi chung: Backup thu 2 cho CUNG du an moi tao van duoc phep (index chi ap PIC)', () => {
    const created = repo.createProject(BASE_INPUT, 'admin@x');
    expect(repo.setProjectMember(created.id, 'pm@daidung.com.vn', 'Backup', 'admin@x')).toBe('added');
    expect(repo.setProjectMember(created.id, 'viewer@daidung.com.vn', 'Backup', 'admin@x')).toBe('added');
    expect(repo.getProjectMembers(created.id).filter((m) => m.roleInProject === 'Backup')).toHaveLength(2);
  });
});

describe('doi chieu: isReservedProjectCode KHONG duoc ap dung o createProject (chi doc ranh gioi da cong bo o thay-doi.md muc "de sau")', () => {
  it('tao du an moi voi currentAliasCode dang M-00099 (mau tu sinh) VAN tao duoc (chua chan o tang tao moi)', () => {
    // Ghi lai ranh gioi CO CHU DICH cua vong sua 1 (thay-doi.md, "Rui ro... muc 4"): isReservedProjectCode
    // chi duoc goi trong changeProjectCodeAction, KHONG goi trong createProjectAction/repo.createProject.
    // Neu hanh vi nay thay doi trong tuong lai (chan luon o tao moi), test nay se do va can cap nhat.
    expect(isReservedProjectCode('M-00099')).toBe(true);
    const created = repo.createProject({ ...BASE_INPUT, currentAliasCode: 'M-00099' }, 'admin@x');
    expect(created.currentAliasCode).toBe('M-00099');
  });
});
