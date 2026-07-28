import { Compass, Navigation, Navigation2, Ticket, Wallet, User } from "lucide-react";

type IconType = typeof Compass;

function MiniBar({ GoIcon, dark }: { GoIcon: IconType; dark: boolean }) {
  const bg      = dark ? "rgba(26,28,50,0.97)"    : "rgba(255,255,255,0.96)";
  const border  = dark ? "rgba(90,95,160,0.15)"   : "rgba(0,0,0,0.04)";
  const pillBg  = dark ? "#0f0f1e"                : "rgba(15,23,42,0.09)";
  const inkSoft = dark ? "rgba(180,182,210,0.50)" : "rgba(15,23,42,0.38)";
  const active  = dark ? "#f8f8ff"                : "#0f172a";
  const screenBg= dark ? "#0f0f1e"               : "#f1f2f8";
  const dimLine = dark ? "rgba(140,145,190,0.35)" : "rgba(15,23,42,0.12)";

  const tabs = [
    { name: "Go",       Icon: GoIcon,    isActive: true  },
    { name: "Activity", Icon: Ticket,    isActive: false },
    { name: "Wallet",   Icon: Wallet,    isActive: false },
    { name: "Profile",  Icon: User,      isActive: false },
  ];

  return (
    <div style={{
      background: screenBg, borderRadius: 24, padding: "20px 12px 12px",
      display: "flex", flexDirection: "column", gap: 0, width: 280,
      boxShadow: dark ? "0 20px 50px rgba(0,0,0,0.5)" : "0 10px 30px rgba(0,0,0,0.10)",
    }}>
      {/* skeleton screen content */}
      <div style={{ paddingBottom: 18, paddingLeft: 2, paddingRight: 2 }}>
        <div style={{ height: 8, width: "40%", borderRadius: 99, background: dimLine, marginBottom: 8 }} />
        <div style={{ height: 7, width: "65%", borderRadius: 99, background: dimLine, marginBottom: 16 }} />
        <div style={{ height: 56, borderRadius: 16, background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }} />
      </div>
      {/* tab bar */}
      <div style={{
        background: bg, borderRadius: 30, border: `1px solid ${border}`,
        padding: "6px", display: "flex", flexDirection: "row",
        boxShadow: dark ? "0 4px 16px rgba(0,0,0,0.3)" : "0 4px 12px rgba(0,0,0,0.06)",
      }}>
        {tabs.map(({ name, Icon, isActive }) => (
          <div key={name} style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            paddingTop: 8, paddingBottom: 8, borderRadius: 24, gap: 3,
            background: isActive ? pillBg : "transparent",
          }}>
            <Icon size={17} color={isActive ? active : inkSoft} strokeWidth={isActive ? 2.2 : 1.9} />
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: isActive ? active : inkSoft,
              fontFamily: "'Inter', sans-serif", lineHeight: "13px",
            }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const OPTIONS: { icon: IconType; label: string; note: string }[] = [
  { icon: Navigation,  label: "Navigation",  note: "أقرب للوجو ✓" },
  { icon: Navigation2, label: "Navigation2", note: "متماثل / مملوء" },
  { icon: Compass,     label: "Compass",     note: "الاختيار الحالي" },
];

export function BottomBarPreview() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(145deg, #12122a 0%, #1e1e3a 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 36, padding: 40,
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* title */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 8 }}>
          VeeGo · Go Tab Icon Options
        </div>
        <div style={{ fontSize: 21, fontWeight: 800, color: "#fff", letterSpacing: -0.4 }}>
          Navigation vs Navigation2 vs Compass
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
          كلهم موجودين في lucide-react-native · Active state · Dark mode
        </div>
      </div>

      {/* three bars */}
      <div style={{ display: "flex", flexDirection: "row", gap: 28, alignItems: "flex-start" }}>
        {OPTIONS.map(({ icon, label, note }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            {/* badge */}
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: "#fff",
                background: label === "Navigation" ? "rgba(99,102,241,0.8)" : "rgba(255,255,255,0.1)",
                borderRadius: 99, padding: "3px 12px", letterSpacing: 0.3,
              }}>{label}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>{note}</div>
            </div>
            <MiniBar GoIcon={icon} dark={true} />
            <MiniBar GoIcon={icon} dark={false} />
          </div>
        ))}
      </div>

      {/* icon zoom strip */}
      <div style={{
        display: "flex", flexDirection: "row", alignItems: "center", gap: 32,
        background: "rgba(255,255,255,0.06)", borderRadius: 16,
        padding: "16px 28px",
      }}>
        {OPTIONS.map(({ icon: Icon, label }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: label === "Navigation" ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: label === "Navigation" ? "1.5px solid rgba(99,102,241,0.5)" : "1.5px solid rgba(255,255,255,0.1)",
            }}>
              <Icon size={26} color={label === "Navigation" ? "#a5b4fc" : "rgba(255,255,255,0.6)"} strokeWidth={2} />
            </div>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{label}</span>
          </div>
        ))}
        <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.1)", marginLeft: 4 }} />
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", maxWidth: 160, lineHeight: "18px" }}>
          الـ Navigation هو الأقرب لشكل سهم الـ VeeGo logo
        </div>
      </div>
    </div>
  );
}
