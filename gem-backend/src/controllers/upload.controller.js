const cloudinary = require('../utils/cloudinary');

async function uploadImage(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const folder = req.query.folder || 'gem';

  try {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      ).end(req.file.buffer);
    });

    res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    console.error('Cloudinary upload failed:', err.message);
    res.status(500).json({ error: 'Upload failed' });
  }
}

module.exports = { uploadImage };
