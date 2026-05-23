import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

interface ValidateOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidateOptions) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: Array<{ path: string; message: string }> = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.push(...formatZodErrors(result.error, "body"));
      } else {
        req.body = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.push(...formatZodErrors(result.error, "query"));
      } else {
        (req as any).query = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.push(...formatZodErrors(result.error, "params"));
      } else {
        (req as any).params = result.data;
      }
    }

    if (errors.length > 0) {
      return _res.status(422).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        errors,
      });
    }

    next();
  };
}

function formatZodErrors(
  error: ZodError,
  location: string
): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: `${location}.${issue.path.join(".")}`,
    message: issue.message,
  }));
}
