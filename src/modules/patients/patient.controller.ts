import type { Request, Response } from 'express';
import * as patientService from './patient.service.js';

export async function list(_req: Request, res: Response) {
  const result = await patientService.listPatients(res.locals.query);
  res.json({ success: true, ...result });
}

export async function getOne(_req: Request, res: Response) {
  const data = await patientService.getPatient(res.locals.params.id);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response) {
  const data = await patientService.createPatient(req.body);
  res.status(201).json({ success: true, data });
}

export async function update(req: Request, res: Response) {
  const data = await patientService.updatePatient(res.locals.params.id, req.body);
  res.json({ success: true, data });
}

export async function remove(_req: Request, res: Response) {
  await patientService.deletePatient(res.locals.params.id);
  res.status(204).end();
}
