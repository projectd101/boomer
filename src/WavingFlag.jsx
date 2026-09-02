import { useEffect, useRef } from "react";
import { countryToFlagImage } from "./flags";

// Ports the same wave math as the WebGL cloth-shader reference:
//   wave = sin(x * freq + time * speed) * amplitude * (x_norm)
// but applies it as a real per-column vertical displacement of the actual
// flag image on a 2D canvas, column by column — same visual result as the
// vertex shader, no WebGL context required so it works everywhere.
export default function WavingFlag({ country, width = 140, height = 90 }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(Date.now());

  const imgUrl = countryToFlagImage(country, 320);

  useEffect(() => {
    if (!imgUrl) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const img = new Image();
    img.crossOrigin = "anonymous";
    imgRef.current = img;

    let cancelled = false;

    img.onload = () => {
      if (cancelled) return;
      startRef.current = Date.now();

      const columns = Math.max(40, Math.round(width)); // 1 slice per px, min 40
      const colWidth = width / columns;

      // Same constants as the shader: freq=4.0, speed=2.0, amplitude=0.06 (in
      // clip-space units spanning -1..1, i.e. amplitude*height/2 in pixels),
      // and the x-based falloff (pos.x*0.5+0.5) so the left edge (flagpole
      // side) stays still and the right edge (fly side) whips more.
      const freq = 4.0;
      const speed = 2.0;
      const amplitude = 0.06 * (height / 2) * 2.2; // scaled up to read clearly at UI sizes

      function render() {
        if (cancelled) return;
        const t = (Date.now() - startRef.current) / 1000;

        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < columns; i++) {
          const xNorm = i / (columns - 1); // 0..1 across flag width
          const clipX = xNorm * 2 - 1; // -1..1, matches shader's pos.x
          const falloff = clipX * 0.5 + 0.5; // matches shader's (pos.x*0.5+0.5)
          const wave = Math.sin(clipX * freq + t * speed) * amplitude * falloff;

          const sx = xNorm * img.width;
          const sw = img.width / columns;
          const dx = i * colWidth;

          ctx.drawImage(
            img,
            sx, 0, sw, img.height,
            dx, wave, colWidth + 0.5, height
          );
        }

        // subtle vertical shading pass to sell the cloth-fold look, same
        // spirit as the shader's `shade` term
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        for (let i = 0; i <= 10; i++) {
          const xNorm = i / 10;
          const clipX = xNorm * 2 - 1;
          const shade = 0.85 + 0.15 * Math.sin(clipX * freq + t * speed);
          grad.addColorStop(xNorm, `rgba(0,0,0,${(1 - shade) * 0.35})`);
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        rafRef.current = requestAnimationFrame(render);
      }

      render();
    };

    img.onerror = () => {
      // leave canvas blank; the placeholder div below handles no-flag case
    };

    img.src = imgUrl;

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [imgUrl, width, height]);

  if (!imgUrl) {
    return (
      <div
        className="waving-flag-svg"
        style={{
          width,
          height,
          background: "#1a1a1a",
          border: "1px solid #333",
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="waving-flag-svg"
      style={{ width, height, display: "block" }}
    />
  );
}