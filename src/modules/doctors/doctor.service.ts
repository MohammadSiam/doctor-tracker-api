import mongoose from 'mongoose';
import { DoctorModel, SPECIALIZATIONS } from '../../models/Doctor.js';
import { PatientModel } from '../../models/Patient.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildMeta, dateRangeFilter, getSkip, parseSort } from '../../utils/pagination.js';
import { buildSearchFilter } from '../../utils/search.js';
import type { CreateDoctorInput, ListDoctorsQuery, UpdateDoctorInput } from './doctor.schema.js';

export async function listDoctors(query: ListDoctorsQuery) {
  const { page, limit, search, specialization, hospital, from, to, sort } = query;

  const filter = {
    ...buildSearchFilter(search),
    ...(specialization && { specialization }),
    ...(hospital && { hospital }),
    ...dateRangeFilter('createdAt', from, to),
  };

  const [data, total] = await Promise.all([
    DoctorModel.find(filter).sort(parseSort(sort)).skip(getSkip(page, limit)).limit(limit).lean(),
    DoctorModel.countDocuments(filter),
  ]);

  return { data, meta: buildMeta(page, limit, total) };
}

export async function getDoctor(id: string) {
  const doctor = await DoctorModel.findById(id).lean();
  if (!doctor) throw ApiError.notFound('Doctor');
  return doctor;
}

export async function createDoctor(input: CreateDoctorInput) {
  const doctor = await DoctorModel.create(input);
  return doctor.toObject();
}

export async function updateDoctor(id: string, input: UpdateDoctorInput) {
  const doctor = await DoctorModel.findById(id);
  if (!doctor) throw ApiError.notFound('Doctor');
  doctor.set(input);
  await doctor.save(); // save() (not findByIdAndUpdate) so the searchTokens hook runs
  return doctor.toObject();
}

export async function deleteDoctor(id: string) {
  await mongoose.connection.transaction(async (session) => {
    const doctor = await DoctorModel.findByIdAndDelete(id, { session });
    if (!doctor) throw ApiError.notFound('Doctor');
    await PatientModel.deleteMany({ doctor: id }, { session });
  });
}

export async function getDoctorFilterOptions() {
  const hospitals = await DoctorModel.distinct('hospital');
  return { specializations: SPECIALIZATIONS, hospitals: hospitals.sort() };
}

/** Lightweight list for comboboxes (e.g. picking a doctor in the patient form). */
export async function lookupDoctors(search?: string) {
  return DoctorModel.find(buildSearchFilter(search))
    .select('name specialization hospital')
    .sort({ name: 1 })
    .limit(20)
    .lean();
}
