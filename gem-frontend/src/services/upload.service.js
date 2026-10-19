import api from './api';

const MAX_DIMENSION = 1920;
const QUALITY = 0.82;

function compressImage(file) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(file);

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION && file.size <= 2 * 1024 * 1024) {
        return resolve(file);
      }

      const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height, 1);
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file),
        'image/jpeg',
        QUALITY,
      );
    };

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export async function uploadPhoto(file, folder = 'gem') {
  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append('file', compressed);
  const res = await api.post(`/upload?folder=${folder}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.url;
}
