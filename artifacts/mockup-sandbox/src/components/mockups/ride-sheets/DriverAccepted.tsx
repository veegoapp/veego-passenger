import { Phone, MessageCircle, X, Star } from "lucide-react";

const PRIMARY = "#1e1e28";
const ACCENT = "#55c49a";
const BORDER = "#e5e5ea";
const SURFACE = "#f8f8fb";
const MUTED = "rgba(0,0,0,0.4)";

export function DriverAccepted() {
  return (
    <div className="min-h-screen bg-[#d1d5db] flex items-end justify-center">
      <div className="w-full max-w-[390px] bg-white rounded-t-3xl shadow-2xl pb-8">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full bg-[#e5e5ea]" />
        </div>

        <div className="px-4">
          {/* ETA hero */}
          <div className="mb-4">
            <div className="flex items-end gap-2">
              <span className="text-[52px] font-extrabold text-[#1e1e28] leading-none tracking-tighter">4</span>
              <div className="pb-2">
                <p className="text-[15px] font-semibold text-[rgba(0,0,0,0.4)]">min</p>
                <p className="text-[11px] text-[rgba(0,0,0,0.35)]">Driver arriving</p>
              </div>
            </div>
            <p className="text-[12px] text-[rgba(0,0,0,0.35)] mt-1">→ Gateway Mall, North Tower</p>
          </div>

          {/* Divider */}
          <div className="h-px bg-[#e5e5ea] mb-4" />

          {/* Driver identity card */}
          <div className="flex items-center gap-3 bg-[#f8f8fb] border border-[#e5e5ea] rounded-2xl px-4 py-4 mb-3">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl bg-[#1e1e28] flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-extrabold text-white">KA</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[17px] font-bold text-[#1e1e28] tracking-tight">Karim Adel</p>
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#55c49a] bg-[rgba(85,196,154,0.15)] border border-[rgba(85,196,154,0.35)] rounded-md px-2 py-0.5">Economy</span>
              </div>
              {/* Stars */}
              <div className="flex items-center gap-0.5 mt-1">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} size={12} color={ACCENT} fill={i <= 4 ? ACCENT : "transparent"} />
                ))}
                <span className="text-[11px] text-[rgba(0,0,0,0.4)] ml-1">4.8</span>
              </div>
              <p className="text-[12px] text-[rgba(0,0,0,0.4)] mt-0.5">Toyota Camry · 2022</p>
            </div>

            {/* Plate */}
            <div className="rounded-xl overflow-hidden border border-[#e5e5ea] flex-shrink-0" style={{ minWidth: 62 }}>
              <div className="h-1 bg-[#1e1e28] w-full" />
              <p className="text-[11px] font-extrabold tracking-widest text-[#1e1e28] px-2 py-1.5 text-center">ABC·123</p>
            </div>
          </div>

          {/* Action row */}
          <div className="flex gap-3 pt-2 border-t border-[#e5e5ea]">
            <button className="flex-1 h-14 rounded-2xl border border-[#e5e5ea] bg-[#f8f8fb] flex flex-col items-center justify-center gap-1">
              <MessageCircle size={20} color={PRIMARY} strokeWidth={1.8} />
              <span className="text-[11px] font-semibold text-[rgba(0,0,0,0.5)]">Chat</span>
            </button>
            <button className="flex-1 h-14 rounded-2xl border border-[#e5e5ea] bg-[#f8f8fb] flex flex-col items-center justify-center gap-1">
              <Phone size={20} color={PRIMARY} strokeWidth={1.8} />
              <span className="text-[11px] font-semibold text-[rgba(0,0,0,0.5)]">Call</span>
            </button>
            <button className="flex-1 h-14 rounded-2xl border border-[rgba(232,84,84,0.35)] bg-[rgba(232,84,84,0.08)] flex flex-col items-center justify-center gap-1">
              <X size={20} color="#E85454" />
              <span className="text-[11px] font-semibold text-[#E85454]">Cancel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
