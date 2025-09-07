// controllers/testController.js - Updated for Current Codebase

import mongoose from 'mongoose';
import Test from '../models/Test.js';
import TestResult from '../models/TestResult.js';
import User from '../models/User.js';
import Subject from '../models/Subject.js';

// GET /api/tests - Get all tests with filtering and pagination
export const getAllTests = async (req, res) => {
  try {
    console.log('📚 Getting all tests...');
    
    const {
      page = 1,
      limit = 50,
      subject,
      testType,
      department,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      upcoming = false
    } = req.query;

    // Build filter
    const filter = { isActive: true };

    if (subject) {
      filter.subject = subject;
    }

    if (testType) {
      filter.testType = testType;
    }

    if (department) {
      filter.department = department;
    }

    if (upcoming === 'true') {
      filter.testDate = { $gte: new Date() };
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { venue: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortDirection };

    // Execute query with population
    const tests = await Test.find(filter)
      .populate('createdBy', 'name email role')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Test.countDocuments(filter);

    // Add result count for each test
    const testsWithResults = await Promise.all(
      tests.map(async (test) => {
        const resultCount = await TestResult.countDocuments({ 
          test: test._id, 
          isActive: true 
        });
        return { ...test, resultCount };
      })
    );

    console.log(`✅ Found ${testsWithResults.length} tests`);

    res.json({
      success: true,
      tests: testsWithResults,
      pagination: {
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('❌ Get tests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/tests/:id - Get test by ID
export const getTestById = async (req, res) => {
  try {
    console.log(`🔍 Getting test by ID: ${req.params.id}`);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid test ID format'
      });
    }

    const test = await Test.findOne({ 
      _id: req.params.id, 
      isActive: true 
    })
      .populate('createdBy', 'name email role')
      .lean();

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Get result count
    const resultCount = await TestResult.countDocuments({ 
      test: test._id, 
      isActive: true 
    });

    console.log(`✅ Found test: ${test.title}`);

    res.json({
      success: true,
      test: { ...test, resultCount }
    });
  } catch (error) {
    console.error('❌ Get test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get test',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// POST /api/tests - Create new test
export const createTest = async (req, res) => {
  try {
    console.log('=== CREATING TEST ===');
    console.log('Request body:', req.body);
    console.log('User:', req.user?.name, req.user?.role);

    const {
      title,
      subject,
      testType,
      maxMarks,
      passingMarks,
      testDate,
      examTime,
      duration,
      venue,
      instructions,
      syllabus
    } = req.body;

    // Validation
    const errors = [];

    if (!title?.trim()) errors.push('Title is required');
    if (!subject?.trim()) errors.push('Subject is required');
    if (!testType) errors.push('Test type is required');
    if (!testDate) errors.push('Test date is required');
    if (!venue?.trim()) errors.push('Venue is required');

    // Validate marks
    const maxMarksNum = parseInt(maxMarks);
    const passingMarksNum = parseInt(passingMarks);

    if (!maxMarks || isNaN(maxMarksNum) || maxMarksNum <= 0) {
      errors.push('Valid maximum marks (greater than 0) required');
    }
    if (!passingMarks || isNaN(passingMarksNum) || passingMarksNum < 0) {
      errors.push('Valid passing marks (0 or greater) required');
    }
    if (maxMarksNum && passingMarksNum && passingMarksNum >= maxMarksNum) {
      errors.push('Passing marks must be less than maximum marks');
    }

    if (errors.length > 0) {
      console.log('❌ Validation errors:', errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Create test document
    const testData = {
      title: title.trim(),
      subject: subject.trim(),
      testType,
      maxMarks: maxMarksNum,
      passingMarks: passingMarksNum,
      testDate: new Date(testDate),
      examTime: examTime || '09:00',
      duration: parseInt(duration) || 180,
      venue: venue.trim(),
      instructions: instructions?.trim() || '',
      syllabus: syllabus?.trim() || '',
      createdBy: req.user._id,
      isActive: true
    };

    const newTest = new Test(testData);
    const savedTest = await newTest.save();

    // Populate for response
    await savedTest.populate('createdBy', 'name email role');

    console.log(`✅ Test created successfully: ${savedTest.title}`);

    res.status(201).json({
      success: true,
      message: 'Test created successfully',
      test: savedTest
    });

  } catch (error) {
    console.error('❌ Create test error:', error);

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      return res.status(400).json({
        success: false,
        message: `A test with this ${field} already exists`
      });
    }

    // Handle validation errors
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
      message: 'Failed to create test',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// PUT /api/tests/:id - Update test
export const updateTest = async (req, res) => {
  try {
    console.log(`📝 Updating test: ${req.params.id}`);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid test ID format'
      });
    }

    const test = await Test.findOne({ 
      _id: req.params.id, 
      isActive: true 
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Check permissions (only creator or admin can update)
    if (req.user.role !== 'admin' && test.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this test'
      });
    }

    const updateData = { ...req.body };
    delete updateData._id;
    updateData.updatedAt = new Date();

    // Validate if marks are being updated
    if (updateData.maxMarks && updateData.passingMarks) {
      const maxMarks = parseInt(updateData.maxMarks);
      const passingMarks = parseInt(updateData.passingMarks);
      
      if (passingMarks >= maxMarks) {
        return res.status(400).json({
          success: false,
          message: 'Passing marks must be less than maximum marks'
        });
      }
    }

    const updatedTest = await Test.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email role');

    console.log(`✅ Test updated: ${updatedTest.title}`);

    res.json({
      success: true,
      message: 'Test updated successfully',
      test: updatedTest
    });
  } catch (error) {
    console.error('❌ Update test error:', error);

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
      message: 'Failed to update test',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// DELETE /api/tests/:id - Delete test (soft delete)
export const deleteTest = async (req, res) => {
  try {
    console.log(`🗑️ Deleting test: ${req.params.id}`);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid test ID format'
      });
    }

    const test = await Test.findOne({ 
      _id: req.params.id, 
      isActive: true 
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && test.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this test'
      });
    }

    // Check if test has results
    const hasResults = await TestResult.exists({ test: req.params.id, isActive: true });
    if (hasResults) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete test that has submitted results'
      });
    }

    // Soft delete
    await Test.findByIdAndUpdate(req.params.id, { 
      isActive: false,
      deletedAt: new Date(),
      deletedBy: req.user._id
    });

    console.log(`✅ Test deleted: ${test.title}`);

    res.json({
      success: true,
      message: 'Test deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete test',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 🆕 GET /api/tests/:id/marks - Get existing marks for a test
export const getTestMarks = async (req, res) => {
  try {
    console.log(`📊 Getting existing marks for test: ${req.params.id}`);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid test ID format'
      });
    }

    // Get existing results
    const existingResults = await TestResult.find({ 
      test: req.params.id, 
      isActive: true 
    })
    .populate('student', 'name rollNumber email')
    .populate('gradedBy', 'name role')
    .sort({ 'student.rollNumber': 1 });

    console.log(`✅ Found ${existingResults.length} existing results`);

    // Transform to match frontend format
    const marksData = existingResults.map(result => ({
      studentId: result.student._id,
      studentName: result.student.name,
      rollNumber: result.student.rollNumber,
      marksObtained: result.marksObtained,
      remarks: result.remarks || '',
      percentage: result.percentage,
      grade: result.grade,
      status: result.isPassed ? 'passed' : 'failed',
      gradedAt: result.gradedAt,
      gradedBy: result.gradedBy?.name
    }));

    res.json({
      success: true,
      marks: marksData,
      total: marksData.length,
      message: `Found marks for ${marksData.length} students`
    });

  } catch (error) {
    console.error('❌ Get test marks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get test marks',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/tests/:id/results - Get test results (FIXED)
export const getTestResults = async (req, res) => {
  try {
    console.log(`📊 Getting results for test: ${req.params.id}`);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid test ID format'
      });
    }

    const test = await Test.findOne({ 
      _id: req.params.id, 
      isActive: true 
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Get results with populated student data - FIXED: Use direct query instead of static method
    const results = await TestResult.find({ test: req.params.id, isActive: true })
      .populate('student', 'name rollNumber email')
      .populate('gradedBy', 'name role')
      .sort({ percentage: -1 });

    console.log(`✅ Found ${results.length} results`);

    res.json({
      success: true,
      results,
      test: {
        _id: test._id,
        title: test.title,
        subject: test.subject,
        maxMarks: test.maxMarks,
        passingMarks: test.passingMarks,
        testDate: test.testDate
      },
      total: results.length
    });
  } catch (error) {
    console.error('❌ Get results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get results',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// POST /api/tests/:id/marks - Submit test marks (FIXED)
export const submitTestMarks = async (req, res) => {
  try {
    console.log('\n🎯 === SUBMIT MARKS START ===');
    console.log('📝 Test ID:', req.params.id);
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
    console.log('👤 User:', req.user?.name, '| Role:', req.user?.role);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid test ID format'
      });
    }

    const { results } = req.body;

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Results array is required and cannot be empty'
      });
    }

    const test = await Test.findOne({ 
      _id: req.params.id, 
      isActive: true 
    });

    console.log('📚 Test found:', test ? test.title : 'NOT FOUND');

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    const savedResults = [];
    const errors = [];

    // Process each result
    for (let i = 0; i < results.length; i++) {
      const resultData = results[i];
      console.log(`\n🔄 Processing result ${i + 1}/${results.length}:`, resultData);

      try {
        const { student, marksObtained, remarks } = resultData;

        // Validate student exists
        const studentExists = await User.findOne({ 
          _id: student, 
          role: 'student', 
          isActive: true 
        });

        if (!studentExists) {
          console.log(`❌ Student not found: ${student}`);
          errors.push(`Student with ID ${student} not found`);
          continue;
        }

        console.log(`👤 Student found: ${studentExists.name}`);

        // Validate marks
        const marks = parseFloat(marksObtained);
        if (isNaN(marks) || marks < 0 || marks > test.maxMarks) {
          console.log(`❌ Invalid marks: ${marksObtained}`);
          errors.push(`Invalid marks ${marksObtained} for student ${studentExists.name}`);
          continue;
        }

        // Create the TestResult with all required fields
        const testResultData = {
          test: req.params.id,
          student,
          marksObtained: marks,
          maxMarks: test.maxMarks,
          passingMarks: test.passingMarks,
          remarks: remarks?.trim() || '',
          gradedBy: req.user._id,
          gradedAt: new Date(),
          isActive: true,
          academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
        };

        console.log('💾 Saving TestResult:', testResultData);

        // Create or update test result
        const resultDoc = await TestResult.findOneAndUpdate(
          { test: req.params.id, student },
          testResultData,
          { 
            upsert: true, 
            new: true, 
            runValidators: true 
          }
        );

        console.log('✅ TestResult saved:', {
          id: resultDoc._id,
          marksObtained: resultDoc.marksObtained,
          percentage: resultDoc.percentage,
          grade: resultDoc.grade,
          isPassed: resultDoc.isPassed
        });

        // Populate student data for response
        await resultDoc.populate('student', 'name rollNumber email');
        savedResults.push(resultDoc);

      } catch (err) {
        console.error(`❌ Error processing result ${i + 1}:`, err);
        errors.push(`Failed to save marks for student ${resultData.student}: ${err.message}`);
      }
    }

    // Update test's result count
    const totalResults = await TestResult.countDocuments({ 
      test: req.params.id, 
      isActive: true 
    });

    await Test.findByIdAndUpdate(req.params.id, { 
      resultCount: totalResults,
      lastMarksUpdate: new Date()
    });

    // Proper response structure
    const response = {
      success: true,
      message: `Successfully processed ${results.length} results`,
      processed: savedResults.length,
      errors: errors.length,
      data: {
        test: {
          id: test._id,
          title: test.title,
          maxMarks: test.maxMarks,
          passingMarks: test.passingMarks
        },
        results: savedResults.map(r => ({
          id: r._id,
          student: {
            id: r.student._id,
            name: r.student.name,
            rollNumber: r.student.rollNumber
          },
          marksObtained: r.marksObtained,
          maxMarks: r.maxMarks,
          percentage: r.percentage,
          grade: r.grade,
          status: r.isPassed ? 'passed' : 'failed',
          remarks: r.remarks,
          submittedAt: r.gradedAt
        }))
      }
    };

    if (errors.length > 0) {
      response.errorDetails = errors;
    }

    console.log('✅ === MARKS SUBMISSION COMPLETE ===');
    console.log(`📊 Summary: ${savedResults.length} saved, ${errors.length} errors`);

    res.json(response);

  } catch (error) {
    console.error('❌ Submit marks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit marks',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/tests/:id/statistics - Get detailed test statistics
export const getTestStatistics = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid test ID format'
      });
    }

    const test = await Test.findOne({ 
      _id: req.params.id, 
      isActive: true 
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Direct statistics calculation
    const results = await TestResult.find({ test: req.params.id, isActive: true });
    
    const stats = {
      totalStudents: results.length,
      averageMarks: results.length > 0 ? (results.reduce((sum, r) => sum + r.marksObtained, 0) / results.length).toFixed(1) : 0,
      averagePercentage: results.length > 0 ? (results.reduce((sum, r) => sum + r.percentage, 0) / results.length).toFixed(1) : 0,
      passRate: results.length > 0 ? ((results.filter(r => r.isPassed).length / results.length) * 100).toFixed(1) : 0,
      highestMarks: results.length > 0 ? Math.max(...results.map(r => r.marksObtained)) : 0,
      lowestMarks: results.length > 0 ? Math.min(...results.map(r => r.marksObtained)) : 0,
      gradeDistribution: results.reduce((dist, r) => {
        dist[r.grade] = (dist[r.grade] || 0) + 1;
        return dist;
      }, {})
    };

    res.json({
      success: true,
      test: {
        title: test.title,
        subject: test.subject,
        maxMarks: test.maxMarks,
        passingMarks: test.passingMarks
      },
      statistics: stats
    });

  } catch (error) {
    console.error('❌ Get statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
