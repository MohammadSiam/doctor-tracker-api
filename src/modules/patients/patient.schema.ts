import { z } from 'zod';
import { CONDITIONS, GENDERS } from '../../models/Patient.js';
import { objectId, paginationQuery, phone } from '../../utils/validators.js';

/** Patient fields without the doctor, used when adding a patient under /doctors/:id/patients. */
export const patientFieldsSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  age: z.coerce.number().int('Age must be a whole number').min(0).max(130),
  gender: z.enum(GENDERS, 'Select a gender'),
  phone,
  email: z.union([z.email('Enter a valid email').trim().toLowerCase(), z.literal('')]).optional(),
  condition: z.enum(CONDITIONS, 'Select a condition').default('Stable'),
  diagnosis: z.string().trim().min(2, 'Diagnosis is required').max(200),
  notes: z.string().trim().max(1000).optional(),
  // Checked per request: a `.max(new Date(...))` would freeze "now" at server start.
  admittedAt: z.coerce
    .date()
    .refine((date) => date.getTime() <= Date.now() + 86_400_000, 'Admission date cannot be in the future')
    .optional(),
});

export const createPatientSchema = patientFieldsSchema.extend({ doctor: objectId });

export const updatePatientSchema = createPatientSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

export const listPatientsQuery = paginationQuery.extend({
  condition: z.enum(CONDITIONS).optional(),
  gender: z.enum(GENDERS).optional(),
  doctor: objectId.optional(),
  sort: z.enum(['admittedAt', '-admittedAt', 'name', '-name', 'age', '-age']).default('-admittedAt'),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuery>;
