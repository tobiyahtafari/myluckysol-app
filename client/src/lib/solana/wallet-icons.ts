export const WALLET_ICONS: Record<string, string> = {
  phantom: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#534BB1"/>
      <stop offset="100%" style="stop-color:#551BF9"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="26" fill="url(#pg)"/>
  <path d="M110 50c0-19.9-16.1-36-36-36-19 0-34.6 14.7-35.9 33.4C24.4 49.3 16 59.1 16 71c0 13.8 11.2 25 25 25h5.5c3.4 6.8 10.5 11.5 18.7 11.5 3.5 0 6.8-.9 9.7-2.4 2.4 1.5 5.2 2.4 8.3 2.4 5.8 0 10.9-3.1 13.8-7.8 8.3-2.6 14.3-10.4 14.3-19.6C111.3 70.4 111 60 110 50z" fill="white"/>
  <circle cx="52" cy="65" r="6" fill="#534BB1"/>
  <circle cx="76" cy="65" r="6" fill="#534BB1"/>
</svg>`)}`,

  okx: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="26" fill="#000"/>
  <text x="64" y="78" font-family="Arial,sans-serif" font-weight="900" font-size="36" fill="white" text-anchor="middle" letter-spacing="-1">OKX</text>
</svg>`)}`,

  solflare: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FC8E03"/>
      <stop offset="100%" style="stop-color:#FD5A00"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="26" fill="url(#sg)"/>
  <g transform="translate(64,64)">
    <polygon points="0,-34 7,-7 34,0 7,7 0,34 -7,7 -34,0 -7,-7" fill="white"/>
    <polygon points="0,-22 4.5,-4.5 22,0 4.5,4.5 0,22 -4.5,4.5 -22,0 -4.5,-4.5" fill="url(#sg)"/>
  </g>
</svg>`)}`,

  backpack: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="26" fill="#E33E3F"/>
  <path d="M46 44c0-9.9 8.1-18 18-18s18 8.1 18 18" fill="none" stroke="white" stroke-width="7" stroke-linecap="round"/>
  <rect x="30" y="50" width="68" height="52" rx="12" fill="white"/>
  <rect x="50" y="44" width="28" height="14" rx="7" fill="white"/>
  <rect x="54" y="66" width="20" height="4" rx="2" fill="#E33E3F"/>
  <rect x="62" y="62" width="4" height="12" rx="2" fill="#E33E3F"/>
</svg>`)}`,

  metamask: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="26" fill="#1A1A1A"/>
  <g transform="translate(18,14) scale(0.72)">
    <polygon points="93,0 54,33 61,14" fill="#E17726" stroke="#E17726" stroke-width="0.5"/>
    <polygon points="6,0 44.5,33.4 38.1,14" fill="#E27625" stroke="#E27625" stroke-width="0.5"/>
    <polygon points="79.6,87.7 68.5,104.3 90.9,110.5 97.4,88.1" fill="#E27625" stroke="#E27625" stroke-width="0.5"/>
    <polygon points="1.8,88.1 8.3,110.5 30.6,104.3 19.5,87.7" fill="#E27625" stroke="#E27625" stroke-width="0.5"/>
    <polygon points="29.5,49.1 22.9,59.2 45,60.2 44.3,36.5" fill="#E27625" stroke="#E27625" stroke-width="0.5"/>
    <polygon points="69.6,49.1 54.9,36.2 54.1,60.2 76.2,59.2" fill="#E27625" stroke="#E27625" stroke-width="0.5"/>
    <polygon points="30.6,104.3 43.7,97.7 32.3,88.3" fill="#E27625" stroke="#E27625" stroke-width="0.5"/>
    <polygon points="55.4,97.7 68.5,104.3 66.8,88.3" fill="#E27625" stroke="#E27625" stroke-width="0.5"/>
    <polygon points="68.5,104.3 55.4,97.7 56.5,107 56.3,110.2" fill="#D5BFB2" stroke="#D5BFB2" stroke-width="0.5"/>
    <polygon points="30.6,104.3 42.8,110.2 42.7,107 43.7,97.7" fill="#D5BFB2" stroke="#D5BFB2" stroke-width="0.5"/>
    <polygon points="43,79.2 32,75.9 39.5,72.3" fill="#233447" stroke="#233447" stroke-width="0.5"/>
    <polygon points="56.1,79.2 59.6,72.3 67.2,75.9" fill="#233447" stroke="#233447" stroke-width="0.5"/>
    <polygon points="43.7,97.7 57.3,97.7 56.3,88.3 32.3,88.3 43.7,97.7" fill="#CC6228" stroke="#CC6228" stroke-width="0.5"/>
    <polygon points="43,79.2 39.5,72.3 32.3,88.3" fill="#E27525" stroke="#E27525" stroke-width="0.5"/>
    <polygon points="56.1,79.2 66.8,88.3 59.6,72.3" fill="#E27525" stroke="#E27525" stroke-width="0.5"/>
    <polygon points="45,60.2 32,75.9 43,79.2 44.3,70.4" fill="#F5841F" stroke="#F5841F" stroke-width="0.5"/>
    <polygon points="54.1,60.2 54.8,70.4 56.1,79.2 67.2,75.9" fill="#F5841F" stroke="#F5841F" stroke-width="0.5"/>
    <polygon points="45,60.2 44.3,70.4 57,70.4 54.1,60.2" fill="#FEFEFC"/>
    <polygon points="44.3,70.4 43,79.2 56.1,79.2 54.8,70.4" fill="#E27525"/>
  </g>
</svg>`)}`,
};
