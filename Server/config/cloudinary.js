import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default async function cloudUpload(fileBuffer, options = {}) {
  if (!Buffer.isBuffer(fileBuffer)) {
    throw new TypeError('cloudUpload requires a Buffer');
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'image', ...options },
      (error, result) => error ? reject(error) : resolve(result),
    );
    stream.on('error', reject);
    stream.end(fileBuffer);
  });
}

export { cloudinary };
