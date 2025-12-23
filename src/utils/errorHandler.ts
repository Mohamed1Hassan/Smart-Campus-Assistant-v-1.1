/**
 * Enhanced error handling utilities
 * Provides comprehensive error management with user-friendly messages and recovery options
 */

export enum ErrorType {
  NETWORK = 'NETWORK',
  API = 'API',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
  COMPONENT = 'COMPONENT',
  FORM = 'FORM',
  CHART = 'CHART',
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface ErrorContext {
  componentStack?: string;
  retryCount?: number;
  userId?: string;
  timestamp?: Date;
  url?: string;
  userAgent?: string;
  [key: string]: any;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: Date;
  public readonly context: ErrorContext;
  public readonly retryable: boolean;
  public readonly userMessage: string;
  public readonly recoveryAction?: string;

  constructor(
    message: string,
    code: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: ErrorContext = {},
    retryable: boolean = false,
    userMessage?: string,
    recoveryAction?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.type = type;
    this.severity = severity;
    this.timestamp = new Date();
    this.context = context;
    this.retryable = retryable;
    this.userMessage = userMessage || this.getDefaultUserMessage();
    this.recoveryAction = recoveryAction;
  }

  private getDefaultUserMessage(): string {
    switch (this.type) {
      case ErrorType.NETWORK:
        return 'Unable to connect to the server. Please check your internet connection.';
      case ErrorType.API:
        return 'There was an error processing your request. Please try again.';
      case ErrorType.VALIDATION:
        return 'Please check your input and try again.';
      case ErrorType.AUTHENTICATION:
        return 'Your session has expired. Please log in again.';
      case ErrorType.AUTHORIZATION:
        return 'You do not have permission to perform this action.';
      case ErrorType.NOT_FOUND:
        return 'The requested resource was not found.';
      case ErrorType.SERVER:
        return 'The server is experiencing issues. Please try again later.';
      case ErrorType.TIMEOUT:
        return 'The request timed out. Please try again.';
      case ErrorType.COMPONENT:
        return 'There was an error loading this component.';
      case ErrorType.FORM:
        return 'There was an error with the form. Please check your input.';
      case ErrorType.CHART:
        return 'Unable to load the chart. Please try refreshing the page.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      type: this.type,
      severity: this.severity,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      retryable: this.retryable,
      userMessage: this.userMessage,
      recoveryAction: this.recoveryAction,
      stack: this.stack,
    };
  }
}

// Error factory functions
export const createNetworkError = (message: string, context: ErrorContext = {}): AppError => {
  return new AppError(
    message,
    'NETWORK_ERROR',
    ErrorType.NETWORK,
    ErrorSeverity.HIGH,
    context,
    true,
    'Unable to connect to the server. Please check your internet connection.',
    'Check your internet connection and try again'
  );
};

export const createAPIError = (message: string, statusCode: number, context: ErrorContext = {}): AppError => {
  const severity = statusCode >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
  const retryable = statusCode >= 500 || statusCode === 429;

  return new AppError(
    message,
    `API_ERROR_${statusCode}`,
    ErrorType.API,
    severity,
    { ...context, statusCode },
    retryable,
    getAPIErrorMessage(statusCode),
    retryable ? 'Try again' : undefined
  );
};

export const createValidationError = (message: string, field?: string, context: ErrorContext = {}): AppError => {
  return new AppError(
    message,
    'VALIDATION_ERROR',
    ErrorType.VALIDATION,
    ErrorSeverity.LOW,
    { ...context, field },
    false,
    'Please check your input and try again.',
    'Review the highlighted fields'
  );
};

export const createAuthError = (message: string, context: ErrorContext = {}): AppError => {
  return new AppError(
    message,
    'AUTH_ERROR',
    ErrorType.AUTHENTICATION,
    ErrorSeverity.HIGH,
    context,
    false,
    'Your session has expired. Please log in again.',
    'Log in again'
  );
};

export const createTimeoutError = (message: string, timeout: number, context: ErrorContext = {}): AppError => {
  return new AppError(
    message,
    'TIMEOUT_ERROR',
    ErrorType.TIMEOUT,
    ErrorSeverity.MEDIUM,
    { ...context, timeout },
    true,
    'Try again'
  );
};

export const createSecurityError = (message: string, context: ErrorContext = {}): AppError => {
  return new AppError(
    message,
    'SECURITY_ERROR',
    ErrorType.AUTHORIZATION,
    ErrorSeverity.HIGH,
    context,
    false,
    'A security check failed. Please refresh the page and try again.',
    'Refresh verification'
  );
};

// Helper function to get user-friendly API error messages
function getAPIErrorMessage(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'You are not authorized. Please log in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'There is a conflict with the current state.';
    case 422:
      return 'The request was well-formed but contains invalid data.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'The server encountered an error. Please try again later.';
    case 502:
      return 'The server is temporarily unavailable. Please try again later.';
    case 503:
      return 'The service is temporarily unavailable. Please try again later.';
    case 504:
      return 'The request timed out. Please try again.';
    default:
      return 'An error occurred while processing your request.';
  }
}

// Error boundary fallback configuration
export interface ErrorFallback {
  title: string;
  message: string;
  retryable: boolean;
  actions: Array<{
    label: string;
    action: () => void;
    primary?: boolean;
  }>;
}

export const getErrorBoundaryFallback = (error: Error, onRetry: () => void): ErrorFallback => {
  if (error instanceof AppError) {
    return {
      title: getErrorTitle(error.type),
      message: error.userMessage,
      retryable: error.retryable,
      actions: [
        ...(error.retryable ? [{
          label: 'Try Again',
          action: onRetry,
          primary: true,
        }] : []),
        {
          label: 'Reload Page',
          action: () => window.location.reload(),
        },
        {
          label: 'Go Back',
          action: () => window.history.back(),
        },
      ],
    };
  }

  return {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
    retryable: true,
    actions: [
      {
        label: 'Try Again',
        action: onRetry,
        primary: true,
      },
      {
        label: 'Reload Page',
        action: () => window.location.reload(),
      },
    ],
  };
};

function getErrorTitle(type: ErrorType): string {
  switch (type) {
    case ErrorType.NETWORK:
      return 'Connection Error';
    case ErrorType.API:
      return 'Server Error';
    case ErrorType.VALIDATION:
      return 'Validation Error';
    case ErrorType.AUTHENTICATION:
      return 'Authentication Error';
    case ErrorType.AUTHORIZATION:
      return 'Access Denied';
    case ErrorType.NOT_FOUND:
      return 'Not Found';
    case ErrorType.SERVER:
      return 'Server Error';
    case ErrorType.TIMEOUT:
      return 'Request Timeout';
    case ErrorType.COMPONENT:
      return 'Component Error';
    case ErrorType.FORM:
      return 'Form Error';
    case ErrorType.CHART:
      return 'Chart Error';
    default:
      return 'Error';
  }
}

// Error reporting
export const reportError = (error: Error, context: ErrorContext = {}) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    ...context,
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error reported:', errorData);
  }

  // In production, you would send this to an error reporting service
  // like Sentry, LogRocket, or Bugsnag
  if (process.env.NODE_ENV === 'production') {
    // Example: Sentry.captureException(error, { extra: context });
    console.error('Production error:', errorData);
  }
};

// Retry utility with exponential backoff
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * delay;
      const totalDelay = delay + jitter;

      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }

  throw lastError!;
};

// Error recovery strategies
export const ErrorRecoveryStrategies = {
  retry: (fn: () => Promise<any>, maxRetries: number = 3) => {
    return retryWithBackoff(fn, maxRetries);
  },

  fallback: <T>(fn: () => Promise<T>, fallbackValue: T) => {
    return async (): Promise<T> => {
      try {
        return await fn();
      } catch {
        return fallbackValue;
      }
    };
  },

  cache: <T>(fn: () => Promise<T>, cacheKey: string, ttl: number = 300000) => {
    return async (): Promise<T> => {
      try {
        const result = await fn();
        localStorage.setItem(cacheKey, JSON.stringify({
          data: result,
          timestamp: Date.now(),
        }));
        return result;
      } catch (error) {
        // Try to get from cache
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < ttl) {
            return data;
          }
        }
        throw error;
      }
    };
  },
};

export default AppError;