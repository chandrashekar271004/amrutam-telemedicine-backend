import {z} from 'zod';
export const bookSchema=z.object({body:z.object({slotId:z.string().uuid(),reason:z.string().max(1000).optional()}),params:z.object({}),query:z.object({})});
export const statusSchema=z.object({body:z.object({status:z.enum(['IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW']),notes:z.string().max(5000).optional()}),params:z.object({id:z.string().uuid()}),query:z.object({})});
export const listSchema=z.object({body:z.object({}),params:z.object({}),query:z.object({status:z.enum(['SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW']).optional(),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(50).default(20)})});
