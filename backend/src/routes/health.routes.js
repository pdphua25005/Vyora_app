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