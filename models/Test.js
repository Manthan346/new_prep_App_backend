// models/Test.js - More flexible subject handling

import mongoose from 'mongoose';

const testSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Test title is required'],
    trim: true,
    maxlength: [150, 'Title cannot exceed 150 characters']
  },
  subject: {
    type: mongoose.Schema.Types.Mixed, // Allow both ObjectId and String
    required: [true, 'Subject is required']
  },
  testType: {
    type: String,
    required: [true, 'Test type is required'],
    enum: {
      values: ['midterm', 'final', 'supplementary', 'practical'],
      message: 'Test type must be midterm, final, supplementary, or practical'
    }
  },
  testDate: {
    type: Date,
    required: [true, 'Test date is required']
  },
  examTime: {
    type: String,
    default: '09:00'
  },
  duration: {
    type: Number,
    default: 180,
    min: [30, 'Duration must be at least 30 minutes'],
    max: [480, 'Duration cannot exceed 8 hours']
  },
  venue: {
    type: String,
    required: [true, 'Venue is required'],
    trim: true,
    maxlength: [100, 'Venue cannot exceed 100 characters']
  },
  maxMarks: {
    type: Number,
    required: [true, 'Maximum marks is required'],
    min: [1, 'Maximum marks must be at least 1'],
    max: [1000, 'Maximum marks cannot exceed 1000']
  },
  passingMarks: {
    type: Number,
    required: [true, 'Passing marks is required'],
    min: [0, 'Passing marks cannot be negative']
  },
  instructions: {
    type: String,
    trim: true,
    maxlength: [500, 'Instructions cannot exceed 500 characters'],
    default: ''
  },
  syllabus: {
    type: String,
    trim: true,
    maxlength: [1000, 'Syllabus coverage cannot exceed 1000 characters'],
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Pre-save validation
testSchema.pre('save', function(next) {
  if (this.passingMarks >= this.maxMarks) {
    const error = new Error('Passing marks must be less than maximum marks');
    error.name = 'ValidationError';
    next(error);
  } else {
    next();
  }
});

export default mongoose.model('Test', testSchema);
