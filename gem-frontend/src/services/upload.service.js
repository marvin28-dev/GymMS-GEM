import api from './api';

export async function uploadPhoto(file, folder = 'gem') {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/upload?folder=${folder}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.url;
}
