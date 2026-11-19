import { Link } from 'react-router';
import { products, productImage, productPath, saleAssets } from './products';

export default function ProductGrid({ items = products }) {
  return (
    <div className="sale-grid">
      {items.map(product => (
        <Link className="sale-card" key={product.slug} to={productPath(product.slug)}>
          <div className="sale-card-picture">
            <img src={productImage(product.image)} alt="" />
            <span className="sale-hot-deal">{product.category && !product.offer ? 'GỢI Ý' : 'HOT DEAL'}</span>
            {!product.category && <img className="sale-card-badge" src={saleAssets + 'flash-sale-badge.png'} alt="Flash Sale" />}
          </div>
          <div className="sale-card-content">
            <h3>{product.name}</h3>
            <div className="sale-card-rating">
              <span aria-hidden="true">☆☆☆☆☆</span> Chưa có dữ liệu đánh giá
            </div>
            {product.oldPrice && <del>{product.category ? '' : '≈ '}{product.oldPrice}</del>}
            <strong>{product.price}</strong>
            <div className="sale-card-bottom">
              {product.category ? <span>{product.location || product.category}</span> : (
                <div className="sale-progress" style={{ '--progress': `${product.progress}%` }}>{product.status}</div>
              )}
              <span className="sale-buy">Mua Ngay</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
