import express from 'express';
import { client } from '../../config/db.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import { createCertificateService } from './certificates.service.js';
import { certificateSvg } from './certificates.template.js';
const router = express.Router();
const service = createCertificateService(client.db('SielAlumni'));
const action = handler => async (req, res) => {
  try { res.json({ success: true, data: await handler(req) }); }
  catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to process certificates. Please try again.' }); }
};
router.use(protect);
router.get('/me', action(req => service.listMine(req.user)));
router.get('/participants', authorize('admin'), action(req => service.participants(req.user)));
router.get('/attendance', authorize('admin'), action(req => service.pending(req.user)));
router.get('/issued', authorize('admin'), action(req => service.all(req.user)));
router.post('/participations', authorize('admin'), action(req => service.issue(req.user, req.body.studentAuthId, req.body)));
router.post('/attendance/:id/confirm', authorize('admin'), action(req => service.confirm(req.user, req.params.id, req.body)));
router.get('/:id/download', async (req, res) => {
  try {
    const certificate = await service.get(req.user, req.params.id);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${certificate.certificateNumber}.svg"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(certificateSvg(certificate));
  } catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to download the certificate.' }); }
});
router.get('/:id', action(req => service.get(req.user, req.params.id)));
export default router;
