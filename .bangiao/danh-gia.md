PHAN QUYET: CHOT

# P3D-B - Chặn truy cập khi chưa đăng nhập (S-1): đánh giá chặng cuối

Skill reviewer dùng: `ddc-tower:code-review`.
Phạm vi: `git diff main...HEAD` trên nhánh `feature/p3d-b-chan-truy-cap` (HEAD lúc đánh giá 584a5d9, từ main @ 59ee4b3).
Lượt reviewer đầu bị đứt vì hết limit; lượt 2 chạy lại đầy đủ.

## Cổng kiểm do reviewer chạy lại

- `npx tsc --noEmit`: exit 0.
- `npm test`: 200/200 file, 2168/2168 test (đúng mốc).
- E2e: tester đã chạy 60/60; điều phối chạy lại 03+09 được 43/43 sau khi vá L-1.

## 1. Khớp kế hoạch và 3 quyết định đã chốt

Có.
- Chốt 1 (không làm callbackUrl): middleware redirect thẳng về `/{locale}/login`, `LoginForm` không đổi.
- Chốt 2 (đường dẫn lạ khi chưa đăng nhập về login): mọi subpath ngoài `PUBLIC_PATHS = ['/login']` đều redirect, có test trong `middleware-auth.qa.test.ts`.
- Chốt 3 (không vá phần ảnh, không giữ `actions.ts`): không đụng `app/api/photos/**` hay `actions.ts`.
- Bảng `DENIED` và `homeForRole` giữ nguyên; không sửa file nóng, PROGRESS.md, .serena/, CLAUDE.md; không có gạch dài trong phần thêm mới.

## 2. Chất lượng và độ đơn giản

- `src/lib/require-user.ts`: một hàm, gom 13 bản sao kiểm phiên về một chỗ, chú thích rõ vì sao phải gọi ở page và cấm bọc try/catch.
- `middleware.ts`: tách `hasSession` khỏi `role`; `token.invalid` và `getToken` ném lỗi đều là chưa đăng nhập (fail closed); `/login` luôn cho qua nên không vòng lặp.
- L-1 (`projects/[id]/page.tsx`): kiểm `^[1-9]\d*$` sau `requireUser`, trước `Number()`.
- Hành vi người đã đăng nhập giữ nguyên; danh sách vai từng page khớp `DENIED`.
- Commit 2c57b1d (chuẩn hoá CRLF trong `p3c-contract.qa.test.ts`) ngoài S-1 nhưng đúng luật xử lý test chập chờn.

## 3. Test có giá trị thật

Có: e2e 09 quét đủ 13 page vi/en kèm `RSC: 1`, kiểm mã redirect, đích và body; test tĩnh chặn page mới quên `requireUser` và route API mới chưa khai cách chặn; spy chứng minh 4 page từng hở không đọc repo trước khi redirect; test middleware phủ token null/ném lỗi/invalid/thiếu role, chống vòng lặp, DENIED theo vai.

## 4. Bảo mật, hiệu năng

- `bao-mat.md`: ĐẠT. L-1 đã vá; L-2, L-3 mức THẤP ghi nợ cho P5 (A); 2 điểm yếu phần ảnh A gỡ ở P3E.
- Hiệu năng: mỗi page thêm một lệnh đọc phiên, không đáng kể.

## Điểm nhỏ reviewer nêu và xử lý

1. THẤP, `app-pages-require-user.test.ts` (`awaitedCallees`) chỉ soát thứ tự `await`, không bắt lệnh đọc dữ liệu không await trước `requireUser`: **ghi nợ** phase sau.
2. THẤP, e2e chỉ chứng minh lớp middleware: **ĐÃ LÀM** (điều phối B, sau reviewer), thêm 2 ca e2e gửi `x-middleware-subrequest` + `RSC: 1` tới `/vi/overview`, `/vi/projects/1`, body không chứa `projectName`/`masterCode`. `npm run test:e2e -- e2e/09-chan-chua-dang-nhap.spec.ts` = 44/44 xanh.
3. NIT, chú thích `src/lib/require-user.ts` không dấu: **ĐÃ SỬA** thành có dấu.
4. GHI NHẬN: token hợp lệ thiếu `role` nay là `viewer` và chịu DENIED; chặt hơn, khớp `getCurrentUser`, thực tế không phát sinh.

## Kết luận

CHỐT.
S-1 được chặn ở hai lớp độc lập (middleware và `requireUser` ở từng page), có test chống quên cho page và route API mới.
Hành vi người đã đăng nhập không đổi.
Đủ điều kiện merge vào `main` khi chủ dự án đồng ý.
