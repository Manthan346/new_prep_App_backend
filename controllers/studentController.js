import TestResult from '../models/TestResult.js';
import Test from '../models/Test.js';
import Subject from '../models/Subject.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// GET /api/students - Get all students (for MarksEntryModal.jsx)
export const getAllStudents = async (req, res) => {
  try {
    const { department, year, search, page = 1, limit = 50 } = req.query;

    const filter = { role: 'student', isActive: true };

    if (department) filter.department = department;
    if (year) filter.year = parseInt(year);
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const students = await User.find(filter)
      .select('-password')
      .sort({ name: 1, rollNumber: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      students,
      pagination: {
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get student dashboard data
export const getStudentDashboard = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get recent test results
    const recentResults = await TestResult.find({ student: studentId })
      .populate({
        path: 'test',
        populate: {
          path: 'subject',
          select: 'name code'
        }
      })
      .sort({ createdAt: -1 })
      .limit(5);

    // Get upcoming tests for student's department
    const upcomingTests = await Test.find({
      testDate: { $gte: new Date() },
      isActive: true
    })
      .populate('subject', 'name code department')
      .populate('createdBy', 'name')
      .sort({ testDate: 1 })
      .limit(5);

    // Get subjects for student's department
    const subjects = await Subject.find({
      $or: [
        { department: req.user.department },
        { isGlobal: true }
      ],
      isActive: true
    })
      .populate('teachers', 'name employeeId')
      .sort({ name: 1 });

    // Calculate overall performance
    const allResults = await TestResult.find({ student: studentId })
      .populate('test', 'maxMarks passingMarks');

    let totalMarks = 0;
    let totalMaxMarks = 0;
    let passedTests = 0;
    let totalTests = allResults.length;
    const gradeCount = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C+': 0, 'C': 0, 'D': 0, 'F': 0 };

    allResults.forEach(result => {
      totalMarks += result.marksObtained;
      totalMaxMarks += result.test.maxMarks;
      if (result.isPassed) passedTests++;
      if (result.grade) gradeCount[result.grade]++;
    });

    const overallPercentage = totalTests > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    // Get subject-wise performance
    const subjectPerformance = await TestResult.aggregate([
      { $match: { student: new mongoose.Types.ObjectId(studentId) } },
      {
        $lookup: {
          from: 'tests',
          localField: 'test',
          foreignField: '_id',
          as: 'testInfo'
        }
      },
      { $unwind: '$testInfo' },
      {
        $lookup: {
          from: 'subjects',
          localField: 'testInfo.subject',
          foreignField: '_id',
          as: 'subject'
        }
      },
      { $unwind: '$subject' },
      {
        $group: {
          _id: '$subject._id',
          subject: { $first: '$subject' },
          totalMarks: { $sum: '$marksObtained' },
          totalMaxMarks: { $sum: '$testInfo.maxMarks' },
          totalTests: { $sum: 1 },
          passedTests: { $sum: { $cond: ['$isPassed', 1, 0] } },
          averageGrade: { $push: '$grade' }
        }
      },
      {
        $addFields: {
          percentage: { 
            $round: [
              { $multiply: [{ $divide: ['$totalMarks', '$totalMaxMarks'] }, 100] },
              1
            ] 
          },
          passRate: { 
            $round: [
              { $multiply: [{ $divide: ['$passedTests', '$totalTests'] }, 100] },
              1
            ] 
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        student: {
          name: req.user.name,
          rollNumber: req.user.rollNumber,
          department: req.user.department,
          year: req.user.year
        },
        performance: {
          overallPercentage: parseFloat(overallPercentage.toFixed(1)),
          passRate: parseFloat(passRate.toFixed(1)),
          totalTests,
          passedTests,
          gradeDistribution: gradeCount
        },
        recentResults,
        upcomingTests,
        subjects: subjects.slice(0, 6), // Limit for dashboard
        subjectPerformance
      }
    });
  } catch (error) {
    console.error('Student dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get student's test results with filtering
export const getStudentResults = async (req, res) => {
  try {
    const { page = 1, limit = 10, subject, testType, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const studentId = req.user._id;

    // Build aggregation pipeline
    const pipeline = [
      { $match: { student: new mongoose.Types.ObjectId(studentId) } },
      {
        $lookup: {
          from: 'tests',
          localField: 'test',
          foreignField: '_id',
          as: 'test'
        }
      },
      { $unwind: '$test' },
      {
        $lookup: {
          from: 'subjects',
          localField: 'test.subject',
          foreignField: '_id',
          as: 'subject'
        }
      },
      { $unwind: '$subject' }
    ];

    // Add filters
    if (subject) {
      pipeline.push({
        $match: { 'subject._id': new mongoose.Types.ObjectId(subject) }
      });
    }

    if (testType) {
      pipeline.push({
        $match: { 'test.testType': testType }
      });
    }

    // Add sorting
    const sortField = sortBy === 'testDate' ? 'test.testDate' : sortBy;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    pipeline.push({ $sort: { [sortField]: sortDirection } });

    // Add pagination
    const skip = (page - 1) * limit;
    pipeline.push(
      { $skip: skip },
      { $limit: parseInt(limit) }
    );

    const results = await TestResult.aggregate(pipeline);

    // Get total count for pagination
    const countPipeline = pipeline.slice(0, -2); // Remove skip and limit
    countPipeline.push({ $count: 'total' });
    const totalResult = await TestResult.aggregate(countPipeline);
    const total = totalResult[0]?.total || 0;

    res.json({
      success: true,
      results,
      pagination: {
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get student results error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 📊 NEW: Get my results (for currently logged-in student)
export const getMyResults = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { subject, testType, year } = req.query;

    // Build match filter
    const matchFilter = { student: new mongoose.Types.ObjectId(studentId) };

    const pipeline = [
      { $match: matchFilter },
      {
        $lookup: {
          from: 'tests',
          localField: 'test',
          foreignField: '_id',
          as: 'test'
        }
      },
      { $unwind: '$test' },
      {
        $lookup: {
          from: 'users',
          localField: 'gradedBy',
          foreignField: '_id',
          as: 'gradedBy'
        }
      },
      {
        $project: {
          _id: 1,
          test: {
            _id: '$test._id',
            title: '$test.title',
            subject: '$test.subject',
            testType: '$test.testType',
            testDate: '$test.testDate',
            maxMarks: '$test.maxMarks',
            passingMarks: '$test.passingMarks'
          },
          student: '$student',
          marksObtained: 1,
          percentage: 1,
          grade: 1,
          status: { $cond: ['$isPassed', 'passed', 'failed'] },
          remarks: 1,
          submittedAt: '$createdAt',
          gradedBy: { $arrayElemAt: ['$gradedBy.name', 0] }
        }
      },
      { $sort: { submittedAt: -1 } }
    ];

    // Add additional filters if provided
    if (subject) {
      pipeline.splice(3, 0, {
        $match: { 'test.subject': new mongoose.Types.ObjectId(subject) }
      });
    }

    if (testType) {
      pipeline.splice(3, 0, {
        $match: { 'test.testType': testType }
      });
    }

    const results = await TestResult.aggregate(pipeline);

    // Calculate statistics
    const stats = {
      totalTests: results.length,
      passedTests: results.filter(r => r.status === 'passed').length,
      averagePercentage: results.length > 0 
        ? parseFloat((results.reduce((sum, r) => sum + r.percentage, 0) / results.length).toFixed(1))
        : 0,
      highestScore: results.length > 0 
        ? Math.max(...results.map(r => r.percentage))
        : 0,
      lowestScore: results.length > 0 
        ? Math.min(...results.map(r => r.percentage))
        : 0
    };

    res.json({
      success: true,
      results,
      stats,
      message: `Found ${results.length} test results`
    });
  } catch (error) {
    console.error('Get my results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your results',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 🎯 NEW: Get specific student's results (for admin/teacher)
export const getStudentResultsById = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Check if user has permission
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only view your own results'
      });
    }

    // Verify student exists
    const student = await User.findById(studentId).select('name rollNumber department');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const results = await TestResult.find({ student: studentId })
      .populate({
        path: 'test',
        select: 'title subject testType testDate maxMarks passingMarks'
      })
      .populate('gradedBy', 'name')
      .sort({ createdAt: -1 });

    // Transform results
    const transformedResults = results.map(result => ({
      _id: result._id,
      test: {
        _id: result.test._id,
        title: result.test.title,
        subject: result.test.subject,
        testType: result.test.testType,
        testDate: result.test.testDate,
        maxMarks: result.test.maxMarks,
        passingMarks: result.test.passingMarks
      },
      student: result.student,
      marksObtained: result.marksObtained,
      percentage: result.percentage,
      grade: result.grade,
      status: result.isPassed ? 'passed' : 'failed',
      remarks: result.remarks,
      submittedAt: result.createdAt,
      gradedBy: result.gradedBy?.name
    }));

    res.json({
      success: true,
      student,
      results: transformedResults,
      total: transformedResults.length
    });
  } catch (error) {
    console.error('Get student results by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student results',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 📈 NEW: Get specific test result for student
export const getMyTestResult = async (req, res) => {
  try {
    const { testId } = req.params;
    const studentId = req.user._id;

    const result = await TestResult.findOne({
      test: testId,
      student: studentId
    })
      .populate({
        path: 'test',
        select: 'title subject testType testDate maxMarks passingMarks instructions'
      })
      .populate('gradedBy', 'name role');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Test result not found'
      });
    }

    const transformedResult = {
      _id: result._id,
      test: {
        _id: result.test._id,
        title: result.test.title,
        subject: result.test.subject,
        testType: result.test.testType,
        testDate: result.test.testDate,
        maxMarks: result.test.maxMarks,
        passingMarks: result.test.passingMarks,
        instructions: result.test.instructions
      },
      marksObtained: result.marksObtained,
      percentage: result.percentage,
      grade: result.grade,
      status: result.isPassed ? 'passed' : 'failed',
      remarks: result.remarks,
      submittedAt: result.createdAt,
      gradedBy: result.gradedBy
    };

    res.json({
      success: true,
      result: transformedResult
    });
  } catch (error) {
    console.error('Get my test result error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test result',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 📊 NEW: Get results analysis for student
export const getResultsAnalysis = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get all results
    const results = await TestResult.find({ student: studentId })
      .populate({
        path: 'test',
        select: 'title subject testType testDate maxMarks'
      })
      .sort({ createdAt: -1 });

    if (results.length === 0) {
      return res.json({
        success: true,
        analysis: {
          totalTests: 0,
          averageScore: 0,
          improvement: 0,
          strengths: [],
          recommendations: []
        }
      });
    }

    // Calculate monthly progress
    const monthlyData = {};
    const subjectData = {};
    const gradeDistribution = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C+': 0, 'C': 0, 'D': 0, 'F': 0 };

    results.forEach(result => {
      const month = result.createdAt.toISOString().slice(0, 7);
      const subject = result.test.subject?.toString();

      // Monthly progress
      if (!monthlyData[month]) {
        monthlyData[month] = { totalMarks: 0, totalMaxMarks: 0, count: 0 };
      }
      monthlyData[month].totalMarks += result.marksObtained;
      monthlyData[month].totalMaxMarks += result.test.maxMarks;
      monthlyData[month].count++;

      // Subject performance
      if (!subjectData[subject]) {
        subjectData[subject] = { totalMarks: 0, totalMaxMarks: 0, count: 0, name: result.test.subject };
      }
      subjectData[subject].totalMarks += result.marksObtained;
      subjectData[subject].totalMaxMarks += result.test.maxMarks;
      subjectData[subject].count++;

      // Grade distribution
      if (result.grade) gradeDistribution[result.grade]++;
    });

    // Calculate improvement trend (comparing first 3 and last 3 results)
    const recentResults = results.slice(0, 3);
    const earlierResults = results.slice(-3);
    const recentAvg = recentResults.reduce((sum, r) => sum + r.percentage, 0) / recentResults.length;
    const earlierAvg = earlierResults.reduce((sum, r) => sum + r.percentage, 0) / earlierResults.length;
    const improvement = recentAvg - earlierAvg;

    // Find strengths and weaknesses
    const subjectPerformances = Object.values(subjectData).map(s => ({
      subject: s.name,
      percentage: (s.totalMarks / s.totalMaxMarks) * 100
    }));

    const strengths = subjectPerformances
      .filter(s => s.percentage >= 80)
      .map(s => s.subject);

    const needsImprovement = subjectPerformances
      .filter(s => s.percentage < 60)
      .map(s => s.subject);

    res.json({
      success: true,
      analysis: {
        totalTests: results.length,
        averageScore: results.reduce((sum, r) => sum + r.percentage, 0) / results.length,
        improvement,
        gradeDistribution,
        monthlyProgress: Object.entries(monthlyData).map(([month, data]) => ({
          month,
          percentage: (data.totalMarks / data.totalMaxMarks) * 100,
          testsCount: data.count
        })).sort((a, b) => a.month.localeCompare(b.month)),
        subjectPerformance: subjectPerformances,
        strengths,
        needsImprovement,
        recommendations: [
          ...(improvement > 0 ? ['Keep up the good work! Your performance is improving.'] : []),
          ...(improvement < -5 ? ['Consider reviewing your study methods and seek help from teachers.'] : []),
          ...(strengths.length > 0 ? [`You excel in: ${strengths.join(', ')}`] : []),
          ...(needsImprovement.length > 0 ? [`Focus more on: ${needsImprovement.join(', ')}`] : [])
        ]
      }
    });
  } catch (error) {
    console.error('Get results analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate analysis',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get student performance by ID (for teachers and admin)
export const getStudentPerformance = async (req, res) => {
  try {
    const studentId = req.params.id || req.user._id;

    const student = await User.findOne({ 
      _id: studentId, 
      role: 'student',
      isActive: true 
    }).select('-password');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check permissions (students can only view their own performance)
    if (req.user.role === 'student' && studentId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get all test results for this student
    const results = await TestResult.find({ student: studentId })
      .populate({
        path: 'test',
        populate: {
          path: 'subject',
          select: 'name code'
        }
      })
      .populate('gradedBy', 'name role')
      .sort({ createdAt: -1 });

    // Calculate subject-wise performance
    const subjectPerformance = {};
    const monthlyPerformance = {};

    results.forEach(result => {
      const subjectId = result.test.subject._id.toString();
      const month = result.createdAt.toISOString().slice(0, 7); // YYYY-MM

      // Subject-wise stats
      if (!subjectPerformance[subjectId]) {
        subjectPerformance[subjectId] = {
          subject: result.test.subject,
          totalMarks: 0,
          totalMaxMarks: 0,
          totalTests: 0,
          passedTests: 0,
          results: []
        };
      }

      const perf = subjectPerformance[subjectId];
      perf.totalMarks += result.marksObtained;
      perf.totalMaxMarks += result.test.maxMarks;
      perf.totalTests++;
      if (result.isPassed) perf.passedTests++;
      perf.results.push(result);

      // Monthly performance
      if (!monthlyPerformance[month]) {
        monthlyPerformance[month] = {
          month,
          totalMarks: 0,
          totalMaxMarks: 0,
          testsCount: 0
        };
      }

      monthlyPerformance[month].totalMarks += result.marksObtained;
      monthlyPerformance[month].totalMaxMarks += result.test.maxMarks;
      monthlyPerformance[month].testsCount++;
    });

    // Calculate percentages
    Object.keys(subjectPerformance).forEach(subjectId => {
      const perf = subjectPerformance[subjectId];
      perf.percentage = perf.totalMaxMarks > 0 ? 
        parseFloat(((perf.totalMarks / perf.totalMaxMarks) * 100).toFixed(1)) : 0;
      perf.passRate = perf.totalTests > 0 ? 
        parseFloat(((perf.passedTests / perf.totalTests) * 100).toFixed(1)) : 0;
    });

    // Calculate monthly percentages
    Object.keys(monthlyPerformance).forEach(month => {
      const perf = monthlyPerformance[month];
      perf.percentage = perf.totalMaxMarks > 0 ? 
        parseFloat(((perf.totalMarks / perf.totalMaxMarks) * 100).toFixed(1)) : 0;
    });

    res.json({
      success: true,
      student,
      overallResults: results,
      subjectPerformance: Object.values(subjectPerformance),
      monthlyPerformance: Object.values(monthlyPerformance)
        .sort((a, b) => a.month.localeCompare(b.month))
    });
  } catch (error) {
    console.error('Get student performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
