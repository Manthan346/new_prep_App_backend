import Announcement from '../models/Announcement.js';
import User from '../models/User.js';

export const createAnnouncement = async (req, res) => {
  try {
    const { title, body, type = 'general', isActive = true } = req.body;
    if (!title || !body) return res.status(400).json({ success: false, message: 'Title and body are required' });

    const ann = new Announcement({ title, body, type, isActive, createdBy: req.user?._id });
    await ann.save();

    res.status(201).json({ success: true, announcement: ann });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to create announcement' });
  }
};

export const listAnnouncements = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { isActive: true };
    if (type) filter.type = type;

    const announcements = await Announcement.find(filter).sort({ createdAt: -1 }).limit(50).populate('createdBy', 'name email');
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
    const { title, body, type, isActive } = req.body;
    const ann = await Announcement.findById(id);
    if (!ann) return res.status(404).json({ success: false, message: 'Announcement not found' });

    if (title !== undefined) ann.title = title;
    if (body !== undefined) ann.body = body;
    if (type !== undefined) ann.type = type;
    if (isActive !== undefined) ann.isActive = isActive;

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
