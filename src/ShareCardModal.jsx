import { useEffect, useRef, useState } from "react";

// Deterministic "likes" per title so the number doesn't jump around
// between opens, but still lands in a believable 2k–99k viral range.
function seededLikes(seed) {
  let h = 0;
  for (let i = 0; i < String(seed).length; i++) {
    h = (h * 31 + String(seed).charCodeAt(i)) >>> 0;
  }
  const value = 2000 + (h % 97000);
  return value >= 1000
    ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
    : String(value);
}

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default function ShareCardModal({ title, imageSrc, onClose }) {
  const canvasRef = useRef(null);
  const [dataUrl, setDataUrl] = useState(null);
  const [rendering, setRendering] = useState(true);

  const likes = seededLikes(title.id + "-" + (title.holder || ""));
  const handle = (title.holder || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setRendering(true);

      const W = 1080;
      const H = 1920;
      const canvas = canvasRef.current;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");

      // Background
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, W, H);

      // Subtle radial glow behind the figure
      const glow = ctx.createRadialGradient(
        W / 2,
        H * 0.42,
        50,
        W / 2,
        H * 0.42,
        W * 0.75
      );
      glow.addColorStop(0, "rgba(167,255,0,0.16)");
      glow.addColorStop(1, "rgba(167,255,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // Person image, centered, contained
      try {
        const img = await loadImage(imageSrc);
        const maxW = W * 0.72;
        const maxH = H * 0.62;
        const scale = Math.min(maxW / img.width, maxH / img.height);
        const iw = img.width * scale;
        const ih = img.height * scale;
        const ix = (W - iw) / 2;
        const iy = H * 0.14;

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 60;
        ctx.shadowOffsetY = 30;
        ctx.drawImage(img, ix, iy, iw, ih);
        ctx.restore();
      } catch {
        // If the image fails (CORS/local asset), continue without it
      }

      // Bottom scrim so text stays legible
      const scrim = ctx.createLinearGradient(0, H * 0.6, 0, H);
      scrim.addColorStop(0, "rgba(10,10,10,0)");
      scrim.addColorStop(1, "rgba(10,10,10,0.97)");
      ctx.fillStyle = scrim;
      ctx.fillRect(0, H * 0.6, W, H * 0.4);

      // Brand mark, top left
      ctx.fillStyle = "#a7ff00";
      ctx.font = "900 34px Arial";
      ctx.textBaseline = "top";
      ctx.fillText("BOOMERS", 56, 56);

      ctx.fillStyle = "#555";
      ctx.font = "700 22px Arial";
      ctx.fillText(`TITLE #${String(title.id).padStart(2, "0")}`, 56, 104);

      // Title name, large
      ctx.fillStyle = "#fff";
      ctx.font = "900 64px Arial";
      wrapText(ctx, (title.title || "").toUpperCase(), 56, H - 430, W - 112, 66);

      // Handle
      ctx.fillStyle = "#a7ff00";
      ctx.font = "800 30px Arial";
      ctx.fillText(`@${handle}`, 56, H - 250);

      // Stat row: likes + bid amount
      const statY = H - 190;

      ctx.fillStyle = "#fff";
      ctx.font = "900 46px Arial";
      ctx.fillText(likes, 56, statY);
      ctx.fillStyle = "#666";
      ctx.font = "700 20px Arial";
      ctx.fillText("LIKES", 56, statY + 56);

      const priceText = `$${Number(title.price || 0).toLocaleString()}`;
      ctx.textAlign = "right";
      ctx.fillStyle = "#a7ff00";
      ctx.font = "900 46px Arial";
      ctx.fillText(priceText, W - 56, statY);
      ctx.fillStyle = "#666";
      ctx.font = "700 20px Arial";
      ctx.fillText("CURRENT BID", W - 56, statY + 56);
      ctx.textAlign = "left";

      // Divider
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(56, H - 300);
      ctx.lineTo(W - 56, H - 300);
      ctx.stroke();

      if (!cancelled) {
        setDataUrl(canvas.toDataURL("image/png"));
        setRendering(false);
      }
    }

    function wrapText(ctx2, text, x, y, maxWidth, lineHeight) {
      const words = text.split(" ");
      let line = "";
      const lines = [];

      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx2.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);

      const startY = y - (lines.length - 1) * lineHeight;
      lines.forEach((l, i) => {
        ctx2.fillText(l, x, startY + i * lineHeight);
      });
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [title, imageSrc, handle, likes]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `boomers-title-${title.id}.png`;
    a.click();
  };

  const handleShare = async () => {
    if (!dataUrl) return;

    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `boomers-title-${title.id}.png`, {
        type: "image/png",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "BOOMERS",
          text: `I hold "${title.title}" on Boomers 👑`,
        });
        return;
      }
    } catch {
      // fall through to download
    }

    handleDownload();
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <button className="share-modal-close" onClick={onClose} type="button">
          ×
        </button>

        <div className="share-preview-wrap">
          <canvas ref={canvasRef} className="share-canvas" />
          {rendering && <div className="share-rendering">Rendering...</div>}
        </div>

        <div className="share-modal-actions">
          <button
            className="share-secondary-btn"
            onClick={handleDownload}
            type="button"
            disabled={rendering}
          >
            Download
          </button>

          <button
            className="share-primary-btn"
            onClick={handleShare}
            type="button"
            disabled={rendering}
          >
            Share
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
