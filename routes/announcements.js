import express from 'express';
import { createAnnouncement, listAnnouncements, updateAnnouncement, deleteAnnouncement, applyToAnnouncement, listApplicants, getAnnouncement, listAnnouncementsWithApplicants } from '../controllers/announcementsController.js';
import { authenticate, adminOnly, studentOnly } from '../middleware/auth.js';

const router = express.Router();

// Public listing (students can view)
router.get('/', listAnnouncements);

// Admin-only create/update/delete
router.post('/', authenticate, adminOnly, createAnnouncement);
router.put('/:id', authenticate, adminOnly, updateAnnouncement);
router.delete('/:id', authenticate, adminOnly, deleteAnnouncement);
// Students can apply to job announcements
router.post('/:id/apply', authenticate, studentOnly, applyToAnnouncement);
// Get single announcement
router.get('/:id', getAnnouncement);
// Admin: list all announcements with applicants
router.get('/applicants/all', authenticate, adminOnly, listAnnouncementsWithApplicants);
// Admin can list applicants
router.get('/:id/applicants', authenticate, adminOnly, listApplicants);

export default router;
