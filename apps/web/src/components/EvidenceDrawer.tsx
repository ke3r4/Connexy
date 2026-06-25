import { tokens } from '../theme/tokens';
import type { CSSProperties } from 'react';

export interface EvidenceItem {
  type: string;
  sourceRef: string;
  description: string;
  weight: number;
}

interface EvidenceDrawerProps {
  open: boolean;
  items: EvidenceItem[];
  onClose: () => void;
}

export function EvidenceDrawer({ open, items, onClose }: EvidenceDrawerProps) {
  const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: '420px',
    backgroundColor: tokens.color.bg1,
    borderLeft: `${tokens.border.hairline} ${tokens.color.line}`,
    transform: open ? 'translateX(0)' : 'translateX(100%)',
    transition: `transform ${tokens.transition.normal} ${tokens.transition.ease}`,
    zIndex: tokens.zIndex.drawer,
    display: 'flex',
    flexDirection: 'column',
  };
  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: tokens.spacing.lg,
    borderBottom: `${tokens.border.hairline} ${tokens.color.line}`,
  };
  const itemStyle: CSSProperties = {
    padding: tokens.spacing.md,
    borderBottom: `1px solid ${tokens.color.line}40`,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.xs,
  };

  return (
    <>
      {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: tokens.zIndex.drawer - 1 }} />}
      <aside style={overlayStyle} aria-hidden={!open}>
        <div style={headerStyle}>
          <span className="micro-label">Evidence Trail</span>
          <button onClick={onClose} style={{ color: tokens.color.text2, fontSize: tokens.fontSize.lg }} aria-label="Close evidence drawer">x</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {items.map((item, i) => (
            <div key={i} style={itemStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.accent, textTransform: 'uppercase', letterSpacing: tokens.letterSpacing.wide }}>
                  {item.type}
                </span>
                <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>
                  w={item.weight.toFixed(2)}
                </span>
              </div>
              <div style={{ color: tokens.color.text0 }}>{item.description}</div>
              <div style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>{item.sourceRef}</div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}