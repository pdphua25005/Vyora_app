/*
ĐƠN MUA VÀ ĐÁNH GIÁ — router được gắn tại /api trong src/app.js.
Order lưu userId, các dòng sản phẩm, ngày giờ sử dụng, tổng tiền và đánh giá.
Giỏ hàng thuộc frontend; API nhận các dòng đã chọn để kiểm tra và tạo đơn.
Phần đặt hàng hiện mô phỏng thanh toán của đồ án.
*/

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { Order } from '../models/order.js';
import { User } from '../models/user.js';

// Giá và giới hạn số lượng được xác định trên server.
const catalog = {
  'cho-noi-cai-rang': { name: 'Vé Tham quan Chợ Nổi Cái Răng', image: 'cai-rang.png', price: 120000 },
  'bien-dinh-cau': { name: 'Vé Tham quan Biển Dinh Cậu', image: 'dinh-cau.png', price: 170000 },
  'leu-camping': { name: 'Lều Camping Cao Cấp', image: 'leu-camping.png', price: 99000, stock: 4 },
  'tau-da-nang-hue': { name: 'Vé tàu hoả tuyến Đà Nẵng - Huế', image: 'tau-da-nang-hue.png', price: 35000, stock: 4 },
  'xe-camping': { name: 'Xe Camping Combo tiện ích', image: 'xe-camping.png', price: 499000, stock: 2 },
  'lau-hai-san-phu-yen': { name: 'Lẩu hải sản Cô Tuy Phú Yên', image: 'lau-hai-san.png', price: 199000 },
  'du-thuyen-ha-long': { name: 'Du thuyền Hạ Long', image: '/assets/vyora/c7057f1803c9ea72.png', price: 1990000 },
  'pho-co-hoi-an': { name: 'Khám phá phố cổ Hội An', image: '/assets/vyora/59f5b6b56f2c3263.png', price: 299000 },
  'nghi-duong-phu-quoc': { name: 'Nghỉ dưỡng Phú Quốc', image: '/assets/vyora/b496e2fcde70b24c.png', price: 1490000 },
  'glamping-da-lat': { name: 'Glamping giữa rừng thông', image: '/assets/vyora/13eaf6f38164f945.png', price: 599000 },
  'ba-na-hills-cau-vang': { name: 'Vé Bà Nà Hills & Cầu Vàng', image: '/assets/vyora/59ace4d93b582318.png', price: 850000 },
  'cho-noi-cai-rang-buoi-som': { name: 'Chợ nổi Cái Răng buổi sớm', image: '/assets/vyora/5b4c90351208c6d1.png', price: 249000 },
  'victoria-hotel-vung-tau': { name: 'Victoria Hotel Vũng Tàu', image: '/assets/vyora/96c5b501a5b4aa63.png', price: 1200000 },
  'park-hyatt-saigon': { name: 'Park Hyatt Saigon Hotel', image: '/assets/vyora/151949d2b13dc116.png', price: 2200000 },
  'vinpearl-nha-trang': { name: 'Vinpearl Nha Trang', image: '/assets/vyora/de4e0513103138f2.png', price: 600000 },
  've-bay-hcm-pattaya': { name: 'Vé bay HCM - Pattaya', image: '/assets/vyora/335b0ca14e8b842b.png', price: 649000 },
  'muong-thanh-can-tho': { name: 'Mường Thanh Cần Thơ', image: '/assets/vyora/ff3845e2b4ca944f.png', price: 1200000 },
  'banh-uot-cay-me': { name: 'Bánh ướt Cây Me', image: '/assets/vyora/f9aba3564ae497fd.png', price: 30000 },
  'vietjet-can-tho-da-lat': { name: 'VietJet Cần Thơ - Đà Lạt', image: '/assets/vyora/c02d782891249e9d.png', price: 700000 },
  'phuong-trang-gia-lai-hue': { name: 'Phương Trang Gia Lai - Huế', image: '/assets/vyora/ca4c870199b6a7c2.png', price: 165000 },
  'hygge-homestay': { name: 'Hygge Homestay', image: '/assets/vyora/7fd93f2a0d19e1ca.png', price: 400000 },
  'dalat-homestay': { name: 'DaLat Homestay', image: '/assets/vyora/507e87a30b9e425a.png', price: 349000 },
  'vf3-tu-lai': { name: 'VF3 Tự lái theo ngày', image: '/assets/vyora/e5d84385cd57f543.png', price: 300000 },
  'hi-spa-duong-sinh': { name: 'Hi Spa dưỡng sinh', image: '/assets/vyora/07bfa78bdc03fd82.png', price: 299000 },
};

// Kiểm tra YYYY-MM-DD là ngày tồn tại; hàm này kiểm tra định dạng/ngày thực tế.
function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
}

export function orderRoutes(users, orders = Order) {
  const router = Router();
  const signedIn = authenticate(users);

  /**
   * GET /api/orders — Xem đơn đã mua.
   * Quyền truy cập — Đã đăng nhập.
   * Đầu vào — Cookie phiên; lấy userId từ req.user.
   * Thành công — 200 { orders }, sắp xếp đơn mới nhất trước.
   * Xử lý — Tìm Order theo đúng tài khoản trong phiên; no-store yêu cầu trình duyệt tải dữ liệu mới.
   * Lỗi thường gặp — 401 phiên không hợp lệ.
   */
  router.get('/orders', signedIn, async (req, res) => {
    const result = await orders.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    res.set('Cache-Control', 'no-store').json({ orders: result });
  });

  /**
   * POST /api/orders — Tạo đơn mua kiểm thử.
   * Quyền truy cập — Đã đăng nhập.
   * Đầu vào — JSON { requestId, items: [{ slug, date, time, quantity }], voucherApplied?, cartOwner?, note?, payment? }.
   * Thành công — 201 { order } khi tạo mới; 200 { order } nếu gửi lại requestId của đơn đã tạo bởi chính tài khoản.
   * Xử lý — Kiểm tra tài khoản, từng dòng, giới hạn số lượng theo khung giờ; lấy giá server, tính tổng và lưu Order.
   * Lỗi thường gặp — 400 dữ liệu sai; 401 thiếu phiên; 409 sai cartOwner hoặc mã requestId đã thuộc đơn khác.
   */
  router.post('/orders', signedIn, async (req, res) => {
    const { requestId, items, voucherApplied, cartOwner, note = '', payment = 'arrival' } = req.body ?? {};
    if (cartOwner !== undefined && cartOwner !== String(req.user._id)) {
      return res.status(409).json({ message: 'Tài khoản đã thay đổi. Hãy mở lại giỏ hàng để đặt hàng.' });
    }
    if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(requestId) ||
        !Array.isArray(items) || items.length < 1 || items.length > 30 ||
        typeof note !== 'string' || note.length > 200 ||
        !['arrival', 'transfer', 'card'].includes(payment)) {
      return res.status(400).json({ message: 'Thông tin đơn hàng không hợp lệ.' });
    }

    // date dùng YYYY-MM-DD; time dùng HH:mm; quantity là số nguyên dương.
        // payment nhận arrival, transfer hoặc card; note tối đa 200 ký tự.
        // quantitiesByTime cộng các dòng trùng slug/ngày/giờ trong cùng yêu cầu,
        // rồi kiểm tra mức stock trong catalog (mặc định 99); đây là giới hạn từng đơn.
    const lines = [];
    const quantitiesByTime = new Map();
    for (const item of items) {
      const { slug, date, time, quantity } = item ?? {};
      const product = typeof slug === 'string' && Object.hasOwn(catalog, slug) ? catalog[slug] : null;
      if (!product || !validDate(date) || typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
          !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: 'Hãy kiểm tra sản phẩm, ngày giờ và số lượng đã chọn.' });
      }

      const slot = slug + '/' + date + '/' + time;
      const slotQuantity = (quantitiesByTime.get(slot) ?? 0) + quantity;
      if (slotQuantity > (product.stock ?? 99)) {
        return res.status(400).json({ message: 'Số lượng vượt quá giới hạn của khung giờ đã chọn.' });
      }
      quantitiesByTime.set(slot, slotQuantity);
      lines.push({ slug, date, time, quantity, name: product.name, image: product.image, price: product.price });
    }

    // Tính lại giá từ catalog server; voucherApplied=true giảm 10% và làm tròn số đồng.
    const subtotal = lines.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = subtotal - (voucherApplied === true ? Math.round(subtotal * 0.1) : 0);

    try {
      const order = await orders.create({ _id: requestId, userId: req.user._id, items: lines, total, note: note.trim(), payment });
      return res.status(201).json({ order });
    } catch (error) {
      // MongoDB 11000 báo trùng khóa. requestId làm _id giúp tránh tạo đơn lặp khi khách gửi lại.
      if (error.code !== 11000) throw error;
      const order = await orders.findOne({ _id: requestId, userId: req.user._id });
      if (order) return res.json({ order });
      return res.status(409).json({ message: 'Mã yêu cầu đã được sử dụng.' });
    }
  });

  /**
   * POST /api/orders/:id/items/:itemId/review — Đánh giá một sản phẩm đã mua.
   * Quyền truy cập — Đã đăng nhập, đơn thuộc tài khoản hiện tại.
   * Đầu vào — Params id là mã đơn, itemId là _id dòng sản phẩm; JSON { rating, comment }.
   * Thành công — 201 { review } gồm author, rating, comment, date.
   * Xử lý — Kiểm tra rating nguyên 1–5, comment 1–500 ký tự; cập nhật dòng chưa có review trong đúng đơn của người dùng.
   * Lỗi thường gặp — 400 dữ liệu sai; 401 thiếu phiên; 409 đã đánh giá hoặc dòng sản phẩm không thuộc đơn của mình.
   */
  router.post('/orders/:id/items/:itemId/review', signedIn, async (req, res) => {
    const { rating, comment } = req.body ?? {};
    const { id, itemId } = req.params;
    if (!/^[a-f0-9-]{36}$/.test(id) || !/^[a-f0-9]{24}$/.test(itemId) ||
        !Number.isInteger(rating) || rating < 1 || rating > 5 ||
        typeof comment !== 'string' || !comment.trim() || comment.trim().length > 500) {
      return res.status(400).json({ message: 'Chọn từ 1 đến 5 sao và nhập nhận xét tối đa 500 ký tự.' });
    }

    const review = { author: req.user.username, rating, comment: comment.trim(), date: new Date() };
    // $elemMatch kiểm tra cùng một dòng; items.$ chọn dòng đó để ghi review nguyên tử.
    const result = await orders.updateOne(
      { _id: id, userId: req.user._id, items: { $elemMatch: { _id: itemId, review: { $exists: false } } } },
      { $set: { 'items.$.review': review } },
    );
    if (!result.modifiedCount) {
      return res.status(409).json({ message: 'Sản phẩm đã được đánh giá hoặc không thuộc đơn mua của bạn.' });
    }
    res.status(201).json({ review });
  });

  /**
   * GET /api/products/:slug/reviews — Đọc đánh giá trên trang sản phẩm.
   * Quyền truy cập — Công khai.
   * Đầu vào — Params slug là mã sản phẩm trong catalog.
   * Thành công — 200 { reviews }, có avatar và sắp xếp đánh giá mới nhất trước.
   * Xử lý — aggregate tách items, lọc slug có review, nối User để lấy avatar và chọn trường trả về.
   * Lỗi thường gặp — 404 slug không tồn tại.
   */
  router.get('/products/:slug/reviews', async (req, res) => {
    if (!Object.hasOwn(catalog, req.params.slug)) return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });
    const reviews = await orders.aggregate([
      { $match: { 'items.slug': req.params.slug } },
      // $unwind tách mỗi phần tử items thành một bản ghi để lọc đánh giá theo sản phẩm.
      { $unwind: '$items' },
      { $match: { 'items.slug': req.params.slug, 'items.review': { $exists: true } } },
      { $sort: { 'items.review.date': -1 } },
      {
        $lookup: {
          from: User.collection.name,
          localField: 'userId',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 0, avatar: 1 } }],
          as: 'reviewer',
        },
      },
      {
        $project: {
          _id: '$items._id',
          author: '$items.review.author',
          avatar: { $ifNull: [{ $arrayElemAt: ['$reviewer.avatar', 0] }, ''] },
          rating: '$items.review.rating',
          comment: '$items.review.comment',
          date: '$items.review.date',
        },
      },
    ]);
    res.json({ reviews });
  });

  return router;
}
