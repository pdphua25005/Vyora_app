import { hotDealProducts } from './hotDealProducts';
import { recommendedProducts } from './recommendedProducts';

export const saleAssets = '/assets/vyora/flash-sale/';

// Mỗi sản phẩm có một slug. URL của trang chi tiết dùng slug này.
export const products = [
  {
    slug: 'cho-noi-cai-rang',
    categoryId: 've-tham-quan',
    name: 'Vé Tham quan Chợ Nổi Cái Răng',
    title: 'Vé tham quan Chợ Nổi Cái Răng lượt đi và về - Địa điểm tham quan nổi tiếng tại Cần Thơ',
    image: 'cai-rang.png',
    cover: 'cai-rang-cover.png',
    price: '120.000 đ',
    oldPrice: '200.000 đ',
    status: 'ĐANG BÁN CHẠY',
    progress: 96,
    sold: 27,
    descriptions: [
      'Nét độc đáo và đặc điểm chính của chợ nổi Cái Răng là chuyên mua bán các loại rau củ, trái cây của vùng đồng bằng sông Cửu Long. Thuở xưa, chợ nổi hình thành vì hệ thống giao thông đường thủy giữ vai trò gần như độc tôn. Trong khi nhu cầu thương mại ngày càng tăng cao mà việc đi lại luôn gắn với dòng sông, bến nước nên điểm giao sông, bùng binh trở thành địa điểm lý tưởng để người ta tụ tập mua bán. Ngày nay, hệ thống giao thông đường bộ đã phát triển rộng khắp, điều này góp phần làm biến mất nhiều chợ nổi. Tuy nhiên, dưới tác động của hoạt động du lịch, chợ nổi dần tách khỏi vai trò chính yếu của nó để phát triển theo hướng bền vững hơn.',
      'Hòa mình vào không khí nhộn nhịp của buổi chợ, du khách có thể quan sát, tìm hiểu sinh hoạt của nhiều gia đình thương hồ với nhiều thế hệ chung sống trên ghe. Mỗi chiếc ghe là một căn nhà trên sông nước với những chậu hoa kiểng, các loài vật nuôi, các tiện nghi đầy đủ như ti-vi, dàn âm thanh và cả xe gắn máy.',
    ],
    notes: [
      'Chợ Cái Răng thường nhóm khá sớm, khoảng 2 - 3 sáng.',
      'Thời điểm tối ưu nhất mà khách tham quan nên đi là khoảng 5 - 6 giờ sáng.',
      'Chợ không hoạt động hoặc hoạt động hạn chế vào các ngày Tết Âm Lịch và Tết Đoan Ngọ.',
    ],
  },
  {
    slug: 'bien-dinh-cau',
    categoryId: 've-tham-quan',
    name: 'Vé Tham quan Biển Dinh Cậu',
    image: 'dinh-cau.png',
    galleryRow: 0,
    price: '170.000 đ',
    oldPrice: '340.000 đ',
    status: 'ĐÃ BÁN 89',
    progress: 79,
    sold: 89,
    descriptions: [
      'Khám phá Dinh Cậu, công trình tín ngưỡng nằm trên ghềnh đá ven biển ở Phú Quốc. Từ lối lên dinh có thể nhìn ra biển và khu vực cửa sông Dương Đông.',
      'Chuyến tham quan phù hợp để ngắm cảnh, chụp ảnh và tìm hiểu về đời sống của người dân vùng biển.',
    ],
    notes: ['Chọn ngày tham quan và số lượng vé trước khi thêm vào giỏ hàng.'],
  },
  {
    slug: 'leu-camping',
    categoryId: 'thue-do-camping',
    name: 'Lều Camping Cao Cấp',
    image: 'leu-camping.png',
    galleryRow: 1,
    price: '99.000 đ',
    oldPrice: '165.000 đ',
    status: 'CÒN 4 SẢN PHẨM',
    progress: 67,
    stock: 4,
    descriptions: [
      'Lều cắm trại dáng vòm với tông cam và xám, phù hợp cho các chuyến dã ngoại và nghỉ qua đêm ngoài trời.',
      'Bộ ảnh minh họa dáng lều, cửa ra vào và không gian bên trong khi lều được dựng.',
    ],
    notes: ['Chọn thời gian sử dụng và số lượng theo nhu cầu của chuyến đi.'],
  },
  {
    slug: 'tau-da-nang-hue',
    categoryId: 'di-chuyen',
    name: 'Vé tàu hoả tuyến Đà Nẵng - Huế',
    image: 'tau-da-nang-hue.png',
    galleryRow: 2,
    price: '35.000 đ',
    oldPrice: '58.333 đ',
    status: 'CÒN 4 SẢN PHẨM',
    progress: 70,
    stock: 4,
    descriptions: [
      'Hành trình đường sắt nối Đà Nẵng và Huế đi qua khu vực đèo Hải Vân, nơi có thể nhìn thấy bờ biển và núi từ cửa sổ tàu.',
      'Bộ ảnh minh hoạ đoàn tàu, khoang hành khách và cảnh quan dọc hành trình.',
    ],
    notes: ['Chọn ngày đi và số lượng vé trước khi thêm vào giỏ hàng.'],
  },
  {
    slug: 'xe-camping',
    categoryId: 'thue-do-camping',
    name: 'Xe Camping Combo tiện ích',
    image: 'xe-camping.png',
    galleryRow: 3,
    price: '499.000 đ',
    oldPrice: '712.857 đ',
    status: 'CÒN 2 SẢN PHẨM',
    progress: 88,
    stock: 2,
    descriptions: [
      'Xe camping dành cho những chuyến đi kết hợp di chuyển và nghỉ tại điểm cắm trại. Bộ ảnh minh họa ngoại thất, khoang xe và không gian sinh hoạt dưới mái che.',
      'Bạn có thể tham khảo cách bố trí khu nghỉ, ghế dã ngoại và khu nấu ăn trong bộ ảnh.',
    ],
    notes: ['Chọn ngày sử dụng và số lượng xe phù hợp với kế hoạch chuyến đi.'],
  },
  {
    slug: 'lau-hai-san-phu-yen',
    categoryId: 'an-uong',
    name: 'Lẩu hải sản Cô Tuy Phú Yên',
    image: 'lau-hai-san.png',
    galleryRow: 4,
    price: '199.000 đ',
    oldPrice: '331.667 đ',
    status: 'ĐÃ BÁN 59',
    progress: 75,
    sold: 59,
    descriptions: [
      'Món lẩu hải sản gợi hương vị vùng biển Phú Yên, dùng cùng rau và bún. Bộ ảnh minh họa nồi lẩu cùng các loại hải sản ăn kèm.',
      'Tham khảo bộ ảnh để xem cách trình bày và các thành phần thường được dùng với lẩu.',
    ],
    notes: ['Chọn ngày và số lượng trước khi thêm vào giỏ hàng.'],
  },
];

export function productPath(slug) {
  const inCatalog = [...recommendedProducts, ...hotDealProducts].some(product => product.slug === slug);
  return (inCatalog ? '/products/' : '/flash-sale/') + slug;
}

export function productImage(image) {
  return image.startsWith('/') ? image : saleAssets + image;
}
