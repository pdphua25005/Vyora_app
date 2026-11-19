import { useEffect } from 'react';
import { Link, NavLink, useParams } from 'react-router';
import SaleLayout from '../FlashSale/SaleLayout';
import ProductGrid from '../FlashSale/ProductGrid';
import { products } from '../FlashSale/products';
import { hotDealProducts } from '../FlashSale/hotDealProducts';
import { recommendedProducts } from '../FlashSale/recommendedProducts';
import { categories, categoryPath } from './categories';
import './Catalog.css';

const catalog = [...products, ...hotDealProducts, ...recommendedProducts];

export default function Catalog() {
  const { categoryId } = useParams();
  const category = categories.find(item => item.id === categoryId);
  const items = catalog.filter(product => product.categoryId === categoryId);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [categoryId]);

  return (
    <SaleLayout>
      <main className="sale-width catalog-main">
        <div className="catalog-heading">
          <Link to="/">Trang chủ</Link>
          <span aria-hidden="true"> › </span>
          <h1>{category?.label ?? 'Không tìm thấy danh mục'}</h1>
        </div>
        <nav className="catalog-nav" aria-label="Danh mục sản phẩm">
          {categories.map(item => (
            <NavLink key={item.id} to={categoryPath(item.id)} end>{item.label}</NavLink>
          ))}
        </nav>
        {items.length > 0 ? (
          <>
            <p className="catalog-count">{items.length} sản phẩm</p>
            <ProductGrid items={items} />
          </>
        ) : (
          <p className="catalog-empty">
            {category ? 'Danh mục này chưa có sản phẩm.' : 'Chọn một danh mục ở trên để xem sản phẩm.'}
          </p>
        )}
      </main>
    </SaleLayout>
  );
}
