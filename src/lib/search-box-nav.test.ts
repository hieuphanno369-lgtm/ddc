import { describe, expect, it } from 'vitest';
import { computeSearchNavParams } from './search-box-nav';

describe('computeSearchNavParams (Debug 3.16: SearchBox toàn ứng dụng không được tự xoá `page`)', () => {
  it('v rỗng khớp search rỗng hiện có (mount lần đầu, chưa gõ gì) -> null, KHÔNG xoá page (bug 3.16 gốc)', () => {
    // Trường hợp thật: mở trực tiếp /audit?page=2 -> SearchBox mount với v='' (không có
    // ?search= trên URL) -> effect KHÔNG được phép xoá page=2.
    expect(computeSearchNavParams('page=2', '')).toBeNull();
  });

  it('v khớp đúng search đã có trên URL, dù URL còn tham số khác (vd. page) -> null', () => {
    expect(computeSearchNavParams('search=abc&page=2', 'abc')).toBeNull();
  });

  it('range=all không có search, v rỗng khi mount -> null (không đụng URL)', () => {
    expect(computeSearchNavParams('range=all', '')).toBeNull();
  });

  it('người dùng gõ tìm kiếm thật (v khác search hiện có) -> đặt search, xoá page', () => {
    expect(computeSearchNavParams('page=3', 'cang')).toBe('search=cang');
  });

  it('người dùng xoá hết chữ trong ô tìm kiếm (v rỗng, đang có search cũ) -> xoá search', () => {
    expect(computeSearchNavParams('search=abc&page=2', '')).toBe('');
  });

  it('đổi từ search cũ sang search mới, giữ các tham số lọc khác không phải page', () => {
    expect(computeSearchNavParams('search=abc&status=Hoan_thanh&page=2', 'xyz')).toBe(
      'search=xyz&status=Hoan_thanh',
    );
  });
});
