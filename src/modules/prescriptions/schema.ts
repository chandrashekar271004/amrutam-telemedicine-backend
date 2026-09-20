import {z} from 'zod';
const medicine=z.object({name:z.string().min(1).max(120),dosage:z.string().max(120),frequency:z.string().max(120),duration:z.string().max(120),instructions:z.string().max(500).optional()});
export const createSchema=z.object({body:z.object({medicines:z.array(medicine).min(1).max(30),instructions:z.string().max(2000).optional()}),params:z.object({consultationId:z.string().uuid()}),query:z.object({})});
