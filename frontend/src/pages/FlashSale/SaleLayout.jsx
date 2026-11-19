import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { authRequest } from '../../services/auth';
import HomeHeader from '../Home/HomeHeader';
import { SiteFooter } from '../Home/HomeArtwork';
import '../Home/HomeArtwork.css';
import '../Home/Home.css';
import './FlashSale.css';

export default function SaleLayout({ children, detail = false }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(undefined);
  const [scale, setScale] = useState(() => Math.min(document.documentElement.clientWidth / 1920, 1));

  useEffect(() => {
    function resize() {
      setScale(Math.min(document.documentElement.clientWidth / 1920, 1));
    }
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    let active = true;
    authRequest('me').then(currentUser => {
      if (active) setUser(currentUser);
    }).catch(() => {
      if (active) setUser(null);
    });
    return () => { active = false; };
  }, []);

  return (
    <div className={`sale-page ${detail ? 'sale-detail-page' : ''}`}>
      <div className="sale-canvas" style={{ zoom: scale }}>
        <div className="sale-header">
          <div className={`vyora-home sale-chrome ${detail ? 'sale-detail-header' : ''}`}>
            <HomeHeader
              user={user}
              onLogout={() => setUser(null)}
              onSearch={term => navigate('/?' + new URLSearchParams({ q: term }))}
            />
            {detail && <span className="sale-header-title">Thông tin sản phẩm</span>}
          </div>
        </div>
        {children}
        <footer className="sale-footer">
          <div className="vyora-home sale-chrome"><SiteFooter /></div>
        </footer>
      </div>
    </div>
  );
}
