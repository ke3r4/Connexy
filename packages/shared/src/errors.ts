export class ConnexyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ConnexyError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details,
      },
    };
  }
}

export class ValidationError extends ConnexyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ConnexyError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ConnexyError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ConnexyError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404, { resource, id });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ConnexyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

export class ConnectorError extends ConnexyError {
  constructor(message: string, connectorType: string, details?: Record<string, unknown>) {
    super(message, 'CONNECTOR_ERROR', 502, { connectorType, ...details });
    this.name = 'ConnectorError';
  }
}

export class ModelRouterError extends ConnexyError {
  constructor(message: string, modelTier: string, details?: Record<string, unknown>) {
    super(message, 'MODEL_ROUTER_ERROR', 503, { modelTier, ...details });
    this.name = 'ModelRouterError';
  }
}

export class DataResidencyError extends ConnexyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DATA_RESIDENCY_VIOLATION', 403, details);
    this.name = 'DataResidencyError';
  }
}

export class ReadOnlyViolationError extends ConnexyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'READ_ONLY_VIOLATION', 403, details);
    this.name = 'ReadOnlyViolationError';
  }
}

export class WorkflowError extends ConnexyError {
  constructor(message: string, stage: string, details?: Record<string, unknown>) {
    super(message, 'WORKFLOW_ERROR', 500, { stage, ...details });
    this.name = 'WorkflowError';
  }
}

export class RateLimitError extends ConnexyError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT', 429);
    this.name = 'RateLimitError';
  }
}

export function toErrorResponse(error: unknown): { error: { code: string; message: string; statusCode: number; details?: Record<string, unknown> } } {
  if (error instanceof ConnexyError) {
    return error.toJSON();
  }
  const message = error instanceof Error ? error.message : 'Internal server error';
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message,
      statusCode: 500,
    },
  };
}