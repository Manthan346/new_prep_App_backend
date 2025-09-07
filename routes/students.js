import express from 'express';
import {
  getAllStudents,
  getStudentDashboard,
  getStudentResults,
  getStudentPerformance,
  getMyResults,
  getStudentResultsById,
  getMyTestResult,
  getResultsAnalysis
} from '../controllers/studentController.js';
import { authenticate, teacherOrAdmin, studentOnly } from '../middleware/auth.js';

const router = express.Router();

// All routes protected by authentication
router.use(authenticate);

// Teacher/Admin-only routes
router.get('/', teacherOrAdmin, getAllStudents);
router.get('/:studentId/results', teacherOrAdmin, getStudentResultsById);
router.get('/:id/performance', teacherOrAdmin, getStudentPerformance);
router.get('/performance/:id', teacherOrAdmin, getStudentPerformance);

// Student-only routes
router.get('/dashboard',teacherOrAdmin, getStudentDashboard);
router.get('/results', studentOnly, getStudentResults);
router.get('/my-results', studentOnly, getMyResults);
router.get('/results/analysis', studentOnly, getResultsAnalysis);
router.get('/test/:testId/result', studentOnly, getMyTestResult);
router.get('/performance', studentOnly, (req, res, next) => {
  req.params.id = req.user.id;
  getStudentPerformance(req, res, next);
});

export default router;
