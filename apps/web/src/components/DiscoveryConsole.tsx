import { tokens } from '../theme/tokens';
import type { CSSProperties } from 'react';

export interface DiscoveryEvent {
  id: string;
  stage: string;
  type: string;
  message: string;
  timestamp: string;
}

interface DiscoveryConsoleProps {
  events: DiscoveryEvent[];
}

const stageColor: Record<string, string> = {
  plan: tokens.color.accent,
  ingest: tokens.color.accent,
  classify: tokens.color.accent2,
  map: tokens.color.accent2,
  model: tokens.color.accent2,
  score: tokens.color.warn,
  review: tokens.color.ok,
  export: tokens.color.ok,
};

export function DiscoveryConsole({ events }: DiscoveryConsoleProps) {
  const containerStyle: CSSProperties = {
    backgroundColor: tokens.color.bg0,
    border: `${tokens.border.hairline} ${tokens.color.line}`,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    maxHeight: '320px',
    overflowY: 'auto',
    fontFamily: tokens.fontFamily.mono,
    fontSize: tokens.fontSize.sm,
  };
  const lineStyle: CSSProperties = {
    display: 'flex',
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.xs} 0`,
    borderBottom: `1px solid ${tokens.color.line}20`,
  };

  return (
    <div style={containerStyle} role="log" aria-live="polite" aria-label="Discovery pipeline events">
      {events.length === 0 && (
        <div style={{ color: tokens.color.text2, fontStyle: 'italic' }}>No events. Pipeline idle.</div>
      )}
      {events.map(ev => {
        const color = stageColor[ev.stage] || tokens.color.text1;
        return (
          <div key={ev.id} style={lineStyle}>
            <span style={{ color: tokens.color.text2, flexShrink: 0 }}>{ev.timestamp.substring(11, 19)}</span>
            <span style={{ color, fontWeight: tokens.fontWeight.semibold, textTransform: 'uppercase', fontSize: tokens.fontSize.xs, letterSpacing: tokens.letterSpacing.wide, flexShrink: 0 }}>
              [{ev.stage}]
            </span>
            <span style={{ color: tokens.color.text1 }}>{ev.message}</span>
          </div>
        );
      })}
    </div>
  );
}