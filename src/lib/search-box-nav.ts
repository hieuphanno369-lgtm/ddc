/**
 * Ô tìm kiếm toàn ứng dụng (topbar `AppShell`/`SearchBox`) debounce 300ms rồi tự sửa URL
 * hiện tại: đặt/xoá `search` + luôn xoá `page` (để quay về trang 1 khi lọc thay đổi).
 *
 * `computeSearchNavParams` tách phần tính toán thuần (không đụng router) ra để test được
 * bằng Vitest môi trường `node`, không cần jsdom.
 *
 * QUAN TRỌNG: trả về `null` khi `v` (giá trị ô tìm kiếm) đã khớp đúng với tham số `search`
 * hiện có trên URL — tức là KHÔNG có gì thay đổi thật do người dùng gõ. Effect gọi hàm này
 * chạy mỗi khi mount (kể cả 2 lần do React StrictMode ở dev), nếu không có "chốt" này thì
 * nó sẽ luôn xoá `page` khỏi MỌI URL đang mở, kể cả khi ô tìm kiếm còn trống và người dùng
 * chưa thao tác gì — đây là nguyên nhân bug 3.16 (`/audit?page=2` tự rơi về trang 1 sau khi
 * mở/tải lại trực tiếp bằng URL).
 */
export function computeSearchNavParams(currentQueryString: string, v: string): string | null {
  const params = new URLSearchParams(currentQueryString);
  const currentSearch = params.get('search') ?? '';
  if (v === currentSearch) return null;
  if (!v) params.delete('search');
  else params.set('search', v);
  params.delete('page');
  return params.toString();
}
