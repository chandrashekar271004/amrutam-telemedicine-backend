import { RequestHandler } from 'express';
import * as service from './service';
export const register: RequestHandler = async (req, res) => res.status(201).json({ data: await service.register(req.body) });
export const login: RequestHandler = async (req, res) => res.json({ data: await service.login(req.body.email, req.body.password, req.body.mfaCode) });
export const setupMfa: RequestHandler = async (req, res) => res.json({ data: await service.setupMfa(req.user!.id) });
export const enableMfa: RequestHandler = async (req, res) => res.json({ data: await service.enableMfa(req.user!.id, req.body.code) });
