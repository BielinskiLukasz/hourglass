import { useMemo } from "react";

export type Theme = "meadow" | "cosmos" | "ocean";

const SKY: Record<Theme, { day: [string, string]; night: [string, string] }> = {
  meadow: { day: ["#8fd6ee", "#fdeec4"], night: ["#0e1a3d", "#43407f"] },
  cosmos: { day: ["#5a3fa3", "#f6a9b8"], night: ["#05041a", "#1d1257"] },
  ocean: { day: ["#7fd0ea", "#ffe9c2"], night: ["#050f2b", "#1f3f73"] },
};

/* ---------- słońce / księżyc: płaskie papierowe koła ---------- */
export function Celestial({ night }: { night: boolean }) {
  return (
    <div className="pointer-events-none absolute top-6 right-24 z-[5] h-[76px] w-[76px]" aria-hidden>
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
        <defs>
          <filter id="celShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#2a1b3d" floodOpacity=".25" />
          </filter>
          <mask id="crescent">
            <rect width="100" height="100" fill="#fff" />
            <circle cx="66" cy="38" r="32" fill="#000" />
          </mask>
        </defs>
        {night ? (
          <circle cx="50" cy="50" r="32" fill="#f8efcf" mask="url(#crescent)" filter="url(#celShadow)" />
        ) : (
          <g filter="url(#celShadow)">
            <circle cx="50" cy="50" r="38" fill="#ffd36b" opacity=".55" />
            <circle cx="50" cy="50" r="27" fill="#ffb938" />
            <circle cx="50" cy="50" r="19" fill="#ffe08a" />
          </g>
        )}
      </svg>
    </div>
  );
}

/* ---------- tło: warstwy wyciętego papieru ---------- */
export function Scene({ theme, night }: { theme: Theme; night: boolean }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 70 }, () => ({
        x: Math.round(Math.random() * 1000) / 10,
        y: Math.round(Math.random() * 560) / 10,
        r: Math.round((Math.random() * 0.14 + 0.07) * 1000) / 1000,
        d: Math.round(Math.random() * 300) / 100,
      })),
    []
  );
  const sky = SKY[theme][night ? "night" : "day"];
  const c = (d: string, n: string) => (night ? n : d);

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[0]} />
          <stop offset="1" stopColor={sky[1]} />
        </linearGradient>
        <radialGradient id="spot">
          <stop offset="0" stopColor="#fff7e0" stopOpacity={night ? 0.14 : 0.45} />
          <stop offset="1" stopColor="#fff7e0" stopOpacity="0" />
        </radialGradient>
        <filter id="paper" x="-5%" y="-20%" width="110%" height="140%">
          <feDropShadow dx="0" dy="-0.7" stdDeviation="0.55" floodColor="#1a1030" floodOpacity={night ? 0.55 : 0.28} />
        </filter>
      </defs>

      <rect width="100" height="100" fill="url(#sky)" />
      <ellipse cx="50" cy="52" rx="44" ry="38" fill="url(#spot)" />

      {night &&
        stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="#fff8e0"
            className="twinkle"
            style={{ animationDelay: `${s.d}s` }}
          />
        ))}

      {!night && theme !== "cosmos" && (
        <g fill="#fffaf0" filter="url(#paper)">
          <g className="cloud-drift" style={{ animationDuration: "95s" }}>
            <rect x="6" y="21" width="15" height="4.4" rx="2.2" />
            <rect x="9.5" y="18.4" width="8" height="4.6" rx="2.3" />
          </g>
          <g className="cloud-drift" style={{ animationDuration: "130s", animationDelay: "-60s" }}>
            <rect x="30" y="31" width="11" height="3.6" rx="1.8" />
            <rect x="33" y="28.8" width="5.6" height="3.8" rx="1.9" />
          </g>
        </g>
      )}

      {theme === "meadow" && (
        <g>
          <path d="M0 66 Q22 56 46 64 T100 60 L100 100 L0 100 Z" fill={c("#8bcf93", "#2a4766")} filter="url(#paper)" />
          <path d="M0 73 Q28 64 54 71 T100 68 L100 100 L0 100 Z" fill={c("#4fa670", "#1d3b57")} filter="url(#paper)" />
          <g fill={c("#2f7f5c", "#102b44")}>
            <rect x="79.2" y="60" width="1.6" height="8" />
            <circle cx="80" cy="58" r="4.4" />
            <rect x="87.2" y="62" width="1.3" height="6" />
            <circle cx="87.8" cy="60.6" r="3.2" />
          </g>
          <path d="M0 81 Q30 74 58 80 T100 77 L100 100 L0 100 Z" fill={c("#2f8a63", "#132d47")} filter="url(#paper)" />
          <path d="M0 90 Q35 84 64 89 T100 87 L100 100 L0 100 Z" fill={c("#1f6b54", "#0b2036")} filter="url(#paper)" />
          {!night &&
            ([[14, 86, "#e2563b"], [20, 88.4, "#ffd36b"], [78, 85, "#fffaf0"], [85, 87.6, "#e2563b"], [8, 91, "#ffd36b"], [92, 91, "#fffaf0"]] as [number, number, string][]).map(
              ([x, y, col], i) => (
                <g key={i}>
                  <rect x={x - 0.15} y={y} width=".3" height="2.2" fill="#14513f" />
                  <circle cx={x} cy={y} r=".85" fill={col} />
                </g>
              )
            )}
          {night && (
            <g fill="#e6f48a">
              {([[14, 84], [24, 88], [76, 83], [86, 87], [18, 92], [90, 92]] as [number, number][]).map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r=".2" className="firefly" style={{ animationDelay: `${i * 0.7}s` }} />
              ))}
            </g>
          )}
        </g>
      )}

      {theme === "cosmos" && (
        <g>
          <circle cx="24" cy="24" r="6.4" fill={c("#ffd36b", "#8aa6d8")} filter="url(#paper)" />
          <ellipse
            cx="24"
            cy="24"
            rx="11"
            ry="2.6"
            fill="none"
            stroke={c("#fff1b8", "#c5d5f2")}
            strokeWidth="1.2"
            transform="rotate(-18 24 24)"
          />
          <circle cx="82" cy="40" r="2" fill={c("#ff8fa8", "#6b5ab0")} filter="url(#paper)" />
          <path d="M0 70 L12 60 L26 69 L42 58 L58 68 L72 60 L88 69 L100 63 L100 100 L0 100 Z" fill={c("#8f5fc4", "#251a6b")} filter="url(#paper)" />
          <path d="M0 80 L16 71 L32 79 L50 69 L68 78 L84 71 L100 77 L100 100 L0 100 Z" fill={c("#5d3b9c", "#170f4d")} filter="url(#paper)" />
          <path d="M0 90 L20 84 L40 89 L62 83 L82 88 L100 85 L100 100 L0 100 Z" fill={c("#3d2477", "#0d0830")} filter="url(#paper)" />
        </g>
      )}

      {theme === "ocean" && (
        <g>
          <path d="M0 64 Q10 61 20 64 T40 64 T60 64 T80 64 T100 64 L100 100 L0 100 Z" fill={c("#5cc2dc", "#1c4a82")} filter="url(#paper)" />
          <g transform="translate(78 63) scale(0.62) translate(-71 -75)">
            <path d="M64 79 L78 79 L75 83.4 L67 83.4 Z" fill={c("#e2563b", "#7a2e34")} />
            <line x1="71" y1="64" x2="71" y2="79" stroke={c("#2a1b3d", "#0a0618")} strokeWidth="1" />
            <path d="M72 65 L72 78 L79 78 Z" fill={c("#fffaf0", "#46598c")} />
            <path d="M70 68 L70 78 L64 78 Z" fill={c("#ffd36b", "#33447a")} />
          </g>
          <path d="M0 72 Q10 69 20 72 T40 72 T60 72 T80 72 T100 72 L100 100 L0 100 Z" fill={c("#2fa3c8", "#143a6e")} filter="url(#paper)" />
          <path d="M0 81 Q12 78 25 81 T50 81 T75 81 T100 81 L100 100 L0 100 Z" fill={c("#1b83b0", "#0e2c58")} filter="url(#paper)" />
          <path d="M0 90 Q14 87 28 90 T56 90 T84 90 T112 90 L100 100 L0 100 Z" fill={c("#136591", "#091e43")} filter="url(#paper)" />
        </g>
      )}
    </svg>
  );
}
