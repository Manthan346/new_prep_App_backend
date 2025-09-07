import express from 'express';
import { getAllStudents, getStudentDashboard, getStudentResults, getStudentPerformance, getMyResults, getStudentResultsById, getMyTestResult, getResultsAnalysis } from '../controllers/studentController.js';
import { authenticate, teacherOrAdmin, studentOnly, studentOrTeacherAdmin, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Student-only routes (specific first)
router.get('/dashboard', studentOnly, getStudentDashboard);
router.get('/results', studentOnly, getStudentResults);
router.get('/my-results', studentOnly, getMyResults);
router.get('/results/analysis', studentOnly, getResultsAnalysis);
router.get('/test/:testId/result', studentOnly, getMyTestResult);

// Student performance (own)
router.get('/performance', studentOnly, (req, res, next) => {
  req.params.id = req.user.id;
  getStudentPerformance(req, res, next);
});

// Teacher/Admin-only routes
router.get('/:studentId/results', teacherOrAdmin, getStudentResultsById);
router.get('/:id/performance', teacherOrAdmin, getStudentPerformance);

// Get all students (teacher or admin)
router.get('/', studentOrTeacherAdmin, getAllStudents);

export default router;
