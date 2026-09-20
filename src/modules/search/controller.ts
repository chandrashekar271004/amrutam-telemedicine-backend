import {RequestHandler} from 'express'; import * as s from './service'; export const search:RequestHandler=async(req,res)=>res.json({data:await s.search(req.query)});
