import {RequestHandler} from 'express'; import * as s from './service.js'; export const analytics:RequestHandler=async(_req,res)=>res.json({data:await s.analytics()});
