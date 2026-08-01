import { MessageCircle, Phone, AlertTriangle, Navigation } from "lucide-react";

const PRIMARY = "#1e1e28";
const ACCENT = "#55c49a";
const BORDER = "#e5e5ea";
const SURFACE = "#f8f8fb";

export function RideInProgress() {
  return (
    <div className="min-h-screen bg-[#d1d5db] flex items-end justify-center">
      <div className="w-full max-w-[390px] bg-white rounded-t-3xl shadow-2xl pb-8">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full bg-[#e5e5ea]" />
        </div>

        <div className="px-4 flex flex-col gap-3">
          {/* Status strip */}
          <div className="flex items-center justify-between bg-[#f8f8fb] border border-[#e5e5ea] rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#55c49a] animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#55c49a]">En Route</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Navigation size={12} color="rgba(0,0,0,0.35)" />
              <span className="text-[12px] text-[rgba(0,0,0,0.4)] truncate max-w-[150px]">Gateway Mall, North Tower</span>
            </div>
          </div>

          {/* Driver row */}
          <div className="flex items-center gap-3 bg-[#f8f8fb] border border-[#e5e5ea] rounded-2xl px-4 py-3">
            <div className="w-11 h-11 rounded-xl bg-[#1e1e28] flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-white">KA</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-[#1e1e28] tracking-tight">Karim Adel</p>
              <p className="text-[12px] text-[rgba(0,0,0,0.4)] truncate">Toyota Camry · ABC·123</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 items-center">
            <button className="w-[50px] h-[50px] rounded-2xl border border-[#e5e5ea] bg-[#f8f8fb] flex items-center justify-center flex-shrink-0">
              <MessageCircle size={18} color={PRIMARY} strokeWidth={1.8} />
            </button>
            <button className="w-[50px] h-[50px] rounded-2xl border border-[#e5e5ea] bg-[#f8f8fb] flex items-center justify-center flex-shrink-0">
              <Phone size={18} color={PRIMARY} strokeWidth={1.8} />
            </button>
            <button
              className="flex-1 h-[50px] rounded-2xl flex items-center justify-center gap-2"
              style={{ backgroundColor: "#E85454" }}
            >
              <AlertTriangle size={16} color="white" />
              <span className="text-[14px] font-extrabold text-white tracking-wide">SOS</span>
            </button>
          </div>

          {/* Trip info banner */}
          <div className="bg-[rgba(85,196,154,0.1)] border border-[rgba(85,196,154,0.3)] rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[rgba(85,196,154,0.2)] flex items-center justify-center">
              <Navigation size={16} color={ACCENT} />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#1e1e28]">Ride in progress</p>
              <p className="text-[11px] text-[rgba(0,0,0,0.45)]">You're on your way to the destination</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
