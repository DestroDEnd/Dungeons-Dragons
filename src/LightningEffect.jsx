import React, { useRef, useEffect } from 'react';

const LightningEffect = ({ isActive }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isActive) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const W = 800;
    const H = 450;
    canvas.width = W;
    canvas.height = H;

    let isStriking = false;
    let strikeAlpha = 0;
    let flashAlpha = 0;
    let lines = [];
    let animationFrameId;
    let strikeIntervalId;

    // Initialize rain
    let raindrops = [];
    for (let i = 0; i < 150; i++) {
      raindrops.push({
        x: Math.random() * W,
        y: Math.random() * H,
        length: Math.random() * 15 + 10,
        speed: Math.random() * 10 + 15
      });
    }

    function generateBranch(x, y, angle, length, branchChance, depth) {
      if (depth <= 0) return;
      let nextX = x + Math.cos(angle) * length;
      let nextY = y + Math.sin(angle) * length;
      lines.push({x1: x, y1: y, x2: nextX, y2: nextY, depth: depth});
      let wiggle = (Math.random() - 0.5) * 0.8;
      generateBranch(nextX, nextY, angle + wiggle, length * (0.8 + Math.random()*0.4), branchChance, depth - 1);
      if (Math.random() < branchChance) {
        let forkAngle = angle + (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.8);
        generateBranch(nextX, nextY, forkAngle, length * 0.8, branchChance * 0.6, depth - (Math.floor(Math.random()*2) + 1));
      }
    }

    function triggerStrike() {
      if (isStriking) return;
      isStriking = true;
      strikeAlpha = 1.0;
      flashAlpha = 0.6;
      lines = [];
      const numStarts = Math.floor(Math.random() * 2) + 1;
      for(let i=0; i<numStarts; i++) {
        let startX = Math.random() * W;
        let baseAngle = Math.random() > 0.5 ? 0.2 : Math.PI - 0.2; 
        generateBranch(startX, 0, baseAngle, 30 + Math.random() * 20, 0.6, 12);
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Draw Rain
      ctx.strokeStyle = 'rgba(150, 180, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let r of raindrops) {
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x + r.speed * 0.1, r.y + r.length);
        r.y += r.speed;
        r.x += r.speed * 0.1;
        if (r.y > H) {
          r.y = -r.length;
          r.x = Math.random() * W;
        }
      }
      ctx.stroke();

      // Draw Lightning
      if (isStriking) {
        if (flashAlpha > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
          ctx.fillRect(0, 0, W, H);
          flashAlpha -= 0.15;
        }

        ctx.lineJoin = 'round';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(100, 200, 255, 1)';
        ctx.strokeStyle = `rgba(255, 255, 255, ${strikeAlpha})`;
        
        for (let l of lines) {
          ctx.lineWidth = l.depth > 8 ? 3 : (l.depth > 4 ? 2 : 1);
          ctx.beginPath();
          ctx.moveTo(l.x1, l.y1);
          ctx.lineTo(l.x2, l.y2);
          ctx.stroke();
        }
        
        ctx.shadowBlur = 0;
        strikeAlpha -= 0.05;
        if (strikeAlpha <= 0) {
          isStriking = false;
          lines = [];
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    }

    draw();

    strikeIntervalId = setInterval(() => {
      if (Math.random() < 0.4) triggerStrike();
    }, 1500);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearInterval(strikeIntervalId);
    };
  }, [isActive]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{
        position: 'absolute',
        top: 0, left: 0, width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
        imageRendering: 'pixelated',
        opacity: isActive ? 1 : 0,
        transition: 'opacity 1s ease-in-out',
        mixBlendMode: 'screen'
      }}
    />
  );
};

export default LightningEffect;
