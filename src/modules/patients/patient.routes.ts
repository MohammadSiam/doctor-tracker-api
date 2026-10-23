import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { idParams } from '../../utils/validators.js';
import * as controller from './patient.controller.js';
import { createPatientSchema, listPatientsQuery, updatePatientSchema } from './patient.schema.js';

export const patientRouter = Router();

patientRouter.get('/', validate({ query: listPatientsQuery }), controller.list);
patientRouter.post('/', validate({ body: createPatientSchema }), controller.create);
patientRouter.get('/:id', validate({ params: idParams }), controller.getOne);
patientRouter.patch('/:id', validate({ params: idParams, body: updatePatientSchema }), controller.update);
patientRouter.delete('/:id', validate({ params: idParams }), controller.remove);
