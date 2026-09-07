"use client";

import { useEffect, useRef, useState } from "react";

interface BluemapFrameProps {
  title: string;
  /** URL мапи. */
  src?: string;
}

export function BluemapFrame({ title, src }: BluemapFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [showError, setShowError] = useState(!src);

  useEffect(() => {
    if (!src) return;
    const timeout = setTimeout(() => {
      if (!loaded) setShowError(true);
    }, 15_000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div className="maparea">
      <iframe
        ref={frameRef}
        id="bluemap-frame"
        src={src || "about:blank"}
        title={title}
        allowFullScreen
        className={loaded ? "loaded" : undefined}
        onLoad={() => {
          if (!src) return;
          setLoaded(true);
          setShowError(false);
        }}
      />

      {!src && (
        <div className="map-placeholder hidden" id="placeholder">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="4"
              y="4"
              width="40"
              height="40"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              opacity="0.3"
            />
            <polyline
              points="4,28 14,18 22,24 30,14 44,24"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <circle
              cx="34"
              cy="16"
              r="4"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              opacity="0.3"
            />
          </svg>
          <div className="pulse" id="pulse-dot" />
          <span>Завантаження креативної мапи…</span>
        </div>
      )}

      <div className={`map-error${showError ? " visible" : ""}`} id="map-error">
        МАПА НАРАЗІ НЕДОСТУПНА
      </div>
    </div>
  );
}
