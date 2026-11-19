/*
KIỂM TRA MÁY CHỦ — router gắn tại /api/health trong src/app.js.
GET /api/health, công khai, không có body/query bắt buộc.
Trả 200 { success, message, project, status } để kiểm tra backend/proxy.
Endpoint trả trạng thái HTTP của ứng dụng; không truy vấn lại MongoDB.
Khi khởi động bình thường, server.js kết nối MongoDB trước khi mở cổng.
*/

// Tra ve Json de xac nhan Backend dang hoat dong
import { Router } from "express";
const router = Router();

router.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Vyora Backend API dang hoat dong",
        project: "Vyora",
        status: "healthy"
    });
});

export default router;