/*
DIỄN ĐÀN — router được gắn tại /api/forum trong src/app.js.
ForumPost lưu bài; ForumImage lưu nội dung ảnh; ForumComment lưu bình luận
và câu trả lời; ForumCommentReaction lưu cảm xúc theo từng tài khoản.
Bài/bình luận bị admin xóa có deletedAt, các API công khai lọc nội dung này.
Phân trang dùng before là _id cuối trang trước; next=null nghĩa là hết trang.
*/

import { Router, json } from 'express';
import { Types } from 'mongoose';
import { authenticate } from '../middleware/auth.js';
import {
  ForumPost, ForumImage, ForumComment, ForumCommentReaction, forumCategories, excludeDeletedThreads,
} from '../models/forum.js';
import { User } from '../models/user.js';

const maxImageSize = 5 * 1024 * 1024;
const maxEncodedSize = Math.ceil(maxImageSize / 3) * 4;
const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

// Nhận data URL, giải mã Base64, kiểm tra kích thước và chữ ký JPEG/PNG/WebP trước khi lưu Buffer.
function parseImage(image) {
  if (typeof image !== 'string') return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,/.exec(image);
  if (!match) return null;
  const encoded = image.slice(match[0].length);
  if (!encoded || encoded.length > maxEncodedSize) return null;
  const data = Buffer.from(encoded, 'base64');
  if (data.length > maxImageSize || data.toString('base64') !== encoded) return null;

  const contentType = match[1];
  const jpeg = data.length > 4 && data[0] === 255 && data[1] === 216 && data[2] === 255 && data.readUInt16BE(data.length - 2) === 0xffd9;
  const png = data.length >= 24 && data.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && data.toString('ascii', 12, 16) === 'IHDR';
  const webp = data.length >= 16 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
  if (!(contentType === 'image/jpeg' && jpeg || contentType === 'image/png' && png || contentType === 'image/webp' && webp)) return null;
  return { _id: new Types.ObjectId(), contentType, data };
}

// Chuyển _id thành id và dựng URL ảnh để frontend sử dụng mà không tải Buffer trong JSON.
function publicPost(post, commentCount = 0, hasAvatar = false) {
  const { _id, author, category, title, body, createdAt, images, sample, sampleImages } = post;
  const urls = sample ? sampleImages : images.map(id => '/api/forum/images/' + id);
  return {
    id: String(_id), author, category, title, body, createdAt, images: urls,
    sample: Boolean(sample), commentCount, avatar: hasAvatar ? '/api/forum/posts/' + _id + '/avatar' : '',
  };
}

// Tìm một lần các tác giả có avatar để tránh truy vấn riêng cho từng bình luận hoặc bài.
async function usersWithAvatars(items) {
  const users = await User.find({
    _id: { $in: items.map(item => item.userId).filter(Boolean) },
    deletedAt: null,
    avatar: { $type: 'string', $ne: '' },
  }).select('_id').lean();
  return new Set(users.map(user => String(user._id)));
}

// Trả dữ liệu ảnh nhị phân với Content-Type tương ứng; không có ảnh hợp lệ thì trả 404.
async function sendAvatar(res, userId) {
  const user = await User.findOne({ _id: userId, deletedAt: null }).select('avatar').lean();
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(user?.avatar ?? '');
  if (!match) return res.sendStatus(404);
  res.set({ 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
  return res.type(match[1]).send(Buffer.from(match[2], 'base64'));
}

// Chọn trường hiển thị; myReaction là cảm xúc của tài khoản đang đọc hoặc null.
function publicComment(comment, hasAvatar, replyCount = 0, reactions = {}) {
  const { _id, author, body, createdAt } = comment;
  return {
    id: String(_id), author, body, createdAt, replyCount,
    avatar: hasAvatar ? '/api/forum/comments/' + _id + '/avatar' : '',
    likes: reactions.likes ?? 0,
    dislikes: reactions.dislikes ?? 0,
    myReaction: reactions.myReaction ?? null,
  };
}

// aggregate đếm theo postId hoặc parentId, lọc các nội dung đã bị gỡ.
async function countComments(field, ids, filter = {}) {
  const rows = await ForumComment.aggregate([
    { $match: { ...filter, [field]: { $in: ids }, deletedAt: null } },
    ...(field === 'postId' ? excludeDeletedThreads() : []),
    { $group: { _id: '$' + field, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map(row => [String(row._id), row.count]));
}

// Nhóm theo commentId, cộng likes/dislikes và tìm cảm xúc của tài khoản đang đọc.
async function getReactions(ids, userId = null) {
  const rows = await ForumCommentReaction.aggregate([
    { $match: { commentId: { $in: ids } } },
    { $group: {
      _id: '$commentId',
      likes: { $sum: { $cond: [{ $eq: ['$reaction', 'like'] }, 1, 0] } },
      dislikes: { $sum: { $cond: [{ $eq: ['$reaction', 'dislike'] }, 1, 0] } },
      myReaction: { $max: { $cond: [{ $eq: ['$userId', userId] }, '$reaction', null] } },
    } },
  ]);
  return new Map(rows.map(({ _id, ...counts }) => [String(_id), counts]));
}

// Câu trả lời phải gắn vào bình luận gốc còn tồn tại trong cùng bài viết.
async function topLevelComment(postId, commentId) {
  return validId(commentId) && await ForumComment.exists({ _id: commentId, postId, parentId: null, deletedAt: null });
}

// Kiểm tra cả bài viết và bình luận gốc để ẩn câu trả lời thuộc nội dung đã gỡ.
async function visibleComment(comment) {
  if (!comment || !await ForumPost.exists({ _id: comment.postId, deletedAt: null })) return false;
  return !comment.parentId || Boolean(await topLevelComment(comment.postId, String(comment.parentId)));
}

export function forumRoutes(users = User) {
  const router = Router();

  /**
   * GET /api/forum/posts — Danh sách bài viết.
   * Quyền truy cập — Công khai.
   * Đầu vào — Query category?, before?, view=home?.
   * Thành công — 200 { posts, next }; trang diễn đàn tối đa 12 bài, view=home tối đa 7 bài thật.
   * Xử lý — Lọc deletedAt, chủ đề và mốc _id; đếm bình luận rồi chuyển thành dữ liệu hiển thị.
   * Lỗi thường gặp — 400 bộ lọc hoặc before không hợp lệ.
   */
  router.get('/posts', async (req, res) => {
    const { category, before, view } = req.query;
    if ((category !== undefined && !forumCategories.includes(category)) ||
        (before !== undefined && !validId(before)) || (view !== undefined && view !== 'home')) {
      return res.status(400).json({ message: 'Bộ lọc bài viết không hợp lệ.' });
    }
    const filter = { deletedAt: null };
    if (category) filter.category = category;
    if (before) filter._id = { $lt: before };
    if (view === 'home') {
      filter.sample = { $ne: true };
      filter.userId = { $type: 'objectId' };
    }
    const limit = view === 'home' ? 7 : 12;
    // Đọc thêm 1 bản ghi để biết còn trang sau; trả next là id cuối trang hiện tại.
    const page = await ForumPost.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
    const visible = page.slice(0, limit);
    const [counts, avatars] = await Promise.all([
      countComments('postId', visible.map(post => post._id)),
      view === 'home' ? usersWithAvatars(visible) : new Set(),
    ]);
    const posts = visible.map(post => publicPost(post, counts.get(String(post._id)), avatars.has(String(post.userId))));
    res.json({ posts, next: page.length > limit ? posts.at(-1).id : null });
  });

  /**
   * GET /api/forum/posts/:id — Chi tiết bài viết.
   * Quyền truy cập — Công khai.
   * Đầu vào — Params id là ObjectId của bài.
   * Thành công — 200 { post }, có số bình luận và đường dẫn avatar nếu có.
   * Xử lý — Tìm bài còn hiển thị, đếm bình luận và dựng phản hồi.
   * Lỗi thường gặp — 404 sai id, bài không tồn tại hoặc đã bị gỡ.
   */
  router.get('/posts/:id', async (req, res) => {
    const { id } = req.params;
    const post = validId(id) && await ForumPost.findOne({ _id: id, deletedAt: null }).lean();
    if (!post) return res.status(404).json({ message: 'Bài viết không tồn tại hoặc đã bị gỡ.' });
    const [counts, avatars] = await Promise.all([
      countComments('postId', [post._id]), usersWithAvatars([post]),
    ]);
    res.json({ post: publicPost(post, counts.get(id.toLowerCase()), avatars.has(String(post.userId))) });
  });

  /**
   * GET /api/forum/posts/:id/avatar — Ảnh đại diện tác giả bài.
   * Quyền truy cập — Công khai.
   * Đầu vào — Params id là mã bài viết.
   * Thành công — 200 dữ liệu ảnh PNG/JPEG.
   * Xử lý — Kiểm tra bài chưa bị gỡ rồi đọc avatar của tác giả.
   * Lỗi thường gặp — 404 bài/ảnh không tồn tại hoặc tài khoản tác giả đã bị xóa.
   */
  router.get('/posts/:id/avatar', async (req, res) => {
    if (!validId(req.params.id)) return res.sendStatus(404);
    const post = await ForumPost.findOne({ _id: req.params.id, deletedAt: null }).select('userId').lean();
    if (!post?.userId) return res.sendStatus(404);
    return sendAvatar(res, post.userId);
  });

  // Kiểm tra phiên trước khi đọc phần ảnh. Base64 lớn hơn dữ liệu ảnh gốc.
  /**
   * POST /api/forum/posts — Đăng bài kèm ảnh.
   * Quyền truy cập — Đã đăng nhập.
   * Đầu vào — JSON { category, title, body, images? }; images là mảng data URL Base64.
   * Thành công — 201 { post }.
   * Xử lý — Kiểm tra chủ đề, title 1–120 ký tự, body 1–5.000 ký tự, tối đa 5 ảnh và mỗi ảnh tối đa 5 MB; lưu ảnh riêng rồi lưu bài.
   * Lỗi thường gặp — 400 dữ liệu/ảnh sai; 401 thiếu phiên; 413 JSON vượt 35 MB.
   */
  router.post('/posts', authenticate(users), json({ limit: '35mb' }), async (req, res) => {
    const { category, title, body, images = [] } = req.body ?? {};
    if (!forumCategories.includes(category) || typeof title !== 'string' || !title.trim() || title.trim().length > 120 ||
        typeof body !== 'string' || !body.trim() || body.trim().length > 5000) {
      return res.status(400).json({ message: 'Hãy chọn chủ đề, nhập tiêu đề tối đa 120 ký tự và nội dung tối đa 5.000 ký tự.' });
    }
    if (!Array.isArray(images) || images.length > 5) {
      return res.status(400).json({ message: 'Mỗi bài viết được đăng tối đa 5 ảnh.' });
    }
    const files = images.map(parseImage);
    if (files.some(file => !file)) {
      return res.status(400).json({ message: 'Chỉ nhận ảnh JPEG, PNG hoặc WebP hợp lệ, mỗi ảnh không quá 5 MB.' });
    }

    // Lưu mỗi ảnh riêng để bài có 5 ảnh không vượt giới hạn 16 MB của MongoDB.
    const imageIds = files.map(file => file._id);
    const postId = new Types.ObjectId();
    try {
      if (files.length) await ForumImage.insertMany(files);
      const post = await ForumPost.create({
        _id: postId, userId: req.user._id, author: req.user.displayName || req.user.username,
        category, title: title.trim(), body: body.trim(), images: imageIds,
      });
      return res.status(201).json({ post: publicPost(post) });
    } catch (error) {
      // Đọc lại nếu máy chủ mất kết nối sau khi ghi và chưa nhận được xác nhận.
      const saved = await ForumPost.findById(postId).lean();
      if (saved) return res.status(201).json({ post: publicPost(saved) });
      if (imageIds.length) await ForumImage.deleteMany({ _id: { $in: imageIds } });
      throw error;
    }
  });

  /**
   * GET /api/forum/posts/:id/comments — Đọc bình luận hoặc câu trả lời.
   * Quyền truy cập — Công khai; authenticate optional giúp cá nhân hóa myReaction nếu phiên hợp lệ.
   * Đầu vào — Params id là bài; query before?, parent? (id bình luận gốc để xem câu trả lời).
   * Thành công — 200 { comments, next }, tối đa 20 bình luận; gồm avatar, ngày giờ, replyCount, likes, dislikes, myReaction.
   * Xử lý — Kiểm tra bài và parent, lọc bình luận hiển thị, phân trang rồi ghép số cảm xúc.
   * Lỗi thường gặp — 400 before sai; 404 bài hoặc bình luận gốc không còn tồn tại.
   */
  router.get('/posts/:id/comments', authenticate(users, { optional: true }), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { id } = req.params;
    const { before, parent } = req.query;
    if (before !== undefined && !validId(before)) {
      return res.status(400).json({ message: 'Mốc phân trang không hợp lệ.' });
    }
    if (!validId(id) || !await ForumPost.exists({ _id: id, deletedAt: null })) {
      return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
    }
    if (parent !== undefined && !await topLevelComment(id, parent)) {
      return res.status(404).json({ message: 'Không tìm thấy bình luận gốc.' });
    }

    const filter = { postId: id, parentId: parent ?? null, deletedAt: null };
    if (before) filter._id = { $lt: before };
    const page = await ForumComment.find(filter).sort({ _id: -1 }).limit(21).lean();
    const visible = page.slice(0, 20);
    if (!visible.length) return res.json({ comments: [], next: null });
    const ids = visible.map(comment => comment._id);
    const [avatars, replyCounts, reactions] = await Promise.all([
      usersWithAvatars(visible),
      parent ? new Map() : countComments('parentId', ids, { postId: new Types.ObjectId(id) }),
      getReactions(ids, req.user?._id),
    ]);
    const comments = visible.map(comment => publicComment(
      comment, avatars.has(String(comment.userId)),
      replyCounts.get(String(comment._id)), reactions.get(String(comment._id)),
    ));
    res.json({ comments, next: page.length > 20 ? comments.at(-1).id : null });
  });

  /**
   * POST /api/forum/posts/:id/comments — Bình luận hoặc trả lời.
   * Quyền truy cập — Đã đăng nhập.
   * Đầu vào — Params id là bài; JSON { body, parentId? }, body 1–1.000 ký tự.
   * Thành công — 201 { comment }.
   * Xử lý — parentId=null tạo bình luận gốc; có parentId tạo câu trả lời một cấp trong cùng bài; tác giả lấy từ req.user.
   * Lỗi thường gặp — 400 nội dung sai; 401 thiếu phiên; 404 bài hoặc bình luận gốc đã gỡ.
   */
  router.post('/posts/:id/comments', authenticate(users), json({ limit: '8kb' }), async (req, res) => {
    const { id } = req.params;
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    const { parentId = null } = req.body ?? {};
    if (!body || body.length > 1000) {
      return res.status(400).json({ message: 'Bình luận cần có từ 1 đến 1.000 ký tự.' });
    }
    if (!validId(id) || !await ForumPost.exists({ _id: id, deletedAt: null })) {
      return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
    }
    if (parentId !== null && !await topLevelComment(id, parentId)) {
      return res.status(404).json({ message: 'Không tìm thấy bình luận gốc.' });
    }

    const comment = await ForumComment.create({
      postId: id,
      parentId,
      userId: req.user._id,
      author: req.user.displayName || req.user.username,
      body,
    });
    res.status(201).json({ comment: publicComment(comment, Boolean(req.user.avatar)) });
  });

  /**
   * PUT /api/forum/posts/:id/comments/:commentId/reaction — Đặt hoặc gỡ cảm xúc.
   * Quyền truy cập — Đã đăng nhập.
   * Đầu vào — Params id, commentId; JSON { reaction } nhận "like", "dislike" hoặc null.
   * Thành công — 200 { likes, dislikes, myReaction }.
   * Xử lý — Kiểm tra bình luận hiển thị; null xóa cảm xúc, giá trị khác upsert theo commentId + userId rồi đếm lại.
   * Lỗi thường gặp — 400 cảm xúc sai; 401 thiếu phiên; 404 nội dung bị gỡ.
   */
  router.put('/posts/:id/comments/:commentId/reaction', authenticate(users), json({ limit: '1kb' }), async (req, res) => {
    const { id, commentId } = req.params;
    const reaction = req.body?.reaction;
    if (![null, 'like', 'dislike'].includes(reaction)) {
      return res.status(400).json({ message: 'Cảm xúc không hợp lệ.' });
    }
    const comment = validId(id) && validId(commentId) &&
      await ForumComment.findOne({ _id: commentId, postId: id, deletedAt: null }).select('postId parentId').lean();
    if (!await visibleComment(comment)) {
      return res.status(404).json({ message: 'Không tìm thấy bình luận.' });
    }

    // Unique index trên commentId + userId giữ mỗi tài khoản một cảm xúc cho mỗi bình luận.
    const filter = { commentId, userId: req.user._id };
    if (reaction === null) {
      await ForumCommentReaction.deleteOne(filter);
    } else {
      try {
        await ForumCommentReaction.updateOne(filter, { $set: { reaction } }, { upsert: true });
      } catch (error) {
        // Hai yêu cầu cùng tạo cảm xúc có thể trùng unique index; đọc theo khóa cũ và cập nhật lại.
        if (error.code !== 11000) throw error;
        await ForumCommentReaction.updateOne(filter, { $set: { reaction } });
      }
    }

    const reactions = await getReactions([new Types.ObjectId(commentId)], req.user._id);
    res.json(reactions.get(commentId.toLowerCase()) ?? { likes: 0, dislikes: 0, myReaction: null });
  });

  /**
   * GET /api/forum/comments/:id/avatar — Avatar người bình luận.
   * Quyền truy cập — Công khai.
   * Đầu vào — Params id là mã bình luận.
   * Thành công — 200 dữ liệu ảnh PNG/JPEG.
   * Xử lý — Kiểm tra bình luận, bài và bình luận cha rồi trả avatar tác giả.
   * Lỗi thường gặp — 404 nội dung hoặc ảnh không còn hiển thị.
   */
  router.get('/comments/:id/avatar', async (req, res) => {
    if (!validId(req.params.id)) return res.sendStatus(404);
    const comment = await ForumComment.findOne({ _id: req.params.id, deletedAt: null }).select('userId postId parentId').lean();
    if (!await visibleComment(comment)) return res.sendStatus(404);
    return sendAvatar(res, comment.userId);
  });

  /**
   * GET /api/forum/images/:id — Ảnh đính kèm bài viết.
   * Quyền truy cập — Công khai.
   * Đầu vào — Params id là mã ForumImage.
   * Thành công — 200 Buffer ảnh với Content-Type lưu trong database.
   * Xử lý — Chỉ trả ảnh đang được tham chiếu bởi bài chưa bị gỡ; no-cache giúp trình duyệt kiểm tra lại ảnh.
   * Lỗi thường gặp — 404 sai mã, thiếu ảnh hoặc bài liên quan đã bị gỡ.
   */
  router.get('/images/:id', async (req, res) => {
    if (!validId(req.params.id)) return res.sendStatus(404);
    if (!await ForumPost.exists({ images: req.params.id, deletedAt: null })) return res.sendStatus(404);
    const image = await ForumImage.findById(req.params.id);
    if (!image) return res.sendStatus(404);
    res.set({ 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.type(image.contentType).send(image.data);
  });

  return router;
}
