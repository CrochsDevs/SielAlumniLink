import { canViewJob } from './jobs.audience.js';
import { isDeadlinePassed } from './jobs.deadline.js';
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const validPdf = file => file && Buffer.isBuffer(file.buffer) && file.buffer.length <= MAX_RESUME_BYTES && file.buffer.subarray(0, 5).toString() === '%PDF-' && file.originalname.toLowerCase().endsWith('.pdf') && (!file.mimetype || ['application/pdf', 'application/octet-stream'].includes(file.mimetype));
const safeFilename = name => name.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(-150);

export function createApplicationHandlers({ jobs, applications, accounts }) {
  const fail = (res, status, message) => res.status(status).json({ success: false, message });
  const download = kind => async (req, res) => {
    try {
      const application = await applications.findById(req.params.applicationId);
      if (!application) return fail(res, 404, 'Application not found.');
      if (req.user.role !== 'admin' && String(req.user._id) !== application.applicantAuthId) return fail(res, 403, 'You cannot access this document.');
      const data = application[`${kind}Data`];
      if (!data) return fail(res, 404, 'This application has no attached document.');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(application[`${kind}Name`] || 'document.pdf')}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(Buffer.isBuffer(data) ? data : Buffer.from(data.buffer));
    } catch { fail(res, 500, 'Unable to download the document.'); }
  };
  return {
    async submit(req, res) {
      try {
        if (!['alumni', 'student'].includes(req.user.role)) return fail(res, 403, 'Only alumni and students can apply.');
        const job = await jobs.findById(req.params.id);
        if (!canViewJob(job, req.user) || isDeadlinePassed(job)) return fail(res, 404, 'This job is no longer accepting applications.');
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim();
        const note = String(req.body.note || '').trim();
        const phone = String(req.body.phone || '').trim();
        if (phone && (!/^\+?[0-9() -]+$/.test(phone) || phone.length > 32 || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15)) return fail(res, 400, 'Enter a valid contact number (7 to 15 digits).');
        if (!name || name.length > 200 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || note.length > 5000) return fail(res, 400, 'Enter a valid name, email, and cover note (up to 5,000 characters).');
        const file = req.files?.resume?.[0] || req.file;
        const coverNote = req.files?.coverNote?.[0];
        if (!validPdf(file)) return fail(res, 400, 'Upload a PDF resume up to 5 MB.');
        if (coverNote && !validPdf(coverNote)) return fail(res, 400, 'Upload a PDF cover note up to 5 MB.');
        if (coverNote && note) return fail(res, 400, 'Choose either a typed cover note or a PDF cover note.');
        const data = await applications.create({ jobId: String(job._id), jobTitle: job.title, company: job.company, jobSnapshot: { _id: String(job._id), title: job.title, company: job.company, description: job.description, descriptionFormat: job.descriptionFormat, applicationDeadline: job.applicationDeadline, audience: job.audience || 'all', location: job.location, type: job.type, mode: job.mode, experienceLevel: job.experienceLevel || '', tags: job.tags, createdAt: job.createdAt }, applicantAuthId: String(req.user._id), name, email, phone, note, resumeName: safeFilename(file.originalname), resumeData: file.buffer, ...(coverNote ? { coverNoteName: safeFilename(coverNote.originalname), coverNoteData: coverNote.buffer } : {}) });
        return res.status(201).json({ success: true, data });
      } catch (error) {
        if (error.code === 11000) return fail(res, 409, 'You have already applied for this job.');
        return fail(res, 500, 'Unable to submit your application. Please try again.');
      }
    },
    async mine(req, res) {
      try { res.json({ success: true, data: await applications.findMine(req.user._id) }); }
      catch { fail(res, 500, 'Unable to load your applications.'); }
    },
    async list(req, res) {
      if (req.user.role !== 'admin') return fail(res, 403, 'Only administrators can view applicants.');
      try {
        const records = await applications.findByJob(req.params.id);
        const data = await Promise.all(records.map(async application => {
          const account = accounts && application.applicantAuthId ? await accounts.findById(application.applicantAuthId) : null;
          return { ...application, messageEmail: account?.email || null };
        }));
        res.json({ success: true, data });
      }
      catch { fail(res, 500, 'Unable to load applicants.'); }
    },
    resume: download('resume'),
    coverNote: download('coverNote'),
  };
}
