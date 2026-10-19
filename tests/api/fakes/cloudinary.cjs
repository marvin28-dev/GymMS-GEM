// Stands in for Cloudinary: uploads are kept in `uploads` and answered with a
// made-up address, so no file ever leaves the machine.
const { Writable } = require('stream');

const uploads = [];
let failNext = null;

const v2 = {
  config() {},
  uploader: {
    upload_stream(options, done) {
      const chunks = [];
      return new Writable({
        write(chunk, _encoding, next) { chunks.push(chunk); next(); },
        final(next) {
          if (failNext) {
            const error = failNext;
            failNext = null;
            done(error);
          } else {
            const n = uploads.push({ options, bytes: Buffer.concat(chunks).length });
            done(null, { secure_url: `https://res.cloudinary.test/${options.folder}/${n}.png`, public_id: `${options.folder}/${n}` });
          }
          next();
        },
      });
    },
  },
};

function failNextUpload(message = 'Upload refused (test)') { failNext = new Error(message); }
function reset() { uploads.length = 0; failNext = null; }

module.exports = { v2, uploads, failNextUpload, reset };
