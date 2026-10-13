export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export function createApplicationHandlers({ jobs, applications }) {
  const fail = (res, status, message) => res.status(status).json({ success: false, message });
  return {
    async submit(req, res) {
      try {
        if (!['alumni', 'student'].includes(req.user.role)) return fail(res, 403, 'Only alumni and students can apply.');
        const job = await jobs.findById(req.params.id);
        if (!job || !job.isActive) return fail(res, 404, 'This job is no longer accepting applications.');
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim();
        const note = String(req.body.note || '').trim();
        if (!name || name.length > 200 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || note.length > 5000) return fail(res, 400, 'Enter a valid name, email, and cover note (up to 5,000 characters).');
        const file = req.file;
        if (!file || file.buffer.length > MAX_RESUME_BYTES || file.buffer.subarray(0, 5).toString() !== '%PDF-' || !file.originalname.toLowerCase().endsWith('.pdf')) return fail(res, 400, 'Upload a PDF resume up to 5 MB.');
        const data = await applications.create({ jobId: String(job._id), jobTitle: job.title, company: job.company, jobSnapshot: { _id: String(job._id), title: job.title, company: job.company, description: job.description, location: job.location, type: job.type, mode: job.mode, tags: job.tags, createdAt: job.createdAt }, applicantAuthId: String(req.user._id), name, email, note, resumeName: file.originalname.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(-150), resumeData: file.buffer });
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
      try { res.json({ success: true, data: await applications.findByJob(req.params.id) }); }
      catch { fail(res, 500, 'Unable to load applicants.'); }
    },
    async resume(req, res) {
      try {
        const application = await applications.findById(req.params.applicationId);
        if (!application) return fail(res, 404, 'Application not found.');
        if (req.user.role !== 'admin' && String(req.user._id) !== application.applicantAuthId) return fail(res, 403, 'You cannot access this resume.');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${application.resumeName}"`);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.send(Buffer.isBuffer(application.resumeData) ? application.resumeData : Buffer.from(application.resumeData.buffer));
      } catch { fail(res, 500, 'Unable to download this resume.'); }
    },
  };
}
