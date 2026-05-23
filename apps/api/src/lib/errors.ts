export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad request") {
    super(message, 400, "BAD_REQUEST");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource conflict") {
    super(message, 409, "CONFLICT");
  }
}

export class ConflictWithSuggestionsError extends ConflictError {
  public readonly suggestions: Array<{ startTime: string; endTime: string }>;

  constructor(
    message: string,
    suggestions: Array<{ startTime: string; endTime: string }>
  ) {
    super(message);
    this.suggestions = suggestions;
    Object.setPrototypeOf(this, ConflictWithSuggestionsError.prototype);
  }
}

export class ValidationError extends AppError {
  public readonly errors: Array<{ path: string; message: string }>;

  constructor(errors: Array<{ path: string; message: string }>) {
    super("Validation failed", 422, "VALIDATION_ERROR");
    this.errors = errors;
  }
}
