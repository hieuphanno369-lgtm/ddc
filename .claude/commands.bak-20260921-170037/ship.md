---
description: Chạy trọn dây chuyền sáu agent cho một yêu cầu tính năng.
---

Chạy trọn dây chuyền làm tính năng cho: $ARGUMENTS

Mỗi subagent tự load skill cốt lõi của chặng: planner=`writing-plans`,
coder=`coding-standards` (+`frontend-patterns`/`backend-patterns` tùy phần
đụng), tester=`test-driven-development`+`verification-before-completion`,
debugger=`systematic-debugging`+`investigate-first`,
security-reviewer=`security-review`+`security-audit`, reviewer=`code-review`.
Ship chỉ điều phối, không cần tự load skill cho chúng.

Làm lần lượt các chặng dưới đây, không nhảy cóc. Sau mỗi chặng, kiểm tra
file bàn giao đã tồn tại rồi mới sang chặng kế tiếp.

0. Xem đang đứng trên nhánh git nào. Nếu là nhánh chính (main hoặc
   master), dừng lại và báo cho tôi, không chạy tiếp.
   Sau đó dọn thư mục .bangiao/, tức xoá ke-hoach.md, thay-doi.md,
   ket-qua-test.md, danh-gia.md và danh-gia-bao-mat.md của lần chạy trước,
   để không ai đọc nhầm file cũ.

1. Giao việc cho subagent planner kèm yêu cầu tính năng ở trên.
   Chờ tới khi có .bangiao/ke-hoach.md.

2. Nếu bản kế hoạch có mục CÂU HỎI CÒN BỎ NGỎ, dừng lại và đưa các câu
   hỏi đó cho tôi. Nếu không có, giao việc cho subagent coder.
   Chờ tới khi có .bangiao/thay-doi.md.

3. Giao việc cho subagent tester.
   Chờ tới khi có .bangiao/ket-qua-test.md.
   Có test rớt thì giao subagent debugger: "đọc .bangiao/thay-doi.md +
   .bangiao/ket-qua-test.md, tìm root cause thật sự, sửa tối thiểu đúng
   chỗ, rồi ghi root cause + cách sửa vào .bangiao/thay-doi.md (mục riêng)".
   Sau đó chạy lại tester. Đếm số vòng; quá 2 vòng mà test vẫn rớt thì
   DỪNG và báo cho tôi phần rớt, không loop vô hạn.

4. Giao việc cho subagent security-reviewer.
   Chờ tới khi có .bangiao/danh-gia-bao-mat.md.

5. Giao việc cho subagent reviewer. Yêu cầu reviewer đọc cả
   .bangiao/danh-gia.md lẫn .bangiao/danh-gia-bao-mat.md. Đọc
   .bangiao/danh-gia.md, tìm dòng mở đầu `PHAN QUYET: CHOT / CAN SUA / CHAN`.

   - CHOT: báo phán quyết, gợi ý chạy `upc` để cập nhật tiến độ. DỪNG.
   - CHAN: trình phán quyết + lý do cho tôi. DỪNG.
   - CAN SUA: quay lại chặng coder với yêu cầu "đọc .bangiao/danh-gia.md,
     sửa đúng các mục bị nêu, không làm gì ngoài phạm vi đó", rồi chạy lại
     tester → security-reviewer → reviewer. Đếm số vòng lặp; quá 2 vòng mà
     vẫn CAN SUA hoặc CHAN thì DỪNG và báo tôi, không loop vô hạn.

Báo lại phán quyết cuối cùng. Không gộp nhánh, không push, không tạo pull
request. Cứ để nguyên nhánh đó cho tôi tự xem.
