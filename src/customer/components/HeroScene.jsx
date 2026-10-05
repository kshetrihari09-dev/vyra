/* Home hero artwork — three product compositions drawn as inline SVG (no network, no API data).
   Only the artwork rotates; hero copy, links and the theme gradient live in Home.jsx. */
import React from "react";

const VB = "0 0 360 280";

function Defs({ p }) {
  return (
    <defs>
      <radialGradient id={`${p}apple`} cx=".35" cy=".3" r=".85"><stop offset="0" stopColor="#ff8f86" /><stop offset=".55" stopColor="#e03131" /><stop offset="1" stopColor="#a31d1d" /></radialGradient>
      <radialGradient id={`${p}orange`} cx=".35" cy=".3" r=".85"><stop offset="0" stopColor="#ffd08a" /><stop offset=".55" stopColor="#f59f00" /><stop offset="1" stopColor="#c2680a" /></radialGradient>
      <linearGradient id={`${p}bread`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6cf86" /><stop offset="1" stopColor="#c68232" /></linearGradient>
      <linearGradient id={`${p}wicker`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e6b97b" /><stop offset="1" stopColor="#b57a38" /></linearGradient>
      <linearGradient id={`${p}rim`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d49a55" /><stop offset="1" stopColor="#a8692a" /></linearGradient>
      <linearGradient id={`${p}leaf`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7fdc8b" /><stop offset="1" stopColor="#2a9247" /></linearGradient>
      <linearGradient id={`${p}milk`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#dde8f3" /></linearGradient>
      <linearGradient id={`${p}amber`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#e9a23b" /><stop offset=".5" stopColor="#c47716" /><stop offset="1" stopColor="#8f520e" /></linearGradient>
      <linearGradient id={`${p}screen`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5cc8ff" /><stop offset="1" stopColor="#1f9d8a" /></linearGradient>
      <linearGradient id={`${p}case`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#d7dfe5" /></linearGradient>
      <linearGradient id={`${p}box`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e3ebef" /></linearGradient>
      <filter id={`${p}blur`} x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
      <clipPath id={`${p}body`}><path d="M70 140H290L265 250Q262 258 252 258H108Q98 258 95 250Z" /></clipPath>
    </defs>
  );
}

const Shadow = ({ p, rx = 112 }) => <ellipse cx="180" cy="263" rx={rx} ry="10" fill="#000" opacity=".24" filter={`url(#${p}blur)`} />;

const Fruit = ({ p, id, cx, cy, r, stem = true }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={`url(#${p}${id})`} />
    <ellipse cx={cx - r * 0.35} cy={cy - r * 0.4} rx={r * 0.28} ry={r * 0.16} fill="#fff" opacity=".4" transform={`rotate(-30 ${cx - r * 0.35} ${cy - r * 0.4})`} />
    {stem && <path d={`M${cx} ${cy - r + 2}q2-9 8-12`} stroke="#5b3a1a" strokeWidth="2.4" fill="none" strokeLinecap="round" />}
    {stem && id === "apple" && <ellipse cx={cx + 9} cy={cy - r - 4} rx="7" ry="3.4" fill="#4cbf5f" transform={`rotate(-20 ${cx + 9} ${cy - r - 4})`} />}
  </g>
);

function Basket() {
  const p = "b-";
  const weaveV = Array.from({ length: 13 }, (_, i) => 70 + i * 18.5);
  return (
    <svg viewBox={VB} className="w-full h-auto" aria-hidden="true">
      <Defs p={p} />
      <Shadow p={p} />
      <path d="M92 140C92 38 268 38 268 140" fill="none" stroke="#a8692a" strokeWidth="10" strokeLinecap="round" />
      <path d="M92 140C92 38 268 38 268 140" fill="none" stroke="#e0aa68" strokeWidth="3" strokeLinecap="round" transform="translate(0 -2)" opacity=".55" />
      <g transform="translate(0 -20)">
      {/* leafy greens */}
      <g transform="translate(150 142)">
        {[[-24, -32, 17, 38, -28], [0, -46, 18, 44, 0], [25, -32, 17, 38, 26]].map(([x, y, rx, ry, rot], i) => (
          <g key={i} transform={`rotate(${rot} ${x} ${y})`}>
            <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={`url(#${p}leaf)`} />
            <path d={`M${x} ${y + ry - 4}V${y - ry + 8}`} stroke="#fff" strokeOpacity=".35" strokeWidth="2" />
          </g>
        ))}
      </g>
      {/* baguette */}
      <g transform="translate(116 94) rotate(-38)">
        <rect x="-62" y="-13" width="124" height="26" rx="13" fill={`url(#${p}bread)`} />
        {[-32, -8, 16].map((x) => <path key={x} d={`M${x} -8l9 14`} stroke="#a8661f" strokeWidth="3" strokeLinecap="round" />)}
      </g>
      {/* milk */}
      <g>
        <rect x="199" y="92" width="40" height="64" rx="9" fill={`url(#${p}milk)`} stroke="#c9d9e8" />
        <rect x="210" y="72" width="18" height="24" rx="4" fill={`url(#${p}milk)`} stroke="#c9d9e8" />
        <rect x="208" y="64" width="22" height="11" rx="3" fill="#2f8fe0" />
        <rect x="199" y="112" width="40" height="22" fill="#4dabf7" />
        <path d="M219 116c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" fill="#fff" opacity=".9" />
      </g>
      <Fruit p={p} id="apple" cx="100" cy="134" r="24" />
      <Fruit p={p} id="orange" cx="150" cy="134" r="19" stem={false} />
      <Fruit p={p} id="orange" cx="216" cy="136" r="20" stem={false} />
      <Fruit p={p} id="apple" cx="256" cy="136" r="23" />
      </g>
      {/* basket */}
      <path d="M70 140H290L265 250Q262 258 252 258H108Q98 258 95 250Z" fill={`url(#${p}wicker)`} />
      <g clipPath={`url(#${p}body)`} stroke="#8a5320" strokeOpacity=".32" strokeWidth="2" fill="none">
        {[160, 178, 196, 214, 232, 250].map((y) => <path key={y} d={`M60 ${y}Q180 ${y + 7} 300 ${y}`} />)}
        {weaveV.map((x) => <path key={x} d={`M${x} 140L${180 + (x - 180) * 0.78} 260`} strokeOpacity=".22" />)}
        <path d="M70 140L98 258H130L104 140Z" fill="#fff" fillOpacity=".08" stroke="none" />
      </g>
      <rect x="62" y="130" width="236" height="17" rx="8.5" fill={`url(#${p}rim)`} />
      <rect x="68" y="133" width="224" height="3" rx="1.5" fill="#fff" opacity=".28" />
    </svg>
  );
}

const Podium = () => (
  <g>
    <rect x="46" y="226" width="268" height="34" rx="17" fill="#fff" opacity=".94" />
    <rect x="46" y="226" width="268" height="8" rx="4" fill="#fff" />
    <rect x="46" y="250" width="268" height="10" rx="5" fill="#000" opacity=".06" />
  </g>
);

function BeautyTech() {
  const p = "t-";
  return (
    <svg viewBox={VB} className="w-full h-auto" aria-hidden="true">
      <Defs p={p} />
      <Shadow p={p} rx={130} />
      <Podium />
      {/* phone */}
      <rect x="84" y="66" width="78" height="162" rx="15" fill="#1c2b33" />
      <rect x="90" y="73" width="66" height="148" rx="10" fill={`url(#${p}screen)`} />
      <circle cx="123" cy="110" r="14" fill="#ffe27a" />
      <path d="M90 221V172l24-22 20 17 22-20v74z" fill="#1d7a4a" opacity=".85" />
      <rect x="112" y="76" width="22" height="5" rx="2.5" fill="#1c2b33" />
      <rect x="86" y="68" width="3" height="40" rx="1.5" fill="#fff" opacity=".18" />
      {/* serum */}
      <ellipse cx="216" cy="86" rx="12" ry="26" fill="#222d33" />
      <rect x="203" y="108" width="26" height="14" rx="3" fill="#c9d2d8" />
      <rect x="197" y="120" width="38" height="14" rx="5" fill="#9aa6ae" />
      <rect x="190" y="132" width="52" height="94" rx="12" fill={`url(#${p}amber)`} />
      <rect x="190" y="162" width="52" height="38" fill="#fff" opacity=".88" />
      <path d="M216 170c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" fill="#e8a23a" />
      <rect x="196" y="140" width="4" height="78" rx="2" fill="#fff" opacity=".28" />
      {/* earbuds case */}
      <rect x="252" y="176" width="52" height="50" rx="18" fill={`url(#${p}case)`} stroke="#c3ced6" />
      <path d="M252 198h52" stroke="#b6c3cc" strokeWidth="2" />
      <circle cx="278" cy="212" r="3" fill="#1fc29b" />
      {[262, 294].map((x) => (
        <g key={x}><ellipse cx={x} cy="162" rx="7" ry="9" fill="#f3f6f8" stroke="#c3ced6" /><rect x={x - 2} y="168" width="4" height="12" rx="2" fill="#f3f6f8" stroke="#c3ced6" /></g>
      ))}
    </svg>
  );
}

function Wellness() {
  const p = "w-";
  return (
    <svg viewBox={VB} className="w-full h-auto" aria-hidden="true">
      <Defs p={p} />
      <Shadow p={p} rx={130} />
      <Podium />
      {/* first-aid box */}
      <path d="M156 134a8 8 0 0 1 8-8h40a8 8 0 0 1 8 8v8h-8v-6h-40v6h-8z" fill="#c3ced6" />
      <rect x="140" y="140" width="112" height="86" rx="14" fill={`url(#${p}box)`} stroke="#c3ced6" />
      <rect x="182" y="156" width="28" height="54" rx="4" fill="#2f9e44" />
      <rect x="169" y="169" width="54" height="28" rx="4" fill="#2f9e44" />
      {/* pill bottle */}
      <rect x="64" y="104" width="62" height="122" rx="14" fill={`url(#${p}amber)`} />
      <rect x="60" y="82" width="70" height="30" rx="8" fill="#fff" stroke="#d7dfe5" />
      {[68, 78, 88, 98, 108, 118].map((x) => <rect key={x} x={x} y="86" width="2" height="22" fill="#d7dfe5" />)}
      <rect x="64" y="132" width="62" height="58" fill="#fff" opacity=".92" />
      <rect x="89" y="142" width="12" height="32" rx="2" fill="#2f9e44" />
      <rect x="79" y="152" width="32" height="12" rx="2" fill="#2f9e44" />
      <rect x="72" y="180" width="46" height="3" rx="1.5" fill="#c3ced6" />
      <rect x="70" y="112" width="4" height="106" rx="2" fill="#fff" opacity=".28" />
      {/* blister pack */}
      <g transform="rotate(-8 284 190)">
        <rect x="262" y="154" width="64" height="70" rx="9" fill="#e9eef2" stroke="#c3ced6" />
        {[0, 1, 2].flatMap((r) => [0, 1].map((c) => <circle key={`${r}${c}`} cx={279 + c * 30} cy={170 + r * 20} r="8" fill="#fff" stroke="#b6c3cc" />))}
      </g>
      {/* tablets */}
      {[[132, 219, 7], [150, 222, 6], [250, 224, 6]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.62} fill="#ffe27a" stroke="#e0b93a" />)}
    </svg>
  );
}

export const HERO_SCENES = [Basket, BeautyTech, Wellness];

/* Subtle floating leaves / sparkles — white tints only, so the active theme colour stays untouched. */
const LEAF = "M12 2C6 6 3.5 13 6 21c8-1 14-7 15-16-3-3-6-4-9-3z";
const FLOATERS = [
  { cls: "left-[46%] top-3 w-5", r: "20deg", d: "0s", o: 0.2 },
  { cls: "right-[4%] top-4 w-7 hidden md:block", r: "-25deg", d: "1.2s", o: 0.22 },
  { cls: "right-[36%] bottom-4 w-4 hidden sm:block", r: "40deg", d: "2.4s", o: 0.18 },
  { cls: "right-[2%] top-[46%] w-5 hidden sm:block", r: "-10deg", d: "3.1s", o: 0.2 },
];
export function FloatingLeaves() {
  return (
    <>
      {FLOATERS.map((f, i) => (
        <svg key={i} viewBox="0 0 24 24" aria-hidden="true" className={`vyra-float absolute pointer-events-none ${f.cls}`}
          style={{ "--r": f.r, "--d": f.d, opacity: f.o }}>
          <path d={LEAF} fill="#fff" />
          <path d="M7 19C10 13 14 9 18 6" stroke="#000" strokeOpacity=".12" strokeWidth="1" fill="none" />
        </svg>
      ))}
    </>
  );
}
