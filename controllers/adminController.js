import User from '../models/User.js';
import Subject from '../models/Subject.js';
import Test from '../models/Test.js';
import TestResult from '../models/TestResult.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// GET /api/admin/users - Get all users with filtering
export const getAllUsers = async (req, res) => {
  try {
    const { role, department, search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const filter = { isActive: true };
    if (role) filter.role = role;
    if (department) filter.department = department;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const users = await User.find(filter)
      .populate('subjects', 'name code')
      .select('-password')
      .sort({ [sortBy]: sortDirection })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      users,
      pagination: {
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/admin/teachers - Get all teachers (for TeacherManagement.jsx)
export const getAllTeachers = async (req, res) => {
  try {
    const { search, department, page = 1, limit = 20 } = req.query;

    const filter = { role: 'teacher', isActive: true };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }

    const teachers = await User.find(filter)
      .populate('subjects', 'name code department')
      .select('-password')
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      teachers,
      pagination: {
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total
      }
    });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/admin/subjects - Get all subjects (for SubjectManagement.jsx)
export const getAllSubjects = async (req, res) => {
  try {
    const { department, search, page = 1, limit = 20 } = req.query;

    const filter = { isActive: true };
    if (department) filter.department = department;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    const subjects = await Subject.find(filter)
      .populate('teachers', 'name employeeId')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Subject.countDocuments(filter);

    res.json({
      success: true,
      subjects,
      pagination: {
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total
      }
    });
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// POST /api/admin/teachers - Create new teacher
export const createTeacher = async (req, res) => {
  try {
    const { name, email, password, employeeId, subjects = [], phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: email.toLowerCase().trim() },
        ...(employeeId ? [{ employeeId: employeeId.trim() }] : [])
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email.toLowerCase().trim() 
          ? 'User with this email already exists'
          : 'Teacher with this employee ID already exists'
      });
    }

    const teacher = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      employeeId: employeeId?.trim(),
      role: 'teacher',
      subjects: subjects || [],
      phone: phone?.trim(),
      createdBy: req.user._id
    });

    await teacher.save();

    // Update subjects to include this teacher
    if (subjects && subjects.length > 0) {
      await Subject.updateMany(
        { _id: { $in: subjects } },
        { $addToSet: { teachers: teacher._id } }
      );
    }

    const populatedTeacher = await User.findById(teacher._id)
      .populate('subjects', 'name code')
      .select('-password');

    console.log('✅ Teacher created:', teacher.email);

    res.status(201).json({
      success: true,
      message: 'Teacher created successfully',
      teacher: populatedTeacher
    });
  } catch (error) {
    console.error('Create teacher error:', error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// POST /api/admin/subjects - Create new subject
export const createSubject = async (req, res) => {
  try {
    const { name, code, description, department, credits = 3, teachers = [] } = req.body;

    // Check if subject code already exists
    const existingSubject = await Subject.findOne({ 
      code: code.toUpperCase().trim(),
      isActive: true
    });

    if (existingSubject) {
      return res.status(400).json({
        success: false,
        message: 'Subject with this code already exists'
      });
    }

    const subject = new Subject({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      description: description?.trim(),
      department: department.trim(),
      credits: parseInt(credits),
      teachers: teachers || [],
      createdBy: req.user._id
    });

    await subject.save();

    // Update teachers to include this subject
    if (teachers && teachers.length > 0) {
      await User.updateMany(
        { _id: { $in: teachers }, role: 'teacher' },
        { $addToSet: { subjects: subject._id } }
      );
    }

    const populatedSubject = await Subject.findById(subject._id)
      .populate('teachers', 'name employeeId')
      .populate('createdBy', 'name');

    console.log('✅ Subject created:', subject.code);

    res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      subject: populatedSubject
    });
  } catch (error) {
    console.error('Create subject error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Subject code already exists'
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// PUT /api/admin/users/:id - Update user
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, employeeId, subjects, rollNumber, department, year, phone, address, isActive } = req.body;

    console.log('=== UPDATING USER ===');
    console.log('User ID:', id);

    // Find the user first
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prepare update data
    const updateData = {
      name: name?.trim(),
      email: email?.toLowerCase().trim(),
      employeeId: employeeId?.trim(),
      rollNumber: rollNumber?.trim(),
      department: department?.trim(),
      year: year ? parseInt(year) : user.year,
      phone: phone?.trim(),
      address: address?.trim()
    };

    // Only update password if provided and not empty
    if (password && password.trim() !== '') {
      updateData.password = password;
    }

    // Handle isActive update
    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }

    // Handle subjects for teachers
    if (user.role === 'teacher' && Array.isArray(subjects)) {
      console.log('Updating teacher subjects from', user.subjects, 'to', subjects);

      // Remove teacher from previous subjects
      await Subject.updateMany(
        { teachers: id },
        { $pull: { teachers: id } }
      );

      // Add teacher to new subjects
      if (subjects.length > 0) {
        await Subject.updateMany(
          { _id: { $in: subjects } },
          { $addToSet: { teachers: id } }
        );
      }

      updateData.subjects = subjects;
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('subjects', 'name code').select('-password');

    console.log('✅ User updated successfully');

    res.json({
      success: true,
      message: `${user.role === 'teacher' ? 'Teacher' : user.role === 'student' ? 'Student' : 'User'} updated successfully`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {});
      return res.status(400).json({
        success: false,
        message: `${field || 'Field'} already exists`
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// DELETE /api/admin/users/:id - Delete user (soft delete)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Don't allow deleting admin users
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete admin user'
      });
    }

    // Remove teacher from subjects if they are a teacher
    if (user.role === 'teacher') {
      await Subject.updateMany(
        { teachers: id },
        { $pull: { teachers: id } }
      );
    }

    // Soft delete (set isActive to false)
    await User.findByIdAndUpdate(id, { isActive: false });

    console.log('✅ User deleted:', user.email);

    res.json({
      success: true,
      message: `${user.role === 'teacher' ? 'Teacher' : user.role === 'student' ? 'Student' : 'User'} deleted successfully`
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/admin/dashboard - Get dashboard statistics
export const getDashboardStats = async (req, res) => {
  try {
    // Get counts
    const [studentCount, teacherCount, subjectCount, testCount] = await Promise.all([
      User.countDocuments({ role: 'student', isActive: true }),
      User.countDocuments({ role: 'teacher', isActive: true }),
      Subject.countDocuments({ isActive: true }),
      Test.countDocuments({ isActive: true })
    ]);

    // Get recent activities
    const recentUsers = await User.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt');

    const recentTests = await Test.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('subject', 'name code')
      .populate('createdBy', 'name');

    // Get monthly user registrations
    const monthlyStats = await User.aggregate([
      {
        $match: {
          isActive: true,
          createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } // Last year
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            role: '$role'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get test results summary
    const testResultsStats = await TestResult.aggregate([
      {
        $group: {
          _id: '$grade',
          count: { $sum: 1 }
        }
      }
    ]);

    const gradeDistribution = {};
    testResultsStats.forEach(stat => {
      gradeDistribution[stat._id] = stat.count;
    });

    res.json({
      success: true,
      stats: {
        totalStudents: studentCount,
        totalTeachers: teacherCount,
        totalSubjects: subjectCount,
        totalTests: testCount,
        totalUsers: studentCount + teacherCount
      },
      recentUsers,
      recentTests,
      monthlyStats,
      gradeDistribution
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
