import { Compass, Ticket, Wallet, User } from "lucide-react";

const TABS = [
  { name: "Go",       icon: Compass, active: true  },
  { name: "Activity", icon: Ticket,  active: false },
  { name: "Wallet",   icon: Wallet,  active: false },
  { name: "Profile",  icon: User,    active: false },
];

function TabBar({ dark }: { dark: boolean }) {
  const bg        = dark ? "rgba(26,28,50,0.97)"       : "rgba(255,255,255,0.96)";
  const border    = dark ? "rgba(90,95,160,0.15)"      : "rgba(0,0,0,0.04)";
  const pillBg    = dark ? "#0f0f1e"                   : "rgba(15,23,42,0.09)";
  const inkSoft   = dark ? "rgba(180,182,210,0.55)"    : "rgba(15,23,42,0.38)";
  const activeClr = dark ? "#f8f8ff"                   : "#0f172a";
  const screenBg  = dark ? "#0f0f1e"                   : "#f1f2f8";
  const labelDim  = dark ? "rgba(140,145,190,0.4)"     : "rgba(15,23,42,0.18)";

  return (
    <div
      style={{
        background: screenBg,
        borderRadius: 28,
        padding: "28px 16px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        width: 360,
        boxShadow: dark
          ? "0 24px 60px rgba(0,0,0,0.55)"
          : "0 12px 40px rgba(0,0,0,0.10)",
      }}
    >
      {/* fake screen content above bar */}
      <div style={{ paddingBottom: 24, paddingLeft: 4, paddingRight: 4 }}>
        <div style={{
          height: 10, width: "45%", borderRadius: 99,
          background: labelDim, marginBottom: 10,
        }} />
        <div style={{
          height: 8, width: "70%", borderRadius: 99,
          background: labelDim, marginBottom: 20,
        }} />
        <div style={{
          height: 72, borderRadius: 20,
          background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
        }} />
      </div>

      {/* bar shell */}
      <div style={{
        background: bg,
        borderRadius: 30,
        border: `1px solid ${border}`,
        padding: "6px",
        display: "flex",
        flexDirection: "row",
        position: "relative",
        boxShadow: dark
          ? "0 4px 20px rgba(0,0,0,0.35)"
          : "0 4px 16px rgba(0,0,0,0.07)",
      }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const color = tab.active ? activeClr : inkSoft;
          return (
            <div
              key={tab.name}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 8,
                paddingBottom: 8,
                borderRadius: 24,
                gap: 3,
                position: "relative",
                background: tab.active ? pillBg : "transparent",
                zIndex: 2,
              }}
            >
              <Icon size={17} color={color} strokeWidth={tab.active ? 2.2 : 1.9} />
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color,
                fontFamily: "'Inter', sans-serif",
                letterSpacing: 0.1,
                lineHeight: "13px",
              }}>
                {tab.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BottomBarPreview() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a2e 0%, #2d2d4e 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 40,
      padding: 40,
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* header */}
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 2,
          color: "rgba(255,255,255,0.4)", textTransform: "uppercase",
          marginBottom: 8,
        }}>
          VeeGo Passenger App
        </div>
        <div style={{
          fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: -0.5,
        }}>
          "Go" Tab — Compass Icon Preview
        </div>
        <div style={{
          fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 6,
        }}>
          Active state · Light &amp; Dark
        </div>
      </div>

      {/* two bars */}
      <div style={{ display: "flex", flexDirection: "row", gap: 32, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase" }}>
            Light Mode
          </div>
          <TabBar dark={false} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase" }}>
            Dark Mode
          </div>
          <TabBar dark={true} />
        </div>
      </div>

      {/* legend */}
      <div style={{
        display: "flex", flexDirection: "row", alignItems: "center", gap: 20,
        background: "rgba(255,255,255,0.06)", borderRadius: 14,
        padding: "12px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Compass size={15} color="#a5b4fc" strokeWidth={2.2} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
            Compass · lucide-react-native
          </span>
        </div>
        <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.12)" }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
          size=17 · strokeWidth=2.2 active / 1.9 inactive
        </span>
      </div>
    </div>
  );
}
