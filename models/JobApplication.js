import mongoose from 'mongoose';

const jobApplicationSchema = new mongoose.Schema({
  announcement: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resumeOriginalName: { type: String, required: true },
  resumeMimeType: { type: String, required: true },
  resumePath: { type: String, required: true },
  resumeSize: { type: Number, required: true },
}, { timestamps: true });

jobApplicationSchema.index({ announcement: 1, student: 1 }, { unique: true });

export default mongoose.model('JobApplication', jobApplicationSchema);


