/* Built-in hero illustrations (grocery + digital). No network or API data needed. */
const Bag = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
    <path d="M14 24h36l-3 31a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3z" fill="#f2b45a" />
    <path d="M24 24c0-9 16-9 16 0" fill="none" stroke="#c98a2b" strokeWidth="3" strokeLinecap="round" />
    <path d="M28 14c2-6 8-6 8 0" fill="none" stroke="#2f9e44" strokeWidth="3" strokeLinecap="round" />
    <circle cx="26" cy="34" r="5" fill="#e03131" />
    <circle cx="38" cy="36" r="5" fill="#f08c00" />
    <path d="M30 14l6-6 4 4z" fill="#51cf66" />
  </svg>
);

const Fruits = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
    <circle cx="24" cy="38" r="14" fill="#e03131" />
    <path d="M24 24c0-5 4-7 7-8" stroke="#2f9e44" strokeWidth="3" fill="none" strokeLinecap="round" />
    <ellipse cx="40" cy="30" rx="7" ry="5" fill="#51cf66" transform="rotate(-25 40 30)" />
    <circle cx="44" cy="44" r="10" fill="#fcc419" />
    <circle cx="41" cy="41" r="2.5" fill="#fff" opacity=".5" />
  </svg>
);

const Milk = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
    <path d="M22 18l10-8 10 8v38H22z" fill="#fff" stroke="#9ec5fe" strokeWidth="2" />
    <path d="M22 18h20v8H22z" fill="#4dabf7" />
    <rect x="26" y="32" width="12" height="12" rx="6" fill="#d0ebff" />
    <path d="M29 38h6M32 35v6" stroke="#4dabf7" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const Bread = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
    <path d="M12 30c0-10 8-16 20-16s20 6 20 16c0 3-2 4-4 4v18H16V34c-2 0-4-1-4-4z" fill="#e8a24a" />
    <path d="M24 22v8M32 20v10M40 22v8" stroke="#c97a1f" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const Earbuds = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
    <rect x="12" y="30" width="40" height="24" rx="12" fill="#343a40" />
    <path d="M12 42h40" stroke="#495057" strokeWidth="2" />
    <circle cx="32" cy="42" r="3" fill="#20c997" />
    <ellipse cx="22" cy="20" rx="6" ry="8" fill="#868e96" />
    <rect x="20" y="24" width="4" height="10" rx="2" fill="#868e96" />
    <ellipse cx="42" cy="20" rx="6" ry="8" fill="#868e96" />
    <rect x="40" y="24" width="4" height="10" rx="2" fill="#868e96" />
  </svg>
);

const Phone = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
    <rect x="19" y="8" width="26" height="48" rx="5" fill="#212529" />
    <rect x="22" y="13" width="20" height="36" rx="2" fill="#4dabf7" />
    <circle cx="32" cy="22" r="5" fill="#ffe066" />
    <path d="M22 49V38l7-6 6 5 7-6v18z" fill="#2b8a3e" opacity=".85" />
    <rect x="28" y="10" width="8" height="1.8" rx=".9" fill="#495057" />
  </svg>
);

const TILES = [
  { label: "Groceries", Art: Bag },
  { label: "Fruits", Art: Fruits },
  { label: "Dairy", Art: Milk },
  { label: "Bakery", Art: Bread },
  { label: "Audio", Art: Earbuds },
  { label: "Mobiles", Art: Phone },
];

export default function HeroArt() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {TILES.map(({ label, Art }) => (
        <div
          key={label}
          className="rounded-2xl flex flex-col items-center justify-center p-1.5"
          style={{ background: "rgba(255,255,255,.92)", aspectRatio: "1 / 1.05" }}
        >
          <div className="w-full flex-1 min-h-0"><Art /></div>
          <span className="text-[9px] md:text-[11px] font-bold mt-0.5" style={{ color: "#063f50" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}
