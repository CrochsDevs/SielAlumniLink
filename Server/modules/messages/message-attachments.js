import { ObjectId } from 'mongodb';
import { imageFormat } from '../feed/feed.images.js';

export const MAX_CHAT_FILE_BYTES = 10 * 1024 * 1024;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

export async function uploadMessageAttachment(file, user, conversationId, upload) {
  if (!file) return null;
  if (!file.buffer?.length || file.buffer.length > MAX_CHAT_FILE_BYTES) fail(400, 'Choose a file up to 10 MB.');
  const format = imageFormat(file.buffer);
  const image = !!format;
  if (!image && file.mimetype?.startsWith('image/')) fail(400, 'Choose a valid JPG, PNG, GIF, or WebP image.');
  const asset = await upload(file.buffer, {
    folder: `alumnilink/messages/${conversationId}/${user._id}`,
    resource_type: image ? 'image' : 'raw', type: 'authenticated',
    ...(image ? {} : { public_id: `${new ObjectId()}.${(file.originalname.match(/\.([a-z0-9]{1,10})$/i)?.[1] || 'bin').toLowerCase()}` }),
  });
  return { kind: image ? 'image' : 'file', name: String(file.originalname || 'attachment').slice(0, 120),
    url: asset.secure_url, publicId: asset.public_id, resourceType: image ? 'image' : 'raw', deliveryType: 'authenticated',
    format: image ? asset.format || format : undefined, width: asset.width, height: asset.height, bytes: file.buffer.length };
}

export const messageAttachmentDto = message => {
  const attachment = message.attachment;
  if (!attachment) return null;
  // Legacy inline attachments remain readable. New assets only use the protected route.
  if (!attachment.publicId) return attachment;
  return { kind: attachment.kind, name: attachment.name, width: attachment.width, height: attachment.height,
    bytes: attachment.bytes, url: `/api/conversations/${message.conversationId}/messages/${message._id}/attachment` };
};

export function createMessageAttachmentDownload(db, signedUrl, fetchAsset = fetch) {
  return async (req, res) => {
    try {
      if (![req.params.id, req.params.messageId].every(id => typeof id === 'string' && ObjectId.isValid(id))) fail(404, 'Attachment not found');
      const conversationId = new ObjectId(req.params.id);
      const conversation = await db.collection('conversations').findOne({ _id: conversationId, 'participants.authId': String(req.user._id) });
      if (!conversation) fail(404, 'Attachment not found');
      const preference = await db.collection('conversation_preferences').findOne({ _id: JSON.stringify([req.params.id, String(req.user._id)]) });
      const message = await db.collection('messages').findOne({ _id: new ObjectId(req.params.messageId), conversationId,
        unsent: { $ne: true }, ...(preference?.clearedAt ? { createdAt: { $gt: preference.clearedAt } } : {}) });
      if (!message?.attachment?.publicId) fail(404, 'Attachment not found');
      const attachment = message.attachment;
      const upstream = await fetchAsset(signedUrl(attachment), { signal: AbortSignal.timeout(20000) });
      if (!upstream.ok) fail(502, 'Attachment is temporarily unavailable');
      const contentType = attachment.kind === 'image' ? (upstream.headers.get('content-type') || '').split(';')[0] : 'application/octet-stream';
      if (attachment.kind === 'image' && !/^image\/(jpeg|png|gif|webp)$/.test(contentType)) fail(502, 'Image could not be displayed');
      const bytes = Buffer.from(await upstream.arrayBuffer());
      res.set({ 'Content-Type': contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
        ...(attachment.kind === 'file' ? { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.name).replace(/['()*]/g, character => '%' + character.charCodeAt(0).toString(16))}` } : {}) });
      res.send(bytes);
    } catch (error) {
      res.status(error.status || 502).json({ success: false, message: error.status ? error.message : 'Unable to load attachment.' });
    }
  };
}
