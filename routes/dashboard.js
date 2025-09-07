import express from 'express';
import User from '../models/User.js';
import Test from '../models/Test.js';
import Subject from '../models/Subject.js';
import TestResult from '../models/TestResult.js';
import { authenticate, adminOnly, studentOrTeacherAdmin, teacherOnly } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all dashboard routes
router.use(authenticate);

// Student Dashboard - accessible by student, teacher, admin
router.get('/student', studentOrTeacherAdmin, async (req, res) => {
  try {
    const studentId = req.user.id;

    const student = await User.findById(studentId)
      .select('-password')
      .populate('subjects', 'name code');

    const subjects = await Subject.find({
      isActive: true,
      $or: [
        { department: student.department },
        { isGlobal: true }
      ]
    }).populate('teachers', 'name employeeId');

    const subjectIds = subjects.map(s => s._id);
    const tests = await Test.find({
      subject: { $in: subjectIds },
      isActive: true
    }).populate('subject', 'name code').sort({ testDate: -1 });

    const testResults = await TestResult.find({ student: studentId })
      .populate({
        path: 'test',
        populate: {
          path: 'subject',
          select: 'name code'
        }
      })
      .sort({ createdAt: -1 });

    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.isPassed).length;
    const averagePercentage = totalTests > 0
      ? testResults.reduce((sum, r) => sum + r.percentage, 0) / totalTests
      : 0;

    const stats = {
      totalSubjects: subjects.length,
      totalTests: tests.length,
      completedTests: testResults.length,
      passedTests,
      averagePercentage: parseFloat(averagePercentage.toFixed(1)),
      upcomingTests: tests.filter(t => new Date(t.testDate) > new Date()).length
    };

    res.json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: student.name,
          email: student.email,
          rollNumber: student.rollNumber,
          department: student.department,
          year: student.year
        },
        stats,
        subjects,
        recentTests: tests.slice(0, 5),
        upcomingTests: tests.filter(t => new Date(t.testDate) > new Date()).slice(0, 3),
        recentResults: testResults.slice(0, 5)
      }
    });
  } catch (error) {
    console.error('Student dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading student dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Teacher Dashboard - teacher only
router.get('/teacher', teacherOnly, async (req, res) => {
  try {
    const teacherId = req.user.id;

    const teacher = await User.findById(teacherId)
      .select('-password')
      .populate('subjects', 'name code');

    const subjects = await Subject.find({ teachers: teacherId, isActive: true });

    const tests = await Test.find({ createdBy: teacherId, isActive: true })
      .populate('subject', 'name code')
      .sort({ testDate: -1 });

    const studentCount = await User.countDocuments({ role: 'student', isActive: true });

    const testIds = tests.map(t => t._id);
    const recentResults = await TestResult.find({ test: { $in: testIds } })
      .populate('student', 'name rollNumber')
      .populate('test', 'title maxMarks')
      .sort({ createdAt: -1 })
      .limit(10);

    const stats = {
      totalSubjects: subjects.length,
      totalTests: tests.length,
      totalStudents: studentCount,
      upcomingTests: tests.filter(t => new Date(t.testDate) > new Date()).length,
      recentlyGraded: recentResults.length
    };

    res.json({
      success: true,
      data: {
        teacher: {
          id: teacher._id,
          name: teacher.name,
          email: teacher.email,
          employeeId: teacher.employeeId
        },
        stats,
        subjects,
        recentTests: tests.slice(0, 5),
        upcomingTests: tests.filter(t => new Date(t.testDate) > new Date()).slice(0, 3),
        recentResults: recentResults.slice(0, 5)
      }
    });
  } catch (error) {
    console.error('Teacher dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading teacher dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin Dashboard - admin only
router.get('/admin', adminOnly, async (req, res) => {
  try {
    const [studentCount, teacherCount, subjectCount, testCount] = await Promise.all([
      User.countDocuments({ role: 'student', isActive: true }),
      User.countDocuments({ role: 'teacher', isActive: true }),
      Subject.countDocuments({ isActive: true }),
      Test.countDocuments({ isActive: true })
    ]);

    const recentUsers = await User.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt');

    const recentTests = await Test.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('subject', 'name code')
      .populate('createdBy', 'name');

    const performanceStats = await TestResult.aggregate([
      {
        $group: {
          _id: '$grade',
          count: { $sum: 1 }
        }
      }
    ]);

    const gradeDistribution = {};
    performanceStats.forEach(stat => {
      gradeDistribution[stat._id] = stat.count;
    });

    const stats = {
      totalStudents: studentCount,
      totalTeachers: teacherCount,
      totalSubjects: subjectCount,
      totalTests: testCount,
      totalUsers: studentCount + teacherCount
    };

    res.json({
      success: true,
      data: {
        stats,
        recentUsers,
        recentTests,
        gradeDistribution
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading admin dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// General dashboard route
router.get('/', async (req, res) => {
  try {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, message: 'Unauthorized: user not authenticated or role missing' });
    }
    const { role } = req.user;

    switch (role) {
      case 'student':
        return res.redirect('/api/dashboard/student');
      case 'teacher':
        return res.redirect('/api/dashboard/teacher');
      case 'admin':
        return res.redirect('/api/dashboard/admin');
      default:
        return res.status(400).json({ success: false, message: 'Unknown user role' });
    }
  } catch (error) {
    console.error('Dashboard route error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
