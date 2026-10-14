import api from "./axios";

export const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.jfif";

export function validateProfileImage(file) {
  if (
    !file ||
    !IMAGE_ACCEPT.split(",").some((ext) =>
      file.name.toLowerCase().endsWith(ext),
    )
  ) {
    throw new Error("Choose a JPG, PNG, GIF, WebP, BMP, TIFF or JFIF image.");
  }
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Image must not exceed 10 MB.");
}

export async function uploadProfileImage(file, kind = "profile") {
  validateProfileImage(file);
  const body = new FormData();
  body.append("image", file);
  const { data } = await api.post(
    `/upload/${kind === "cover" ? "cover" : "profile"}`,
    body,
    { timeout: 60000 },
  );
  if (!data.success || !data.url || !data.public_id)
    throw new Error(data.message || "Image upload failed.");
  return { url: data.url, publicId: data.public_id };
}
