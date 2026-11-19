import express from 'express';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import { community, errorData } from './community.runtime.js';

export function communityRoutes(service = community) {
  const router = express.Router();
  const action = handler => async (req, res) => {
    try { res.json({ success: true, data: await handler(req) }); }
    catch (error) { res.status(error.status || 500).json(errorData(error)); }
  };
  router.use(protect);
  router.get('/me', action(req => service.ownStatus(req.user)));
  router.get('/cases/:id', action(req => service.detail(req.user, req.params.id)));
  router.post('/cases/:id/appeals', action(req => service.appeal(req.user, req.params.id, req.body)));
  router.use('/admin', authorize('admin'));
  router.get('/admin/stats', action(req => service.stats(req.user)));
  router.get('/admin/settings', action(async req => ({ policy: await service.settings(req.user), provider: service.providerStatus() })));
  router.put('/admin/settings', action(req => service.saveSettings(req.user, req.body)));
  router.get('/admin/cases', action(req => service.list(req.user, req.query)));
  router.get('/admin/cases/:id', action(req => service.detail(req.user, req.params.id)));
  router.patch('/admin/cases/:id', action(req => service.review(req.user, req.params.id, req.body)));
  router.post('/admin/cases/:id/restrictions', action(req => service.changeRestriction(req.user, req.params.id, req.body)));
  router.get('/admin/users/:id', action(req => service.userHistory(req.user, req.params.id)));
  router.get('/admin/appeals', action(req => service.listAppeals(req.user, req.query)));
  router.patch('/admin/appeals/:id', action(req => service.reviewAppeal(req.user, req.params.id, req.body)));
  router.patch('/admin/restrictions/:id/restore', action(req => service.restore(req.user, req.params.id, req.body)));
  router.get('/admin/audit', action(req => service.auditList(req.user, req.query)));
  router.get('/admin/cases/:id/images/:index', async (req, res) => {
    try {
      const asset = await service.image(req.user, req.params.id, req.params.index);
      let bytes, type;
      if (asset.bytes) { bytes = Buffer.isBuffer(asset.bytes) ? asset.bytes : Buffer.from(asset.bytes.buffer); type = asset.contentType; }
      else {
        const url = new URL(asset.url);
        if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') throw new Error('Invalid evidence host');
        const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(7000) });
        if (!response.ok) throw new Error('Evidence unavailable');
        type = (response.headers.get('content-type') || '').split(';')[0];
        bytes = Buffer.from(await response.arrayBuffer());
      }
      if (!/^image\/(?:jpeg|png|gif|webp)$/.test(type) || bytes.length > 10 * 1024 * 1024) throw new Error('Invalid evidence image');
      res.set({ 'Content-Type': type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }).send(bytes);
    } catch (error) { res.status(error.status || 502).json(errorData(error)); }
  });
  return router;
}
export default communityRoutes();
