import {RequestHandler} from 'express'; import * as s from './service'; export const analytics:RequestHandler=async(_req,res)=>res.json({data:await s.analytics()});
