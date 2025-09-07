import mongoose from 'mongoose';
import TestResult from '../models/TestResult.js';
import Test from '../models/Test.js';


export const addOrUpdateMarks = async (req, res) => {
  try {
    let testId = req.params.testId;
    if (typeof testId === 'string') testId = testId.trim();

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(400).json({ success: false, message: 'Invalid test ID format' });
    }

    const { marks } = req.body;
    if (!Array.isArray(marks) || marks.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Marks array is required and cannot be empty'
      });
    }

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    const bulkOps = marks.map(mark => {
      const percentage = (mark.marksObtained / test.maxMarks) * 100;
      const isPassed = mark.marksObtained >= test.passingMarks;

      let grade = 'F';
      if (percentage >= 90) grade = 'A+';
      else if (percentage >= 80) grade = 'A';
      else if (percentage >= 70) grade = 'B+';
      else if (percentage >= 60) grade = 'B';
      else if (percentage >= 50) grade = 'C+';
      else if (percentage >= 40) grade = 'C';
      else if (percentage >= 35) grade = 'D';

      return {
        updateOne: {
          filter: { test: testId, student: mark.student },
          update: {
            $set: {
              marksObtained: mark.marksObtained,
              remarks: mark.remarks || '',
              percentage,
              isPassed,
              grade,
             
            },
            $setOnInsert: {
              submittedAt: new Date(),
              createdAt: new Date(),
              gradedBy: req.user?.id
            }
          },
          upsert: true
        }
      };
    });

    const result = await TestResult.bulkWrite(bulkOps);
    res.json({ success: true, message: 'Marks saved successfully', data: result });
  } catch (error) {
    console.error('Add/update marks error:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to save marks', error: error.message });
  }
};
