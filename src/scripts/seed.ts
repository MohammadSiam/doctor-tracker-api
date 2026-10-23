/**
 * Seeds the database with an admin user and realistic demo data.
 * WARNING: clears the doctors and patients collections first.
 *
 *   pnpm seed                 # 60 doctors, ~3000 patients
 *   pnpm seed --doctors=100 --patients=10000
 */
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { DoctorModel, SPECIALIZATIONS } from '../models/Doctor.js';
import { CONDITIONS, GENDERS, PatientModel } from '../models/Patient.js';
import { UserModel } from '../models/User.js';
import { buildSearchTokens } from '../utils/search.js';

const arg = (name: string, fallback: number) => {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  return match ? Number(match.split('=')[1]) : fallback;
};

const DOCTOR_COUNT = arg('doctors', 60);
const PATIENT_COUNT = arg('patients', 3000);

faker.seed(42);

const HOSPITALS = [
  'Square Hospital',
  'Evercare Hospital Dhaka',
  'United Hospital',
  'Labaid Specialized Hospital',
  'Dhaka Medical College Hospital',
  'BIRDEM General Hospital',
  'Ibn Sina Hospital',
  'Popular Medical College Hospital',
  'Chittagong Medical College Hospital',
  'Green Life Medical College Hospital',
];

const FIRST_NAMES = {
  Male: ['Rahim', 'Karim', 'Tanvir', 'Arif', 'Imran', 'Sabbir', 'Nayeem', 'Rakib', 'Mahmud', 'Fahim', 'Shafiq', 'Hasan', 'Zahid', 'Asif', 'Mehedi', 'Rafiq', 'Sakib', 'Tamim', 'Jubayer', 'Omar'],
  Female: ['Ayesha', 'Fatima', 'Nusrat', 'Sumaiya', 'Tasnim', 'Farhana', 'Sadia', 'Mim', 'Rumana', 'Shirin', 'Nadia', 'Lamia', 'Anika', 'Tahmina', 'Jannat', 'Maliha', 'Sharmin', 'Rifat', 'Afsana', 'Priya'],
};
const LAST_NAMES = ['Ahmed', 'Hossain', 'Rahman', 'Islam', 'Chowdhury', 'Khan', 'Uddin', 'Akter', 'Sarker', 'Talukder', 'Miah', 'Siddique', 'Kabir', 'Haque', 'Alam', 'Biswas', 'Das', 'Roy', 'Saha', 'Karim'];

const DIAGNOSES: Record<(typeof SPECIALIZATIONS)[number], string[]> = {
  Cardiology: ['Hypertension', 'Coronary artery disease', 'Arrhythmia', 'Heart failure'],
  Dermatology: ['Eczema', 'Psoriasis', 'Acne vulgaris', 'Fungal infection'],
  Endocrinology: ['Type 2 diabetes', 'Hypothyroidism', 'Hyperthyroidism', 'PCOS'],
  Gastroenterology: ['Peptic ulcer', 'GERD', 'Hepatitis B', 'Irritable bowel syndrome'],
  'General Medicine': ['Dengue fever', 'Typhoid', 'Viral fever', 'Anemia'],
  Gynecology: ['Prenatal care', 'Endometriosis', 'Uterine fibroids', 'Menstrual disorder'],
  Nephrology: ['Chronic kidney disease', 'Kidney stones', 'Nephrotic syndrome', 'UTI'],
  Neurology: ['Migraine', 'Epilepsy', 'Stroke', "Parkinson's disease"],
  Oncology: ['Breast cancer', 'Lung cancer', 'Leukemia', 'Lymphoma'],
  Ophthalmology: ['Cataract', 'Glaucoma', 'Diabetic retinopathy', 'Conjunctivitis'],
  Orthopedics: ['Fracture', 'Osteoarthritis', 'Back pain', 'Ligament tear'],
  Pediatrics: ['Pneumonia', 'Diarrhea', 'Asthma', 'Malnutrition'],
  Psychiatry: ['Depression', 'Anxiety disorder', 'Insomnia', 'Bipolar disorder'],
  Pulmonology: ['Asthma', 'COPD', 'Tuberculosis', 'Bronchitis'],
  Urology: ['Prostate enlargement', 'Bladder infection', 'Kidney stones', 'Incontinence'],
};

const bdPhone = () => `+8801${faker.helpers.arrayElement(['3', '4', '5', '6', '7', '8', '9'])}${faker.string.numeric(8)}`;
const personName = (gender: 'Male' | 'Female') =>
  `${faker.helpers.arrayElement(FIRST_NAMES[gender])} ${faker.helpers.arrayElement(LAST_NAMES)}`;

/** Random date in the last `days` days, skewed toward recent dates so charts show growth. */
const recentDate = (days: number) => {
  const offset = Math.floor(days * Math.pow(Math.random(), 1.6));
  const date = new Date(Date.now() - offset * 86_400_000);
  date.setHours(faker.number.int({ min: 8, max: 20 }), faker.number.int({ min: 0, max: 59 }));
  // Today's hour can land later than now; never generate a future timestamp.
  if (date.getTime() > Date.now()) date.setTime(Date.now() - faker.number.int({ min: 1, max: 120 }) * 60_000);
  return date;
};

async function seedAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    console.warn('ADMIN_EMAIL / ADMIN_PASSWORD not set, skipping admin user');
    return;
  }
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await UserModel.updateOne(
    { email: env.ADMIN_EMAIL.toLowerCase() },
    { $set: { name: 'Admin', passwordHash, role: 'admin' } },
    { upsert: true },
  );
  console.log(`Admin user ready: ${env.ADMIN_EMAIL}`);
}

async function seedDoctors() {
  const usedEmails = new Set<string>();
  const doctors = Array.from({ length: DOCTOR_COUNT }, () => {
    const gender = faker.helpers.arrayElement(['Male', 'Female'] as const);
    const name = `Dr. ${personName(gender)}`;
    let email: string;
    do {
      email = `${name.replace('Dr. ', '').toLowerCase().replace(/\s+/g, '.')}${faker.number.int({ min: 1, max: 999 })}@doctortracker.com`;
    } while (usedEmails.has(email));
    usedEmails.add(email);

    const hospital = faker.helpers.arrayElement(HOSPITALS);
    const phone = bdPhone();
    const createdAt = recentDate(420);
    return {
      name,
      specialization: faker.helpers.arrayElement(SPECIALIZATIONS),
      hospital,
      phone,
      email,
      patientCount: 0,
      // insertMany skips the save hook, so tokens are built here.
      searchTokens: buildSearchTokens(name, email, hospital, phone),
      createdAt,
      updatedAt: createdAt,
    };
  });
  return DoctorModel.insertMany(doctors, { lean: true });
}

async function seedPatients(doctors: { _id: mongoose.Types.ObjectId; specialization: string }[]) {
  // Uneven weights so "patients per doctor" is an interesting chart rather than a flat line.
  const weights = doctors.map(() => faker.number.float({ min: 0.2, max: 3 }) ** 2);
  const counts = new Map<string, number>();

  const patients = Array.from({ length: PATIENT_COUNT }, () => {
    const doctor = faker.helpers.weightedArrayElement(doctors.map((d, i) => ({ value: d, weight: weights[i] })));
    counts.set(String(doctor._id), (counts.get(String(doctor._id)) ?? 0) + 1);

    const gender = faker.helpers.weightedArrayElement([
      { value: 'Male' as const, weight: 48 },
      { value: 'Female' as const, weight: 50 },
      { value: 'Other' as const, weight: 2 },
    ]);
    const name = personName(gender === 'Other' ? faker.helpers.arrayElement(['Male', 'Female'] as const) : gender);
    const phone = bdPhone();
    const email = faker.datatype.boolean(0.6)
      ? `${name.toLowerCase().replace(/\s+/g, '.')}${faker.number.int({ min: 1, max: 9999 })}@example.com`
      : undefined;
    const diagnosis = faker.helpers.arrayElement(DIAGNOSES[doctor.specialization as keyof typeof DIAGNOSES]);
    const admittedAt = recentDate(365);
    const condition = faker.helpers.weightedArrayElement([
      { value: CONDITIONS[0], weight: 45 },
      { value: CONDITIONS[1], weight: 28 },
      { value: CONDITIONS[2], weight: 10 },
      { value: CONDITIONS[3], weight: 17 },
    ]);
    const age =
      doctor.specialization === 'Pediatrics'
        ? faker.number.int({ min: 0, max: 17 })
        : faker.number.int({ min: 18, max: 88 });

    return {
      name,
      age,
      gender: GENDERS.includes(gender) ? gender : 'Other',
      phone,
      email,
      condition,
      diagnosis,
      notes: faker.datatype.boolean(0.3) ? faker.lorem.sentence() : undefined,
      admittedAt,
      doctor: doctor._id,
      searchTokens: buildSearchTokens(name, phone, email, diagnosis),
      createdAt: admittedAt,
      updatedAt: admittedAt,
    };
  });

  for (let i = 0; i < patients.length; i += 1000) {
    await PatientModel.insertMany(patients.slice(i, i + 1000), { lean: true });
  }

  await DoctorModel.bulkWrite(
    [...counts].map(([id, count]) => ({
      updateOne: { filter: { _id: new mongoose.Types.ObjectId(id) }, update: { $set: { patientCount: count } } },
    })),
  );
}

async function main() {
  await connectDatabase();

  console.log('Syncing indexes...');
  await Promise.all([UserModel.syncIndexes(), DoctorModel.syncIndexes(), PatientModel.syncIndexes()]);

  await seedAdmin();

  console.log('Clearing doctors and patients...');
  await Promise.all([DoctorModel.deleteMany({}), PatientModel.deleteMany({})]);

  const doctors = await seedDoctors();
  console.log(`Inserted ${doctors.length} doctors`);

  await seedPatients(doctors);
  console.log(`Inserted ${PATIENT_COUNT} patients`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
