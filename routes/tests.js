import express from 'express';
import {
  getAllTests,
  getTestById,
  createTest,
  updateTest,
  deleteTest,
  getTestResults,
  getTestStatistics
} from '../controllers/testController.js';
import { authenticate, teacherOrAdmin } from '../middleware/auth.js';
import { addOrUpdateMarks } from '../controllers/MarksController.js';

const router = express.Router();
router.use(authenticate);

console.log('🔧 Tests routes loaded successfully');

// Bulk upsert marks
router.post('/:testId/marks', teacherOrAdmin, addOrUpdateMarks);

// Specific routes (order matters)
router.get('/:testId/statistics', teacherOrAdmin, getTestStatistics);
router.get('/:testId/results', teacherOrAdmin, getTestResults);
router.put('/:testId', teacherOrAdmin, updateTest);
router.delete('/:testId', teacherOrAdmin, deleteTest);

// General test routes
router.get('/', getAllTests);
router.post('/', teacherOrAdmin, createTest);

// Catch-all get by ID must come last
router.get('/:testId', getTestById);

export default router;
