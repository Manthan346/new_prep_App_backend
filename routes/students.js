import express from 'express';
import {
  getAllStudents,
  getStudentDashboard,
  getStudentResults,
  getStudentPerformance,
  getMyResults,           // Make sure this exists
  getStudentResultsById,  // Make sure this exists  
  getMyTestResult,        // Make sure this exists
  getResultsAnalysis
} from '../controllers/studentController.js';
import { authenticate, teacherOrAdmin, studentOnly } from '../middleware/auth.js';

const router = express.Router();

// All routes protected by authentication
router.use(authenticate);

// GET /api/students - List all students (for MarksEntryModal.jsx - teacher/admin only)
router.get('/', teacherOrAdmin, getAllStudents);

// GET /api/students/dashboard - Dashboard data for authenticated student
router.get('/dashboard', studentOnly, getStudentDashboard);

// GET /api/students/results - Test results for authenticated student (legacy)
router.get('/results', studentOnly, getStudentResults);

// 📊 NEW STUDENT RESULT ENDPOINTS
// GET /api/students/my-results - Get all results for current student
router.get('/my-results', studentOnly, getMyResults);

// GET /api/students/results/analysis - Get performance analysis for current student
router.get('/results/analysis', studentOnly, getResultsAnalysis);

// GET /api/students/test/:testId/result - Get current student's result for specific test
router.get('/test/:testId/result', studentOnly, getMyTestResult);

// GET /api/students/performance - Performance for authenticated student
router.get('/performance', studentOnly, getStudentPerformance);

// 🎯 ADMIN/TEACHER ENDPOINTS
// GET /api/students/:studentId/results - Get specific student's results (admin/teacher only)
router.get('/:studentId/results', teacherOrAdmin, getStudentResultsById);

// GET /api/students/:id/performance - Performance of student by ID (teacher/admin only)
router.get('/:id/performance', teacherOrAdmin, getStudentPerformance);

export default router;
