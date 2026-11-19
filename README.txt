VYORA — TRAVEL COMMERCE & JOURNEY MANAGEMENT PLATFORM
Hướng dẫn dự án và khởi chạy trên máy cá nhân
Cập nhật ngày 19/11/2026

1. GIỚI THIỆU

Vyora là đồ án full-stack về thương mại du lịch và quản lý hành trình.
Người dùng có thể tìm sản phẩm, dịch vụ du lịch, chọn lịch sử dụng,
đặt đơn kiểm thử, chia sẻ trải nghiệm và liên hệ quản trị viên.

Giao diện sử dụng nhận diện Vyora và được phát triển từ thiết kế Figma.
Thiết kế tham khảo
https://www.figma.com/design/NaYI3cYyLwIh6GlSGXZQhv/VYORA-APP

Định hướng phát triển tiếp theo gồm quản lý hành trình, checklist,
ngân sách chuyến đi và mở rộng chức năng dành cho đối tác.

2. CÁC CHỨC NĂNG HIỆN CÓ

- Đăng ký, đăng nhập bằng tài khoản và mật khẩu.
- Mã hóa mật khẩu bằng bcrypt, quản lý phiên bằng JWT trong cookie HttpOnly.
- Chỉnh sửa hồ sơ, ảnh đại diện và thông tin liên hệ.
- Xem Flash Sale, sản phẩm gợi ý và trang chi tiết của từng sản phẩm.
- Lọc sản phẩm theo 10 danh mục trên trang chủ.
- Chọn ngày giờ sử dụng, số lượng và thêm sản phẩm vào giỏ.
- Giỏ hàng lưu riêng theo tài khoản trên cùng trình duyệt.
  Khi đăng xuất, giỏ khách hiển thị trống.
- Đăng nhập để thanh toán và tạo đơn kiểm thử.
- Xem đơn đã mua, đánh giá sản phẩm sau khi mua.
- Đăng bài diễn đàn, đính kèm tối đa 5 ảnh, mỗi ảnh tối đa 5 MB.
- Bình luận, trả lời và thích hoặc không thích bình luận.
- Hiển thị bài thật từ cộng đồng trên trang chủ.
- Popup ưu đãi sản phẩm khi vào trang chủ lần đầu trong phiên trình duyệt.
- Nút liên hệ Zalo, điện thoại và chat với quản trị viên.
- Chat lưu lịch sử trong MongoDB, cập nhật thời gian thực bằng SSE.
- Admin xem, sửa, xóa và khôi phục tài khoản; tra cứu đơn mua,
  hoạt động người dùng; sửa hoặc xóa bài viết, bình luận.
- Nhật ký thao tác quản trị và hộp thư trả lời khách hàng.

Phần đặt hàng đang phục vụ kiểm thử. Đặt thành công sẽ tạo đơn trong MongoDB
và hiển thị ở mục Đã mua. Các lựa chọn thanh toán hiện dùng để mô phỏng,
chưa tích hợp cổng thanh toán để thu tiền.

3. CÔNG NGHỆ

Frontend
- React, Vite, JavaScript/JSX, CSS.
- React Router để điều hướng.

Backend
- Node.js, Express, REST API.
- Mongoose làm việc với MongoDB Atlas.
- bcrypt, JWT và cookie để xác thực.
- Server-Sent Events (SSE) để cập nhật chat thời gian thực.

Database
- MongoDB Atlas.
- Database của dự án là vyora_db.
- Cluster của dự án là vyora-cluster.

4. CẤU TRÚC THƯ MỤC

Vyora_app/
  README.txt
  .gitignore
  backend/
    .env.example             Mẫu cấu hình môi trường
    .env                     Cấu hình riêng trên máy
    package.json
    scripts/grant-admin.js   Cấp quyền quản trị cho tài khoản có sẵn
    src/
      server.js              Kết nối database và mở cổng backend
      app.js                 Gắn các nhóm API
      config/                Cấu hình MongoDB
      middleware/            Xác thực và phân quyền
      models/                Schema dữ liệu
      routes/                API tài khoản, đơn mua, diễn đàn, admin, chat
    test/                    Kiểm thử backend
  frontend/
    package.json
    vite.config.js           Cổng frontend và proxy /api
    public/assets/           Ảnh, font và tài nguyên giao diện
    src/
      App.jsx                Các đường dẫn của website
      pages/                 Trang chủ, tài khoản, sản phẩm, diễn đàn, admin
      components/chat/       Nút liên hệ và giao diện chat
      services/              Gọi API, giỏ hàng và phiên đăng nhập

5. CHUẨN BỊ MÔI TRƯỜNG

- Cài Node.js và npm.
  Môi trường đã sử dụng trong quá trình phát triển là Node.js 24.11.1,
  npm 11.6.2.
  Các package hiện cài yêu cầu Node.js 20.19 trở lên trong nhánh 20,
  hoặc Node.js từ 22.12 trở lên.
- Có kết nối Internet để cài package và truy cập MongoDB Atlas.
- Có database user và chuỗi kết nối MongoDB Atlas.
- Thêm địa chỉ IP hiện tại của máy vào Network Access trong Atlas.
- Database user cần quyền đọc và ghi vào vyora_db.

Kiểm tra Node.js và npm trong Terminal

  node -v
  npm -v

6. CÀI PACKAGE

Mở Terminal tại thư mục gốc Vyora_app.
Nếu dùng đúng vị trí dự án trên máy hiện tại, chạy

  cd "/Users/phamdacphu/Documents/[STUDY]/Vyora_app"

Các lệnh từ đây dùng đường dẫn tương đối để có thể chạy trên máy khác.

Cài package backend

  cd backend
  npm install

Cài package frontend

  cd ../frontend
  npm install

Sau khi cài xong, quay về thư mục gốc

  cd ..

7. CẤU HÌNH BACKEND

Mở thư mục backend và tạo file .env từ mẫu nếu chưa có.
Giữ cấu hình đang dùng nếu file .env đã tồn tại.

  cd backend
  cp -n .env.example .env

Mở backend/.env bằng trình soạn thảo và điền các biến sau

  PORT=5001
  NODE_ENV=development
  MONGODB_URI=<chuỗi kết nối Atlas có database vyora_db>
  JWT_SECRET=<chuỗi bí mật ngẫu nhiên ít nhất 32 byte>

Trong Atlas, lấy chuỗi kết nối từ phần Connect dành cho ứng dụng.
Điền database user, mật khẩu database và tên database vyora_db vào URI.
Mật khẩu có ký tự đặc biệt cần được mã hóa URL khi đưa vào URI.

Có thể tạo JWT Secret bằng lệnh sau

  node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"

Sao chép kết quả vào JWT_SECRET trong file .env.
Dấu <...> phía trên là hướng dẫn điền, hãy thay bằng giá trị thực tế.

Backend sử dụng cổng 5001.
Trên macOS của dự án, AirPlay Receiver đang dùng cổng 5000.

File .gitignore đã loại trừ .env, .env.* và giữ lại .env.example.
Giữ mật khẩu, JWT Secret và MongoDB URI trong cấu hình cục bộ.
Các biến bắt đầu bằng VITE_ ở frontend sẽ được đưa vào mã phía trình duyệt.

8. CHẠY DỰ ÁN

Mở hai cửa sổ Terminal riêng.

Terminal 1 — từ thư mục gốc Vyora_app, chạy backend

  cd backend
  npm run dev

Backend sẽ kết nối MongoDB và chạy tại

  http://localhost:5001

Khi thành công, Terminal hiển thị thông tin kết nối MongoDB,
database vyora_db và địa chỉ máy chủ.

Terminal 2 — từ thư mục gốc Vyora_app, chạy frontend

  cd frontend
  npm run dev

Mở website

  http://localhost:5173

Giữ cả hai Terminal hoạt động khi sử dụng website.
Dừng từng tiến trình bằng Ctrl+C trong Terminal tương ứng.
Những lần chạy sau chỉ cần chạy hai lệnh npm run dev trong đúng thư mục.

Frontend gọi các đường dẫn /api. Trong chế độ phát triển, Vite chuyển
các yêu cầu này tới http://localhost:5001 theo frontend/vite.config.js.

9. KIỂM TRA SAU KHI KHỞI CHẠY

Mở API kiểm tra backend

  http://localhost:5001/api/health

Kết quả thành công có các giá trị success = true và status = healthy.

Kiểm tra API qua frontend proxy

  http://localhost:5173/api/health

Các trang chính

  /                              Trang chủ
  /register                      Đăng ký tài khoản
  /login                         Đăng nhập
  /account                       Hồ sơ
  /flash-sale                    Flash Sale
  /flash-sale/:slug              Chi tiết sản phẩm Flash Sale
  /products/:slug                Chi tiết sản phẩm gợi ý hoặc Hot Deal
  /danh-muc/:categoryId           Danh sách sản phẩm theo danh mục
  /cart                          Giỏ hàng
  /checkout                      Thanh toán, yêu cầu đăng nhập
  /orders                        Đơn đã mua
  /forum                         Diễn đàn
  /admin                         Trang quản trị
  /admin?tab=chat                 Hộp thư hỗ trợ của quản trị viên

:slug và :categoryId là vị trí thay bằng mã sản phẩm hoặc danh mục thực tế.
Ví dụ sản phẩm

  http://localhost:5173/flash-sale/leu-camping

10. SỬ DỤNG TÀI KHOẢN QUẢN TRỊ

Bước 1. Đăng ký một tài khoản tại /register.
Bước 2. Mở Terminal trong thư mục backend.
Bước 3. Thay ten_dang_nhap bằng tài khoản vừa đăng ký rồi chạy

  npm run admin:grant -- ten_dang_nhap

Bước 4. Đăng nhập lại tài khoản để nhận phiên có quyền quản trị.
Bước 5. Mở http://localhost:5173/admin.

Quyền quản trị được kiểm tra trên backend.
Tài khoản đăng ký qua giao diện được tạo với vai trò user.
Các vai trò hiện có gồm user, partner và admin.

11. KIỂM THỬ ĐẶT HÀNG VÀ ĐÁNH GIÁ

- Đăng nhập, mở một sản phẩm và chọn ngày, giờ, số lượng.
- Thêm vào giỏ hoặc chọn Mua với Voucher.
- Chọn sản phẩm trong giỏ và bấm Mua hàng.
- Nhập thông tin nhận hàng, chọn phương thức thanh toán và đặt hàng.
- Khi nhận thông báo thành công, mở mục Đã mua.
- Đánh giá sản phẩm đã mua rồi xem đánh giá trên trang thông tin sản phẩm.

Khách chưa đăng nhập được chuyển tới trang đăng nhập khi mua hàng.
Mã voucher kiểm thử hiện có là VYORA10, giảm 10% theo logic hiện tại.

12. SỬ DỤNG CHAT HỖ TRỢ

Người dùng
- Đăng nhập và bấm nút Chat ở góc phải trang.
- Nhập nội dung rồi bấm Gửi.

Quản trị viên
- Đăng nhập bằng tài khoản admin.
- Mở /admin?tab=chat.
- Chọn cuộc trò chuyện và gửi câu trả lời.

Để kiểm tra hai phía cùng lúc, dùng hai trình duyệt hoặc hai hồ sơ trình
duyệt riêng. Một bên đăng nhập user, bên còn lại đăng nhập admin.
Tin nhắn mới sẽ xuất hiện mà không cần tải lại trang.

Các API chat chính

  GET  /api/chat/messages         Tải lịch sử của người dùng
  POST /api/chat/messages         Gửi và lưu tin nhắn
  GET  /api/chat/events           Kết nối SSE nhận tín hiệu có tin mới
  GET  /api/chat/conversations    Danh sách hội thoại dành cho admin

Admin thêm query userId khi đọc hoặc trả lời một khách cụ thể.
Tin nhắn tối đa 2.000 ký tự. Lịch sử tải theo từng trang.

Zalo và điện thoại mặc định dùng số 0392486394.
Để thay số, tạo frontend/.env.local với nội dung

  VITE_SUPPORT_PHONE=0392486394
  VITE_SUPPORT_ZALO=0392486394

Thay bằng số muốn dùng và khởi động lại Vite.

13. LỆNH KIỂM TRA SOURCE

Trong thư mục backend

  npm test

Trong thư mục frontend

  npm run lint
  npm run build

Build thành công sẽ tạo frontend/dist.
Có thể xem trước bản build frontend bằng

  npm run preview

Để bản build kết nối API khi triển khai, cấu hình máy chủ phục vụ website
chuyển tiếp /api tới backend. Proxy /api hiện nằm trong cấu hình server
phát triển của Vite.

Để chạy backend bằng Node.js trực tiếp, trong thư mục backend dùng

  npm start

14. XỬ LÝ MỘT SỐ LỖI THƯỜNG GẶP

Không kết nối được MongoDB
- Kiểm tra MONGODB_URI và tên database trong backend/.env.
- Kiểm tra database user, mật khẩu và quyền truy cập.
- Kiểm tra IP trong Network Access của Atlas và kết nối Internet.

JWT_SECRET cần ít nhất 32 byte
- Tạo secret bằng lệnh ở mục 7, lưu vào .env rồi chạy lại backend.

Cổng 5001 hoặc 5173 đang được sử dụng
- Tìm Terminal đang chạy dự án và dừng bằng Ctrl+C trước khi chạy lại.
- Kiểm tra tiến trình bằng lsof -nP -iTCP:5001 -sTCP:LISTEN.
- Tương tự, thay 5001 bằng 5173 để kiểm tra frontend.
- Vite có thể chọn cổng kế tiếp khi 5173 bận; xem địa chỉ trong Terminal.

Frontend mở được nhưng gọi API thất bại
- Kiểm tra backend đang hoạt động trên cổng 5001.
- Mở /api/health trực tiếp ở backend và qua frontend để đối chiếu.
- Kiểm tra proxy trong frontend/vite.config.js.

Đăng nhập được nhưng trang admin báo thiếu quyền
- Chạy lệnh cấp quyền ở mục 10, sau đó đăng nhập lại.
- Kiểm tra đang đăng nhập đúng tài khoản đã được cấp quyền.

Chat chưa cập nhật
- Kiểm tra hai bên đã đăng nhập và backend còn hoạt động.
- Admin mở đúng cuộc trò chuyện của khách.
- Kiểm tra kết nối /api/chat/events trong Network của DevTools.
