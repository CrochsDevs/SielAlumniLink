import { uploadMessageAttachment } from './message-attachments.js';

export const inlineImageQuery = { 'attachment.kind': 'image', 'attachment.url': /^data:image\//,
  'attachment.publicId': { $exists: false }, unsent: { $ne: true } };

export async function migrateInlineImages(db, { upload, verify, remove }) {
  const messages = db.collection('messages');
  const report = { migrated: [], skipped: [], failed: [] };
  for await (const message of messages.find(inlineImageQuery)) {
    let asset;
    try {
      const match = /^data:(image\/(?:png|jpeg|jpg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(message.attachment.url);
      if (!match) throw new Error('Unsupported inline image');
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.toString('base64').replace(/=+$/, '') !== match[2].replace(/=+$/, '')) throw new Error('Invalid base64 image');
      // Historical messages may outlive their conversation. Their assets remain
      // authenticated; the download route separately enforces current membership.
      asset = await uploadMessageAttachment({ buffer, originalname: message.attachment.name || 'image.png', mimetype: match[1] },
        { _id: message.senderAuthId }, String(message.conversationId), upload);
      // Verify remote bytes before replacing the only stored copy of the image.
      await verify(asset, buffer);
      const result = await messages.updateOne({ _id: message._id, 'attachment.url': message.attachment.url,
        'attachment.publicId': { $exists: false }, unsent: { $ne: true } }, { $set: { attachment: asset } });
      if (result.modifiedCount) report.migrated.push(String(message._id));
      else { await remove(asset); asset = null; report.skipped.push(String(message._id)); }
    } catch (error) {
      if (asset) {
        try { await remove(asset); }
        catch { report.failed.push({ id: String(message._id), reason: 'Unable to clean up the unlinked upload' }); }
      }
      report.failed.push({ id: String(message._id), reason: error.message });
    }
  }
  return report;
}
