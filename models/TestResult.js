import mongoose from 'mongoose';

const testResultSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  test: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true
  },
  marksObtained: {
    type: Number,
    required: true,
    min: 0
  },
  isPassed: {
    type: Boolean,
    required: true,
    default: false
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  remarks: {
    type: String,
    maxLength: 500
  }
}, {
  timestamps: true
});

// Indexes for better query performance
testResultSchema.index({ student: 1, test: 1 }, { unique: true }); // Prevent duplicate results
testResultSchema.index({ student: 1, createdAt: -1 });
testResultSchema.index({ test: 1 });

// Virtual for percentage calculation
testResultSchema.virtual('percentage').get(function() {
  if (this.test && this.test.maxMarks) {
    return (this.marksObtained / this.test.maxMarks) * 100;
  }
  return 0;
});

// Pre-save middleware to calculate pass/fail status
testResultSchema.pre('save', async function(next) {
  if (this.isModified('marksObtained') || this.isNew) {
    try {
      const test = await mongoose.model('Test').findById(this.test);
      if (test) {
        this.isPassed = this.marksObtained >= test.passingMarks;
      }
    } catch (error) {
      console.error('Error in TestResult pre-save:', error);
    }
  }
  next();
});

// Static method to get student performance summary
testResultSchema.statics.getStudentPerformanceSummary = async function(studentId) {
  const results = await this.aggregate([
    { $match: { student: new mongoose.Types.ObjectId(studentId) } },
    {
      $lookup: {
        from: 'tests',
        localField: 'test',
        foreignField: '_id',
        as: 'testData'
      }
    },
    { $unwind: '$testData' },
    {
      $group: {
        _id: null,
        totalTests: { $sum: 1 },
        passedTests: {
          $sum: { $cond: ['$isPassed', 1, 0] }
        },
        totalMarks: { $sum: '$marksObtained' },
        totalMaxMarks: { $sum: '$testData.maxMarks' },
        averageScore: { $avg: '$marksObtained' }
      }
    }
  ]);

  return results[0] || {
    totalTests: 0,
    passedTests: 0,
    totalMarks: 0,
    totalMaxMarks: 0,
    averageScore: 0
  };
};

// Static method to get subject-wise performance
testResultSchema.statics.getSubjectWisePerformance = async function(studentId) {
  return await this.aggregate([
    { $match: { student: new mongoose.Types.ObjectId(studentId) } },
    {
      $lookup: {
        from: 'tests',
        localField: 'test',
        foreignField: '_id',
        as: 'testData'
      }
    },
    { $unwind: '$testData' },
    {
      $lookup: {
        from: 'subjects',
        localField: 'testData.subject',
        foreignField: '_id',
        as: 'subjectData'
      }
    },
    { $unwind: '$subjectData' },
    {
      $group: {
        _id: '$subjectData._id',
        subject: { $first: '$subjectData' },
        totalTests: { $sum: 1 },
        passedTests: {
          $sum: { $cond: ['$isPassed', 1, 0] }
        },
        totalMarks: { $sum: '$marksObtained' },
        totalMaxMarks: { $sum: '$testData.maxMarks' },
        averageScore: { $avg: '$marksObtained' },
        results: { $push: '$$ROOT' }
      }
    },
    {
      $project: {
        subject: 1,
        totalTests: 1,
        passedTests: 1,
        totalMarks: 1,
        totalMaxMarks: 1,
        averageScore: 1,
        percentage: {
          $cond: [
            { $gt: ['$totalMaxMarks', 0] },
            { $multiply: [{ $divide: ['$totalMarks', '$totalMaxMarks'] }, 100] },
            0
          ]
        },
        passRate: {
          $cond: [
            { $gt: ['$totalTests', 0] },
            { $multiply: [{ $divide: ['$passedTests', '$totalTests'] }, 100] },
            0
          ]
        },
        results: 1
      }
    }
  ]);
};

const TestResult = mongoose.model('TestResult', testResultSchema);

export default TestResult;