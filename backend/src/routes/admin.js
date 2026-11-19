import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate, requireRole, publicUser } from '../middleware/auth.js';
import { User } from '../models/user.js';
import { Order } from '../models/order.js';
import { AdminAudit } from '../models/adminAudit.js';
import { ForumPost, ForumComment, ForumCommentReaction, forumCategories, excludeDeletedThreads } from '../models/forum.js';
import { validBirthDate } from './profile.js';

const pageSize = 15;
const validId = id => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
const active = { deletedAt: null };
const userFields = 'username displayName email phone gender birthDate role deletedAt createdAt lastLoginAt';
const missing = res => res.status(404).json({ message: 'Không tìm thấy dữ liệu.' });
const invalid = res => res.status(400).json({ message: 'Thông tin nhập vào không hợp lệ.' });

function search(query, fields) {
  if (typeof query !== 'string' || !query.trim()) return {};
  const escaped = query.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { $or: fields.map(field => ({ [field]: { $regex: escaped, $options: 'i' } })) };
}

function pageNumber(query) {
  const value = Number(query.page);
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, 10000) : 1;
}

async function list(model, filter, page, fields, sort = { createdAt: -1, _id: -1 }) {
  const [rows, total] = await Promise.all([
    model.find(filter).select(fields).sort(sort).skip((page - 1) * pageSize).limit(pageSize).lean(),
    model.countDocuments(filter),
  ]);
  return { rows, total, page, pageSize };
}

// Ẩn bình luận nếu bài viết chứa nó đã bị xóa.
function visibleComments(filter = {}) {
  return [
    { $match: { ...filter, ...active } },
    ...excludeDeletedThreads(),
    { $lookup: {
      from: ForumPost.collection.name, localField: 'postId', foreignField: '_id',
      pipeline: [{ $match: active }, { $project: { title: 1 } }], as: 'post',
    } },
    { $unwind: '$post' },
  ];
}

async function activityFor(user) {
  const userId = user._id;
  const latest = { _id: -1 };
  const limit = 15;
  const [orders, posts, comments, reactions, reviews, totals] = await Promise.all([
    Order.find({ userId }).select('createdAt items.name total').sort({ createdAt: -1 }).limit(limit).lean(),
    ForumPost.find({ userId }).select('title createdAt deletedAt').sort(latest).limit(limit).lean(),
    ForumComment.find({ userId }).select('body createdAt deletedAt parentId postId').sort(latest).limit(limit).lean(),
    ForumCommentReaction.find({ userId }).select('reaction updatedAt').sort({ updatedAt: -1, _id: -1 }).limit(limit).lean(),
    Order.aggregate([
      { $match: { userId } }, { $unwind: '$items' },
      { $match: { 'items.review.date': { $exists: true } } },
      { $sort: { 'items.review.date': -1 } }, { $limit: limit },
      { $project: { name: '$items.name', rating: '$items.review.rating', date: '$items.review.date' } },
    ]),
    Order.aggregate([
      { $match: { userId } },
      { $group: { _id: null, orderCount: { $sum: 1 }, orderTotal: { $sum: '$total' } } },
    ]),
  ]);
  const events = [
    { type: 'register', date: user.createdAt, text: 'Tạo tài khoản' },
    { type: 'login', date: user.lastLoginAt, text: 'Đăng nhập gần nhất' },
    ...orders.map(order => ({
      type: 'order', date: order.createdAt, text: order.items.map(item => item.name).join(', '), amount: order.total,
    })),
    ...posts.map(post => ({ type: 'post', date: post.createdAt, text: post.title, deleted: !!post.deletedAt })),
    ...comments.map(comment => ({
      type: comment.parentId ? 'reply' : 'comment', date: comment.createdAt, text: comment.body, deleted: !!comment.deletedAt,
    })),
    ...reviews.map(review => ({ type: 'review', date: review.date, text: review.name + ' · ' + review.rating + '/5 sao' })),
    ...reactions.map(reaction => ({
      type: 'reaction', date: reaction.updatedAt, text: reaction.reaction === 'like' ? 'Thích bình luận' : 'Không thích bình luận',
    })),
  ];
  return {
    activity: events.filter(event => event.date).sort((a, b) => b.date - a.date).slice(0, limit),
    orderCount: totals[0]?.orderCount ?? 0,
    orderTotal: totals[0]?.orderTotal ?? 0,
  };
}

// Lưu thao tác và nhật ký trong cùng giao dịch MongoDB.
async function change(req, model, filter, update, action, describe) {
  return mongoose.connection.transaction(async session => {
    const item = await model.findOneAndUpdate(filter, update, { session, runValidators: true });
    if (!item) return false;
    await AdminAudit.create([{
      actor: req.user.username, actorId: req.user._id, action,
      targetId: item._id, target: describe(item), fields: Object.keys(update.$set ?? {}),
    }], { session });
    return true;
  });
}

function userChanges(body) {
  const changes = {};
  for (const field of ['username', 'email', 'phone', 'displayName', 'gender', 'birthDate', 'role']) {
    if (!Object.hasOwn(body, field)) continue;
    if (typeof body[field] !== 'string') return null;
    changes[field] = body[field].trim();
  }
  if (changes.username !== undefined) {
    changes.username = changes.username.toLowerCase();
    if (!/^[a-z0-9_.-]{3,30}$/.test(changes.username)) return null;
  }
  if (changes.email !== undefined) {
    changes.email = changes.email.toLowerCase();
    if (changes.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) return null;
  }
  if (changes.phone !== undefined && !/^\+?\d{9,15}$/.test(changes.phone)) return null;
  if (changes.displayName?.length > 80 || changes.birthDate && !validBirthDate(changes.birthDate)) return null;
  if (changes.gender !== undefined && !['', 'male', 'female', 'other'].includes(changes.gender)) return null;
  if (changes.role !== undefined && !['user', 'partner'].includes(changes.role)) return null;
  return changes;
}

export function adminRoutes(users = User) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(authenticate(users), requireRole('admin'));

  router.get('/overview', async (req, res) => {
    const [accounts, posts, comments, orders, audit, recentOrders] = await Promise.all([
      User.countDocuments(active), ForumPost.countDocuments(active),
      ForumComment.aggregate([...visibleComments(), { $count: 'total' }]),
      Order.aggregate([{ $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$total' } } }]),
      AdminAudit.find().sort({ _id: -1 }).limit(6).lean(),
      Order.find().select('total createdAt items.name userId').sort({ createdAt: -1 }).limit(5).lean(),
    ]);
    res.json({
      viewer: publicUser(req.user), metrics: {
        accounts, posts, comments: comments[0]?.total ?? 0,
        orders: orders[0]?.count ?? 0, orderValue: orders[0]?.total ?? 0,
      }, audit, recentOrders,
    });
  });

  router.get('/users', async (req, res) => {
    const filter = search(req.query.q, ['username', 'email', 'displayName', 'phone']);
    if (['user', 'partner', 'admin'].includes(req.query.role)) filter.role = req.query.role;
    if (req.query.status === 'active') filter.deletedAt = null;
    if (req.query.status === 'deleted') filter.deletedAt = { $ne: null };
    res.json(await list(User, filter, pageNumber(req.query), userFields));
  });

  router.get('/users/:id', async (req, res) => {
    if (!validId(req.params.id)) return missing(res);
    const user = await User.findById(req.params.id).select(userFields).lean();
    if (!user) return missing(res);
    res.json({ user, ...await activityFor(user) });
  });

  router.patch('/users/:id', async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return missing(res);
    const changes = userChanges(req.body ?? {});
    if (!changes || !Object.keys(changes).length) return invalid(res);
    const filter = { _id: id, ...active };
    const update = { $set: changes };
    if (changes.role !== undefined) {
      filter.role = { $ne: 'admin' };
      // Đổi quyền buộc tài khoản đăng nhập lại.
      update.$inc = { sessionVersion: 1 };
    }
    try {
      if (!await change(req, User, filter, update, 'user.edit', user => user.username)) return missing(res);
      res.json({ message: 'Đã lưu tài khoản.' });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: 'Tên đăng nhập hoặc email đã được sử dụng.' });
      throw error;
    }
  });

  router.delete('/users/:id', async (req, res) => {
    if (!validId(req.params.id)) return missing(res);
    const filter = { _id: req.params.id, role: { $ne: 'admin' }, ...active };
    const update = { $set: { deletedAt: new Date() }, $inc: { sessionVersion: 1 } };
    if (!await change(req, User, filter, update, 'user.delete', user => user.username)) {
      return res.status(409).json({ message: 'Tài khoản đã bị xóa, không tồn tại hoặc là tài khoản quản trị.' });
    }
    res.json({ message: 'Đã xóa tài khoản và thu hồi phiên đăng nhập.' });
  });

  router.post('/users/:id/restore', async (req, res) => {
    if (!validId(req.params.id)) return missing(res);
    const filter = { _id: req.params.id, deletedAt: { $ne: null } };
    if (!await change(req, User, filter, { $unset: { deletedAt: 1 } }, 'user.restore', user => user.username)) return missing(res);
    res.json({ message: 'Đã khôi phục tài khoản.' });
  });

  router.get('/orders', async (req, res) => {
    const { userId, q } = req.query;
    const filter = search(q, ['_id', 'items.name']);
    if (userId !== undefined) {
      if (typeof userId !== 'string' || !validId(userId)) return invalid(res);
      filter.userId = userId;
    }
    const result = await list(Order, filter, pageNumber(req.query));
    const customers = await User.find({ _id: { $in: result.rows.map(order => order.userId) } }).select('username displayName').lean();
    const names = new Map(customers.map(customer => [String(customer._id), customer.displayName || customer.username]));
    res.json({ ...result, rows: result.rows.map(order => ({ ...order, customer: names.get(String(order.userId)) })) });
  });

  router.get('/posts', async (req, res) => {
    const { userId, q, category } = req.query;
    const filter = { ...active, ...search(q, ['title', 'body', 'author']) };
    if (userId !== undefined) {
      if (!validId(userId)) return invalid(res);
      filter.userId = userId;
    }
    if (forumCategories.includes(category)) filter.category = category;
    const result = await list(ForumPost, filter, pageNumber(req.query));
    const counts = await ForumComment.aggregate([
      ...visibleComments({ postId: { $in: result.rows.map(post => post._id) } }),
      { $group: { _id: '$postId', count: { $sum: 1 } } },
    ]);
    const byPost = new Map(counts.map(row => [String(row._id), row.count]));
    res.json({
      ...result,
      rows: result.rows.map(post => ({
        ...post, commentCount: byPost.get(String(post._id)) ?? 0,
        photos: post.sample ? post.sampleImages : post.images.map(id => '/api/forum/images/' + id),
      })),
    });
  });

  router.get('/comments', async (req, res) => {
    const { postId, userId, q } = req.query;
    const filter = search(q, ['body', 'author']);
    if (userId !== undefined) {
      if (!validId(userId)) return invalid(res);
      filter.userId = new mongoose.Types.ObjectId(userId);
    }
    if (postId !== undefined) {
      if (typeof postId !== 'string' || !validId(postId)) return invalid(res);
      filter.postId = new mongoose.Types.ObjectId(postId);
    }
    const page = pageNumber(req.query);
    const [result] = await ForumComment.aggregate([
      ...visibleComments(filter),
      { $facet: {
        rows: [{ $sort: { _id: -1 } }, { $skip: (page - 1) * pageSize }, { $limit: pageSize }],
        totals: [{ $count: 'total' }],
      } },
    ]);
    res.json({ rows: result.rows, total: result.totals[0]?.total ?? 0, page, pageSize });
  });

  for (const [path, model] of [['posts', ForumPost], ['comments', ForumComment]]) {
    const isPost = path === 'posts';
    const description = item => isPost ? item.title : item.body.slice(0, 100);
    router.patch('/' + path + '/:id', async (req, res) => {
      const { id } = req.params;
      if (!validId(id)) return missing(res);
      const { body, title, category } = req.body ?? {};
      if (typeof body !== 'string' || !body.trim() || body.trim().length > (isPost ? 5000 : 1000)) return invalid(res);
      const changes = { body: body.trim() };
      if (isPost) {
        if (typeof title !== 'string' || !title.trim() || title.trim().length > 120 || !forumCategories.includes(category)) return invalid(res);
        Object.assign(changes, { title: title.trim(), category });
      }
      if (!await change(req, model, { _id: id, ...active }, { $set: changes }, path + '.edit', description)) return missing(res);
      res.json({ message: 'Đã lưu nội dung.' });
    });
    router.delete('/' + path + '/:id', async (req, res) => {
      if (!validId(req.params.id)) return missing(res);
      if (!await change(req, model, { _id: req.params.id, ...active }, { $set: { deletedAt: new Date() } },
        path + '.delete', description)) return missing(res);
      res.json({ message: 'Đã xóa nội dung khỏi diễn đàn.' });
    });
  }

  router.get('/audit', async (req, res) => {
    res.json(await list(AdminAudit, search(req.query.q, ['actor', 'target']), pageNumber(req.query)));
  });

  return router;
}
