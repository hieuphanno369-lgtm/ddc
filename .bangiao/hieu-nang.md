# Đo hiệu năng trước/sau khi nâng Next

Quy trình: xem `ke-hoach.md` mục "Quy trình đo và chụp". Build lấy font thật (không mock), DB tạm
`ddc_control_tower_e2e_a`, cổng 3010, cookie phiên admin từ `e2e/.auth/admin.json` (sau `npm run test:e2e:a`).

## Trước (Next 14.2.35)

`npx next build` (font thật) qua, không lỗi tải font (mạng cho qua với `NODE_EXTRA_CA_CERTS`).

| Trang | lần đầu (ms) | median 3 lần sau (ms) |
|---|---|---|
| /vi/overview?month=all | 115 | 59 |
| /vi/overview?month=2026-09 | 95 | 57 |
| /vi/overview?month=2026-08 | 76 | 70 |
| /vi/overview?month=2026-07 | 72 | 65 |
| /vi/projects/1 | 70 | 78 |
| /vi/projects/2 | 98 | 67 |
| /vi/projects/3 | 96 | 77 |

(làm nóng `/vi/projects/4` trước, không tính vào bảng: 513 ms)

Console (Playwright, 1440x900 và 390x844, trang `/vi/overview?month=2026-09` + `/vi/projects/1`): không có
lỗi/cảnh báo (`(khong co)` ở cả 2 kích thước).

Ảnh: `.bangiao/anh-test/truoc-overview-1440.png`, `truoc-overview-390.png`, `truoc-project1-1440.png`,
`truoc-project1-390.png`.

## Sau (Next ...)

(cập nhật ở Task 4 Bước 6)
