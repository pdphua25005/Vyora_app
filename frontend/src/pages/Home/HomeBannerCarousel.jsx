import { useEffect, useState } from 'react';
import { Link } from 'react-router';

const slides = [
  {
    name: 'Vịnh Hạ Long',
    image: '1a1fe7895bc653c0.png',
    alt: 'Vịnh Hạ Long · Chuyến đi của bạn do bạn thiết kế',
  },
  {
    name: 'Đà Nẵng',
    image: 'hero-da-nang.webp',
    alt: 'Cầu Rồng bắc qua sông Hàn ở Đà Nẵng',
    title: 'KHÁM PHÁ ĐÀ NẴNG',
    highlight: 'TỪ SÔNG RA BIỂN',
    description: 'Dạo phố ven sông · Ngắm Cầu Rồng · Tận hưởng biển xanh',
  },
  {
    name: 'Phú Quốc',
    image: 'hero-phu-quoc.webp',
    alt: 'Bờ biển xanh ngọc và ca nô ở Phú Quốc',
    title: 'HẸN NHAU Ở PHÚ QUỐC',
    highlight: 'GIỮA BIỂN TRỜI XANH',
    description: 'Dạo bờ cát · Khám phá đảo · Ngắm hoàng hôn',
  },
];

export default function HomeBannerCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (!playing) return;

    const timer = window.setTimeout(() => {
      setActiveIndex(index => (index + 1) % slides.length);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [activeIndex, playing]);

  return (
    <section className="v70 home-banner-carousel" aria-label="Banner du lịch Vyora" data-node-id="1:291">
      {slides.map((slide, index) => {
        const active = index === activeIndex;

        return (
          <div className={active ? 'home-banner-slide is-active' : 'home-banner-slide'}
            key={slide.image} aria-hidden={!active} inert={!active}>
            <img className="v65 home-banner-image" src={'/assets/vyora/' + slide.image} alt={slide.alt}
              fetchPriority={index === 0 ? 'high' : 'low'} />
            {slide.title && (
              <div className="home-banner-content">
                <img className="home-banner-brand" src="/assets/vyora/65b144bcd4dd7a5a.png" alt="Vyora" />
                <strong className="home-banner-title">{slide.title}<span>{slide.highlight}</span></strong>
                <span className="home-banner-description">{slide.description}</span>
                <Link className="home-banner-cta" to={{ pathname: '/', search: '?' + new URLSearchParams({ q: slide.name }) }}>
                  Khám phá {slide.name} <span aria-hidden="true">→</span>
                </Link>
              </div>
            )}
          </div>
        );
      })}
      <div className="home-banner-dots" role="group" aria-label="Chọn banner">
        {slides.map((slide, index) => (
          <button type="button" className="home-banner-dot" key={slide.name}
            aria-current={index === activeIndex ? 'true' : undefined}
            aria-label={`Xem banner ${slide.name}`} onClick={() => setActiveIndex(index)} />
        ))}
      </div>
      <button type="button" className="home-banner-play"
        aria-label={playing ? 'Tạm dừng chuyển banner' : 'Tiếp tục chuyển banner'}
        onClick={() => setPlaying(value => !value)}>
        <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>
      </button>
    </section>
  );
}
