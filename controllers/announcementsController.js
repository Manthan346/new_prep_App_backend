import Announcement from '../models/Announcement.js';
import User from '../models/User.js';
import JobApplication from '../models/JobApplication.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const createAnnouncement = async (req, res) => {
  try {
    const { title, body, type = 'general', isActive = true, isGlobal = true, targetDepartments = [] } = req.body;
    if (!title || !body) return res.status(400).json({ success: false, message: 'Title and body are required' });

    // Normalize targeting
    const normalizedIsGlobal = Boolean(isGlobal) || (Array.isArray(targetDepartments) && targetDepartments.length === 0);
    const normalizedTargets = normalizedIsGlobal ? [] : (Array.isArray(targetDepartments) ? targetDepartments.filter(Boolean) : []);

    const ann = new Announcement({ 
      title, 
      body, 
      type, 
      isActive, 
      createdBy: req.user?._id,
      isGlobal: normalizedIsGlobal,
      targetDepartments: normalizedTargets
    });
    await ann.save();

    res.status(201).json({ success: true, announcement: ann });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to create announcement' });
  }
};

export const listAnnouncements = async (req, res) => {
  try {
    const { type, department } = req.query;
    const filter = { isActive: true };
    if (type) filter.type = type;

    if (department) {
      // Show global or targeted to the provided department
      filter.$or = [
        { isGlobal: true },
        { targetDepartments: department }
      ];
    }

    const announcements = await Announcement.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('createdBy', 'name email');
    res.json({ success: true, announcements });
  } catch (error) {
    console.error('List announcements error:', error);
    res.status(500).json({ success: false, message: 'Failed to list announcements' });
  }
};

export const getAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const ann = await Announcement.findById(id).populate('createdBy', 'name email');
    if (!ann) return res.status(404).json({ success: false, message: 'Announcement not found' });
    res.json({ success: true, announcement: ann });
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to get announcement' });
  }
};

export const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, type, isActive, isGlobal, targetDepartments } = req.body;
    const ann = await Announcement.findById(id);
    if (!ann) return res.status(404).json({ success: false, message: 'Announcement not found' });

    if (title !== undefined) ann.title = title;
    if (body !== undefined) ann.body = body;
    if (type !== undefined) ann.type = type;
    if (isActive !== undefined) ann.isActive = isActive;

    if (isGlobal !== undefined) ann.isGlobal = Boolean(isGlobal);
    if (targetDepartments !== undefined) {
      ann.targetDepartments = Array.isArray(targetDepartments) ? targetDepartments.filter(Boolean) : [];
    }
    if (ann.targetDepartments.length === 0) {
      ann.isGlobal = true;
    }

    await ann.save();
    res.json({ success: true, announcement: ann });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to update announcement' });
  }
};

export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const ann = await Announcement.findById(id);
    if (!ann) return res.status(404).json({ success: false, message: 'Announcement not found' });
    await ann.remove();
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete announcement' });
  }
};

export const applyToAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    console.log(`Received apply request for announcement ${id} from user ${userId}`);
    const ann = await Announcement.findById(id);
    if (!ann) return res.status(404).json({ success: false, message: 'Announcement not found' });
    if (ann.type !== 'job') return res.status(400).json({ success: false, message: 'Only job announcements allow applications' });
    if (ann.applicants && ann.applicants.includes(userId)) {
      return res.status(400).json({ success: false, message: 'Already applied' });
    }
    ann.applicants = ann.applicants || [];
    ann.applicants.push(userId);
    await ann.save();

    // populate applicants for immediate feedback and logging
    const populated = await Announcement.findById(id).populate('applicants', 'name email rollNumber');
    console.log(`Announcement ${id} applicants after apply:`, populated.applicants.map(a => ({ id: a._id, name: a.name, email: a.email })));

    res.json({ success: true, message: 'Applied successfully', applicants: populated.applicants || [] });
  } catch (error) {
    console.error('Apply to announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to apply' });
  }
};

export const listApplicants = async (req, res) => {
  try {
    const { id } = req.params;
    // fetch raw announcement to get stored applicant ids
    const raw = await Announcement.findById(id).select('applicants');
    if (!raw) return res.status(404).json({ success: false, message: 'Announcement not found' });

    // populate applicant user docs
    const populated = await Announcement.findById(id).populate('applicants', 'name email rollNumber');

    // also fetch users directly by IDs as a fallback
    const users = raw.applicants && raw.applicants.length > 0
      ? await User.find({ _id: { $in: raw.applicants } }).select('name email rollNumber')
      : [];

    res.json({ success: true, applicants: populated.applicants || [], applicantIds: raw.applicants || [], users });
  } catch (error) {
    console.error('List applicants error:', error);
    res.status(500).json({ success: false, message: 'Failed to list applicants' });
  }
};

// Admin: list all announcements with populated applicants
export const listAnnouncementsWithApplicants = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = {};
    if (type) filter.type = type;

    const anns = await Announcement.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('createdBy', 'name email')
      .populate('applicants', 'name email rollNumber');

    res.json({ success: true, announcements: anns });
  } catch (error) {
    console.error('List announcements with applicants error:', error);
    res.status(500).json({ success: false, message: 'Failed to list announcements with applicants' });
  }
};

// Admin: get all job announcements with all applicants in one view
export const getAllJobsAndApplicants = async (req, res) => {
  try {
    // Get all job announcements with populated applicants
    const jobAnnouncements = await Announcement.find({ type: 'job' })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .populate('applicants', 'name email rollNumber');

    // Get all students who have applied to any job
    const allApplicantIds = jobAnnouncements.reduce((acc, ann) => {
      if (ann.applicants && ann.applicants.length > 0) {
        ann.applicants.forEach(applicant => {
          const appId = applicant && (applicant._id ?? applicant);
          if (!appId) return;
          const appIdStr = appId.toString ? appId.toString() : String(appId);
          const exists = acc.some(id => (id?.toString ? id.toString() : String(id)) === appIdStr);
          if (!exists) {
            acc.push(appId);
          }
        });
      }
      return acc;
    }, []);

    // Get unique applicants with their details
    const uniqueApplicants = await User.find({ 
      _id: { $in: allApplicantIds } 
    }).select('name email rollNumber createdAt');

    // Create a summary of applications per job
    const jobSummary = jobAnnouncements.map(ann => ({
      _id: ann._id,
      title: ann.title,
      description: ann.body,
      createdBy: ann.createdBy,
      createdAt: ann.createdAt,
      applicantCount: ann.applicants ? ann.applicants.length : 0,
      applicants: ann.applicants || []
    }));

    res.json({ 
      success: true, 
      jobAnnouncements: jobSummary,
      allApplicants: uniqueApplicants,
      totalJobs: jobAnnouncements.length,
      totalApplicants: uniqueApplicants.length
    });
  } catch (error) {
    console.error('Get all jobs and applicants error:', error);
    res.status(500).json({ success: false, message: 'Failed to get all jobs and applicants' });
  }
};

// ===== Resume Upload Handling =====
const uploadsDir = path.join(process.cwd(), 'uploads', 'resumes');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeBase = (file.originalname || 'resume').replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, unique + '-' + safeBase);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow common document types: pdf, doc, docx, txt
  const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
  if (allowed.includes(file.mimetype)) cb(null, true); else cb(new Error('Unsupported file type'));
};

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter });

export const uploadResume = [
  (req, res, next) => upload.single('resume')(req, res, (err) => {
    if (err) return next(err);
    next();
  }),
  async (req, res) => {
    try {
      const { id } = req.params; // announcement id
      const userId = req.user.id;
      const ann = await Announcement.findById(id);
      if (!ann) return res.status(404).json({ success: false, message: 'Announcement not found' });
      if (ann.type !== 'job') return res.status(400).json({ success: false, message: 'Only job announcements accept resumes' });
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

      // Upsert application
      const payload = {
        announcement: id,
        student: userId,
        resumeOriginalName: req.file.originalname,
        resumeMimeType: req.file.mimetype,
        resumePath: path.join('uploads', 'resumes', req.file.filename),
        resumeSize: req.file.size,
      };

      const existing = await JobApplication.findOne({ announcement: id, student: userId });
      if (existing) {
        // Remove previous file if exists
        if (existing.resumePath && fs.existsSync(path.join(process.cwd(), existing.resumePath))) {
          try { fs.unlinkSync(path.join(process.cwd(), existing.resumePath)); } catch {}
        }
        existing.resumeOriginalName = payload.resumeOriginalName;
        existing.resumeMimeType = payload.resumeMimeType;
        existing.resumePath = payload.resumePath;
        existing.resumeSize = payload.resumeSize;
        await existing.save();
      } else {
        await JobApplication.create(payload);
      }

      res.json({ success: true, message: 'Resume uploaded', file: {
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/resumes/${req.file.filename}`
      }});
    } catch (error) {
      console.error('Upload resume error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload resume' });
    }
  }
];

export const listJobApplicationsForAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const ann = await Announcement.findById(id);
    if (!ann) return res.status(404).json({ success: false, message: 'Announcement not found' });
    const apps = await JobApplication.find({ announcement: id })
      .populate('student', 'name email rollNumber');
    const data = apps.map(a => ({
      _id: a._id,
      student: a.student,
      resumeUrl: `/${a.resumePath.replace(/\\/g, '/')}`,
      resumeOriginalName: a.resumeOriginalName,
      resumeMimeType: a.resumeMimeType,
      resumeSize: a.resumeSize,
      createdAt: a.createdAt
    }));
    res.json({ success: true, applications: data });
  } catch (error) {
    console.error('List job applications error:', error);
    res.status(500).json({ success: false, message: 'Failed to list job applications' });
  }
};