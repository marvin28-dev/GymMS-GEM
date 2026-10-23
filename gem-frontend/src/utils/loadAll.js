// Load a screen's data in one go without letting one refusal empty it.
//
// Roles differ in what they may read - payroll is the owner's, takings are the
// desk's - so a plain Promise.all rejects the whole batch on the first 403 and
// the page renders with nothing on it. Each request here fails on its own: a
// refusal (403) is an empty list, the truth for that role.
//
// Any other failure (a server error, a dropped connection) is an empty list
// marked `failed`, which must not replace what the screen shows: screens reload
// whenever something changes elsewhere, and an empty answer used to wipe the
// list on screen and its saved copy (F-163). Check each result with failed().

export const softAll = (promises) =>
  Promise.all(promises.map(p => Promise.resolve(p).catch((err) => (
    err?.response?.status === 403 ? { data: [] } : { data: [], failed: true }
  ))));

export const failed = (res) => !!res?.failed;
