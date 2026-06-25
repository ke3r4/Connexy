import { tokens, confidenceColor, confidenceLabel } from '../theme/tokens';
import type { CSSProperties } from 'react';

interface ConfidenceChipProps {
  score: number;
  size?: 'sm' | 'md';
}

export function ConfidenceChip({ score, size = 'sm' }: ConfidenceChipProps) {
  const color = confidenceColor(score);
  const label = confidenceLabel(score);
  const fontSize = size === 'sm' ? tokens.fontSize.xs : tokens.fontSize.sm;
  const padding = size === 'sm' ? `${tokens.spacing.xs} ${tokens.spacing.sm}` : `${tokens.spacing.sm} ${tokens.spacing.md}`;

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    fontFamily: tokens.fontFamily.mono,
    fontSize,
    fontWeight: tokens.fontWeight.semibold,
    padding,
    borderRadius: tokens.radius.sm,
    border: `1px solid ${color}40`,
    backgroundColor: `${color}12`,
    color,
    letterSpacing: tokens.letterSpacing.wide,
  };

  return (
    <span style={style} role="status" aria-label={`Confidence ${label}, score ${score.toFixed(2)}`}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: color }} />
      {score.toFixed(2)}
    </span>
  );
}