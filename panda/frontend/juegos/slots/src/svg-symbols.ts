// Iconos vectoriales SVG de alta definición para los símbolos del tragamonedas
// Garantizan renderizado 100% idéntico en cualquier sistema operativo (Windows, Mac, Android, iOS)
// eliminando problemas de glifos faltantes (como el emoji de moneda 🪙 en Windows).

export const SYMBOL_SVGS: Record<string, string> = {
  panda: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#0d182b" stroke="#ffb700" stroke-width="2.5"/>
  <circle cx="16" cy="17" r="9" fill="#1e293b"/>
  <circle cx="48" cy="17" r="9" fill="#1e293b"/>
  <circle cx="16" cy="17" r="5" fill="#0f172a"/>
  <circle cx="48" cy="17" r="5" fill="#0f172a"/>
  <ellipse cx="32" cy="36" rx="20" ry="17" fill="#ffffff"/>
  <ellipse cx="23" cy="33" rx="5.5" ry="6.5" fill="#1e293b" transform="rotate(-15 23 33)"/>
  <ellipse cx="41" cy="33" rx="5.5" ry="6.5" fill="#1e293b" transform="rotate(15 41 33)"/>
  <circle cx="24" cy="32" r="2.2" fill="#ffffff"/>
  <circle cx="40" cy="32" r="2.2" fill="#ffffff"/>
  <ellipse cx="32" cy="40" rx="3.5" ry="2.5" fill="#1e293b"/>
  <path d="M28 44 Q32 48 36 44" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round"/>
  <polygon points="25,14 32,5 39,14" fill="#ffb700" stroke="#ffa000" stroke-width="1.2"/>
  <circle cx="32" cy="5" r="2" fill="#ffffff"/>
</svg>`,

  gem: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="gemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#bbf7ff"/>
      <stop offset="40%" stop-color="#00f0ff"/>
      <stop offset="100%" stop-color="#007799"/>
    </linearGradient>
  </defs>
  <polygon points="18,16 46,16 56,28 32,54 8,28" fill="url(#gemGrad)" stroke="#ffffff" stroke-width="1.5"/>
  <polygon points="24,16 40,16 48,28 32,28 16,28" fill="#e0fcff" opacity="0.6"/>
  <polygon points="32,28 48,28 32,54" fill="#00c8e0" opacity="0.75"/>
  <polygon points="16,28 32,28 32,54" fill="#5ce8ff" opacity="0.85"/>
  <polygon points="8,28 16,28 32,54" fill="#0099bb" opacity="0.7"/>
  <polygon points="48,28 56,28 32,54" fill="#006680" opacity="0.7"/>
  <circle cx="24" cy="22" r="1.5" fill="#ffffff"/>
</svg>`,

  crown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="crownGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffe57f"/>
      <stop offset="50%" stop-color="#ffb700"/>
      <stop offset="100%" stop-color="#cc8800"/>
    </linearGradient>
  </defs>
  <path d="M10 46 L14 22 L24 34 L32 16 L40 34 L50 22 L54 46 Z" fill="url(#crownGrad)" stroke="#ffea75" stroke-width="1.8"/>
  <rect x="10" y="46" width="44" height="8" rx="2" fill="#d48800" stroke="#ffea75" stroke-width="1.5"/>
  <circle cx="14" cy="22" r="3" fill="#ffffff" stroke="#ffb700" stroke-width="1"/>
  <circle cx="32" cy="16" r="3.5" fill="#ffffff" stroke="#ffb700" stroke-width="1"/>
  <circle cx="50" cy="22" r="3" fill="#ffffff" stroke="#ffb700" stroke-width="1"/>
  <circle cx="20" cy="50" r="2.2" fill="#ff1744"/>
  <circle cx="32" cy="50" r="2.5" fill="#00f0ff"/>
  <circle cx="44" cy="50" r="2.2" fill="#00e701"/>
</svg>`,

  packet: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="envGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ff2e4d"/>
      <stop offset="100%" stop-color="#c4001d"/>
    </linearGradient>
  </defs>
  <rect x="14" y="10" width="36" height="46" rx="4" fill="url(#envGrad)" stroke="#ffb700" stroke-width="1.5"/>
  <path d="M14 10 L32 28 L50 10" fill="#d90429" stroke="#ffb700" stroke-width="1.5"/>
  <circle cx="32" cy="28" r="6" fill="#ffb700" stroke="#fff" stroke-width="1"/>
  <circle cx="32" cy="28" r="3" fill="#c4001d"/>
</svg>`,

  coin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="coinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff085"/>
      <stop offset="50%" stop-color="#ffb700"/>
      <stop offset="100%" stop-color="#c47d00"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="26" fill="url(#coinGrad)" stroke="#ffe57f" stroke-width="2.5"/>
  <circle cx="32" cy="32" r="20" fill="none" stroke="#e09900" stroke-width="1.8" stroke-dasharray="3 2"/>
  <polygon points="32,18 36,27 46,28 38,35 41,45 32,39 23,45 26,35 18,28 28,27" fill="#ffe57f" stroke="#c47d00" stroke-width="1.2"/>
</svg>`,

  bamboo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00c853"/>
      <stop offset="50%" stop-color="#69f0ae"/>
      <stop offset="100%" stop-color="#009624"/>
    </linearGradient>
  </defs>
  <rect x="26" y="8" width="12" height="14" rx="2" fill="url(#bamGrad)"/>
  <line x1="24" y1="22" x2="40" y2="22" stroke="#00701a" stroke-width="3" stroke-linecap="round"/>
  <rect x="26" y="23" width="12" height="15" rx="2" fill="url(#bamGrad)"/>
  <line x1="24" y1="38" x2="40" y2="38" stroke="#00701a" stroke-width="3" stroke-linecap="round"/>
  <rect x="26" y="39" width="12" height="17" rx="2" fill="url(#bamGrad)"/>
  <path d="M26 22 Q12 16 10 26 Q18 26 26 22" fill="#00e676"/>
  <path d="M38 38 Q52 32 54 42 Q46 42 38 38" fill="#00e676"/>
  <rect x="24" y="28" width="16" height="5" rx="1" fill="#ff1744"/>
  <path d="M40 31 L48 37 L44 42 L38 33 Z" fill="#d50000"/>
</svg>`,

  cherry: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="cherryGrad1" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#ff5252"/>
      <stop offset="50%" stop-color="#d50000"/>
      <stop offset="100%" stop-color="#5b0000"/>
    </radialGradient>
  </defs>
  <path d="M36 12 Q30 24 22 38" stroke="#2e7d32" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M36 12 Q40 24 44 40" stroke="#2e7d32" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M36 12 Q46 8 52 14 Q44 18 36 12" fill="#4caf50"/>
  <circle cx="21" cy="42" r="12" fill="url(#cherryGrad1)"/>
  <ellipse cx="17" cy="37" rx="3.5" ry="2" fill="#ffffff" opacity="0.65" transform="rotate(-30 17 37)"/>
  <circle cx="43" cy="44" r="12" fill="url(#cherryGrad1)"/>
  <ellipse cx="39" cy="39" rx="3.5" ry="2" fill="#ffffff" opacity="0.65" transform="rotate(-30 39 39)"/>
</svg>`
};

export function getSymbolDataUri(id: string): string {
  const svg = SYMBOL_SVGS[id] || SYMBOL_SVGS.cherry;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
