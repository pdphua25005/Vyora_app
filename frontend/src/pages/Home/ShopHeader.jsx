import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { authRequest } from '../../services/auth';
import HomeHeader from './HomeHeader';
import './HomeArtwork.css';
import './Home.css';
import './ShopHeader.css';

export default function ShopHeader() {
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
    <div className="shop-header" style={{ height: 117 * scale }}>
      <div className="vyora-home shop-header-canvas" style={{ transform: `scale(${scale})` }}>
        <HomeHeader
          user={user}
          onLogout={() => setUser(null)}
          onSearch={term => navigate({ pathname: '/', search: new URLSearchParams({ q: term }).toString() })}
        />
      </div>
    </div>
  );
}
