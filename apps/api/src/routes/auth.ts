import { Hono } from 'hono';
import type { AppContext } from '../env.js';
import { ValidationError, AuthenticationError } from '@connexy/shared';

export const authRoutes = new Hono<AppContext>();

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { email, password, tenantId } = body;

  if (!email || !tenantId) {
    throw new ValidationError('Email and tenantId are required');
  }

  // Look up user in D1
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE tenant_id = ? AND email = ?',
  ).bind(tenantId, email).first() as Record<string, unknown> | null;

  if (!user) {
    throw new AuthenticationError('Invalid credentials');
  }

  // In production: verify password hash with bcrypt/argon2
  // For now: accept any non-empty password in dev mode
  if (c.env.ENVIRONMENT !== 'development' && !password) {
    throw new AuthenticationError('Password required');
  }

  // Generate JWT
  const payload = {
    sub: user.id,
    tid: user.tenant_id,
    email: user.email,
    name: user.name,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '');
  const signature = await signJWT(`${headerB64}.${payloadB64}`, c.env.JWT_SECRET || 'dev-secret');
  const token = `${headerB64}.${payloadB64}.${signature}`;

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenant_id,
    },
  });
});

authRoutes.post('/sso/callback', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { code, state } = body;

  if (!code) {
    throw new ValidationError('SSO code is required');
  }

  // In production: exchange code with IdP, get userinfo
  // For now: create/lookup user from SSO attributes
  const { tenantId, email, name, groups } = body;
  if (!tenantId || !email) {
    throw new ValidationError('tenantId and email are required for SSO callback');
  }

  let user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE tenant_id = ? AND email = ?',
  ).bind(tenantId, email).first() as Record<string, unknown> | null;

  if (!user) {
    // Auto-provision SSO user
    const role = mapGroupsToRole(groups || []);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      'INSERT INTO users (id, tenant_id, email, name, role, sso_subject, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(id, tenantId, email, name || email, role, email, now, now).run();
    user = { id, tenant_id: tenantId, email, name: name || email, role };
  }

  const payload = {
    sub: user.id,
    tid: user.tenant_id,
    email: user.email,
    name: user.name,
    role: user.role,
    sso: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  };

  const headerB64 = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '');
  const signature = await signJWT(`${headerB64}.${payloadB64}`, c.env.JWT_SECRET || 'dev-secret');

  return c.json({
    token: `${headerB64}.${payloadB64}.${signature}`,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenant_id },
  });
});

authRoutes.get('/me', async (c) => {
  const userId = c.get('userId');
  const tenantId = c.get('tenantId');
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, tenant_id FROM users WHERE id = ? AND tenant_id = ?',
  ).bind(userId, tenantId).first();
  if (!user) throw new AuthenticationError('User not found');
  return c.json({ user });
});

function mapGroupsToRole(groups: string[]): string {
  if (groups.includes('connexy-admin')) return 'admin';
  if (groups.includes('connexy-architect')) return 'architect';
  if (groups.includes('connexy-engineer')) return 'engineer';
  if (groups.includes('connexy-reviewer')) return 'reviewer';
  return 'viewer';
}

async function signJWT(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}