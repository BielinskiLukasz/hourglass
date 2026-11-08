/**
 * Fizyka piasku w klepsydrze.
 *
 * Oba zbiorniki są bryłami obrotowymi o tym samym profilu (dolny jest
 * lustrzanym odbiciem górnego). Objętość piasku liczymy jako całkę po
 * poziomych plastrach, a poziom górnej powierzchni i wierzchołek dolnego
 * kopca wyznaczamy metodą bisekcji tak, aby w każdej chwili:
 *
 *   objętość(góra) + objętość(dół) = objętość początkowa
 *
 * Dzięki temu piasek znika z góry dokładnie w takim tempie, w jakim
 * przybywa go na dole — nic nie „przeskakuje” na starcie ani nie „leje się”
 * z już pustego zbiornika pod koniec.
 */

export const NECK_Y = 243; // szyjka górnego zbiornika
export const BASE_Y = 408; // dno dolnego zbiornika
export const TOP_Y = 72; // wierzchołek górnego zbiornika
export const INITIAL_LEVEL = 100; // początkowy poziom piasku u góry
export const CENTER_X = 160;
export const PILE_SLOPE = 0.62; // kąt zsypu piasku (ok. 32°)
const MAX_CRATER = 30; // maksymalna głębokość lejka w górnej bańce
const MAX_CRATER_RADIUS = 26; // lejek jest wąski, jak w prawdziwej klepsydrze
const CRATER_PROFILE = 1.3; // zaokrąglone dno lejka (wykładnik profilu)
const STEP = 0.5; // krok całkowania (px)
const MIRROR = NECK_Y + 237; // oś symetrii obu baniek (y -> 480 - y)

type Cubic = [number, number, number, number, number, number, number, number];

// Prawa ścianka górnej bańki, dokładnie jak w ścieżce SVG.
const UPPER_RIGHT: Cubic = [160, 72, 215, 72, 246, 102, 243, 148];
const LOWER_RIGHT: Cubic = [243, 148, 240, 194, 206, 232, 172, 243];

function cubicAt(c: Cubic, t: number, axis: 0 | 1): number {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const d = 3 * mt * t * t;
  const e = t * t * t;
  const i = axis === 0 ? 0 : 1;
  return a * c[i] + b * c[i + 2] + d * c[i + 4] + e * c[i + 6];
}

function radiusOnSegment(c: Cubic, y: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    if (cubicAt(c, mid, 1) < y) lo = mid;
    else hi = mid;
  }
  return cubicAt(c, (lo + hi) / 2, 0) - CENTER_X;
}

// Tablica promieni górnej bańki co STEP px — liczona raz, przy starcie.
const RADIUS_SAMPLES = Math.round((NECK_Y - TOP_Y) / STEP) + 1;
const RADII = new Float64Array(RADIUS_SAMPLES);
for (let i = 0; i < RADIUS_SAMPLES; i++) {
  const y = TOP_Y + i * STEP;
  RADII[i] = y <= 148 ? radiusOnSegment(UPPER_RIGHT, y) : radiusOnSegment(LOWER_RIGHT, y);
}

function topRadius(y: number): number {
  if (y <= TOP_Y) return 0;
  if (y >= NECK_Y) return RADII[RADIUS_SAMPLES - 1];
  const f = (y - TOP_Y) / STEP;
  const i = Math.floor(f);
  const frac = f - i;
  return RADII[i] * (1 - frac) + RADII[Math.min(i + 1, RADIUS_SAMPLES - 1)] * frac;
}

function bottomRadius(y: number): number {
  return topRadius(MIRROR - y);
}

/** Objętość piasku w górnej bańce: powierzchnia z lejkiem na poziomie `level`. */
function topVolume(level: number, depth: number, craterRadius: number): number {
  if (level >= NECK_Y) return 0;
  let volume = 0;
  for (let y = level; y < NECK_Y; y += STEP) {
    const outer = topRadius(y);
    let inner = 0;
    if (depth > 0 && y < level + depth && craterRadius > 0) {
      inner = craterRadius * (1 - Math.pow((y - level) / depth, 1 / CRATER_PROFILE));
    }
    if (outer > inner) volume += Math.PI * (outer * outer - inner * inner) * STEP;
  }
  return volume;
}

/** Objętość kopca w dolnej bańce o wierzchołku na wysokości `apexY`. */
function bottomVolume(apexY: number): number {
  if (apexY >= BASE_Y) return 0;
  let volume = 0;
  for (let y = Math.max(apexY, MIRROR - NECK_Y); y < BASE_Y; y += STEP) {
    const coneRadius = (y - apexY) / PILE_SLOPE;
    const r = Math.min(bottomRadius(y), coneRadius);
    if (r > 0) volume += Math.PI * r * r * STEP;
  }
  return volume;
}

const INITIAL_VOLUME = topVolume(INITIAL_LEVEL, 0, 0);

function solveLevel(target: number, depth: number): number {
  let lo = INITIAL_LEVEL;
  let hi = NECK_Y;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const craterRadius = Math.min(MAX_CRATER_RADIUS, topRadius(mid) * 0.4);
    if (topVolume(mid, depth, craterRadius) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function solveApex(target: number): number {
  if (target <= 0) return BASE_Y;
  let lo = MIRROR - NECK_Y;
  let hi = BASE_Y;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (bottomVolume(mid) < target) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export interface SandState {
  /** postęp 0..1 */
  p: number;
  /** poziom krawędzi górnej powierzchni piasku */
  level: number;
  /** głębokość lejka w środku górnej powierzchni */
  depth: number;
  /** promień lejka */
  craterRadius: number;
  /** wierzchołek dolnego kopca */
  apexY: number;
  /** ścieżka SVG piasku w górnej bańce */
  topPath: string;
  /** ścieżka SVG piasku w dolnej bańce */
  bottomPath: string;
  /** czy widać strumień (tylko gdy piasek naprawdę jeszcze leci) */
  flowing: boolean;
}

function surfacePath(surfaceY: (r: number) => number, closeY: number): string {
  const parts: string[] = [];
  for (let x = 56; x <= 264; x += 2.6) {
    const y = surfaceY(Math.abs(x - CENTER_X));
    parts.push(`${parts.length === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  parts.push(`L264 ${closeY}`, `L56 ${closeY}`, "Z");
  return parts.join(" ");
}

/**
 * Stan piasku dla postępu `p` (0 = pełna góra, 1 = pełny dół).
 * `running` steruje wyłącznie widocznością strumienia, nie ilością piasku.
 */
export function computeSand(p: number, running: boolean): SandState {
  const clamped = Math.min(1, Math.max(0, p));

  // Lejek powstaje płynnie od zera, największy jest w połowie,
  // i znów płynnie znika, gdy górna bańka jest już prawie pusta.
  const depth = MAX_CRATER * Math.sin(Math.PI * clamped);

  const remaining = INITIAL_VOLUME * (1 - clamped);
  const level = clamped >= 1 ? NECK_Y : solveLevel(remaining, depth);
  const craterRadius = Math.min(MAX_CRATER_RADIUS, topRadius(level) * 0.4);
  const apexY = clamped <= 0 ? BASE_Y : solveApex(INITIAL_VOLUME - remaining);

  const topPath = surfacePath(
    (r) =>
      level +
      (craterRadius > 0 ? depth * Math.pow(Math.max(0, 1 - r / craterRadius), CRATER_PROFILE) : 0),
    NECK_Y + 12
  );
  const bottomPath = surfacePath((r) => apexY + PILE_SLOPE * r, BASE_Y + 12);

  return {
    p: clamped,
    level,
    depth,
    craterRadius,
    apexY,
    topPath,
    bottomPath,
    flowing: running && clamped > 0 && clamped < 1,
  };
}

/** Sprawdzenie zachowania objętości — używane w testach. */
export function sandVolumes(p: number): { top: number; bottom: number; total: number; initial: number } {
  const s = computeSand(p, false);
  const top = topVolume(s.level, s.depth, s.craterRadius);
  const bottom = bottomVolume(s.apexY);
  return { top, bottom, total: top + bottom, initial: INITIAL_VOLUME };
}
