import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from './mock-repo';

/** Mục 6 - repo ảnh hiện trường: add / get / delete trên mock repo. */
describe('photos (mock repo)', () => {
  beforeEach(() => {
    repo.reset();
  });

  it('ảnh seed có url rỗng - vẫn đọc được, không crash (render sẽ dùng placeholder)', () => {
    const photos = repo.getPhotos(1);
    expect(photos.length).toBeGreaterThan(0);
    expect(photos.every((p) => typeof p.url === 'string')).toBe(true);
    expect(photos.some((p) => p.url === '')).toBe(true);
  });

  it('addPhoto trả record đủ trường và tăng id', () => {
    const before = repo.getPhotos(1);
    const created = repo.addPhoto(1, '2026-09', '1/2026-09/123-anh.png', 'Móng', 'dev@localhost');

    expect(created.id).toBeGreaterThan(Math.max(...before.map((p) => p.id), 0));
    expect(created.projectId).toBe(1);
    expect(created.yearMonth).toBe('2026-09');
    expect(created.url).toBe('1/2026-09/123-anh.png');
    expect(created.uploadedBy).toBe('dev@localhost');
    expect(Number.isNaN(Date.parse(created.uploadedAt))).toBe(false);

    expect(repo.getPhotoById(created.id)).toEqual(created);
    expect(repo.getPhotos(1).map((p) => p.id)).toContain(created.id);
  });

  it('getPhotos lọc theo projectId và yearMonth', () => {
    repo.addPhoto(1, '2026-08', '1/2026-08/a.png', '', 'x@y');
    repo.addPhoto(1, '2026-09', '1/2026-09/b.png', '', 'x@y');
    repo.addPhoto(2, '2026-09', '2/2026-09/c.png', '', 'x@y');

    expect(repo.getPhotos(1, '2026-08').map((p) => p.url)).toEqual(['1/2026-08/a.png']);

    // không truyền yearMonth → lấy HẾT ảnh của dự án, không lẫn dự án khác
    const p1 = repo.getPhotos(1).map((p) => p.url);
    expect(p1).toContain('1/2026-09/b.png');
    expect(p1).toContain('1/2026-08/a.png');
    expect(p1).not.toContain('2/2026-09/c.png');

    // truyền yearMonth → chỉ ảnh đúng tháng
    const p1Sep = repo.getPhotos(1, '2026-09').map((p) => p.url);
    expect(p1Sep).toContain('1/2026-09/b.png');
    expect(p1Sep).not.toContain('1/2026-08/a.png');

    // dự án 2: chỉ thấy ảnh của dự án 2 (ảnh seed url rỗng vẫn nằm trong kết quả)
    const p2 = repo.getPhotos(2).map((p) => p.url);
    expect(p2).toContain('2/2026-09/c.png');
    expect(p2).not.toContain('1/2026-09/b.png');
  });

  it('getPhotoById trả null với id không tồn tại', () => {
    expect(repo.getPhotoById(999999)).toBeNull();
  });

  it('deletePhoto xóa record và trả true; id không tồn tại trả false', () => {
    const created = repo.addPhoto(1, '2026-09', '1/2026-09/x.png', '', 'x@y');

    expect(repo.deletePhoto(created.id)).toBe(true);
    expect(repo.getPhotoById(created.id)).toBeNull();
    expect(repo.getPhotos(1).map((p) => p.id)).not.toContain(created.id);
    expect(repo.deletePhoto(created.id)).toBe(false);
  });

  it('xóa ảnh seed (url rỗng, không có file vật lý) vẫn xóa được record', () => {
    const seed = repo.getPhotos(1).find((p) => p.url === '')!;
    expect(repo.deletePhoto(seed.id)).toBe(true);
    expect(repo.getPhotoById(seed.id)).toBeNull();
  });

  it('getAssignmentsForUser trả đúng dự án PIC (cơ sở kiểm quyền xóa/xem)', () => {
    expect(repo.getAssignmentsForUser('pm@daidung.com.vn')).toEqual([1, 2, 3, 5, 7, 11]);
    expect(repo.getAssignmentsForUser('khong-ton-tai@localhost')).toEqual([]);
  });
});
