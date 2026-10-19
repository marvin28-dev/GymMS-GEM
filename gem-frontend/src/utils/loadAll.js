// Load a screen's data in one go without letting one refusal empty it.
//
// Roles differ in what they may read - payroll is the owner's, takings are the
// desk's - so a plain Promise.all rejects the whole batch on the first 403 and
// the page renders with nothing on it. Each request here fails on its own and
// falls back to an empty list, so the parts a person may see still arrive.

export const softAll = (promises) =>
  Promise.all(promises.map(p => Promise.resolve(p).then(r => r).catch(() => ({ data: [] }))));
