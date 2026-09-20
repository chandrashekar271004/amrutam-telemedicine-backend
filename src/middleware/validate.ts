import { RequestHandler } from 'express';
import { ZodType } from 'zod';

type ValidatedRequest = {
  body?: unknown;
  params?: unknown;
  query?: unknown;
};

export const validate = (schema: ZodType): RequestHandler => (
  req,
  _res,
  next,
) => {
  try {
    const parsed = schema.parse({
      body: req.body ?? {},
      params: req.params ?? {},
      query: req.query ?? {},
    }) as ValidatedRequest;

    if (parsed.body !== undefined) {
      req.body = parsed.body;
    }

    if (parsed.params !== undefined) {
      req.params = parsed.params as Record<string, string>;
    }

    // Do not assign to req.query.
    // Express exposes req.query as a getter-only property.
    next();
  } catch (error) {
    next(error);
  }
};
