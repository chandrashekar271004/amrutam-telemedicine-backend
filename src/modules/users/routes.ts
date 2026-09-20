import { Router } from 'express'; import { requireAuth } from '../../middleware/auth'; import { validate } from '../../middleware/validate'; import { updateProfileSchema } from './schema'; import * as c from './controller';
const r=Router(); r.use(requireAuth); r.get('/me',c.me); r.patch('/me',validate(updateProfileSchema),c.update); export default r;
