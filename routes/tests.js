import express from 'express';
import {
  getAllTests,
  getTestById,
  createTest,
  updateTest,
  deleteTest,
  getTestResults,
  submitTestMarks,
  getTestMarks,
  getTestStatistics
} from '../controllers/testController.js';
import { authenticate, teacherOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

console.log('🔧 Tests routes loaded with getTestMarks:', typeof getTestMarks); // Debug log

// 📋 SPECIFIC ROUTES FIRST (ORDER MATTERS!)
// GET /api/tests/:id/marks - Get existing marks for a test
router.get('/:id/marks', teacherOrAdmin, (req, res, next) => {
  console.log('🎯 Route hit: GET /:id/marks for test:', req.params.id);
  getTestMarks(req, res, next);
});

// GET /api/tests/:id/results - Get test results
router.get('/:id/results', teacherOrAdmin, (req, res, next) => {
  console.log('📊 Route hit: GET /:id/results for test:', req.params.id);
  getTestResults(req, res, next);
});

// GET /api/tests/:id/statistics - Get test statistics
router.get('/:id/statistics', teacherOrAdmin, (req, res, next) => {
  console.log('📈 Route hit: GET /:id/statistics for test:', req.params.id);
  getTestStatistics(req, res, next);
});

// POST /api/tests/:id/marks - Submit marks
router.post('/:id/marks', teacherOrAdmin, (req, res, next) => {
  console.log('📝 Route hit: POST /:id/marks for test:', req.params.id);
  submitTestMarks(req, res, next);
});

// PUT /api/tests/:id - Update test
router.put('/:id', teacherOrAdmin, (req, res, next) => {
  console.log('✏️ Route hit: PUT /:id for test:', req.params.id);
  updateTest(req, res, next);
});

// DELETE /api/tests/:id - Delete test
router.delete('/:id', teacherOrAdmin, (req, res, next) => {
  console.log('🗑️ Route hit: DELETE /:id for test:', req.params.id);
  deleteTest(req, res, next);
});

// 📋 GENERAL ROUTES LAST
// GET /api/tests - Get all tests
router.get('/', (req, res, next) => {
  console.log('📚 Route hit: GET / (all tests)');
  getAllTests(req, res, next);
});

// POST /api/tests - Create test
router.post('/', teacherOrAdmin, (req, res, next) => {
  console.log('➕ Route hit: POST / (create test)');
  createTest(req, res, next);
});

// GET /api/tests/:id - Get specific test (MUST BE ABSOLUTE LAST!)
router.get('/:id', (req, res, next) => {
  console.log('🔍 Route hit: GET /:id for test:', req.params.id);
  getTestById(req, res, next);
});

export default router;
