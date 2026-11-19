import { ForumPost } from './forum.js';

const samplePosts = [
  {
    _id: '000000000000000000000003',
    author: 'Vyora',
    category: 'Kinh nghiệm',
    title: 'Hạ Long cuối tuần: ngắm vịnh từ trên du thuyền',
    body: 'Nếu chỉ có một cuối tuần, bạn có thể dành một ngày trên vịnh và một buổi đi dạo ven biển. Mình thích dành chút thời gian ở boong tàu để ngắm những đảo đá, thay vì cố ghé thật nhiều điểm trong một ngày.',
    sampleImages: ['/assets/vyora/c7057f1803c9ea72.png'],
    sample: true,
  },
  {
    _id: '000000000000000000000002',
    author: 'Vyora',
    category: 'Lịch trình',
    title: 'Một buổi tối đi bộ ở phố cổ Hội An',
    body: 'Bắt đầu đi bộ từ chiều muộn, nghỉ chân bên sông rồi quay lại phố cổ lúc đèn lồng lên. Bạn thường thêm điểm dừng nào vào lịch trình Hội An?',
    sampleImages: ['/assets/vyora/59f5b6b56f2c3263.png'],
    sample: true,
  },
  {
    _id: '000000000000000000000001',
    author: 'Vyora',
    category: 'Review',
    title: 'Một đêm glamping giữa rừng thông Đà Lạt',
    body: 'Chọn chỗ có khoảng hiên rộng để ngồi ngoài trời vào sáng sớm. Với một chuyến glamping ngắn, áo ấm và đèn pin là hai thứ mình luôn để ở ngăn dễ lấy nhất.',
    sampleImages: ['/assets/vyora/13eaf6f38164f945.png'],
    sample: true,
  },
];

export async function seedForumSamples() {
  await ForumPost.bulkWrite(samplePosts.map(({ _id, ...fields }) => ({
    updateOne: { filter: { _id }, update: { $setOnInsert: fields }, upsert: true },
  })));
}
