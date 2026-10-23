import { DoctorModel } from '../../models/Doctor.js';
import { PatientModel } from '../../models/Patient.js';
import type { TimeseriesRange } from './stats.schema.js';

const startOfMonth = (offset = 0) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
};

const percentChange = (current: number, previous: number) =>
  previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 1000) / 10;

/** All dashboard numbers in one request. Independent queries run in parallel. */
export async function getOverview() {
  const thisMonth = startOfMonth();
  const lastMonth = startOfMonth(-1);

  const [
    totalDoctors,
    totalPatients,
    patientsThisMonth,
    patientsLastMonth,
    doctorsThisMonth,
    [breakdown],
    specializations,
    topDoctors,
  ] = await Promise.all([
    DoctorModel.estimatedDocumentCount(),
    PatientModel.estimatedDocumentCount(),
    PatientModel.countDocuments({ admittedAt: { $gte: thisMonth } }),
    PatientModel.countDocuments({ admittedAt: { $gte: lastMonth, $lt: thisMonth } }),
    DoctorModel.countDocuments({ createdAt: { $gte: thisMonth } }),
    // One pass over patients for every categorical breakdown.
    PatientModel.aggregate<{
      conditions: { name: string; value: number }[];
      genders: { name: string; value: number }[];
      ageGroups: { name: string; value: number }[];
    }>([
      { $project: { condition: 1, gender: 1, age: 1 } },
      {
        $facet: {
          conditions: [{ $group: { _id: '$condition', value: { $sum: 1 } } }, { $sort: { value: -1 } }],
          genders: [{ $group: { _id: '$gender', value: { $sum: 1 } } }, { $sort: { value: -1 } }],
          ageGroups: [
            {
              $bucket: {
                groupBy: '$age',
                boundaries: [0, 18, 35, 50, 65, 131],
                default: 'Unknown',
                output: { value: { $sum: 1 } },
              },
            },
          ],
        },
      },
      {
        $project: {
          conditions: { $map: { input: '$conditions', in: { name: '$$this._id', value: '$$this.value' } } },
          genders: { $map: { input: '$genders', in: { name: '$$this._id', value: '$$this.value' } } },
          ageGroups: {
            $map: {
              input: '$ageGroups',
              in: {
                name: {
                  $switch: {
                    branches: [
                      { case: { $eq: ['$$this._id', 0] }, then: '0-17' },
                      { case: { $eq: ['$$this._id', 18] }, then: '18-34' },
                      { case: { $eq: ['$$this._id', 35] }, then: '35-49' },
                      { case: { $eq: ['$$this._id', 50] }, then: '50-64' },
                      { case: { $eq: ['$$this._id', 65] }, then: '65+' },
                    ],
                    default: 'Unknown',
                  },
                },
                value: '$$this.value',
              },
            },
          },
        },
      },
    ]),
    // patientCount is denormalized, so this never touches the patients collection.
    DoctorModel.aggregate<{ name: string; doctors: number; patients: number }>([
      { $group: { _id: '$specialization', doctors: { $sum: 1 }, patients: { $sum: '$patientCount' } } },
      { $project: { _id: 0, name: '$_id', doctors: 1, patients: 1 } },
      { $sort: { patients: -1 } },
    ]),
    DoctorModel.find().sort({ patientCount: -1 }).limit(10).select('name specialization patientCount').lean(),
  ]);

  const critical = breakdown?.conditions.find((c) => c.name === 'Critical')?.value ?? 0;

  return {
    totals: {
      doctors: totalDoctors,
      patients: totalPatients,
      critical,
      avgPatientsPerDoctor: totalDoctors ? Math.round((totalPatients / totalDoctors) * 10) / 10 : 0,
      patientsThisMonth,
      patientsGrowth: percentChange(patientsThisMonth, patientsLastMonth),
      doctorsThisMonth,
    },
    conditions: breakdown?.conditions ?? [],
    genders: breakdown?.genders ?? [],
    ageGroups: breakdown?.ageGroups ?? [],
    specializations,
    topDoctors,
  };
}

const RANGES: Record<TimeseriesRange, { unit: 'day' | 'month'; count: number }> = {
  '7d': { unit: 'day', count: 7 },
  '30d': { unit: 'day', count: 30 },
  '90d': { unit: 'day', count: 90 },
  '12m': { unit: 'month', count: 12 },
};

const bucketKey = (date: Date, unit: 'day' | 'month') =>
  unit === 'day' ? date.toISOString().slice(0, 10) : date.toISOString().slice(0, 7);

/** Admissions and new doctors per day (or month), with empty buckets filled in as zero. */
export async function getTimeseries(range: TimeseriesRange) {
  const { unit, count } = RANGES[range];
  const now = new Date();
  const start =
    unit === 'day'
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (count - 1)))
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1), 1));

  const groupBy = (field: string) => [
    { $match: { [field]: { $gte: start } } }, // index range scan on admittedAt / createdAt
    { $group: { _id: { $dateTrunc: { date: `$${field}`, unit } }, value: { $sum: 1 } } },
  ];

  const [patients, critical, doctors] = await Promise.all([
    PatientModel.aggregate<{ _id: Date; value: number }>(groupBy('admittedAt')),
    PatientModel.aggregate<{ _id: Date; value: number }>([
      { $match: { condition: 'Critical', admittedAt: { $gte: start } } },
      { $group: { _id: { $dateTrunc: { date: '$admittedAt', unit } }, value: { $sum: 1 } } },
    ]),
    DoctorModel.aggregate<{ _id: Date; value: number }>(groupBy('createdAt')),
  ]);

  const toMap = (rows: { _id: Date; value: number }[]) =>
    new Map(rows.map((row) => [bucketKey(row._id, unit), row.value]));
  const patientMap = toMap(patients);
  const criticalMap = toMap(critical);
  const doctorMap = toMap(doctors);

  return Array.from({ length: count }, (_, i) => {
    const date =
      unit === 'day'
        ? new Date(start.getTime() + i * 86_400_000)
        : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const key = bucketKey(date, unit);
    return {
      date: key,
      patients: patientMap.get(key) ?? 0,
      critical: criticalMap.get(key) ?? 0,
      doctors: doctorMap.get(key) ?? 0,
    };
  });
}
