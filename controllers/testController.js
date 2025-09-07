// controllers/testController.js - Complete Fixed Version

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
      .populate('subject', 'name code')
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
      .populate('subject', 'name code')
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
      syllabus,
      description
    } = req.body;

    // Validation
    const errors = [];

    if (!title?.trim()) errors.push('Title is required');
    if (!subject?.trim()) errors.push('Subject is required');
    if (!testType) errors.push('Test type is required');
    if (!testDate) errors.push('Test date is required');

    // Validate marks
    const maxMarksNum = parseInt(maxMarks);
    const passingMarksNum = parseInt(passingMarks);

    if (!maxMarks || isNaN(maxMarksNum) || maxMarksNum <= 0) {
      errors.push('Valid maximum marks (greater than 0) required');
    }
    if (!passingMarks || isNaN(passingMarksNum) || passingMarksNum < 0) {
      errors.push('Valid passing marks (0 or greater) required');
    }
    if (maxMarksNum && passingMarksNum && passingMarksNum > maxMarksNum) {
      errors.push('Passing marks must be less than or equal to maximum marks');
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
      venue: venue?.trim() || 'TBD',
      instructions: instructions?.trim() || '',
      syllabus: syllabus?.trim() || '',
      description: description?.trim() || '',
      createdBy: req.user.id, // Fixed: use req.user.id
      isActive: true
    };

    const newTest = new Test(testData);
    const savedTest = await newTest.save();

    // Populate for response
    await savedTest.populate('subject', 'name code');
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
    if (req.user.role !== 'admin' && test.createdBy.toString() !== req.user.id.toString()) {
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
      
      if (passingMarks > maxMarks) {
        return res.status(400).json({
          success: false,
          message: 'Passing marks must be less than or equal to maximum marks'
        });
      }
    }

    const updatedTest = await Test.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('subject', 'name code')
      .populate('createdBy', 'name email role');

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
    if (req.user.role !== 'admin' && test.createdBy.toString() !== req.user.id.toString()) {
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
      deletedBy: req.user.id
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

// POST /api/tests/:id/marks - Add test marks (FIXED)
export const addTestMarks = async (req, res) => {
  try {
    console.log('\n🎯 === ADD TEST MARKS START ===');
    console.log('📝 Test ID:', req.params.id);
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
    console.log('👤 User:', req.user?.name, '| Role:', req.user?.role);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid test ID format'
      });
    }

    const { marks } = req.body; // Expect array of { studentId, marksObtained }

    if (!Array.isArray(marks) || marks.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Marks array is required and cannot be empty'
      });
    }

    const test = await Test.findOne({ 
      _id: req.params.id, 
      isActive: true 
    }).populate('subject', 'name code');

    console.log('📚 Test found:', test ? test.title : 'NOT FOUND');

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    const savedResults = [];
    const errors = [];

    // Process each mark entry
    for (let i = 0; i < marks.length; i++) {
      const markData = marks[i];
      console.log(`\n🔄 Processing mark ${i + 1}/${marks.length}:`, markData);

      try {
        const { studentId, marksObtained } = markData;

        // Validate student exists
        const student = await User.findOne({ 
          _id: studentId, 
          role: 'student', 
          isActive: true 
        });

        if (!student) {
          console.log(`❌ Student not found: ${studentId}`);
          errors.push(`Student with ID ${studentId} not found`);
          continue;
        }

        console.log(`👤 Student found: ${student.name}`);

        // Validate marks
        const marksNum = parseFloat(marksObtained);
        if (isNaN(marksNum) || marksNum < 0 || marksNum > test.maxMarks) {
          console.log(`❌ Invalid marks: ${marksObtained}`);
          errors.push(`Invalid marks ${marksObtained} for student ${student.name}`);
          continue;
        }

        // Calculate if passed
        const isPassed = marksNum >= test.passingMarks;

        // Create or update TestResult
        let testResult = await TestResult.findOne({
          test: req.params.id,
          student: studentId
        });

        if (testResult) {
          // Update existing result
          testResult.marksObtained = marksNum;
          testResult.isPassed = isPassed;
          testResult.gradedBy = req.user.id;
          testResult.gradedAt = new Date();
          await testResult.save();
          console.log('✅ Updated existing result');
        } else {
          // Create new result
          testResult = new TestResult({
            test: req.params.id,
            student: studentId,
            marksObtained: marksNum,
            isPassed,
            gradedBy: req.user.id,
            gradedAt: new Date(),
            submittedAt: new Date()
          });
          await testResult.save();
          console.log('✅ Created new result');
        }

        // Populate student data for response
        await testResult.populate('student', 'name email rollNumber');

        savedResults.push({
          studentId,
          studentName: student.name,
          marksObtained: marksNum,
          isPassed,
          status: testResult.isNew ? 'created' : 'updated'
        });

      } catch (err) {
        console.error(`❌ Error processing mark ${i + 1}:`, err);
        errors.push(`Failed to save marks for student: ${err.message}`);
      }
    }

    console.log('✅ === MARKS ADDITION COMPLETE ===');
    console.log(`📊 Summary: ${savedResults.length} saved, ${errors.length} errors`);

    res.json({
      success: true,
      message: 'Marks processed successfully',
      results: savedResults,
      errors: errors.length > 0 ? errors : null,
      totalProcessed: savedResults.length,
      totalErrors: errors.length
    });

  } catch (error) {
    console.error('❌ Add test marks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add marks',
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
    }).populate('subject', 'name code');

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Get results with populated student data
    const results = await TestResult.find({ test: req.params.id })
      .populate('student', 'name rollNumber email')
      .populate('gradedBy', 'name role')
      .sort({ 'student.name': 1 });

    console.log(`✅ Found ${results.length} results`);

    // Calculate summary statistics
    const summary = {
      totalStudents: results.length,
      passedStudents: results.filter(r => r.isPassed).length,
      averageMarks: results.length > 0 
        ? (results.reduce((sum, r) => sum + r.marksObtained, 0) / results.length).toFixed(2)
        : 0
    };

    res.json({
      success: true,
      test,
      results,
      summary,
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
    }).populate('subject', 'name code');

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Get all results for statistics
    const results = await TestResult.find({ test: req.params.id });
    
    if (results.length === 0) {
      return res.json({
        success: true,
        test: {
          title: test.title,
          subject: test.subject,
          maxMarks: test.maxMarks,
          passingMarks: test.passingMarks
        },
        statistics: {
          totalStudents: 0,
          averageMarks: 0,
          averagePercentage: 0,
          passRate: 0,
          highestMarks: 0,
          lowestMarks: 0,
          gradeDistribution: {}
        }
      });
    }

    // Calculate statistics
    const totalMarks = results.reduce((sum, r) => sum + r.marksObtained, 0);
    const passedCount = results.filter(r => r.isPassed).length;
    
    const stats = {
      totalStudents: results.length,
      averageMarks: (totalMarks / results.length).toFixed(1),
      averagePercentage: ((totalMarks / (results.length * test.maxMarks)) * 100).toFixed(1),
      passRate: ((passedCount / results.length) * 100).toFixed(1),
      highestMarks: Math.max(...results.map(r => r.marksObtained)),
      lowestMarks: Math.min(...results.map(r => r.marksObtained)),
      gradeDistribution: results.reduce((dist, r) => {
        const percentage = (r.marksObtained / test.maxMarks) * 100;
        let grade = 'F';
        if (percentage >= 90) grade = 'A+';
        else if (percentage >= 80) grade = 'A';
        else if (percentage >= 70) grade = 'B';
        else if (percentage >= 60) grade = 'C';
        else if (percentage >= 50) grade = 'D';
        
        dist[grade] = (dist[grade] || 0) + 1;
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