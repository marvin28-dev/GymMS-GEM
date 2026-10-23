const cloudinary = require('../utils/cloudinary');

// The folders the app files pictures in; nothing else may be asked for (F-011)
const FOLDERS = new Set(['gem', 'gem/members', 'gem/staff', 'gem/staff/ids']);

// What kind of picture the file is by its first bytes, since the type it
// declares comes from the client
function imageKind(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (buf.toString('latin1', 0, 4) === 'GIF8') return 'gif';
  // Phone photos: HEIC / HEIF / AVIF
  if (buf.toString('latin1', 4, 8) === 'ftyp' && /^(heic|heix|hevc|heim|heis|mif1|msf1|avif)$/.test(buf.toString('latin1', 8, 12))) return 'heic';
  return null;
}

async function uploadImage(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const folder = String(req.query.folder || 'gem');
  if (!FOLDERS.has(folder)) return res.status(400).json({ error: 'That is not a folder photos are kept in.' });
  if (!imageKind(req.file.buffer)) return res.status(415).json({ error: 'Choose a photo: JPG, PNG, WEBP or HEIC.' });

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
