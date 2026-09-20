import { z } from 'zod';
export const createSlotsSchema=z.object({body:z.object({startsAt:z.string().datetime(),endsAt:z.string().datetime()}),params:z.object({doctorId:z.string().uuid()}),query:z.object({})});
export const listSlotsSchema=z.object({body:z.object({}),params:z.object({doctorId:z.string().uuid()}),query:z.object({from:z.string().datetime(),to:z.string().datetime()})});
