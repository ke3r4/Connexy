import { tokens } from '../theme/tokens';
import type { CSSProperties, ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
  activeNav: string;
  onNavigate: (route: string) => void;
}

const navItems = [
  { id: 'projects', label: 'Projects', icon: '[]' },
  { id: 'connectors', label: 'Connectors', icon: '>' },
  { id: 'catalogue', label: 'Catalogue', icon: '#' },
  { id: 'lineage', label: 'Lineage', icon: '~' },
  { id: 'admin', label: 'Admin', icon: '*' },
];

export function AppShell({ children, activeNav, onNavigate }: AppShellProps) {
  const shellStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '60px 1fr',
    minHeight: '100vh',
    backgroundColor: tokens.color.bg0,
  };
  const sidebarStyle: CSSProperties = {
    backgroundColor: tokens.color.bg1,
    borderRight: `${tokens.border.hairline} ${tokens.color.line}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: tokens.spacing.lg,
    gap: tokens.spacing.md,
  };
  const logoStyle: CSSProperties = {
    fontFamily: tokens.fontFamily.mono,
    fontWeight: tokens.fontWeight.bold,
    fontSize: tokens.fontSize.lg,
    color: tokens.color.accent,
    marginBottom: tokens.spacing.lg,
  };
  const navItemStyle = (active: boolean): CSSProperties => ({
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.sm,
    color: active ? tokens.color.accent : tokens.color.text2,
    backgroundColor: active ? `${tokens.color.accent}12` : 'transparent',
    border: active ? `1px solid ${tokens.color.accent}40` : '1px solid transparent',
    fontFamily: tokens.fontFamily.mono,
    fontSize: tokens.fontSize.md,
    cursor: 'pointer',
    transition: `all ${tokens.transition.fast} ${tokens.transition.ease}`,
  });
  const contentStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  };

  return (
    <div style={shellStyle}>
      <nav style={sidebarStyle} aria-label="Main navigation">
        <div style={logoStyle}>C</div>
        {navItems.map(item => (
          <button
            key={item.id}
            style={navItemStyle(activeNav === item.id)}
            onClick={() => onNavigate(item.id)}
            title={item.label}
            aria-label={item.label}
            aria-current={activeNav === item.id ? 'page' : undefined}
          >
            {item.icon}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{
          fontSize: tokens.fontSize.xs,
          color: tokens.color.text2,
          fontFamily: tokens.fontFamily.mono,
          textAlign: 'center',
          padding: `${tokens.spacing.xs} 0`,
          maxWidth: '60px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }} title={localStorage.getItem('connexy_user_email') || ''}>
          {(localStorage.getItem('connexy_user_role') || '').charAt(0).toUpperCase()}
        </div>
        <button
          style={{ ...navItemStyle(false), color: tokens.color.text2 }}
          onClick={() => {
            localStorage.removeItem('connexy_token');
            localStorage.removeItem('connexy_tenant_id');
            localStorage.removeItem('connexy_user_email');
            localStorage.removeItem('connexy_user_name');
            localStorage.removeItem('connexy_user_role');
            window.location.reload();
          }}
          title={`Sign out (${localStorage.getItem('connexy_user_email') || ''})`}
          aria-label="Sign out"
        >
          {'<'}
        </button>
      </nav>
      <div style={contentStyle}>{children}</div>
    </div>
  );
}

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  const topBarStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${tokens.spacing.lg} ${tokens.spacing.xl}`,
    borderBottom: `${tokens.border.hairline} ${tokens.color.line}`,
    backgroundColor: tokens.color.bg1,
  };
  return (
    <header style={topBarStyle}>
      <div>
        <h1 style={{ fontSize: tokens.fontSize.lg, fontWeight: tokens.fontWeight.semibold, color: tokens.color.text0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: tokens.fontSize.sm, color: tokens.color.text1, marginTop: tokens.spacing.xs }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: tokens.spacing.sm }}>{actions}</div>}
    </header>
  );
}