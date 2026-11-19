export const categories = [
  { id: 'luu-tru', label: 'Lưu trú' },
  { id: 'di-chuyen', label: 'Di chuyển' },
  { id: 'an-uong', label: 'Ăn uống' },
  { id: 'du-lich', label: 'Du lịch' },
  { id: 'dich-vu-khac', label: 'Dịch vụ khác' },
  { id: 'thue-do-camping', label: 'Thuê đồ Camping' },
  { id: 'huong-dan-vien', label: 'Hướng dẫn viên' },
  { id: 'cham-soc-thu-gian', label: 'Chăm sóc & thư giãn' },
  { id: 'tour-trai-nghiem', label: 'Tour trải nghiệm' },
  { id: 've-tham-quan', label: 'Vé tham quan' },
];

export function categoryPath(id) {
  return '/danh-muc/' + id;
}
