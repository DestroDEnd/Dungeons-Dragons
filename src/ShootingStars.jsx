import React, { useMemo, useEffect } from 'react';
import { animate, stagger } from 'animejs';

export default function ShootingStars() {
  const staticStars = useMemo(() => {
    return Array.from({ length: 150 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 55, // Constrain to upper 55% of screen (the sky)
      size: Math.random() * 2.5 + 0.5,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
    }));
  }, []);

  useEffect(() => {
    animate('.shooting-star', {
      translateX: [
        { value: -300, duration: 1000, easing: 'easeOutQuad' },
        { value: -1500, duration: 3000, easing: 'linear' }
      ],
      translateY: [
        { value: 100, duration: 1000, easing: 'easeInQuad' },
        { value: 1500, duration: 3000, easing: 'linear' }
      ],
      opacity: [
        { value: 1, duration: 200, easing: 'linear' },
        { value: 1, duration: 2000, easing: 'linear' },
        { value: 0, duration: 1000, easing: 'linear' }
      ],
      rotate: [
        { value: '170deg', duration: 0 },
        { value: '135deg', duration: 2000, easing: 'easeInQuad' }
      ],
      delay: stagger(1500, { start: 500 }),
      loop: true
    });
  }, []);

  return (
    <div 
      className="shooting-stars-container"
      style={{
        background: `linear-gradient(rgba(10, 10, 20, 0.4), rgba(10, 10, 20, 0.2)), url('/stargaze_bg.jpg?v=8') center bottom / cover no-repeat`
      }}
    >
      {/* Static Twinkling Stars */}
      <div className="star-field">
        {staticStars.map(star => (
          <div
            key={star.id}
            className="twinkle-star"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            }}
          />
        ))}
      </div>
      
      {/* Shooting Stars */}
      <div className="star shooting-star"></div>
      <div className="star shooting-star"></div>
      <div className="star shooting-star"></div>
      <div className="star shooting-star"></div>
      <div className="star shooting-star"></div>
    </div>
  );
}
