import { ensureFeedParticipation, fail } from './feed.policy.js';
import { ObjectId } from 'mongodb';

export const MAX_POST_IMAGES = 9;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const imageFormat = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpg';
  if (['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) return 'gif';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
};

export const createFeedImageUpload = (db, uploadImage) => async (req, res) => {
  try {
    if (!['alumni', 'admin'].includes(String(req.user.role).toLowerCase())) fail(403, 'Only alumni can upload post images');
    await ensureFeedParticipation(db, req.user);
    if (!req.file) fail(400, 'Choose an image to upload');
    if (req.file.buffer.length > MAX_IMAGE_BYTES) fail(400, 'Each image must be 10 MB or smaller');
    const format = imageFormat(req.file.buffer);
    if (!format) fail(400, 'Choose a valid JPG, PNG, GIF, or WebP image');
    // The content signature and image provider both validate the actual image.
    const asset = await uploadImage(req.file.buffer, {
      folder: `alumnilink/feed/${req.user._id}`,
      resource_type: 'image',
    });
    const image = { ownerAuthId: String(req.user._id), url: asset.secure_url,
      publicId: asset.public_id, width: asset.width, height: asset.height,
      format: asset.format || format, createdAt: new Date() };
    const result = await db.collection('feed_images').insertOne(image);
    // Never disclose the CDN URL: even image requests must respect post privacy.
    res.status(201).json({ success: true, data: { id: String(result.insertedId), width: image.width, height: image.height } });
  } catch (error) {
    res.status(error.status || 502).json({ success: false,
      message: error.status ? error.message : 'Image upload failed. Please try again.' });
  }
};

export const createFeedImageDownload = (feed, fetchImage = fetch) => async (req, res) => {
  try {
    const image = await feed.getImage(req.user, req.params.id, req.params.imageId);
    const upstream = await fetchImage(image.url, { signal: AbortSignal.timeout(15000) });
    if (!upstream.ok) fail(502, 'Image is temporarily unavailable');
    const contentType = upstream.headers.get('content-type') || '';
    if (!/^image\/(jpeg|png|gif|webp)$/.test(contentType.split(';')[0])) fail(502, 'Image could not be displayed');
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.set({ 'Content-Type': contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.send(bytes);
  } catch (error) {
    res.status(error.status || 502).json({ success: false, message: error.status ? error.message : 'Unable to load image. Please try again.' });
  }
};

export const createFeedImageDelete = (db, deleteImage) => async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) fail(404, 'Image not found');
    const images = db.collection('feed_images');
    const image = await images.findOne({ _id: new ObjectId(req.params.id), ownerAuthId: String(req.user._id) });
    if (!image) fail(404, 'Image not found');
    if (await db.collection('feed_posts').countDocuments({ 'images.id': String(image._id) })) fail(409, 'This image belongs to a published post');
    await deleteImage(image.publicId);
    await images.deleteOne({ _id: image._id, ownerAuthId: String(req.user._id) });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(error.status || 502).json({ success: false, message: error.status ? error.message : 'Unable to remove photo. Please try again.' });
  }
};
