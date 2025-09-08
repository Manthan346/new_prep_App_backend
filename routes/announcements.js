import express from 'express';
import { createAnnouncement, listAnnouncements, updateAnnouncement, deleteAnnouncement, applyToAnnouncement, listApplicants, getAnnouncement, listAnnouncementsWithApplicants, getAllJobsAndApplicants } from '../controllers/announcementsController.js';
import { authenticate, adminOnly, studentOnly } from '../middleware/auth.js';

const router = express.Router();

// Public listing (students can view)
router.get('/', listAnnouncements);

// Admin-only create/update/delete
router.post('/', authenticate, adminOnly, createAnnouncement);
router.put('/:id', authenticate, adminOnly, updateAnnouncement);
router.delete('/:id', authenticate, adminOnly, deleteAnnouncement);

// Admin: list all announcements with applicants (specific before :id)
router.get('/applicants/all', authenticate, adminOnly, listAnnouncementsWithApplicants);
// Admin: get all jobs and applicants in one view (specific before :id)
router.get('/jobs/all-applicants', authenticate, adminOnly, getAllJobsAndApplicants);

// Students can apply to job announcements (specific before :id)
router.post('/:id/apply', authenticate, studentOnly, applyToAnnouncement);
// Admin can list applicants for a specific announcement (specific before :id)
router.get('/:id/applicants', authenticate, adminOnly, listApplicants);

// Get single announcement (generic last)
router.get('/:id', getAnnouncement);

export default router;
