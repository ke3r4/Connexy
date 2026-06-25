export const tokens = {
  color: {
    bg0: '#0A0E14',
    bg1: '#0F141C',
    bg2: '#161D28',
    line: '#243042',
    accent: '#34E5FF',
    accent2: '#6C5CE7',
    ok: '#2BD9A6',
    warn: '#F4B740',
    alert: '#FF5C7A',
    text0: '#E8EEF5',
    text1: '#9FB0C3',
    text2: '#5E6E82',
    // Light theme
    lightBg0: '#F8FAFC',
    lightBg1: '#FFFFFF',
    lightBg2: '#F1F5F9',
    lightLine: '#E2E8F0',
    lightText0: '#0F172A',
    lightText1: '#475569',
    lightText2: '#94A3B8',
  },
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  fontSize: {
    xs: '11px',
    sm: '13px',
    md: '15px',
    lg: '18px',
    xl: '24px',
    xxl: '32px',
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  fontFamily: {
    sans: "'Inter', 'IBM Plex Sans', -apple-system, sans-serif",
    mono: "'JetBrains Mono', 'IBM Plex Mono', monospace",
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.625,
  },
  letterSpacing: {
    wide: '0.05em',
    wider: '0.1em',
    widest: '0.15em',
  },
  transition: {
    fast: '150ms',
    normal: '200ms',
    slow: '250ms',
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  border: {
    hairline: '1px solid',
  },
  shadow: {
    none: 'none',
    subtle: '0 1px 2px rgba(0,0,0,0.2)',
    card: '0 2px 8px rgba(0,0,0,0.15)',
    raised: '0 4px 12px rgba(0,0,0,0.25)',
  },
  zIndex: {
    base: 0,
    dropdown: 100,
    drawer: 200,
    modal: 300,
    toast: 400,
  },
} as const;

export type Tokens = typeof tokens;
export type ColorToken = keyof typeof tokens.color;
export type SpacingToken = keyof typeof tokens.spacing;
export type FontSizeToken = keyof typeof tokens.fontSize;

export function confidenceColor(score: number): string {
  if (score >= 0.8) return tokens.color.ok;
  if (score >= 0.6) return tokens.color.warn;
  return tokens.color.alert;
}

export function confidenceLabel(score: number): string {
  if (score >= 0.8) return 'HIGH';
  if (score >= 0.6) return 'MEDIUM';
  return 'LOW';
}