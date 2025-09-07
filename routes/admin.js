import express from 'express';
import { body } from 'express-validator';
import {
  getAllUsers,
  getAllTeachers,
  getAllSubjects,
  createTeacher,
  createSubject,
  updateUser,
  deleteUser,
  getDashboardStats
} from '../controllers/adminController.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

// Apply authentication and admin authorization to all routes
router.use(authenticate);
router.use(adminOnly);

// Validation middleware
const teacherValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('employeeId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Employee ID is required'),
  body('subjects')
    .optional()
    .isArray()
    .withMessage('Subjects must be an array'),
  handleValidationErrors
];

const subjectValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Subject name must be between 2 and 100 characters'),
  body('code')
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('Subject code must be between 2 and 20 characters'),
  body('department')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Department is required'),
  body('credits')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Credits must be between 1 and 10'),
  body('teachers')
    .optional()
    .isArray()
    .withMessage('Teachers must be an array'),
  handleValidationErrors
];

// GET ROUTES
router.get('/users', getAllUsers);
router.get('/teachers', getAllTeachers); // For TeacherManagement.jsx
router.get('/subjects', getAllSubjects); // For SubjectManagement.jsx  
router.get('/dashboard', getDashboardStats);

// POST ROUTES (Create)
router.post('/teachers', teacherValidation, createTeacher);
router.post('/subjects', subjectValidation, createSubject);

// PUT ROUTES (Update)
router.put('/users/:id', updateUser);

// DELETE ROUTES
router.delete('/users/:id', deleteUser);

export default router;
