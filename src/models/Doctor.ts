import { Schema, model, type InferSchemaType } from 'mongoose';
import { buildSearchTokens } from '../utils/search.js';

export const SPECIALIZATIONS = [
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'General Medicine',
  'Gynecology',
  'Nephrology',
  'Neurology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Urology',
] as const;

const doctorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    specialization: { type: String, required: true, enum: SPECIALIZATIONS },
    hospital: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Denormalized counter, kept in sync inside the patient transactions.
    // Lets the doctor list and the "patients per doctor" chart avoid a $lookup.
    patientCount: { type: Number, default: 0, min: 0 },
    searchTokens: { type: [String], select: false },
  },
  { timestamps: true },
);

doctorSchema.pre('save', function () {
  this.searchTokens = buildSearchTokens(this.name, this.email, this.hospital, this.phone);
});

// Default listing (newest first) and the date-range filter.
doctorSchema.index({ createdAt: -1, _id: -1 });
// Equality filters followed by the default sort (ESR rule: Equality, Sort, Range).
doctorSchema.index({ specialization: 1, createdAt: -1, _id: -1 });
doctorSchema.index({ hospital: 1, createdAt: -1, _id: -1 });
// Prefix search (multikey).
doctorSchema.index({ searchTokens: 1 });
// "Top doctors by patient count" on the dashboard.
doctorSchema.index({ patientCount: -1 });

export type Doctor = InferSchemaType<typeof doctorSchema>;
export const DoctorModel = model('Doctor', doctorSchema);
