import express from 'express';
import cookieParser from 'cookie-parser';
import healthRoutes from './routes/health.routes.js';
import { orderRoutes } from './routes/orders.js';
import { forumRoutes } from './routes/forum.js';
import { authRoutes } from './routes/auth.routes.js';
import { adminRoutes } from './routes/admin.js';
import { chatRoutes } from './routes/chat.js';

export function createApp({ users, orders } = {}) {
  const app = express();
  app.patch('/api/auth/me', express.json({ limit: '1400kb' }));
  app.use(cookieParser());
  app.use('/api/forum', forumRoutes(users));
  app.use(express.json({ limit: '16kb' }));
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes(users));
  app.use('/api/admin', adminRoutes(users));
  app.use('/api/chat', chatRoutes(users));
  app.use('/api', orderRoutes(users, orders));

  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
  });

  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Dữ liệu JSON không hợp lệ.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Dữ liệu gửi lên quá lớn.' });
    console.error('API request failed:', error.name, error.code ?? '');
    res.status(500).json({ message: 'Máy chủ gặp lỗi. Vui lòng thử lại.' });
  });
  return app;
}

export default createApp();
