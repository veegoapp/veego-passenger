import { useState } from "react";
import { ArrowLeft, Send } from "lucide-react";

const PRIMARY = "#1e1e28";
const BORDER = "#e5e5ea";
const SURFACE = "#f8f8fb";

const MESSAGES = [
  { id: 1, text: "I'm on my way! 🚗", sender: "driver", time: "2:41 PM" },
  { id: 2, text: "Great, I'm waiting at the main entrance", sender: "user", time: "2:42 PM" },
  { id: 3, text: "Traffic is light today, see you in ~4 min", sender: "driver", time: "2:42 PM" },
  { id: 4, text: "Ok, no rush!", sender: "user", time: "2:43 PM" },
];

export function DriverChat() {
  const [text, setText] = useState("");

  return (
    <div className="h-screen flex flex-col bg-[#f8f8fb] max-w-[390px] mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-[#e5e5ea] px-4 pt-12 pb-4 flex items-center gap-3">
        <button className="w-10 h-10 rounded-full border border-[#e5e5ea] bg-[#f8f8fb] flex items-center justify-center flex-shrink-0">
          <ArrowLeft size={18} color={PRIMARY} strokeWidth={2} />
        </button>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-10 h-10 rounded-full bg-[#1e1e28] flex items-center justify-center">
            <span className="text-sm font-bold text-white">KA</span>
          </div>
          <div>
            <p className="text-[15px] font-bold text-[#1e1e28] tracking-tight">Karim Adel</p>
            <p className="text-[11px] font-semibold text-[#55c49a]">● Online</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {MESSAGES.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-[18px] px-4 py-2.5 ${
              msg.sender === "user"
                ? "bg-[#1e1e28] rounded-br-sm"
                : "bg-white border border-[#e5e5ea] rounded-bl-sm"
            }`}>
              <p className={`text-[14.5px] leading-snug ${msg.sender === "user" ? "text-white" : "text-[#1e1e28]"}`}>{msg.text}</p>
              <p className={`text-[10px] mt-1 text-right ${msg.sender === "user" ? "text-white/60" : "text-[rgba(0,0,0,0.35)]"}`}>{msg.time}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input bar */}
      <div className="bg-white border-t border-[#e5e5ea] px-4 pt-3 pb-6">
        <div className="flex items-end gap-2.5 rounded-2xl border border-[#e5e5ea] bg-[#f8f8fb] px-4 py-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Message Karim..."
            className="flex-1 bg-transparent text-[14.5px] text-[#1e1e28] outline-none py-2 placeholder:text-[rgba(0,0,0,0.35)]"
          />
          <button
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors mb-0.5"
            style={{ backgroundColor: text ? PRIMARY : "#e5e5ea" }}
          >
            <Send size={15} color={text ? "#fff" : "rgba(0,0,0,0.35)"} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
