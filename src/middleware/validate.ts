import { RequestHandler } from 'express';
import { ZodType } from 'zod';

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
    });

    req.body = (parsed as any).body;
    req.params = (parsed as any).params;

    // Do not assign to req.query.
    // Express exposes req.query as a getter-only property.
    next();
  } catch (error) {
    next(error);
  }
};