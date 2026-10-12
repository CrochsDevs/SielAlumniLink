import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { protect } from '../middlewares/auth.middleware.js';
import cloudUpload, { cloudinary } from '../config/cloudinary.js';
import { client } from '../config/db.js';
import { createFeedImageDelete, createFeedImageUpload } from '../modules/feed/feed.images.js';

const router = express.Router();
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.jfif'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

const PROFILE_FOLDER = 'alumnilink/profiles';
const COVER_FOLDER = 'alumnilink/covers';
const ownerId = (user) => String(user._id || user.id);

export function validateExtension(originalName) {
  const ext = typeof originalName === 'string' ? path.extname(originalName).toLowerCase() : '';
  const valid = allowedExtensions.includes(ext);
  return {
    valid,
    ext,
    message: valid ? '' : `Invalid image extension. Allowed: ${allowedExtensions.join(', ')}`,
  };
}

// Profile and cover images are available to authenticated AlumniLink users.
const handleUpload = (folder) => async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const { valid, message } = validateExtension(req.file.originalname);
    if (!valid) return res.status(400).json({ success: false, message });
    if (req.file.size > MAX_FILE_SIZE || req.file.buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({ success: false, message: 'File size must not exceed 10MB' });
    }

    // Preserve the original extension's case when removing it from the basename.
    const ext = path.extname(req.file.originalname);
    const basename = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_') || 'image';
    const suffix = crypto.randomBytes(4).toString('hex');
    const publicId = `${basename}-${suffix}`;
    const result = await cloudUpload(req.file.buffer, {
      folder: `${folder}/${ownerId(req.user)}`,
      public_id: publicId,
    });
    console.log(`[upload] user=${req.user?.id || req.user?._id} public_id=${result.public_id}`);
    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      url: result.secure_url,
      public_id: result.public_id,
      fileName: req.file.originalname,
    });
  } catch (error) {
    console.error('[upload] Failed to upload image', error);
    return res.status(500).json({ success: false, message: 'Failed to upload image' });
  }
};

router.post('/profile', protect, upload.single('image'), handleUpload(PROFILE_FOLDER));
router.post('/cover', protect, upload.single('image'), handleUpload(COVER_FOLDER));
router.post('/feed-image', protect, upload.single('image'), createFeedImageUpload(client.db('SielAlumni'), cloudUpload));
router.delete('/feed-image/:id', protect, createFeedImageDelete(client.db('SielAlumni'), publicId => cloudinary.uploader.destroy(publicId)));

router.post('/profile/delete', protect, async (req, res) => {
  try {
    const public_id = req.body?.public_id;
    if (public_id === undefined || public_id === null || public_id === '') {
      return res.status(400).json({ success: false, message: 'public_id is required' });
    }
    if (typeof public_id !== 'string' || public_id.length > 200 || public_id.startsWith('.')) {
      return res.status(400).json({ success: false, message: 'Invalid public_id' });
    }
    const ownFolders = [PROFILE_FOLDER, COVER_FOLDER].map(folder => `${folder}/${ownerId(req.user)}/`);
    if (!ownFolders.some(folder => public_id.startsWith(folder)) || public_id.split('/').some(part => part === '.' || part === '..')) {
      return res.status(403).json({ success: false, message: 'You can only delete your own profile or cover images' });
    }
    const { cloudinary } = await import('../config/cloudinary.js');
    const result = await cloudinary.uploader.destroy(public_id);
    console.log(`[upload.delete] user=${req.user?.id || req.user?._id} role=${req.user?.role} public_id=${public_id} result=${result.result}`);
    return res.status(200).json({ success: true, message: 'Image deletion completed', result: result.result });
  } catch (error) {
    console.error('[upload.delete] Failed to delete image', error);
    return res.status(500).json({ success: false, message: 'Failed to delete image' });
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('[upload] Multipart upload failed', err);
    return res.status(400).json({
      success: false,
      message: err.code === 'LIMIT_FILE_SIZE' ? 'File size must not exceed 10MB' : err.message,
      code: err.code,
    });
  }
  next(err);
});

export default router;
