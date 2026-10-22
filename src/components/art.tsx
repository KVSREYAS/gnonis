import type { Art } from "@/lib/content/schema";
import { cn } from "@/lib/utils";

const SIL = "#141414";

function Sun({ cx = 300, cy = 150, r = 62 }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="url(#ia-sun)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={cx - r} y={cy + 8 + i * 11} width={r * 2} height={3 + i} fill="url(#ia-sky)" />
      ))}
    </g>
  );
}

function Palm({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={SIL}>
      <path d="M0 0 C2 -30 6 -60 4 -90 L8 -90 C10 -60 6 -30 6 0 Z" />
      <path d="M6 -90 C-14 -98 -30 -90 -40 -76 C-22 -88 -8 -88 6 -86 Z" />
      <path d="M6 -90 C24 -100 42 -94 50 -80 C32 -90 18 -90 6 -86 Z" />
      <path d="M6 -90 C-6 -108 -24 -112 -34 -106 C-18 -104 -6 -98 6 -88 Z" />
      <path d="M6 -90 C16 -110 34 -116 44 -110 C28 -106 16 -100 6 -88 Z" />
    </g>
  );
}

/** City blocks that read as server racks: tall boxes with rows of tiny lit windows. */
function Skyline({ seed = 1, base = 240 }: { seed?: number; base?: number }) {
  const blocks = [
    [0, 70], [34, 110], [62, 86], [96, 150], [128, 98], [170, 128], [204, 76], [236, 160], [270, 92], [306, 120], [344, 84], [372, 140],
  ];
  return (
    <g>
      {blocks.map(([x, h], i) => {
        const hh = h * (0.85 + ((i * 37 * seed) % 30) / 100);
        return (
          <g key={i}>
            <rect x={x} y={base - hh} width={32} height={hh} fill={SIL} />
            {Array.from({ length: Math.floor(hh / 16) }, (_, r) => (
              <rect key={r} x={x + 6} y={base - hh + 8 + r * 16} width={20} height={2} fill={(r + i) % 3 === 0 ? "#e8b931" : "#2a2a2a"} />
            ))}
          </g>
        );
      })}
    </g>
  );
}

function Ground({ art }: { art: Art }) {
  switch (art) {
    case "docks":
      return (
        <g fill={SIL}>
          <rect x="0" y="200" width="400" height="40" />
          <path d="M60 200 V70 H70 V200 Z M70 78 H190 V86 H70 Z M150 86 V120 H154 V86 Z" />
          <path d="M250 200 V90 H258 V200 Z M258 96 H360 V103 H258 Z M330 103 V130 H333 V103 Z" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3, 4].map((c) => (
              <rect key={`${r}${c}`} x={120 + c * 34} y={176 - r * 14} width={32} height={12} fill={(r + c) % 2 ? "#232323" : SIL} stroke="#e8b931" strokeOpacity="0.25" />
            )),
          )}
        </g>
      );
    case "hills":
      return (
        <g fill={SIL}>
          <path d="M0 240 V180 C60 140 110 150 160 176 C210 120 280 110 330 160 C360 140 390 150 400 158 V240 Z" />
          <path d="M248 128 L256 60 L264 128 Z M240 92 H272 V96 H240 Z" />
          <circle cx="256" cy="58" r="3" fill="#e8b931" />
        </g>
      );
    case "tower":
      return (
        <g fill={SIL}>
          <Skyline seed={3} />
          <path d="M186 240 L196 40 H204 L214 240 Z" />
          <rect x="176" y="70" width="48" height="14" />
          <circle cx="200" cy="36" r="4" fill="#e8b931" />
        </g>
      );
    case "grid":
      return (
        <g stroke="#e8b931" strokeOpacity="0.35" strokeWidth="1.2">
          <rect x="0" y="180" width="400" height="60" fill={SIL} stroke="none" />
          {Array.from({ length: 11 }, (_, i) => (
            <line key={i} x1={200} y1={180} x2={-200 + i * 80} y2={240} />
          ))}
          {[186, 196, 210, 230].map((y) => (
            <line key={y} x1={0} y1={y} x2={400} y2={y} />
          ))}
          <Skyline seed={2} base={182} />
        </g>
      );
    case "bridge":
      return (
        <g fill={SIL}>
          <rect x="0" y="206" width="400" height="34" />
          <rect x="80" y="80" width="10" height="130" />
          <rect x="300" y="80" width="10" height="130" />
          <path d="M0 150 Q85 70 85 80 Q195 200 305 80 Q305 70 400 150" fill="none" stroke={SIL} strokeWidth="4" />
          <rect x="0" y="190" width="400" height="8" />
        </g>
      );
    case "desert":
      return (
        <g fill={SIL}>
          <path d="M0 240 V196 H70 V160 H140 V196 H260 V172 H320 V196 H400 V240 Z" />
          <path d="M90 196 V140 Q90 132 96 132 Q102 132 102 140 V196 Z M80 160 Q80 150 86 150 V170 H90 V176 H80 Z" />
        </g>
      );
    case "pier":
      return (
        <g fill={SIL}>
          <rect x="0" y="210" width="400" height="30" />
          <rect x="140" y="196" width="260" height="8" />
          {[160, 200, 240, 280, 320, 360].map((x) => (
            <rect key={x} x={x} y={196} width={4} height={30} />
          ))}
          <circle cx="330" cy="150" r="40" fill="none" stroke={SIL} strokeWidth="5" />
          <Palm x={40} y={214} s={1.1} />
          <Palm x={96} y={214} s={0.8} />
        </g>
      );
    case "skyline":
    default:
      return (
        <g>
          <Skyline />
          <Palm x={20} y={240} s={1.2} />
          <Palm x={360} y={240} s={1} />
        </g>
      );
  }
}

/** Original loading-screen style art: sunset sky, striped sun, silhouette. Decorative only. */
export function Scene({ art = "skyline", className }: { art?: Art; className?: string }) {
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice" className={cn("decor block", className)} aria-hidden focusable="false">
      <defs>
        <linearGradient id="ia-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c2338a" />
          <stop offset="70%" stopColor="#f06a3c" />
          <stop offset="100%" stopColor="#f4a259" />
        </linearGradient>
        <linearGradient id="ia-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="100%" stopColor="#e8b931" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill="url(#ia-sky)" />
      <Sun />
      <Ground art={art} />
    </svg>
  );
}
