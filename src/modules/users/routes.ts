import { Router } from 'express'; import { requireAuth } from '../../middleware/auth.js'; import { validate } from '../../middleware/validate.js'; import { updateProfileSchema } from './schema.js'; import * as c from './controller.js';
const r=Router(); r.use(requireAuth); r.get('/me',c.me); r.patch('/me',validate(updateProfileSchema),c.update); export default r;
