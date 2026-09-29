import { describe, expect, it } from 'vitest';
import { resolveDetailTime } from './detail-time';

const TODAY = '2026-09-16';
const project = { plannedStartDate: '2026-01-01', actualStartDate: '2026-01-10' };
const facts = ['2026-02', '2026-03', '2026-05'];

describe('resolveDetailTime (P4 D2, Q6)', () => {
  it('không tham số: kỳ = cả vòng đời tới hôm nay, mốc = tháng gần nhất có số (2026-05)', () => {
    const t = resolveDetailTime({}, project, facts, TODAY);
    expect(t.period).toEqual({ from: '2026-01-01', to: TODAY });
    expect(t.asOfMonth).toBe('2026-05');
    expect(t.lastDataMonth).toBe('2026-05');
    expect(t.day).toBe('2026-05-31');
  });

  it('tháng có số đầu tiên sớm hơn ngày bắt đầu thì kỳ bắt đầu từ tháng đó', () => {
    const t = resolveDetailTime({}, { plannedStartDate: '2026-03-01', actualStartDate: null }, ['2026-02'], TODAY);
    expect(t.period.from).toBe('2026-02-01');
  });

  it('?month hợp lệ trong kỳ được dùng làm mốc; day mặc định = cuối tháng đó', () => {
    const t = resolveDetailTime({ month: '2026-03' }, project, facts, TODAY);
    expect(t.asOfMonth).toBe('2026-03');
    expect(t.day).toBe('2026-03-31');
  });

  it('?month=2027-01 (tương lai) bị kẹp về tháng cuối của kỳ tới hôm nay', () => {
    expect(resolveDetailTime({ month: '2027-01' }, project, facts, TODAY).asOfMonth).toBe('2026-09');
  });

  it('?month trước kỳ bị kẹp về tháng đầu của kỳ', () => {
    expect(resolveDetailTime({ month: '2020-01' }, project, facts, TODAY).asOfMonth).toBe('2026-01');
  });

  it('?month=abc -> mặc định', () => {
    expect(resolveDetailTime({ month: 'abc' }, project, facts, TODAY).asOfMonth).toBe('2026-05');
  });

  it('?day rác (2026-02-30) -> mặc định; ?day hợp lệ trong kỳ được dùng', () => {
    expect(resolveDetailTime({ day: '2026-02-30' }, project, facts, TODAY).day).toBe('2026-05-31');
    expect(resolveDetailTime({ day: '2026-04-12' }, project, facts, TODAY).day).toBe('2026-04-12');
  });

  it('?day ngoài kỳ hoặc ở tương lai bị kẹp vào [đầu kỳ, min(cuối kỳ, hôm nay)]', () => {
    expect(resolveDetailTime({ day: '2030-01-01' }, project, facts, TODAY).day).toBe(TODAY);
    expect(resolveDetailTime({ day: '2020-01-01' }, project, facts, TODAY).day).toBe('2026-01-01');
  });

  it('from/to hợp lệ thu hẹp kỳ; mốc mặc định = tháng có số gần nhất không vượt cuối kỳ', () => {
    const t = resolveDetailTime({ from: '2026-01-01', to: '2026-03-20' }, project, facts, TODAY);
    expect(t.period).toEqual({ from: '2026-01-01', to: '2026-03-20' });
    expect(t.asOfMonth).toBe('2026-03');
    expect(t.day).toBe('2026-03-20');
  });

  it('from/to rác -> kỳ mặc định', () => {
    const t = resolveDetailTime({ from: 'xx', to: '2026-13-40' }, project, facts, TODAY);
    expect(t.period).toEqual({ from: '2026-01-01', to: TODAY });
  });

  it('chưa có số nào và không có ngày bắt đầu: kỳ từ đầu tháng hiện tại, mốc = tháng hiện tại, lastDataMonth null', () => {
    const t = resolveDetailTime({}, { plannedStartDate: null, actualStartDate: null }, [], TODAY);
    expect(t.period).toEqual({ from: '2026-09-01', to: TODAY });
    expect(t.asOfMonth).toBe('2026-09');
    expect(t.lastDataMonth).toBeNull();
    expect(t.day).toBe(TODAY);
  });
});
