export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width="36"
      height="36"
      aria-hidden
    >
      <defs>
        <linearGradient id="aira-shell" x1="7" y1="3" x2="58" y2="61" gradientUnits="userSpaceOnUse">
          <stop stopColor="#23253B" />
          <stop offset=".52" stopColor="#0C0E19" />
          <stop offset="1" stopColor="#05060C" />
        </linearGradient>
        <linearGradient id="aira-back" x1="12" y1="12" x2="44" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#42D8D1" stopOpacity=".9" />
          <stop offset="1" stopColor="#427DFF" stopOpacity=".55" />
        </linearGradient>
        <linearGradient id="aira-mid" x1="23" y1="10" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D49CFF" stopOpacity=".95" />
          <stop offset="1" stopColor="#695CFF" stopOpacity=".68" />
        </linearGradient>
        <linearGradient id="aira-front" x1="18" y1="14" x2="48" y2="51" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset=".28" stopColor="#DCD8FF" />
          <stop offset=".7" stopColor="#9187FF" />
          <stop offset="1" stopColor="#4D8DFF" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="17" fill="url(#aira-shell)" />
      <rect
        x="2.5"
        y="2.5"
        width="59"
        height="59"
        rx="16.5"
        fill="none"
        stroke="white"
        strokeOpacity=".13"
      />
      <rect
        x="13.5"
        y="15"
        width="28"
        height="35"
        rx="7.5"
        transform="rotate(-9 13.5 15)"
        fill="url(#aira-back)"
        stroke="white"
        strokeOpacity=".2"
      />
      <rect
        x="24"
        y="12"
        width="27"
        height="37"
        rx="7.5"
        transform="rotate(8 24 12)"
        fill="url(#aira-mid)"
        stroke="white"
        strokeOpacity=".2"
      />
      <path
        d="M18 17.5A6.5 6.5 0 0 1 24.5 11h12.8c2.4 0 4.7 1 6.2 2.8l2.9 3.4c1 1.2 1.6 2.8 1.6 4.4v22.9a6.5 6.5 0 0 1-6.5 6.5h-17a6.5 6.5 0 0 1-6.5-6.5v-27Z"
        fill="url(#aira-front)"
        fillOpacity=".92"
      />
      <path
        d="M24 30h17M24 35h14M24 40h10"
        stroke="#111528"
        strokeOpacity=".42"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
