import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { assertXlsxInflatedSize, buildDailyTemplate, readDailyWorkbook } from './daily-import';
import { manpowerHeaders, EQUIPMENT_HEADERS, cellText } from '@/lib/daily-import';
import { repo } from '@/server/repo/mock-repo';

describe('buildDailyTemplate + readDailyWorkbook', () => {
  it('sinh file mau roi doc lai duoc header dung', async () => {
    const members = repo.getContractors(1);
    const shifts = repo.getShifts();
    const equipments = repo.getEquipments();

    const buf = await buildDailyTemplate({ members, shifts, equipments });
    const parsed = await readDailyWorkbook(buf);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.manpower.header.map(cellText)).toEqual(manpowerHeaders(shifts));
    expect(parsed.equipment.header.map(cellText)).toEqual([...EQUIPMENT_HEADERS]);
  });

  it('sheet DanhMuc co 6 nha thau du an 1, ten bat dau = duoc them tien to nhay don', async () => {
    const members = repo.getContractors(1);
    expect(members).toHaveLength(6);

    const buf = await buildDailyTemplate({ members, shifts: repo.getShifts(), equipments: repo.getEquipments() });
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const dm = wb.getWorksheet('DanhMuc')!;
    const names: string[] = [];
    for (let r = 2; r <= dm.rowCount; r++) {
      const v = dm.getRow(r).getCell(1).value;
      if (v != null && String(v).trim() !== '') names.push(String(v));
    }
    expect(names).toHaveLength(6);
  });

  it('ten bat dau bang = duoc them tien to nhay don (safeCell)', async () => {
    const buf = await buildDailyTemplate({
      members: [{ id: 1, name: '=CMD()', scopeOfWork: '', isActive: true, mergedIntoId: null }],
      shifts: repo.getShifts(),
      equipments: repo.getEquipments(),
    });
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const dm = wb.getWorksheet('DanhMuc')!;
    expect(String(dm.getRow(2).getCell(1).value)).toBe("'=CMD()");
  });

  it('buffer rac -> bad_file', async () => {
    const res = await readDailyWorkbook(Buffer.from('khong-phai-excel'));
    expect(res).toEqual({ ok: false, error: 'bad_file' });
  });

  it('thieu sheet -> coi nhu rong', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('KhongLienQuan');
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const res = await readDailyWorkbook(buf);
    expect(res).toEqual({ ok: true, manpower: { header: [], rows: [] }, equipment: { header: [], rows: [] } });
  });
});

/** H-1c (danh-gia.md vòng 1): test hồi quy cho H-1a/H-1b - file ô XFD1/A1048576 không được làm treo/OOM. */
describe('readDailyWorkbook - chan file doc hai (H-1c)', () => {
  it("sheet NhanLuc co XFD1 + A1048576 -> ok:false, xong duoi 2s (khong dung ws.rowCount/columnCount de lap)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('NhanLuc');
    ws.getCell('XFD1').value = 'x';
    ws.getCell('A1048576').value = 'x';
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const start = Date.now();
    const res = await readDailyWorkbook(buf);
    const elapsed = Date.now() - start;

    expect(res.ok).toBe(false);
    expect(elapsed).toBeLessThan(2000);
  });

  it('chi 1 o o XFD1 (rowCount trong han, colCount 16384 > 64) -> bad_file', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('NhanLuc');
    ws.getCell('XFD1').value = 'x';
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const res = await readDailyWorkbook(buf);
    expect(res).toEqual({ ok: false, error: 'bad_file' });
  });
});

describe('assertXlsxInflatedSize (H-1b, chong zip bomb)', () => {
  it("1 o chua chuoi 200_000 ky tu, tran 64KB -> false", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('NhanLuc');
    ws.getCell('A1').value = 'a'.repeat(200_000);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    expect(await assertXlsxInflatedSize(buf, 64 * 1024)).toBe(false);
  });

  it('file mau buildDailyTemplate (nho) -> true', async () => {
    const buf = await buildDailyTemplate({
      members: repo.getContractors(1),
      shifts: repo.getShifts(),
      equipments: repo.getEquipments(),
    });
    expect(await assertXlsxInflatedSize(buf)).toBe(true);
  });
});
