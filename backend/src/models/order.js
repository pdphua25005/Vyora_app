import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  author: String,
  rating: Number,
  comment: String,
  date: Date,
}, { _id: false });

const itemSchema = new mongoose.Schema({
  slug: String,
  name: String,
  image: String,
  price: Number,
  quantity: Number,
  date: String,
  time: String,
  review: reviewSchema,
});

const orderSchema = new mongoose.Schema({
  _id: String,
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  items: [itemSchema],
  total: Number,
  note: String,
  payment: String,
}, { timestamps: true });

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ 'items.slug': 1 });

export const Order = mongoose.model('Order', orderSchema);
