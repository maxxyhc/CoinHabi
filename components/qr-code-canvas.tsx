"use client";

import { useEffect, useRef } from "react";

export function QrCodeCanvas({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const canvas = canvasRef.current;
      if (!canvas || !value) return;
      try {
        const QRCode = await import("qrcode");
        if (cancelled) return;
        await QRCode.toCanvas(canvas, value, {
          color: { dark: "#17140f", light: "#fffaf0" },
          errorCorrectionLevel: "M",
          margin: 1,
          width: 176,
        });
      } catch {
        // The share link remains available even if a browser cannot render QR codes.
      }
    }
    void render();
    return () => { cancelled = true; };
  }, [value]);

  return <canvas aria-hidden="true" className="h-44 w-44 rounded-2xl" ref={canvasRef} />;
}
