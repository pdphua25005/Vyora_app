import { useEffect, useState } from 'react';
import './Login.css';

// Both supplied auth screens use a 1920px freeform desktop composition.
export default function AuthFrame({ height, className = '', children }) {
  const [scale, setScale] = useState(() => Math.min(window.innerWidth / 1920, 1));
  useEffect(() => {
    const resize = () => setScale(Math.min(document.documentElement.clientWidth / 1920, 1));
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return (
    <main className="login-shell" style={{ height: height * scale }}>
      <div className={`vyora-login ${className}`} style={{ height, transform: `scale(${scale})` }}>
        {children}
      </div>
    </main>
  );
}
