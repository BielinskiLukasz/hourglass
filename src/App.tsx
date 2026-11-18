import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeSand } from "./lib/sand";
import {
  Clock,
  Lock,
  Palette,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

type Phase = "idle" | "running" | "paused" | "done";
type Theme = "meadow" | "cosmos" | "ocean";

type Sand = { name: string; top: string; mid: string; dark: string; stream: string };

const PRESETS = [1, 2, 3, 5, 10, 15];

const SANDS: Sand[] = [
  { name: "Złoty", top: "#f6cf6a", mid: "#eebd45", dark: "#c98a1f", stream: "#f2c14e" },
  { name: "Biały", top: "#fdfdf8", mid: "#f2efe2", dark: "#cfc9b4", stream: "#f5f2e6" },
  { name: "Różowy", top: "#ffc2d4", mid: "#ff9ebb", dark: "#e06a92", stream: "#ffb3c9" },
  { name: "Niebieski", top: "#aee3ff", mid: "#7cc7f5", dark: "#3f97d6", stream: "#8fd0ff" },
];

const THEMES: { id: Theme; name: string; css: string }[] = [
  { id: "meadow", name: "Łąka", css: "linear-gradient(#4fb2f2 55%, #5cab41 55%)" },
  { id: "cosmos", name: "Kosmos", css: "linear-gradient(#4a3a8c 55%, #10102a 55%)" },
  { id: "ocean", name: "Ocean", css: "linear-gradient(#2f9df0 55%, #0b639e 55%)" },
];

const SKY: Record<Theme, { day: [string, string]; night: [string, string] }> = {
  meadow: { day: ["#4fb2f2", "#d6f2ff"], night: ["#071633", "#1c3a6e"] },
  cosmos: { day: ["#4a3a8c", "#a07ad0"], night: ["#02020c", "#0d0d2b"] },
  ocean: { day: ["#2f9df0", "#d3f1ff"], night: ["#030f26", "#0d2a4a"] },
};

/* ---------- kształty klepsydry ---------- */
const TOP_BULB =
  "M160 72 C215 72 246 102 243 148 C240 194 206 232 172 243 L148 243 C114 232 80 194 77 148 C74 102 105 72 160 72 Z";
const BOT_BULB =
  "M160 408 C105 408 74 378 77 332 C80 286 114 248 148 237 L172 237 C206 248 240 286 243 332 C246 378 215 408 160 408 Z";
const TOP_DISC =
  "M44 44 Q44 26 72 26 L248 26 Q276 26 276 44 Q276 62 248 62 L72 62 Q44 62 44 44 Z";
const BOT_DISC =
  "M36 420 Q36 402 64 402 L256 402 Q284 402 284 420 Q284 438 256 438 L64 438 Q36 438 36 420 Z";

/* ---------- localStorage ---------- */
function load<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
}

/* ---------- dzwonek (WebAudio) ---------- */
let actx: AudioContext | null = null;
function ensureAudio() {
  try {
    if (!actx) actx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (actx.state === "suspended") void actx.resume();
  } catch {
    /* brak audio */
  }
}
function bell() {
  ensureAudio();
  if (!actx) return;
  const ctx = actx;
  const strike = (when: number) => {
    const t = ctx.currentTime + when;
    const partials: [number, number][] = [
      [1, 0.5],
      [2.76, 0.22],
      [5.4, 0.1],
      [8.93, 0.04],
    ];
    partials.forEach(([m, g]) => {
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 1046.5 * m;
      gn.gain.setValueAtTime(g * 0.35, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      o.connect(gn);
      gn.connect(ctx.destination);
      o.start(t);
      o.stop(t + 2.5);
    });
  };
  strike(0);
  strike(0.85);
  strike(1.7);
}

/* ---------- realistyczna klepsydra ---------- */
function Hourglass({ p, sand, running }: { p: number; sand: Sand; running: boolean }) {
  // Stan piasku liczony z zachowaniem objętości: ile ubywa u góry,
  // dokładnie tyle przybywa na dole. Lejek powstaje płynnie od zera.
  const s = computeSand(p, running);

  return (
    <svg
      viewBox="0 0 320 478"
      className="h-[56vh] max-h-[540px] w-auto drop-shadow-2xl"
      role="img"
      aria-label="Klepsydra"
    >
      <defs>
        <linearGradient id="woodV" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a5713f" />
          <stop offset=".5" stopColor="#7c4f28" />
          <stop offset="1" stopColor="#96622f" />
        </linearGradient>
        <linearGradient id="woodH" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6b4226" />
          <stop offset=".5" stopColor="#b07f4a" />
          <stop offset="1" stopColor="#6b4226" />
        </linearGradient>
        <linearGradient id="glassG" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".38" />
          <stop offset=".18" stopColor="#ffffff" stopOpacity=".06" />
          <stop offset=".82" stopColor="#ffffff" stopOpacity=".06" />
          <stop offset="1" stopColor="#ffffff" stopOpacity=".3" />
        </linearGradient>
        <linearGradient id="sandTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sand.top} />
          <stop offset="1" stopColor={sand.mid} />
        </linearGradient>
        <linearGradient id="sandBot" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={sand.dark} />
          <stop offset=".5" stopColor={sand.top} />
          <stop offset="1" stopColor={sand.mid} />
        </linearGradient>
        <clipPath id="clipTop">
          <path d={TOP_BULB} />
        </clipPath>
        <clipPath id="clipBot">
          <path d={BOT_BULB} />
        </clipPath>
        <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* tylny słupek */}
      <rect x="152" y="56" width="16" height="352" rx="8" fill="url(#woodH)" />

      {/* piasek w górnej bańce – z lejkiem */}
      <g clipPath="url(#clipTop)">
        {s.p < 1 && <path d={s.topPath} fill="url(#sandTop)" />}
      </g>

      {/* kopiec piasku w dolnej bańce */}
      <g clipPath="url(#clipBot)">
        {s.p > 0 && (
          <path
            d={s.bottomPath}
            fill="url(#sandBot)"
            stroke={sand.dark}
            strokeWidth="1"
            strokeOpacity=".5"
          />
        )}
      </g>

      {/* strumień piasku – tylko dopóki góra naprawdę nie jest pusta */}
      {s.flowing && (
        <g>
          <line
            x1="160"
            y1="242"
            x2="160"
            y2={Math.max(244, s.apexY + 1)}
            stroke={sand.stream}
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity=".95"
          />
          <line
            x1="160"
            y1="242"
            x2="160"
            y2={Math.max(244, s.apexY + 1)}
            stroke={sand.top}
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeDasharray="1.4 7"
            className="stream"
            opacity=".8"
          />
        </g>
      )}

      {/* szkło */}
      <path d={TOP_BULB} fill="url(#glassG)" stroke="#4a3220" strokeOpacity=".45" strokeWidth="2.5" />
      <path d={BOT_BULB} fill="url(#glassG)" stroke="#4a3220" strokeOpacity=".45" strokeWidth="2.5" />

      {/* refleksy świetlne na szkle */}
      <path d="M98 112 C88 146 92 184 110 212" stroke="#fff" strokeWidth="9" fill="none" strokeLinecap="round" opacity=".4" filter="url(#soft)" />
      <path d="M222 122 C230 148 228 176 216 198" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".28" filter="url(#soft)" />
      <path d="M98 368 C88 334 92 296 110 268" stroke="#fff" strokeWidth="9" fill="none" strokeLinecap="round" opacity=".4" filter="url(#soft)" />
      <path d="M222 358 C230 332 228 304 216 282" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".28" filter="url(#soft)" />
      <ellipse cx="160" cy="240" rx="7" ry="3" fill="#fff" opacity=".55" />

      {/* przednie słupki */}
      <rect x="56" y="56" width="18" height="352" rx="9" fill="url(#woodH)" stroke="#4a3220" strokeOpacity=".4" strokeWidth="1.5" />
      <rect x="246" y="56" width="18" height="352" rx="9" fill="url(#woodH)" stroke="#4a3220" strokeOpacity=".4" strokeWidth="1.5" />

      {/* drewniane tarcze z usłojeniem */}
      <path d={TOP_DISC} fill="url(#woodV)" stroke="#4a3220" strokeOpacity=".5" strokeWidth="2.5" />
      <path d={BOT_DISC} fill="url(#woodV)" stroke="#4a3220" strokeOpacity=".5" strokeWidth="2.5" />
      <path d="M60 36 Q160 32 260 36" stroke="#2e1a0a" strokeOpacity=".3" strokeWidth="1.4" fill="none" />
      <path d="M60 50 Q160 46 260 50" stroke="#2e1a0a" strokeOpacity=".25" strokeWidth="1.4" fill="none" />
      <path d="M52 414 Q160 410 268 414" stroke="#2e1a0a" strokeOpacity=".3" strokeWidth="1.4" fill="none" />
      <path d="M52 428 Q160 424 268 428" stroke="#2e1a0a" strokeOpacity=".25" strokeWidth="1.4" fill="none" />
      <circle cx="65" cy="44" r="3" fill="#4a3220" opacity=".55" />
      <circle cx="255" cy="44" r="3" fill="#4a3220" opacity=".55" />
      <circle cx="65" cy="420" r="3" fill="#4a3220" opacity=".55" />
      <circle cx="255" cy="420" r="3" fill="#4a3220" opacity=".55" />
    </svg>
  );
}


/* ---------- słońce / księżyc w responsywnej warstwie ---------- */
function Celestial({ night }: { night: boolean }) {
  return (
    <div className="pointer-events-none absolute top-5 right-24 z-[5] h-[72px] w-[72px]" aria-hidden>
      {night ? (
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <defs>
            <mask id="crescent">
              <rect width="100" height="100" fill="#fff" />
              <circle cx="66" cy="38" r="34" fill="#000" />
            </mask>
            <radialGradient id="moonGlow">
              <stop offset="0" stopColor="#f6f2d8" stopOpacity=".35" />
              <stop offset="1" stopColor="#f6f2d8" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#moonGlow)" className="animate-pulse" />
          <circle cx="50" cy="50" r="30" fill="#f6f2d8" mask="url(#crescent)" />
        </svg>
      ) : (
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <defs>
            <radialGradient id="sunGlow2">
              <stop offset="0" stopColor="#fff6c8" stopOpacity=".9" />
              <stop offset="1" stopColor="#fff6c8" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#sunGlow2)" className="animate-pulse" />
          <g stroke="#ffdf70" strokeWidth="4" strokeLinecap="round" opacity=".8">
            <line x1="50" y1="8" x2="50" y2="18" />
            <line x1="50" y1="82" x2="50" y2="92" />
            <line x1="8" y1="50" x2="18" y2="50" />
            <line x1="82" y1="50" x2="92" y2="50" />
            <line x1="20" y1="20" x2="27" y2="27" />
            <line x1="73" y1="73" x2="80" y2="80" />
            <line x1="20" y1="80" x2="27" y2="73" />
            <line x1="73" y1="27" x2="80" y2="20" />
          </g>
          <circle cx="50" cy="50" r="24" fill="#ffec8a" />
          <circle cx="42" cy="42" r="8" fill="#fff8d8" opacity=".7" />
        </svg>
      )}
    </div>
  );
}

/* ---------- tło: motyw + dzień/noc ---------- */
function Scene({ theme, night }: { theme: Theme; night: boolean }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 80 }, () => ({
        x: Math.round(Math.random() * 1000) / 10,
        y: Math.round(Math.random() * 580) / 10,
        r: Math.round((Math.random() * 0.13 + 0.05) * 1000) / 1000,
        d: Math.round(Math.random() * 300) / 100,
      })),
    []
  );
  const sky = SKY[theme][night ? "night" : "day"];
  const flowers: [number, number, string][] = [
    [28, 79, "#ff8fb5"],
    [34, 81, "#ffd94d"],
    [66, 79, "#ffffff"],
    [72, 81, "#ff8fb5"],
    [30, 82, "#ffd94d"],
    [70, 82, "#ff9e6d"],
  ];
  const fireflies: [number, number][] = [
    [28, 74],
    [36, 78],
    [64, 76],
    [72, 80],
    [31, 81],
    [69, 82],
  ];

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
          <stop offset="0" stopColor="#ffffff" stopOpacity={night ? 0.12 : 0.25} />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? "#0d3355" : "#2aa5dd"} />
          <stop offset="1" stopColor={night ? "#051a30" : "#0b639e"} />
        </linearGradient>
      </defs>

      <rect width="100" height="100" fill="url(#sky)" />

      {night &&
        stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="#fff"
            className="twinkle"
            style={{ animationDelay: `${s.d}s` }}
          />
        ))}

      {!night && (
        <g fill="#ffffff" opacity=".9">
          <g className="cloud-drift" style={{ animationDuration: "85s" }}>
            <ellipse cx="10" cy="24" rx="7" ry="2.6" />
            <ellipse cx="14" cy="22" rx="4.5" ry="2.2" />
          </g>
          <g className="cloud-drift" style={{ animationDuration: "120s", animationDelay: "-50s" }} opacity=".75">
            <ellipse cx="30" cy="33" rx="6" ry="2.2" />
            <ellipse cx="33" cy="31.4" rx="3.6" ry="1.8" />
          </g>
          <g className="cloud-drift" style={{ animationDuration: "100s", animationDelay: "-25s" }} opacity=".6">
            <ellipse cx="55" cy="20" rx="5" ry="1.9" />
          </g>
        </g>
      )}

      {theme === "meadow" && (
        <g>
          <path d="M0 70 Q25 62 50 69 T100 67 L100 100 L0 100 Z" fill={night ? "#14351f" : "#5cab41"} />
          <path d="M0 78 Q30 71 55 77 T100 76 L100 100 L0 100 Z" fill={night ? "#0d2816" : "#3f8f2e"} />
          <g fill={night ? "#0a2012" : "#2f7a24"}>
            <rect x="27.6" y="66" width="1.8" height="7" />
            <circle cx="28.5" cy="64" r="4.6" />
            <circle cx="25.4" cy="66.5" r="3.2" />
            <circle cx="31.6" cy="66.5" r="3.2" />
          </g>
          {!night &&
            flowers.map(([x, y, c], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r=".7" fill={c} />
                <circle cx={x} cy={y - 1.1} r=".38" fill={c} />
              </g>
            ))}
          {night && (
            <g fill="#d9f26a">
              {fireflies.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r=".16" className="firefly" style={{ animationDelay: `${i * 0.7}s` }} />
              ))}
            </g>
          )}
        </g>
      )}

      {theme === "cosmos" && (
        <g>
          <path
            d="M0 74 L14 66 L28 72 L44 64 L60 71 L74 65 L88 72 L100 68 L100 100 L0 100 Z"
            fill={night ? "#10102a" : "#4a3a7a"}
          />
          <circle cx="30" cy="26" r="5" fill={night ? "#7a9ac8" : "#e8a04c"} />
          <ellipse
            cx="30"
            cy="26"
            rx="8.5"
            ry="2.4"
            fill="none"
            stroke={night ? "#7a9ac8" : "#e8a04c"}
            strokeWidth="1.1"
            opacity=".65"
            transform="rotate(-18 30 26)"
          />
          <ellipse cx="40" cy="79" rx="6" ry="1.6" fill="#000" opacity=".18" />
          <ellipse cx="72" cy="81" rx="8" ry="2" fill="#000" opacity=".18" />
        </g>
      )}

      {theme === "ocean" && (
        <g>
          <path d="M0 66 Q12 63 25 66 T50 66 T75 66 T100 66 L100 100 L0 100 Z" fill="url(#sea)" />
          <path d="M0 72 Q15 69 30 72 T60 72 T90 72 L100 72 L100 100 L0 100 Z" fill="#ffffff" opacity=".12" />
          <g transform="translate(84 70) scale(0.6) translate(-71 -75)">
            <path d="M64 79 L78 79 L75 83 L67 83 Z" fill={night ? "#1c2a44" : "#6b4226"} />
            <line x1="71" y1="66" x2="71" y2="79" stroke={night ? "#1c2a44" : "#6b4226"} strokeWidth="1" />
            <path d="M72 67 L72 78 L78 78 Z" fill={night ? "#33456a" : "#ffffff"} />
            <path d="M70 69 L70 78 L65 78 Z" fill={night ? "#2a3a5c" : "#ffe9ec"} />
          </g>
          {night && (
            <g>
              <ellipse cx="84" cy="76.4" rx="5" ry="1.1" fill="#fff" opacity=".1" />
              <ellipse cx="84" cy="78.4" rx="3.2" ry=".8" fill="#fff" opacity=".07" />
            </g>
          )}
        </g>
      )}

      {/* miękka plama światła za klepsydrą */}
      <ellipse cx="50" cy="54" rx="36" ry="32" fill="url(#spot)" />
    </svg>
  );
}

/* ---------- przełącznik ---------- */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`h-8 w-14 rounded-full p-1 transition-colors ${on ? "bg-amber-700" : "bg-stone-300"}`}
      aria-pressed={on}
    >
      <span className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : ""}`} />
    </button>
  );
}

/* ---------- panel rodzica ---------- */
function ParentPanel(props: {
  minutes: number;
  setMinutes: (m: number) => void;
  sandIdx: number;
  setSandIdx: (i: number) => void;
  sound: boolean;
  setSound: (v: boolean) => void;
  locked: boolean;
  setLocked: (v: boolean) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const { minutes, setMinutes, sandIdx, setSandIdx, sound, setSound, locked, setLocked, theme, setTheme, onClose, onReset } = props;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="panel-scroll max-h-[92vh] w-full max-w-md space-y-5 overflow-y-auto rounded-3xl bg-white p-6 text-stone-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">Panel rodzica</h2>
          <button onClick={onClose} className="rounded-full bg-stone-100 p-2" aria-label="Zamknij">
            <X size={20} />
          </button>
        </div>

        <section>
          <div className="mb-2 flex items-center gap-2 font-bold">
            <Clock size={18} /> Czas: {minutes} min
          </div>
          <div className="grid grid-cols-6 gap-2">
            {PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMinutes(m);
                  onReset();
                }}
                className={`rounded-xl py-2.5 font-black ${m === minutes ? "bg-amber-700 text-white" : "bg-amber-100"}`}
              >
                {m}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={1}
            max={30}
            value={minutes}
            onChange={(e) => {
              setMinutes(+e.target.value);
              onReset();
            }}
            className="mt-3 w-full accent-amber-700"
          />
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2 font-bold">
            <Palette size={18} /> Motyw tła
          </div>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`overflow-hidden rounded-2xl border-4 ${theme === t.id ? "border-amber-700" : "border-transparent"}`}
              >
                <span className="block h-12" style={{ background: t.css }} />
                <span className="block bg-stone-50 py-1 text-sm font-bold">{t.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 font-bold">Kolor piasku</div>
          <div className="flex gap-3">
            {SANDS.map((s, i) => (
              <button
                key={s.name}
                onClick={() => setSandIdx(i)}
                title={s.name}
                aria-label={s.name}
                className={`h-12 w-12 rounded-full border-4 ${i === sandIdx ? "border-amber-700" : "border-stone-200"}`}
                style={{ background: `linear-gradient(135deg, ${s.top}, ${s.dark})` }}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-2">
              {sound ? <Volume2 size={18} /> : <VolumeX size={18} />} Dzwonek na końcu
            </span>
            <Toggle on={sound} onChange={setSound} />
          </div>
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-2">
              <Lock size={18} /> Blokada przycisków
            </span>
            <Toggle on={locked} onChange={setLocked} />
          </div>
        </section>

        <div className="flex gap-3">
          <button onClick={onReset} className="flex-1 rounded-xl bg-amber-100 py-3 font-black">
            Reset
          </button>
          <button onClick={onClose} className="flex-1 rounded-xl bg-amber-700 py-3 font-black text-white">
            Zamknij
          </button>
        </div>
        <p className="text-sm text-stone-500">
          Dziecko dotyka klepsydry lub dużego przycisku. Ustawienia otwierają się po przytrzymaniu przycisku
          ustawień przez 2 sekundy. Blokada uniemożliwia dziecku zatrzymanie minutnika. Tło zmienia się
          automatycznie: dzień i noc.
        </p>
      </div>
    </div>
  );
}

/* ---------- aplikacja ---------- */
export default function App() {
  const [minutes, setMinutes] = useState<number>(() => load("hg2-min", 3));
  const [sandIdx, setSandIdx] = useState<number>(() => load("hg2-sand", 0));
  const [sound, setSound] = useState<boolean>(() => load("hg2-sound", true));
  const [locked, setLocked] = useState<boolean>(() => load("hg2-lock", false));
  const [theme, setTheme] = useState<Theme>(() => load<Theme>("hg2-theme", "meadow"));
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [turning, setTurning] = useState(false);
  const [nudge, setNudge] = useState(false);
  const nudgeTimer = useRef<number | null>(null);
  const [panel, setPanel] = useState(false);
  const [holdP, setHoldP] = useState(0);
  const [night, setNight] = useState(() => {
    const h = new Date().getHours();
    return h < 6 || h >= 20;
  });

  const startRef = useRef(0);
  const baseRef = useRef(0);
  const holdRef = useRef<number | null>(null);

  const total = minutes * 60000;
  const p = Math.min(1, elapsed / total);
  const sand = SANDS[sandIdx];

  useEffect(() => {
    localStorage.setItem("hg2-min", JSON.stringify(minutes));
  }, [minutes]);
  useEffect(() => {
    localStorage.setItem("hg2-sand", JSON.stringify(sandIdx));
  }, [sandIdx]);
  useEffect(() => {
    localStorage.setItem("hg2-sound", JSON.stringify(sound));
  }, [sound]);
  useEffect(() => {
    localStorage.setItem("hg2-lock", JSON.stringify(locked));
  }, [locked]);
  useEffect(() => {
    localStorage.setItem("hg2-theme", JSON.stringify(theme));
  }, [theme]);

  // dzień / noc – automatycznie według zegara
  useEffect(() => {
    const id = setInterval(() => {
      const h = new Date().getHours();
      setNight(h < 6 || h >= 20);
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // rejestracja service workera (PWA offline)
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }, []);

  // silnik minutnika
  useEffect(() => {
    if (phase !== "running") return;
    let raf = 0;
    const tick = () => {
      const e = baseRef.current + (performance.now() - startRef.current);
      if (e >= total) {
        setElapsed(total);
        setPhase("done");
        if (sound) bell();
        return;
      }
      setElapsed(e);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, total, sound]);

  const reset = useCallback(() => {
    setElapsed(0);
    baseRef.current = 0;
    setPhase("idle");
  }, []);

  // jedno dotknięcie: start / pauza / dalej / jeszcze raz
  const press = useCallback(() => {
    if (turning) return;
    if (locked) {
      // delikatny sygnał, że klepsydra jest zablokowana przez rodzica
      setNudge(false);
      if (nudgeTimer.current) window.clearTimeout(nudgeTimer.current);
      requestAnimationFrame(() => setNudge(true));
      nudgeTimer.current = window.setTimeout(() => setNudge(false), 500);
      return;
    }
    ensureAudio();
    if (phase === "idle") {
      baseRef.current = 0;
      startRef.current = performance.now();
      setElapsed(0);
      setPhase("running");
    } else if (phase === "running") {
      baseRef.current = elapsed;
      setPhase("paused");
    } else if (phase === "paused") {
      startRef.current = performance.now();
      setPhase("running");
    } else {
      // Obrót klepsydry: pełny dół wędruje na górę. Ponieważ bańki są
      // symetryczne, po obrocie zerujemy piasek bez widocznego przeskoku.
      setTurning(true);
    }
  }, [phase, elapsed, locked, turning]);

  const finishTurn = useCallback(() => {
    setTurning(false);
    reset();
  }, [reset]);

  // bramka rodzica: przytrzymaj 2 s
  const startHold = () => {
    const t0 = performance.now();
    const step = () => {
      const v = (performance.now() - t0) / 2000;
      setHoldP(Math.min(1, v));
      if (v >= 1) {
        setPanel(true);
        setHoldP(0);
        holdRef.current = null;
        return;
      }
      holdRef.current = requestAnimationFrame(step);
    };
    holdRef.current = requestAnimationFrame(step);
  };
  const endHold = () => {
    if (holdRef.current) cancelAnimationFrame(holdRef.current);
    holdRef.current = null;
    setHoldP(0);
  };

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{ touchAction: "manipulation" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Scene theme={theme} night={night} />
      <Celestial night={night} />

      {/* dźwięk – jeden widoczny przełącznik u góry */}
      <button
        onClick={() => setSound((v) => !v)}
        className="absolute top-4 left-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-amber-900 shadow-lg transition active:scale-95"
        aria-label={sound ? "Dźwięk włączony – wyłącz" : "Dźwięk wyłączony – włącz"}
        aria-pressed={sound}
      >
        {sound ? <Volume2 size={22} /> : <VolumeX size={22} className="opacity-60" />}
      </button>

      {/* przycisk ustawień – bramka 2 s */}
      <button
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        className="absolute top-4 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(rgba(124,79,40,.95) ${holdP * 360}deg, rgba(255,255,255,.35) 0deg)` }}
        aria-label="Ustawienia rodzica – przytrzymaj przez 2 sekundy"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-amber-900">
          <Settings size={22} />
        </span>
      </button>

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-5 px-4 pb-8">
        {/* klepsydra */}
        <div className="relative flex flex-col items-center">
          {phase === "done" && (
            <div className="absolute inset-0 -m-10 animate-pulse rounded-full bg-yellow-300/30 blur-3xl" />
          )}
          <div
            onClick={press}
            className={`relative cursor-pointer ${nudge ? "nudge" : ""}`}
            role="button"
            aria-label="Klepsydra – dotknij, aby zacząć lub wstrzymać"
          >
            <div
              onTransitionEnd={turning ? finishTurn : undefined}
              style={{
                transform: turning ? "rotate(180deg)" : "rotate(0deg)",
                transition: turning ? "transform .7s cubic-bezier(.45,0,.2,1)" : "none",
              }}
            >
              <div className={phase === "done" && !turning ? "wiggle" : ""}>
                <Hourglass p={p} sand={sand} running={phase === "running"} />
              </div>
            </div>
          </div>
          {/* cień pod klepsydrą */}
          <div className="-mt-3 h-7 w-60 rounded-full bg-black/30 blur-lg" />
        </div>

        {/* duży przycisk dotykowy */}
        <button
          onClick={press}
          disabled={locked}
          className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-b from-amber-500 to-amber-700 text-white shadow-[0_10px_0_rgba(0,0,0,.3)] transition active:translate-y-2 active:shadow-none disabled:grayscale disabled:opacity-50"
          aria-label={locked ? "Zablokowane" : phase === "running" ? "Pauza" : phase === "done" ? "Jeszcze raz" : "Start"}
        >
          {locked ? (
            <Lock size={44} />
          ) : phase === "running" ? (
            <Pause size={44} />
          ) : phase === "done" ? (
            <RotateCcw size={44} />
          ) : (
            <Play size={44} className="ml-1" />
          )}
        </button>
      </div>

      {panel && (
        <ParentPanel
          minutes={minutes}
          setMinutes={setMinutes}
          sandIdx={sandIdx}
          setSandIdx={setSandIdx}
          sound={sound}
          setSound={setSound}
          locked={locked}
          setLocked={setLocked}
          theme={theme}
          setTheme={setTheme}
          onClose={() => setPanel(false)}
          onReset={reset}
        />
      )}
    </div>
  );
}
