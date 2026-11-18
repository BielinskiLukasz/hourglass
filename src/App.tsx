import { useCallback, useEffect, useRef, useState } from "react";
import { computeSand } from "./lib/sand";
import { Celestial, Scene, type Theme } from "./Scene";
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
type Frame = { hi: string; mid: string; lo: string; ink: string };

/* lakierowana rama – kolor zależy od motywu */
const FRAMES: Record<Theme, Frame> = {
  meadow: { hi: "#f27a5e", mid: "#e2563b", lo: "#b73a26", ink: "#7a2316" },
  cosmos: { hi: "#ffd877", mid: "#f2b84b", lo: "#c98a1f", ink: "#6e4a0c" },
  ocean: { hi: "#fffaf0", mid: "#f3e3c3", lo: "#c9b48a", ink: "#2a1b3d" },
};

type Sand = { name: string; top: string; mid: string; dark: string; stream: string };

const PRESETS = [1, 2, 3, 5, 10, 15];

const SANDS: Sand[] = [
  { name: "Złoty", top: "#f6cf6a", mid: "#eebd45", dark: "#c98a1f", stream: "#f2c14e" },
  { name: "Biały", top: "#fdfdf8", mid: "#f2efe2", dark: "#cfc9b4", stream: "#f5f2e6" },
  { name: "Różowy", top: "#ffc2d4", mid: "#ff9ebb", dark: "#e06a92", stream: "#ffb3c9" },
  { name: "Niebieski", top: "#aee3ff", mid: "#7cc7f5", dark: "#3f97d6", stream: "#8fd0ff" },
];

const THEMES: { id: Theme; name: string; css: string }[] = [
  { id: "meadow", name: "Łąka", css: "linear-gradient(#8fd6ee 48%, #4fa670 48% 70%, #1f6b54 70%)" },
  { id: "cosmos", name: "Kosmos", css: "linear-gradient(#5a3fa3 48%, #8f5fc4 48% 70%, #3d2477 70%)" },
  { id: "ocean", name: "Ocean", css: "linear-gradient(#7fd0ea 48%, #2fa3c8 48% 70%, #136591 70%)" },
];

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
function Hourglass({ p, sand, running, frame }: { p: number; sand: Sand; running: boolean; frame: Frame }) {
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
          <stop offset="0" stopColor={frame.hi} />
          <stop offset=".45" stopColor={frame.mid} />
          <stop offset="1" stopColor={frame.lo} />
        </linearGradient>
        <linearGradient id="woodH" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={frame.lo} />
          <stop offset=".35" stopColor={frame.hi} />
          <stop offset=".7" stopColor={frame.mid} />
          <stop offset="1" stopColor={frame.lo} />
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
      <path d={TOP_BULB} fill="url(#glassG)" stroke={frame.ink} strokeOpacity=".5" strokeWidth="2.5" />
      <path d={BOT_BULB} fill="url(#glassG)" stroke={frame.ink} strokeOpacity=".5" strokeWidth="2.5" />

      {/* refleksy świetlne na szkle */}
      <path d="M98 112 C88 146 92 184 110 212" stroke="#fff" strokeWidth="9" fill="none" strokeLinecap="round" opacity=".4" filter="url(#soft)" />
      <path d="M222 122 C230 148 228 176 216 198" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".28" filter="url(#soft)" />
      <path d="M98 368 C88 334 92 296 110 268" stroke="#fff" strokeWidth="9" fill="none" strokeLinecap="round" opacity=".4" filter="url(#soft)" />
      <path d="M222 358 C230 332 228 304 216 282" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".28" filter="url(#soft)" />
      <ellipse cx="160" cy="240" rx="7" ry="3" fill="#fff" opacity=".55" />

      {/* przednie słupki */}
      <rect x="56" y="56" width="18" height="352" rx="9" fill="url(#woodH)" stroke={frame.ink} strokeOpacity=".45" strokeWidth="1.5" />
      <rect x="246" y="56" width="18" height="352" rx="9" fill="url(#woodH)" stroke={frame.ink} strokeOpacity=".45" strokeWidth="1.5" />

      {/* lakierowane tarcze */}
      <path d={TOP_DISC} fill="url(#woodV)" stroke={frame.ink} strokeOpacity=".6" strokeWidth="2.5" />
      <path d={BOT_DISC} fill="url(#woodV)" stroke={frame.ink} strokeOpacity=".6" strokeWidth="2.5" />
      <path d="M62 35 Q160 31 258 35" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M54 411 Q160 407 266 411" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}


/* ---------- przełącznik ---------- */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`ink-border h-9 w-16 shrink-0 rounded-full p-1 transition-colors ${on ? "bg-[#e2563b]" : "bg-[#e9dcc0]"}`}
      aria-pressed={on}
    >
      <span className={`block h-6 w-6 rounded-full bg-[#fffaf0] shadow-[0_2px_0_rgba(42,27,61,.35)] transition-transform ${on ? "translate-x-7" : ""}`} />
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
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#1a1030]/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="panel panel-scroll max-h-[92vh] w-full max-w-md space-y-6 overflow-y-auto rounded-[28px] bg-[#fff6e2] p-6 text-[#2a1b3d]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Panel rodzica"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl leading-none">Panel rodzica</h2>
          <button onClick={onClose} className="ink-border chip flex h-11 w-11 items-center justify-center rounded-full bg-[#fffaf0]" aria-label="Zamknij">
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
                className={`ink-border chip rounded-xl py-2.5 font-display text-lg ${m === minutes ? "bg-[#e2563b] text-[#fffaf0]" : "bg-[#fffaf0]"}`}
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
            className="mt-4 w-full"
            aria-label="Czas w minutach"
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
                aria-pressed={theme === t.id}
                className={`ink-border chip overflow-hidden rounded-2xl ${theme === t.id ? "ring-4 ring-[#e2563b] ring-offset-2 ring-offset-[#fff6e2]" : ""}`}
              >
                <span className="block h-14" style={{ background: t.css }} />
                <span className="block bg-[#fffaf0] py-1 text-sm font-bold">{t.name}</span>
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
                aria-pressed={i === sandIdx}
                className={`ink-border chip h-12 w-12 rounded-full ${i === sandIdx ? "ring-4 ring-[#e2563b] ring-offset-2 ring-offset-[#fff6e2]" : ""}`}
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
          <button onClick={onReset} className="ink-border chip flex-1 rounded-xl bg-[#fffaf0] py-3 font-display text-lg">
            Reset
          </button>
          <button onClick={onClose} className="ink-border chip flex-1 rounded-xl bg-[#e2563b] py-3 font-display text-lg text-[#fffaf0]">
            Zamknij
          </button>
        </div>
        <p className="text-sm leading-relaxed text-[#2a1b3d]/70">
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
        className="ink-border chip absolute top-4 left-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#fffaf0] text-[#2a1b3d]"
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
        style={{ background: `conic-gradient(#e2563b ${holdP * 360}deg, rgba(255,250,240,.45) 0deg)` }}
        aria-label="Ustawienia rodzica – przytrzymaj przez 2 sekundy"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fffaf0] text-[#2a1b3d] shadow-[0_3px_0_rgba(42,27,61,.4)]">
          <Settings size={22} />
        </span>
      </button>

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-5 px-4 pb-8">
        {/* klepsydra */}
        <div className="relative flex flex-col items-center">
          {phase === "done" && (
            <div className="absolute inset-0 -m-10 animate-pulse rounded-full bg-[#ffd36b]/45 blur-3xl" />
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
                <Hourglass p={p} sand={sand} running={phase === "running"} frame={FRAMES[theme]} />
              </div>
            </div>
          </div>
          {/* cień pod klepsydrą */}
          <div className="-mt-3 h-6 w-56 rounded-full bg-[#1a1030]/35 blur-md" />
        </div>

        {/* duży przycisk dotykowy z pierścieniem postępu */}
        <div className="relative z-10 h-[108px] w-[108px]">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(#fffaf0 ${p * 360}deg, rgba(26,16,48,.28) 0deg)`,
              boxShadow: "0 0 0 3px #2a1b3d",
            }}
            aria-hidden
          />
          <button
            onClick={press}
            disabled={locked}
            className="ink-border big-btn absolute inset-[7px] flex items-center justify-center rounded-full bg-[#e2563b] text-[#fffaf0] disabled:opacity-60 disabled:saturate-0"
            aria-label={locked ? "Zablokowane" : phase === "running" ? "Pauza" : phase === "done" ? "Jeszcze raz" : "Start"}
          >
            {locked ? (
              <Lock size={40} />
            ) : phase === "running" ? (
              <Pause size={40} fill="currentColor" />
            ) : phase === "done" ? (
              <RotateCcw size={40} />
            ) : (
              <Play size={40} fill="currentColor" className="ml-1" />
            )}
          </button>
        </div>
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
