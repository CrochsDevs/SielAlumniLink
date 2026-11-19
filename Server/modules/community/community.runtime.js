import { communityEvents } from './community.events.js';
import { client } from '../../config/db.js';
import NotificationModel from '../notifications/notifications.models.js';
import { createCommunityService } from './community.service.js';

export const community = createCommunityService(client.db('SielAlumni'), {
  notify: async ({ userId, title, body, link, key }) => {
    const notice = await NotificationModel.notify({ recipientAuthId: userId, title, body, link, kind: 'community_moderation', dedupKey: key });
    if (notice) (await import('../../realtime/socket.js')).emitToUser(userId, 'notification:new', notice);
  },
  changed: () => { communityEvents.emit('changed'); void import('../../realtime/socket.js').then(({ getIO }) => { getIO()?.emit('community:changed'); getIO()?.emit('feed:changed'); }); },
});

export const errorData = error => ({ success: false, message: error.status ? error.message : 'Unable to complete the moderation request.',
  ...(error.code && typeof error.code === 'string' ? { code: error.code } : {}),
  ...(error.restriction ? { restriction: error.restriction } : {}), ...(error.caseId ? { caseId: error.caseId } : {}),
  ...(error.decision ? { decision: error.decision } : {}), ...(error.appealUrl ? { appealUrl: error.appealUrl } : {}) });

// Authentication calls this on every protected request, so newly imposed and
// expired restrictions take effect without trusting sessions or React state.
export async function enforceCommunityRequest(req, service = community) {
  const path = (req.originalUrl || '').split('?')[0];
  if (!path || /^\/api\/(?:auth|community)(?:\/|$)/.test(path) || path === '/api/users/me') return;
  await service.assertAllowed(req.user, 'social');
  if (['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(req.method)) return;
  if (/^\/api\/feed/.test(path)) {
    if (/\/(?:report|state)$/.test(path) || path.includes('/post-reports')) return;
    await service.assertAllowed(req.user, path.endsWith('/send') ? 'messaging' : 'posting');
  } else if (/^\/api\/conversations/.test(path)) await service.assertAllowed(req.user, 'messaging');
  else if (/^\/api\/connections/.test(path)) {
    if (req.method === 'PUT') { if (req.body?.status === 'accepted') await service.assertAllowed(req.user, 'connection_accept'); }
    else await service.assertAllowed(req.user, 'connections');
  } else if (/^\/api\/upload/.test(path)) await service.assertAllowed(req.user, path.includes('feed-image') ? 'posting' : 'profile');
  else if (/^\/api\/(?:career-posts|referrals|jobs|events|announcements|meetings)/.test(path)) {
    await service.assertAllowed(req.user, 'posting');
    if (/^\/api\/(?:career-posts|referrals|jobs|events|announcements)(?:\/[a-f0-9]{24})?$/i.test(path)) {
      const text = ['title', 'body', 'description', 'content', 'company', 'organization', 'link', 'location'].filter(key => typeof req.body?.[key] === 'string').map(key => req.body[key]).join('\n');
      if (text.trim()) await service.check(req.user, { type: 'public_content', text });
    }
  }
}

export async function enforceCommunityPacket(socket, packet, next, service = community) {
  try {
    const event = String(packet[0]);
    if (['presence:set', 'presence:watch'].includes(event)) { await service.assertAllowed(socket.user, 'social'); next(); return; }
    await service.assertAllowed(socket.user, 'social');
    if (/^(?:call:|group-call:|meeting:|message:|conversation:)/.test(event) && !/(?:leave|end|decline)$/.test(event)) await service.assertAllowed(socket.user, 'messaging');
    next();
  } catch (error) {
    const data = errorData(error);
    const ack = packet.at(-1);
    if (typeof ack === 'function') ack(data);
    socket.emit('community:restricted', data);
    // Drop this packet. next(error) would emit an unhandled socket error on
    // clients that only subscribe to application acknowledgements.
  }
}

export const imageInput = file => {
  if (!file?.buffer?.length) return [];
  const bytes = file.buffer;
  const type = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
    : bytes[0] === 255 && bytes[1] === 216 ? 'jpeg'
      : /^GIF8/.test(bytes.toString('ascii', 0, 4)) ? 'gif'
        : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null;
  return type ? [`data:image/${type};base64,${bytes.toString('base64')}`] : [];
};
