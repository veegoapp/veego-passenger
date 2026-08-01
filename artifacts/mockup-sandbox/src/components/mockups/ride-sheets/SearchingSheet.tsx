import { useEffect, useRef, useState } from "react";

const PRIMARY = "#1e1e28";
const ACCENT = "#55c49a";

export function SearchingSheet() {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#d1d5db] flex items-end justify-center">
      <div className="w-full max-w-[390px] bg-white rounded-t-3xl shadow-2xl pb-8">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-5">
          <div className="w-10 h-1 rounded-full bg-[#e5e5ea]" />
        </div>

        {/* Status row */}
        <div className="px-5 flex items-center gap-4 mb-5">
          {/* Pulsing dot */}
          <div className="w-11 h-11 rounded-full bg-[rgba(85,196,154,0.15)] flex items-center justify-center flex-shrink-0">
            <div className="w-3.5 h-3.5 rounded-full bg-[#55c49a] animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="text-[16px] font-bold text-[#1e1e28] tracking-tight">Searching for driver</p>
            <p className="text-[12.5px] text-[rgba(0,0,0,0.4)] mt-1">Finding the nearest driver for you</p>
          </div>
          {/* Animated dots */}
          <div className="flex items-center gap-1 pr-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-opacity duration-300"
                style={{ backgroundColor: ACCENT, opacity: dots > i ? 1 : 0.25 }}
              />
            ))}
          </div>
        </div>

        {/* Map placeholder with ripple */}
        <div className="mx-4 mb-5 rounded-2xl overflow-hidden" style={{ height: 200, background: "#e8ead0", position: "relative" }}>
          {/* Simple SVG map-like bg */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 390 200">
            <rect width="390" height="200" fill="#e8f0e0" />
            <line x1="0" y1="80" x2="390" y2="80" stroke="white" strokeWidth="22" />
            <line x1="0" y1="140" x2="390" y2="140" stroke="white" strokeWidth="14" />
            <line x1="130" y1="0" x2="130" y2="200" stroke="white" strokeWidth="18" />
            <line x1="280" y1="0" x2="280" y2="200" stroke="white" strokeWidth="12" />
          </svg>
          {/* Ripple rings centered */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-24 h-24 rounded-full border-2 border-[#55c49a] opacity-20 animate-ping" />
              <div className="absolute w-16 h-16 rounded-full border-2 border-[#55c49a] opacity-30 animate-ping" style={{ animationDelay: "0.3s" }} />
              <div className="w-10 h-10 rounded-full bg-[#1e1e28] flex items-center justify-center shadow-lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L19 21L12 17L5 21L12 2Z" fill="white" /></svg>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-[#e5e5ea] mb-4" />

        {/* Cancel */}
        <div className="px-4">
          <button className="w-full h-13 h-[52px] rounded-2xl border border-[#e5e5ea] bg-[#f8f8fb] flex items-center justify-center">
            <span className="text-[15px] font-semibold text-[rgba(0,0,0,0.4)]">Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
