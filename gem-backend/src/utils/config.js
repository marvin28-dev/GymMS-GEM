// What the server needs from its environment, checked once as it starts
// (F-009). Without a database or a signing secret nothing works, so it stops
// and says which is missing. The rest only switch a feature off, so it warns.
const REQUIRED = {
  DATABASE_URL: 'the database it keeps everything in',
  JWT_SECRET: 'the secret that signs sign-ins',
};

const RECOMMENDED = [
  ['FRONTEND_URL', 'links in emails (password resets, welcome emails) will point to http://localhost:5173'],
  ['RESEND_API_KEY', 'no email will be sent'],
  ['CLOUDINARY_CLOUD_NAME', 'photo uploads will fail'],
  ['CLOUDINARY_API_KEY', 'photo uploads will fail'],
  ['CLOUDINARY_API_SECRET', 'photo uploads will fail'],
];

const set = (v) => String(v ?? '').trim() !== '';

// { warnings } when it can run; throws with every missing setting named when it cannot
function checkConfig(env = process.env) {
  const missing = Object.keys(REQUIRED).filter(k => !set(env[k]));
  if (missing.length) {
    throw new Error(`The server cannot start without ${missing.map(k => `${k} (${REQUIRED[k]})`).join(' and ')}. Set it in gem-backend/.env or the host's variables.`);
  }
  const warnings = RECOMMENDED.filter(([k]) => !set(env[k])).map(([k, what]) => `${k} is not set: ${what}.`);
  if (env.JWT_SECRET.length < 32) warnings.push('JWT_SECRET is shorter than 32 characters: use a long random value.');
  return { warnings };
}

module.exports = { checkConfig };
