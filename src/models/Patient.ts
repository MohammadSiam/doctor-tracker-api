import { Schema, model, type InferSchemaType } from 'mongoose';
import { buildSearchTokens } from '../utils/search.js';

export const CONDITIONS = ['Stable', 'Recovering', 'Critical', 'Discharged'] as const;
export const GENDERS = ['Male', 'Female', 'Other'] as const;

const patientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 0, max: 130 },
    gender: { type: String, required: true, enum: GENDERS },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    condition: { type: String, required: true, enum: CONDITIONS, default: 'Stable' },
    diagnosis: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    admittedAt: { type: Date, required: true, default: Date.now },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    searchTokens: { type: [String], select: false },
  },
  { timestamps: true },
);

patientSchema.pre('save', function () {
  this.searchTokens = buildSearchTokens(this.name, this.phone, this.email, this.diagnosis);
});

patientSchema.index({ admittedAt: -1, _id: -1 });
// A doctor's patient list, and $group by doctor.
patientSchema.index({ doctor: 1, admittedAt: -1, _id: -1 });
patientSchema.index({ condition: 1, admittedAt: -1, _id: -1 });
patientSchema.index({ searchTokens: 1 });

export type Patient = InferSchemaType<typeof patientSchema>;
export const PatientModel = model('Patient', patientSchema);
