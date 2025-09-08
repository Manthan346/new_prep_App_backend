import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  body: { type: String, required: true, trim: true },
  type: { type: String, enum: ['general','job','notice'], default: 'general' },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  applicants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Targeting
  isGlobal: { type: Boolean, default: true }, // if true, visible to all departments
  targetDepartments: [{ type: String, trim: true }] // if not global, restrict to these departments
}, { timestamps: true });

export default mongoose.model('Announcement', announcementSchema);
