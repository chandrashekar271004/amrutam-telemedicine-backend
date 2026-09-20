import {RequestHandler} from 'express'; import * as s from './service'; 
export const create:RequestHandler=async(req,res)=>res.status(201).json({data:await s.create(req.user!.id,String(req.params.consultationId),req.body.medicines,req.body.instructions)}); 
export const get:RequestHandler=async(req,res)=>res.json({data:await s.get(req.user!.id,req.user!.role,String(req.params.id))});
