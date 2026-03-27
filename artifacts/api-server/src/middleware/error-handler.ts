import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export function asyncHandler(
  fn: (req: Request<any, any, any, any>, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request<any, any, any, any>, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const error = err instanceof Error ? err : new Error(String(err));
  const status = (err as { status?: number; statusCode?: number }).status
    || (err as { statusCode?: number }).statusCode
    || 500;

  logger.error(
    {
      err: error,
      method: req.method,
      url: req.originalUrl,
      status,
    },
    `${req.method} ${req.originalUrl} error`,
  );

  if (res.headersSent) {
    next(error);
    return;
  }

  const body: { error: string; stack?: string } = {
    error: status >= 500 ? "Sunucu hatası" : error.message,
  };

  if (process.env.NODE_ENV === "development") {
    body.error = error.message;
    body.stack = error.stack;
  }

  res.status(status).json(body);
}
