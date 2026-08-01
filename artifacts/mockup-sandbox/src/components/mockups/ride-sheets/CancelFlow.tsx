import { useState } from "react";

const PRIMARY = "#1e1e28";
const ERROR = "#E85454";
const BORDER = "#e5e5ea";
const SURFACE = "#f8f8fb";

const REASONS = [
  "Driver is taking too long",
  "I found another ride",
  "I made a mistake",
  "The driver asked me to cancel",
  "Other reason",
];

export function CancelFlow() {
  const [selected, setSelected] = useState<number | null>(null);
  const [step, setStep] = useState<"reasons" | "confirm">("reasons");

  if (step === "confirm") {
    return (
      <div className="min-h-screen bg-[#d1d5db] flex items-end justify-center">
        <div className="w-full max-w-[390px] bg-white rounded-t-3xl shadow-2xl pb-8">
          <div className="flex justify-center pt-3 pb-5">
            <div className="w-10 h-1 rounded-full bg-[#e5e5ea]" />
          </div>
          <div className="px-5">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${ERROR}18` }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke={ERROR} strokeWidth="2"/><path d="M15 9L9 15M9 9L15 15" stroke={ERROR} strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <h2 className="text-[18px] font-bold text-[#1e1e28] text-center mb-2">Cancel this ride?</h2>
            <p className="text-[13px] text-[rgba(0,0,0,0.45)] text-center mb-6">The driver is already on the way. Are you sure you want to cancel?</p>

            <div className="flex flex-col gap-3">
              <button
                className="w-full h-14 rounded-2xl flex items-center justify-center font-bold text-[15px] text-white"
                style={{ backgroundColor: ERROR }}
              >
                Cancel Ride
              </button>
              <button
                onClick={() => setStep("reasons")}
                className="w-full h-14 rounded-2xl flex items-center justify-center font-semibold text-[15px] border border-[#e5e5ea] bg-[#f8f8fb] text-[rgba(0,0,0,0.5)]"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#d1d5db] flex items-end justify-center">
      <div className="w-full max-w-[390px] bg-white rounded-t-3xl shadow-2xl pb-8">
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full bg-[#e5e5ea]" />
        </div>
        <div className="px-5">
          <h2 className="text-[18px] font-bold text-[#1e1e28] mb-1">Why are you cancelling?</h2>
          <p className="text-[13px] text-[rgba(0,0,0,0.4)] mb-4">This helps us improve your experience</p>

          <div className="flex flex-col gap-2 mb-5">
            {REASONS.map((r, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`flex items-center gap-3 px-4 py-4 rounded-2xl border text-left transition-all ${
                  selected === i
                    ? "border-[#1e1e28] bg-[rgba(30,30,40,0.04)]"
                    : "border-[#e5e5ea] bg-[#f8f8fb]"
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selected === i ? "border-[#1e1e28]" : "border-[#c8c8d0]"
                }`}>
                  {selected === i && <div className="w-2.5 h-2.5 rounded-full bg-[#1e1e28]" />}
                </div>
                <span className={`text-[14px] font-medium ${selected === i ? "text-[#1e1e28]" : "text-[rgba(0,0,0,0.65)]"}`}>{r}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => selected !== null && setStep("confirm")}
              className="w-full h-14 rounded-2xl flex items-center justify-center font-bold text-[15px] text-white transition-opacity"
              style={{ backgroundColor: ERROR, opacity: selected !== null ? 1 : 0.45 }}
            >
              Cancel Ride
            </button>
            <button className="w-full h-14 rounded-2xl flex items-center justify-center font-semibold text-[15px] border border-[#e5e5ea] bg-[#f8f8fb] text-[rgba(0,0,0,0.5)]">
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
