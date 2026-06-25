import { tokens } from './tokens';

export const globalStyles = `
:root {
  --bg-0: ${tokens.color.bg0};
  --bg-1: ${tokens.color.bg1};
  --bg-2: ${tokens.color.bg2};
  --line: ${tokens.color.line};
  --accent: ${tokens.color.accent};
  --accent-2: ${tokens.color.accent2};
  --ok: ${tokens.color.ok};
  --warn: ${tokens.color.warn};
  --alert: ${tokens.color.alert};
  --text-0: ${tokens.color.text0};
  --text-1: ${tokens.color.text1};
  --text-2: ${tokens.color.text2};
  --radius-sm: ${tokens.radius.sm};
  --radius-md: ${tokens.radius.md};
  --radius-lg: ${tokens.radius.lg};
  --font-sans: ${tokens.fontFamily.sans};
  --font-mono: ${tokens.fontFamily.mono};
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  background-color: var(--bg-0);
  color: var(--text-0);
  font-family: var(--font-sans);
  font-size: ${tokens.fontSize.md};
  line-height: ${tokens.lineHeight.normal};
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

a {
  color: var(--accent);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

button {
  font-family: inherit;
  cursor: pointer;
  border: none;
  background: none;
  color: inherit;
}

input, textarea, select {
  font-family: inherit;
  font-size: inherit;
  background: var(--bg-1);
  border: 1px solid var(--line);
  color: var(--text-0);
  border-radius: var(--radius-sm);
  padding: ${tokens.spacing.sm} ${tokens.spacing.md};
  outline: none;
}

input:focus, textarea:focus, select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.mono {
  font-family: var(--font-mono);
}

.micro-label {
  font-size: ${tokens.fontSize.xs};
  text-transform: uppercase;
  letter-spacing: ${tokens.letterSpacing.wider};
  color: var(--text-2);
  font-weight: ${tokens.fontWeight.medium};
}

.blueprint-grid {
  background-image:
    linear-gradient(rgba(36, 48, 66, 0.15) 1px, transparent 1px),
    linear-gradient(90deg, rgba(36, 48, 66, 0.15) 1px, transparent 1px);
  background-size: 24px 24px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
`;