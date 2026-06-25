import { tokens } from '../theme/tokens';
import type { CSSProperties, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  raised?: boolean;
  style?: CSSProperties;
}

export function Card({ children, raised = false, style }: CardProps) {
  const cardStyle: CSSProperties = {
    backgroundColor: raised ? tokens.color.bg2 : tokens.color.bg1,
    border: `${tokens.border.hairline} ${tokens.color.line}`,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.lg,
    position: 'relative',
    ...style,
  };
  const highlightStyle: CSSProperties = raised
    ? { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${tokens.color.line}, transparent)` }
    : {};
  return (
    <div style={cardStyle} data-raised={raised}>
      {raised && <div style={highlightStyle} />}
      {children}
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'accent' | 'ok' | 'warn' | 'alert';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const colorMap = {
    default: tokens.color.text1,
    accent: tokens.color.accent,
    ok: tokens.color.ok,
    warn: tokens.color.warn,
    alert: tokens.color.alert,
  };
  const color = colorMap[variant];
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: tokens.fontSize.xs,
    fontWeight: tokens.fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: tokens.letterSpacing.wide,
    padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
    borderRadius: tokens.radius.sm,
    border: `1px solid ${color}40`,
    color: color,
    backgroundColor: `${color}0D`,
  };
  return <span style={style}>{children}</span>;
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
  style?: CSSProperties;
}

export function Button({ children, onClick, variant = 'secondary', disabled, type = 'button', style }: ButtonProps) {
  const variantStyles: Record<string, CSSProperties> = {
    primary: {
      backgroundColor: tokens.color.accent,
      color: tokens.color.bg0,
      fontWeight: tokens.fontWeight.semibold,
    },
    secondary: {
      backgroundColor: 'transparent',
      color: tokens.color.text0,
      border: `${tokens.border.hairline} ${tokens.color.line}`,
    },
    ghost: {
      backgroundColor: 'transparent',
      color: tokens.color.text1,
    },
    danger: {
      backgroundColor: `${tokens.color.alert}1A`,
      color: tokens.color.alert,
      border: `${tokens.border.hairline} ${tokens.color.alert}40`,
    },
  };
  const buttonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    borderRadius: tokens.radius.sm,
    fontSize: tokens.fontSize.sm,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: `all ${tokens.transition.fast} ${tokens.transition.ease}`,
    ...variantStyles[variant],
    ...style,
  };
  return (
    <button onClick={onClick} disabled={disabled} type={type} style={buttonStyle}>
      {children}
    </button>
  );
}