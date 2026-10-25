// One-off (D-51): logos saved before f2ceee0 are kept on the gym record as
// data URLs, which travel with every read of the gym. This uploads each one to
// the photo store's gem/logos folder and keeps its address instead.
//
//   node scripts/move-logos.js           lists the gyms it would change
//   node scripts/move-logos.js --apply   uploads them and saves the addresses
//
// It reads the database named by DATABASE_URL (gem-backend/.env when it is not
// set) and changes nothing without --apply. Run it once against production,
// after a backup, if the listing shows any gym.
const path = require('path');

const DATA_URL = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([a-z0-9+/=\s]+)$/i;

function upload(cloudinary, buffer) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({ folder: 'gem/logos', resource_type: 'image' }, (error, result) => (error ? reject(error) : resolve(result)))
      .end(buffer);
  });
}

async function moveLogos({ prisma, cloudinary, apply = false, log = console.log }) {
  const gyms = await prisma.gym.findMany({ where: { logo: { startsWith: 'data:' } }, select: { id: true, code: true, logo: true } });
  const report = { found: gyms.length, moved: [], skipped: [], failed: [] };
  for (const gym of gyms) {
    const parts = DATA_URL.exec(gym.logo);
    if (!parts) {
      report.skipped.push(gym.code);
      log(`${gym.code}: the logo is not a picture this script knows; left as it is`);
      continue;
    }
    if (!apply) {
      log(`${gym.code}: would upload a ${parts[1]} logo of ${Math.round(gym.logo.length / 1024)} KB`);
      continue;
    }
    try {
      const { secure_url: url } = await upload(cloudinary, Buffer.from(parts[2].replace(/\s/g, ''), 'base64'));
      // Only a logo still the same data URL is replaced, in case the gym saved a new one meanwhile
      const saved = await prisma.gym.updateMany({ where: { id: gym.id, logo: gym.logo }, data: { logo: url } });
      if (saved.count) report.moved.push(gym.code);
      else report.skipped.push(gym.code);
      log(saved.count ? `${gym.code}: moved to ${url}` : `${gym.code}: changed meanwhile; left as it is`);
    } catch (err) {
      report.failed.push(gym.code);
      log(`${gym.code}: upload failed (${err.message}); left as it is`);
    }
  }
  if (!apply && gyms.length) log(`${gyms.length} gym(s) to move. Run again with --apply to upload them.`);
  if (!gyms.length) log('No gym has a logo kept as a data URL: nothing to do.');
  return report;
}

module.exports = { moveLogos };

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  const prisma = require('../src/utils/prisma');
  const cloudinary = require('../src/utils/cloudinary');
  moveLogos({ prisma, cloudinary, apply: process.argv.includes('--apply') })
    .then((r) => { process.exitCode = r.failed.length ? 1 : 0; })
    .catch((err) => { console.error('Moving logos failed:', err.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
