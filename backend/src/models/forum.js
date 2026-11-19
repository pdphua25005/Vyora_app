import mongoose from 'mongoose';

export const forumCategories = ['Kinh nghiệm', 'Lịch trình', 'Hỏi đáp', 'Review'];

const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required() { return !this.sample; } },
  sample: Boolean,
  sampleImages: [String],
  author: { type: String, required: true },
  category: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  images: [mongoose.Schema.Types.ObjectId],
  deletedAt: Date,
}, { timestamps: true });

postSchema.index({ images: 1 });
postSchema.index({ userId: 1, _id: -1 });

const imageSchema = new mongoose.Schema({
  contentType: { type: String, required: true },
  data: { type: Buffer, required: true },
});

export const ForumPost = mongoose.model('ForumPost', postSchema);
export const ForumImage = mongoose.model('ForumImage', imageSchema);

const commentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  author: { type: String, required: true },
  body: { type: String, required: true, maxlength: 1000 },
  deletedAt: Date,
}, { timestamps: true });

commentSchema.index({ postId: 1, parentId: 1, _id: -1 });
commentSchema.index({ userId: 1, _id: -1 });

export const ForumComment = mongoose.model('ForumComment', commentSchema);

const reactionSchema = new mongoose.Schema({
  commentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  reaction: { type: String, enum: ['like', 'dislike'], required: true },
}, { timestamps: true });

reactionSchema.index({ commentId: 1, userId: 1 }, { unique: true });
reactionSchema.index({ userId: 1, updatedAt: -1 });

export const ForumCommentReaction = mongoose.model('ForumCommentReaction', reactionSchema);

// Một câu trả lời chỉ hiện khi bình luận gốc còn hiển thị.
export function excludeDeletedThreads() {
  return [
    { $lookup: {
      from: ForumComment.collection.name,
      localField: 'parentId',
      foreignField: '_id',
      pipeline: [{ $match: { deletedAt: { $ne: null } } }, { $project: { _id: 1 } }],
      as: 'deletedParent',
    } },
    { $match: { 'deletedParent.0': { $exists: false } } },
    { $unset: 'deletedParent' },
  ];
}
