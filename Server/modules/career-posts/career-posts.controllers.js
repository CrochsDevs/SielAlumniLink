import CareerPostModel, { POST_TYPES } from './career-posts.models.js';
import UserModel from '../users/users.models.js';

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

// Alumni + admin post guides. Students read and save only.
export const createPost = async (req, res) => {
  try {
    if (!['admin', 'alumni'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only alumni can post career guides'
      });
    }
    const { title, body, type, tags } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Please provide a title' });
    }
    if (type && !POST_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: `Type must be one of: ${POST_TYPES.join(', ')}` });
    }

    const profile = await UserModel.findByAuthId(req.user._id);
    const post = await CareerPostModel.create({
      title,
      body,
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
    const updated = await CareerPostModel.updateById(req.params.id, req.body);
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

// Toggle save (students track interests via saved resources).
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
