import express from 'express';
import { body } from 'express-validator';
import {
  login,
  register,
  getProfile,
  updateProfile,
  verifyToken,
  loginValidation,
  registerValidation
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    success: true,
    message: 'Auth routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Public routes
router.post('/login', loginValidation, login);
router.post('/register', registerValidation, register);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.get('/verify', authenticate, verifyToken);

export default router;
