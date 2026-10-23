import type { Request, Response } from 'express';
import * as patientService from '../patients/patient.service.js';
import * as doctorService from './doctor.service.js';

export async function list(_req: Request, res: Response) {
  const result = await doctorService.listDoctors(res.locals.query);
  res.json({ success: true, ...result });
}

export async function getOne(_req: Request, res: Response) {
  const data = await doctorService.getDoctor(res.locals.params.id);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response) {
  const data = await doctorService.createDoctor(req.body);
  res.status(201).json({ success: true, data });
}

export async function update(req: Request, res: Response) {
  const data = await doctorService.updateDoctor(res.locals.params.id, req.body);
  res.json({ success: true, data });
}

export async function remove(_req: Request, res: Response) {
  await doctorService.deleteDoctor(res.locals.params.id);
  res.status(204).end();
}

export async function filterOptions(_req: Request, res: Response) {
  const data = await doctorService.getDoctorFilterOptions();
  res.json({ success: true, data });
}

export async function lookup(_req: Request, res: Response) {
  const data = await doctorService.lookupDoctors(res.locals.query.search);
  res.json({ success: true, data });
}

export async function listPatients(_req: Request, res: Response) {
  await doctorService.getDoctor(res.locals.params.id);
  const result = await patientService.listPatients({ ...res.locals.query, doctor: res.locals.params.id });
  res.json({ success: true, ...result });
}

export async function addPatient(req: Request, res: Response) {
  const data = await patientService.createPatient({ ...req.body, doctor: res.locals.params.id });
  res.status(201).json({ success: true, data });
}

export async function removePatient(_req: Request, res: Response) {
  await patientService.deletePatient(res.locals.params.patientId, res.locals.params.id);
  res.status(204).end();
}
