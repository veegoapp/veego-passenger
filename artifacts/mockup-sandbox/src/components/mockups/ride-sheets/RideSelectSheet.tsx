import { useState } from "react";
import { Car, Clock, Banknote, Wallet, ArrowRight, ChevronDown, Bike, Package } from "lucide-react";

const PRIMARY = "#1e1e28";
const ACCENT = "#55c49a";
const BORDER = "#e5e5ea";
const SURFACE = "#f8f8fb";
const MUTED = "rgba(0,0,0,0.4)";

const RIDES = [
  { id: "economy", name: "Economy", desc: "Affordable everyday rides", eta: "3 min", price: 42 },
  { id: "economy-plus", name: "Economy Plus", desc: "Newer cars, more legroom", eta: "5 min", price: 56 },
  { id: "comfort", name: "Comfort", desc: "Premium sedans, top drivers", eta: "6 min", price: 78 },
];

export function RideSelectSheet() {
  const [selected, setSelected] = useState("economy");
  const [payment, setPayment] = useState<"cash" | "wallet">("cash");

  return (
    <div className="min-h-screen bg-[#d1d5db] flex items-end justify-center">
      <div className="w-full max-w-[390px] bg-white rounded-t-3xl shadow-2xl pb-8">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full bg-[#e5e5ea]" />
        </div>

        {/* Destination row */}
        <div className="mx-4 mb-4 flex items-center gap-3 rounded-2xl border border-[#e5e5ea] bg-[#f8f8fb] px-4 py-3">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-2 h-2 rounded-full bg-[rgba(0,0,0,0.35)]" />
            <div className="w-px h-4 bg-[#e5e5ea]" />
            <div className="w-2 h-2 rounded-sm bg-[#1e1e28]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[rgba(0,0,0,0.4)] truncate">Al Rawdah St. 42</p>
            <p className="text-sm font-semibold text-[#1e1e28] truncate mt-1">Gateway Mall, North Tower</p>
          </div>
          <button className="w-8 h-8 rounded-full border border-[#e5e5ea] bg-[rgba(0,0,0,0.04)] flex items-center justify-center">
            <ChevronDown size={14} color={MUTED} />
          </button>
        </div>

        {/* Ride cards */}
        <div className="px-4 flex flex-col gap-2 mb-4">
          {RIDES.map((r) => {
            const active = r.id === selected;
            return (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                className={`flex items-center gap-3 rounded-[18px] px-4 py-4 text-left border transition-all ${
                  active
                    ? "border-[#1e1e28] bg-[rgba(30,30,40,0.05)] shadow-sm"
                    : "border-[#e5e5ea] bg-white"
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  active ? "bg-[rgba(30,30,40,0.08)]" : "bg-[#f2f2f5]"
                }`}>
                  <Car size={22} color={active ? PRIMARY : MUTED} strokeWidth={1.8} />
                </div>
                <div className="flex-1">
                  <p className={`text-[15px] font-bold tracking-tight ${active ? "text-[#1e1e28]" : "text-[#1e1e28]"}`}>{r.name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock size={10} color={MUTED} />
                    <span className="text-xs text-[rgba(0,0,0,0.4)]">{r.eta}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[rgba(0,0,0,0.4)] font-semibold">EGP</p>
                  <p className={`text-[22px] font-extrabold tracking-tight leading-none ${active ? "text-[#1e1e28]" : "text-[#1e1e28]"}`}>{r.price}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Payment */}
        <div className="px-4 mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[rgba(0,0,0,0.4)] mb-2">Payment Method</p>
          <div className="flex rounded-2xl bg-[#f2f2f5] border border-[#e5e5ea] p-1 h-12 relative overflow-hidden">
            <div
              className="absolute top-1 bottom-1 w-[47%] rounded-xl transition-all duration-300 ease-in-out"
              style={{ left: payment === "cash" ? "4px" : "calc(50% + 2px)", background: PRIMARY }}
            />
            <button onClick={() => setPayment("cash")} className="flex-1 flex items-center justify-center gap-2 z-10 relative">
              <Banknote size={15} color={payment === "cash" ? "#fff" : MUTED} />
              <span className={`text-sm font-semibold ${payment === "cash" ? "text-white" : "text-[rgba(0,0,0,0.45)]"}`}>Cash</span>
            </button>
            <button onClick={() => setPayment("wallet")} className="flex-1 flex items-center justify-center gap-2 z-10 relative">
              <Wallet size={15} color={payment === "wallet" ? "#fff" : MUTED} />
              <span className={`text-sm font-semibold ${payment === "wallet" ? "text-white" : "text-[rgba(0,0,0,0.45)]"}`}>Wallet</span>
            </button>
          </div>
        </div>

        {/* CTA */}
        <div className="px-4">
          <button className="w-full h-14 rounded-[18px] flex items-center justify-center gap-3" style={{ background: PRIMARY }}>
            <span className="text-[15px] font-bold text-white tracking-tight">
              {RIDES.find(r => r.id === selected)?.name} · EGP {RIDES.find(r => r.id === selected)?.price}
            </span>
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <ArrowRight size={15} color="#fff" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
