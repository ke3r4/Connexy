import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../env.js';
import { AuthenticationError, AuthorizationError } from '@connexy/shared';

export interface SSOConfig {
  provider: 'oidc' | 'saml';
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface SSOUser {
  subject: string;
  email: string;
  name: string;
  groups: string[];
  tenantId: string;
  role: string;
}

export class SSOProvider {
  constructor(private config: SSOConfig) {}

  getAuthorizationUrl(state: string): string {
    if (this.config.provider === 'oidc') {
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        redirect_uri: this.config.redirectUri,
        response_type: 'code',
        scope: this.config.scopes.join(' '),
        state,
      });
      return `${this.config.issuer}/authorize?${params}`;
    }
    // SAML would redirect to IdP with SAMLRequest
    return `${this.config.issuer}/saml/login?RelayState=${state}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string; idToken: string; refreshToken?: string }> {
    if (this.config.provider === 'oidc') {
      const response = await fetch(`${this.config.issuer}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.config.redirectUri,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });
      if (!response.ok) {
        throw new AuthenticationError(`SSO token exchange failed: ${response.status}`);
      }
      const data = await response.json() as { access_token: string; id_token: string; refresh_token?: string };
      return { accessToken: data.access_token, idToken: data.id_token, refreshToken: data.refresh_token };
    }
    // SAML would process the SAMLResponse
    throw new AuthenticationError('SAML callback not implemented in this path');
  }

  async getUserInfo(accessToken: string): Promise<SSOUser> {
    if (this.config.provider === 'oidc') {
      const response = await fetch(`${this.config.issuer}/userinfo`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new AuthenticationError(`SSO userinfo failed: ${response.status}`);
      }
      const info = await response.json() as {
        sub: string; email: string; name: string; groups?: string[];
      };
      return {
        subject: info.sub,
        email: info.email,
        name: info.name,
        groups: info.groups || [],
        tenantId: this.extractTenantFromEmail(info.email),
        role: this.mapGroupsToRole(info.groups || []),
      };
    }
    throw new AuthenticationError('SAML userinfo not implemented');
  }

  private extractTenantFromEmail(email: string): string {
    const domain = email.split('@')[1];
    return domain || 'default';
  }

  private mapGroupsToRole(groups: string[]): string {
    if (groups.includes('connexy-admin')) return 'admin';
    if (groups.includes('connexy-architect')) return 'architect';
    if (groups.includes('connexy-engineer')) return 'engineer';
    if (groups.includes('connexy-reviewer')) return 'reviewer';
    return 'viewer';
  }
}

export function createSSOMiddleware(config: SSOConfig): { provider: SSOProvider; middleware: MiddlewareHandler<AppContext> } {
  const provider = new SSOProvider(config);
  const middleware: MiddlewareHandler<AppContext> = async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing Authorization header');
    }
    const token = authHeader.slice(7);
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          throw new AuthenticationError('Token expired');
        }
        c.set('userId', payload.sub);
        c.set('tenantId', payload.tid || payload.tenantId || 'default');
        c.set('userRole', payload.role || 'viewer');
      } else {
        const user = await provider.getUserInfo(token);
        c.set('userId', user.subject);
        c.set('tenantId', user.tenantId);
        c.set('userRole', user.role);
      }
    } catch (err) {
      if (err instanceof AuthenticationError) throw err;
      throw new AuthenticationError('Invalid token');
    }
    await next();
  };
  return { provider, middleware };
}