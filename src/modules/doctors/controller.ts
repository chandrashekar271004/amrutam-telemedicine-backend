import { RequestHandler } from 'express'; import * as s from './service';
export const create:RequestHandler=async(req,res)=>res.status(201).json({data:await s.create(req.body,req.user!.id)});
export const search:RequestHandler=async(req,res)=>res.json({data:await s.search(req.query)});
export const verify:RequestHandler=async(req,res)=>res.json({data:await s.verify(String(req.params.id), req.user!.id)});
