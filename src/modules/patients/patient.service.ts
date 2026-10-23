import mongoose from 'mongoose';
import { DoctorModel } from '../../models/Doctor.js';
import { PatientModel } from '../../models/Patient.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildMeta, dateRangeFilter, getSkip, parseSort } from '../../utils/pagination.js';
import { buildSearchFilter } from '../../utils/search.js';
import type { CreatePatientInput, ListPatientsQuery, UpdatePatientInput } from './patient.schema.js';

const DOCTOR_FIELDS = 'name specialization hospital';

export async function listPatients(query: ListPatientsQuery) {
  const { page, limit, search, condition, gender, doctor, from, to, sort } = query;

  const filter = {
    ...buildSearchFilter(search),
    ...(condition && { condition }),
    ...(gender && { gender }),
    ...(doctor && { doctor: new mongoose.Types.ObjectId(doctor) }),
    ...dateRangeFilter('admittedAt', from, to),
  };

  const [data, total] = await Promise.all([
    PatientModel.find(filter)
      .sort(parseSort(sort))
      .skip(getSkip(page, limit))
      .limit(limit)
      .populate('doctor', DOCTOR_FIELDS) // one extra $in query for the whole page, not one per row
      .lean(),
    PatientModel.countDocuments(filter),
  ]);

  return { data, meta: buildMeta(page, limit, total) };
}

export async function getPatient(id: string) {
  const patient = await PatientModel.findById(id).populate('doctor', DOCTOR_FIELDS).lean();
  if (!patient) throw ApiError.notFound('Patient');
  return patient;
}

/** Creating, moving and deleting patients run in a transaction so Doctor.patientCount never drifts. */
export async function createPatient(input: CreatePatientInput) {
  const id = await mongoose.connection.transaction(async (session) => {
    const doctor = await DoctorModel.findByIdAndUpdate(input.doctor, { $inc: { patientCount: 1 } }, { session });
    if (!doctor) throw ApiError.notFound('Doctor');
    const [patient] = await PatientModel.create([input], { session });
    return patient._id;
  });
  return getPatient(String(id));
}

export async function updatePatient(id: string, input: UpdatePatientInput) {
  await mongoose.connection.transaction(async (session) => {
    const patient = await PatientModel.findById(id).session(session);
    if (!patient) throw ApiError.notFound('Patient');

    const previousDoctor = String(patient.doctor);
    if (input.doctor && input.doctor !== previousDoctor) {
      const nextDoctor = await DoctorModel.findByIdAndUpdate(input.doctor, { $inc: { patientCount: 1 } }, { session });
      if (!nextDoctor) throw ApiError.notFound('Doctor');
      await DoctorModel.updateOne({ _id: previousDoctor }, { $inc: { patientCount: -1 } }, { session });
    }

    patient.set(input);
    await patient.save({ session });
  });
  return getPatient(id);
}

export async function deletePatient(id: string, expectedDoctor?: string) {
  await mongoose.connection.transaction(async (session) => {
    const filter = expectedDoctor ? { _id: id, doctor: expectedDoctor } : { _id: id };
    const patient = await PatientModel.findOneAndDelete(filter, { session });
    if (!patient) throw ApiError.notFound('Patient');
    await DoctorModel.updateOne({ _id: patient.doctor }, { $inc: { patientCount: -1 } }, { session });
  });
}
