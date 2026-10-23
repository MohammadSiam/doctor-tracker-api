import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { idParams, objectId } from '../../utils/validators.js';
import { listPatientsQuery, patientFieldsSchema } from '../patients/patient.schema.js';
import * as controller from './doctor.controller.js';
import { createDoctorSchema, listDoctorsQuery, lookupDoctorsQuery, updateDoctorSchema } from './doctor.schema.js';

export const doctorRouter = Router();

doctorRouter.get('/', validate({ query: listDoctorsQuery }), controller.list);
doctorRouter.post('/', validate({ body: createDoctorSchema }), controller.create);
doctorRouter.get('/filters', controller.filterOptions);
doctorRouter.get('/lookup', validate({ query: lookupDoctorsQuery }), controller.lookup);
doctorRouter.get('/:id', validate({ params: idParams }), controller.getOne);
doctorRouter.patch('/:id', validate({ params: idParams, body: updateDoctorSchema }), controller.update);
doctorRouter.delete('/:id', validate({ params: idParams }), controller.remove);
doctorRouter.get(
  '/:id/patients',
  validate({ params: idParams, query: listPatientsQuery.omit({ doctor: true }) }),
  controller.listPatients,
);
doctorRouter.post('/:id/patients', validate({ params: idParams, body: patientFieldsSchema }), controller.addPatient);
doctorRouter.delete(
  '/:id/patients/:patientId',
  validate({ params: idParams.extend({ patientId: objectId }) }),
  controller.removePatient,
);
