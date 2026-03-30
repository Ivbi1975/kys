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

  const requestId = req.headers["x-request-id"] as string | undefined;

  logger.error(
    {
      err: error,
      method: req.method,
      url: req.originalUrl,
      status,
      requestId,
    },
    `${req.method} ${req.originalUrl} error`,
  );

  if (res.headersSent) {
    next(error);
    return;
  }

  const body: { error: string; requestId?: string; stack?: string } = {
    error: status >= 500 ? "Sunucu hatası" : error.message,
  };

  if (requestId) {
    body.requestId = requestId;
  }

  if (process.env.NODE_ENV === "development") {
    body.error = error.message;
    body.stack = error.stack;
  }

  res.status(status).json(body);
}
