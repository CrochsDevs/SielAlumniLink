import express from 'express';
import { listSurveys, getSurvey, createSurvey, updateSurvey, deleteSurvey, submitAnswers, getMyAnswers, getSurveyResults } from './surveys.controllers.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import Roles from '../../constant/roles.js';

const router = express.Router();

router.use(protect);

// Board: any logged-in role.
router.get('/', listSurveys);
router.get('/me/answers/:id', getMyAnswers);
router.get('/:id', getSurvey);
router.post('/:id/answers', submitAnswers);

// Management: admin only.
router.post('/', authorize(Roles.ADMIN), createSurvey);
router.put('/:id', authorize(Roles.ADMIN), updateSurvey);
router.delete('/:id', authorize(Roles.ADMIN), deleteSurvey);
router.get('/:id/results', authorize(Roles.ADMIN), getSurveyResults);

export default router;
