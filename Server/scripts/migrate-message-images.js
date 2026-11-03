import 'dotenv/config';
import { createHash } from 'node:crypto';
import { client } from '../config/db.js';
import cloudUpload, { cloudinary } from '../config/cloudinary.js';
import { inlineImageQuery, migrateInlineImages } from '../modules/messages/migrate-inline-images.js';

// Read-only unless --apply is supplied. Existing messages and timestamps stay intact.
try {
  await client.connect();
  const db = client.db('SielAlumni');
  if (!process.argv.includes('--apply')) {
    const rows = await db.collection('messages').find(inlineImageQuery, { projection: { _id: 1, createdAt: 1 } }).toArray();
    console.log(JSON.stringify({ mode: 'preview', count: rows.length, messages: rows }, null, 2));
  } else {
    const report = await migrateInlineImages(db, {
      upload: cloudUpload,
      verify: async (attachment, original) => {
        const url = cloudinary.url(attachment.publicId, { resource_type: 'image', type: 'authenticated',
          format: attachment.format, secure: true, sign_url: true });
        const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error('Cloudinary download verification failed');
        const stored = Buffer.from(await response.arrayBuffer());
        const hash = bytes => createHash('sha256').update(bytes).digest('hex');
        if (hash(stored) !== hash(original)) throw new Error('Uploaded image does not match the original bytes');
      },
      remove: async attachment => {
        if (!attachment.publicId.startsWith('alumnilink/messages/')) throw new Error('Unexpected upload folder');
        await cloudinary.uploader.destroy(attachment.publicId, { resource_type: 'image', type: 'authenticated', invalidate: true });
      },
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.failed.length) process.exitCode = 1;
  }
} finally { await client.close(); }
