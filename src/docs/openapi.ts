import { z } from 'zod';
import { loginSchema } from '../modules/auth/auth.schema.js';
import { createDoctorSchema, listDoctorsQuery, lookupDoctorsQuery, updateDoctorSchema } from '../modules/doctors/doctor.schema.js';
import {
  createPatientSchema,
  listPatientsQuery,
  patientFieldsSchema,
  updatePatientSchema,
} from '../modules/patients/patient.schema.js';
import { timeseriesQuery } from '../modules/stats/stats.schema.js';

/**
 * OpenAPI 3.1 document generated from the same zod schemas the routes validate with,
 * so the docs cannot drift from the real request rules.
 */

type JsonSchema = Record<string, unknown>;

const toSchema = (schema: z.ZodType): JsonSchema => {
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema, {
    io: 'input',
    unrepresentable: 'any',
    override: ({ zodSchema, jsonSchema }) => {
      if (zodSchema._zod.def.type === 'date') Object.assign(jsonSchema, { type: 'string', format: 'date-time' });
      if (jsonSchema.format === 'email') delete jsonSchema.pattern;
      if (jsonSchema.maximum === Number.MAX_SAFE_INTEGER) delete jsonSchema.maximum;
    },
  });
  return json;
};

const queryParams = (schema: z.ZodType) => {
  const { properties = {} } = toSchema(schema) as { properties?: Record<string, JsonSchema> };
  return Object.entries(properties).map(([name, schema]) => ({ name, in: 'query', schema }));
};

const json = (schema: JsonSchema, example?: unknown) => ({ content: { 'application/json': { schema, example } } });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const idParam = (name = 'id') => ({ name, in: 'path', required: true, schema: { type: 'string', pattern: '^[a-f\\d]{24}$' } });

const single = (schema: JsonSchema) => ({ type: 'object', properties: { success: { const: true }, data: schema } });
const list = (item: JsonSchema) => ({
  type: 'object',
  properties: { success: { const: true }, data: { type: 'array', items: item }, meta: ref('PageMeta') },
});

const ok = (schema: JsonSchema, description = 'OK') => ({ description, ...json(schema) });
const errors = (...codes: number[]) =>
  Object.fromEntries(codes.map((code) => [code, { $ref: `#/components/responses/E${code}` }]));

const doctorExample = {
  name: 'Dr. Rahim Saha',
  specialization: 'Cardiology',
  hospital: 'Square Hospital',
  phone: '+8801712345678',
  email: 'rahim.saha@example.com',
};
const patientExample = {
  name: 'Karim Uddin',
  age: 42,
  gender: 'Male',
  phone: '+8801812345678',
  condition: 'Stable',
  diagnosis: 'Hypertension',
  admittedAt: '2026-10-23T08:30:00.000Z',
};

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Doctor Tracker API',
    version: '1.0.0',
    description:
      'REST API for managing doctors and their patients.\n\n' +
      '**Try it:** run `POST /api/auth/login` with the pre-filled demo credentials. It sets an httpOnly cookie, ' +
      'so every other request on this page is authenticated automatically.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Auth' },
    { name: 'Doctors' },
    { name: 'Patients' },
    { name: 'Stats', description: 'Dashboard aggregates' },
    { name: 'System' },
  ],
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  paths: {
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Liveness and database status',
        security: [],
        responses: { 200: ok({ type: 'object', properties: { status: { const: 'ok' }, db: { enum: ['up', 'down'] }, uptime: { type: 'number' } } }) },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in (sets the dt_token cookie)',
        security: [],
        requestBody: { required: true, ...json(toSchema(loginSchema), { email: 'admin@doctortracker.com', password: 'Admin@123' }) },
        responses: { 200: ok(single(ref('User'))), ...errors(400, 401), 429: { description: 'Too many failed attempts' } },
      },
    },
    '/api/auth/logout': {
      post: { tags: ['Auth'], summary: 'Sign out (clears the cookie)', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/api/auth/me': {
      get: { tags: ['Auth'], summary: 'Current user', responses: { 200: ok(single(ref('User'))), ...errors(401) } },
    },
    '/api/doctors': {
      get: {
        tags: ['Doctors'],
        summary: 'List doctors',
        description: '`search` matches word prefixes in name, email, hospital and phone. `from`/`to` filter by joined date.',
        parameters: queryParams(listDoctorsQuery),
        responses: { 200: ok(list(ref('Doctor'))), ...errors(400, 401) },
      },
      post: {
        tags: ['Doctors'],
        summary: 'Create a doctor',
        requestBody: { required: true, ...json(toSchema(createDoctorSchema), doctorExample) },
        responses: { 201: ok(single(ref('Doctor')), 'Created'), ...errors(400, 401, 409) },
      },
    },
    '/api/doctors/filters': {
      get: {
        tags: ['Doctors'],
        summary: 'Options for the filter dropdowns',
        responses: {
          200: ok(single({ type: 'object', properties: { specializations: { type: 'array', items: { type: 'string' } }, hospitals: { type: 'array', items: { type: 'string' } } } })),
          ...errors(401),
        },
      },
    },
    '/api/doctors/lookup': {
      get: {
        tags: ['Doctors'],
        summary: 'Up to 20 doctors for a combobox',
        parameters: queryParams(lookupDoctorsQuery),
        responses: { 200: ok(single({ type: 'array', items: ref('DoctorSummary') })), ...errors(401) },
      },
    },
    '/api/doctors/{id}': {
      parameters: [idParam()],
      get: { tags: ['Doctors'], summary: 'Get a doctor', responses: { 200: ok(single(ref('Doctor'))), ...errors(400, 401, 404) } },
      patch: {
        tags: ['Doctors'],
        summary: 'Update a doctor',
        requestBody: { required: true, ...json(toSchema(updateDoctorSchema), { hospital: 'Evercare Hospital' }) },
        responses: { 200: ok(single(ref('Doctor'))), ...errors(400, 401, 404, 409) },
      },
      delete: {
        tags: ['Doctors'],
        summary: "Delete a doctor and all of their patients (one transaction)",
        responses: { 204: { description: 'Deleted' }, ...errors(401, 404) },
      },
    },
    '/api/doctors/{id}/patients': {
      parameters: [idParam()],
      get: {
        tags: ['Doctors'],
        summary: "List a doctor's patients",
        parameters: queryParams(listPatientsQuery.omit({ doctor: true })),
        responses: { 200: ok(list(ref('Patient'))), ...errors(400, 401, 404) },
      },
      post: {
        tags: ['Doctors'],
        summary: 'Add a patient under this doctor',
        requestBody: { required: true, ...json(toSchema(patientFieldsSchema), patientExample) },
        responses: { 201: ok(single(ref('Patient')), 'Created'), ...errors(400, 401, 404) },
      },
    },
    '/api/doctors/{id}/patients/{patientId}': {
      parameters: [idParam(), idParam('patientId')],
      delete: {
        tags: ['Doctors'],
        summary: "Remove a patient from this doctor's list",
        description: 'Returns 404 if the patient belongs to a different doctor.',
        responses: { 204: { description: 'Removed' }, ...errors(401, 404) },
      },
    },
    '/api/patients': {
      get: {
        tags: ['Patients'],
        summary: 'List patients',
        description: '`from`/`to` filter by admission date.',
        parameters: queryParams(listPatientsQuery),
        responses: { 200: ok(list(ref('Patient'))), ...errors(400, 401) },
      },
      post: {
        tags: ['Patients'],
        summary: 'Create a patient',
        requestBody: { required: true, ...json(toSchema(createPatientSchema), { ...patientExample, doctor: '<doctor id>' }) },
        responses: { 201: ok(single(ref('Patient')), 'Created'), ...errors(400, 401, 404) },
      },
    },
    '/api/patients/{id}': {
      parameters: [idParam()],
      get: { tags: ['Patients'], summary: 'Get a patient', responses: { 200: ok(single(ref('Patient'))), ...errors(400, 401, 404) } },
      patch: {
        tags: ['Patients'],
        summary: 'Update a patient',
        description: 'Changing `doctor` moves the patient and updates both doctors’ counts in one transaction.',
        requestBody: { required: true, ...json(toSchema(updatePatientSchema), { condition: 'Recovering' }) },
        responses: { 200: ok(single(ref('Patient'))), ...errors(400, 401, 404) },
      },
      delete: { tags: ['Patients'], summary: 'Delete a patient', responses: { 204: { description: 'Deleted' }, ...errors(401, 404) } },
    },
    '/api/stats/overview': {
      get: {
        tags: ['Stats'],
        summary: 'Totals, growth, breakdowns and top doctors',
        responses: { 200: ok(single({ type: 'object' })), ...errors(401) },
      },
    },
    '/api/stats/timeseries': {
      get: {
        tags: ['Stats'],
        summary: 'Admissions, critical admissions and new doctors per day (or month for 12m)',
        parameters: queryParams(timeseriesQuery),
        responses: {
          200: ok(single({ type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, patients: { type: 'integer' }, critical: { type: 'integer' }, doctors: { type: 'integer' } } } })),
          ...errors(400, 401),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'dt_token' },
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      User: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, role: { const: 'admin' } },
      },
      DoctorSummary: {
        type: 'object',
        properties: { _id: { type: 'string' }, name: { type: 'string' }, specialization: { type: 'string' }, hospital: { type: 'string' } },
      },
      Doctor: {
        allOf: [
          toSchema(createDoctorSchema),
          {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              patientCount: { type: 'integer' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },
      Patient: {
        allOf: [
          toSchema(patientFieldsSchema),
          {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              doctor: ref('DoctorSummary'),
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },
      PageMeta: {
        type: 'object',
        properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } },
      },
      Error: {
        type: 'object',
        properties: {
          success: { const: false },
          message: { type: 'string' },
          details: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, message: { type: 'string' } } } },
        },
      },
    },
    responses: {
      E400: { description: 'Validation failed', ...json(ref('Error'), { success: false, message: 'Validation failed', details: [{ path: 'body.email', message: 'Enter a valid email' }] }) },
      E401: { description: 'Not signed in or session expired', ...json(ref('Error')) },
      E404: { description: 'Not found', ...json(ref('Error')) },
      E409: { description: 'Email already in use', ...json(ref('Error')) },
    },
  },
};
