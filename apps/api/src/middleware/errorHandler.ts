import { Request, Response, NextFunction } from "express";
import { AppError, ValidationError, ConflictWithSuggestionsError } from "../lib/errors";
import { Prisma } from "@prisma/client";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      errors: err.errors,
    });
  }

  if (err instanceof ConflictWithSuggestionsError) {
    return res.status(409).json({
      success: false,
      code: err.code,
      message: err.message,
      suggestions: err.suggestions,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        code: "UNIQUE_CONSTRAINT",
        message: "A record with this value already exists",
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Record not found",
      });
    }
  }

  console.error("Unhandled error:", err);

  return res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "An unexpected error occurred",
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: "Route not found",
  });
}
