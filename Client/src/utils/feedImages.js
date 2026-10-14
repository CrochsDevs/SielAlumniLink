import api from "./axios";

export const MAX_POST_IMAGES = 9;
export const POST_IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

export const validatePostImage = (file) => {
  if (!file || !POST_IMAGE_ACCEPT.split(",").includes(file.type))
    throw new Error("Choose JPG, PNG, GIF, or WebP photos.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error(
      `${file.name} is too large. Each photo must be 10 MB or smaller.`,
    );
  if (file.size === 0)
    throw new Error(`${file.name} is empty. Choose another photo.`);
};

export const uploadPostImage = async (file, onProgress) => {
  validatePostImage(file);
  const form = new FormData();
  form.append("image", file);
  const { data } = await api.post("/upload/feed-image", form, {
    timeout: 90000,
    onUploadProgress: (progress) =>
      onProgress?.(
        Math.round((progress.loaded / (progress.total || file.size)) * 100),
      ),
  });
  if (!data.success || !data.data?.id)
    throw new Error(data.message || "Photo upload failed.");
  return data.data;
};

export const postImageUrl = (image) =>
  new URL(image.url, api.defaults.baseURL).href;

export const removePostImage = async (id) => {
  await api.delete(`/upload/feed-image/${id}`);
};
