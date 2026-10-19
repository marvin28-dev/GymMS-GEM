// Stands in for the Resend client in every test: nothing leaves the machine.
// Each message is kept in `outbox`, and `refuse(address)` makes the next sends
// to that address fail the way Resend reports a refusal ({ data: null, error }).
const outbox = [];
const refused = new Set();

const refusal = (to) => ({ name: 'validation_error', message: `The address ${to} was refused (test)` });
const recipients = (msg) => [].concat(msg.to || []).map(String);

class Resend {
  constructor(key) {
    this.key = key;
    this.emails = {
      send: async (msg) => {
        const bad = recipients(msg).find(a => refused.has(a));
        if (bad) return { data: null, error: refusal(bad) };
        outbox.push({ ...msg });
        return { data: { id: `fake-email-${outbox.length}` }, error: null };
      },
    };
    this.batch = {
      send: async (list, options = {}) => {
        const data = [];
        const errors = [];
        list.forEach((msg, index) => {
          const bad = recipients(msg).find(a => refused.has(a));
          if (bad) {
            errors.push({ index, message: refusal(bad).message });
            return;
          }
          outbox.push({ ...msg });
          data.push({ id: `fake-email-${outbox.length}` });
        });
        if (errors.length && options.batchValidation !== 'permissive') {
          return { data: null, error: { name: 'validation_error', message: errors[0].message } };
        }
        return { data: { data, errors }, error: null };
      },
    };
  }
}

function refuse(address) { refused.add(String(address)); }
function reset() { outbox.length = 0; refused.clear(); }

module.exports = { Resend, outbox, refuse, reset };
