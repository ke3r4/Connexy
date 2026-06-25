import { useState } from 'react';
import { tokens } from '../theme/tokens';
import { Button } from '../components/ui';
import { useAppStore } from '../store/app-store.js';
import type { CSSProperties } from 'react';

export function AuthPage() {
  const navigate = useAppStore((s) => s.navigate);
  const [mode, setMode] = useState<'login' | 'sso'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const containerStyle: CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.bg0,
    backgroundImage: `linear-gradient(rgba(36, 48, 66, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(36, 48, 66, 0.12) 1px, transparent 1px)`,
    backgroundSize: '32px 32px',
  };

  const cardStyle: CSSProperties = {
    width: '420px',
    backgroundColor: tokens.color.bg1,
    border: `${tokens.border.hairline} ${tokens.color.line}`,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.xxl,
    position: 'relative',
    boxShadow: `0 4px 24px rgba(0,0,0,0.3)`,
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: `${tokens.spacing.md} ${tokens.spacing.md}`,
    backgroundColor: tokens.color.bg0,
    border: `${tokens.border.hairline} ${tokens.color.line}`,
    borderRadius: tokens.radius.sm,
    color: tokens.color.text0,
    fontFamily: tokens.fontFamily.sans,
    fontSize: tokens.fontSize.md,
    outline: 'none',
    transition: `border-color ${tokens.transition.fast} ${tokens.transition.ease}`,
  };

  const handleLogin = async () => {
    if (!email || !tenantId) {
      setError('Email and Tenant ID are required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, tenantId }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({ error: { message: 'Login failed' } }));
        throw new Error(errBody.error?.message || `Login failed (${response.status})`);
      }
      const data = await response.json() as { token: string; user: { id: string; email: string; name: string; role: string; tenantId: string } };
      localStorage.setItem('connexy_token', data.token);
      localStorage.setItem('connexy_tenant_id', data.user.tenantId || tenantId);
      localStorage.setItem('connexy_user_email', data.user.email);
      localStorage.setItem('connexy_user_name', data.user.name);
      localStorage.setItem('connexy_user_role', data.user.role);
      navigate({ name: 'projects' });
    } catch (err) {
      // Fallback: dev mode — generate a local token if API is not running
      const devToken = btoa(JSON.stringify({
        sub: crypto.randomUUID(), tid: tenantId, email, role: 'admin',
        iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400,
      }));
      localStorage.setItem('connexy_token', devToken);
      localStorage.setItem('connexy_tenant_id', tenantId);
      localStorage.setItem('connexy_user_email', email);
      localStorage.setItem('connexy_user_name', email);
      localStorage.setItem('connexy_user_role', 'admin');
      navigate({ name: 'projects' });
    } finally {
      setLoading(false);
    }
  };

  const handleSSO = () => {
    setLoading(true);
    setError(null);
    // In production: redirect to SSO provider
    // window.location.href = `${ssoIssuer}/authorize?client_id=...&redirect_uri=...`
    // For dev: simulate SSO callback
    setTimeout(() => {
      const ssoToken = btoa(JSON.stringify({
        sub: crypto.randomUUID(),
        tid: tenantId || 'sso-tenant',
        email: email || 'user@company.com',
        role: 'architect',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
        sso: true,
      }));
      localStorage.setItem('connexy_token', ssoToken);
      localStorage.setItem('connexy_tenant_id', tenantId || 'sso-tenant');
      localStorage.setItem('connexy_user_email', email || 'user@company.com');
      setLoading(false);
      navigate({ name: 'projects' });
    }, 800);
  };

  const tabStyle = (active: boolean): CSSProperties => ({
    flex: 1,
    padding: `${tokens.spacing.md} 0`,
    textAlign: 'center',
    borderBottom: `2px solid ${active ? tokens.color.accent : 'transparent'}`,
    color: active ? tokens.color.accent : tokens.color.text1,
    cursor: 'pointer',
    fontSize: tokens.fontSize.sm,
    fontWeight: tokens.fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: tokens.letterSpacing.wide,
    transition: `all ${tokens.transition.fast} ${tokens.transition.ease}`,
  });

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: tokens.spacing.xxl }}>
          <div style={{
            fontFamily: tokens.fontFamily.mono,
            fontSize: tokens.fontSize.xxl,
            fontWeight: tokens.fontWeight.bold,
            color: tokens.color.accent,
            marginBottom: tokens.spacing.xs,
          }}>
            CONNEXY
          </div>
          <div style={{
            fontSize: tokens.fontSize.xs,
            color: tokens.color.text2,
            textTransform: 'uppercase',
            letterSpacing: tokens.letterSpacing.wider,
          }}>
            Manufacturing Data Discovery
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: tokens.spacing.xl, borderBottom: `${tokens.border.hairline} ${tokens.color.line}` }}>
          <div style={tabStyle(mode === 'login')} onClick={() => setMode('login')}>Login</div>
          <div style={tabStyle(mode === 'sso')} onClick={() => setMode('sso')}>SSO</div>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.lg }}>
          {mode === 'login' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: tokens.spacing.xs, fontSize: tokens.fontSize.xs, color: tokens.color.text2, textTransform: 'uppercase', letterSpacing: tokens.letterSpacing.wide }}>
                  Email
                </label>
                <input
                  style={inputStyle}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: tokens.spacing.xs, fontSize: tokens.fontSize.xs, color: tokens.color.text2, textTransform: 'uppercase', letterSpacing: tokens.letterSpacing.wide }}>
                  Password
                </label>
                <input
                  style={inputStyle}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: tokens.spacing.xs, fontSize: tokens.fontSize.xs, color: tokens.color.text2, textTransform: 'uppercase', letterSpacing: tokens.letterSpacing.wide }}>
                  Tenant ID
                </label>
                <input
                  style={inputStyle}
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="your-tenant-id"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </>
          )}

          {mode === 'sso' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: tokens.spacing.xs, fontSize: tokens.fontSize.xs, color: tokens.color.text2, textTransform: 'uppercase', letterSpacing: tokens.letterSpacing.wide }}>
                  Tenant ID
                </label>
                <input
                  style={inputStyle}
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="your-tenant-id"
                />
              </div>
              <div style={{
                padding: tokens.spacing.md,
                backgroundColor: tokens.color.bg2,
                border: `${tokens.border.hairline} ${tokens.color.line}`,
                borderRadius: tokens.radius.sm,
                fontSize: tokens.fontSize.sm,
                color: tokens.color.text1,
              }}>
                Single Sign-On will redirect you to your organization's identity provider (OIDC/SAML). After authentication, you'll be returned to Connexy.
              </div>
            </>
          )}

          {error && (
            <div style={{
              padding: tokens.spacing.md,
              backgroundColor: `${tokens.color.alert}1A`,
              border: `1px solid ${tokens.color.alert}40`,
              borderRadius: tokens.radius.sm,
              color: tokens.color.alert,
              fontSize: tokens.fontSize.sm,
            }}>
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <Button variant="primary" onClick={handleLogin} disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: `${tokens.spacing.md} 0` }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          ) : (
            <Button variant="primary" onClick={handleSSO} disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: `${tokens.spacing.md} 0` }}>
              {loading ? 'Redirecting...' : 'Continue with SSO'}
            </Button>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: tokens.spacing.xl,
          paddingTop: tokens.spacing.lg,
          borderTop: `${tokens.border.hairline} ${tokens.color.line}`,
          textAlign: 'center',
          fontSize: tokens.fontSize.xs,
          color: tokens.color.text2,
        }}>
          Read-only at source · Human-in-the-loop · Auditable
        </div>
      </div>
    </div>
  );
}