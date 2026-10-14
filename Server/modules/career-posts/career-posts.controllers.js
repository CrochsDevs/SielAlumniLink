import CareerPostModel, { POST_TYPES } from './career-posts.models.js';
import UserModel from '../users/users.models.js';

function validateGuide(data, partial = false) {
  for (const [field, limit] of [['title', 200], ['body', 10000]]) {
    if (partial && data[field] === undefined) continue;
    if (typeof data[field] !== 'string' || !data[field].trim() || data[field].length > limit) {
      return `${field === 'title' ? 'Title' : 'Guide content'} is required and must be at most ${limit} characters`;
    }
  }
  if (data.type !== undefined && !POST_TYPES.includes(data.type)) return `Type must be one of: ${POST_TYPES.join(', ')}`;
  if (data.tags !== undefined && (!Array.isArray(data.tags) || data.tags.length > 20 || data.tags.some(tag => typeof tag !== 'string' || tag.length > 100))) {
    return 'Tags must be an array of up to 20 strings (max 100 characters each)';
  }
  return null;
}

function guideData(body) {
  const data = {};
  for (const field of ['title', 'body', 'type', 'tags']) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (typeof data.tags === 'string') data.tags = data.tags.split(',').map(tag => tag.trim()).filter(Boolean);
  return data;
}

// Any logged-in user reads active posts (alumni guides + student career).
export const listPosts = async (req, res) => {
  try {
    const posts = await CareerPostModel.findAll({ type: req.query.type });
    const withMeta = posts.map((p) => ({
      ...p,
      savesCount: (p.savedBy || []).length,
      savedByMe: req.user ? (p.savedBy || []).map(String).includes(String(req.user._id)) : false,
      savedBy: undefined,
    }));
    res.status(200).json({
      success: true,
      data: withMeta,
      message: 'Career posts fetched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getSavedPosts = async (req, res) => {
  try {
    const posts = await CareerPostModel.findSavedBy(req.user._id);
    res.status(200).json({
      success: true,
      data: posts.map((p) => ({ ...p, savesCount: (p.savedBy || []).length, savedByMe: true, savedBy: undefined }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Alumni share career guidance; administrators can also publish and moderate.
export const createPost = async (req, res) => {
  try {
    if (!['admin', 'alumni'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only alumni and administrators can post career guides'
      });
    }
    const data = guideData(req.body);
    const validationError = validateGuide(data);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const { title, body, type, tags } = data;

    const profile = await UserModel.findByAuthId(req.user._id);
    const post = await CareerPostModel.create({
      title: title.trim(),
      body: body.trim(),
      type,
      tags: typeof tags === 'string' ? tags.split(',').map((t) => t.trim()).filter(Boolean) : tags,
      authorAuthId: req.user._id,
      authorName: profile?.name || '',
      authorEmail: req.user.email,
    });

    res.status(201).json({
      success: true,
      data: post,
      message: 'Career guide posted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Author or admin edits.
export const updatePost = async (req, res) => {
  try {
    const post = await CareerPostModel.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }
    const isAuthor = String(post.authorAuthId) === String(req.user._id);
    if (req.user.role !== 'admin' && !isAuthor) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: only the author can edit this post'
      });
    }
    const data = guideData(req.body);
    const validationError = validateGuide(data, true);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    if (data.title !== undefined) data.title = data.title.trim();
    if (data.body !== undefined) data.body = data.body.trim();
    const updated = await CareerPostModel.updateById(req.params.id, data);
    res.status(200).json({
      success: true,
      data: updated,
      message: 'Post updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Author or admin deletes.
export const deletePost = async (req, res) => {
  try {
    const post = await CareerPostModel.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }
    const isAuthor = String(post.authorAuthId) === String(req.user._id);
    if (req.user.role !== 'admin' && !isAuthor) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: only the author can delete this post'
      });
    }
    await CareerPostModel.deleteById(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Save resources to the signed-in user's collection.
export const toggleSavePost = async (req, res) => {
  try {
    const result = await CareerPostModel.toggleSave(req.params.id, req.user._id);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }
    res.status(200).json({
      success: true,
      data: result,
      message: result.saved ? 'Saved' : 'Unsaved'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
