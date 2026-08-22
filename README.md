# MathArena Multiplayer

Bản này thay phòng giả lập bằng phòng **người thật** qua WebSocket. Không có bot MinhAnh.

## Chạy trên máy
1. Cài Node.js.
2. Mở terminal trong thư mục này.
3. Chạy `npm install`.
4. Chạy `npm start`.
5. Mở `http://localhost:8080`.
6. Mở 2 tab để thử 2 người; mỗi người dùng một tên tài khoản khác nhau.

## Cho hai máy trong cùng Wi‑Fi
Chạy server trên máy chủ và mở cổng 8080. Hai máy truy cập `http://IP-CUA-MAY-CHU:8080`.

## Đưa lên Internet
Deploy cả thư mục này lên một host Node.js hỗ trợ WebSocket. Biến `PORT` được server đọc từ môi trường.

## Ghi chú
- Chat, tạo phòng, vào phòng, danh sách người chơi, bắt đầu trận, tiến độ và điểm được truyền qua WebSocket.
- Kho đề trong `public/index.html` giữ lại ngân hàng đề của MathArena V8 và các bộ chuyên đã bổ sung.
- Tự luận chưa được server chấm AI; hiện có lời giải/rubric để đối chiếu. Muốn chấm AI thật cần thêm API/backend riêng.
