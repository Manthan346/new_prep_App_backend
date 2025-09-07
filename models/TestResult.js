// src/models/TestResult.js

import mongoose from 'mongoose';

const testResultSchema = new mongoose.Schema({
  test: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: [true, 'Test reference is required'],
    index: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student reference is required'],
    index: true
  },
  marksObtained: {
    type: Number,
    required: [true, 'Marks obtained is required'],
    min: [0, 'Marks cannot be negative']
  },
  maxMarks: {
    type: Number,
    required: [true, 'Maximum marks is required'],
    min: [1, 'Maximum marks must be at least 1']
  },
  passingMarks: {
    type: Number,
    required: [true, 'Passing marks is required'],
    min: [0, 'Passing marks cannot be negative']
  },
  percentage: {
    type: Number,
    min: 0,
    max: 100
  },
  grade: {
    type: String,
    enum: {
      values: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'],
      message: 'Grade must be one of: A+, A, B+, B, C+, C, D, F'
    }
  },
  isPassed: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: {
      values: ['passed', 'failed'],
      message: 'Status must be either passed or failed'
    },
    default: function() {
      return this.isPassed ? 'passed' : 'failed';
    }
  },
  remarks: {
    type: String,
    trim: true,
    maxlength: [500, 'Remarks cannot exceed 500 characters'],
    default: ''
  },
  submittedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
    // Made optional - will be set when marks are submitted
  },
  gradedAt: {
    type: Date,
    default: Date.now
  },
  // Additional metadata
  isActive: {
    type: Boolean,
    default: true
  },
  // Academic year for better organization
  academicYear: {
    type: String,
    default: function() {
      const year = new Date().getFullYear();
      return `${year}-${year + 1}`;
    }
  }
}, {
  timestamps: true,
  // Add virtuals to JSON output
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for getting pass/fail status as string
testResultSchema.virtual('statusText').get(function() {
  return this.isPassed ? 'Passed' : 'Failed';
});

// Virtual for getting formatted percentage
testResultSchema.virtual('formattedPercentage').get(function() {
  return `${this.percentage}%`;
});

// Virtual for getting marks display
testResultSchema.virtual('marksDisplay').get(function() {
  return `${this.marksObtained}/${this.maxMarks}`;
});

// Pre-save middleware to calculate percentage, grade, and status
testResultSchema.pre('save', async function(next) {
  try {
    // Calculate percentage
    if (this.isModified('marksObtained') || this.isModified('maxMarks') || this.isNew) {
      if (this.maxMarks && this.maxMarks > 0) {
        this.percentage = Math.round((this.marksObtained / this.maxMarks) * 100 * 100) / 100; // Round to 2 decimal places
      } else {
        this.percentage = 0;
      }

      // Calculate grade based on percentage
      if (this.percentage >= 90) this.grade = 'A+';
      else if (this.percentage >= 80) this.grade = 'A';
      else if (this.percentage >= 70) this.grade = 'B+';
      else if (this.percentage >= 60) this.grade = 'B';
      else if (this.percentage >= 50) this.grade = 'C+';
      else if (this.percentage >= 40) this.grade = 'C';
      else if (this.percentage >= 35) this.grade = 'D';
      else this.grade = 'F';

      // Check if passed
      this.isPassed = this.marksObtained >= this.passingMarks;
      
      // Set status
      this.status = this.isPassed ? 'passed' : 'failed';
    }

    // Set gradedAt when marks are being updated
    if (this.isModified('marksObtained') && !this.isNew) {
      this.gradedAt = new Date();
    }

    next();
  } catch (error) {
    console.error('TestResult pre-save error:', error);
    next(error);
  }
});

// Static method to get student's results with populated data
testResultSchema.statics.getStudentResults = function(studentId, options = {}) {
  const query = this.find({ student: studentId, isActive: true });
  
  if (options.populate) {
    query.populate([
      {
        path: 'test',
        select: 'title subject testType testDate maxMarks passingMarks instructions',
        populate: {
          path: 'subject',
          select: 'name code department'
        }
      },
      {
        path: 'gradedBy',
        select: 'name role'
      }
    ]);
  }
  
  if (options.sort) {
    query.sort(options.sort);
  } else {
    query.sort({ createdAt: -1 });
  }
  
  if (options.limit) {
    query.limit(options.limit);
  }
  
  return query;
};

// Static method to get test results with student data
testResultSchema.statics.getTestResults = function(testId, options = {}) {
  const query = this.find({ test: testId, isActive: true });
  
  if (options.populate) {
    query.populate([
      {
        path: 'student',
        select: 'name rollNumber email department year'
      },
      {
        path: 'gradedBy',
        select: 'name role'
      }
    ]);
  }
  
  if (options.sort) {
    query.sort(options.sort);
  } else {
    query.sort({ marksObtained: -1 }); // Highest marks first
  }
  
  return query;
};

// Static method to calculate class statistics
testResultSchema.statics.getClassStatistics = async function(testId) {
  const results = await this.find({ test: testId, isActive: true });
  
  if (results.length === 0) {
    return {
      totalStudents: 0,
      averageMarks: 0,
      averagePercentage: 0,
      passRate: 0,
      highestMarks: 0,
      lowestMarks: 0,
      gradeDistribution: {}
    };
  }
  
  const totalMarks = results.reduce((sum, result) => sum + result.marksObtained, 0);
  const totalPercentage = results.reduce((sum, result) => sum + result.percentage, 0);
  const passedCount = results.filter(result => result.isPassed).length;
  
  const gradeDistribution = results.reduce((dist, result) => {
    dist[result.grade] = (dist[result.grade] || 0) + 1;
    return dist;
  }, {});
  
  return {
    totalStudents: results.length,
    averageMarks: Math.round((totalMarks / results.length) * 100) / 100,
    averagePercentage: Math.round((totalPercentage / results.length) * 100) / 100,
    passRate: Math.round((passedCount / results.length) * 100 * 100) / 100,
    highestMarks: Math.max(...results.map(r => r.marksObtained)),
    lowestMarks: Math.min(...results.map(r => r.marksObtained)),
    gradeDistribution
  };
};

// Compound index to ensure one result per student per test
testResultSchema.index({ test: 1, student: 1 }, { unique: true });

// Additional indexes for better query performance
testResultSchema.index({ student: 1, createdAt: -1 });
testResultSchema.index({ student: 1, submittedAt: -1 });
testResultSchema.index({ test: 1, marksObtained: -1 });
testResultSchema.index({ test: 1, percentage: -1 });
testResultSchema.index({ gradedBy: 1, gradedAt: -1 });
testResultSchema.index({ isPassed: 1, grade: 1 });
testResultSchema.index({ academicYear: 1, createdAt: -1 });

// Text index for searching
testResultSchema.index({
  remarks: 'text'
});

export default mongoose.model('TestResult', testResultSchema);
