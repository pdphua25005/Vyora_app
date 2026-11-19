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

function publicPost(post, commentCount = 0, hasAvatar = false) {
  const { _id, author, category, title, body, createdAt, images, sample, sampleImages } = post;
  const urls = sample ? sampleImages : images.map(id => '/api/forum/images/' + id);
  return {
    id: String(_id), author, category, title, body, createdAt, images: urls,
    sample: Boolean(sample), commentCount, avatar: hasAvatar ? '/api/forum/posts/' + _id + '/avatar' : '',
  };
}

async function usersWithAvatars(items) {
  const users = await User.find({
    _id: { $in: items.map(item => item.userId).filter(Boolean) },
    deletedAt: null,
    avatar: { $type: 'string', $ne: '' },
  }).select('_id').lean();
  return new Set(users.map(user => String(user._id)));
}

async function sendAvatar(res, userId) {
  const user = await User.findOne({ _id: userId, deletedAt: null }).select('avatar').lean();
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(user?.avatar ?? '');
  if (!match) return res.sendStatus(404);
  res.set({ 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
  return res.type(match[1]).send(Buffer.from(match[2], 'base64'));
}

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

async function countComments(field, ids, filter = {}) {
  const rows = await ForumComment.aggregate([
    { $match: { ...filter, [field]: { $in: ids }, deletedAt: null } },
    ...(field === 'postId' ? excludeDeletedThreads() : []),
    { $group: { _id: '$' + field, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map(row => [String(row._id), row.count]));
}

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

async function topLevelComment(postId, commentId) {
  return validId(commentId) && await ForumComment.exists({ _id: commentId, postId, parentId: null, deletedAt: null });
}

async function visibleComment(comment) {
  if (!comment || !await ForumPost.exists({ _id: comment.postId, deletedAt: null })) return false;
  return !comment.parentId || Boolean(await topLevelComment(comment.postId, String(comment.parentId)));
}

export function forumRoutes(users = User) {
  const router = Router();

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
    const page = await ForumPost.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
    const visible = page.slice(0, limit);
    const [counts, avatars] = await Promise.all([
      countComments('postId', visible.map(post => post._id)),
      view === 'home' ? usersWithAvatars(visible) : new Set(),
    ]);
    const posts = visible.map(post => publicPost(post, counts.get(String(post._id)), avatars.has(String(post.userId))));
    res.json({ posts, next: page.length > limit ? posts.at(-1).id : null });
  });

  router.get('/posts/:id', async (req, res) => {
    const { id } = req.params;
    const post = validId(id) && await ForumPost.findOne({ _id: id, deletedAt: null }).lean();
    if (!post) return res.status(404).json({ message: 'Bài viết không tồn tại hoặc đã bị gỡ.' });
    const [counts, avatars] = await Promise.all([
      countComments('postId', [post._id]), usersWithAvatars([post]),
    ]);
    res.json({ post: publicPost(post, counts.get(id.toLowerCase()), avatars.has(String(post.userId))) });
  });

  router.get('/posts/:id/avatar', async (req, res) => {
    if (!validId(req.params.id)) return res.sendStatus(404);
    const post = await ForumPost.findOne({ _id: req.params.id, deletedAt: null }).select('userId').lean();
    if (!post?.userId) return res.sendStatus(404);
    return sendAvatar(res, post.userId);
  });

  // Kiểm tra phiên trước khi đọc phần ảnh. Base64 lớn hơn dữ liệu ảnh gốc.
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

    const filter = { commentId, userId: req.user._id };
    if (reaction === null) {
      await ForumCommentReaction.deleteOne(filter);
    } else {
      try {
        await ForumCommentReaction.updateOne(filter, { $set: { reaction } }, { upsert: true });
      } catch (error) {
        if (error.code !== 11000) throw error;
        await ForumCommentReaction.updateOne(filter, { $set: { reaction } });
      }
    }

    const reactions = await getReactions([new Types.ObjectId(commentId)], req.user._id);
    res.json(reactions.get(commentId.toLowerCase()) ?? { likes: 0, dislikes: 0, myReaction: null });
  });

  router.get('/comments/:id/avatar', async (req, res) => {
    if (!validId(req.params.id)) return res.sendStatus(404);
    const comment = await ForumComment.findOne({ _id: req.params.id, deletedAt: null }).select('userId postId parentId').lean();
    if (!await visibleComment(comment)) return res.sendStatus(404);
    return sendAvatar(res, comment.userId);
  });

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
