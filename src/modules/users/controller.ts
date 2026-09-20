import { RequestHandler } from 'express'; import * as s from './service';
export const me: RequestHandler = async (req,res)=>res.json({data:await s.me(req.user!.id)});
export const update: RequestHandler = async (req,res)=>res.json({data:await s.update(req.user!.id,req.body)});
