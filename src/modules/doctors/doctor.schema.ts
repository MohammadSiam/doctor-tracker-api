import { z } from 'zod';
import { SPECIALIZATIONS } from '../../models/Doctor.js';
import { paginationQuery, phone } from '../../utils/validators.js';

export const createDoctorSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  specialization: z.enum(SPECIALIZATIONS, 'Select a valid specialization'),
  hospital: z.string().trim().min(2, 'Hospital is required').max(150),
  phone,
  email: z.email('Enter a valid email').trim().toLowerCase(),
});

export const updateDoctorSchema = createDoctorSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: 'Provide at least one field to update',
});

export const listDoctorsQuery = paginationQuery.extend({
  specialization: z.enum(SPECIALIZATIONS).optional(),
  hospital: z.string().trim().max(150).optional(),
  sort: z.enum(['createdAt', '-createdAt', 'name', '-name', 'patientCount', '-patientCount']).default('-createdAt'),
});

export const lookupDoctorsQuery = z.object({
  search: z.string().trim().max(100).optional(),
});

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
export type ListDoctorsQuery = z.infer<typeof listDoctorsQuery>;
