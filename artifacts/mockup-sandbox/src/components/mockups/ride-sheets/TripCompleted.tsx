import { useState } from "react";
import { Star, Banknote, Check } from "lucide-react";

const PRIMARY = "#1e1e28";
const ACCENT = "#55c49a";
const BORDER = "#e5e5ea";

export function TripCompleted() {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  return (
    <div className="min-h-screen bg-[#d1d5db] flex items-end justify-center">
      <div className="w-full max-w-[390px] bg-white rounded-t-3xl shadow-2xl pb-8">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full bg-[#e5e5ea]" />
        </div>

        <div className="px-5">
          {/* Amount hero */}
          <div className="flex flex-col items-center text-center mb-5">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
              style={{ background: "linear-gradient(135deg, #2d2d42, #1e1e28)" }}
            >
              <Check size={28} color="white" strokeWidth={3} />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[rgba(0,0,0,0.4)]">Trip Completed</p>
            <p className="text-[36px] font-extrabold text-[#1e1e28] leading-none tracking-tighter mt-2">
              42.50 <span className="text-[16px] font-semibold text-[rgba(0,0,0,0.4)]">EGP</span>
            </p>
            <div className="mt-3 inline-flex items-center gap-2 bg-[#f8f8fb] border border-[#e5e5ea] rounded-full px-3.5 py-2">
              <Banknote size={15} color="rgba(0,0,0,0.4)" strokeWidth={1.9} />
              <span className="text-[13px] font-medium text-[#1e1e28]">Paid with Cash</span>
            </div>
          </div>

          {/* Rating card */}
          <div className="bg-[#f8f8fb] border border-[#e5e5ea] rounded-2xl p-4 mb-4">
            <p className="text-[15px] font-bold text-[#1e1e28] text-center mb-3">How was your ride with Karim?</p>
            <div className="flex justify-center gap-3 mb-3">
              {[1, 2, 3, 4, 5].map(i => (
                <button key={i} onClick={() => setRating(i)}>
                  <Star
                    size={34}
                    color={i <= rating ? "#F4B942" : "#e5e5ea"}
                    fill={i <= rating ? "#F4B942" : "transparent"}
                    strokeWidth={i <= rating ? 0 : 1.5}
                    className="transition-all"
                  />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a comment (optional)"
              rows={2}
              className="w-full resize-none rounded-xl border border-[#e5e5ea] bg-white px-3.5 py-3 text-[14px] text-[#1e1e28] outline-none transition-colors placeholder:text-[rgba(0,0,0,0.35)] focus:border-[#1e1e28]"
            />
          </div>

          {/* OK button */}
          <button
            className="w-full h-14 rounded-[18px] flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #2d2d42, #1e1e28)" }}
          >
            <span className="text-[15.5px] font-bold text-white tracking-tight">OK, Done</span>
          </button>
        </div>
      </div>
    </div>
  );
}
