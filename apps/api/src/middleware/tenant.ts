import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../env.js';
import { AuthenticationError, DataResidencyError } from '@connexy/shared';

export const tenantMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
  const tenantId = c.req.header('X-Tenant-ID');
  const tokenTenantId = c.get('tenantId');

  if (!tenantId) {
    throw new AuthenticationError('Missing X-Tenant-ID header');
  }

  if (tokenTenantId && tokenTenantId !== tenantId) {
    throw new AuthenticationError('Tenant ID mismatch between token and header');
  }

  c.set('tenantId', tenantId);
  await next();
};

export function assertDataResidency(tenantRegion: string, modelEndpointRegion: string): void {
  if (tenantRegion !== 'custom' && tenantRegion !== modelEndpointRegion) {
    throw new DataResidencyError(
      `Data residency violation: tenant region (${tenantRegion}) does not match model endpoint region (${modelEndpointRegion})`,
      { tenantRegion, modelEndpointRegion },
    );
  }
}